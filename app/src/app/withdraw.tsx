import type { Tank, Withdrawal } from "@noidea/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner, SimulatorBadge } from "@/components/banner";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { Icon, type IconName } from "@/components/icon";
import { LevelBar } from "@/components/level-bar";
import { useSession } from "@/features/auth/use-session";
import { cancelTagRead, readTagUid } from "@/features/nfc/read-tag-uid";
import { useQuota } from "@/features/quota/use-quota";
import { formatLitres } from "@/features/tanks/tank-status";
import { useTanks } from "@/features/tanks/use-tanks";
import { closeReasonText, isActive, useLiveWithdrawal } from "@/features/withdrawals/use-withdrawal";
import { api, ApiError } from "@/lib/api";
import { duration, useUpdatePulse } from "@/lib/motion";
import { colors, radius } from "@/theme";

/** Cantidades a escala del prototipo (la API acepta hasta 5 L por retiro). */
const LITER_OPTIONS = [0.5, 1, 2, 3] as const;

type Step =
  | { kind: "amount" }
  | { kind: "scanning" }
  | { kind: "requesting"; tank: Tank | null }
  | { kind: "tracking"; withdrawal: Withdrawal; tank: Tank | null }
  | { kind: "error"; message: string };

/** Etapas visibles: 1 cantidad → 2 etiqueta → 3 dispensar. */
const STAGES: { icon: IconName; label: string }[] = [
  { icon: "tanks", label: "Cantidad" },
  { icon: "nfc", label: "Etiqueta" },
  { icon: "tankFilled", label: "Dispensar" },
];

/**
 * Retiro de agua (familias). La familia elige cuántos litros quiere y acerca el teléfono a la etiqueta
 * NFC del estanque: el UID leído y la cantidad van a la API, que decide (saldo, nivel, dispensador en
 * línea…) y ordena al dispensador abrir. El avance llega en vivo y al cerrar queda el comprobante.
 * Parámetro opcional `id`: si se abre desde el detalle, la etiqueta debe ser la de ese estanque.
 * El volumen es estimado (tiempo de apertura × caudal calibrado): siempre se muestra con «≈».
 */
