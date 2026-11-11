import { describe, expect, it } from "vitest";
import { hmacHex, safeEqualHex } from "./crypto.js";

describe("hmacHex", () => {
  // Vector de RFC 4231, caso 2 (clave "Jefe" = 4a656665).
  it("coincide con el vector de prueba estándar", () => {
    expect(hmacHex("4a656665", "what do ya want for nothing?")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });

  it("compara firmas", () => {
    expect(safeEqualHex("abcd", "ABCD")).toBe(true);
    expect(safeEqualHex("abcd", "abce")).toBe(false);
    expect(safeEqualHex("abc", "abcd")).toBe(false);
    expect(safeEqualHex("zz", "zz")).toBe(false);
  });
});
