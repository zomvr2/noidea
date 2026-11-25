import {
  distanceM,
  estimateHoursToEmpty,
  normalizeTagUid,
  OPEN_REFILL_STATUSES,
  REFILL_COLUMNS,
  type RefillListItem,
  type RefillListResponse,
  type RefillRow,
  refillEtaSeconds,
  refillPriority,
  shortDisplayName,
  TANK_COLUMNS,
  type TankRow,
  toRefill,
  toTank,
} from "@noidea/shared";
import { Hono } from "hono";
import { z } from "zod";
import { type AuthEnv, type AuthUser, requireUser } from "../lib/auth.js";
import { ApiError, fromDbError } from "../lib/errors.js";
import { db } from "../lib/supabase.js";

/** Recargas por camión aljibe al estilo despacho. Ver docs/recargas.md. */
export const refills = new Hono<AuthEnv>();

refills.use("*", requireUser("admin", "municipal"));

const CONSUMPTION_WINDOW_MS = 6 * 3_600_000;
const FAMILIES_WINDOW_MS = 30 * 24 * 3_600_000;
const DELIVERED_WINDOW_MS = 24 * 3_600_000;

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "BAD_REQUEST", "id inválido");
  return id;
}

async function parseBody<T extends z.ZodType>(schema: T, req: Request): Promise<z.infer<T>> {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) throw new ApiError(400, "BAD_REQUEST", z.prettifyError(body.error));
  return body.data;
}

async function audit(user: AuthUser, action: string, payload: Record<string, unknown>) {
  await db().from("audit_log").insert({ user_id: user.id, action, payload });
}

/** Ejecuta una función SQL de recarga y devuelve la fila mapeada. */
async function rpcRefill(fn: string, args: Record<string, unknown>) {
  const { data, error } = await db().rpc(fn, args).single<RefillRow>();
  if (error) throw fromDbError(error);
  return toRefill(data);
}

/** Abiertas ordenadas por prioridad, y entregadas/canceladas recientes al final. */
refills.get("/", async (c) => {
  const since = new Date(Date.now() - DELIVERED_WINDOW_MS).toISOString();
  const { data: rows, error } = await db()
    .from("refill_requests")
    .select(REFILL_COLUMNS)
    .or(`status.in.(${OPEN_REFILL_STATUSES.join(",")}),updated_at.gt.${since}`)
    .order("created_at", { ascending: false })
    .returns<RefillRow[]>();
  if (error) throw new ApiError(500, "DB_ERROR", error.message);
  if (!rows.length) return c.json({ items: [] } satisfies RefillListResponse);

  const tankIds = [...new Set(rows.map((r) => r.tank_id))];
  const [tanksRes, readingsRes, withdrawalsRes] = await Promise.all([
    db().from("tanks").select(TANK_COLUMNS).in("id", tankIds).returns<TankRow[]>(),
    db()
      .from("level_readings")
      .select("tank_id, volume_l, measured_at")
      .in("tank_id", tankIds)
      .is("error", null)
      .gt("measured_at", new Date(Date.now() - CONSUMPTION_WINDOW_MS).toISOString())
      .returns<{ tank_id: number; volume_l: number | string | null; measured_at: string }[]>(),
    db()
      .from("withdrawals")
      .select("tank_id, family_id")
      .in("tank_id", tankIds)
      .gt("created_at", new Date(Date.now() - FAMILIES_WINDOW_MS).toISOString())
      .returns<{ tank_id: number; family_id: number }[]>(),
  ]);
  if (tanksRes.error) throw new ApiError(500, "DB_ERROR", tanksRes.error.message);

  const tanksById = new Map(tanksRes.data.map((t) => [t.id, toTank(t)]));
  const items: RefillListItem[] = rows.flatMap((row) => {
    const tank = tanksById.get(row.tank_id);
    if (!tank) return [];
    const readings = (readingsRes.data ?? [])
      .filter((r) => r.tank_id === row.tank_id)
      .map((r) => ({ volumeL: r.volume_l === null ? null : Number(r.volume_l), at: r.measured_at }));
    const families = new Set(
      (withdrawalsRes.data ?? []).filter((w) => w.tank_id === row.tank_id).map((w) => w.family_id),
    ).size;
    const hoursToEmpty = estimateHoursToEmpty(readings);
    return [
      {
        refill: toRefill(row),
        tank: { id: tank.id, name: tank.name, location: tank.location, level: tank.level, capacityL: tank.capacityL },
        hoursToEmpty,
        families,
        priority: refillPriority({ hoursToEmpty, percent: tank.level.percent, families }),
      },
    ];
  });

  const isOpen = (i: RefillListItem) => OPEN_REFILL_STATUSES.includes(i.refill.status);
  items.sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || b.priority - a.priority);
  return c.json({ items } satisfies RefillListResponse);
});

