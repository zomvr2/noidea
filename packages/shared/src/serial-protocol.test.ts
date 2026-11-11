import { describe, expect, it } from "vitest";
import { encodeHostCommand, parseDeviceLine, sanitizeLcdText } from "./serial-protocol";

describe("encodeHostCommand", () => {
  it("codifica comandos simples y con argumentos", () => {
    expect(encodeHostCommand({ cmd: "PING" })).toBe("PING\n");
    expect(encodeHostCommand({ cmd: "OPEN", id: 12, ms: 4000 })).toBe("OPEN 12 4000\n");
    expect(encodeHostCommand({ cmd: "STOP", id: 12 })).toBe("STOP 12\n");
  });

  it("rechaza tiempos de apertura fuera de rango", () => {
    expect(() => encodeHostCommand({ cmd: "OPEN", id: 1, ms: 0 })).toThrow(RangeError);
    expect(() => encodeHostCommand({ cmd: "OPEN", id: 1, ms: 60001 })).toThrow(RangeError);
  });

  it("limpia texto de LCD", () => {
    expect(sanitizeLcdText("Nivel crítico ñandú largo")).toBe("Nivel critico na");
    expect(encodeHostCommand({ cmd: "LCD", row: 1, text: "Saldo 12.5 L" })).toBe("LCD 1 Saldo 12.5 L\n");
  });
});

describe("parseDeviceLine", () => {
  it("interpreta BOOT y PONG", () => {
    expect(parseDeviceLine("BOOT fw=0.1.0 proto=1\r")).toEqual({ type: "BOOT", fw: "0.1.0", proto: 1 });
  });

  it("interpreta LVL con y sin error", () => {
    expect(parseDeviceLine("LVL d=345 b=610 low=0")).toEqual({
      type: "LVL",
      distanceMm: 345,
      error: null,
      backupRaw: 610,
      backupLow: false,
    });
    expect(parseDeviceLine("LVL err=NO_ECHO b=12 low=1")).toMatchObject({ distanceMm: null, error: "NO_ECHO", backupLow: true });
  });

  it("interpreta ACK, NAK, RUN y DONE", () => {
    expect(parseDeviceLine("ACK cmd=OPEN id=7")).toEqual({ type: "ACK", cmd: "OPEN", id: 7 });
    expect(parseDeviceLine("NAK cmd=OPEN id=7 r=BUSY")).toEqual({ type: "NAK", cmd: "OPEN", id: 7, reason: "BUSY" });
    expect(parseDeviceLine("RUN id=7 ms=1500")).toEqual({ type: "RUN", id: 7, elapsedMs: 1500 });
    expect(parseDeviceLine("DONE id=7 ms=4002 r=TARGET")).toEqual({
      type: "DONE",
      id: 7,
      openMs: 4002,
      reason: "TARGET",
    });
  });

  it("devuelve UNKNOWN ante basura sin lanzar", () => {
    expect(parseDeviceLine("DONE id=x")).toEqual({ type: "UNKNOWN", raw: "DONE id=x" });
    expect(parseDeviceLine("hola")).toMatchObject({ type: "UNKNOWN" });
  });
});
