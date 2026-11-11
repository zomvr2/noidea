# Arquitectura

## Componentes

| Componente | Dónde corre | Responsabilidad |
|---|---|---|
| App (`app/`) | Teléfono (Android; development build) | Login, mapa de estanques, NFC + GPS, retiros |
| API (`api/`) | Vercel (funciones Node 24, Fluid compute) | Reglas de negocio, órdenes al ESP32, telemetría |
| Supabase | Nube | Postgres + RLS, Auth, Realtime |
| Dispensador (`firmware/noidea_esp32`) | ESP32 DevKit por Wi-Fi | Sensores, servo-válvula, LCD, seguridad local |

### Por qué este reparto

- **Vercel no mantiene conexiones abiertas** (sin WebSocket propio ni procesos permanentes). Por eso el tiempo real
  lo da **Supabase Realtime**: la app escucha cambios de tablas y el ESP32 escucha órdenes en un canal Broadcast.
- **El ESP32 tiene Wi-Fi**: habla directo con la nube; ya no hace falta un PC con puerto USB.
- **La lógica de saldo es transaccional en Postgres** (`authorize_withdrawal`, `finish_withdrawal`, …) para que dos
  peticiones simultáneas no gasten dos veces el mismo saldo. La API valida, autoriza y orquesta.

### Quién usa qué clave

| Actor | Credencial | Acceso |
|---|---|---|
| App | Clave pública + JWT del usuario | Lecturas con RLS, Realtime de tablas, API con `Authorization: Bearer` |
| API | Clave secreta (solo en Vercel) | Todo; ejecuta funciones de negocio |
| ESP32 | Clave pública (solo Realtime) + secreto propio | Recibe órdenes firmadas; firma sus peticiones a la API |

## Flujo: ubicar un estanque (admin)

1. El admin abre «Ubicar estanque», se para junto al estanque y escanea su etiqueta NFC.
2. La app obtiene el GPS (precisión máxima; rechaza > 50 m) y llama `POST /api/tanks/locate`.
3. La API guarda `latitude`, `longitude`, `location_accuracy_m`, quién y cuándo. Si la etiqueta no existe, pide un
   nombre y crea el estanque con calibración por defecto.
4. Realtime actualiza el mapa de todos los usuarios.

## Flujo: retiro de agua

```
App            API (Vercel)                     Supabase                        ESP32
 | NFC tagUid    |                                 |                               |
 |-POST /withdrawals->| rpc authorize_withdrawal -->| reserva saldo (transacción)  |
 |               |-- Broadcast OPEN firmado ------>|------ canal device:<id> ----->| verifica HMAC, ts, id
 |               |                                 |<----- POST /device/events ACK-| servo abre
 |               |<-- (espera ACK hasta 8 s) ------| start_withdrawal              |
 |<-- 201 dispensing                               |<----- RUN cada 2 s -----------|
 |<== Realtime: withdrawals.progress_ms ===========|                               |
 |               |                                 |<----- DONE ms=... r=TARGET ---| servo cierra
 |               |  entregado ≈ ms × caudal        | finish_withdrawal: descuenta  |
 |<== Realtime: withdrawal completed ==============|                               |
```

- `target_ms = litros / caudal_calibrado × 1000`, tope 60 000 ms.
- Sin ACK en 8 s → `reject_withdrawal('NO_ACK')`. Un ACK tardío de un retiro ya rechazado provoca un STOP.
- `expire_stale_withdrawals()` (llamada desde la API) cierra retiros abandonados: `dispensing` sin DONE se cierra
  descontando lo solicitado (conservador) y genera alerta.
- El ESP32 cierra solo si el enlace Realtime cae 3 s (`LINK_LOST`).

## Flujo: monitoreo de nivel

1. El ESP32 envía `POST /api/device/telemetry` cada 10 s (distancia HC-SR04 + sensor de respaldo).
2. La API convierte distancia → litros con la calibración del estanque y llama `record_level`.
3. `record_level` actualiza el nivel actual del estanque, guarda historial cada 30 s, completa la verificación
   cruzada del último retiro y abre/resuelve alertas `critical_level` (histéresis de 5 puntos).
4. La app recibe el cambio de `tanks` por Realtime y recolorea el mapa.
5. Un estanque sin telemetría por 35 s se muestra «sin conexión».

## Mapa

MapLibre React Native 11 con el estilo **OpenFreeMap Liberty** (`https://tiles.openfreemap.org/styles/liberty`),
gratuito y sin clave. Cada estanque ubicado es un círculo coloreado por estado (azul ok, ámbar bajo, rojo crítico,
gris sin conexión), con un núcleo proporcional al nivel y etiqueta «nombre ≈ NN%». Atribución: OpenFreeMap
© OpenMapTiles, datos © colaboradores de OpenStreetMap (MapLibre muestra el botón de atribución).
