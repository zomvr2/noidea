import type { Tank } from "@noidea/shared";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

export function TankCard({ tank }: { tank: Tank }) {
  const { level } = tank;
  const percent = level.percent ?? 0;
  const critical = level.backupCritical === true || (level.percent !== null && level.percent < tank.criticalPercent);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{tank.name}</Text>
      <View style={styles.bar}>
        <View
          style={[styles.fill, { width: `${percent}%`, backgroundColor: critical ? colors.danger : colors.water }]}
        />
      </View>
      {level.volumeL === null ? (
        <Text style={styles.muted}>Sin lecturas de nivel</Text>
      ) : (
        <Text style={styles.value}>
          ≈ {level.volumeL.toFixed(1)} L de {tank.capacityL} L ({percent}%) · estimado
        </Text>
      )}
      {critical && <Text style={styles.danger}>Nivel crítico</Text>}
      {level.sensorError && <Text style={styles.danger}>Error de sensor: {level.sensorError}</Text>}
      {level.measuredAt && (
        <Text style={styles.muted}>Actualizado {new Date(level.measuredAt).toLocaleTimeString()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 8 },
  title: { fontSize: 18, fontWeight: "600", color: colors.text },
  bar: { height: 16, borderRadius: 8, backgroundColor: colors.track, overflow: "hidden" },
  fill: { height: "100%" },
  value: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  danger: { fontSize: 14, fontWeight: "600", color: colors.danger },
});
