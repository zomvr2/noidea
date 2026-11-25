# Recargas por camión aljibe (diseño — Hito 6)

Estado: **implementado en base de datos, API y app**, sin probar en dispositivo ni contra Supabase real.
- SQL: `supabase/migrations/20261112000000_refills.sql` · API: `api/src/routes/refills.ts` ([api.md](api.md))
- App: pestaña `app/src/app/(tabs)/refills.tsx` (admin/municipal), `app/src/features/refills/`
  (chip, estado en tiempo real, envío de posición), camión en `features/map/tank-map.tsx`.
- Pendiente: simulador; envío de posición con la app en segundo plano.

## Idea

El mapa funciona como un despacho de recargas, al estilo de una app de transporte:

1. Un estanque con poca agua **pide recarga solo**.
2. Un municipal ve la solicitud en el mapa y la **toma**.
3. Los ciudadanos de ese estanque ven que **hay un municipal en camino**.
4. Al llegar, el municipal **escanea la etiqueta NFC** del estanque y la entrega se **verifica por la subida de nivel**.

Para el prototipo, el rol `municipal` coordina y conduce (una sola persona). Un rol `driver` separado se podría
agregar después sumando un valor al `check` de `profiles.role` y a `Role` en `packages/shared`.

## Flujo

```
nivel < umbral ──> requested ──"Tomar"──> scheduled ──"Salir"──> in_transit ──NFC + nivel──> delivered
                       │                      │                       │
                       └──────────────── cancelled (municipal/admin) ─┘
                                              └── "Soltar": vuelve a requested (p. ej. camión averiado)
```

### 1. Solicitud automática

- `record_level` crea una `refill_request` en `requested` cuando el nivel baja del umbral
  (por defecto 25 %, configurable por estanque) y **no** hay otra solicitud abierta para ese estanque.
- La API calcula la **prioridad** con:
  - horas estimadas hasta vaciarse (consumo reciente en `level_readings`);
  - número de familias que dependen del estanque.
- La UI muestra "≈ se vacía en 6 h". El nivel es estimado (HC-SR04), siempre con "≈".
- Un admin o municipal también puede crear una solicitud a mano.

### 2. Tomar el pedido

- Vista para municipal: pines por urgencia en el mapa y lista ordenada por prioridad.
  Cada solicitud muestra nivel ≈, capacidad libre (≈ cuánto cabe) y distancia desde el teléfono.
- "Tomar recarga" → `POST /refills/:id/claim` → `claim_refill` (SQL, `FOR UPDATE`).
  Si otro ya la tomó: `REFILL_TAKEN`. Un municipal solo puede tener una recarga activa a la vez.

### 3. En camino

- "Salir" → `POST /refills/:id/start` → `in_transit`.
- El teléfono del municipal envía su GPS cada ~10 s a `POST /refills/:id/position`. Se guarda solo la última
  posición en la fila (`last_latitude`, `last_longitude`, `eta_s`) y la app la recibe por Realtime
  (`postgres_changes` de `refill_requests`, que respeta RLS). No se guarda el recorrido.
- ETA aproximada = distancia en línea recta × 1,3 / 30 km/h (`refillEtaSeconds`). Se muestra como "≈ 15 min".

### 4. Entrega verificable

- Al llegar, el municipal escanea la etiqueta NFC → `POST /refills/:id/arrive` con el UID leído y su GPS.
  La API valida que el UID corresponda al estanque (`NOT_AT_TANK` si no) y guarda `level_before_l`.
- Tras recargar, "Terminé" → `POST /refills/:id/deliver`. Se guarda el nivel actual como `level_after_l` y,
  durante el minuto siguiente, `record_level` se queda con el nivel más alto (el agua se asienta). Se calcula `delivered_estimated_l = level_after_l − level_before_l`, con
  `measurement_method = 'estimated_level'`. La UI muestra **"≈ X L entregados (estimado por nivel)"**.
- La solicitud pasa a `delivered` y se resuelve la alerta `critical_level` del estanque.

## Lo que ven los ciudadanos (familias)

Mientras haya una recarga activa en un estanque, la app de las familias muestra un **chip de estado**
en la tarjeta del estanque, en su detalle y sobre el pin del mapa:

