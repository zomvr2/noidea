# Protocolo del dispositivo v2 (ESP32 ↔ nube)

Referencia: sección «Protocolo del dispositivo» de [`packages/shared/src/index.ts`](../packages/shared/src/index.ts).
Implementaciones: firmware [`firmware/noidea_esp32/`](../firmware/noidea_esp32/), simulador
[`api/scripts/device-simulator.ts`](../api/scripts/device-simulator.ts), API [`api/src/routes/device.ts`](../api/src/routes/device.ts).

## Identidad y firmas

Cada ESP32 tiene una fila en `public.devices`: `id` (UUID) y `secret` (32 bytes en hex, solo legible con la clave
secreta). Se graban en `firmware/noidea_esp32/secrets.h`.

- **Firma:** `HMAC-SHA256(secret, mensaje)` en hex minúscula.
- **Hora:** el ESP32 sincroniza por NTP. Órdenes y peticiones con más de **30 s** de diferencia se rechazan.
- El secreto nunca viaja por la red, por eso TLS puede ir sin validar certificado en el prototipo
  (**PENDIENTE:** fijar certificados raíz).

## Nube → ESP32: órdenes (Supabase Realtime Broadcast)

- WebSocket: `wss://<ref>.supabase.co/realtime/v1/websocket?apikey=<clave pública>&vsn=1.0.0`
- Canal: `realtime:device:<deviceId>` (en el envío REST el topic es `device:<deviceId>`), evento `cmd`, canal público.
- Heartbeat Phoenix cada 25 s + ping/pong WebSocket cada 5 s.

| Orden | Payload | Texto firmado |
|---|---|---|
| Abrir | `{cmd:"OPEN", id, ms, ts, sig}` | `OPEN|id|ms|ts` |
| Cerrar | `{cmd:"STOP", id, ts, sig}` | `STOP|id|ts` |
| Pantalla | `{cmd:"LCD", row, text, ts, sig}` | `LCD|row|text|ts` |

Reglas del ESP32: descarta firma inválida u orden vencida; ignora un `OPEN` cuyo `id` no sea mayor que el último
ejecutado (guardado en NVS; comando serie `reset-id` tras reiniciar la base de datos).

## ESP32 → nube: HTTPS a la API

Cabeceras: `X-Device-Id`, `X-Timestamp` (segundos Unix), `X-Signature = HMAC(secret, "<ts>\n<body>")`.

### `POST /api/device/telemetry` (cada 10 s y ~4 s después de cada cierre)

```json
{ "fw": "0.2.0", "proto": 2, "distanceMm": 212, "error": null, "backupRaw": 2600, "backupLow": false, "rssi": -61 }
```

`distanceMm: null` + `error: "NO_ECHO"` si el HC-SR04 no respondió. `backupRaw` es el ADC de 12 bits (0–4095).

### `POST /api/device/events`

| Evento | Cuándo |
|---|---|
| `{type:"ACK", cmd:"OPEN"\|"STOP", id}` | Orden aceptada |
| `{type:"NAK", cmd, id, reason}` | Rechazada: `BUSY`, `BAD_ARGS`, `MAX_MS`, `LOW_LEVEL`, `NOT_ACTIVE` |
| `{type:"RUN", id, elapsedMs}` | Cada 2 s con la válvula abierta |
| `{type:"DONE", id, openMs, reason}` | Al cerrar: `TARGET`, `STOP`, `LINK_LOST`, `LOW_LEVEL`, `MAX_MS` |

Respuestas: `204` ok; `401` firma/hora inválida; `409 PROTOCOL_MISMATCH` si `proto` no coincide.

## Seguridad local del firmware

La válvula se cierra sin esperar a la nube cuando: se cumple `ms` (`TARGET`), llega `STOP`, el canal Realtime
lleva **3 s** caído o el Wi-Fi se pierde (`LINK_LOST`), el sensor de respaldo indica fondo seco (`LOW_LEVEL`) o se
alcanza **60 s** (`MAX_MS`). Al arrancar: servo cerrado y relé apagado.

Limitación conocida: un enlace "zombi" (TCP abierto sin tráfico) se detecta por ping/pong en ~7 s.
