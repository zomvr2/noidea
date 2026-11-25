import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { type ReactNode, useEffect } from "react";
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { springs, usePressScale } from "@/lib/motion";
import { colors } from "@/theme";
import { Icon, type IconName } from "./icon";

interface TabMeta {
  label: string;
  icon: IconName;
}

interface Props extends BottomTabBarProps {
  tabs: Record<string, TabMeta>;
  /** Acción flotante «+» junto a la barra (solo si existe; p. ej. admins ubicando estanques). */
  centerAction?: { label: string; icon?: IconName; onPress: () => void };
}

/** Alto de la píldora flotante. */
export const TAB_BAR_HEIGHT = 60;
const BAR_GAP = 8;

function barBottom(insetBottom: number) {
  return Math.max(insetBottom, 12);
}

/**
 * Espacio que debe dejar libre el contenido al fondo de una pantalla con pestañas,
 * porque la barra flota encima (no ocupa espacio en el layout).
 */
export function useTabBarClearance() {
  const insets = useSafeAreaInsets();
  return barBottom(insets.bottom) + TAB_BAR_HEIGHT + 12;
}

const liquidGlass = isLiquidGlassAvailable();
const spring = LinearTransition.springify().damping(18).stiffness(220);

/** Superficie de vidrio: Liquid Glass nativo en iOS 26+; translúcido con borde en el resto. */
function Glass({ style, children }: { style: ViewStyle; children: ReactNode }) {
  if (liquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive style={style}>
        {children}
      </GlassView>
    );
  }
  return <View style={[style, styles.fallbackGlass]}>{children}</View>;
}

/**
 * Barra inferior flotante tipo píldora de vidrio: la pestaña activa crece y muestra su
 * etiqueta; las demás solo el icono. La acción «+» es un botón circular aparte.
 */
export function TabBar({ state, navigateToTab, insets, tabs, centerAction }: Props) {
  const routes = state.routes.filter((r) => tabs[r.name]);

  return (
    <View
      style={[styles.wrap, { bottom: barBottom(insets.bottom) }]}
      pointerEvents="box-none"
    >
      <Glass style={styles.pill}>
        <View style={styles.row} accessibilityRole="tablist">
          {routes.map((route) => {
            const meta = tabs[route.name]!;
            const focused = state.routes[state.index]?.key === route.key;
            return (
              <Animated.View key={route.key} layout={spring} style={focused ? styles.slotActive : styles.slot}>
                <TabButton meta={meta} focused={focused} onPress={() => !focused && navigateToTab(route.key)} />
              </Animated.View>
            );
          })}
        </View>
      </Glass>

      {centerAction && <CenterAction {...centerAction} />}
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pestaña: escala al tocar y el icono da un pequeño salto al activarse. */
function TabButton({ meta, focused, onPress }: { meta: TabMeta; focused: boolean; onPress: () => void }) {
  const { onPressIn, onPressOut, scaleStyle } = usePressScale(0.92);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (focused) pop.set(withSequence(withTiming(1.18, { duration: 110 }), withSpring(1, springs.press)));
  }, [focused, pop]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
      style={[
        styles.tab,
        {
          backgroundColor: focused ? "rgba(11,74,43,0.10)" : "rgba(11,74,43,0)",
          transitionProperty: "backgroundColor",
          transitionDuration: 200,
        },
        scaleStyle,
      ]}
    >
      <Animated.View style={iconStyle}>
        <Icon name={meta.icon} size={22} color={focused ? colors.primary : colors.text} />
      </Animated.View>
      {focused && (
        <Animated.Text
          entering={FadeIn.duration(180).delay(60)}
          exiting={FadeOut.duration(80)}
          numberOfLines={1}
          style={styles.label}
        >
          {meta.label}
        </Animated.Text>
      )}
    </AnimatedPressable>
  );
}

/** Botón circular «+»: escala con resorte al tocar. */
function CenterAction({ label, icon = "add", onPress }: { label: string; icon?: IconName; onPress: () => void }) {
  const { onPressIn, onPressOut, scaleStyle } = usePressScale(0.9);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      entering={FadeIn.duration(200)}
      style={scaleStyle}
    >
      <Glass style={styles.action}>
        <Icon name={icon} size={26} color={colors.primary} />
      </Glass>
    </AnimatedPressable>
  );
}

const shadow: ViewStyle = Platform.select({
  ios: { shadowColor: "#0B1A12", shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  default: { elevation: 8 },
});

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: BAR_GAP,
  },
  pill: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    padding: 6,
    ...shadow,
  },
  fallbackGlass: {
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.9)",
    // Brillo sutil del borde superior, como el canto del vidrio.
    borderTopColor: "#FFFFFF",
  },
  row: { flex: 1, flexDirection: "row", alignItems: "stretch" },
  slot: { flex: 1 },
  slotActive: { flex: 2 },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: (TAB_BAR_HEIGHT - 12) / 2,
    paddingHorizontal: 10,
  },
  label: { fontSize: 15, fontWeight: "600", color: colors.primary, letterSpacing: -0.2 },
  action: {
    width: TAB_BAR_HEIGHT,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
});
