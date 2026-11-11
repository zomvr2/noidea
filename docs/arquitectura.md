# Arquitectura

## Componentes

### 1. App móvil (`app/`)
Expo + React Native + TypeScript, navegación con Expo Router. Se conecta por Wi-Fi al servidor del PC
(`EXPO_PUBLIC_SERVER_URL`, p. ej. `http://192.168.1.50:3000`).

- Familias: registro, saldo, retiro con NFC, comprobantes, estado del estanque.
- Administrador comunitario: validar familias, asignar cuotas, ver alertas, gestionar recargas.
- Municipal: ver alertas de nivel crítico y seguimiento de recargas.

**NFC:** la app lee el UID de la etiqueta pegada en el dispensador con `react-native-nfc-manager`.
Requiere *development build* (no funciona en Expo Go). Como etiqueta se pueden usar la tarjeta o el llavero
del kit RFID (13,56 MHz, MIFARE Classic): Android lee el UID de la mayoría; iPhone no lee MIFARE Classic, por lo
que para iOS se necesitaría una etiqueta NTAG213/215. La app solo envía el UID; el servidor lo resuelve a un estanque.

### 2. Servidor local (`server/`)
Node.js 24 + TypeScript, Fastify.

- API HTTP REST bajo `/api` (ver [api.md](api.md)).
- WebSocket en `/ws` para empujar eventos (`ServerEvent` en `packages/shared/src/realtime.ts`).
- SQLite con el módulo nativo `node:sqlite` (sin compilación nativa), archivo en `server/data/noidea.db`.
- Enlace serial permanente con el Arduino (`serialport`), reconexión automática, PING cada 1 s.
- Modo `simulator` para desarrollar sin Arduino (datos marcados como simulados).

Módulos de dominio en `server/src/modules/`: `auth`, `families`, `quotas`, `tanks`, `withdrawals`, `alerts`, `refills`.
Infraestructura: `db/`, `hardware/`, `realtime/`, `config.ts`.

### 3. Arduino Uno (`firmware/`)
Controla los dispositivos físicos y aplica seguridad local. No guarda datos de familias.
Ver [hardware.md](hardware.md) y [protocolo-serial.md](protocolo-serial.md).

## Flujo de un retiro

```
App                         Servidor                                   Arduino
 |  lee UID NFC               |                                           |
 |-- POST /api/withdrawals -->|  valida: familia aprobada, saldo,         |
 |   {tagUid, liters}         |  estanque disponible, sin retiro activo,  |
 |                            |  nivel suficiente  -> reserva saldo       |
 |<-- 201 authorized ---------|                                           |
 |                            |-- OPEN <id> <ms> ------------------------>|  servo abre
 |                            |<------------------------- ACK cmd=OPEN ---|
 |<== ws withdrawal.updated ==|<------------------- RUN id= ms= (c/500ms) |
 |                            |<------------- DONE id= ms= r=TARGET ------|  servo cierra
 |                            |  delivered ≈ ms × caudal calibrado        |
 |                            |  libera reserva, descuenta lo entregado   |
 |<== ws withdrawal.updated ==|  (completed + comprobante)                |
```

- `ms = litros solicitados / caudal calibrado (L/s) × 1000`, acotado a 60 000 ms.
- Si llega `DONE` con `r` distinto de `TARGET`, se descuenta solo lo estimado para el tiempo realmente abierto.
- Si el Arduino se desconecta durante un retiro, el retiro queda `failed` y la reserva se libera; el firmware
  cierra por su cuenta tras 3 s sin enlace (`LINK_LOST`).
- Solo un retiro activo por estanque (la válvula es una sola).

## Monitoreo de nivel

1. El Arduino envía `LVL d=<mm> b=<raw> low=<0|1>` periódicamente (cada 2 s) y bajo pedido (`LEVEL`).
2. El servidor convierte distancia a volumen con la geometría del estanque (ver [hardware.md](hardware.md)),
   suaviza con mediana de las últimas lecturas, guarda una muestra cada 30 s y emite `tank.level`.
3. Si el porcentaje cae bajo `critical_percent` o el sensor resistivo de respaldo indica fondo seco, se crea
   una alerta `critical_level` (una sola alerta abierta por estanque) y se puede crear una solicitud de recarga.

## Modos de hardware

| `HARDWARE_MODE` | Uso |
|---|---|
| `serial` | Arduino real en `SERIAL_PORT` (p. ej. `COM3`). Vacío = autodetección por VID de Arduino. |
| `simulator` | Sin Arduino. Responde al protocolo con un estanque ficticio. La app muestra banner "SIMULADOR". |
