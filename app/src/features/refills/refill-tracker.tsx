import { REFILL_POSITION_INTERVAL_MS } from "@noidea/shared";
import * as Location from "expo-location";
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useRefills } from "./use-refills";

/**
 * Mientras el municipal va en camino (recarga suya en `in_transit` y aún sin llegar), envía la posición
 * del teléfono a la API cada ~10 s para que las familias vean el camión y la ETA.
 * Solo con la app en primer plano: el envío en segundo plano queda PENDIENTE (requiere permiso
 * de ubicación en segundo plano y una tarea con expo-task-manager).
 */
export function RefillTracker({ userId }: { userId: string | null }) {
  const { refills } = useRefills();
  const active = userId
    ? refills.find((r) => r.assignedTo === userId && r.status === "in_transit" && !r.arrivedAt)
    : undefined;
  const activeId = active?.id ?? null;
  const lastSent = useRef(0);

  useEffect(() => {
    if (activeId === null) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    void (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted || cancelled) return;
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: REFILL_POSITION_INTERVAL_MS,
          distanceInterval: 15,
        },
        (pos) => {
          // Android respeta timeInterval; iOS no: se limita aquí también.
          const now = Date.now();
          if (now - lastSent.current < REFILL_POSITION_INTERVAL_MS - 500) return;
          lastSent.current = now;
          api
            .sendRefillPosition(activeId, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracyM: pos.coords.accuracy ?? null,
            })
            .catch(() => undefined); // un envío perdido se corrige con el siguiente
        },
      );
      if (cancelled) sub.remove();
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [activeId]);

  return null;
}
