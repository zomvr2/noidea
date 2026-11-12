import { DEVICE_OFFLINE_AFTER_MS, type Tank } from "@noidea/shared";
import type { IconName } from "@/components/icon";
import { colors } from "@/theme";

export type LevelState = "ok" | "low" | "critical" | "unknown" | "offline";

/** Estado visual de un estanque para el mapa y las tarjetas. */
export function levelState(t: Tank, now = Date.now()): LevelState {
  const lastSeen = t.deviceLastSeenAt ? Date.parse(t.deviceLastSeenAt) : 0;
  if (now - lastSeen > DEVICE_OFFLINE_AFTER_MS) return "offline";
  if (t.level.backupLow) return "critical";
  if (t.level.percent === null) return "unknown";
  if (t.level.percent < t.criticalPercent) return "critical";
  if (t.level.percent < t.criticalPercent * 2) return "low";
  return "ok";
}


export const LEVEL_COLORS: Record<LevelState, string> = {
  ok: colors.success,
  low: colors.warning,
  critical: colors.danger,
  unknown: colors.muted,
  offline: colors.offline,
};

export const LEVEL_LABELS: Record<LevelState, string> = {
  ok: "Disponible",
  low: "Nivel bajo",
  critical: "Nivel crítico",
  unknown: "Sin lectura",
  offline: "Sin conexión",
};

export const LEVEL_ICONS: Record<LevelState, IconName> = {
  ok: "check",
  low: "warning",
  critical: "error",
  unknown: "sensor",
  offline: "offline",
};

/** Orden de prioridad en listas: primero lo que necesita atención. */
export const LEVEL_PRIORITY: Record<LevelState, number> = { critical: 0, low: 1, offline: 2, unknown: 3, ok: 4 };

/** Litros con coma decimal, redondeados a 0,1 L (los volúmenes son estimados). */
export function formatLitres(l: number): string {
  const rounded = Math.round(l * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1).replace(".", ",")} L`;
}

/** Porcentaje honesto: "≈ 62%" o "—" si no hay lectura confiable. */
export function percentText(t: Tank, state: LevelState): string {
  if (t.level.percent === null || state === "offline") return "—";
  return `≈ ${Math.round(t.level.percent)}%`;
}

/** Texto de nivel honesto: siempre como estimación. */
export function levelText(t: Tank): string {
  if (t.level.volumeL === null || t.level.percent === null) return "Sin lectura de nivel";
  return `≈ ${formatLitres(t.level.volumeL)} de ${formatLitres(t.capacityL)} · estimado`;
}

/** "hace 2 min", "hace 3 h"… para marcas de tiempo de telemetría. */
export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "nunca";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return "hace un momento";
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} d`;
}

export type TankFilter = "all" | "alerts" | "offline";

export const TANK_FILTERS: readonly { value: TankFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "alerts", label: "Alertas" },
  { value: "offline", label: "Sin conexión" },
];

export function matchesFilter(t: Tank, filter: TankFilter, now: number): boolean {
  const state = levelState(t, now);
  if (filter === "alerts") return state === "low" || state === "critical";
  if (filter === "offline") return state === "offline" || state === "unknown";
  return true;
}

/** Primero lo que necesita atención; luego por nombre. */
export function sortByPriority(tanks: Tank[], now: number): Tank[] {
  return [...tanks].sort(
    (a, b) =>
      LEVEL_PRIORITY[levelState(a, now)] - LEVEL_PRIORITY[levelState(b, now)] || a.name.localeCompare(b.name, "es"),
  );
}
