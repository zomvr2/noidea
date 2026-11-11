/** Geometría de un estanque de sección constante (paredes rectas). */
export interface TankGeometry {
  capacityL: number;
  /** Distancia sensor->agua con el estanque vacío. */
  emptyDistanceMm: number;
  /** Distancia sensor->agua con el estanque lleno. */
  fullDistanceMm: number;
}

/**
 * Convierte la distancia del HC-SR04 en volumen estimado. Lineal entre vacío y lleno,
 * acotado a [0, capacidad] y redondeado a 0,1 L (la resolución del sensor no da para más).
 */
export function distanceToLevel(distanceMm: number, g: TankGeometry): { volumeL: number; percent: number } {
  const span = g.emptyDistanceMm - g.fullDistanceMm;
  const fraction = Math.min(1, Math.max(0, (g.emptyDistanceMm - distanceMm) / span));
  return {
    volumeL: Math.round(fraction * g.capacityL * 10) / 10,
    percent: Math.round(fraction * 1000) / 10,
  };
}

/** Volumen estimado a partir del tiempo que estuvo abierta la válvula (sin caudalímetro). */
export function openMsToLiters(openMs: number, flowLps: number): number {
  return Math.round((openMs / 1000) * flowLps * 10) / 10;
}
