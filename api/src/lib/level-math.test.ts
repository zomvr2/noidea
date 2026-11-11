import { describe, expect, it } from "vitest";
import { distanceToLevel, openMsToLiters } from "./level-math.js";

const g = { capacityL: 8, emptyDistanceMm: 250, fullDistanceMm: 60 };

describe("distanceToLevel", () => {
  it("vacío, lleno y mitad", () => {
    expect(distanceToLevel(250, g)).toEqual({ volumeL: 0, percent: 0 });
    expect(distanceToLevel(60, g)).toEqual({ volumeL: 8, percent: 100 });
    expect(distanceToLevel(155, g)).toEqual({ volumeL: 4, percent: 50 });
  });

  it("acota lecturas fuera de rango", () => {
    expect(distanceToLevel(400, g).volumeL).toBe(0);
    expect(distanceToLevel(20, g).volumeL).toBe(8);
  });
});

describe("openMsToLiters", () => {
  it("estima litros por tiempo", () => {
    expect(openMsToLiters(10_000, 0.05)).toBe(0.5);
    expect(openMsToLiters(4_321, 0.05)).toBe(0.2);
  });
});
