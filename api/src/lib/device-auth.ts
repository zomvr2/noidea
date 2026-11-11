import { COMMAND_MAX_AGE_S, requestSigningString } from "@noidea/shared";
import { createMiddleware } from "hono/factory";
import { hmacHex, safeEqualHex } from "./crypto.js";
import { ApiError } from "./errors.js";
import { db } from "./supabase.js";

export interface DeviceRow {
  id: string;
  tank_id: number;
  secret: string;
  simulated: boolean;
}

export type DeviceEnv = { Variables: { device: DeviceRow; rawBody: string } };

/**
 * Autentica peticiones del ESP32: X-Device-Id, X-Timestamp (s) y
 * X-Signature = HMAC(secreto, `${ts}\n${body}`). El secreto nunca viaja.
 */
export const requireDevice = createMiddleware<DeviceEnv>(async (c, next) => {
  const deviceId = c.req.header("X-Device-Id") ?? "";
  const ts = Number(c.req.header("X-Timestamp"));
  const sig = (c.req.header("X-Signature") ?? "").toLowerCase();
  const rawBody = await c.req.text();

  if (!/^[0-9a-f-]{36}$/i.test(deviceId) || !Number.isInteger(ts) || !sig) {
    throw new ApiError(401, "BAD_DEVICE_AUTH", "Cabeceras de dispositivo inválidas.");
  }
  if (Math.abs(Date.now() / 1000 - ts) > COMMAND_MAX_AGE_S) {
    throw new ApiError(401, "STALE_REQUEST", "Marca de tiempo fuera de rango (¿NTP del ESP32?).");
  }

  const { data: device } = await db()
    .from("devices")
    .select("id, tank_id, secret, simulated")
    .eq("id", deviceId)
    .maybeSingle<DeviceRow>();
  if (!device || !safeEqualHex(hmacHex(device.secret, requestSigningString(ts, rawBody)), sig)) {
    throw new ApiError(401, "BAD_SIGNATURE", "Firma de dispositivo inválida.");
  }

  c.set("device", device);
  c.set("rawBody", rawBody);
  await next();
});
