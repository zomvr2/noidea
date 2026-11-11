import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { TankCard } from "@/features/tanks/tank-card";
import { useTanks } from "@/features/tanks/use-tanks";
import { SERVER_URL } from "@/lib/config";
import { colors } from "@/theme";

export default function Home() {
  const { tanks, device, error, connected, reload } = useTanks();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
    >
      {device?.link === "simulated" && (
        <View style={styles.simBanner}>
          <Text style={styles.simText}>SIMULADOR — datos no medidos</Text>
        </View>
      )}

      <Text style={styles.status}>
        Servidor: {connected ? "conectado" : "sin conexión"} · Arduino:{" "}
        {device ? (device.link === "connected" ? `conectado (${device.port})` : device.link) : "—"}
      </Text>

      {error && (
        <Text style={styles.error}>
          {error}
          {"\n"}Revisa EXPO_PUBLIC_SERVER_URL ({SERVER_URL}) y que el teléfono esté en la misma Wi-Fi.
        </Text>
      )}

      {tanks.map((t) => (
        <TankCard key={t.id} tank={t} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  simBanner: { backgroundColor: colors.warning, borderRadius: 8, padding: 8 },
  simText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  status: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger },
});
