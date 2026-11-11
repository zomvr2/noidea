# Modelo de datos (SQLite)

Esquema en [`server/src/db/migrations/`](../server/src/db/migrations/). Volúmenes en litros (REAL), fechas ISO UTC (TEXT).

| Tabla | Propósito | Campos clave |
|---|---|---|
| `users` | Personas que inician sesión | `phone` (único), `pin_hash`, `role` (`family`/`admin`/`municipal`), `family_id` |
| `sessions` | Tokens de sesión opacos | `token_hash`, `user_id`, `expires_at` |
| `families` | Grupo familiar | `name`, `sector`, `members`, `status` (`pending`/`approved`/`rejected`/`suspended`) |
| `quotas` | Cuota por período | `family_id`, `period_start`, `period_end`, `allocated_l`, `used_l`, `reserved_l` |
| `tanks` | Estanque + calibración | `nfc_tag_uid`, `capacity_l`, `empty_distance_mm`, `full_distance_mm`, `flow_lps`, `critical_percent`, `status` |
| `level_readings` | Historial de nivel (muestreado) | `tank_id`, `distance_mm`, `volume_l`, `percent`, `backup_raw`, `source` (`device`/`simulator`) |
| `withdrawals` | Retiros | `family_id`, `tank_id`, `requested_l`, `reserved_l`, `open_ms`, `delivered_l`, `measurement_method`, `level_delta_l`, `status`, `close_reason` |
| `alerts` | Alertas | `tank_id`, `type`, `status`, `message` |
| `refill_requests` | Recargas por camión aljibe | `tank_id`, `status`, `requested_volume_l`, `notes`, `created_by` |
| `audit_log` | Acciones administrativas | `user_id`, `action`, `payload` |

## Reglas de saldo

- `disponible = allocated_l − used_l − reserved_l` del período vigente.
- Al autorizar: `reserved_l += requested_l` (en una transacción con la verificación).
- Al terminar: `reserved_l −= requested_l`, `used_l += delivered_l` (delivered ≤ requested).
- Al fallar/cancelar sin apertura: solo se libera la reserva.

## Estados de un retiro

```
authorized ──OPEN ACK──> dispensing ──DONE──> completed
     │                        │
     └─NAK/timeout──> failed  └─desconexión──> failed (se descuenta lo estimado si hubo RUN)
     └─cancelación──> cancelled
```

## Estados de una recarga

`requested → scheduled → in_transit → delivered`, o `cancelled` desde cualquier estado previo a `delivered`.
