# Roadmap

Cada hito termina en algo demostrable. Marcar `[x]` al completar.

## Hito 0 — Estructura (hecho)
- [x] Monorepo npm workspaces: `app/`, `server/`, `packages/shared/`, `firmware/`, `docs/`
- [x] Protocolo serial v1 definido y con tests
- [x] Firmware base: nivel (HC-SR04 + respaldo resistivo), servo con seguridades, LCD
- [x] Servidor base: config, SQLite + migración, seed, enlace serial / simulador, `/api/health`, `/api/tanks`, WebSocket
- [x] App base: conexión al servidor y nivel del estanque en vivo

## Hito 1 — Hardware de nivel en banco
- [ ] Montar HC-SR04, sensor resistivo y LCD; confirmar dirección I2C (0x27/0x3F)
- [ ] Calibrar nivel vacío/lleno y umbral de respaldo ([hardware.md](hardware.md))
- [ ] Ver el nivel real en la app vía servidor
- [ ] Alerta `critical_level` + evento en tiempo real

## Hito 2 — Válvula con servo
- [ ] Confirmar modelo de servo y construir el acople con la llave/manguera
- [ ] Ajustar ángulos abierto/cerrado
- [ ] Calibrar caudal por gravedad a 3 alturas y documentar el error
- [ ] Probar cierres de seguridad: STOP, desconectar USB (LINK_LOST), respaldo seco

## Hito 3 — Familias, sesiones y cuotas
- [ ] Registro y login (teléfono + PIN, hash scrypt)
- [ ] Panel admin: aprobar/rechazar familias, asignar cuota del período
- [ ] Saldo visible en la app

## Hito 4 — Retiro completo con NFC
- [ ] Development build con `react-native-nfc-manager`; leer UID de la tarjeta/llavero del kit
- [ ] `POST /api/withdrawals` con todas las validaciones y reserva transaccional
- [ ] Orquestación OPEN/RUN/DONE, progreso en vivo, comprobante "≈ X L (estimado)"
- [ ] Verificación cruzada con diferencia de nivel

## Hito 5 — Recargas y municipio
- [ ] Solicitud de recarga desde alerta, estados y seguimiento
- [ ] Vista municipal

## Hito 6 — Demo integrada
- [ ] Guion de demostración, datos ficticios, checklist de seguridad
- [ ] Lista explícita de limitaciones (sin caudalímetro, sin electroválvula, caudal variable)

## Pendiente por hardware no disponible
- Caudalímetro → medición real del volumen (`measurementMethod: "flowmeter"`)
- Electroválvula → control con relé (pin D2 reservado)
