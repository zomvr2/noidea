import type { RefillListItem } from "@noidea/shared";
import { OPEN_REFILL_STATUSES } from "@noidea/shared";
import { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner } from "@/components/banner";
import { ScreenHeader, SectionTitle } from "@/components/screen-header";
import { useTabBarClearance } from "@/components/tab-bar";
import { useSession } from "@/features/auth/use-session";
import { RefillItem } from "@/features/refills/refill-item";
import { useRefillList } from "@/features/refills/use-refill-list";
import { useTanks } from "@/features/tanks/use-tanks";
import { enterUp } from "@/lib/motion";
import { colors } from "@/theme";

interface Section {
  title: string;
  data: RefillListItem[];
}

/**
 * Despacho de recargas (admin/municipal): estanques que piden agua, ordenados por prioridad.
 * Tomar → Salir → Llegué (NFC) → Terminé. Ver docs/recargas.md.
 */
export default function RefillsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { profile } = useSession();
  const { now } = useTanks();
  const isManager = profile?.role === "admin" || profile?.role === "municipal";
  const { items, error, loaded, reload } = useRefillList(isManager);
  const [refreshing, setRefreshing] = useState(false);
  const userId = profile?.id ?? null;

  const sections = useMemo<Section[]>(() => {
    const open = items.filter((i) => OPEN_REFILL_STATUSES.includes(i.refill.status));
    const mine = open.filter((i) => i.refill.assignedTo === userId);
    const pending = open.filter((i) => i.refill.status === "requested");
    const others = open.filter((i) => i.refill.status !== "requested" && i.refill.assignedTo !== userId);
    const closed = items.filter((i) => !OPEN_REFILL_STATUSES.includes(i.refill.status));
    return [
      { title: "Mi recarga", data: mine },
      { title: "Por atender", data: pending },
      { title: "En curso", data: others },
      { title: "Últimas 24 h", data: closed },
    ].filter((s) => s.data.length > 0);
  }, [items, userId]);

  const hasActive = items.some(
    (i) => i.refill.assignedTo === userId && (i.refill.status === "scheduled" || i.refill.status === "in_transit"),
  );

  if (!isManager) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Esta sección es para el municipio.</Text>
      </View>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <ScreenHeader title="Recargas" />
        {error && <Banner tone="danger" text={error} />}
      </View>

      {!loaded ? (
        <ActivityIndicator style={styles.center} color={colors.primary} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => String(i.refill.id)}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance + 8 }]}
          scrollIndicatorInsets={{ bottom: tabBarClearance }}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderSectionHeader={({ section }) => <SectionTitle>{section.title}</SectionTitle>}
          renderItem={({ item, index }) => (
            <Animated.View entering={enterUp(index)}>
              <RefillItem
                item={item}
                userId={userId}
                isAdmin={profile?.role === "admin"}
                hasOtherActive={hasActive && item.refill.assignedTo !== userId}
                now={now}
              />
            </Animated.View>
          )}
          ListEmptyComponent={
            <Text style={[styles.muted, styles.empty]}>
              Ningún estanque necesita recarga. Las solicitudes aparecen solas cuando un estanque baja del umbral.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, gap: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 20, gap: 10 },
  muted: { color: colors.muted, fontSize: 15, textAlign: "center" },
  empty: { marginTop: 40, paddingHorizontal: 20, lineHeight: 21 },
});
