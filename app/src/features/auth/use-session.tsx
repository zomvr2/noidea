import type { Profile, Role } from "@noidea/shared";
import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface SessionState {
  session: Session | null;
  profile: Profile | null;
  /** true hasta conocer si hay sesión guardada. */
  loading: boolean;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * Sesión de Supabase Auth + perfil (rol y familia) leído con RLS.
 * Un solo proveedor en la raíz: todas las pantallas comparten el mismo estado.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let active = true;
    supabase
      .from("profiles")
      .select("id, full_name, role, family_id")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!active) return;
        setProfile(
          data ? { id: data.id, fullName: data.full_name, role: data.role as Role, familyId: data.family_id } : null,
        );
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return <SessionContext value={{ session, profile, loading }}>{children}</SessionContext>;
}

export function useSession(): SessionState {
  const ctx = use(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
