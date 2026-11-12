import { type FamilyStatus, QUOTA_COLUMNS, type QuotaBalance, type QuotaRow, toQuotaBalance } from "@noidea/shared";
import { createContext, type ReactNode, use, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface FamilyInfo {
  name: string;
  sector: string;
  status: FamilyStatus;
}

interface QuotaState {
  /** null si el usuario no pertenece a una familia (p. ej. admin). */
  familyId: number | null;
  family: FamilyInfo | null;
  /** Cuota del período vigente; null si no hay. */
  quota: QuotaBalance | null;
  loaded: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const QuotaContext = createContext<QuotaState | null>(null);

/**
 * Cuota familiar del período vigente (lectura con RLS: solo la propia familia).
 * `quotas` no está en Realtime: se recarga cuando cambia un retiro de la familia,
 * que es lo único que mueve `used_l` / `reserved_l`.
 */
export function QuotaProvider({ familyId, children }: { familyId: number | null; children: ReactNode }) {
  const [family, setFamily] = useState<FamilyInfo | null>(null);
  const [quota, setQuota] = useState<QuotaBalance | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (familyId === null) return;
    const nowIso = new Date().toISOString();
    const [q, f] = await Promise.all([
      supabase
        .from("quotas")
        .select(QUOTA_COLUMNS)
        .eq("family_id", familyId)
        .lte("period_start", nowIso)
        .gt("period_end", nowIso)
        .returns<QuotaRow[]>()
        .maybeSingle(),
      supabase.from("families").select("name, sector, status").eq("id", familyId).maybeSingle(),
    ]);
    if (q.error || f.error) setError("No se pudo cargar la cuota.");
    else {
      setQuota(q.data ? toQuotaBalance(q.data) : null);
      setFamily(f.data ? { name: f.data.name, sector: f.data.sector, status: f.data.status as FamilyStatus } : null);
      setError(null);
    }
    setLoaded(true);
  }, [familyId]);

  useEffect(() => {
    setQuota(null);
    setFamily(null);
    setLoaded(false);
    if (familyId === null) return;
    void reload();
    const channel = supabase
      .channel(`quota-${familyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawals", filter: `family_id=eq.${familyId}` },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [familyId, reload]);

  return <QuotaContext value={{ familyId, family, quota, loaded, error, reload }}>{children}</QuotaContext>;
}

export function useQuota(): QuotaState {
  const ctx = use(QuotaContext);
  if (!ctx) throw new Error("useQuota debe usarse dentro de <QuotaProvider>");
  return ctx;
}
