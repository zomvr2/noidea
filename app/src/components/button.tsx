import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, Text, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { fadeIn, usePressScale } from "@/lib/motion";
import { colors, radius } from "@/theme";
import { Icon, type IconName } from "./icon";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = "primary" | "secondary" | "onPrimary" | "ghost" | "danger";

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const VARIANTS: Record<Variant, { bg: string; pressed: string; fg: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary },
  secondary: { bg: colors.surfaceMuted, pressed: colors.border, fg: colors.primary },
  // Botón dentro de una tarjeta verde (como «More details» de la referencia).
  onPrimary: { bg: colors.primaryRaised, pressed: "rgba(255,255,255,0.18)", fg: colors.onPrimary },
  ghost: { bg: "rgba(242,244,243,0)", pressed: colors.surfaceMuted, fg: colors.primary },
  // Acciones irreversibles (eliminar estanque).
  danger: { bg: colors.danger, pressed: "#A62B22", fg: colors.onPrimary },
};

/** Botón de altura fija (52) con estados de carga, deshabilitado y presionado (escala + color en el hilo de UI). */
export function Button({ label, onPress, variant = "primary", icon, loading, disabled, style, accessibilityHint }: Props) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  const { pressed, onPressIn, onPressOut, scaleStyle } = usePressScale(0.97);

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(pressed.value, [0, 1], [v.bg, v.pressed]),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        styles.base,
        bgStyle,
        scaleStyle,
        { opacity: disabled && !loading ? 0.4 : 1, transitionProperty: "opacity", transitionDuration: 180 },
        style,
      ]}
    >
      {loading ? (
        <Animated.View key="loading" entering={fadeIn}>
          <ActivityIndicator color={v.fg} />
        </Animated.View>
      ) : (
        <Animated.View key="label" entering={fadeIn} style={styles.content}>
          {icon && <Icon name={icon} size={18} color={v.fg} />}
          <Text style={[styles.label, { color: v.fg }]}>{label}</Text>
        </Animated.View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 16, fontWeight: "600" },
});
