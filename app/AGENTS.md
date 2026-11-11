This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## NoIdea — reglas de la app

Lee también el `AGENTS.md` de la raíz del monorepo (arquitectura, honestidad de mediciones, protocolo).

- La app es un cliente: **nunca** decide autorizaciones ni calcula saldos; todo lo pide al servidor (`src/lib/api.ts`).
- Tipos de red (`Tank`, `Withdrawal`, `ServerEvent`...) se importan de `@noidea/shared`; no se redefinen aquí.
- Tiempo real: `useRealtime` (`src/lib/realtime.ts`) sobre el WebSocket `/ws` del servidor.
- Volúmenes entregados y niveles se muestran como estimación: "≈ 1,2 L (estimado)". Si `device.link === "simulated"`,
  mostrar banner "SIMULADOR".
- URL del servidor en `app/.env.local` → `EXPO_PUBLIC_SERVER_URL=http://<ip-del-pc>:3000` (ver `.env.example`).
- Estructura: `src/app/` solo rutas; `src/features/<dominio>/` hooks y componentes por dominio; `src/lib/` cliente
  HTTP/WS y utilidades; `src/components/` UI genérica; `src/theme.ts` colores.
- **NFC** (hito 4): `react-native-nfc-manager` vía `npx expo install` + config plugin en `app.json`. Requiere
  development build (`npx expo run:android` o EAS); Expo Go no lo soporta. Leer solo el UID (NfcA/MIFARE Classic de
  la tarjeta del kit en Android; NTAG21x para iPhone).
- Android bloquea HTTP sin TLS en builds de release: para el servidor local habrá que habilitar cleartext con
  `expo-build-properties` (`android.usesCleartextTraffic: true`) cuando se haga el development build.
