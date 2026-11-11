# Firmware NoIdea (ESP32 DevKit WROOM-32)

| Carpeta | Qué es |
|---|---|
| `noidea_esp32/` | Firmware del dispensador: nivel, servo-válvula, LCD, Wi-Fi, Supabase Realtime y API |
| `wokwi/` | Circuito para Wokwi (`diagram.json`) y banco de pruebas del cableado |
| `tools/i2c_scanner/` | Encuentra la dirección I2C de la LCD (en el ESP32: `Wire.begin(21, 22)`) |

## Preparar

1. Arduino IDE 2 → Preferencias → URLs adicionales:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json` → Gestor de placas → **esp32** (3.x).
2. Gestor de librerías: **ESP32Servo**, **LiquidCrystal I2C** (Frank de Brabander), **WebSockets**
   (Markus Sattler), **ArduinoJson** (7.x).
3. Copiar `noidea_esp32/secrets.example.h` a `noidea_esp32/secrets.h` y completar Wi-Fi, hosts, clave pública de
   Supabase y el `id`/`secret` del dispositivo (`select id, secret from public.devices;`).
   `secrets.h` está en `.gitignore`: nunca subirlo.
4. Placa **ESP32 Dev Module**, puerto COM → Subir.

Con CLI:

```bash
arduino-cli core install esp32:esp32
arduino-cli lib install ESP32Servo "LiquidCrystal I2C" WebSockets ArduinoJson
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/noidea_esp32
```

## Monitor Serie (115200)

- `level` — distancia del HC-SR04 y lectura del sensor de respaldo (calibración)
- `status` — Wi-Fi, enlace Realtime, válvula, último id
- `reset-id` — solo después de reiniciar la base de datos (los id de retiro vuelven a empezar)

Pines, alimentación (¡divisor en ECHO!) y calibración: [../docs/hardware.md](../docs/hardware.md).
Protocolo: [../docs/protocolo-dispositivo.md](../docs/protocolo-dispositivo.md).