export default function WithdrawScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const expectedId = id ? Number(id) : null;
  const { profile } = useSession();
  const { tanks } = useTanks();
  const { family, quota, loaded: quotaLoaded } = useQuota();
  const [step, setStep] = useState<Step>({ kind: "amount" });
  const [picked, setLiters] = useState<number>(LITER_OPTIONS[0]);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => cancelTagRead, []);

  const withdrawal = useLiveWithdrawal(step.kind === "tracking" ? step.withdrawal : null);
  const expectedTank = expectedId !== null ? (tanks.find((t) => t.id === expectedId) ?? null) : null;

  const available = quota?.availableL ?? 0;
  const options = useMemo(() => LITER_OPTIONS.filter((l) => l <= available + 1e-9), [available]);
  const blocked = blockedReason(profile?.role, family?.status, quotaLoaded, quota !== null, options.length > 0);

  // Si el saldo baja (otro retiro de la familia), no dejar elegida una cantidad que ya no alcanza.
  const liters = options.some((l) => l === picked) ? picked : (options[0] ?? picked);

  const start = async () => {
    cancelled.current = false;
    try {
      setStep({ kind: "scanning" });
      const tagUid = await readTagUid();
      const tank = tanks.find((t) => t.nfcTagUid === tagUid) ?? null;
      if (expectedTank && tank && tank.id !== expectedTank.id) {
        throw new Error(
          `Esta etiqueta es de «${tank.name}», no de «${expectedTank.name}». Escanea la etiqueta del estanque donde estás.`,
        );
      }
      setStep({ kind: "requesting", tank });
      // La API valida todo (saldo, nivel, dispensador en línea) y espera la confirmación del dispensador.
      const w = await api.createWithdrawal({ tagUid, liters });
      setStep({ kind: "tracking", withdrawal: w, tank: tank ?? tanks.find((t) => t.id === w.tankId) ?? null });
    } catch (e) {
      if (cancelled.current) setStep({ kind: "amount" });
      else setStep({ kind: "error", message: errorText(e) });
    }
  };

  const stop = async (w: Withdrawal) => {
    setStopping(true);
    setStopError(null);
    try {
      await api.stopWithdrawal(w.id); // El cierre real llega por Realtime (DONE r=STOP).
    } catch (e) {
      setStopError(errorText(e));
    } finally {
      setStopping(false);
    }
  };

  const cancelScan = () => {
    cancelled.current = true;
    cancelTagRead();
  };

  const reset = () => {
    setStopError(null);
    setStep({ kind: "amount" });
  };

  const current = stageIndex(step, withdrawal);
  const tracking = step.kind === "tracking" && withdrawal;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? 16 : insets.top + 12 }]}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Retirar agua
        </Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={styles.close}
        >
          <Icon name="close" size={18} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Stepper current={current} />

        {tracking ? (
          <Tracking withdrawal={withdrawal} tank={step.tank} />
        ) : (
          <>
            <ScanVisual active={step.kind === "scanning" || step.kind === "requesting"} />

            <View style={styles.copy}>
              <Text style={styles.title}>{titleFor(step, expectedTank)}</Text>
              <Text style={styles.body}>{bodyFor(step, liters)}</Text>
            </View>

            {step.kind === "amount" && (
              <Animated.View entering={FadeInDown.duration(200)} style={styles.card}>
                <View style={styles.balanceRow}>
                  <Text style={styles.fieldLabel}>Saldo disponible</Text>
                  <Text style={styles.balance}>{quota ? `≈ ${formatLitres(available)}` : "—"}</Text>
                </View>
                {blocked ? (
                  <Text style={styles.blocked}>{blocked}</Text>
                ) : (
                  <View style={styles.chips} accessibilityLabel="Cantidad a retirar">
                    {options.map((l) => (
                      <Chip key={l} label={formatLitres(l)} selected={liters === l} onPress={() => setLiters(l)} />
                    ))}
                  </View>
                )}
              </Animated.View>
            )}

            {step.kind === "error" && <Banner tone="danger" text={step.message} />}
          </>
        )}

        {stopError && <Banner tone="danger" text={stopError} />}

        <View style={styles.actions}>
          {step.kind === "amount" && (
            <Button
              label={`Escanear y retirar ${formatLitres(liters)}`}
              icon="nfc"
              disabled={!!blocked}
              onPress={start}
            />
          )}
          {step.kind === "error" && (
            <>
              <Button label="Reintentar" icon="nfc" onPress={start} />
              <Button label="Cambiar cantidad" variant="ghost" onPress={reset} />
            </>
          )}
          {step.kind === "scanning" && <Button label="Cancelar" variant="secondary" onPress={cancelScan} />}
          {step.kind === "requesting" && <Button label="Abriendo el dispensador…" loading disabled />}
          {tracking &&
            (isActive(withdrawal) ? (
              <Button
                label="Detener retiro"
                icon="close"
                variant="secondary"
                loading={stopping}
                onPress={() => stop(withdrawal)}
              />
            ) : (
              <>
                <Button label="Listo" onPress={() => router.back()} />
                <Button label="Hacer otro retiro" variant="ghost" onPress={reset} />
              </>
            ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** Avance en vivo y, al cerrar, comprobante del retiro. */
function Tracking({ withdrawal: w, tank }: { withdrawal: Withdrawal; tank: Tank | null }) {
  const active = isActive(w);
  const elapsedMs = w.progressMs ?? 0;
  const fraction = w.targetMs > 0 ? Math.min(1, elapsedMs / w.targetMs) : 0;
  // Mientras dispensa, lo entregado se estima por el tiempo transcurrido; al cerrar manda el valor de la API.
  const deliveredL = w.deliveredL ?? (w.status === "dispensing" ? w.requestedL * fraction : 0);
  const percent = active ? fraction * 100 : w.requestedL > 0 ? (deliveredL / w.requestedL) * 100 : 0;
  const ok = w.status === "completed";
  const pulse = useUpdatePulse(Math.round(deliveredL * 10));
  const reason = closeReasonText(w.closeReason);

  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.trackCard}>
      <View style={styles.trackTop}>
        <View style={styles.statusRow}>
          <Icon
            name={active ? "tankFilled" : ok ? "check" : "error"}
            size={16}
            color={active ? colors.accent : ok ? colors.accent : "#FF8F80"}
          />
          <Text style={styles.trackStatus}>{STATUS_LABELS[w.status]}</Text>
        </View>
        {tank?.simulated && <SimulatorBadge onDark />}
      </View>

      <Text style={styles.trackTank} numberOfLines={1}>
        {tank?.name ?? "Estanque"}
      </Text>

      <Animated.Text style={[styles.trackValue, pulse]} accessibilityLabel={`Entregado aproximadamente ${formatLitres(deliveredL)}, estimado`}>
        ≈ {formatLitres(deliveredL)}
      </Animated.Text>
      <Text style={styles.trackSub}>de {formatLitres(w.requestedL)} pedidos · estimado</Text>

      <LevelBar
        percent={percent}
        color={ok || active ? colors.accent : "#FFC966"}
        trackColor="rgba(255,255,255,0.14)"
        height={12}
        segments={24}
      />

      {active ? (
        <Text style={styles.trackNote}>
          {w.status === "authorized"
            ? "Esperando la confirmación del dispensador…"
            : `Válvula abierta ${Math.round(elapsedMs / 1000)} s de ≈ ${Math.round(w.targetMs / 1000)} s. Se cierra sola al terminar.`}
        </Text>
      ) : (
        <View style={styles.receipt}>
          <ReceiptLine label="Retiro" value={`#${w.id}`} />
          <ReceiptLine label="Fecha" value={formatDateTime(w.finishedAt ?? w.createdAt)} />
          <ReceiptLine label="Pedido" value={formatLitres(w.requestedL)} />
          <ReceiptLine label="Entregado" value={`≈ ${formatLitres(w.deliveredL ?? 0)} (estimado)`} />
          {reason && <Text style={styles.trackNote}>{reason}</Text>}
        </View>
      )}
    </Animated.View>
  );
}

function ReceiptLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.receiptLine}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={styles.receiptValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <View style={styles.stepper}>
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={s.label} style={styles.stage}>
            <Animated.View
              style={[
                styles.stageDot,
                {
                  backgroundColor: done ? colors.success : active ? colors.primary : colors.surfaceMuted,
                  transform: [{ scale: active ? 1.12 : 1 }],
                  transitionProperty: ["backgroundColor", "transform"],
                  transitionDuration: duration.slow,
                },
              ]}
            >
              <Icon name={done ? "check" : s.icon} size={14} color={done || active ? colors.onPrimary : colors.subtle} />
            </Animated.View>
            <Text style={[styles.stageLabel, (done || active) && styles.stageLabelOn]}>{s.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ScanVisual({ active }: { active: boolean }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = active ? withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1) : 0;
  }, [active, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: active ? 1 - pulse.value : 0,
    transform: [{ scale: 1 + pulse.value * 0.55 }],
  }));

  return (
    <View style={styles.visual}>
      <Animated.View style={[styles.ring, ring]} />
      <View style={styles.visualInner}>
        <Icon name="nfc" size={44} color={colors.primary} />
      </View>
    </View>
  );
}

