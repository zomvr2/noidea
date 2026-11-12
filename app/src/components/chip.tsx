import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius } from "@/theme";
import { Icon, type IconName } from "./icon";

interface Props {
  label: string;
  selected?: boolean;
  icon?: IconName;
  count?: number;
  onPress?: () => void;
}

/** Píldora de filtro (selección única), como los filtros sobre el mapa de la referencia. */
export function Chip({ label, selected, icon, count, onPress }: Props) {
  const fg = selected ? colors.primary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      {icon && <Icon name={icon} size={15} color={fg} />}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
      {count !== undefined && count > 0 && <Text style={[styles.count, { color: fg }]}>{count}</Text>}
    </Pressable>
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  pressed: { opacity: 0.7 },
  label: { fontSize: 14, fontWeight: "500" },
  count: { fontSize: 13, fontWeight: "700" },
});
