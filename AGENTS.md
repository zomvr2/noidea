# AGENTS.md — NoIdea

Guía para agentes de código (Claude Code, Codex, etc.) y para el equipo. Léela completa antes de cambiar algo.
Idioma del proyecto: **español** (documentación, mensajes de UI, commits). Los identificadores de código van en inglés.

## Qué es NoIdea

Prototipo a pequeña escala de un sistema de distribución de agua para comunidades abastecidas por estanques
comunitarios y camiones aljibe. Dos objetivos:

1. Controlar cuánta agua retira cada familia (cuotas, reservas, comprobantes).
2. Monitorear el nivel del estanque y gestionar recargas antes de que se agote.

No es una instalación real: el objetivo es demostrar que app móvil, servidor local y Arduino funcionan juntos.
**Nunca se usa agua destinada a consumo humano en las pruebas.**

## Arquitectura (resumen)

```
[App Expo/React Native] --Wi-Fi: HTTP + WebSocket--> [Servidor Node.js en el PC] --USB serial--> [Arduino Uno]
        NFC del teléfono lee                          lógica, SQLite, alertas                 sensores, servo,
        la etiqueta del estanque                                                               LCD, seguridad local
```

Detalle en [docs/arquitectura.md](docs/arquitectura.md).

## Estructura del monorepo

| Ruta | Qué contiene | Stack |
|---|---|---|
| `app/` | App móvil (familias, admin, estanques, NFC) | Expo SDK 58, React Native, Expo Router, TypeScript |
| `server/` | Servidor local: API HTTP, WebSocket, SQLite, enlace serial | Node.js 24, TypeScript, Fastify, `node:sqlite`, `serialport` |
| `packages/shared/` | Tipos de dominio, eventos en tiempo real y **protocolo serial** | TypeScript puro (sin APIs de Node ni de RN) |
| `firmware/noidea_controller/` | Sketch del Arduino Uno | Arduino C++ (Arduino IDE 2 o `arduino-cli`) |
| `docs/` | Arquitectura, protocolo, hardware, datos, API, roadmap | Markdown |

`app/AGENTS.md` tiene reglas adicionales específicas de Expo; aplícalas al trabajar en `app/`.

## Reglas de responsabilidad (no negociables)

- **El servidor es la única fuente de verdad** para usuarios, roles, familias, cuotas, retiros, alertas y recargas.
  La app nunca decide si un retiro está autorizado; solo pide y muestra.
- **El Arduino no conoce familias, cuentas ni saldos.** Solo ejecuta órdenes (`OPEN`, `STOP`, `LCD`...), mide y aplica
  seguridad local (tope de tiempo, pérdida de enlace, nivel crítico).
- **El protocolo serial vive en `packages/shared/src/serial-protocol.ts`** y se documenta en
  [docs/protocolo-serial.md](docs/protocolo-serial.md). Si cambias el protocolo, actualiza en el mismo cambio:
  el archivo TS, sus tests, el firmware y el documento. Sube `PROTOCOL_VERSION` si el cambio rompe compatibilidad.
- Los tipos que cruzan la red (HTTP/WebSocket) se definen en `packages/shared`, no se duplican en app/servidor.

## Honestidad de las mediciones (regla clave del proyecto)

El kit disponible **no tiene caudalímetro ni electroválvula**. Por lo tanto:

- El volumen entregado se calcula como `tiempo de apertura × caudal calibrado` y se guarda con
  `measurementMethod: "estimated_time"`. La UI debe mostrarlo como **"≈ X L (estimado)"**, nunca como medición exacta.
- La diferencia de nivel antes/después del HC-SR04 se registra como verificación cruzada (`levelDeltaL`), también
  como estimación.
- No inventes decimales: redondea volúmenes estimados a 0,1 L como máximo.
- El modo simulador (`HARDWARE_MODE=simulator`) existe solo para desarrollar sin Arduino. Todo dato simulado debe
  verse como tal en la app (banner "SIMULADOR"). Nunca se usa en una demostración presentada como real.
- Funciones que dependen de hardware ausente quedan marcadas como **PENDIENTE** en código y docs.

## Hardware disponible (kit KA-23)

Usados en el prototipo: Arduino Uno, cable USB, **sensor ultrasónico (HC-SR04)** para nivel continuo,
**sensor de nivel de agua resistivo** como respaldo de nivel crítico, **servomotor** (modelo por confirmar, se asume
SG90) que abre/cierra una llave o manguera, **LCD 16x2 + driver I2C**, protoboard.
Reservado: **relé 1 canal** (para una futura electroválvula con fuente externa).
Opcionales/no usados por ahora: RFID RC522, teclado 4x4, RTC, DHT, joystick, matriz 8x8, displays 7 segmentos,
motor paso a paso + driver (alternativa al servo si falta torque), micrófono.
Pines, cableado, alimentación y calibración: [docs/hardware.md](docs/hardware.md).

## Comandos

Desde la raíz (npm workspaces):

```bash
npm install                 # instala todo el monorepo
npm run dev:server          # servidor en modo watch (lee server/.env)
npm run dev:app             # Expo dev server
npm run typecheck           # TypeScript en shared, server y app
npm test                    # tests (shared + server)
npm run db:seed -w server   # carga familias y estanque ficticios
```

Firmware: abrir `firmware/noidea_controller/noidea_controller.ino` en Arduino IDE 2, placa "Arduino Uno",
librerías `Servo` (incluida) y `LiquidCrystal I2C` (Frank de Brabander). Con CLI:

```bash
arduino-cli compile --fqbn arduino:avr:uno firmware/noidea_controller
```

Cierra el Monitor Serie del IDE antes de arrancar el servidor: el puerto COM solo admite un proceso.

## Convenciones

- TypeScript estricto en todo. Sin `any` salvo en bordes con librerías sin tipos (comentado).
- Validación de entrada en el servidor con `zod` en cada ruta. Errores HTTP con forma `{ error: { code, message } }`.
- SQL explícito en `server/src/db/`; migraciones numeradas `NNN_descripcion.sql`, nunca se edita una migración ya
  aplicada: se agrega una nueva.
- Unidades: volúmenes en litros (`...L`), distancias en mm (`...Mm`), tiempos en ms (`...Ms`), fechas ISO UTC.
- Servidor organizado por módulos de dominio en `server/src/modules/<modulo>/` (`routes.ts`, `service.ts`, `repo.ts`).
- App: rutas en `app/src/app/`, todo lo demás fuera (`src/lib`, `src/features/<x>`, `src/components`).
- Firmware: sin `String` dinámico ni `malloc` (RAM de 2 KB); buffers fijos, `millis()` sin `delay()` largos.
- Commits en español, estilo Conventional Commits (`feat(server): ...`, `fix(firmware): ...`).

## Antes de dar una tarea por terminada

1. `npm run typecheck` y `npm test` pasan.
2. Si tocaste firmware: compila para `arduino:avr:uno` y el uso de RAM reportado queda bajo ~75 %.
3. Si tocaste el protocolo o la API: docs actualizados en el mismo cambio.
4. Si algo no se pudo probar con hardware real, dilo explícitamente.

## Seguridad física del prototipo

- El servo no se alimenta desde el pin 5V del Uno si mueve una llave con carga: usar fuente 5V externa con GND común.
- No conectar la batería de 9V directo al servo ni al relé.
- El firmware cierra la válvula ante: tiempo cumplido, `STOP`, 3 s sin mensajes del servidor, nivel crítico de
  respaldo o tope de 60 s. Ninguna de estas protecciones se debe quitar.

## Roadmap

Ver [docs/roadmap.md](docs/roadmap.md) para hitos y estado actual.
