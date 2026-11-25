# Modelo de datos (Supabase / Postgres)

Esquema: [`supabase/migrations/`](../supabase/migrations/). Datos de prueba: [`supabase/seed.sql`](../supabase/seed.sql).

| Tabla | Propósito | Campos clave | Lectura desde la app (RLS) |
|---|---|---|---|
| `profiles` | Perfil de cada usuario de Auth (se crea con trigger) | `role`, `family_id` | Propio; admin todos |
| `families` | Grupo familiar | `status` | Propia; admin/municipal |
| `quotas` | Cuota por período | `allocated_l`, `used_l`, `reserved_l` | Propia; admin |
| `tanks` | Estanque, calibración, **ubicación** y último nivel | `nfc_tag_uid`, `refill_threshold_percent`, `latitude`, `longitude`, `location_accuracy_m`, `level_*`, `device_last_seen_at`, `deleted_at` (borrado lógico; etiqueta única solo entre activos) | Todos los autenticados (la app filtra `deleted_at is null`) |
| `devices` | ESP32 de cada estanque | `id` (UUID), `secret`, `simulated` | Nadie (solo API) |
| `level_readings` | Historial de nivel (cada 30 s) | `distance_mm`, `volume_l`, `percent` | Todos los autenticados |
| `withdrawals` | Retiros | `target_ms`, `open_ms`, `progress_ms`, `delivered_l`, `level_delta_l`, `status` | Propios; admin |
| `alerts` | Alertas | `type`, `status` | Admin/municipal |
| `refill_requests` | Recargas por camión aljibe ([recargas.md](recargas.md)) | `status`, `source`, `assigned_to`, `assigned_name`, `level_before_l`, `level_after_l`, `delivered_estimated_l`, `last_latitude/longitude`, `eta_s` | Admin/municipal todas; el resto, abiertas y entregadas hace < 2 h |
| `audit_log` | Acciones administrativas | `action`, `payload` | Nadie (solo API) |

Realtime publica cambios de `tanks`, `withdrawals`, `alerts`, `refill_requests` (respetando RLS).

## Funciones de negocio (solo `service_role`)

| Función | Qué hace |
|---|---|
| `authorize_withdrawal(familia, estanque, litros, usuario)` | Valida familia aprobada, estanque disponible y en línea, nivel, sin retiro activo y saldo; **reserva** saldo |
| `start_withdrawal(id)` | `authorized → dispensing` al llegar el ACK |
| `finish_withdrawal(id, open_ms, motivo, litros)` | Libera reserva y descuenta lo entregado (estimado) |
| `reject_withdrawal(id, motivo)` | Libera reserva sin descontar (nunca se abrió) |
| `expire_stale_withdrawals()` | Limpia retiros abandonados (sin ACK 30 s / sin DONE) |
| `remove_tank(estanque, usuario)` | Borrado lógico de un estanque: revoca el dispositivo, cierra alertas/recargas; `TANK_BUSY` si hay retiro activo |
| `record_level(...)` | Nivel actual, historial, verificación cruzada, alertas críticas y **solicitud automática de recarga** bajo `refill_threshold_percent` |
| `request_refill`, `claim_refill`, `release_refill`, `start_refill` | Solicitud manual, tomar (con `FOR UPDATE`: una persona por recarga, una recarga activa por persona), soltar, salir |
| `update_refill_position`, `arrive_refill`, `confirm_refill_delivery`, `cancel_refill` | Posición en camino, llegada (guarda nivel antes), entrega (≈ subida de nivel, resuelve alerta crítica), cancelación |

Errores: `RAISE EXCEPTION '<CODIGO>'` (`INSUFFICIENT_BALANCE`, `DEVICE_OFFLINE`, `TANK_BUSY`, …).

## Reglas de saldo

- `disponible = allocated_l − used_l − reserved_l` del período vigente.
- Autorizar: `reserved_l += solicitado` (misma transacción que la verificación, con `FOR UPDATE`).
- Terminar: `reserved_l −= solicitado`, `used_l += entregado` (entregado ≤ solicitado).

## Estados de un retiro

```
authorized ──ACK──> dispensing ──DONE TARGET/STOP──> completed
     │                   └──DONE LINK_LOST/LOW_LEVEL/MAX_MS, o sin DONE──> failed (descuenta lo estimado)
     └──NAK / sin ACK / envío fallido──> failed (sin descuento)
```

## Estados de una recarga

`requested → scheduled → in_transit (→ arrived_at) → delivered`, o `cancelled` antes de `delivered`.
`release_refill` devuelve una recarga tomada a `requested`. Hay a lo más una abierta por estanque.
