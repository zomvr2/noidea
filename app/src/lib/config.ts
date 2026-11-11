/**
 * URL del servidor local (PC). Se define en app/.env.local:
 *   EXPO_PUBLIC_SERVER_URL=http://192.168.1.50:3000
 * El servidor imprime su IP al arrancar. Teléfono y PC deben estar en la misma red Wi-Fi.
 */
export const SERVER_URL = (process.env.EXPO_PUBLIC_SERVER_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const WS_URL = SERVER_URL.replace(/^http/, "ws");
