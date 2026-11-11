/** Geometría de un estanque de sección constante (paredes rectas). */
export interface TankGeometry {
  capacityL: number;
  /** Distancia sensor->agua con el estanque vacío. */
  emptyDistanceMm: number;
  /** Distancia sensor->agua con el estanque lleno. */
  fullDistanceMm: number;
}

/**
 * Convierte la distancia medida por el HC-SR04 en volumen estimado.
 * Lineal entre vacío y lleno, acotado a [0, capacidad]. Redondeado a 0,1 L:
 * la resolución real del sensor (~3 mm) no justifica más decimales.
 */
export function distanceToLevel(distanceMm: number, g: TankGeometry): { volumeL: number; percent: number } {
  const span = g.emptyDistanceMm - g.fullDistanceMm;
  const fraction = Math.min(1, Math.max(0, (g.emptyDistanceMm - distanceMm) / span));
  return {
    volumeL: Math.round(fraction * g.capacityL * 10) / 10,
    percent: Math.round(fraction * 100),
  };
}

/** Mediana para suavizar el oleaje y los ecos falsos del ultrasónico. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError("median de lista vacía");
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Tiempo de apertura para entregar `liters` con el caudal calibrado (estimación, sin caudalímetro). */
export function litersToOpenMs(liters: number, flowLps: number): number {
  return Math.round((liters / flowLps) * 1000);
}

/** Volumen estimado a partir del tiempo que estuvo abierta la válvula. */
export function openMsToLiters(openMs: number, flowLps: number): number {
  return Math.round((openMs / 1000) * flowLps * 10) / 10;
}