const STATUS_LABELS: Record<Withdrawal["status"], string> = {
  authorized: "Autorizado",
  dispensing: "Dispensando",
  completed: "Retiro completado",
  failed: "Retiro fallido",
  cancelled: "Retiro cancelado",
};

function stageIndex(step: Step, w: Withdrawal | null): number {
  switch (step.kind) {
    case "amount":
    case "error":
      return 0;
    case "scanning":
      return 1;
    case "requesting":
      return 2;
    case "tracking":
      return isActive(w) ? 2 : 3;
  }
}

function titleFor(step: Step, expected: Tank | null): string {
  switch (step.kind) {
    case "scanning":
      return "Acerca el teléfono a la etiqueta";
    case "requesting":
      return step.tank ? `Abriendo «${step.tank.name}»` : "Abriendo el dispensador";
    case "error":
      return "No se pudo retirar";
    default:
      return expected ? `¿Cuánta agua retiras de «${expected.name}»?` : "¿Cuánta agua necesitas?";
  }
}

function bodyFor(step: Step, liters: number): string {
  switch (step.kind) {
    case "scanning":
      return "Mantén la parte trasera del teléfono sobre la tarjeta o llavero del estanque hasta que se detecte.";
    case "requesting":
      return `Revisando tu saldo y el estanque, y esperando que el dispensador confirme ${formatLitres(liters)}.`;
    case "error":
      return "Revisa el mensaje y vuelve a intentarlo. Si no se abrió la válvula, no se descontó nada.";
    default:
      return "Elige la cantidad, párate junto al estanque y escanea su etiqueta. El volumen se estima por el tiempo de apertura de la válvula.";
  }
}

