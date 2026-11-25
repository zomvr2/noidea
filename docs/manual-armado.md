# Manual de armado del dispensador

Guía paso a paso para armar el dispensador NoIdea con el **kit KA-23 + ESP32 DevKit V1 (30 pines)**, probarlo y
cargarle el firmware. Describe el **montaje actual** (solo con lo que trae el kit). El diseño eléctrico completo,
con el porqué de cada valor, está en [circuito.md](circuito.md); la calibración, en [hardware.md](hardware.md).

> ⚠ Arma **todo sin alimentación** (sin USB ni batería) hasta el paso 8. Usa agua **no potable**.

## 1. Materiales

| Pieza | Cant. | Nota |
|---|---|---|
| ESP32 DevKit V1 (30 pines) | 1 | Queda **fuera** de la protoboard, conectado con cables dupont hembra |
| Sensor ultrasónico HC-SR04 | 1 | Mide el nivel desde la tapa |
| Sensor de nivel de agua resistivo (`+ / − / S`) | 1 | Respaldo de nivel crítico |
| Servomotor (se asume SG90) | 1 | Mueve la llave de paso |
| LCD 16x2 con módulo I2C | 1 | 4 pines: GND, VCC, SDA, SCL |
| Resistencias de 1,5 kΩ | 3 | Divisor de tensión del ECHO (obligatorio) |
| Arduino UNO del kit + su cable USB | 1 | **Sin programa**: solo reparte 5 V al servo |
| Batería portátil (power bank) USB | 1 | Alimenta el UNO → servo |
| Cable micro-USB de datos | 1 | ESP32 ↔ PC (programar y Monitor Serie) |
| Protoboard y cables dupont (M-M y H-M) | — | |
| Tarjeta o llavero RFID del kit | 1 | Etiqueta del estanque (la lee el NFC del teléfono) |
| Recipiente de paredes rectas 5–10 L, llave de paso pequeña, balde | — | Parte mecánica |

En la placa los pines se llaman `D19`, `D23`, etc. (= GPIO 19, GPIO 23) y el pin de 5 V se llama `VIN`.

## 2. Esquema de conexiones

```
                     PROTOBOARD
   riel + SUPERIOR (5 V del USB del ESP32) ─── rojo
   riel − SUPERIOR (GND) ───────────────────── negro
   riel + INFERIOR (5 V del UNO) ───────────── naranja   ← SOLO el servo
   riel − INFERIOR (GND) ───────────────────── negro
   (los dos rieles − unidos entre sí; los dos rieles + NUNCA)

ESP32 VIN ──── riel + sup.            UNO 5V  ──── riel + inf.
ESP32 GND ──── riel − sup.            UNO GND ──── riel − inf.

HC-SR04  VCC ── riel + sup.   GND ── riel − sup.   TRIG ── D23
         ECHO ── 1,5 kΩ ──┬── D19
                          └── 1,5 kΩ ── 1,5 kΩ ── riel − sup.

LCD I2C  VCC ── riel + sup.   GND ── riel − sup.   SDA ── D21   SCL ── D22

Sensor resistivo  + ── D25    S ── D34    − ── riel − sup.

Servo  señal (naranja) ── D18    rojo ── riel + INF.    marrón ── riel − INF.
```

| Desde | Hacia |
|---|---|
| ESP32 `VIN` / `GND` | Riel + / − superior |
| UNO `5V` / `GND` | Riel + / − inferior |
| Riel − superior | Riel − inferior (tierra común) |
| HC-SR04 `VCC` / `GND` / `TRIG` | Riel + sup. / riel − sup. / `D23` |
| HC-SR04 `ECHO` | Divisor → `D19` (ver paso 4) |
| LCD `VCC` / `GND` / `SDA` / `SCL` | Riel + sup. / riel − sup. / `D21` / `D22` |
| Sensor resistivo `+` / `S` / `−` | `D25` / `D34` / riel − sup. |
| Servo señal / rojo / marrón | `D18` / riel + inf. / riel − inf. |

El relé (GPIO 26) está **reservado**: no se conecta. El diagrama equivalente se puede abrir en Wokwi:
[firmware/wokwi/README.md](../firmware/wokwi/README.md).

## 3. Paso a paso

1. **Rieles.** Mira si la línea roja/azul de los rieles se corta a la mitad de la protoboard; si es así, puentea
   cada mitad. Marca con cinta el riel **inferior** (será el 5 V del servo) para no confundirlo.
2. **Alimentación del ESP32.** Cable rojo de `VIN` al riel + superior; negro de `GND` al riel − superior.
3. **Tierra común.** Cable negro entre el riel − superior y el riel − inferior. Sin esto el servo no obedece.
4. **Divisor del ECHO** (obligatorio: el ESP32 es de 3,3 V y el ECHO entrega 5 V).
   - Resistencia A (1,5 kΩ): de una columna libre «ECHO» a otra columna «nodo».
   - Resistencias B y C (1,5 kΩ cada una, en serie): del «nodo» al riel − superior.
   - Cable del «nodo» a `D19`.
   Resultado: 5 V × 3 kΩ / 4,5 kΩ ≈ 3,33 V en `D19`. **Nunca** conectes ECHO directo a `D19`.
5. **HC-SR04.** `VCC` al riel + superior, `GND` al riel − superior, `TRIG` a `D23`, `ECHO` a la columna «ECHO».
6. **LCD.** `VCC` al riel + superior, `GND` al riel − superior, `SDA` a `D21`, `SCL` a `D22`.
7. **Sensor resistivo.** `+` a `D25`, `S` a `D34`, `−` al riel − superior.
8. **Servo.** Señal a `D18`, rojo al riel + **inferior**, marrón al riel − **inferior**.
   **UNO:** pin `5V` al riel + inferior y `GND` al riel − inferior. Usa `5V`; nunca `VIN` ni `3.3V` del UNO.

