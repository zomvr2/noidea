import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA256 en hex minúscula (igual que el firmware). */
export function hmacHex(secretHex: string, message: string): string {
  return createHmac("sha256", Buffer.from(secretHex, "hex")).update(message, "utf8").digest("hex");
}

/** Comparación en tiempo constante de dos firmas hex. */
export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
