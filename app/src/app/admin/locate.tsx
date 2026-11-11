import type { Tank } from "@noidea/shared";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { cancelTagRead, readTagUid } from "@/features/nfc/read-tag-uid";
import { ApiError, api } from "@/lib/api";
import { colors } from "@/theme";

type Step =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "locating"; tagUid: string }
  | { kind: "needsName"; tagUid: string; coords: Coords }
  | { kind: "saving" }
  | { kind: "done"; tank: Tank }
  | { kind: "error"; message: string };

interface Coords {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}

/** Peor precisión aceptada para marcar un estanque. */
const MAX_ACCURACY_M = 50;

/**
 * Solo administradores: escanear la etiqueta NFC del estanque estando junto a él;
 * se guarda la ubicación GPS del teléfono como ubicación del estanque.
 */
export default function LocateTank() {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [name, setName] = useState("");

  useEffect(() => cancelTagRead, []);

  const save = async (tagUid: string, coords: Coords, newName?: string) => {
    setStep({ kind: "saving" });
    try {
      const tank = await api.locateTank({ tagUid, ...coords, name: newName });
      setStep({ kind: "done", tank });
    } catch (e) {
      if (e instanceof ApiError && e.code === "TAG_UNKNOWN") setStep({ kind: "needsName", tagUid, coords });
      else setStep({ kind: "error", message: e instanceof Error ? e.message : "Error desconocido" });
    }
  };

  const start = async () => {
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
      setStep({ kind: "error", message: e instanceof Error ? e.message : "Error desconocido" });
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.help}>
        Párate junto al estanque, toca «Escanear» y acerca el teléfono a su etiqueta NFC. Se guardará la ubicación GPS
        actual como ubicación del estanque.
      </Text>

      {(step.kind === "scanning" || step.kind === "locating" || step.kind === "saving") && (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text style={styles.status}>
            {step.kind === "scanning"
              ? "Acerca el teléfono a la etiqueta…"
              : step.kind === "locating"
                ? `Etiqueta ${step.tagUid}. Obteniendo GPS…`
                : "Guardando…"}
          </Text>
        </View>
      )}

      {step.kind === "needsName" && (
        <View style={styles.box}>
          <Text style={styles.status}>Etiqueta {step.tagUid} no registrada. Nombre del nuevo estanque:</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej: Estanque Sector Norte" />
          <Pressable
            style={styles.button}
            disabled={name.trim().length < 2}
            onPress={() => save(step.tagUid, step.coords, name.trim())}
          >
            <Text style={styles.buttonText}>Registrar estanque</Text>
          </Pressable>
        </View>
      )}

      {step.kind === "done" && (
        <View style={styles.box}>
          <Text style={styles.ok}>✓ Ubicación de «{step.tank.name}» guardada.</Text>
          {step.tank.location?.accuracyM != null && (
            <Text style={styles.status}>Precisión ±{Math.round(step.tank.location.accuracyM)} m</Text>
          )}
          <Pressable style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Ver en el mapa</Text>
          </Pressable>
        </View>
      )}

      {step.kind === "error" && <Text style={styles.error}>{step.message}</Text>}

      {(step.kind === "idle" || step.kind === "error" || step.kind === "done") && (
        <Pressable style={styles.button} onPress={start}>
          <Text style={styles.buttonText}>{step.kind === "idle" ? "Escanear" : "Escanear otro"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 16, backgroundColor: colors.background },
  help: { fontSize: 15, color: colors.text, lineHeight: 21 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  box: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 10 },
  status: { color: colors.muted, fontSize: 15 },
  ok: { color: colors.text, fontSize: 16, fontWeight: "600" },
  error: { color: colors.danger, fontSize: 15 },
  input: { borderWidth: 1, borderColor: colors.track, borderRadius: 10, padding: 12, fontSize: 16 },
  button: { backgroundColor: colors.water, borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
