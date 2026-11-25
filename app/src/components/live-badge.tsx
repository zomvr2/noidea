import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { duration } from "@/lib/motion";
import { colors, radius } from "@/theme";

/** Punto que emite una onda suave en bucle. Se detiene si `active` es false o el sistema pide reducir movimiento. */
export function PulseDot({ color, size = 8, active = true }: { color: string; size?: number; active?: boolean }) {
  const reduceMotion = useReducedMotion();
  const wave = useSharedValue(0);
  const run = active && !reduceMotion;

  useEffect(() => {
    if (run) wave.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1));
    else {
      cancelAnimation(wave);
      wave.set(0);
    }
    return () => cancelAnimation(wave);
  }, [run, wave]);

  const ring = useAnimatedStyle(() => ({
    opacity: run ? 0.5 * (1 - wave.value) : 0,
    transform: [{ scale: 1 + wave.value * 1.6 }],
  }));

  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={box}>
      <Animated.View style={[StyleSheet.absoluteFill, box, { backgroundColor: color }, ring]} />
      <View style={[box, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * Indicador de conexión en tiempo real: «En vivo» con pulso cuando el canal Realtime está suscrito,
 * «Reconectando» gris y quieto cuando no.
 */
export function LiveBadge({ connected }: { connected: boolean }) {
  const color = connected ? colors.success : colors.offline;
  return (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: connected ? colors.primarySoft : colors.surfaceMuted,
          transitionProperty: "backgroundColor",
          transitionDuration: duration.slow,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={connected ? "Datos en vivo" : "Reconectando con el servidor"}
    >
      <PulseDot color={color} active={connected} />
      <Text style={[styles.text, { color: connected ? colors.primary : colors.muted }]}>
        {connected ? "En vivo" : "Reconectando"}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  text: { fontSize: 12, fontWeight: "600" },
});
