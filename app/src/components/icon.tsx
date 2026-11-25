import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { colors } from "@/theme";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

/** Iconos de la app: SF Symbols en iOS, Material Symbols en Android/web. */
const ICONS = {
  map: { ios: "map", android: "map" },
  tanks: { ios: "drop", android: "water_drop" },
  tankFilled: { ios: "drop.fill", android: "water_drop" },
  profile: { ios: "person.crop.circle", android: "person" },
  add: { ios: "plus", android: "add" },
  nfc: { ios: "wave.3.right", android: "nfc" },
  location: { ios: "location.fill", android: "location_on" },
  gps: { ios: "scope", android: "gps_fixed" },
  check: { ios: "checkmark.circle.fill", android: "check_circle" },
  warning: { ios: "exclamationmark.triangle.fill", android: "warning" },
  error: { ios: "exclamationmark.circle.fill", android: "error" },
  offline: { ios: "wifi.slash", android: "wifi_off" },
  sensor: { ios: "sensor", android: "sensors" },
  clock: { ios: "clock", android: "schedule" },
  chevronRight: { ios: "chevron.right", android: "chevron_right" },
  close: { ios: "xmark", android: "close" },
  trash: { ios: "trash", android: "delete" },
  eye: { ios: "eye", android: "visibility" },
  eyeOff: { ios: "eye.slash", android: "visibility_off" },
  mail: { ios: "envelope", android: "mail" },
  lock: { ios: "lock", android: "lock" },
  logout: { ios: "rectangle.portrait.and.arrow.right", android: "logout" },
  capacity: { ios: "cylinder", android: "propane_tank" },
  truck: { ios: "truck.box.fill", android: "local_shipping" },
  refill: { ios: "arrow.down.to.line.circle", android: "water_full" },
  people: { ios: "person.2", android: "group" },
} as const satisfies Record<string, { ios: string; android: string }>;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: number;
  color?: ColorValue;
}

export function Icon({ name, size = 22, color = colors.text }: Props) {
  const { ios, android } = ICONS[name];
  const symbol = { ios, android, web: android } as SymbolName;
  return <SymbolView name={symbol} size={size} tintColor={color} resizeMode="scaleAspectFit" />;
}
