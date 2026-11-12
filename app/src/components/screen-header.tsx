import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { type } from "@/theme";

/** Título grande de pantalla con acción opcional a la derecha. */
export function ScreenHeader({ title, right, leading }: { title: string; right?: ReactNode; leading?: ReactNode }) {
  return (
    <View style={styles.row}>
      {leading}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={styles.section} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  title: { ...type.largeTitle, flex: 1 },
  section: { ...type.headline, fontSize: 18, marginTop: 8 },
});
