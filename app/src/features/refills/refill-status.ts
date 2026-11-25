import type { RefillRequest, RefillStatus } from "@noidea/shared";
import { formatLitres } from "@/features/tanks/tank-status";

export type RefillTone = "neutral" | "primary" | "success";

export interface RefillChipInfo {
  label: string;
  tone: RefillTone;
  /** Punto pulsante: el municipal va en camino o está recargando. */
  live: boolean;
}

/** "≈ 1 min", "≈ 15 min", "≈ 1 h 10 min". La ETA es aproximada (línea recta, velocidad supuesta). */
export function formatEta(etaS: number): string {
  const min = Math.max(1, Math.round(etaS / 60));
  if (min < 60) return `≈ ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `≈ ${h} h ${m} min` : `≈ ${h} h`;
}

/** Texto del chip que ven los ciudadanos sobre un estanque con recarga (docs/recargas.md). */
export function refillChip(r: RefillRequest): RefillChipInfo | null {
  switch (r.status) {
    case "requested":
      return { label: "Recarga solicitada", tone: "neutral", live: false };
    case "scheduled":
      return {
        label: r.assignedName ? `Municipal asignado · ${r.assignedName}` : "Municipal asignado",
        tone: "primary",
        live: false,
      };
    case "in_transit":
      if (r.arrivedAt) return { label: "Municipal recargando", tone: "primary", live: true };
      return {
        label: r.etaS !== null ? `Municipal en camino · ${formatEta(r.etaS)}` : "Municipal en camino",
        tone: "primary",
        live: true,
      };
    case "delivered":
      return {
        label: r.deliveredEstimatedL !== null ? `Recargado · ≈ ${formatLitres(r.deliveredEstimatedL)}` : "Recargado",
        tone: "success",
        live: false,
      };
    case "cancelled":
      return null;
  }
}

export const REFILL_STATUS_LABELS: Record<RefillStatus, string> = {
  requested: "Sin asignar",
  scheduled: "Asignada",
  in_transit: "En camino",
  delivered: "Entregada",
  cancelled: "Cancelada",
};

/** "≈ 6 h para vaciarse" o null si no hay consumo medible. */
export function hoursToEmptyText(hours: number | null): string | null {
  if (hours === null) return null;
  if (hours < 1) return "≈ < 1 h para vaciarse";
  if (hours < 48) return `≈ ${Math.round(hours)} h para vaciarse`;
  return `≈ ${Math.round(hours / 24)} días para vaciarse`;
}
