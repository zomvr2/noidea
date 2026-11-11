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
| POST | `/withdrawals` | family | ✅ `{ tagUid, liters }` → `Withdrawal` (espera ACK del ESP32 hasta 8 s) |
| POST | `/withdrawals/:id/stop` | dueño/admin | ✅ envía STOP; el cierre llega por DONE |
| POST | `/families/register` | autenticado | 🚧 crea familia `pending` |
| POST | `/families/:id/approve` · `/reject` | admin | 🚧 aprueba y asigna cuota |
| PATCH | `/tanks/:id` | admin | 🚧 calibración / estado |
| POST | `/alerts/:id/ack` | admin/municipal | 🚧 |
| POST/PATCH | `/refills` | admin/municipal | 🚧 |

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
