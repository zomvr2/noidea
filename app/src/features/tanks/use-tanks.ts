import { TANK_COLUMNS, type Tank, type TankRow, toTank } from "@noidea/shared";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Estanques con su ubicación y nivel, actualizados en tiempo real
 * (Supabase Realtime sobre la tabla tanks; RLS: cualquier usuario autenticado).
 */
export function useTanks(enabled: boolean) {
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("tanks").select(TANK_COLUMNS).order("id").returns<TankRow[]>();
    if (err) setError(err.message);
    else {
      setTanks(data.map(toTank));
      setError(null);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const channel = supabase
      .channel("tanks-map")
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
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, load]);

  return { tanks, error, loaded, reload: load };
}
