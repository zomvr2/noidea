import type { Tank } from "@noidea/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SimulatorBadge } from "@/components/banner";
import { Icon } from "@/components/icon";
import { LevelBar } from "@/components/level-bar";
import { colors, radius } from "@/theme";
import { formatLitres, LEVEL_COLORS, LEVEL_LABELS, levelState, percentText, timeAgo } from "./tank-status";

/** Tarjeta clara de un estanque (como las tarjetas «Completed» de la referencia). */
export function TankRow({ tank, now, onPress }: { tank: Tank; now: number; onPress: () => void }) {
  const state = levelState(tank, now);
  const hasLevel = tank.level.volumeL !== null && state !== "offline";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tank.name}. ${LEVEL_LABELS[state]}. ${percentText(tank, state)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.overline, { color: LEVEL_COLORS[state] }]}>
            {LEVEL_LABELS[state]} · {timeAgo(tank.level.measuredAt ?? tank.deviceLastSeenAt, now)}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {tank.name}
          </Text>
        </View>
        {tank.simulated && <SimulatorBadge />}
        <Icon name="chevronRight" size={16} color={colors.subtle} />
      </View>
      <View style={styles.stats}>
        <Text style={styles.value}>{hasLevel ? `≈ ${formatLitres(tank.level.volumeL!)}` : "Sin lectura"}</Text>
        <Text style={styles.capacity}>de {formatLitres(tank.capacityL)}</Text>
      </View>
      <LevelBar
        percent={hasLevel ? tank.level.percent : null}
        color={state === "ok" ? colors.primary : LEVEL_COLORS[state]}
        trackColor={colors.track}
        height={8}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: 16, gap: 10 },
  pressed: { opacity: 0.85 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerText: { flex: 1, gap: 2 },
  overline: { fontSize: 12, fontWeight: "600" },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  stats: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  value: { fontSize: 18, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  capacity: { fontSize: 13, color: colors.muted },
});
