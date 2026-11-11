import { REALTIME_PATH, type ServerEvent } from "@noidea/shared";
import { useEffect, useRef, useState } from "react";
import { WS_URL } from "./config";

const RETRY_MS = 3000;

/**
 * Mantiene un WebSocket con el servidor y entrega cada evento a `onEvent`.
 * Se reconecta solo. Devuelve si está conectado.
 */
export function useRealtime(onEvent: (event: ServerEvent) => void): boolean {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(`${WS_URL}${REALTIME_PATH}`);
      socket.onopen = () => setConnected(true);
      socket.onmessage = (e) => {
        try {
          handler.current(JSON.parse(String(e.data)) as ServerEvent);
        } catch {
          // mensaje inválido: se ignora
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, RETRY_MS);
      };
    };
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return connected;
}
