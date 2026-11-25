import type { Tank } from "@noidea/shared";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { TextField } from "@/components/text-field";
import { cancelTagRead, readTagUid } from "@/features/nfc/read-tag-uid";
import { ApiError, api } from "@/lib/api";
import { MAP_HREF } from "@/lib/routes";
import { duration } from "@/lib/motion";
import { colors, radius } from "@/theme";

type Step =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "locating"; tagUid: string }
  | { kind: "needsName"; tagUid: string; coords: Coords }
  | { kind: "saving"; tagUid: string }
  | { kind: "done"; tank: Tank; tagUid: string }
  | { kind: "error"; message: string };

interface Coords {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}

/** Peor precisión aceptada para marcar un estanque. */
const MAX_ACCURACY_M = 50;

/** Etapas visibles del proceso (1 escanear → 2 GPS → 3 guardar). */
const STAGES: { icon: IconName; label: string }[] = [
  { icon: "nfc", label: "Etiqueta" },
  { icon: "gps", label: "GPS" },
  { icon: "check", label: "Guardar" },
];

function stageIndex(step: Step): number {
  switch (step.kind) {
    case "scanning":
      return 0;
    case "locating":
      return 1;
    case "needsName":
    case "saving":
      return 2;
    case "done":
      return 3;
    default:
      return -1;
  }
}

/**
 * Solo administradores: escanear la etiqueta NFC del estanque estando junto a él;
 * se guarda la ubicación GPS del teléfono como ubicación del estanque.
 */
