import { type ComponentRef, type Ref, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import Animated from "react-native-reanimated";
import { duration } from "@/lib/motion";
import { colors, radius } from "@/theme";
import { Icon, type IconName } from "./icon";

interface Props extends Omit<TextInputProps, "style"> {
  label: string;
  icon?: IconName;
  error?: boolean;
  /** Muestra el botón ver/ocultar y gestiona `secureTextEntry`. */
  password?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** Campo con etiqueta visible, icono y estado de foco. */
export function TextField({ label, icon, error, password, onFocus, onBlur, ref, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View
        style={[
          styles.field,
          {
            borderColor,
            backgroundColor: focused ? colors.surface : colors.surfaceMuted,
            transitionProperty: ["borderColor", "backgroundColor"],
            transitionDuration: duration.base,
          },
        ]}
      >
        {icon && <Icon name={icon} size={18} color={focused ? colors.primary : colors.subtle} />}
        <TextInput
          ref={ref}
          {...input}
          accessibilityLabel={label}
          secureTextEntry={password ? !visible : input.secureTextEntry}
          placeholderTextColor={colors.subtle}
          // Colores explícitos: con el teléfono en modo oscuro Android usa texto claro por defecto.
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {password && (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={visible ? "Ocultar contraseña" : "Ver contraseña"}
          >
            <Icon name={visible ? "eyeOff" : "eye"} size={20} color={colors.muted} />
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12 },
});
