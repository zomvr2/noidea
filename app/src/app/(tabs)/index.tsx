import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner } from "@/components/banner";
import { Chip } from "@/components/chip";
import { useSession } from "@/features/auth/use-session";
import { TankMap } from "@/features/map/tank-map";
import { QuotaPill } from "@/features/quota/quota-card";
import { TankAvatar } from "@/features/tanks/tank-avatar";
import { TankCard } from "@/features/tanks/tank-card";
import { matchesFilter, sortByPriority, TANK_FILTERS, type TankFilter } from "@/features/tanks/tank-status";
import { useTanks } from "@/features/tanks/use-tanks";
import { colors, elevation, radius } from "@/theme";

/** Altura aproximada de la UI inferior (fila de estanques o tarjeta), para centrar la cámara. */
const BOTTOM_UI = 250;

/** Mapa de estanques con su nivel en tiempo real. */
export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const { tanks, error, loaded, now } = useTanks();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<TankFilter>("all");

  const located = useMemo(() => tanks.filter((t) => t.location), [tanks]);
  const visible = useMemo(
    () => sortByPriority(located.filter((t) => matchesFilter(t, filter, now)), now),
    [located, filter, now],
  );
  const counts = useMemo(
    () => Object.fromEntries(TANK_FILTERS.map((f) => [f.value, located.filter((t) => matchesFilter(t, f.value, now)).length])),
    [located, now],
  );

  const selected = tanks.find((t) => t.id === selectedId) ?? null;
  const unlocated = tanks.length - located.length;
  const anySimulated = tanks.some((t) => t.simulated);
  const isAdmin = profile?.role === "admin";
  const topUi = insets.top + 60;

  return (
    <View style={styles.screen}>
      {loaded ? (
        <TankMap
          tanks={visible}
          now={now}
          selectedId={selectedId}
          onSelect={setSelectedId}
          padding={{ top: topUi, bottom: BOTTOM_UI }}
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando estanques…</Text>
        </View>
      )}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipScroll}
        >
          {TANK_FILTERS.map((f) => (
            <View key={f.value} style={styles.chipShadow}>
              <Chip
                label={f.label}
                count={f.value === "all" ? undefined : counts[f.value]}
                selected={filter === f.value}
                onPress={() => {
                  setFilter(f.value);
                  setSelectedId(null);
                }}
              />
            </View>
          ))}
        </ScrollView>
        <View style={styles.banners} pointerEvents="box-none">
          {anySimulated && <Banner tone="warning" text="SIMULADOR — los niveles no son mediciones reales" />}
          {error && <Banner tone="danger" text={error} />}
          {loaded && unlocated > 0 && (
            <Banner
              text={
                isAdmin
                  ? `${unlocated} estanque(s) sin ubicación. Toca + para ubicarlos con NFC.`
                  : `${unlocated} estanque(s) aún sin ubicación en el mapa.`
              }
            />
          )}
        </View>
      </View>

      <View style={styles.bottom} pointerEvents="box-none">
        {!selected && (
          <View style={[styles.quota, styles.chipShadow]}>
            <QuotaPill onPress={() => router.navigate("/(tabs)/profile")} />
          </View>
        )}
        {selected ? (
          <Animated.View key={selected.id} entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(160)}>
            <View style={styles.cardShadow}>
              <TankCard
                tank={selected}
                now={now}
                onClose={() => setSelectedId(null)}
                onDetails={() => router.push({ pathname: "/tank/[id]", params: { id: String(selected.id) } })}
              />
            </View>
          </Animated.View>
        ) : (
          loaded &&
          (visible.length > 0 ? (
            <Animated.View entering={FadeInDown.duration(220)}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
                {visible.map((t) => (
                  <View key={t.id} style={styles.chipShadow}>
                    <TankAvatar tank={t} now={now} onPress={() => setSelectedId(t.id)} />
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          ) : (
            located.length > 0 && (
              <View style={[styles.empty, elevation]}>
                <Text style={styles.emptyText}>Ningún estanque coincide con este filtro.</Text>
              </View>
            )
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceMuted },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: colors.muted, fontSize: 14 },
  top: { position: "absolute", top: 0, left: 0, right: 0, gap: 8 },
  chipScroll: { flexGrow: 0 },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 6 },
  chipShadow: { borderRadius: radius.pill, ...elevation, shadowOpacity: 0.08 },
  banners: { paddingHorizontal: 16, gap: 8 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 12 },
  quota: { alignSelf: "flex-start", marginLeft: 16, marginBottom: 4 },
  strip: { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  cardShadow: { marginHorizontal: 16, borderRadius: radius.lg, ...elevation },
  empty: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  emptyText: { color: colors.muted, fontSize: 14 },
});
