import type { Profile, Role } from "@noidea/shared";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Sesión de Supabase Auth + perfil (rol y familia) leído con RLS. */
export function useSession() {
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

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("id, full_name, role, family_id")
      .eq("id", userId)
      .single()
      .then(({ data }) =>
        setProfile(
          data
            ? { id: data.id, fullName: data.full_name, role: data.role as Role, familyId: data.family_id }
            : null,
        ),
      );
  }, [session?.user.id]);

  return { session, profile, loading };
}
