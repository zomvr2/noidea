import type { FamilyStatus, QuotaBalance } from "@noidea/shared";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { LevelBar } from "@/components/level-bar";
import { formatLitres } from "@/features/tanks/tank-status";
import { colors, radius } from "@/theme";
import { useQuota } from "./use-quota";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** "1 dic" en hora local. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));
}

/** Porcentaje disponible de la cuota (0-100). */
function availablePercent(q: QuotaBalance): number {
  return q.allocatedL > 0 ? (q.availableL / q.allocatedL) * 100 : 0;
}

/** Menos del 15 % disponible: avisar. */
const LOW_QUOTA_PERCENT = 15;

const STATUS_NOTES: Partial<Record<FamilyStatus, string>> = {
  pending: "Tu familia está pendiente de aprobación. Aún no puedes retirar agua.",
  suspended: "Tu familia está suspendida. Habla con el administrador.",
  rejected: "La solicitud de tu familia fue rechazada. Habla con el administrador.",
};

/**
 * Tarjeta de cuota familiar del período (verde, estilo tarjeta destacada).
 * El consumo se calcula con volúmenes estimados, por eso se muestra con "≈".
 */
export function QuotaCard() {
  const { familyId, family, quota, loaded, error } = useQuota();
  if (familyId === null) return null;

  if (!loaded) {
    return (
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator color={colors.onPrimary} />
      </View>
    );
  }

  const statusNote = family ? STATUS_NOTES[family.status] : undefined;
  const pct = quota ? availablePercent(quota) : 0;
  const low = quota !== null && pct < LOW_QUOTA_PERCENT;
  const tone = low ? "#FFC966" : colors.accent;

  return (
    <View style={styles.card} accessible accessibilityLabel={quota ? quotaA11y(quota) : "Sin cuota vigente"}>
      <View style={styles.header}>
        <Text style={styles.overline} numberOfLines={1}>
          Cuota familiar{family ? ` · ${family.name}` : ""}
        </Text>
        {quota && <Text style={styles.overline}>{`${shortDate(quota.periodStart)} – ${shortDate(quota.periodEnd)}`}</Text>}
      </View>

      {error ? (
        <Text style={styles.empty}>{error}</Text>
      ) : !quota ? (
        <>
          <Text style={styles.title}>Sin cuota vigente</Text>
          <Text style={styles.empty}>Tu familia no tiene litros asignados para este período.</Text>
        </>
      ) : (
        <>
          <View style={styles.stats}>
            <View>
              <Text style={styles.label}>Disponible</Text>
              <Text style={[styles.value, low && { color: tone }]}>≈ {formatLitres(quota.availableL)}</Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.label}>Asignado</Text>
              <Text style={styles.value}>{formatLitres(quota.allocatedL)}</Text>
            </View>
          </View>
          <LevelBar percent={pct} color={tone} trackColor="rgba(255,255,255,0.14)" />
          <View style={styles.legend}>
            <Text style={styles.foot}>
              Usado ≈ {formatLitres(quota.usedL)}
              {quota.reservedL > 0 ? ` · Reservado ${formatLitres(quota.reservedL)}` : ""}
            </Text>
            <Text style={styles.foot}>
              {daysLeft(quota.periodEnd) === 0 ? "Se renueva hoy" : `Se renueva en ${daysLeft(quota.periodEnd)} d`}
            </Text>
          </View>
        </>
      )}

      {statusNote && (
        <View style={styles.note}>
          <Icon name="warning" size={14} color="#FFC966" />
          <Text style={styles.noteText}>{statusNote}</Text>
        </View>
      )}
    </View>
  );
}

function quotaA11y(q: QuotaBalance): string {
  return `Cuota familiar: aproximadamente ${formatLitres(q.availableL)} disponibles de ${formatLitres(q.allocatedL)}. Usado aproximadamente ${formatLitres(q.usedL)}.`;
}

/** Píldora compacta de cuota para el mapa. Toca para ir al perfil. */
export function QuotaPill({ onPress }: { onPress: () => void }) {
  const { familyId, quota, loaded } = useQuota();
  if (familyId === null || !loaded) return null;

  const low = quota !== null && availablePercent(quota) < LOW_QUOTA_PERCENT;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={quota ? quotaA11y(quota) : "Sin cuota vigente"}
      accessibilityHint="Abre tu perfil"
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
    >
      <View style={[styles.pillIcon, low && { backgroundColor: colors.warningSoft }]}>
        <Icon name="tankFilled" size={14} color={low ? colors.warning : colors.primary} />
      </View>
      <Text style={styles.pillText}>
        {quota ? (
          <>
            <Text style={styles.pillStrong}>≈ {formatLitres(quota.availableL)}</Text> de tu cuota
          </>
        ) : (
          "Sin cuota vigente"
        )}
      </Text>
      <Icon name="chevronRight" size={14} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 16, gap: 10 },
  center: { minHeight: 120, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  overline: { fontSize: 12, fontWeight: "600", color: colors.onPrimaryMuted, flexShrink: 1 },
  title: { fontSize: 20, fontWeight: "700", color: colors.onPrimary },
  stats: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  right: { alignItems: "flex-end" },
  label: { fontSize: 12, color: colors.onPrimaryMuted },
  value: { fontSize: 24, fontWeight: "700", color: colors.onPrimary, fontVariant: ["tabular-nums"] },
  legend: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  foot: { fontSize: 12, color: colors.onPrimaryMuted },
  empty: { fontSize: 14, color: colors.onPrimaryMuted, lineHeight: 19 },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryRaised,
  },
  noteText: { flex: 1, fontSize: 13, color: colors.onPrimary, lineHeight: 18 },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    height: 40,
    paddingLeft: 5,
    paddingRight: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  pillPressed: { opacity: 0.8 },
  pillIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontSize: 14, color: colors.text },
  pillStrong: { fontWeight: "700", fontVariant: ["tabular-nums"] },
});
