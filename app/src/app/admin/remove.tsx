import type { Tank } from "@noidea/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { Banner } from "@/components/banner";
import { Button } from "@/components/button";
import { Icon, type IconName } from "@/components/icon";
import { cancelTagRead, readTagUid } from "@/features/nfc/read-tag-uid";
import { useTanks } from "@/features/tanks/use-tanks";
import { api } from "@/lib/api";
import { MAP_HREF } from "@/lib/routes";
import { duration } from "@/lib/motion";
import { colors, radius } from "@/theme";

type Step =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "confirm"; tank: Tank; tagUid: string }
  | { kind: "removing"; tank: Tank; tagUid: string }
  | { kind: "done"; name: string; tagUid: string }
  | { kind: "error"; message: string };

/** Etapas visibles (proceso inverso a «Ubicar»: 1 escanear → 2 confirmar → 3 eliminar). */
const STAGES: { icon: IconName; label: string }[] = [
  { icon: "nfc", label: "Etiqueta" },
  { icon: "warning", label: "Confirmar" },
  { icon: "trash", label: "Eliminar" },
];

function stageIndex(step: Step): number {
  switch (step.kind) {
    case "scanning":
      return 0;
    case "confirm":
      return 1;
    case "removing":
      return 2;
    case "done":
      return 3;
    default:
      return -1;
  }
}

/**
 * Solo administradores: eliminar un estanque. Igual que al ubicarlo, hay que estar junto a él y
 * escanear su etiqueta NFC; luego se confirma. Borrado lógico en la API: el historial se conserva,
 * el dispensador queda revocado y la etiqueta libre para otro estanque.
 * Parámetro opcional `id`: si se abre desde el detalle, la etiqueta debe ser la de ese estanque.
 */
export default function RemoveTank() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const expectedId = id ? Number(id) : null;
  const { tanks } = useTanks();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const cancelled = useRef(false);

  useEffect(() => cancelTagRead, []);

  const start = async () => {
    cancelled.current = false;
    try {
      setStep({ kind: "scanning" });
      const tagUid = await readTagUid();
      const tank = tanks.find((t) => t.nfcTagUid === tagUid);
      if (!tank) throw new Error(`La etiqueta ${tagUid} no corresponde a ningún estanque registrado.`);
      if (expectedId !== null && tank.id !== expectedId) {
        const expected = tanks.find((t) => t.id === expectedId);
        throw new Error(
          `Esta etiqueta es de «${tank.name}», no de «${expected?.name ?? "el estanque seleccionado"}». ` +
            "Escanea la etiqueta del estanque que quieres eliminar.",
        );
      }
      setStep({ kind: "confirm", tank, tagUid });
    } catch (e) {
      if (cancelled.current) setStep({ kind: "idle" });
      else setStep({ kind: "error", message: e instanceof Error ? e.message : "Error desconocido" });
    }
  };

  const remove = async (tank: Tank, tagUid: string) => {
    setStep({ kind: "removing", tank, tagUid });
    try {
      const res = await api.removeTank({ tagUid, tankId: tank.id });
      setStep({ kind: "done", name: res.name, tagUid });
    } catch (e) {
      setStep({ kind: "error", message: e instanceof Error ? e.message : "Error desconocido" });
    }
  };

  const cancelScan = () => {
    cancelled.current = true;
    cancelTagRead();
  };

  const busy = step.kind === "scanning" || step.kind === "removing";
  const current = stageIndex(step);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? 16 : insets.top + 12 }]}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Eliminar estanque
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
        {step.kind === "done" ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIcon, { backgroundColor: colors.dangerSoft }]}>
                <Icon name="trash" size={24} color={colors.danger} />
              </View>
              <View style={styles.cardHeadText}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {step.name}
                </Text>
                <Text style={styles.cardSub}>Estanque eliminado</Text>
              </View>
            </View>
            <Text style={styles.cardBody}>
              Ya no aparece en el mapa y su dispensador quedó desvinculado. El historial de retiros se conserva. La
              etiqueta {step.tagUid} queda libre para registrar otro estanque.
            </Text>
          </Animated.View>
        ) : (
          <>
            <ScanVisual active={busy} danger={step.kind === "confirm" || step.kind === "removing"} />

            <View style={styles.stepper}>
              {STAGES.map((s, i) => {
                const doneStage = i < current;
                const active = i === current;
                return (
                  <View key={s.label} style={styles.stage}>
                    <Animated.View
                      style={[
                        styles.stageDot,
                        {
                          backgroundColor: doneStage ? colors.success : active ? colors.danger : colors.surfaceMuted,
                          transform: [{ scale: active ? 1.12 : 1 }],
                          transitionProperty: ["backgroundColor", "transform"],
                          transitionDuration: duration.slow,
                        },
                      ]}
                    >
                      <Icon
                        name={doneStage ? "check" : s.icon}
                        size={14}
                        color={doneStage || active ? colors.onPrimary : colors.subtle}
                      />
                    </Animated.View>
                    <Text style={[styles.stageLabel, (doneStage || active) && styles.stageLabelOn]}>{s.label}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.copy}>
              <Text style={styles.title}>
                {step.kind === "confirm" || step.kind === "removing" ? `¿Eliminar «${step.tank.name}»?` : TITLES[step.kind]}
              </Text>
              <Text style={styles.body}>{BODIES[step.kind]}</Text>
            </View>

            {(step.kind === "confirm" || step.kind === "removing") && (
              <Animated.View entering={FadeInDown.duration(200)} style={styles.card}>
                <Field label="Etiqueta" value={step.tagUid} />
                <Field
                  label="Nivel"
                  value={step.tank.level.volumeL != null ? `≈ ${step.tank.level.volumeL.toFixed(1)} L (estimado)` : "—"}
                />
                <Field
                  label="Ubicación"
                  value={
                    step.tank.location
                      ? `${step.tank.location.latitude.toFixed(5)}, ${step.tank.location.longitude.toFixed(5)}`
                      : "Sin ubicar"
                  }
                />
              </Animated.View>
            )}

            {step.kind === "error" && <Banner tone="danger" text={step.message} />}
          </>
        )}

        <View style={styles.actions}>
          {step.kind === "idle" && <Button label="Escanear etiqueta" icon="nfc" onPress={start} />}
          {step.kind === "error" && <Button label="Reintentar" onPress={start} />}
          {step.kind === "scanning" && <Button label="Cancelar" variant="secondary" onPress={cancelScan} />}
          {(step.kind === "confirm" || step.kind === "removing") && (
            <>
              <Button
                label="Eliminar estanque"
                icon="trash"
                variant="danger"
                loading={step.kind === "removing"}
                disabled={step.kind === "removing"}
                onPress={() => remove(step.tank, step.tagUid)}
              />
              <Button
                label="Cancelar"
                variant="ghost"
                disabled={step.kind === "removing"}
                onPress={() => setStep({ kind: "idle" })}
              />
            </>
          )}
          {step.kind === "done" && <Button label="Volver al mapa" onPress={() => router.dismissTo(MAP_HREF)} />}
        </View>
      </ScrollView>
    </View>
  );
}

