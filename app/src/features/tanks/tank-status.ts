import { DEVICE_OFFLINE_AFTER_MS, type Tank } from "@noidea/shared";
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
  ok: colors.water,
  low: colors.warning,
  critical: colors.danger,
  unknown: colors.muted,
  offline: "#8A97A5",
};

export const LEVEL_LABELS: Record<LevelState, string> = {
  ok: "Disponible",
  low: "Nivel bajo",
  critical: "Nivel crítico",
  unknown: "Sin lectura",
  offline: "Dispensador sin conexión",
};

/** Texto de nivel honesto: siempre como estimación. */
export function levelText(t: Tank): string {
  if (t.level.volumeL === null || t.level.percent === null) return "Sin lectura de nivel";
  return `≈ ${t.level.volumeL.toFixed(1)} L de ${t.capacityL} L (${Math.round(t.level.percent)}%) · estimado`;
}
