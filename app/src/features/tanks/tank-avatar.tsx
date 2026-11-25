import type { Tank } from "@noidea/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Icon } from "@/components/icon";
import { PulseDot } from "@/components/live-badge";
import { duration, usePressScale, useUpdatePulse } from "@/lib/motion";
import { colors, radius } from "@/theme";
import { LEVEL_COLORS, levelState, percentText } from "./tank-status";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  tank: Tank;
  now: number;
  selected?: boolean;
  onPress: () => void;
}

/** Píldora compacta de un estanque (fila inferior del mapa): icono de estado, nombre y nivel. */
export function TankAvatar({ tank, now, selected, onPress }: Props) {
  const state = levelState(tank, now);
  const color = LEVEL_COLORS[state];
  const pct = percentText(tank, state);
  const { onPressIn, onPressOut, scaleStyle } = usePressScale(0.95);
  const pulse = useUpdatePulse(pct);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={`${tank.name}, ${pct}`}
      style={[
        styles.pill,
        {
          borderColor: selected ? colors.primary : colors.border,
          transitionProperty: "borderColor",
          transitionDuration: duration.base,
        },
        scaleStyle,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: `${color}22` }]}>
        <Icon name="tankFilled" size={16} color={color} />
        {/* Solo el estado crítico late: es lo único que pide atención inmediata. */}
        <View style={styles.status}>
          <PulseDot color={color} size={7} active={state === "critical"} />
        </View>
      </View>
      <View>
        <Text style={styles.name} numberOfLines={1}>
          {tank.name}
        </Text>
        <Animated.Text style={[styles.level, pulse]}>{pct}</Animated.Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 6,
    paddingRight: 14,
    height: 52,
    maxWidth: 220,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
  },
  dot: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  status: {
    position: "absolute",
    right: 0,
    bottom: 0,
    padding: 2,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  name: { fontSize: 14, fontWeight: "600", color: colors.text, maxWidth: 150 },
  level: { alignSelf: "flex-start", fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
});
