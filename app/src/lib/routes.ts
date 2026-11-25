import type { Href } from "expo-router";

/**
 * Pestaña del mapa (`app/(tabs)/index.tsx`). La ruta índice de un grupo se resuelve con la ruta vacía «/»;
 * `"/(tabs)/index"` pasa el chequeo de tipos pero en ejecución da «Unmatched route».
 * Los tipos generados por typedRoutes no incluyen «/», de ahí el cast.
 */
export const MAP_HREF = "/" as Href;
