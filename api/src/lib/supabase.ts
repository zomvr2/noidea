import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

let admin: SupabaseClient | null = null;

/** Cliente con clave secreta: ignora RLS. Solo se usa dentro de la API. */
export function db(): SupabaseClient {
  if (!admin) {
    const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env();
    admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
