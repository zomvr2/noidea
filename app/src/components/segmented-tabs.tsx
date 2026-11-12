import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

interface Props<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Pestañas de texto subrayadas (estilo «Trips / Competitions» de la referencia). */
export function SegmentedTabs<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && styles.active]}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
  active: { borderBottomColor: colors.primary },
  label: { fontSize: 15, fontWeight: "500", color: colors.muted },
  activeLabel: { color: colors.primary, fontWeight: "600" },
});
