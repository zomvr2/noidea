import { StyleSheet, View } from "react-native";
import { colors } from "@/theme";

interface Props {
  /** 0-100, o null si no hay lectura. */
  percent: number | null;
  color?: string;
  trackColor?: string;
  segments?: number;
  height?: number;
}

/**
 * Barra de nivel segmentada (pastillas), como la barra de progreso de la referencia.
 * La segmentación además comunica que el valor es aproximado.
 */
export function LevelBar({
  percent,
  color = colors.accent,
  trackColor = colors.accentTrack,
  segments = 20,
  height = 10,
}: Props) {
  const filled = percent === null ? 0 : Math.round((Math.max(0, Math.min(100, percent)) / 100) * segments);
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={percent === null ? undefined : { min: 0, max: 100, now: Math.round(percent) }}
    >
      {Array.from({ length: segments }, (_, i) => (
        <View
          key={i}
          style={[styles.segment, { height, borderRadius: height / 2, backgroundColor: i < filled ? color : trackColor }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 3 },
  segment: { flex: 1 },
});
