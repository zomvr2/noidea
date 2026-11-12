import type { Tank } from "@noidea/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { colors, radius } from "@/theme";
import { LEVEL_COLORS, levelState, percentText } from "./tank-status";

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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={`${tank.name}, ${percentText(tank, state)}`}
      style={({ pressed }) => [styles.pill, selected && styles.selected, pressed && styles.pressed]}
    >
      <View style={[styles.dot, { backgroundColor: `${color}22` }]}>
        <Icon name="tankFilled" size={16} color={color} />
        <View style={[styles.status, { backgroundColor: color }]} />
      </View>
      <View>
        <Text style={styles.name} numberOfLines={1}>
          {tank.name}
        </Text>
        <Text style={styles.level}>{percentText(tank, state)}</Text>
      </View>
    </Pressable>
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
    borderColor: colors.border,
  },
  selected: { borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  dot: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  status: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  name: { fontSize: 14, fontWeight: "600", color: colors.text, maxWidth: 150 },
  level: { fontSize: 12, color: colors.muted, fontVariant: ["tabular-nums"] },
});