## 4. Comprobaciones antes de encender

Con el multímetro en continuidad (sin nada enchufado):

- [ ] Riel + superior y riel + inferior: **sin** continuidad.
- [ ] Ningún riel + con continuidad a GND.
- [ ] Los dos rieles −: **con** continuidad.
- [ ] `ECHO` no toca `D19` directamente (solo a través de la resistencia A).

Primer encendido **solo con el USB del ESP32** (batería desconectada): el riel + superior debe marcar ≈ 5 V.
Para probar el divisor: desconecta el cable de `ECHO`, lleva la columna «ECHO» al riel + superior con un cable y mide
el «nodo» contra GND: **≈ 3,3 V** (nunca más de 3,4 V). Quita ese cable y vuelve a conectar `ECHO`.

## 5. Preparar Arduino IDE (una sola vez)

1. Instala **Arduino IDE 2**.
2. *Archivo → Preferencias → URLs adicionales de gestor de placas*:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. *Gestor de placas* → instala **esp32** (de Espressif, versión 3.x).
4. *Gestor de librerías* → instala: **ESP32Servo**, **LiquidCrystal I2C** (Frank de Brabander),
   **WebSockets** (Markus Sattler) y **ArduinoJson** (7.x).
5. Placa: **ESP32 Dev Module**. Puerto: el COM que aparece al enchufar el ESP32 (si no aparece, instala el driver
   CP210x o CH340 según el chip USB de tu placa y usa un cable de datos, no solo de carga).

## 6. Prueba de banco (sin nube)

Antes del firmware real, prueba el cableado con el sketch de banco
[`firmware/wokwi/sketch.ino`](../firmware/wokwi/sketch.ino). Al abrirlo, el IDE pedirá moverlo a una carpeta
`sketch/`: acepta. Súbelo y abre el **Monitor Serie a 115200** (fin de línea: *Nueva línea*).

| Escribe | Qué debe pasar |
|---|---|
| `level` | Muestra la distancia del HC-SR04 (pon la mano a ~10 cm: ≈ 100 mm) y la lectura del sensor resistivo |
| `open` / `close` | El servo gira a 90° / 0°. Conecta antes la batería al UNO |

- **LCD en blanco o solo cuadrados:** gira el potenciómetro azul del módulo I2C (contraste). Si sigue sin texto,
  sube [`firmware/tools/i2c_scanner`](../firmware/tools/i2c_scanner) y cambia `LCD_ADDRESS` (0x27 o 0x3F) en
  `sketch.ino` y en `firmware/noidea_esp32/config.h`.
- **`d=sin eco`:** revisa `TRIG`/`ECHO` y el divisor. Ya hubo un HC-SR04 del kit dañado: si todo mide bien con el
  multímetro, cambia el sensor.
- **El ESP32 se reinicia al mover el servo:** el servo está tomando corriente del riel superior; revisa que su rojo
  vaya al riel **inferior**. Si persiste, agrega un condensador de 470 µF entre los rieles inferiores (franja al −).
- **El servo no se mueve:** falta la tierra común (paso 3) o la batería se apagó sola por bajo consumo.

## 7. Cargar el firmware real

1. Copia `firmware/noidea_esp32/secrets.example.h` como `firmware/noidea_esp32/secrets.h` y complétalo con:
   - `WIFI_SSID` / `WIFI_PASSWORD`: red de **2,4 GHz** (el ESP32 no se conecta a 5 GHz; un hotspot del celular sirve).
   - `API_HOST`, `SUPABASE_HOST`, `SUPABASE_PUBLISHABLE_KEY`, `DEVICE_ID`, `DEVICE_SECRET_HEX`: te los pasa el
     responsable del proyecto por un canal privado (no están en GitHub).
   `secrets.h` está en `.gitignore`: **nunca lo subas**.
2. Abre `firmware/noidea_esp32/noidea_esp32.ino`, placa **ESP32 Dev Module**, puerto COM → **Subir**.
3. Monitor Serie a 115200: escribe `status` y verifica que Wi-Fi y el enlace Realtime estén conectados.
   La LCD muestra el estado del estanque.

## 8. Montaje mecánico

- **Estanque:** recipiente de paredes rectas (5–10 L). HC-SR04 en la tapa mirando hacia abajo, al menos **3 cm**
  sobre el nivel máximo del agua.
- **Sensor resistivo:** pegado a la pared interior, con la punta a ~2 cm del fondo. Sus cables y la electrónica,
  fuera del agua.
- **Válvula:** llave de paso en la salida inferior; brazo del servo sobre la manija (0° = cerrada, ~90° = abierta).
  Ajusta `SERVO_CLOSED_DEG` / `SERVO_OPEN_DEG` en `config.h` si no cierra del todo.
- **Etiqueta NFC:** pegada en el dispensador, lejos de metal.
- Bandeja o balde bajo la salida. Electrónica **por encima** del nivel del agua.

Después: **calibrar** (obligatorio antes de una demo) según
[hardware.md → Calibración](hardware.md#calibración-obligatoria-antes-de-una-demo).

## 9. Seguridad

- El servo nunca se alimenta desde `3V3` ni `VIN` del ESP32, ni con la batería de 9 V del kit.
- Nunca unas el riel + superior con el inferior.
- El firmware cierra la válvula sola ante: tiempo cumplido, orden `STOP`, pérdida de conexión 3 s, sensor de
  respaldo seco o 60 s abierta. No quites esas protecciones.
- Si la llave se traba, el fusible USB del UNO (~500 mA) corta y el UNO se reinicia: desbloquea la llave antes de
  seguir.