const TITLES: Record<Step["kind"], string> = {
  idle: "Escanea la etiqueta del estanque",
  scanning: "Acerca el teléfono a la etiqueta",
  confirm: "",
  removing: "",
  done: "",
  error: "No se pudo eliminar",
};

const BODIES: Record<Step["kind"], string> = {
  idle: "Párate junto al estanque que quieres eliminar y escanea su etiqueta para confirmar que es el correcto.",
  scanning: "Mantén la parte trasera del teléfono sobre la tarjeta o llavero hasta que se detecte.",
  confirm:
    "Dejará de aparecer en el mapa y su dispensador quedará desvinculado. El historial de retiros se conserva. No se puede deshacer desde la app.",
  removing: "Eliminando…",
  done: "",
  error: "Revisa el mensaje y vuelve a intentarlo.",
};

function ScanVisual({ active, danger }: { active: boolean; danger: boolean }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = active ? withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1) : 0;
  }, [active, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: active ? 1 - pulse.value : 0,
    transform: [{ scale: 1 + pulse.value * 0.55 }],
  }));

  const tint = danger ? colors.danger : colors.primary;
  return (
    <View style={styles.visual}>
      <Animated.View style={[styles.ring, { borderColor: tint }, ring]} />
      <View style={[styles.visualInner, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
        <Icon name={danger ? "trash" : "nfc"} size={44} color={tint} />
      </View>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} selectable>
        {value}
      </Text>
    </View>
  );
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
  visual: { alignItems: "center", justifyContent: "center", height: 180, marginTop: 8 },
  ring: { position: "absolute", width: 132, height: 132, borderRadius: 66, borderWidth: 2 },
  visualInner: { width: 132, height: 132, borderRadius: 66, alignItems: "center", justifyContent: "center" },
  stepper: { flexDirection: "row", justifyContent: "center", gap: 28 },
  stage: { alignItems: "center", gap: 6 },
  stageDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stageLabel: { fontSize: 12, color: colors.subtle, fontWeight: "500" },
  stageLabelOn: { color: colors.text },
  copy: { gap: 8, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center", letterSpacing: -0.2 },
  body: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 21, maxWidth: 320 },
  actions: { marginTop: "auto", gap: 8 },
  card: { backgroundColor: colors.surfaceMuted, borderRadius: radius.xl, padding: 20, gap: 14 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  cardIcon: { width: 56, height: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  cardHeadText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  cardSub: { fontSize: 14, color: colors.muted },
  cardBody: { fontSize: 14, color: colors.text, lineHeight: 20 },
  field: { gap: 2 },
  fieldLabel: { fontSize: 12, color: colors.muted },
  fieldValue: { fontSize: 15, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
});
