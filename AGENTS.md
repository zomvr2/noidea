# AGENTS.md — NoIdea

Guía para agentes de código (Claude Code, Codex, etc.) y para el equipo. Léela completa antes de cambiar algo.
Idioma del proyecto: **español** (documentación, mensajes de UI, commits). Los identificadores de código van en inglés.

## Qué es NoIdea

Prototipo a pequeña escala de un sistema de distribución de agua para comunidades abastecidas por estanques
comunitarios y camiones aljibe. Dos objetivos:

1. Controlar cuánta agua retira cada familia (cuotas, reservas, comprobantes).
2. Monitorear el nivel de los estanques, verlos en un mapa y gestionar recargas antes de que se agoten.

No es una instalación real: el objetivo es demostrar que app móvil, nube y dispensador funcionan juntos.
**Nunca se usa agua destinada a consumo humano en las pruebas.**

## Arquitectura (resumen)

```
                    ┌──────────── Supabase ────────────┐
[App Expo] ─Auth/lecturas RLS/Realtime──> Postgres + Auth + Realtime <──Realtime (órdenes firmadas)── [ESP32]
     │                                        ▲    │ Broadcast                                       │
     └──HTTPS (JWT)──> [API Hono en Vercel] ──┘    └──────────────────────────────────────────────────┘
                              ▲                                                                       │
                              └──────────── HTTPS firmado HMAC (telemetría y eventos) ────────────────┘
```

- **App** (Expo): login, mapa de estanques (MapLibre + OpenFreeMap) con nivel en vivo, ubicación de estanques
  por NFC + GPS (admin), retiros.
- **API** (Vercel, Hono): reglas de negocio. Autoriza retiros, envía órdenes al ESP32, recibe su telemetría.
- **Supabase**: Postgres (datos y funciones transaccionales de saldo), Auth, Realtime.
- **ESP32 DevKit (WROOM-32)**: sensores, servo-válvula, LCD y seguridad local. Conectado por Wi-Fi; ya no hay PC
  ni cable USB en el flujo.

Detalle en [docs/arquitectura.md](docs/arquitectura.md).

## Estructura del monorepo

| Ruta | Qué contiene | Stack |
|---|---|---|
| `app/` | App móvil | Expo SDK 58, Expo Router, supabase-js, MapLibre RN 11, expo-location, react-native-nfc-manager |
| `api/` | API serverless (proyecto Vercel, Root Directory = `api`) | Node 24, Hono, supabase-js, zod |
| `supabase/` | Migraciones SQL y seed | Postgres (Supabase) |
| `packages/shared/` | Tipos de dominio, contratos de API, mapeo de filas y **protocolo del dispositivo** | TypeScript puro, un solo archivo |
| `firmware/noidea_esp32/` | Firmware del ESP32 | Arduino-ESP32 core 3.x |
| `docs/` | Arquitectura, protocolo, hardware, datos, API, roadmap | Markdown |

`app/AGENTS.md` tiene reglas adicionales de Expo; aplícalas al trabajar en `app/`.

## Reglas de responsabilidad (no negociables)

- **Reglas de negocio solo en la API y en funciones SQL** (`authorize_withdrawal`, `finish_withdrawal`, …).
  La app nunca decide si un retiro está autorizado ni escribe tablas de negocio: lee con RLS y pide a la API.
- **La clave secreta de Supabase solo existe en Vercel** (y en `api/.env.local` para desarrollo). La app y el
  ESP32 solo usan la clave pública (`sb_publishable_...`).
- **El ESP32 no conoce familias, cuentas ni saldos.** Ejecuta órdenes firmadas (OPEN/STOP/LCD), mide y aplica
  seguridad local. La conversión distancia → litros vive en la API.
- **Toda orden al ESP32 va firmada con HMAC-SHA256** del secreto del dispositivo y con marca de tiempo; toda
  petición del ESP32 a la API también. Nunca enviar el secreto por la red.
- **El protocolo del dispositivo vive en `packages/shared/src/index.ts`** (sección «Protocolo del dispositivo») y en
  [docs/protocolo-dispositivo.md](docs/protocolo-dispositivo.md). Si cambias el protocolo, actualiza en el mismo
  cambio: el TS, sus tests, el firmware, el simulador (`api/scripts/device-simulator.ts`) y el documento.
  Sube `PROTOCOL_VERSION` / `PROTO_VERSION` si rompe compatibilidad.
- La **ubicación de un estanque** solo la fija un **admin**: escanea la etiqueta NFC en terreno y se guarda el GPS
  del teléfono con su precisión. Las familias no pueden moverla.
- Esquema de base de datos: solo por migraciones en `supabase/migrations/` (nunca editar una ya aplicada).
  Toda tabla nueva con RLS habilitado y políticas explícitas.

## Honestidad de las mediciones (regla clave del proyecto)

