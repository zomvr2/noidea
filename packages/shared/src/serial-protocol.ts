/**
 * Protocolo serial NoIdea v1 (servidor <-> Arduino Uno por USB, 115200 baudios).
 *
 * Fuente de verdad del contrato. El firmware (firmware/noidea_controller) debe
 * implementar exactamente lo que se describe aquí y en docs/protocolo-serial.md.
 *
 * - Texto ASCII, una línea por mensaje, terminada en "\n" (se tolera "\r\n").
 * - Máximo 63 caracteres por línea (buffer del Uno).
 * - Servidor -> Arduino: comandos posicionales  `CMD arg1 arg2`.
 * - Arduino -> Servidor: `TIPO clave=valor clave=valor`.
 */

export const PROTOCOL_VERSION = 1;
export const SERIAL_BAUD_RATE = 115200;
export const MAX_LINE_LENGTH = 63;
export const LCD_COLUMNS = 16;

/** Si el Arduino no recibe nada del servidor en este tiempo con la válvula abierta, la cierra. */
export const LINK_TIMEOUT_MS = 3000;
/** Cada cuánto el servidor envía PING para mantener vivo el enlace. */
export const HOST_PING_INTERVAL_MS = 1000;
/** Tope absoluto de apertura que acepta el firmware. */
export const MAX_OPEN_MS = 60000;

// ---------------------------------------------------------------------------
// Servidor -> Arduino
// ---------------------------------------------------------------------------

export type HostCommand =
  | { cmd: "PING" }
  | { cmd: "LEVEL" }
  | { cmd: "OPEN"; id: number; ms: number }
  | { cmd: "STOP"; id: number }
  | { cmd: "LCD"; row: 0 | 1; text: string };

/** Deja el texto apto para la LCD: ASCII imprimible, sin saltos, recortado a 16 columnas. */
export function sanitizeLcdText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .slice(0, LCD_COLUMNS);
}

export function encodeHostCommand(c: HostCommand): string {
  let line: string;
  switch (c.cmd) {
    case "PING":
    case "LEVEL":
      line = c.cmd;
      break;
    case "OPEN":
      assertUint(c.id, "id");
      assertUint(c.ms, "ms");
      if (c.ms < 1 || c.ms > MAX_OPEN_MS) throw new RangeError(`ms fuera de rango: ${c.ms}`);
      line = `OPEN ${c.id} ${c.ms}`;
      break;
    case "STOP":
      assertUint(c.id, "id");
      line = `STOP ${c.id}`;
      break;
    case "LCD":
      line = `LCD ${c.row} ${sanitizeLcdText(c.text)}`;
      break;
  }
  if (line.length > MAX_LINE_LENGTH) throw new RangeError("Línea demasiado larga");
  return `${line}\n`;
}

function assertUint(n: number, name: string) {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new RangeError(`${name} debe ser entero sin signo de 32 bits: ${n}`);
  }
}

// ---------------------------------------------------------------------------
// Arduino -> Servidor
// ---------------------------------------------------------------------------

/** Motivo de cierre de la válvula informado en DONE. */
export type CloseReason =
  | "TARGET" // se cumplió el tiempo autorizado
  | "STOP" // el servidor pidió detener
  | "LINK_LOST" // se perdió la comunicación con el servidor
  | "LOW_LEVEL" // el sensor de respaldo detectó nivel crítico
  | "MAX_MS"; // tope de seguridad del firmware

export type NakReason = "BUSY" | "BAD_ARGS" | "MAX_MS" | "LOW_LEVEL" | "NOT_ACTIVE";

export type DeviceMessage =
  | { type: "BOOT"; fw: string; proto: number }
  | { type: "PONG"; fw: string; proto: number }
  /**
   * Nivel: distancia sensor->agua en mm (HC-SR04), lectura cruda del sensor resistivo
   * de respaldo (0-1023) y si ese respaldo está bajo el umbral de fondo seco (umbral en el firmware).
   */
  | { type: "LVL"; distanceMm: number | null; error: string | null; backupRaw: number | null; backupLow: boolean | null }
  | { type: "ACK"; cmd: string; id: number | null }
  | { type: "NAK"; cmd: string; id: number | null; reason: string }
  | { type: "RUN"; id: number; elapsedMs: number }
  | { type: "DONE"; id: number; openMs: number; reason: CloseReason }
  | { type: "ERR"; code: string }
  | { type: "UNKNOWN"; raw: string };

function parseFields(tokens: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of tokens) {
    const i = t.indexOf("=");
    if (i > 0) out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

function int(v: string | undefined): number | null {
  if (v === undefined || !/^\d+$/.test(v)) return null;
  return Number(v);
}

/** Interpreta una línea enviada por el Arduino. Nunca lanza: lo irreconocible vuelve como UNKNOWN. */
export function parseDeviceLine(rawLine: string): DeviceMessage {
  const raw = rawLine.trim();
  const [type, ...rest] = raw.split(/\s+/);
  const f = parseFields(rest);
  const unknown: DeviceMessage = { type: "UNKNOWN", raw };

  switch (type) {
    case "BOOT":
    case "PONG": {
      const proto = int(f.proto);
      if (!f.fw || proto === null) return unknown;
      return { type, fw: f.fw, proto };
    }
    case "LVL":
      return {
        type: "LVL",
        distanceMm: int(f.d),
        error: f.err ?? null,
        backupRaw: int(f.b),
        backupLow: f.low === "1" ? true : f.low === "0" ? false : null,
      };
    case "ACK":
      if (!f.cmd) return unknown;
      return { type: "ACK", cmd: f.cmd, id: int(f.id) };
    case "NAK":
      if (!f.cmd || !f.r) return unknown;
      return { type: "NAK", cmd: f.cmd, id: int(f.id), reason: f.r };
    case "RUN": {
      const id = int(f.id);
      const ms = int(f.ms);
      if (id === null || ms === null) return unknown;
      return { type: "RUN", id, elapsedMs: ms };
    }
    case "DONE": {
      const id = int(f.id);
      const ms = int(f.ms);
      const reasons: CloseReason[] = ["TARGET", "STOP", "LINK_LOST", "LOW_LEVEL", "MAX_MS"];
      if (id === null || ms === null || !reasons.includes(f.r as CloseReason)) return unknown;
      return { type: "DONE", id, openMs: ms, reason: f.r as CloseReason };
    }
    case "ERR":
      return f.code ? { type: "ERR", code: f.code } : unknown;
    default:
      return unknown;
  }
}
