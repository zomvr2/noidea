import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { colors } from "@/theme";

interface Props {
  /** 0-100, o null si no hay lectura. */
  percent: number | null;
  color?: string;
  trackColor?: string;
  segments?: number;
  height?: number;
}

/** Retraso entre pastillas al llenarse/vaciarse: produce una «ola» corta. */
const SEGMENT_STEP_MS = 22;

/**
 * Barra de nivel segmentada (pastillas). La segmentación además comunica que el valor es aproximado.
 * Al montar se llena con una ola y, cuando llega una lectura nueva, solo cambian las pastillas
 * afectadas (transiciones CSS de Reanimated en el hilo de UI; sin re-render por fotograma).
 */
export function LevelBar({
  percent,
  color = colors.accent,
  trackColor = colors.accentTrack,
  segments = 20,
  height = 10,
}: Props) {
  const target = percent === null ? 0 : Math.round((Math.max(0, Math.min(100, percent)) / 100) * segments);

  // Arranca vacía y pasa al valor real tras el primer fotograma para que se vea el llenado.
  const [{ filled, prev }, setFill] = useState({ filled: 0, prev: 0 });
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setFill((s) => (s.filled === target ? s : { filled: target, prev: s.filled })),
    );
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={percent === null ? undefined : { min: 0, max: 100, now: Math.round(percent) }}
    >
      {Array.from({ length: segments }, (_, i) => {
        const on = i < filled;
        // Llenando: de izquierda a derecha desde el valor anterior. Vaciando: de derecha a izquierda.
        const order = filled >= prev ? i - prev : prev - 1 - i;
        return (
          <View key={i} style={[styles.segment, { height, borderRadius: height / 2, backgroundColor: trackColor }]}>
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: height / 2,
                  backgroundColor: color,
                  opacity: on ? 1 : 0,
                  transform: [{ scaleY: on ? 1 : 0.4 }],
                  transitionProperty: ["opacity", "transform", "backgroundColor"],
                  transitionDuration: 260,
                  transitionDelay: Math.max(0, order) * SEGMENT_STEP_MS,
                  transitionTimingFunction: "ease-out",
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 3 },
  segment: { flex: 1, overflow: "hidden" },
});
