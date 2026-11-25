import type { Tank } from "@noidea/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { SimulatorBadge } from "@/components/banner";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { LevelBar } from "@/components/level-bar";
import { RefillChip } from "@/features/refills/refill-chip";
import { useTankRefill } from "@/features/refills/use-refills";
import { useUpdatePulse } from "@/lib/motion";
import { colors, radius } from "@/theme";
import { formatLitres, LEVEL_ICONS, LEVEL_LABELS, type LevelState, levelState, percentText, timeAgo } from "./tank-status";

/** Colores de estado legibles sobre la tarjeta verde oscuro. */
const ON_DARK: Record<LevelState, string> = {
  ok: colors.accent,
  low: "#FFC966",
  critical: "#FF8F80",
  unknown: "rgba(255,255,255,0.6)",
  offline: "rgba(255,255,255,0.6)",
};

interface Props {
  tank: Tank;
  now: number;
  onDetails?: () => void;
  onClose?: () => void;
}

/** Tarjeta destacada de un estanque (verde profundo, como las tarjetas de la referencia). */
export function TankCard({ tank, now, onDetails, onClose }: Props) {
  const state = levelState(tank, now);
  const tone = ON_DARK[state];
  const hasLevel = tank.level.volumeL !== null && state !== "offline";
  const volume = hasLevel ? `≈ ${formatLitres(tank.level.volumeL!)}` : "—";
  const pulse = useUpdatePulse(volume);
  const refill = useTankRefill(tank.id);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <View style={styles.statusRow}>
            <Icon name={LEVEL_ICONS[state]} size={13} color={tone} />
            <Text style={[styles.overline, { color: tone }]}>
              {LEVEL_LABELS[state]} · {timeAgo(tank.level.measuredAt ?? tank.deviceLastSeenAt, now)}
            </Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {tank.name}
          </Text>
        </View>
        {tank.simulated && <SimulatorBadge onDark />}
        {onClose && (
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            style={styles.close}
          >
            <Icon name="close" size={16} color={colors.onPrimary} />
          </Pressable>
        )}
      </View>

      <RefillChip refill={refill} onDark />

      <View style={styles.stats}>
        <View>
          <Text style={styles.statLabel}>Nivel estimado</Text>
          <Animated.Text style={[styles.statValue, pulse]}>{volume}</Animated.Text>
        </View>
        <View style={styles.statRight}>
          <Text style={styles.statLabel}>Capacidad</Text>
          <Text style={styles.statValue}>{formatLitres(tank.capacityL)}</Text>
        </View>
      </View>

      <LevelBar
        percent={hasLevel ? tank.level.percent : null}
        color={state === "ok" ? colors.accent : tone}
        trackColor="rgba(255,255,255,0.14)"
      />
      <Text style={styles.footnote}>
        {hasLevel ? `${percentText(tank, state)} · estimado por sensor ultrasónico` : "Sin lectura confiable del nivel"}
      </Text>

      {onDetails && <Button label="Ver detalle" variant="onPrimary" onPress={onDetails} style={styles.button} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 16, gap: 10 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  headerText: { flex: 1, gap: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  overline: { fontSize: 12, fontWeight: "600" },
  title: { fontSize: 20, fontWeight: "700", color: colors.onPrimary, letterSpacing: -0.2 },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  statRight: { alignItems: "flex-end" },
  statLabel: { fontSize: 12, color: colors.onPrimaryMuted },
  statValue: { alignSelf: "flex-start", fontSize: 22, fontWeight: "700", color: colors.onPrimary, fontVariant: ["tabular-nums"] },
  footnote: { fontSize: 12, color: colors.onPrimaryMuted },
  button: { marginTop: 4, minHeight: 46 },
});
