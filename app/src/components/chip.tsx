import { Pressable, StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { duration, fadeIn, usePressScale } from "@/lib/motion";
import { colors, radius } from "@/theme";
import { Icon, type IconName } from "./icon";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  label: string;
  selected?: boolean;
  icon?: IconName;
  count?: number;
  onPress?: () => void;
}

/** Píldora de filtro (selección única). El fondo y el borde cambian con transición; el toque escala. */
export function Chip({ label, selected, icon, count, onPress }: Props) {
  const fg = selected ? colors.primary : colors.text;
  const { onPressIn, onPressOut, scaleStyle } = usePressScale(0.94);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primarySoft : colors.border,
          transitionProperty: ["backgroundColor", "borderColor"],
          transitionDuration: duration.base,
        },
        scaleStyle,
      ]}
    >
      {icon && <Icon name={icon} size={15} color={fg} />}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
      {count !== undefined && count > 0 && (
        // `key` con el número: al cambiar el conteo, el nuevo valor entra con un fundido.
        <Animated.Text key={count} entering={fadeIn} style={[styles.count, { color: fg }]}>
          {count}
        </Animated.Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { fontSize: 14, fontWeight: "500" },
  count: { fontSize: 13, fontWeight: "700" },
});
