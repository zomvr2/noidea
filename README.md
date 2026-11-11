# NoIdea

Prototipo de sistema inteligente de gestión y distribución de agua para comunidades abastecidas por estanques
comunitarios y camiones aljibe: **app móvil (Expo) + API en Vercel + Supabase + dispensador ESP32**.
Los estanques se ven en un mapa (MapLibre + OpenFreeMap) con su nivel en tiempo real; su ubicación la marca un
administrador escaneando la etiqueta NFC del estanque con el GPS del teléfono.

> Prototipo a pequeña escala. Sin caudalímetro ni electroválvula: niveles y volúmenes entregados son
> **estimaciones**. No se usa agua para consumo humano.

## Puesta en marcha

1. **Supabase:** crear proyecto, aplicar `supabase/migrations/*.sql` y `supabase/seed.sql`.
2. **API:** copiar `api/.env.example` a `api/.env.local` con `SUPABASE_URL` y `SUPABASE_SECRET_KEY`.

   ```bash
   npm install
   ```

   ```bash
   npm run users:create -w api
   ```

   ```bash
   npm run dev:api
   ```

3. **Vercel:** proyecto con Root Directory `api` y las mismas dos variables.
4. **App:** copiar `app/.env.example` a `app/.env.local`; compilar el development build (MapLibre y NFC no
   funcionan en Expo Go):

   ```bash
   cd app && npx expo run:android
   ```

5. **Dispensador:** ver [firmware/README.md](firmware/README.md). Sin hardware: `npm run simulate`.

## Documentación

- [AGENTS.md](AGENTS.md) — reglas del proyecto (para personas y agentes de IA)
- [docs/arquitectura.md](docs/arquitectura.md) — componentes y flujos
- [docs/hardware.md](docs/hardware.md) — ESP32, pines, alimentación, calibración
- [docs/protocolo-dispositivo.md](docs/protocolo-dispositivo.md) — ESP32 ↔ nube
- [docs/modelo-datos.md](docs/modelo-datos.md) — base de datos, RLS y funciones
- [docs/api.md](docs/api.md) — API en Vercel
- [docs/roadmap.md](docs/roadmap.md) — hitos y estado
