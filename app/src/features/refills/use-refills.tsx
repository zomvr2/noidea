import {
  OPEN_REFILL_STATUSES,
  REFILL_COLUMNS,
  type RefillRequest,
  type RefillRow,
  toRefill,
} from "@noidea/shared";
import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useTanks } from "@/features/tanks/use-tanks";
import { supabase } from "@/lib/supabase";

/** Cuánto tiempo sigue visible una recarga entregada (coincide con la política RLS). */
export const DELIVERED_VISIBLE_MS = 2 * 3_600_000;

interface RefillsState {
  /** Recargas visibles por RLS: abiertas y entregadas recientes (gestores ven además las antiguas). */
  refills: RefillRequest[];
  /** Recarga a mostrar por estanque: la abierta o, si no hay, la entregada hace < 2 h. */
  byTank: Map<number, RefillRequest>;
  /** Cambia con cada evento Realtime: la pestaña Recargas lo usa para volver a pedir la lista priorizada. */
  version: number;
  reload: () => Promise<void>;
}

const RefillsContext = createContext<RefillsState | null>(null);

function isOpen(r: RefillRequest) {
  return OPEN_REFILL_STATUSES.includes(r.status);
}

/**
 * Recargas por camión aljibe en tiempo real (postgres_changes de refill_requests, con RLS).
 * Lo usan las familias para el chip «Municipal en camino» y el mapa para dibujar el camión.
 */
export function RefillsProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [refills, setRefills] = useState<RefillRequest[]>([]);
  const [version, setVersion] = useState(0);

  const reload = useCallback(async () => {
    const since = new Date(Date.now() - DELIVERED_VISIBLE_MS).toISOString();
    const { data, error } = await supabase
      .from("refill_requests")
      .select(REFILL_COLUMNS)
      .or(`status.in.(${OPEN_REFILL_STATUSES.join(",")}),delivered_at.gt.${since}`)
      .order("created_at", { ascending: false })
      .returns<RefillRow[]>();
    if (!error) {
      setRefills(data.map(toRefill));
      setVersion((v) => v + 1);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();

    // Realtime no reenvía lo ocurrido con el socket suspendido: recargar al volver a primer plano.
    const appState = AppState.addEventListener("change", (s) => {
      if (s === "active") void reload();
    });

    const channel = supabase
      .channel("refills")
      .on("postgres_changes", { event: "*", schema: "public", table: "refill_requests" }, (change) => {
        if (change.eventType === "DELETE") {
          const id = (change.old as { id?: number }).id;
          setRefills((prev) => prev.filter((r) => r.id !== id));
        } else {
          const updated = toRefill(change.new as RefillRow);
          setRefills((prev) => {
            const i = prev.findIndex((r) => r.id === updated.id);
            if (i === -1) return [updated, ...prev];
            const next = [...prev];
            next[i] = updated;
            return next;
          });
        }
        setVersion((v) => v + 1);
      })
      .subscribe();
    return () => {
      appState.remove();
      void supabase.removeChannel(channel);
    };
  }, [enabled, reload]);

  // Reloj compartido de TanksProvider (cada 10 s): oculta las entregadas cuando pasan las 2 h.
  const { now } = useTanks();
  // Sin sesión no se muestra nada de la sesión anterior.
  const visible = useMemo(() => (enabled ? refills : []), [enabled, refills]);

  const byTank = useMemo(() => {
    const map = new Map<number, RefillRequest>();
    const cutoff = now - DELIVERED_VISIBLE_MS;
    for (const r of visible) {
      const current = map.get(r.tankId);
      if (isOpen(r)) {
        if (!current || !isOpen(current)) map.set(r.tankId, r);
      } else if (r.status === "delivered" && r.deliveredAt && Date.parse(r.deliveredAt) > cutoff) {
        if (!current || (!isOpen(current) && Date.parse(current.deliveredAt ?? "") < Date.parse(r.deliveredAt))) {
          map.set(r.tankId, r);
        }
      }
    }
    return map;
  }, [visible, now]);

  return <RefillsContext value={{ refills: visible, byTank, version, reload }}>{children}</RefillsContext>;
}

export function useRefills(): RefillsState {
  const ctx = use(RefillsContext);
  if (!ctx) throw new Error("useRefills debe usarse dentro de <RefillsProvider>");
  return ctx;
}

/** Recarga a mostrar para un estanque (o null). */
export function useTankRefill(tankId: number): RefillRequest | null {
  return useRefills().byTank.get(tankId) ?? null;
}
