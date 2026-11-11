import { Redirect, router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "@/features/auth/use-session";
import { TankMap } from "@/features/map/tank-map";
import { TankCard } from "@/features/tanks/tank-card";
import { useTanks } from "@/features/tanks/use-tanks";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";

/** Mapa de estanques con su nivel en tiempo real. */
export default function Home() {
  const { session, profile, loading } = useSession();
  const { tanks, error, loaded } = useTanks(!!session);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (!loading && !session) return <Redirect href="/login" />;

  const selected = tanks.find((t) => t.id === selectedId) ?? null;
  const unlocated = tanks.filter((t) => !t.location).length;
  const anySimulated = tanks.some((t) => t.simulated);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => supabase.auth.signOut()} hitSlop={8}>
              <Text style={styles.link}>Salir</Text>
            </Pressable>
          ),
        }}
      />

      {loaded ? (
        <TankMap tanks={tanks} onSelect={setSelectedId} />
      ) : (
        <ActivityIndicator style={styles.center} size="large" />
      )}

      <View style={styles.top} pointerEvents="box-none">
        {anySimulated && <Text style={styles.simBanner}>SIMULADOR — datos de nivel no medidos</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {unlocated > 0 && (
          <Text style={styles.note}>
            {unlocated} estanque(s) sin ubicación{profile?.role === "admin" ? ": usa «Ubicar estanque»" : ""}.
          </Text>
        )}
      </View>

      <View style={styles.bottom} pointerEvents="box-none">
        {selected && (
          <Pressable onPress={() => setSelectedId(null)}>
            <TankCard tank={selected} />
          </Pressable>
        )}
        {profile?.role === "admin" && (
          <Pressable style={styles.button} onPress={() => router.push("/admin/locate")}>
            <Text style={styles.buttonText}>Ubicar estanque (NFC + GPS)</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1 },
  top: { position: "absolute", top: 12, left: 12, right: 12, gap: 8 },
  bottom: { position: "absolute", bottom: 24, left: 12, right: 12, gap: 10 },
  simBanner: {
    backgroundColor: colors.warning,
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
    padding: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  note: { backgroundColor: colors.surface, color: colors.muted, padding: 8, borderRadius: 8, overflow: "hidden" },
  error: { backgroundColor: colors.surface, color: colors.danger, padding: 8, borderRadius: 8, overflow: "hidden" },
  button: { backgroundColor: colors.water, borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { color: colors.water, fontSize: 16 },
});
