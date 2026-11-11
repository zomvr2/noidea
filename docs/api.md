# API HTTP y WebSocket

Base: `http://<ip-del-pc>:3000`. JSON en todo. Autenticación: `Authorization: Bearer <token>`.
Errores: `{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "..." } }`.

Estado: ✅ implementado · 🚧 pendiente.

## Sistema
| Método | Ruta | Rol | Estado |
|---|---|---|---|
| GET | `/api/health` | público | ✅ estado del servidor y del enlace con Arduino |

## Autenticación
| Método | Ruta | Rol | Estado |
|---|---|---|---|
| POST | `/api/auth/register` | público | 🚧 crea usuario + familia `pending` |
| POST | `/api/auth/login` | público | 🚧 `{ phone, pin }` → `{ token, user }` |
| GET | `/api/auth/me` | autenticado | 🚧 |

## Familias y cuotas
| Método | Ruta | Rol | Estado |
|---|---|---|---|
| GET | `/api/families` | admin | 🚧 filtro `?status=pending` |
| POST | `/api/families/:id/approve` | admin | 🚧 aprueba y asigna cuota del período |
| POST | `/api/families/:id/reject` | admin | 🚧 |
| GET | `/api/families/:id/balance` | dueño/admin | 🚧 `QuotaBalance` |

## Estanques
| Método | Ruta | Rol | Estado |
|---|---|---|---|
| GET | `/api/tanks` | autenticado* | ✅ lista con último nivel |
| GET | `/api/tanks/:id` | autenticado* | ✅ |
| GET | `/api/tanks/by-tag/:uid` | autenticado | 🚧 resolver etiqueta NFC |
| GET | `/api/tanks/:id/readings` | autenticado | 🚧 historial |
| PATCH | `/api/tanks/:id` | admin | 🚧 calibración / estado |

\* Mientras no exista auth, las rutas ✅ son públicas.

## Retiros
| Método | Ruta | Rol | Estado |
|---|---|---|---|
| POST | `/api/withdrawals` | family | 🚧 `{ tagUid, liters }` → `Withdrawal` (`authorized`) |
| POST | `/api/withdrawals/:id/stop` | dueño/admin | 🚧 |
| GET | `/api/withdrawals?familyId=` | dueño/admin | 🚧 historial y comprobantes |

## Alertas y recargas
| Método | Ruta | Rol | Estado |
|---|---|---|---|
| GET | `/api/alerts` | admin/municipal | 🚧 |
| POST | `/api/alerts/:id/ack` | admin/municipal | 🚧 |
| GET/POST | `/api/refills` | admin/municipal | 🚧 |
| PATCH | `/api/refills/:id` | admin/municipal | 🚧 cambio de estado |

## WebSocket `/ws`
Al conectar el servidor envía `hello`. Luego eventos `ServerEvent`
([`packages/shared/src/realtime.ts`](../packages/shared/src/realtime.ts)): `device.status`, `tank.level`,
`tank.status`, `withdrawal.updated`, `alert.created`, `refill.updated`.
