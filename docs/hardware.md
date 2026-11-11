# Hardware del prototipo

Basado en el kit **KA-23** (UCN). Lo que no está en el kit se marca **PENDIENTE**.

## Componentes y uso

| Componente del kit | Uso en NoIdea | Estado |
|---|---|---|
| Arduino Uno + cable USB | Controlador, conectado al PC | En uso |
| Sensor ultrasónico (HC-SR04) | Nivel continuo del estanque (distancia a la superficie) | En uso |
| Sensor de nivel de agua (resistivo) | Respaldo de **nivel crítico**: montado cerca del fondo | En uso |
| Servomotor (modelo por confirmar; se asume SG90) | Abre/cierra una llave pequeña o pinza sobre manguera | En uso |
| Pantalla LCD 16x2 + driver I2C | Estado local: nivel, retiro en curso, mensajes | En uso |
| Protoboard | Montaje | En uso |
| Relé 1 canal | Reservado para futura electroválvula (fuente externa) | Reservado |
| Motor paso a paso + driver (28BYJ-48/ULN2003 probable) | Alternativa al servo si la llave necesita más torque | Opcional |
| Módulo RFID RC522 + tarjeta/llavero | Tarjeta/llavero = **etiqueta del dispensador** que lee el NFC del teléfono. El lector RC522 no se usa por ahora | Etiqueta en uso |
| Teclado 4x4, RTC, DHT, joystick, matriz 8x8, 7 segmentos, micrófono | Sin uso previsto | — |

| No incluido | Consecuencia |
|---|---|
| Caudalímetro (p. ej. YF-S201) | **PENDIENTE.** Volumen entregado = estimación por tiempo × caudal calibrado. Pin D3 (interrupción) reservado. |
| Electroválvula | **PENDIENTE.** Se usa servo sobre llave; el relé queda reservado para ella. |
| Minibomba | No se usa. La salida es por gravedad. |

## Mapa de pines (Arduino Uno)

| Pin | Conexión | Notas |
|---|---|---|
| D5 | Servo — señal (naranja/amarillo) | Alimentación del servo: 5V externo recomendado, GND común con el Uno |
| D7 | HC-SR04 — TRIG | |
| D8 | HC-SR04 — ECHO | |
| D4 | Sensor resistivo — `+` | Se energiza solo al leer (reduce corrosión) |
| A0 | Sensor resistivo — `S` | |
| A4 / A5 | LCD I2C — SDA / SCL | Dirección típica `0x27` (a veces `0x3F`) |
| D2 | Relé — IN | Reservado, el firmware lo mantiene apagado |
| D3 | Caudalímetro — señal | **PENDIENTE**, reservado (INT1) |
| D10–D13 | Libres | Reservados para RC522 (SPI) si se usa a futuro |

Constantes en [`firmware/noidea_controller/config.h`](../firmware/noidea_controller/config.h).

## Alimentación

- Arduino, HC-SR04, LCD y sensor resistivo: 5V del Uno por USB.
- **Servo:** un SG90 puede consumir picos de ~0,6 A al forzar una llave. Usar fuente 5V externa (≥1 A) con GND común;
  si se alimenta temporalmente del Uno, poner un condensador de 470 µF entre 5V y GND cerca del servo.
- No usar la batería de 9V del kit para el servo ni el relé.

## Montaje mecánico sugerido

- **Estanque:** recipiente de paredes rectas (sección constante), p. ej. 5–10 L. Sección constante = conversión lineal.
- **HC-SR04:** en la tapa, mirando hacia abajo, centrado y lejos de paredes. Mantener ≥ 3 cm entre sensor y nivel máximo
  (zona ciega del sensor).
- **Sensor resistivo:** pegado a la pared interior, con la punta a ~2 cm del fondo. Lectura baja = sin agua = crítico.
- **Válvula:** llave de paso pequeña en la salida inferior; el brazo del servo mueve la manija (0° cerrada, ~90° abierta).
  Alternativa: pinza que estrangula una manguera de silicona.
- Bandeja o balde bajo la salida; agua no potable.

## Calibración (obligatoria antes de una demo)

### Nivel
1. Estanque vacío: anotar `d` reportado → `TANK_EMPTY_DISTANCE_MM`.
2. Estanque lleno al máximo de uso: anotar `d` → `TANK_FULL_DISTANCE_MM`.
3. Medir la capacidad real entre ambos puntos con un jarro graduado → `TANK_CAPACITY_L`.
4. Volumen = `capacidad × (vacío − d) / (vacío − lleno)`, acotado a [0, capacidad].

### Sensor resistivo
Leer `b` en seco y sumergido; fijar `BACKUP_DRY_THRESHOLD` en `config.h` entre ambos valores.

### Caudal (sin caudalímetro)
1. Con el estanque a media altura, abrir 10 s y medir lo recolectado (jarro graduado). Repetir 3 veces.
2. Caudal = litros promedio / 10 → `VALVE_FLOW_LPS` en `server/.env`.
3. Repetir con estanque casi lleno y casi vacío: el caudal por gravedad **cambia con la altura del agua**. Anotar la
   variación; es el error esperado de la estimación y debe mencionarse en la demostración.

### Servo
Ajustar `SERVO_CLOSED_DEG` y `SERVO_OPEN_DEG` en `config.h` para que cierre sin forzar y abra completamente.
