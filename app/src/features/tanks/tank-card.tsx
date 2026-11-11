import type { Tank } from "@noidea/shared";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";
import { LEVEL_COLORS, LEVEL_LABELS, levelState, levelText } from "./tank-status";

export function TankCard({ tank }: { tank: Tank }) {
  const state = levelState(tank);
  const percent = Math.max(0, Math.min(100, tank.level.percent ?? 0));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{tank.name}</Text>
        {tank.simulated && <Text style={styles.sim}>SIMULADOR</Text>}
      </View>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: LEVEL_COLORS[state] }]} />
      </View>
      <Text style={styles.value}>{levelText(tank)}</Text>
      <Text style={[styles.state, { color: LEVEL_COLORS[state] }]}>{LEVEL_LABELS[state]}</Text>
      {tank.level.sensorError && <Text style={styles.muted}>Error de sensor: {tank.level.sensorError}</Text>}
      {tank.level.measuredAt && (
        <Text style={styles.muted}>Actualizado {new Date(tank.level.measuredAt).toLocaleTimeString()}</Text>
      )}
      {tank.location?.accuracyM != null && (
        <Text style={styles.muted}>Ubicación marcada con precisión ±{Math.round(tank.location.accuracyM)} m</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 6 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "600", color: colors.text },
  sim: { fontSize: 11, fontWeight: "700", color: "#fff", backgroundColor: colors.warning, paddingHorizontal: 6, borderRadius: 4 },
  bar: { height: 14, borderRadius: 7, backgroundColor: colors.track, overflow: "hidden" },
  fill: { height: "100%" },
  value: { fontSize: 15, color: colors.text },
  state: { fontSize: 14, fontWeight: "600" },
  muted: { fontSize: 13, color: colors.muted },
});