/** Por qué la familia no puede retirar ahora (la API lo vuelve a validar; esto solo evita un intento inútil). */
function blockedReason(
  role: string | undefined,
  familyStatus: string | undefined,
  quotaLoaded: boolean,
  hasQuota: boolean,
  hasOptions: boolean,
): string | null {
  if (role !== "family") return "Solo las familias pueden retirar agua.";
  if (!quotaLoaded) return "Cargando tu cuota…";
  if (familyStatus && familyStatus !== "approved") return "Tu familia aún no está habilitada para retirar agua.";
  if (!hasQuota) return "Tu familia no tiene cuota asignada para este período.";
  if (!hasOptions) return "Tu saldo no alcanza para el retiro mínimo.";
  return null;
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return e instanceof Error ? e.message : "Error desconocido";
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  close: {
    position: "absolute",
    right: 16,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flexGrow: 1, padding: 24, gap: 24 },
  visual: { alignItems: "center", justifyContent: "center", height: 170 },
  ring: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  visualInner: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  stepper: { flexDirection: "row", justifyContent: "center", gap: 28, marginTop: 8 },
  stage: { alignItems: "center", gap: 6 },
  stageDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stageLabel: { fontSize: 12, color: colors.subtle, fontWeight: "500" },
  stageLabelOn: { color: colors.text },
  copy: { gap: 8, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center", letterSpacing: -0.2 },
  body: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 21, maxWidth: 320 },
  actions: { marginTop: "auto", gap: 8 },
  card: { backgroundColor: colors.surfaceMuted, borderRadius: radius.xl, padding: 20, gap: 14 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  fieldLabel: { fontSize: 13, color: colors.muted },
  balance: { fontSize: 18, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  blocked: { fontSize: 14, color: colors.warning, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  trackCard: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: 20, gap: 10 },
  trackTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  trackStatus: { fontSize: 13, fontWeight: "700", color: colors.onPrimary },
  trackTank: { fontSize: 15, color: colors.onPrimaryMuted },
  trackValue: {
    fontSize: 48,
    fontWeight: "800",
    color: colors.onPrimary,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
    alignSelf: "flex-start",
  },
  trackSub: { fontSize: 14, color: colors.onPrimaryMuted, marginTop: -6, marginBottom: 6 },
  trackNote: { fontSize: 13, color: colors.onPrimaryMuted, lineHeight: 18 },
  receipt: { gap: 8, marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.14)" },
  receiptLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  receiptLabel: { fontSize: 13, color: colors.onPrimaryMuted },
  receiptValue: { fontSize: 14, fontWeight: "600", color: colors.onPrimary, fontVariant: ["tabular-nums"] },
});
