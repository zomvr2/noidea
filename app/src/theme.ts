import { Platform, type TextStyle, type ViewStyle } from "react-native";

/**
 * Sistema de diseño de NoIdea: fondo claro, un verde profundo como color de marca,
 * superficies redondeadas y un acento verde lima para el progreso (nivel de agua).
 */
export const colors = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F2F4F3",
  border: "#E6EAE8",

  text: "#121815",
  muted: "#6B7570",
  subtle: "#9AA39E",

  primary: "#0B4A2B",
  primaryPressed: "#083A21",
  primarySoft: "#E3EFE7",
  onPrimary: "#FFFFFF",
  onPrimaryMuted: "rgba(255,255,255,0.7)",
  primaryRaised: "rgba(255,255,255,0.10)",

  accent: "#8BDC6B",
  accentTrack: "rgba(139,220,107,0.28)",

  track: "#E3E8E5",
  danger: "#C8352B",
  dangerSoft: "#FBE9E7",
  warning: "#B86E00",
  warningSoft: "#FFF2DC",
  success: "#2E9B57",
  offline: "#8A948F",

  scrim: "rgba(10,20,15,0.45)",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const type = {
  largeTitle: { fontSize: 30, fontWeight: "700", letterSpacing: -0.4, color: colors.text },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.2, color: colors.text },
  headline: { fontSize: 17, fontWeight: "600", color: colors.text },
  body: { fontSize: 16, color: colors.text, lineHeight: 22 },
  callout: { fontSize: 15, color: colors.text, lineHeight: 20 },
  caption: { fontSize: 13, color: colors.muted },
  overline: { fontSize: 12, fontWeight: "500", color: colors.muted },
} satisfies Record<string, TextStyle>;

/** Sombra suave para elementos flotantes sobre el mapa. */
export const elevation: ViewStyle = Platform.select({
  ios: { shadowColor: "#0B1A12", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  default: { elevation: 6 },
});
