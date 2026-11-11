import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/**
 * Cliente de Supabase de la app: sesión (Auth), lecturas con RLS y Realtime.
 * Toda escritura de negocio pasa por la API en Vercel (src/lib/api.ts).
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresca el token solo con la app en primer plano.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
