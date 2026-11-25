import type { Tank } from "@noidea/shared";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner } from "@/components/banner";
import { Icon } from "@/components/icon";
import { LiveBadge } from "@/components/live-badge";
import { ScreenHeader, SectionTitle } from "@/components/screen-header";
import { SegmentedTabs } from "@/components/segmented-tabs";
import { useTabBarClearance } from "@/components/tab-bar";
import { TankCard } from "@/features/tanks/tank-card";
import { TankRow } from "@/features/tanks/tank-row";
import {
  levelState,
  matchesFilter,
  sortByPriority,
  TANK_FILTERS,
  type TankFilter,
} from "@/features/tanks/tank-status";
import { useTanks } from "@/features/tanks/use-tanks";
import { enterUp } from "@/lib/motion";
import { colors } from "@/theme";

interface Section {
  title: string;
  highlight: boolean;
  data: Tank[];
}

/** Lista de estanques: los que requieren atención primero, como tarjetas destacadas. */
export default function TanksScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { tanks, loaded, error, now, connected, reload } = useTanks();
  const [filter, setFilter] = useState<TankFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo<Section[]>(() => {
    const list = sortByPriority(
      tanks.filter((t) => matchesFilter(t, filter, now)),
      now,
    );
    const attention = list.filter((t) => {
      const s = levelState(t, now);
      return s === "critical" || s === "low";
    });
    const rest = list.filter((t) => !attention.includes(t));
    return [
      { title: "Requieren atención", highlight: true, data: attention },
      { title: filter === "offline" ? "Sin datos recientes" : "Estanques", highlight: false, data: rest },
    ].filter((s) => s.data.length > 0);
  }, [tanks, filter, now]);

  const open = (t: Tank) => router.push({ pathname: "/tank/[id]", params: { id: String(t.id) } });

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <ScreenHeader title="Estanques" right={loaded ? <LiveBadge connected={connected} /> : undefined} />
        <SegmentedTabs options={TANK_FILTERS} value={filter} onChange={setFilter} />
      </View>

      {!loaded ? (
        <ActivityIndicator style={styles.center} color={colors.primary} />
      ) : (
        <SectionList
          // Al cambiar de filtro la lista se vuelve a montar y las tarjetas entran escalonadas.
          key={filter}
          sections={sections}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance + 8 }]}
          scrollIndicatorInsets={{ bottom: tabBarClearance }}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          ListHeaderComponent={error ? <Banner tone="danger" text={error} /> : undefined}
          renderSectionHeader={({ section }) => <SectionTitle>{section.title}</SectionTitle>}
          renderItem={({ item, index, section }) => (
            // Solo las tarjetas de la primera pantalla se escalonan (stagger tiene tope).
            <Animated.View entering={enterUp(section.highlight ? index : index + 1)}>
              {section.highlight ? (
                <TankCard tank={item} now={now} onDetails={() => open(item)} />
              ) : (
                <TankRow tank={item} now={now} onPress={() => open(item)} />
              )}
            </Animated.View>
          )}
          ItemSeparatorComponent={Gap}
          SectionSeparatorComponent={Gap}
          ListEmptyComponent={
            <Animated.View entering={enterUp()} style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="tanks" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === "alerts" ? "Todo en orden" : filter === "offline" ? "Todos conectados" : "Sin estanques"}
              </Text>
              <Text style={styles.emptyText}>
                {filter === "alerts"
                  ? "Ningún estanque tiene nivel bajo o crítico."
                  : filter === "offline"
                    ? "Todos los dispensadores están enviando datos."
                    : "Aún no hay estanques registrados."}
              </Text>
            </Animated.View>
          }
        />
      )}
    </View>
  );
}

/** Separador a nivel de módulo: un componente en línea sería un tipo nuevo en cada render. */
function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, gap: 12 },
  center: { flex: 1 },
  list: { padding: 20, paddingTop: 8, gap: 0, flexGrow: 1 },
  gap: { height: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 60 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", maxWidth: 260 },
});
