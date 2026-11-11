import { describe, expect, it } from "vitest";
import { distanceToLevel, litersToOpenMs, median, openMsToLiters } from "./level-math";

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

describe("median", () => {
  it("ignora valores atípicos", () => {
    expect(median([200, 201, 900, 199, 202])).toBe(201);
    expect(median([1, 3])).toBe(2);
  });
});

describe("conversión tiempo <-> litros", () => {
  it("es consistente", () => {
    expect(litersToOpenMs(0.5, 0.05)).toBe(10000);
    expect(openMsToLiters(10000, 0.05)).toBe(0.5);
  });
});
