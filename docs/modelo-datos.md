# Modelo de datos (Supabase / Postgres)

Esquema: [`supabase/migrations/`](../supabase/migrations/). Datos de prueba: [`supabase/seed.sql`](../supabase/seed.sql).

| Tabla | Propósito | Campos clave | Lectura desde la app (RLS) |
|---|---|---|---|
| `profiles` | Perfil de cada usuario de Auth (se crea con trigger) | `role`, `family_id` | Propio; admin todos |
| `families` | Grupo familiar | `status` | Propia; admin/municipal |
| `quotas` | Cuota por período | `allocated_l`, `used_l`, `reserved_l` | Propia; admin |
| `tanks` | Estanque, calibración, **ubicación** y último nivel | `nfc_tag_uid`, `latitude`, `longitude`, `location_accuracy_m`, `level_*`, `device_last_seen_at` | Todos los autenticados |
| `devices` | ESP32 de cada estanque | `id` (UUID), `secret`, `simulated` | Nadie (solo API) |
| `level_readings` | Historial de nivel (cada 30 s) | `distance_mm`, `volume_l`, `percent` | Todos los autenticados |
| `withdrawals` | Retiros | `target_ms`, `open_ms`, `progress_ms`, `delivered_l`, `level_delta_l`, `status` | Propios; admin |
| `alerts` | Alertas | `type`, `status` | Admin/municipal |
| `refill_requests` | Recargas por camión aljibe | `status` | Admin/municipal |
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
| `record_level(...)` | Nivel actual, historial, verificación cruzada y alertas críticas |

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

`requested → scheduled → in_transit → delivered`, o `cancelled` antes de `delivered`.
