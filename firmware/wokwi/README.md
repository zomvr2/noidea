# Circuito en Wokwi

| Archivo | Qué es |
|---|---|
| `diagram.json` | Circuito completo para Wokwi (ESP32 DevKitC V4, mismos pines que `noidea_esp32/config.h`) |
| `sketch.ino` | **Banco de pruebas** del cableado: no es el firmware del dispensador (sin Wi-Fi ni Supabase) |
| `libraries.txt` | Librerías que Wokwi debe instalar para `sketch.ino` |

Tabla de conexiones, verificación de tensiones/corrientes y montaje en protoboard:
[../../docs/circuito.md](../../docs/circuito.md).

## Abrir en Wokwi (web)

1. Ir a <https://wokwi.com/projects/new/esp32>.
2. Pestaña `diagram.json`: reemplazar todo el contenido por el de este `diagram.json`.
3. Pestaña `sketch.ino`: reemplazar por el de este `sketch.ino`.
4. `Library Manager` → `+` → agregar **ESP32Servo** y **LiquidCrystal I2C**.
5. ▶ Iniciar. En el Monitor Serie escribir `open`, `close`, `level` o `relay-test`.
   Hacer clic en el HC-SR04 para cambiar la distancia y girar el potenciómetro para simular seco/mojado.

## Convenciones del diagrama

- Rojo = 5 V del USB (riel superior) · naranja = 5 V de la fuente externa (riel inferior, solo servo) · negro = GND.
- El **potenciómetro** representa el sensor de nivel resistivo (Wokwi no tiene esa pieza).
- La fuente externa, el condensador de 470 µF, el conversor de niveles I2C y el caudalímetro no existen en Wokwi:
  van como etiquetas o se omiten. Sus conexiones reales están en `docs/circuito.md`.

## Usar el banco de pruebas con el ESP32 real

Arduino IDE exige que el `.ino` se llame como su carpeta: copiar `sketch.ino` a una carpeta
`prueba_hardware/prueba_hardware.ino` y subirlo como cualquier sketch. Después volver a cargar
`noidea_esp32`.
