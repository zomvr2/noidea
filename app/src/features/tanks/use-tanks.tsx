import { TANK_COLUMNS, type Tank, type TankRow, toTank } from "@noidea/shared";
import { createContext, type ReactNode, use, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface TanksState {
  tanks: Tank[];
  error: string | null;
  loaded: boolean;
  /** Reloj compartido (cada 10 s) para que «sin conexión» se actualice sin nueva telemetría. */
  now: number;
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

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase.from("tanks").select(TANK_COLUMNS).order("id").returns<TankRow[]>();
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
    const channel = supabase
      .channel("tanks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tanks" }, (change) => {
        if (change.eventType === "DELETE") {
          const oldId = (change.old as { id?: number }).id;
          setTanks((prev) => prev.filter((t) => t.id !== oldId));
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
      .subscribe();
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [enabled, reload]);

  return <TanksContext value={{ tanks, error, loaded, now, reload }}>{children}</TanksContext>;
}

export function useTanks(): TanksState {
  const ctx = use(TanksContext);
  if (!ctx) throw new Error("useTanks debe usarse dentro de <TanksProvider>");
  return ctx;
}