| Estado | Chip | Detalle |
|---|---|---|
| `requested` | "Recarga solicitada" (neutro) | Sin municipal asignado todavía |
| `scheduled` | "Municipal asignado" (primario) | Nombre visible del municipal (ej. "Municipal · Juan P.") |
| `in_transit` | "Municipal en camino · ≈ 15 min" (primario, con `PulseDot`) | En el mapa aparece el camión moviéndose |
| `delivered` | "Recargado · ≈ X L" (éxito) | Se oculta a las 2 h |

- El chip es informativo (no es un filtro): se implementa como una variante de solo lectura junto a
  `components/chip.tsx` o reutilizando `live-badge.tsx` para el estado `in_transit`.
- Los datos llegan por Realtime de `refill_requests` (estado, posición y ETA). Mientras `arrived_at` tiene
  valor y no se entrega, el chip dice "Municipal recargando". La familia **no** ve el teléfono ni la ubicación exacta del municipal cuando no está en camino.
- Opcional: notificación push "Un municipal va en camino a tu estanque".

## En la app

- **Familias:** `RefillChip` en la tarjeta del mapa, la lista de estanques y el detalle; el camión aparece en el
  mapa con "Municipal · ≈ N min".
- **Admin/municipal:** pestaña **Recargas** con secciones *Mi recarga*, *Por atender* (por prioridad), *En curso*
  y *Últimas 24 h*. Botones según el estado: Tomar recarga → Salir hacia el estanque → Llegué · escanear
  etiqueta → Terminé la recarga, además de Soltar y Cancelar. En el detalle de un estanque: «Solicitar recarga».
- `RefillTracker` envía la posición cada ~10 s mientras la recarga propia va en camino. **PENDIENTE:** solo con
  la app en primer plano (en segundo plano requiere permiso de ubicación de fondo y `expo-task-manager`).

## Otras acciones del municipal

- Ver y gestionar alertas (`acknowledged` / `resolved`).
- Panel comunitario: litros entregados por semana, estanques críticos, tiempo medio de respuesta.
- Historial de recargas por estanque.
- **Modo escasez**: pedir a la API reducir cuotas temporalmente (regla en API/SQL, nunca en la app).
- Cancelar o soltar una recarga.

**Privacidad:** el municipal ve agregados por estanque, no los retiros de cada familia (RLS actual).

## Cambios previstos

| Capa | Cambio |
|---|---|
| Migración | `refill_requests`: `source`, `assigned_to`, `assigned_name`, `accepted_at`, `departed_at`, `arrived_at`, `delivered_at`, `level_before_l`, `level_after_l`, `delivered_estimated_l`, `measurement_method`, `last_latitude`, `last_longitude`, `last_position_at`, `eta_s`, `cancelled_at`. `tanks.refill_threshold_percent`. Funciones `request_refill`, `claim_refill`, `release_refill`, `start_refill`, `update_refill_position`, `arrive_refill`, `confirm_refill_delivery`, `cancel_refill`; autogeneración en `record_level`. RLS: el resto de usuarios lee las abiertas y las entregadas hace < 2 h (`notes` es visible: sin datos personales). |
| Shared | Tipos `RefillRequest`, `RefillStatus`, contratos de las rutas y del Broadcast de posición. |
| API | Rutas `/refills` (listar, crear, claim, release, start, position, arrive, deliver, cancel) con zod; errores `REFILL_TAKEN`, `REFILL_ALREADY_ACTIVE`, `REFILL_ALREADY_OPEN`, `NOT_ASSIGNED`, `NOT_AT_TANK`, `INVALID_REFILL_STATE`. La prioridad se calcula al listar (no se guarda). |
| App | Pestaña "Recargas" (municipal); capa de camión y ETA en `tank-map`; chip de estado de recarga para familias. |
| Simulador | El estanque simulado se vacía con el tiempo y sube al confirmar una recarga. |

## Pendiente / limitaciones

- El volumen entregado es **estimado por diferencia de nivel**, no medido por caudalímetro.
- La ETA es aproximada (línea recta), sin rutas reales.
- Las pruebas de terreno con camión real quedan fuera del prototipo.
