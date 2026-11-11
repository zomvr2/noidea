/**
 * Configuración pública de la app (app/.env.local, ver .env.example).
 * Solo claves públicas: la clave secreta de Supabase vive únicamente en Vercel.
 */
const required = (name: string, value: string | undefined) => {
  if (!value) throw new Error(`Falta ${name} en app/.env.local`);
  return value.replace(/\/$/, "");
};

export const SUPABASE_URL = required("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL);
export const SUPABASE_PUBLISHABLE_KEY = required(
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
export const API_URL = required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL);

/** Estilo base del mapa: OpenFreeMap (gratuito, sin clave). Atribución: OpenFreeMap © OpenMapTiles, datos © OpenStreetMap. */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
