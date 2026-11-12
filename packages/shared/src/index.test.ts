import { describe, expect, it } from "vitest";
import { commandSigningString, deviceTopic, normalizeTagUid, requestSigningString, sanitizeLcdText, toQuotaBalance } from "./index";

describe("commandSigningString", () => {
  it("es estable para cada orden (debe coincidir con el firmware)", () => {
    expect(commandSigningString({ cmd: "OPEN", id: 17, ms: 4000, ts: 1700000000 })).toBe("OPEN|17|4000|1700000000");
    expect(commandSigningString({ cmd: "STOP", id: 17, ts: 1700000001 })).toBe("STOP|17|1700000001");
    expect(commandSigningString({ cmd: "LCD", row: 1, text: "Hola", ts: 5 })).toBe("LCD|1|Hola|5");
  });

  it("firma de peticiones", () => {
    expect(requestSigningString(10, '{"a":1}')).toBe('10\n{"a":1}');
  });
});

describe("utilidades", () => {
  it("limpia texto de LCD sin dejar el separador de firma", () => {
    expect(sanitizeLcdText("Nivel crítico | ñandú largo")).toBe("Nivel critico / ");
  });

  it("normaliza UID NFC", () => {
    expect(normalizeTagUid("04:a2:1b:ff")).toBe("04A21BFF");
  });

  it("nombra el canal del dispositivo", () => {
    expect(deviceTopic("abc")).toBe("device:abc");
  });
});

describe("toQuotaBalance", () => {
  it("normaliza numeric como string y calcula el disponible", () => {
    const q = toQuotaBalance({
      family_id: 1,
      period_start: "2026-11-01T00:00:00Z",
      period_end: "2026-12-01T00:00:00Z",
      allocated_l: "100.00",
      used_l: "30.5",
      reserved_l: 10,
    });
    expect(q).toMatchObject({ allocatedL: 100, usedL: 30.5, reservedL: 10, availableL: 59.5 });
  });

  it("nunca entrega un disponible negativo", () => {
    const q = toQuotaBalance({
      family_id: 1,
      period_start: "2026-11-01T00:00:00Z",
      period_end: "2026-12-01T00:00:00Z",
      allocated_l: 20,
      used_l: 25,
      reserved_l: 0,
    });
    expect(q.availableL).toBe(0);
  });
});
