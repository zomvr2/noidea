import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";
import { Icon, type IconName } from "./icon";

interface TabMeta {
  label: string;
  icon: IconName;
}

interface Props extends BottomTabBarProps {
  tabs: Record<string, TabMeta>;
  /** Acción central «+» (solo si existe; p. ej. admins ubicando estanques). */
  centerAction?: { label: string; onPress: () => void };
}

/**
 * Barra inferior: iconos con etiqueta y un botón central circular «+» como en la referencia.
 * El botón central es una acción, no una pestaña.
 */
export function TabBar({ state, navigateToTab, insets, tabs, centerAction }: Props) {
  const routes = state.routes.filter((r) => tabs[r.name]);
  const mid = Math.ceil(routes.length / 2);

  const renderTab = (route: (typeof routes)[number]) => {
    const meta = tabs[route.name]!;
    const focused = state.routes[state.index]?.key === route.key;
    const color = focused ? colors.primary : colors.subtle;
    return (
      <Pressable
        key={route.key}
        onPress={() => !focused && navigateToTab(route.key)}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        style={styles.tab}
      >
        <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
          <Icon name={meta.icon} size={22} color={color} />
        </View>
        <Text style={[styles.label, { color }, focused && styles.labelActive]}>{meta.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist">
      {routes.slice(0, mid).map(renderTab)}
      {centerAction && (
        <View style={styles.tab}>
          <Pressable
            onPress={centerAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={centerAction.label}
            style={({ pressed }) => [styles.center, pressed && styles.centerPressed]}
          >
            <Icon name="add" size={24} color={colors.primary} />
          </Pressable>
        </View>
      )}
      {routes.slice(mid).map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: "center", gap: 2, minHeight: 48, justifyContent: "center" },
  iconWrap: { width: 52, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  iconWrapActive: { backgroundColor: colors.primarySoft },
  label: { fontSize: 11, fontWeight: "500" },
  labelActive: { fontWeight: "700" },
  center: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  centerPressed: { backgroundColor: colors.border, transform: [{ scale: 0.95 }] },
});