export default function LocateTank() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [name, setName] = useState("");
  const cancelled = useRef(false);

  useEffect(() => cancelTagRead, []);

  const save = async (tagUid: string, coords: Coords, newName?: string) => {
    setStep({ kind: "saving", tagUid });
    try {
      const tank = await api.locateTank({ tagUid, ...coords, name: newName });
      setStep({ kind: "done", tank, tagUid });
    } catch (e) {
      if (e instanceof ApiError && e.code === "TAG_UNKNOWN") setStep({ kind: "needsName", tagUid, coords });
      else setStep({ kind: "error", message: e instanceof Error ? e.message : "Error desconocido" });
    }
  };

  const start = async () => {
    cancelled.current = false;
    setName("");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error("Se necesita permiso de ubicación para marcar el estanque.");

      setStep({ kind: "scanning" });
      const tagUid = await readTagUid();

      setStep({ kind: "locating", tagUid });
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const coords: Coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyM: pos.coords.accuracy ?? null,
      };
      if (coords.accuracyM !== null && coords.accuracyM > MAX_ACCURACY_M) {
        throw new Error(
          `GPS poco preciso (±${Math.round(coords.accuracyM)} m). Sal al exterior, espera unos segundos y reintenta.`,
        );
      }
      await save(tagUid, coords);
    } catch (e) {
      if (cancelled.current) setStep({ kind: "idle" });
      else setStep({ kind: "error", message: e instanceof Error ? e.message : "Error desconocido" });
    }
  };

  const cancelScan = () => {
    cancelled.current = true;
    cancelTagRead();
  };

  const busy = step.kind === "scanning" || step.kind === "locating" || step.kind === "saving";
  const current = stageIndex(step);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? 16 : insets.top + 12 }]}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Ubicar estanque
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

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {step.kind === "done" ? (
          <SuccessTicket tank={step.tank} tagUid={step.tagUid} />
        ) : (
          <>
            <ScanVisual active={busy} stage={current} />

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
                          backgroundColor: doneStage ? colors.success : active ? colors.primary : colors.surfaceMuted,
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
              <Text style={styles.title}>{TITLES[step.kind]}</Text>
              <Text style={styles.body}>
                {step.kind === "locating"
                  ? `Etiqueta ${step.tagUid}. Mantente quieto junto al estanque.`
                  : step.kind === "needsName"
                    ? `La etiqueta ${step.tagUid} no está registrada. Ponle un nombre para crear el estanque.`
                    : BODIES[step.kind]}
              </Text>
            </View>

            {step.kind === "needsName" && (
              <Animated.View entering={FadeInDown.duration(200)} style={styles.form}>
                <TextField
                  label="Nombre del estanque"
                  placeholder="Ej: Estanque Sector Norte"
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => name.trim().length >= 2 && save(step.tagUid, step.coords, name.trim())}
                />
                <Button
                  label="Registrar estanque"
                  disabled={name.trim().length < 2}
                  onPress={() => save(step.tagUid, step.coords, name.trim())}
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
          {step.kind === "done" && (
            <>
              <Button label="Ver en el mapa" onPress={() => router.dismissTo(MAP_HREF)} />
              <Button label="Ubicar otro estanque" variant="ghost" onPress={start} />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const TITLES: Record<Step["kind"], string> = {
  idle: "Escanea la etiqueta del estanque",
  scanning: "Acerca el teléfono a la etiqueta",
  locating: "Obteniendo ubicación GPS…",
  needsName: "Etiqueta nueva",
  saving: "Guardando ubicación…",
  done: "",
  error: "No se pudo ubicar",
};

const BODIES: Record<Step["kind"], string> = {
  idle: "Párate junto al estanque. Se guardará la ubicación GPS actual del teléfono como ubicación del estanque.",
  scanning: "Mantén la parte trasera del teléfono sobre la tarjeta o llavero hasta que se detecte.",
  locating: "",
  needsName: "",
  saving: "Un momento.",
  done: "",
  error: "Revisa el mensaje y vuelve a intentarlo.",
};

/** Círculo con icono NFC y ondas animadas mientras hay una operación en curso. */
function ScanVisual({ active, stage }: { active: boolean; stage: number }) {
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
        <Icon name={stage === 1 ? "gps" : "nfc"} size={44} color={colors.primary} />
      </View>
    </View>
  );
}

/** Confirmación con estilo de «ticket», como la pantalla de confirmación de la referencia. */
function SuccessTicket({ tank, tagUid }: { tank: Tank; tagUid: string }) {
  const loc = tank.location;
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.ticket}>
      <View style={styles.ticketHead}>
        <View style={styles.ticketIcon}>
          <Icon name="location" size={26} color={colors.accent} />
        </View>
        <View style={styles.ticketHeadText}>
          <Text style={styles.ticketTitle} numberOfLines={2}>
            {tank.name}
          </Text>
          <Text style={styles.ticketSub}>Ubicación guardada</Text>
        </View>
      </View>

      <View style={styles.ticketFields}>
        <Field label="Etiqueta" value={tagUid} />
        <Field label="Precisión" value={loc?.accuracyM != null ? `± ${Math.round(loc.accuracyM)} m` : "—"} />
        <Field label="Coordenadas" value={loc ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}` : "—"} wide />
      </View>

      {/* Muescas laterales y línea perforada del ticket */}
      <View style={styles.perforation}>
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={styles.dashes} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      <View style={styles.ticketFoot}>
        <Icon name="check" size={16} color={colors.success} />
        <Text style={styles.ticketFootText}>Visible para todos en el mapa de estanques.</Text>
      </View>
    </Animated.View>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.field, wide && styles.fieldWide]}>
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
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepper: { flexDirection: "row", justifyContent: "center", gap: 28 },
  stage: { alignItems: "center", gap: 6 },
  stageDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  stageLabel: { fontSize: 12, color: colors.subtle, fontWeight: "500" },
  stageLabelOn: { color: colors.text },
  copy: { gap: 8, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center", letterSpacing: -0.2 },
  body: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 21, maxWidth: 320 },
  form: { gap: 14 },
  actions: { marginTop: "auto", gap: 8 },

  ticket: { backgroundColor: colors.surfaceMuted, borderRadius: radius.xl, overflow: "hidden", marginTop: 8 },
  ticketHead: { flexDirection: "row", alignItems: "center", gap: 14, padding: 20 },
  ticketIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketHeadText: { flex: 1, gap: 2 },
  ticketTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  ticketSub: { fontSize: 14, color: colors.muted },
  ticketFields: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, rowGap: 14 },
  field: { width: "50%", gap: 2 },
  fieldWide: { width: "100%" },
  fieldLabel: { fontSize: 12, color: colors.muted },
  fieldValue: { fontSize: 15, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
  perforation: { flexDirection: "row", alignItems: "center", marginVertical: 18 },
  notch: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.background },
  notchLeft: { marginLeft: -12 },
  notchRight: { marginRight: -12 },
  dashes: { flex: 1, borderTopWidth: 1.5, borderColor: colors.border, borderStyle: "dashed", marginHorizontal: 8 },
  ticketFoot: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingBottom: 20 },
  ticketFootText: { flex: 1, fontSize: 14, color: colors.text },
});
