import type { DeviceStatus, ServerEvent, Tank } from "@noidea/shared";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

/** Lista de estanques con nivel actualizado en tiempo real. */
export function useTanks() {
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [device, setDevice] = useState<DeviceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [health, list] = await Promise.all([api.health(), api.tanks()]);
      setDevice(health.device);
      setTanks(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connected = useRealtime((event: ServerEvent) => {
    switch (event.type) {
      case "hello":
        setDevice(event.device);
        void load();
        break;
      case "device.status":
        setDevice(event.device);
        break;
      case "tank.level":
        setTanks((prev) => prev.map((t) => (t.id === event.tankId ? { ...t, level: event.level } : t)));
        break;
      case "tank.status":
        setTanks((prev) => prev.map((t) => (t.id === event.tankId ? { ...t, status: event.status } : t)));
        break;
    }
  });

  return { tanks, device, error, connected, reload: load };
}
