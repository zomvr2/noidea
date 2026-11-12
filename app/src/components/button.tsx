import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, Text, type ViewStyle } from "react-native";
import { colors, radius } from "@/theme";
import { Icon, type IconName } from "./icon";

type Variant = "primary" | "secondary" | "onPrimary" | "ghost";

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
  ghost: { bg: "transparent", pressed: colors.surfaceMuted, fg: colors.primary },
};

/** Botón de altura fija (52) con estados de carga, deshabilitado y presionado. */
export function Button({ label, onPress, variant = "primary", icon, loading, disabled, style, accessibilityHint }: Props) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? v.pressed : v.bg },
        disabled && !loading && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={v.fg} />}
          <Text style={[styles.label, { color: v.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: { fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.98 }] },
});
