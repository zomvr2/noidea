# Protocolo serial v1 (servidor ↔ Arduino)

Implementación de referencia: [`packages/shared/src/serial-protocol.ts`](../packages/shared/src/serial-protocol.ts).
Firmware: [`firmware/noidea_controller/`](../firmware/noidea_controller/).

- USB serial, **115200 baudios**, 8N1.
- Texto ASCII, una línea por mensaje terminada en `\n` (se tolera `\r\n`). Máximo **63 caracteres**.
- Servidor → Arduino: comandos posicionales. Arduino → servidor: `TIPO clave=valor ...`.
- El Arduino reinicia al abrir el puerto (auto-reset del Uno): el servidor espera `BOOT` antes de enviar órdenes.

## Comandos (servidor → Arduino)

| Comando | Respuesta | Descripción |
|---|---|---|
| `PING` | `PONG fw=<ver> proto=1` | Keep-alive. El servidor lo envía cada 1 s. |
| `LEVEL` | `LVL ...` | Fuerza una lectura de nivel inmediata. |
| `OPEN <id> <ms>` | `ACK cmd=OPEN id=<id>` o `NAK cmd=OPEN id=<id> r=<motivo>` | Abre la válvula (servo) durante `ms` (1–60000). `id` = id del retiro. |
| `STOP <id>` | `ACK cmd=STOP id=<id>` + `DONE ... r=STOP`, o `NAK cmd=STOP id=<id> r=NOT_ACTIVE` | Cierra de inmediato. |
| `LCD <fila> <texto>` | `ACK cmd=LCD` | Escribe en la fila 0 o 1 (16 caracteres ASCII). |

Motivos de `NAK`: `BUSY` (ya hay apertura activa), `BAD_ARGS`, `MAX_MS`, `LOW_LEVEL` (respaldo indica fondo seco),
`NOT_ACTIVE`.

## Mensajes (Arduino → servidor)

| Mensaje | Cuándo |
|---|---|
| `BOOT fw=0.1.0 proto=1` | Al arrancar. |
| `LVL d=<mm> b=<0-1023> low=<0\|1>` | Cada 2 s y tras `LEVEL`. `d` = distancia sensor→agua (mediana de 5 pulsos). `b` = lectura cruda del sensor resistivo de respaldo. `low=1` = bajo el umbral de fondo seco (`BACKUP_DRY_THRESHOLD` en el firmware). |
| `LVL err=NO_ECHO b=<raw> low=<0\|1>` | El HC-SR04 no respondió o la medida es inválida. |
| `RUN id=<id> ms=<transcurrido>` | Cada 500 ms mientras la válvula está abierta. |
| `DONE id=<id> ms=<abierto> r=<motivo>` | Al cerrar. Motivos: `TARGET`, `STOP`, `LINK_LOST`, `LOW_LEVEL`, `MAX_MS`. |
| `ERR code=<código>` | `LINE_TOO_LONG`, `UNKNOWN_CMD`. |

## Seguridad en el firmware

La válvula se cierra sin esperar al servidor cuando:

1. se cumple el tiempo pedido (`TARGET`),
2. pasan **3 s** sin recibir ninguna línea del servidor (`LINK_LOST`),
3. el sensor resistivo de respaldo baja del umbral de fondo seco (`LOW_LEVEL`),
4. se alcanza el tope absoluto de 60 s (`MAX_MS`).

Al arrancar, el servo siempre va a la posición cerrada y el relé queda apagado.

## Ejemplo de sesión

```
<- BOOT fw=0.1.0 proto=1
<- LVL d=212 b=640 low=0
-> LCD 0 Estanque 1
<- ACK cmd=LCD
-> OPEN 17 4000
<- ACK cmd=OPEN id=17
<- RUN id=17 ms=500
...
<- DONE id=17 ms=4001 r=TARGET
```

## Cambios al protocolo

Actualizar en el mismo commit: `serial-protocol.ts`, sus tests, el firmware y este documento.
Si rompe compatibilidad, subir `PROTOCOL_VERSION` (TS) y `PROTO_VERSION` (firmware); el servidor rechaza firmware
con otra versión.
