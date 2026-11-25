import { TANK_COLUMNS, type Tank, type TankRow, toTank } from "@noidea/shared";
import { createContext, type ReactNode, use, useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";

interface TanksState {
  tanks: Tank[];
  error: string | null;
  loaded: boolean;
  /** Reloj compartido (cada 10 s) para que «sin conexión» se actualice sin nueva telemetría. */
  now: number;
  /** true mientras el canal Realtime está suscrito (indicador «En vivo»). */
  connected: boolean;
  reload: () => Promise<void>;
}

const TanksContext = createContext<TanksState | null>(null);

/**
 * Estanques con su ubicación y nivel, actualizados en tiempo real
 * (Supabase Realtime sobre la tabla tanks; RLS: cualquier usuario autenticado).
 * Un único canal compartido por mapa, lista y detalle.
 */
export function TanksProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [connected, setConnected] = useState(false);

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("tanks")
      .select(TANK_COLUMNS)
      .is("deleted_at", null)
      .order("id")
      .returns<TankRow[]>();
    if (err) setError("No se pudieron cargar los estanques. Revisa tu conexión.");
    else {
      setTanks(data.map(toTank));
      setError(null);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();

    // El reloj solo corre con la app en primer plano: en segundo plano no hay nada que pintar
    // y cada tic re-renderiza todas las pantallas. Al volver se recarga, porque Realtime no
    // reenvía los cambios que ocurrieron mientras el socket estaba suspendido.
    let timer: ReturnType<typeof setInterval> | undefined;
    const startClock = () => {
      setNow(Date.now());
      timer ??= setInterval(() => setNow(Date.now()), 10_000);
    };
    const stopClock = () => {
      clearInterval(timer);
      timer = undefined;
    };
    let wasActive = AppState.currentState === "active";
    if (wasActive) startClock();
    const appState = AppState.addEventListener("change", (s) => {
      const active = s === "active";
      if (active && !wasActive) {
        startClock();
        void reload();
      } else if (!active) stopClock();
      wasActive = active;
    });

    const channel = supabase
      .channel("tanks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tanks" }, (change) => {
        // Borrado lógico (admin eliminó el estanque): llega como UPDATE con deleted_at.
        const removedId =
          change.eventType === "DELETE"
            ? (change.old as { id?: number }).id
            : (change.new as { deleted_at?: string | null }).deleted_at
              ? (change.new as TankRow).id
              : undefined;
        if (removedId !== undefined) {
          setTanks((prev) => prev.filter((t) => t.id !== removedId));
          return;
        }
        const updated = toTank(change.new as TankRow);
        setTanks((prev) => {
          const i = prev.findIndex((t) => t.id === updated.id);
          if (i === -1) return [...prev, updated];
          const next = [...prev];
          next[i] = updated;
          return next;
        });
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      stopClock();
      appState.remove();
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [enabled, reload]);

  return <TanksContext value={{ tanks, error, loaded, now, connected, reload }}>{children}</TanksContext>;
}

export function useTanks(): TanksState {
  const ctx = use(TanksContext);
  if (!ctx) throw new Error("useTanks debe usarse dentro de <TanksProvider>");
  return ctx;
}
