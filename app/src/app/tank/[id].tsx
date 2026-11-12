import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Banner, SimulatorBadge } from "@/components/banner";
import { Button } from "@/components/button";
import { Icon, type IconName } from "@/components/icon";
import { LevelBar } from "@/components/level-bar";
import { SectionTitle } from "@/components/screen-header";
import { useSession } from "@/features/auth/use-session";
import {
  formatLitres,
  LEVEL_ICONS,
  LEVEL_LABELS,
  levelState,
  levelText,
  percentText,
  timeAgo,
} from "@/features/tanks/tank-status";
import { useTanks } from "@/features/tanks/use-tanks";
import { colors, radius } from "@/theme";

const ON_DARK_TONE = { ok: colors.accent, low: "#FFC966", critical: "#FF8F80", unknown: "#FFFFFFAA", offline: "#FFFFFFAA" };

/** Detalle de un estanque: nivel estimado en vivo y estado del dispensador. */
export default function TankDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tanks, loaded, now } = useTanks();
  const { profile } = useSession();
  const tank = tanks.find((t) => String(t.id) === id);

  if (!tank) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={{ title: "Estanque" }} />
        <Text style={styles.missingText}>{loaded ? "Este estanque ya no existe." : "Cargando…"}</Text>
      </View>
    );
  }

  const state = levelState(tank, now);
  const tone = ON_DARK_TONE[state];
  const hasLevel = tank.level.percent !== null && state !== "offline";
  const online = state !== "offline";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: tank.name }} />

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.statusRow}>
            <Icon name={LEVEL_ICONS[state]} size={14} color={tone} />
            <Text style={[styles.status, { color: tone }]}>{LEVEL_LABELS[state]}</Text>
          </View>
          {tank.simulated && <SimulatorBadge onDark />}
        </View>
        <Text style={styles.percent} accessibilityLabel={`Nivel ${percentText(tank, state)}, estimado`}>
          {percentText(tank, state)}
        </Text>
        <Text style={styles.volume}>{hasLevel ? levelText(tank) : "Sin lectura confiable del nivel"}</Text>
        <LevelBar
          percent={hasLevel ? tank.level.percent : null}
          color={state === "ok" ? colors.accent : tone}
          trackColor="rgba(255,255,255,0.14)"
          height={12}
          segments={24}
        />
        <View style={styles.heroScale}>
          <Text style={styles.heroScaleText}>0 L</Text>
          <Text style={styles.heroScaleText}>Crítico {"<"} {tank.criticalPercent}%</Text>
          <Text style={styles.heroScaleText}>{formatLitres(tank.capacityL)}</Text>
        </View>
      </View>

      {tank.level.sensorError && <Banner tone="danger" text={`Error de sensor: ${tank.level.sensorError}`} />}
      {tank.level.backupLow && (
        <Banner tone="danger" text="El sensor de respaldo indica nivel crítico: el dispensador no abrirá la válvula." />
      )}

      <SectionTitle>Estado</SectionTitle>
      <View style={styles.grid}>
        <Tile icon={online ? "sensor" : "offline"} label="Dispensador" value={online ? "En línea" : "Sin conexión"} />
        <Tile icon="clock" label="Última lectura" value={timeAgo(tank.level.measuredAt, now)} />
        <Tile icon="capacity" label="Capacidad" value={formatLitres(tank.capacityL)} />
        <Tile
          icon="location"
          label="Ubicación"
          value={
            tank.location
              ? tank.location.accuracyM != null
                ? `± ${Math.round(tank.location.accuracyM)} m`
                : "Marcada"
              : "Sin ubicar"
          }
        />
      </View>

      <Text style={styles.note}>
        El nivel se estima con un sensor ultrasónico y puede variar unos litros. No es una medición exacta.
      </Text>

      {profile?.role === "admin" && (
        <Button
          label={tank.location ? "Volver a ubicar con NFC" : "Ubicar con NFC"}
          icon="nfc"
          variant="secondary"
          onPress={() => router.push("/admin/locate")}
        />
      )}
    </ScrollView>
  );
}

function Tile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileIcon}>
        <Icon name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 8, gap: 14, paddingBottom: 40 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  missingText: { color: colors.muted, fontSize: 15 },
  hero: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: 20, gap: 10 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  status: { fontSize: 13, fontWeight: "700" },
  percent: {
    fontSize: 52,
    fontWeight: "800",
    color: colors.onPrimary,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  volume: { fontSize: 14, color: colors.onPrimaryMuted, marginTop: -6, marginBottom: 6 },
  heroScale: { flexDirection: "row", justifyContent: "space-between" },
  heroScaleText: { fontSize: 11, color: colors.onPrimaryMuted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 14,
    gap: 4,
  },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  tileLabel: { fontSize: 12, color: colors.muted },
  tileValue: { fontSize: 16, fontWeight: "700", color: colors.text },
  note: { fontSize: 13, color: colors.muted, lineHeight: 18 },
});
