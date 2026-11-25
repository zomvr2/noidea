import { OPEN_REFILL_STATUSES, type RefillRequest } from "@noidea/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { Button } from "@/components/button";
import { api } from "@/lib/api";

/**
 * Admin/municipal en el detalle de un estanque: solicita una recarga manual o,
 * si ya hay una abierta, lleva a la pestaña Recargas.
 */
export function RequestRefillButton({ tankId, refill }: { tankId: number; refill: RefillRequest | null }) {
  const [busy, setBusy] = useState(false);
  const open = refill && OPEN_REFILL_STATUSES.includes(refill.status);

  if (open) {
    return <Button label="Ver en Recargas" icon="truck" variant="secondary" onPress={() => router.navigate("/(tabs)/refills")} />;
  }

  const request = async () => {
    setBusy(true);
    try {
      await api.requestRefill({ tankId });
      router.navigate("/(tabs)/refills");
    } catch (e) {
      Alert.alert("No se pudo solicitar", e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  return <Button label="Solicitar recarga" icon="truck" variant="secondary" loading={busy} onPress={request} />;
}
