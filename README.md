# NoIdea

Prototipo de sistema inteligente de gestión y distribución de agua para comunidades abastecidas por estanques
comunitarios y camiones aljibe: app móvil + servidor local + Arduino Uno.

> Prototipo a pequeña escala. Sin caudalímetro ni electroválvula: los volúmenes entregados son **estimaciones**.
> No se usa agua para consumo humano.

## Inicio rápido

Requisitos: Node.js 24+, Arduino IDE 2 (o `arduino-cli`), teléfono con Expo Go / development build en la misma Wi-Fi.

```bash
npm install
```

```bash
cp server/.env.example server/.env
```

```bash
npm run db:seed -w server
```

```bash
npm run dev:server
```

En otra terminal, con `app/.env.local` apuntando a la IP que imprime el servidor:

```bash
npm run dev:app
```

Por defecto el servidor arranca con `HARDWARE_MODE=simulator`. Para usar el Arduino real: cargar el firmware
([firmware/README.md](firmware/README.md)) y poner `HARDWARE_MODE=serial` en `server/.env`.

## Documentación

- [AGENTS.md](AGENTS.md) — reglas del proyecto (para personas y agentes de IA)
- [docs/arquitectura.md](docs/arquitectura.md) — componentes y flujos
- [docs/hardware.md](docs/hardware.md) — kit, pines, alimentación, calibración
- [docs/protocolo-serial.md](docs/protocolo-serial.md) — protocolo servidor ↔ Arduino
- [docs/modelo-datos.md](docs/modelo-datos.md) — base de datos y estados
- [docs/api.md](docs/api.md) — API HTTP y WebSocket
- [docs/roadmap.md](docs/roadmap.md) — hitos y estado
