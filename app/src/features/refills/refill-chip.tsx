import type { RefillRequest } from "@noidea/shared";
import { StyleSheet, Text } from "react-native";
import Animated from "react-native-reanimated";
import { Icon } from "@/components/icon";
import { PulseDot } from "@/components/live-badge";
import { duration, fadeIn, fadeOut } from "@/lib/motion";
import { colors, radius } from "@/theme";
import { type RefillTone, refillChip } from "./refill-status";

const LIGHT: Record<RefillTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceMuted, fg: colors.muted },
  primary: { bg: colors.primarySoft, fg: colors.primary },
  success: { bg: colors.primarySoft, fg: colors.success },
};

const DARK: Record<RefillTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.primaryRaised, fg: colors.onPrimaryMuted },
  primary: { bg: "rgba(139,220,107,0.18)", fg: colors.accent },
  success: { bg: "rgba(139,220,107,0.18)", fg: colors.accent },
};

/**
 * Chip informativo (no es un filtro) con el estado de la recarga de un estanque:
 * «Recarga solicitada», «Municipal asignado · Juan P.», «Municipal en camino · ≈ 15 min», «Recargado · ≈ 4 L».
 */
export function RefillChip({ refill, onDark }: { refill: RefillRequest | null; onDark?: boolean }) {
  const info = refill ? refillChip(refill) : null;
  if (!info) return null;
  const t = (onDark ? DARK : LIGHT)[info.tone];
  return (
    <Animated.View
      entering={fadeIn}
      exiting={fadeOut}
      accessibilityRole="text"
      accessibilityLabel={info.label}
      style={[
        styles.chip,
        { backgroundColor: t.bg, transitionProperty: "backgroundColor", transitionDuration: duration.slow },
      ]}
    >
      {info.live ? <PulseDot color={t.fg} size={7} /> : <Icon name="truck" size={13} color={t.fg} />}
      <Text style={[styles.text, { color: t.fg }]} numberOfLines={1}>
        {info.label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    maxWidth: "100%",
  },
  text: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
});
