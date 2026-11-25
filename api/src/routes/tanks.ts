import { normalizeTagUid, type RemoveTankResponse } from "@noidea/shared";
import { Hono } from "hono";
import { z } from "zod";
import { type AuthEnv, requireUser } from "../lib/auth.js";
import { ApiError, fromDbError } from "../lib/errors.js";
import { TANK_COLUMNS, type TankRow, toTank } from "../lib/mappers.js";
import { db } from "../lib/supabase.js";

/** Calibración por defecto de un estanque nuevo (se ajusta después; ver docs/hardware.md). */
const DEFAULT_CALIBRATION = {
  capacity_l: 8,
  empty_distance_mm: 250,
  full_distance_mm: 60,
  flow_lps: 0.05,
  critical_percent: 20,
};

const locateSchema = z.object({
  tagUid: z.string().min(4).max(40),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(10_000).nullable(),
  name: z.string().trim().min(2).max(60).optional(),
});

export const tanks = new Hono<AuthEnv>();

/**
 * El admin escanea la etiqueta NFC del estanque y la app envía el GPS del teléfono.
 * Si la etiqueta no existe y viene `name`, se registra el estanque nuevo.
 */
tanks.post("/locate", requireUser("admin"), async (c) => {
  const body = locateSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) throw new ApiError(400, "BAD_REQUEST", z.prettifyError(body.error));
  const { latitude, longitude, accuracyM, name } = body.data;
  const tagUid = normalizeTagUid(body.data.tagUid);
  const user = c.get("user");

  const location = {
    latitude,
    longitude,
    location_accuracy_m: accuracyM,
    location_marked_at: new Date().toISOString(),
    location_marked_by: user.id,
  };

  const { data: existing } = await db()
    .from("tanks")
    .select("id")
    .eq("nfc_tag_uid", tagUid)
    .is("deleted_at", null)
    .maybeSingle();

  let row: TankRow;
  if (existing) {
    const { data, error } = await db()
      .from("tanks")
      .update(name ? { ...location, name } : location)
      .eq("id", existing.id)
      .select(TANK_COLUMNS)
      .single<TankRow>();
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    row = data;
  } else {
    if (!name) throw new ApiError(404, "TAG_UNKNOWN", "Etiqueta no registrada: indica un nombre para crear el estanque.");
    const { data, error } = await db()
      .from("tanks")
      .insert({ ...DEFAULT_CALIBRATION, ...location, name, nfc_tag_uid: tagUid })
      .select(TANK_COLUMNS)
      .single<TankRow>();
    if (error) throw new ApiError(500, "DB_ERROR", error.message);
    row = data;
  }

  await db().from("audit_log").insert({
    user_id: user.id,
    action: existing ? "tank.locate" : "tank.create",
    payload: { tankId: row.id, tagUid, latitude, longitude, accuracyM },
  });

  return c.json(toTank(row));
});

const removeSchema = z.object({
  tagUid: z.string().min(4).max(40),
  tankId: z.number().int().positive(),
});

/**
 * Proceso inverso a /locate: el admin escanea la etiqueta junto al estanque y confirma.
 * Borrado lógico (remove_tank): revoca el dispensador, cierra alertas y recargas pendientes.
 */
tanks.post("/remove", requireUser("admin"), async (c) => {
  const body = removeSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) throw new ApiError(400, "BAD_REQUEST", z.prettifyError(body.error));
  const tagUid = normalizeTagUid(body.data.tagUid);
  const user = c.get("user");

  await db().rpc("expire_stale_withdrawals");

  const { data: tank } = await db()
    .from("tanks")
    .select("id, name")
    .eq("nfc_tag_uid", tagUid)
    .is("deleted_at", null)
    .maybeSingle<{ id: number; name: string }>();
  if (!tank) throw new ApiError(404, "TAG_UNKNOWN", "Esta etiqueta no corresponde a un estanque registrado.");
  if (tank.id !== body.data.tankId) {
    throw new ApiError(409, "TAG_MISMATCH", "La etiqueta escaneada no corresponde al estanque confirmado.");
  }

  const { data, error } = await db()
    .rpc("remove_tank", { p_tank_id: tank.id, p_user_id: user.id })
    .single<{ id: number; name: string; deleted_at: string }>();
  if (error) throw fromDbError(error);

  await db().from("audit_log").insert({
    user_id: user.id,
    action: "tank.remove",
    payload: { tankId: data.id, tagUid, name: data.name },
  });

  const res: RemoveTankResponse = { id: data.id, name: data.name, deletedAt: data.deleted_at };
  return c.json(res);
});
