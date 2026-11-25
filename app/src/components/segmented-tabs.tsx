import { useState } from "react";
import { type LayoutRectangle, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { duration, springs } from "@/lib/motion";
import { colors } from "@/theme";

interface Props<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Pestañas de texto subrayadas; el subrayado se desliza con un resorte hasta la pestaña activa. */
export function SegmentedTabs<T extends string>({ options, value, onChange }: Props<T>) {
  const [layouts, setLayouts] = useState<Partial<Record<T, LayoutRectangle>>>({});
  const active = layouts[value];

  const indicator = useAnimatedStyle(() => {
    if (!active) return { opacity: 0 };
    return {
      opacity: 1,
      width: withSpring(active.width, springs.gentle),
      transform: [{ translateX: withSpring(active.x, springs.gentle) }],
    };
  });

  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            onLayout={(e) => {
              const l = e.nativeEvent.layout;
              setLayouts((prev) => (prev[o.value]?.x === l.x && prev[o.value]?.width === l.width ? prev : { ...prev, [o.value]: l }));
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.tab}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <Animated.Text
              style={[
                styles.label,
                {
                  color: selected ? colors.primary : colors.muted,
                  transitionProperty: "color",
                  transitionDuration: duration.base,
                },
              ]}
            >
              {o.label}
            </Animated.Text>
          </Pressable>
        );
      })}
      <Animated.View style={[styles.indicator, indicator]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { paddingBottom: 10 },
  // Peso fijo: si cambiara al activar, el ancho del texto saltaría y el subrayado no calzaría.
  label: { fontSize: 15, fontWeight: "600" },
  indicator: {
    position: "absolute",
    left: 0,
    bottom: -1,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
});