El prototipo **no tiene caudalímetro ni electroválvula**. Por lo tanto:

- El volumen entregado = `tiempo de apertura × caudal calibrado`, guardado con `measurementMethod: "estimated_time"`.
  La UI lo muestra como **"≈ X L (estimado)"**, nunca como medición exacta.
- El nivel del estanque también es estimado (HC-SR04): mostrar "≈". La diferencia de nivel antes/después de un
  retiro se guarda como verificación cruzada (`level_delta_l`).
- Redondear volúmenes estimados a 0,1 L como máximo.
- El simulador (`npm run simulate`) existe solo para desarrollar. Usa un dispositivo con `simulated = true` y la app
  muestra el banner "SIMULADOR". Nunca se presenta como dato real.
- Funciones que dependen de hardware ausente quedan marcadas **PENDIENTE** en código y docs.

## Hardware

ESP32 DevKit (WROOM-32) + componentes del kit KA-23: **HC-SR04** (nivel continuo), **sensor de nivel resistivo**
(respaldo de nivel crítico), **servomotor** sobre una llave pequeña (modelo por confirmar, se asume SG90),
**LCD 16x2 + driver I2C**. Reservado: **relé** (futura electroválvula). Etiqueta del estanque: tarjeta/llavero RFID
del kit (la lee el NFC del teléfono). El Arduino Uno del kit ya no se usa.
**El ESP32 es de 3,3 V:** el ECHO del HC-SR04 va con divisor de tensión. Pines, cableado y calibración:
[docs/hardware.md](docs/hardware.md).

## Comandos

Desde la raíz (npm workspaces):

```bash
npm install                 # instala todo el monorepo
npm run dev:api             # API local en http://localhost:3000 (lee api/.env.local)
npm run dev:app             # Expo dev server (requiere development build por MapLibre y NFC)
npm run simulate            # simulador del ESP32 (solo desarrollo)
npm run typecheck           # TypeScript en shared, api y app
npm test                    # tests (shared + api)
npm run users:create -w api # usuarios de prueba en Supabase Auth
```

Base de datos: aplicar `supabase/migrations/*.sql` y `supabase/seed.sql` (MCP de Supabase o CLI `supabase db push`).
Despliegue: proyecto Vercel con Root Directory `api`; variables `SUPABASE_URL` y `SUPABASE_SECRET_KEY`.

App nativa: MapLibre y NFC no funcionan en Expo Go → `npx expo run:android` (o EAS development build).

Firmware: Arduino IDE 2, placa "ESP32 Dev Module" (core esp32 3.x), librerías ESP32Servo, LiquidCrystal I2C,
WebSockets (Markus Sattler) y ArduinoJson 7. Copiar `secrets.example.h` a `secrets.h`. Con CLI:

```bash
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/noidea_esp32
```

## Convenciones

- TypeScript estricto. Sin `any` salvo en bordes con librerías sin tipos (comentado).
- API: validación con `zod` en cada ruta; errores `{ error: { code, message } }`. Las funciones SQL lanzan
  `RAISE EXCEPTION '<CODIGO>'` y `api/src/lib/errors.ts` las traduce.
- Funciones SQL de negocio: `security definer`, `set search_path = ''`, ejecutables solo por `service_role`.
- Unidades: litros (`...L` / `_l`), mm (`...Mm` / `_mm`), ms (`...Ms` / `_ms`), fechas ISO UTC / `timestamptz`.
- `packages/shared` es un único archivo sin imports relativos (compatibilidad Metro / Node / Vercel).
- App: rutas en `app/src/app/`; el resto en `src/lib`, `src/features/<x>`, `src/components`.
- Firmware: seguridad y válvula en el núcleo 1 (`loop`); red en tareas del núcleo 0. Comunicación solo por colas.
  Sin `String` dinámico en rutas críticas.
- Commits en español, Conventional Commits (`feat(api): ...`, `fix(firmware): ...`).

## Antes de dar una tarea por terminada

1. `npm run typecheck` y `npm test` pasan.
2. Si tocaste firmware: compila para `esp32:esp32:esp32`.
3. Si tocaste protocolo, API o esquema: docs actualizados en el mismo cambio.
4. Si algo no se pudo probar con hardware real o contra Supabase/Vercel reales, dilo explícitamente.

## Seguridad física del prototipo

- Servo con fuente 5 V externa (≥1 A) y GND común con el ESP32; nunca desde el pin 3V3.
- ECHO del HC-SR04 (5 V) siempre con divisor 1 kΩ / 2 kΩ hacia el GPIO 19.
- No conectar la batería de 9 V directo al servo ni al relé.
- El firmware cierra la válvula ante: tiempo cumplido, `STOP`, enlace Realtime caído 3 s, respaldo seco o tope de
  60 s. Ninguna de estas protecciones se debe quitar.

## Roadmap

Ver [docs/roadmap.md](docs/roadmap.md).
