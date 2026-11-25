# NoIdea

Prototipo de sistema inteligente de gestión y distribución de agua para comunidades abastecidas por estanques
comunitarios y camiones aljibe: **app móvil (Expo) + API en Vercel + Supabase + dispensador ESP32**.
Los estanques se ven en un mapa (MapLibre + OpenFreeMap) con su nivel en tiempo real; su ubicación la marca un
administrador escaneando la etiqueta NFC del estanque con el GPS del teléfono.

> Prototipo a pequeña escala. Sin caudalímetro ni electroválvula: niveles y volúmenes entregados son
> **estimaciones**. No se usa agua para consumo humano.

```
[App Expo] ──HTTPS──> [API en Vercel] ──> [Supabase: Postgres + Auth + Realtime] <──Wi-Fi── [ESP32 + sensores]
```

## Qué hay en el repositorio

| Carpeta | Qué es |
|---|---|
| `firmware/` | Firmware del ESP32 (Arduino), sketch de prueba de banco y diagrama Wokwi |
| `app/` | App móvil (Expo / React Native) |
| `api/` | API (Hono) desplegada en Vercel, simulador del dispositivo y scripts |
| `supabase/` | Migraciones SQL y datos de ejemplo |
| `packages/shared/` | Tipos y protocolo compartidos entre app, API y dispositivo |
| `docs/` | Manual de armado, circuito, hardware, arquitectura, API, datos |

## Inicio rápido

La API (`https://noidea-api.vercel.app`) y la base de datos Supabase **ya están desplegadas**: para trabajar no hace
falta crear cuentas propias. Lo único que no está en GitHub son las claves; pídelas al responsable del proyecto por un
canal privado:

| Para | Archivo a crear (desde su `.example`) | Valores |
|---|---|---|
| Dispensador (Arduino) | `firmware/noidea_esp32/secrets.h` | Wi-Fi, hosts, clave pública, `DEVICE_ID`, `DEVICE_SECRET_HEX` |
| App | `app/.env.local` | URL de Supabase, clave pública, URL de la API |
| Scripts y simulador | `api/.env.local` | URL de Supabase, clave secreta, datos del dispositivo |

Estos archivos están en `.gitignore`: **nunca los subas**.

### 1. Dispensador ESP32 (Arduino)

1. Arma el circuito con el **[manual de armado](docs/manual-armado.html)**: 13 pasos ilustrados tipo LEGO (piezas,
   cables, pruebas). Es una página HTML: descarga el repo y ábrela con doble clic en el navegador (GitHub no la
   muestra como página).
2. Instala Arduino IDE 2, el paquete de placas **esp32** (3.x) y las librerías **ESP32Servo**,
   **LiquidCrystal I2C**, **WebSockets** (Markus Sattler) y **ArduinoJson** 7 (detalle en [firmware/README.md](firmware/README.md)).
3. Prueba el cableado con [`firmware/wokwi/sketch.ino`](firmware/wokwi/sketch.ino) (no necesita Wi-Fi ni claves).
4. Crea `firmware/noidea_esp32/secrets.h`, abre `firmware/noidea_esp32/noidea_esp32.ino`, placa
   **ESP32 Dev Module** → **Subir**. Monitor Serie a 115200: `status`, `level`.

Más detalle: [firmware/README.md](firmware/README.md).

### 2. App y API en el PC (opcional)

Requisitos: **Node.js 24+**, Git. Para la app en el teléfono: Android Studio (SDK) y un Android con modo
desarrollador.

```bash
npm install
```

```bash
npm run typecheck
```

```bash
npm test
```

- **API local:** `npm run dev:api` (lee `api/.env.local`, queda en `http://localhost:3000`).
- **Simulador del ESP32 sin hardware:** `npm run simulate` (solo desarrollo; la app muestra el banner "SIMULADOR").
- **App:** MapLibre y NFC no funcionan en Expo Go; hay que compilar el development build con el teléfono conectado:

  ```bash
  cd app && npx expo run:android
  ```

  Después, para el día a día: `npm run dev:app`.
- **Usuarios de prueba:** `npm run users:create -w api`.

## Montar un entorno propio (solo si no se usa el compartido)

1. **Supabase:** crear proyecto, aplicar `supabase/migrations/*.sql` (en orden) y `supabase/seed.sql`.
2. **API:** `api/.env.local` con `SUPABASE_URL` y `SUPABASE_SECRET_KEY`; `npm run users:create -w api`.
3. **Vercel:** proyecto con Root Directory `api`, Node 24 y las mismas dos variables. Se despliega desde la raíz
   del monorepo (`npx vercel deploy --prod`): `.vercelignore` limita la subida a `api/` y `packages/`, y
   `api/vercel.json` incluye `packages/shared/src/index.ts` en la función.
4. **Dispositivo:** `select id, secret from public.devices;` → `DEVICE_ID` / `DEVICE_SECRET_HEX` del `secrets.h`.

## Documentación

- [docs/manual-armado.html](docs/manual-armado.html) — **armado del dispensador paso a paso** (abrir en el navegador)
- [docs/circuito.md](docs/circuito.md) — diseño eléctrico, tensiones, corrientes
- [docs/hardware.md](docs/hardware.md) — componentes, pines, calibración
- [docs/protocolo-dispositivo.md](docs/protocolo-dispositivo.md) — ESP32 ↔ nube
- [docs/arquitectura.md](docs/arquitectura.md) — componentes y flujos
- [docs/modelo-datos.md](docs/modelo-datos.md) — base de datos, RLS y funciones
- [docs/api.md](docs/api.md) — API en Vercel
- [docs/recargas.md](docs/recargas.md) — recargas por camión aljibe (diseño)
- [docs/roadmap.md](docs/roadmap.md) — hitos y estado
- [AGENTS.md](AGENTS.md) — reglas del proyecto (para personas y agentes de IA)
