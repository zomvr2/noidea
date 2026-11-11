# Firmware NoIdea (Arduino Uno)

| Carpeta | Qué es |
|---|---|
| `noidea_controller/` | Firmware principal: nivel, válvula con servo, LCD y protocolo serial v1 |
| `tools/i2c_scanner/` | Utilidad para encontrar la dirección I2C de la LCD |

## Cargar

1. Arduino IDE 2 → abrir `noidea_controller/noidea_controller.ino`.
2. Gestor de librerías → instalar **LiquidCrystal I2C** (Frank de Brabander). `Servo` y `Wire` vienen incluidas.
3. Placa **Arduino Uno**, puerto COM correspondiente → Subir.

Con CLI:

```bash
arduino-cli core install arduino:avr
arduino-cli lib install "LiquidCrystal I2C"
arduino-cli compile --fqbn arduino:avr:uno firmware/noidea_controller
arduino-cli upload -p COM3 --fqbn arduino:avr:uno firmware/noidea_controller
```

## Probar sin servidor

Monitor Serie a **115200**, fin de línea **Nueva línea**. Escribir:

```
PING
LEVEL
LCD 0 Hola
OPEN 1 2000
```

Ojo: si no se envía nada en 3 s con la válvula abierta, se cierra con `r=LINK_LOST` (comportamiento esperado).
Cerrar el Monitor Serie antes de iniciar el servidor.

Pines, cableado y calibración: [../docs/hardware.md](../docs/hardware.md).
