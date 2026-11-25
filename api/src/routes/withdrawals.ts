import { normalizeTagUid } from "@noidea/shared";
import { Hono } from "hono";
import { z } from "zod";
import { type AuthEnv, requireUser } from "../lib/auth.js";
import { nowS, sendDeviceCommand } from "../lib/commands.js";
import { ApiError, fromDbError } from "../lib/errors.js";
import { toWithdrawal, type WithdrawalRow } from "../lib/mappers.js";
import { db } from "../lib/supabase.js";

const createSchema = z.object({
  tagUid: z.string().min(4).max(40),
  // Volúmenes pequeños a escala del prototipo.
  liters: z.number().positive().max(5),
});

/** Cuánto espera la API el ACK del ESP32 antes de dar el retiro por fallido. */
const ACK_WAIT_MS = 8_000;

export const withdrawals = new Hono<AuthEnv>();

withdrawals.post("/", requireUser("family"), async (c) => {
  const body = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) throw new ApiError(400, "BAD_REQUEST", z.prettifyError(body.error));
  const user = c.get("user");
  if (!user.familyId) throw new ApiError(403, "NO_FAMILY", "Tu usuario no está asociado a una familia.");

  await db().rpc("expire_stale_withdrawals");

  const { data: tank } = await db()
    .from("tanks")
    .select("id")
    .eq("nfc_tag_uid", normalizeTagUid(body.data.tagUid))
    .is("deleted_at", null)
    .maybeSingle();
  if (!tank) throw new ApiError(404, "TAG_UNKNOWN", "Esta etiqueta no corresponde a un estanque registrado.");

  const { data: device } = await db().from("devices").select("id, secret").eq("tank_id", tank.id).maybeSingle();
  if (!device) throw new ApiError(409, "NO_DEVICE", "El estanque no tiene dispensador asociado.");

  const { data: authorized, error } = await db()
    .rpc("authorize_withdrawal", {
      p_family_id: user.familyId,
      p_tank_id: tank.id,
      p_liters: body.data.liters,
      p_user_id: user.id,
    })
    .single<WithdrawalRow>();
  if (error) throw fromDbError(error);

  try {
    await sendDeviceCommand(device.id, device.secret, {
      cmd: "OPEN",
      id: authorized.id,
      ms: authorized.target_ms,
      ts: nowS(),
    });
  } catch (err) {
    console.error(err);
    await db().rpc("reject_withdrawal", { p_id: authorized.id, p_reason: "SEND_FAILED" });
    throw new ApiError(502, "DEVICE_UNREACHABLE", "No se pudo enviar la orden al dispensador.");
  }

  // Espera el ACK (lo registra /api/device/events). Fluid compute: esperar no consume CPU.
  const deadline = Date.now() + ACK_WAIT_MS;
  let current: WithdrawalRow = authorized;
  while (current.status === "authorized" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 400));
    const { data } = await db().from("withdrawals").select("*").eq("id", authorized.id).single<WithdrawalRow>();
    if (data) current = data;
  }
  if (current.status === "authorized") {
    const { data } = await db()
      .rpc("reject_withdrawal", { p_id: authorized.id, p_reason: "NO_ACK" })
      .single<WithdrawalRow>();
    if (data) current = data;
  }

  return c.json(toWithdrawal(current), 201);
});

withdrawals.post("/:id/stop", requireUser("family", "admin"), async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) throw new ApiError(400, "BAD_REQUEST", "id inválido");
  const user = c.get("user");

  const { data: w } = await db().from("withdrawals").select("*").eq("id", id).maybeSingle<WithdrawalRow>();
  if (!w || (user.role === "family" && w.family_id !== user.familyId)) {
    throw new ApiError(404, "WITHDRAWAL_NOT_FOUND", "Retiro no encontrado.");
  }
  if (w.status !== "dispensing" && w.status !== "authorized") return c.json(toWithdrawal(w));

  const { data: device } = await db().from("devices").select("id, secret").eq("tank_id", w.tank_id).single();
  if (device) await sendDeviceCommand(device.id, device.secret, { cmd: "STOP", id, ts: nowS() });
  // El cierre real llega con DONE r=STOP desde el ESP32.
  return c.json(toWithdrawal(w), 202);
});
