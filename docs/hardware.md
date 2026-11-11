# Hardware del prototipo

Controlador: **ESP32 DevKit (WROOM-32)**, conectado por Wi-Fi. Componentes del kit **KA-23** (UCN).
Lo que no está disponible se marca **PENDIENTE**. El Arduino Uno del kit ya no se usa.

## Componentes y uso

| Componente | Uso en NoIdea | Estado |
|---|---|---|
| ESP32 DevKit WROOM-32 | Controlador con Wi-Fi | En uso |
| Sensor ultrasónico (HC-SR04) | Nivel continuo (distancia a la superficie) | En uso |
| Sensor de nivel de agua (resistivo) | Respaldo de **nivel crítico**, cerca del fondo | En uso |
| Servomotor (modelo por confirmar; se asume SG90) | Abre/cierra una llave pequeña o pinza sobre manguera | En uso |
| LCD 16x2 + driver I2C | Estado local | En uso |
| Tarjeta/llavero RFID del kit (13,56 MHz) | **Etiqueta del estanque** que lee el NFC del teléfono | En uso |
| Relé 1 canal | Reservado para futura electroválvula | Reservado |
| Motor paso a paso + driver | Alternativa al servo si falta torque | Opcional |
| Lector RC522, teclado, RTC, DHT, joystick, matrices, micrófono, Arduino Uno | Sin uso | — |

| No disponible | Consecuencia |
|---|---|
| Caudalímetro | **PENDIENTE.** Volumen = tiempo × caudal calibrado (estimado). GPIO 27 reservado. |
| Electroválvula | **PENDIENTE.** Servo sobre llave; relé reservado (GPIO 26). |

## Mapa de pines (ESP32 DevKit WROOM-32)

| GPIO | Conexión | Notas |
|---|---|---|
| 18 | Servo — señal | Servo alimentado con **5 V externo**, GND común |
| 23 | HC-SR04 — TRIG | 3,3 V basta para disparar |
| 19 | HC-SR04 — ECHO | **Divisor obligatorio**: ECHO → 1 kΩ → GPIO19 → 2 kΩ → GND (5 V → 3,3 V) |
| 25 | Sensor resistivo — `+` | Se energiza solo al leer (reduce corrosión); alimentado a 3,3 V |
| 34 | Sensor resistivo — `S` | ADC1 (funciona con Wi-Fi); solo entrada |
| 21 / 22 | LCD I2C — SDA / SCL | Ver nota de niveles abajo |
| 26 | Relé — IN | Reservado, apagado |
| 27 | Caudalímetro | **PENDIENTE**, reservado |

No usar: GPIO 0, 2, 12, 15 (arranque), 6–11 (flash interna) ni pines ADC2 (no leen con Wi-Fi activo).
Constantes en [`firmware/noidea_esp32/config.h`](../firmware/noidea_esp32/config.h).

## Alimentación y niveles lógicos

- ESP32 por USB (o 5 V en VIN). HC-SR04 y LCD a **5 V** (pin VIN/5V del DevKit cuando va por USB).
- **El ESP32 trabaja a 3,3 V y sus GPIO no toleran 5 V.**
  - ECHO del HC-SR04: divisor de tensión (arriba). Alternativa: módulo HC-SR04P que funciona a 3,3 V.
  - LCD I2C: el driver PCF8574 trae resistencias pull-up a 5 V. Lo correcto es un conversor de niveles
    bidireccional para SDA/SCL (o retirar los pull-up del driver y usar los de 3,3 V). Muchos montajes funcionan sin
    él, pero queda fuera de especificación.
- **Servo:** fuente 5 V externa (≥ 1 A) con GND común; condensador de 470 µF cerca del servo. Nunca desde 3V3.
- No usar la batería de 9 V del kit para el servo ni el relé.

## Montaje mecánico sugerido

- **Estanque:** recipiente de paredes rectas, 5–10 L. HC-SR04 en la tapa mirando hacia abajo, ≥ 3 cm sobre el nivel
  máximo (zona ciega).
- **Sensor resistivo:** pared interior, punta a ~2 cm del fondo.
- **Válvula:** llave de paso en la salida inferior; brazo del servo sobre la manija (0° cerrada, ~90° abierta).
- **Etiqueta NFC:** pegada en el dispensador, accesible para el teléfono, lejos de metal.
- Bandeja o balde bajo la salida; agua no potable.

## Calibración (obligatoria antes de una demo)

La calibración del estanque vive en la tabla `tanks` (`capacity_l`, `empty_distance_mm`, `full_distance_mm`,
`flow_lps`, `critical_percent`). Para leer valores en banco: Monitor Serie a 115200, comando `level`.

1. **Nivel:** anotar `d` con el estanque vacío y lleno → `empty_distance_mm` / `full_distance_mm`; medir con jarro
   graduado la capacidad entre ambos → `capacity_l`.
2. **Respaldo:** leer el valor en seco y sumergido; fijar `BACKUP_DRY_THRESHOLD` (config.h) entre ambos.
3. **Caudal:** abrir 10 s a media altura y medir lo recolectado (3 veces) → `flow_lps`. Repetir casi lleno y casi
   vacío: el caudal por gravedad cambia con la altura; esa variación es el error de la estimación y se informa.
4. **Servo:** ajustar `SERVO_CLOSED_DEG` / `SERVO_OPEN_DEG`.
5. **LCD:** si no muestra nada, `firmware/tools/i2c_scanner` y ajustar `LCD_ADDRESS`.
6. **Ubicación:** con la app (admin) junto al estanque: «Ubicar estanque» y escanear la etiqueta.
