import type { RefillListItem } from "@noidea/shared";
import * as Location from "expo-location";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Banner } from "@/components/banner";
import { Button } from "@/components/button";
import { Icon, type IconName } from "@/components/icon";
import { LevelBar } from "@/components/level-bar";
import { cancelTagRead, readTagUid } from "@/features/nfc/read-tag-uid";
import { formatLitres, timeAgo } from "@/features/tanks/tank-status";
import { api } from "@/lib/api";
import { colors, radius } from "@/theme";
import { formatEta, hoursToEmptyText, REFILL_STATUS_LABELS } from "./refill-status";

interface Props {
  item: RefillListItem;
  userId: string | null;
  isAdmin: boolean;
  /** true si el usuario ya lleva otra recarga (no puede tomar una segunda). */
  hasOtherActive: boolean;
  now: number;
}

type Busy = null | "claim" | "release" | "start" | "arrive" | "deliver" | "cancel";

/** Tarjeta de una recarga en la pestaña Recargas, con las acciones que corresponden a su estado. */
export function RefillItem({ item, userId, isAdmin, hasOtherActive, now }: Props) {
  const { refill: r, tank } = item;
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = r.assignedTo !== null && r.assignedTo === userId;
  const closed = r.status === "delivered" || r.status === "cancelled";

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBusy(null);
    }
  };

  const confirm = (title: string, message: string, onOk: () => void) =>
    Alert.alert(title, message, [
      { text: "Volver", style: "cancel" },
      { text: "Sí", style: "destructive", onPress: onOk },
    ]);

  const start = () =>
    run("start", async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error("Se necesita permiso de ubicación para mostrar tu camino a las familias.");
      await api.startRefill(r.id);
    });

  const arrive = () =>
    run("arrive", async () => {
      try {
        const tagUid = await readTagUid();
        await api.arriveRefill(r.id, { tagUid });
      } finally {
        cancelTagRead();
      }
    });

  const pct = tank.level.percent;
  const facts: { icon: IconName; text: string }[] = [];
  const hte = hoursToEmptyText(item.hoursToEmpty);
  if (!closed && hte) facts.push({ icon: "clock", text: hte });
  if (item.families > 0) facts.push({ icon: "people", text: `${item.families} familia(s)` });
  if (r.requestedVolumeL !== null && !closed) facts.push({ icon: "refill", text: `Caben ≈ ${formatLitres(r.requestedVolumeL)}` });

  return (
    <View style={[styles.card, mine && !closed && styles.cardMine]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.overline, { color: closed ? colors.muted : colors.primary }]}>
            {REFILL_STATUS_LABELS[r.status]}
            {r.source === "auto" ? " · automática" : ""} · {timeAgo(r.createdAt, now)}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {tank.name}
          </Text>
        </View>
        <Text style={styles.percent}>{pct === null ? "—" : `≈ ${Math.round(pct)}%`}</Text>
      </View>

      {!closed && (
        <LevelBar
          percent={pct}
          color={pct !== null && pct < 20 ? colors.danger : colors.warning}
          trackColor={colors.track}
          height={6}
        />
      )}

      {facts.length > 0 && (
        <View style={styles.facts}>
          {facts.map((f) => (
            <View key={f.text} style={styles.fact}>
              <Icon name={f.icon} size={13} color={colors.muted} />
              <Text style={styles.factText}>{f.text}</Text>
            </View>
          ))}
        </View>
      )}

      {r.assignedName && !closed && (
        <Text style={styles.assigned}>
          {mine ? "Tú" : r.assignedName}
          {r.status === "in_transit"
            ? r.arrivedAt
              ? " · en el estanque"
              : ` · en camino${r.etaS !== null ? ` (${formatEta(r.etaS)})` : ""}`
            : " · asignada"}
        </Text>
      )}

      {r.status === "delivered" && (
        <Text style={styles.assigned}>
          {r.deliveredEstimatedL !== null
            ? `≈ ${formatLitres(r.deliveredEstimatedL)} entregados (estimado por nivel)`
            : "Entregada (sin lectura de nivel para estimar el volumen)"}
        </Text>
      )}

      {mine && r.status === "in_transit" && !r.arrivedAt && (
        <Text style={styles.hint}>Tu ubicación se comparte con las familias mientras vas en camino (app abierta).</Text>
      )}

      {error && <Banner tone="danger" text={error} />}

      {!closed && (
        <View style={styles.actions}>
          {r.status === "requested" && (
            <Button
              label="Tomar recarga"
              icon="truck"
              loading={busy === "claim"}
              disabled={hasOtherActive}
              accessibilityHint={hasOtherActive ? "Ya tienes una recarga en curso" : undefined}
              onPress={() => run("claim", () => api.claimRefill(r.id))}
            />
          )}
          {mine && r.status === "scheduled" && (
            <Button label="Salir hacia el estanque" icon="location" loading={busy === "start"} onPress={start} />
          )}
          {mine && r.status === "in_transit" && !r.arrivedAt && (
            <Button label="Llegué · escanear etiqueta" icon="nfc" loading={busy === "arrive"} onPress={arrive} />
          )}
          {mine && r.status === "in_transit" && r.arrivedAt && (
            <Button
              label="Terminé la recarga"
              icon="check"
              loading={busy === "deliver"}
              onPress={() => run("deliver", () => api.deliverRefill(r.id))}
            />
          )}
          {(mine || isAdmin) && r.status !== "requested" && !(r.status === "in_transit" && r.arrivedAt) && (
            <Button
              label="Soltar"
              variant="secondary"
              loading={busy === "release"}
              onPress={() =>
                confirm("Soltar recarga", "Quedará disponible para otro municipal.", () =>
                  void run("release", () => api.releaseRefill(r.id)),
                )
              }
            />
          )}
          {(r.status === "requested" || mine || isAdmin) && (
            <Button
              label="Cancelar recarga"
              variant="ghost"
              loading={busy === "cancel"}
              onPress={() =>
                confirm("Cancelar recarga", `Se cancelará la recarga de ${tank.name}.`, () =>
                  void run("cancel", () => api.cancelRefill(r.id)),
                )
              }
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: 16, gap: 10 },
  cardMine: { borderWidth: 2, borderColor: colors.primary },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  headerText: { flex: 1, gap: 2 },
  overline: { fontSize: 12, fontWeight: "600" },
  title: { fontSize: 17, fontWeight: "700", color: colors.text },
  percent: { fontSize: 18, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fact: { flexDirection: "row", alignItems: "center", gap: 4 },
  factText: { fontSize: 13, color: colors.muted },
  assigned: { fontSize: 14, fontWeight: "600", color: colors.primary },
  hint: { fontSize: 12, color: colors.muted },
  actions: { gap: 8 },
});
