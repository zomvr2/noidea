import type { RefillListItem } from "@noidea/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useRefills } from "./use-refills";

/**
 * Lista priorizada de recargas (GET /api/refills, admin/municipal). La prioridad la calcula la API;
 * se vuelve a pedir cuando Realtime avisa un cambio (con un pequeño retardo para agrupar ráfagas,
 * p. ej. las posiciones cada 10 s).
 */
export function useRefillList(enabled: boolean) {
  const { version } = useRefills();
  const [items, setItems] = useState<RefillListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const reload = useCallback(async () => {
    try {
      const res = await api.listRefills();
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las recargas.");
    } finally {
      setLoaded(true);
      loadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void reload(), loadedRef.current ? 600 : 0);
    return () => clearTimeout(timer.current);
  }, [enabled, version, reload]);

  return { items, error, loaded, reload };
}
