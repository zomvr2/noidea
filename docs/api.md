# API (Vercel)

Base: `https://<proyecto>.vercel.app/api` (local: `http://localhost:3000/api`). JSON.
Errores: `{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "..." } }`.
Estado: ✅ implementado · 🚧 pendiente.

Las **lecturas** de la app (estanques, saldo, historial, alertas) van directo a Supabase con RLS, y el tiempo real
con Supabase Realtime. La API solo expone lo que requiere reglas de negocio o la clave secreta.

## App (`Authorization: Bearer <JWT de Supabase Auth>`)

| Método | Ruta | Rol | Estado |
|---|---|---|---|
| GET | `/health` | público | ✅ |
| POST | `/tanks/locate` | admin | ✅ `{ tagUid, latitude, longitude, accuracyM, name? }` → `Tank`. `404 TAG_UNKNOWN` si la etiqueta no existe y no viene `name` |
| POST | `/tanks/remove` | admin | ✅ `{ tagUid, tankId }` → `{ id, name, deletedAt }`. Borrado lógico. `404 TAG_UNKNOWN`, `409 TAG_MISMATCH` (la etiqueta no es la del estanque confirmado), `409 TANK_BUSY` (retiro en curso) |
| POST | `/withdrawals` | family | ✅ `{ tagUid, liters }` → `Withdrawal` (espera ACK del ESP32 hasta 8 s). Incluye `targetMs` (tiempo de apertura ordenado) para mostrar el avance |
| POST | `/withdrawals/:id/stop` | dueño/admin | ✅ envía STOP; el cierre llega por DONE |
| POST | `/families/register` | autenticado | 🚧 crea familia `pending` |
| POST | `/families/:id/approve` · `/reject` | admin | 🚧 aprueba y asigna cuota |
| PATCH | `/tanks/:id` | admin | 🚧 calibración / estado |
| POST | `/alerts/:id/ack` | admin/municipal | 🚧 |
| GET | `/refills` | admin/municipal | ✅ → `{ items: RefillListItem[] }`: abiertas por prioridad (≈ horas hasta vaciarse, % de nivel, familias del estanque) y cerradas de las últimas 24 h |
| POST | `/refills` | admin/municipal | ✅ `{ tankId, volumeL?, notes? }` → `RefillRequest`. `409 REFILL_ALREADY_OPEN` |
| POST | `/refills/:id/claim` | admin/municipal | ✅ «Tomar recarga». `409 REFILL_TAKEN`, `409 REFILL_ALREADY_ACTIVE` |
| POST | `/refills/:id/release` | asignado/admin | ✅ «Soltar»: vuelve a `requested` |
| POST | `/refills/:id/start` | asignado | ✅ «Salir»: `in_transit` |
| POST | `/refills/:id/position` | asignado | ✅ `{ latitude, longitude, accuracyM }` cada ~10 s; la API calcula `etaS` |
| POST | `/refills/:id/arrive` | asignado | ✅ `{ tagUid }` etiqueta NFC del estanque. `409 NOT_AT_TANK` |
| POST | `/refills/:id/deliver` | asignado | ✅ «Terminé»: `delivered`, `deliveredEstimatedL` ≈ subida de nivel (estimado) |
| POST | `/refills/:id/cancel` | asignado/admin (o cualquiera si nadie la tomó) | ✅ |

Errores de recargas: `REFILL_NOT_FOUND`, `INVALID_REFILL_STATE` (acción no válida en el estado actual),
`NOT_ASSIGNED` (la recarga es de otra persona). Detalle del flujo: [recargas.md](recargas.md).

## Dispositivo (firma HMAC, ver [protocolo-dispositivo.md](protocolo-dispositivo.md))

| Método | Ruta | Estado |
|---|---|---|
| POST | `/device/telemetry` | ✅ |
| POST | `/device/events` | ✅ ACK, NAK, RUN, DONE |

## Variables de entorno (Vercel)

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | Clave secreta (`sb_secret_...`) — nunca en la app ni en el firmware |