const createSchema = z.object({
  tankId: z.number().int().positive(),
  volumeL: z.number().positive().max(100_000).optional(),
  notes: z.string().trim().max(200).optional(),
});

/** Solicitud manual. Las automáticas las crea record_level al bajar del umbral. */
refills.post("/", async (c) => {
  const body = await parseBody(createSchema, c.req.raw);
  const user = c.get("user");
  const refill = await rpcRefill("request_refill", {
    p_tank_id: body.tankId,
    p_user_id: user.id,
    p_volume_l: body.volumeL ?? null,
    p_notes: body.notes || null,
  });
  await audit(user, "refill.request", { refillId: refill.id, tankId: body.tankId });
  return c.json(refill, 201);
});

refills.post("/:id/claim", async (c) => {
  const id = parseId(c.req.param("id"));
  const user = c.get("user");
  const { data: profile } = await db().from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const refill = await rpcRefill("claim_refill", {
    p_id: id,
    p_user_id: user.id,
    p_name: shortDisplayName(profile?.full_name ?? ""),
  });
  await audit(user, "refill.claim", { refillId: id });
  return c.json(refill);
});

refills.post("/:id/release", async (c) => {
  const id = parseId(c.req.param("id"));
  const user = c.get("user");
  const refill = await rpcRefill("release_refill", { p_id: id, p_user_id: user.id, p_is_admin: user.role === "admin" });
  await audit(user, "refill.release", { refillId: id });
  return c.json(refill);
});

refills.post("/:id/start", async (c) => {
  const id = parseId(c.req.param("id"));
  const user = c.get("user");
  const refill = await rpcRefill("start_refill", { p_id: id, p_user_id: user.id });
  await audit(user, "refill.start", { refillId: id });
  return c.json(refill);
});

const positionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(10_000).nullable(),
});

/** Posición en vivo (cada ~10 s). No se audita: solo se guarda la última. */
refills.post("/:id/position", async (c) => {
  const id = parseId(c.req.param("id"));
  const body = await parseBody(positionSchema, c.req.raw);
  const user = c.get("user");

  const { data: row } = await db().from("refill_requests").select("tank_id").eq("id", id).maybeSingle();
  if (!row) throw new ApiError(404, "REFILL_NOT_FOUND", "Recarga no encontrada.");
  const { data: tank } = await db()
    .from("tanks")
    .select("latitude, longitude")
    .eq("id", row.tank_id)
    .maybeSingle<{ latitude: number | null; longitude: number | null }>();
  const etaS =
    tank?.latitude != null && tank.longitude != null
      ? refillEtaSeconds(distanceM(body, { latitude: tank.latitude, longitude: tank.longitude }))
      : null;

  const refill = await rpcRefill("update_refill_position", {
    p_id: id,
    p_user_id: user.id,
    p_latitude: body.latitude,
    p_longitude: body.longitude,
    p_eta_s: etaS,
  });
  return c.json(refill);
});

const arriveSchema = z.object({ tagUid: z.string().min(4).max(40) });

/** Llegada: la etiqueta NFC escaneada debe ser la del estanque de la recarga. */
refills.post("/:id/arrive", async (c) => {
  const id = parseId(c.req.param("id"));
  const body = await parseBody(arriveSchema, c.req.raw);
  const tagUid = normalizeTagUid(body.tagUid);
  const user = c.get("user");

  const { data: row } = await db().from("refill_requests").select("tank_id").eq("id", id).maybeSingle();
  if (!row) throw new ApiError(404, "REFILL_NOT_FOUND", "Recarga no encontrada.");
  const { data: tank } = await db()
    .from("tanks")
    .select("id")
    .eq("nfc_tag_uid", tagUid)
    .is("deleted_at", null)
    .maybeSingle();
  if (!tank || tank.id !== row.tank_id) {
    throw new ApiError(409, "NOT_AT_TANK", "La etiqueta escaneada no corresponde al estanque de esta recarga.");
  }

  const refill = await rpcRefill("arrive_refill", { p_id: id, p_user_id: user.id });
  await audit(user, "refill.arrive", { refillId: id, tagUid });
  return c.json(refill);
});

refills.post("/:id/deliver", async (c) => {
  const id = parseId(c.req.param("id"));
  const user = c.get("user");
  const refill = await rpcRefill("confirm_refill_delivery", { p_id: id, p_user_id: user.id });
  await audit(user, "refill.deliver", { refillId: id, deliveredEstimatedL: refill.deliveredEstimatedL });
  return c.json(refill);
});

refills.post("/:id/cancel", async (c) => {
  const id = parseId(c.req.param("id"));
  const user = c.get("user");
  const refill = await rpcRefill("cancel_refill", { p_id: id, p_user_id: user.id, p_is_admin: user.role === "admin" });
  await audit(user, "refill.cancel", { refillId: id });
  return c.json(refill);
});
