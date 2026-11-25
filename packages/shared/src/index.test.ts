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

describe("recargas", () => {
  it("distancia y ETA aproximada", async () => {
    const { distanceM, refillEtaSeconds } = await import("./index");
    // ~1,11 km por 0,01° de latitud.
    const d = distanceM({ latitude: -33.0, longitude: -70.0 }, { latitude: -33.01, longitude: -70.0 });
    expect(Math.round(d)).toBeGreaterThan(1100);
    expect(Math.round(d)).toBeLessThan(1120);
    // 1 km × 1,3 a 30 km/h = 156 s.
    expect(refillEtaSeconds(1000)).toBe(156);
  });

  it("horas hasta vaciarse según la caída de nivel", async () => {
    const { estimateHoursToEmpty } = await import("./index");
    expect(
      estimateHoursToEmpty([
        { volumeL: 4, at: "2026-11-11T12:00:00Z" },
        { volumeL: 6, at: "2026-11-11T10:00:00Z" },
        { volumeL: null, at: "2026-11-11T11:00:00Z" },
      ]),
    ).toBe(4);
    expect(estimateHoursToEmpty([{ volumeL: 4, at: "2026-11-11T12:00:00Z" }])).toBeNull();
    expect(
      estimateHoursToEmpty([
        { volumeL: 4, at: "2026-11-11T10:00:00Z" },
        { volumeL: 5, at: "2026-11-11T12:00:00Z" },
      ]),
    ).toBeNull();
  });

  it("prioriza lo que se vacía antes", async () => {
    const { refillPriority } = await import("./index");
    const soon = refillPriority({ hoursToEmpty: 2, percent: 20, families: 3 });
    const later = refillPriority({ hoursToEmpty: 20, percent: 20, families: 3 });
    expect(soon).toBeGreaterThan(later);
  });

  it("nombre corto del municipal", async () => {
    const { shortDisplayName } = await import("./index");
    expect(shortDisplayName("Juan pérez Soto")).toBe("Juan P.");
    expect(shortDisplayName("Ana")).toBe("Ana");
    expect(shortDisplayName("  ")).toBe("Municipal");
  });

  it("mapea filas con numeric como string y posición", async () => {
    const { toRefill } = await import("./index");
    const r = toRefill({
      id: 1, tank_id: 2, status: "in_transit", source: "auto", requested_volume_l: "3.5", notes: null,
      assigned_to: "u", assigned_name: "Juan P.", accepted_at: null, departed_at: null, arrived_at: null,
      delivered_at: null, level_before_l: null, level_after_l: null, delivered_estimated_l: "1.2",
      measurement_method: null, last_latitude: -33, last_longitude: -70, last_position_at: "t", eta_s: 60,
      created_at: "c", updated_at: "u",
    });
    expect(r).toMatchObject({ requestedVolumeL: 3.5, deliveredEstimatedL: 1.2, position: { latitude: -33 }, etaS: 60 });
  });
});
