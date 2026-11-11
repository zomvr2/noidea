/**
 * Simulador del ESP32 para desarrollar sin hardware. Implementa el mismo protocolo v2:
 * escucha órdenes firmadas por Supabase Realtime y reporta a la API con peticiones firmadas.
 *
 * SOLO DESARROLLO. Usar un dispositivo marcado como simulado para que la app muestre "SIMULADOR":
 *   update devices set simulated = true where id = '<SIM_DEVICE_ID>';
 *
 * Uso: npm run simulate   (variables en api/.env.local, ver .env.example)
 */
import {
  commandSigningString,
  DEVICE_COMMAND_EVENT,
  deviceTopic,
  MAX_OPEN_MS,
  PROTOCOL_VERSION,
  requestSigningString,
  RUN_REPORT_MS,
  type SignedDeviceCommand,
  TELEMETRY_INTERVAL_MS,
} from "@noidea/shared";
import { createClient } from "@supabase/supabase-js";
import { hmacHex, safeEqualHex } from "../src/lib/crypto.js";

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Falta ${k} en api/.env.local`);
  return v;
};
const API_URL = need("API_URL").replace(/\/$/, "");
const DEVICE_ID = need("SIM_DEVICE_ID");
const SECRET = need("SIM_DEVICE_SECRET");
const supabase = createClient(need("SUPABASE_URL"), need("SUPABASE_PUBLISHABLE_KEY"));

// Estanque ficticio: 8 L, sensor a 60 mm (lleno) / 250 mm (vacío), caudal 0,05 L/s.
const tank = { capacityL: 8, emptyMm: 250, fullMm: 60, flowLps: 0.05 };
let volumeL = 6;
let lastOpenId = 0;
let active: { id: number; ms: number; startedAt: number; timer: NodeJS.Timeout } | null = null;

async function post(path: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const res = await fetch(`${API_URL}/api/device/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Device-Id": DEVICE_ID,
      "X-Timestamp": String(ts),
      "X-Signature": hmacHex(SECRET, requestSigningString(ts, body)),
    },
    body,
  });
  if (!res.ok) console.warn(`[sim] ${path} -> ${res.status} ${await res.text()}`);
}

function telemetry() {
  const fraction = volumeL / tank.capacityL;
  const low = fraction <= 0.05;
  return post("telemetry", {
    fw: "sim-0.2.0",
    proto: PROTOCOL_VERSION,
    distanceMm: Math.round(tank.emptyMm - fraction * (tank.emptyMm - tank.fullMm)),
    error: null,
    backupRaw: low ? 150 : 2600,
    backupLow: low,
    rssi: -55,
  });
}

function close(reason: string) {
  if (!active) return;
  clearInterval(active.timer);
  const openMs = Math.min(Date.now() - active.startedAt, active.ms);
  const id = active.id;
  active = null;
  console.log(`[sim] cierre id=${id} ms=${openMs} r=${reason}`);
  void post("events", { type: "DONE", id, openMs, reason }).then(() => setTimeout(telemetry, 4000));
}

function handle(cmd: SignedDeviceCommand) {
  const { sig, ...unsigned } = cmd;
  if (!safeEqualHex(hmacHex(SECRET, commandSigningString(unsigned)), sig)) {
    return console.warn("[sim] orden con firma inválida descartada");
  }
  if (Math.abs(Date.now() / 1000 - cmd.ts) > 30) return console.warn("[sim] orden vencida descartada");

  if (cmd.cmd === "OPEN") {
    if (cmd.id <= lastOpenId) return console.warn("[sim] OPEN repetido descartado");
    if (active) return void post("events", { type: "NAK", cmd: "OPEN", id: cmd.id, reason: "BUSY" });
    if (cmd.ms > MAX_OPEN_MS) return void post("events", { type: "NAK", cmd: "OPEN", id: cmd.id, reason: "MAX_MS" });
    lastOpenId = cmd.id;
    void post("events", { type: "ACK", cmd: "OPEN", id: cmd.id });
    console.log(`[sim] abre id=${cmd.id} por ${cmd.ms} ms`);
    const startedAt = Date.now();
    active = {
      id: cmd.id,
      ms: cmd.ms,
      startedAt,
      timer: setInterval(() => {
        const elapsed = Date.now() - startedAt;
        volumeL = Math.max(0, volumeL - tank.flowLps * (RUN_REPORT_MS / 1000));
        if (volumeL <= 0) return close("LOW_LEVEL");
        if (elapsed >= cmd.ms) return close("TARGET");
        void post("events", { type: "RUN", id: cmd.id, elapsedMs: elapsed });
      }, RUN_REPORT_MS),
    };
  } else if (cmd.cmd === "STOP") {
    if (!active || active.id !== cmd.id) return void post("events", { type: "NAK", cmd: "STOP", id: cmd.id, reason: "NOT_ACTIVE" });
    void post("events", { type: "ACK", cmd: "STOP", id: cmd.id });
    close("STOP");
  } else {
    console.log(`[sim] LCD fila ${cmd.row}: ${cmd.text}`);
  }
}

supabase
  .channel(deviceTopic(DEVICE_ID), { config: { broadcast: { self: false } } })
  .on("broadcast", { event: DEVICE_COMMAND_EVENT }, ({ payload }) => handle(payload as SignedDeviceCommand))
  .subscribe((status) => {
    console.log(`[sim] Realtime: ${status}`);
    // Igual que el firmware: si se pierde el enlace con la válvula abierta, se cierra.
    if (status !== "SUBSCRIBED" && active) close("LINK_LOST");
  });

void telemetry();
setInterval(telemetry, TELEMETRY_INTERVAL_MS);
console.log(`[sim] dispositivo ${DEVICE_ID} simulado -> ${API_URL}`);
