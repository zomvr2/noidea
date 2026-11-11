import {
  commandSigningString,
  DEVICE_COMMAND_EVENT,
  type DeviceCommand,
  deviceTopic,
  type SignedDeviceCommand,
} from "@noidea/shared";
import { hmacHex } from "./crypto.js";
import { env } from "./env.js";
import { db } from "./supabase.js";

export function signCommand(secretHex: string, cmd: DeviceCommand): SignedDeviceCommand {
  return { ...cmd, sig: hmacHex(secretHex, commandSigningString(cmd)) };
}

/** Envía una orden firmada al ESP32 por Supabase Realtime Broadcast (endpoint REST). */
export async function sendDeviceCommand(deviceId: string, secretHex: string, cmd: DeviceCommand): Promise<void> {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env();
  const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          topic: deviceTopic(deviceId),
          event: DEVICE_COMMAND_EVENT,
          payload: signCommand(secretHex, cmd),
          private: false,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Broadcast falló: ${res.status} ${await res.text()}`);
}

export const nowS = () => Math.floor(Date.now() / 1000);

/** Envía STOP al dispositivo del estanque (usado ante estados inconsistentes). */
export async function stopTankDevice(tankId: number, withdrawalId: number) {
  const { data } = await db().from("devices").select("id, secret").eq("tank_id", tankId).maybeSingle();
  if (data) await sendDeviceCommand(data.id, data.secret, { cmd: "STOP", id: withdrawalId, ts: nowS() });
}
