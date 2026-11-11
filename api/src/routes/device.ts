import { PROTOCOL_VERSION } from "@noidea/shared";
import { Hono } from "hono";
import { z } from "zod";
import { stopTankDevice } from "../lib/commands.js";
import { type DeviceEnv, requireDevice } from "../lib/device-auth.js";
import { ApiError, fromDbError } from "../lib/errors.js";
import { distanceToLevel, openMsToLiters } from "../lib/level-math.js";
import type { TankRow, WithdrawalRow } from "../lib/mappers.js";
import { db } from "../lib/supabase.js";

const telemetrySchema = z.object({
  fw: z.string().max(20),
  proto: z.number().int(),
  distanceMm: z.number().int().min(0).max(5000).nullable(),
  error: z.string().max(20).nullable(),
  backupRaw: z.number().int().min(0).max(4095),
  backupLow: z.boolean(),
  rssi: z.number().int(),
});

const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ACK"), cmd: z.enum(["OPEN", "STOP"]), id: z.number().int().positive() }),
  z.object({
    type: z.literal("NAK"),
    cmd: z.enum(["OPEN", "STOP"]),
    id: z.number().int().positive(),
    reason: z.string().max(20),
  }),
  z.object({ type: z.literal("RUN"), id: z.number().int().positive(), elapsedMs: z.number().int().min(0) }),
  z.object({
    type: z.literal("DONE"),
    id: z.number().int().positive(),
    openMs: z.number().int().min(0),
    reason: z.enum(["TARGET", "STOP", "LINK_LOST", "LOW_LEVEL", "MAX_MS"]),
  }),
]);

function parseBody<T>(schema: z.ZodType<T>, raw: string): T {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "BAD_JSON", "JSON inválido.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ApiError(400, "BAD_REQUEST", z.prettifyError(parsed.error));
  return parsed.data;
}

export const device = new Hono<DeviceEnv>();
device.use("*", requireDevice);

/** Telemetría de nivel (cada ~10 s). La conversión a litros vive aquí, no en el firmware. */
device.post("/telemetry", async (c) => {
  const t = parseBody(telemetrySchema, c.get("rawBody"));
  const dev = c.get("device");
  if (t.proto !== PROTOCOL_VERSION) {
    throw new ApiError(409, "PROTOCOL_MISMATCH", `Firmware con protocolo v${t.proto}; se espera v${PROTOCOL_VERSION}.`);
  }

  const { data: tank } = await db()
    .from("tanks")
    .select("capacity_l, empty_distance_mm, full_distance_mm")
    .eq("id", dev.tank_id)
    .single<Pick<TankRow, "capacity_l" | "empty_distance_mm" | "full_distance_mm">>();
  if (!tank) throw new ApiError(404, "TANK_NOT_FOUND", "Estanque no encontrado.");

  const level =
    t.distanceMm === null
      ? null
      : distanceToLevel(t.distanceMm, {
          capacityL: Number(tank.capacity_l),
          emptyDistanceMm: tank.empty_distance_mm,
          fullDistanceMm: tank.full_distance_mm,
        });

  const { error } = await db().rpc("record_level", {
    p_tank_id: dev.tank_id,
    p_distance_mm: t.distanceMm,
    p_volume_l: level?.volumeL ?? null,
    p_percent: level?.percent ?? null,
    p_backup_raw: t.backupRaw,
    p_backup_low: t.backupLow,
    p_error: t.distanceMm === null ? (t.error ?? "NO_ECHO") : null,
    p_simulated: dev.simulated,
  });
  if (error) throw fromDbError(error);

  await db().from("devices").update({ fw_version: t.fw, last_seen_at: new Date().toISOString() }).eq("id", dev.id);
  await db().rpc("expire_stale_withdrawals");
  return c.body(null, 204);
});

/** Eventos de la válvula: ACK/NAK de órdenes, progreso y cierre. */
device.post("/events", async (c) => {
  const e = parseBody(eventSchema, c.get("rawBody"));
  const dev = c.get("device");

  const { data: w } = await db()
    .from("withdrawals")
    .select("*")
    .eq("id", e.id)
    .eq("tank_id", dev.tank_id)
    .maybeSingle<WithdrawalRow>();
  if (!w) {
    // Orden desconocida para este estanque: por seguridad se pide cerrar.
    if (e.type === "ACK" && e.cmd === "OPEN") await stopTankDevice(dev.tank_id, e.id);
    throw new ApiError(404, "WITHDRAWAL_NOT_FOUND", "Retiro no encontrado.");
  }

  switch (e.type) {
    case "ACK":
      if (e.cmd === "OPEN") {
        const { data } = await db().rpc("start_withdrawal", { p_id: w.id }).single<WithdrawalRow>();
        // El retiro ya expiró o se rechazó: la válvula no debe quedar abierta.
        if (data && data.status !== "dispensing") await stopTankDevice(dev.tank_id, w.id);
      }
      break;
    case "NAK":
      if (e.cmd === "OPEN") await db().rpc("reject_withdrawal", { p_id: w.id, p_reason: `NAK_${e.reason}` });
      break;
    case "RUN":
      await db().from("withdrawals").update({ progress_ms: e.elapsedMs }).eq("id", w.id).eq("status", "dispensing");
      break;
    case "DONE": {
      const { data: tank } = await db().from("tanks").select("flow_lps").eq("id", dev.tank_id).single();
      const deliveredL = openMsToLiters(e.openMs, Number(tank?.flow_lps ?? 0));
      const { error } = await db().rpc("finish_withdrawal", {
        p_id: w.id,
        p_open_ms: e.openMs,
        p_close_reason: e.reason,
        p_delivered_l: deliveredL,
      });
      if (error) throw fromDbError(error);
      break;
    }
  }
  return c.body(null, 204);
});
