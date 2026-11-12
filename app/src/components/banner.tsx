import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@/theme";
import { Icon, type IconName } from "./icon";

type Tone = "info" | "warning" | "danger";

const TONES: Record<Tone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: colors.primarySoft, fg: colors.primary, icon: "location" },
  warning: { bg: colors.warningSoft, fg: colors.warning, icon: "warning" },
  danger: { bg: colors.dangerSoft, fg: colors.danger, icon: "error" },
};

/** Aviso en línea con icono. `role="alert"` para lectores de pantalla en errores. */
export function Banner({ tone = "info", text, icon }: { tone?: Tone; text: string; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: t.bg }]}
      accessibilityRole={tone === "danger" ? "alert" : undefined}
    >
      <Icon name={icon ?? t.icon} size={16} color={t.fg} />
      <Text style={[styles.text, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

/** Etiqueta "SIMULADOR": los datos de un dispositivo simulado nunca se presentan como reales. */
export function SimulatorBadge({ onDark }: { onDark?: boolean }) {
  return (
    <View style={[styles.badge, onDark && styles.badgeOnDark]}>
      <Text style={[styles.badgeText, onDark && styles.badgeTextOnDark]}>SIMULADOR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  text: { flex: 1, fontSize: 14, fontWeight: "500", lineHeight: 19 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
  },
  badgeOnDark: { backgroundColor: "#FFD48A" },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6, color: colors.warning },
  badgeTextOnDark: { color: "#5C3700" },
});
