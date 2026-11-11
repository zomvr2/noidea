# Circuito del dispensador (ESP32 DevKit WROOM-32)

Diseño eléctrico derivado de [`firmware/noidea_esp32/config.h`](../firmware/noidea_esp32/config.h) (pines) y de
[`sensors.ino`](../firmware/noidea_esp32/sensors.ino) / [`noidea_esp32.ino`](../firmware/noidea_esp32/noidea_esp32.ino)
(uso de cada pin). **Los pines son los del código; este documento no los cambia.**

- Diagrama Wokwi: [`firmware/wokwi/diagram.json`](../firmware/wokwi/diagram.json) (cómo abrirlo:
  [`firmware/wokwi/README.md`](../firmware/wokwi/README.md)).
- Resumen de hardware y calibración: [hardware.md](hardware.md).

## 1. Qué usa el firmware

| Pin | Constante | Dirección | Uso en el código |
|---|---|---|---|
| GPIO 18 | `PIN_SERVO` | Salida PWM 50 Hz (500–2400 µs) | Servo-válvula: 0° cerrada, 90° abierta |
| GPIO 23 | `PIN_US_TRIG` | Salida | Pulso de 10 µs al TRIG del HC-SR04 |
| GPIO 19 | `PIN_US_ECHO` | Entrada (`pulseIn`) | ECHO del HC-SR04 **a través del divisor** |
| GPIO 25 | `PIN_BACKUP_POWER` | Salida | Alimenta el sensor resistivo **solo durante la lectura** (10 ms) |
| GPIO 34 | `PIN_BACKUP_SIGNAL` | Entrada analógica (ADC1, 11 dB, 12 bits) | Señal del sensor resistivo; `< 1200` = seco |
| GPIO 21 | `PIN_I2C_SDA` | I2C | LCD 16x2 (dirección `0x27`) |
| GPIO 22 | `PIN_I2C_SCL` | I2C | LCD 16x2 |
| GPIO 26 | `PIN_RELAY` | Salida, activo en bajo | Relé **RESERVADO** (se mantiene en ALTO = apagado) |
| GPIO 27 | `PIN_FLOW` | — | Caudalímetro **PENDIENTE**: el código no lo usa; queda sin conectar |
| GPIO 1 / 3 | Serial | USB | Monitor Serie a 115200 (por el cable USB) |

`net.ino` no usa pines: solo Wi-Fi.

## 2. Componentes

| Componente | Cantidad | Estado del dato |
|---|---|---|
| ESP32 DevKit WROOM-32 | 1 | En el repo. **Confirmar** variante: DevKitC de 38 pines (la de Wokwi) o DOIT de 30 pines |
| Sensor ultrasónico HC-SR04 | 1 | En el repo. **Confirmar** que no es HC-SR04**P** (ese funciona a 3,3 V) |
| Sensor de nivel de agua resistivo (módulo `+ / − / S`) | 1 | Modelo **no confirmado** |
| Servomotor | 1 | Modelo **no confirmado**; el repo asume SG90 |
| LCD 16x2 + módulo I2C (PCF8574) | 1 | Dirección 0x27 o 0x3F; pull-ups del módulo **no confirmados** |
| Módulo relé 1 canal | 1 | **Reservado.** Modelo y lógica de disparo **no confirmados** (el código asume activo en bajo) |
| Resistencia 1 kΩ | 1 | Divisor del ECHO |
| Resistencia 2 kΩ (o 2 × 1 kΩ en serie) | 1 | Divisor del ECHO |
| Condensador electrolítico 470 µF, ≥ 10 V | 1 | Junto al servo. **Confirmar** que está en el kit |
| Fuente externa 5 V, ≥ 1 A | 1 | Solo para el servo. Tipo **no confirmado** |
| Conversor de niveles I2C bidireccional (BSS138, 5 V ↔ 3,3 V) | 1 | **Recomendado**, ver §4 |
| Protoboard de 830 puntos y cables dupont | — | Tamaño **no confirmado** |
| Tarjeta/llavero RFID 13,56 MHz | 1 | Sin conexión eléctrica: la lee el NFC del teléfono |

## 3. Tabla de conexiones

Colores usados en el diagrama Wokwi y sugeridos para el montaje:
**rojo** = 5 V del USB · **naranja** = 5 V de la fuente externa · **negro** = GND · resto = señales
(azul SDA, morado SCL, amarillo TRIG, verde claro ECHO, verde PWM, cian señal analógica, magenta
alimentación conmutada del sensor, gris relé).

### Alimentación

| Desde | Hacia | Color | Nota |
|---|---|---|---|
| ESP32 `5V` | Riel **+ superior** | Rojo | 5 V del USB. El ESP32 se alimenta por USB |
| ESP32 `GND` | Riel **− superior** | Negro | |
| Fuente externa `+5 V` | Riel **+ inferior** | Naranja | **Nunca** unir con el riel + superior ni con el pin `5V` del ESP32 |
| Fuente externa `GND` | Riel **− inferior** | Negro | |
| Riel − superior | Riel − inferior | Negro | **Tierra común obligatoria** (sin ella el servo no entiende el PWM) |
| Condensador 470 µF `+` / `−` | Riel + inferior / − inferior | — | Junto al servo; respetar la polaridad (franja = −) |

### Señales y alimentación de cada módulo

| Componente | Pin del componente | Conexión | Color |
|---|---|---|---|
| **LCD I2C** | GND | GND (ESP32 `GND` o riel − superior) | Negro |
| | VCC | Riel + superior (5 V) | Rojo |
| | SDA | GPIO **21** (vía conversor de niveles, ver §4) | Azul |
| | SCL | GPIO **22** (vía conversor de niveles) | Morado |
| **HC-SR04** | VCC | Riel + superior (5 V) | Rojo |
| | TRIG | GPIO **23** directo (3,3 V basta para disparar) | Amarillo |
| | ECHO | **1 kΩ** → nodo → GPIO **19**; nodo → **2 kΩ** → GND | Verde claro |
| | GND | Riel − superior | Negro |
| **Servo** | Señal (naranja/amarillo en SG90) | GPIO **18** | Verde |
| | V+ (rojo) | Riel + **inferior** (5 V externa) | Naranja |
| | GND (marrón/negro) | Riel − **inferior** | Negro |
| **Sensor resistivo** | `+` | GPIO **25** (lo alimenta el pin, 3,3 V) | Magenta |
| | `S` | GPIO **34** | Cian |
| | `−` | Riel − superior | Negro |
| **Relé (reservado)** | VCC | Riel + superior (5 V) | Rojo |
| | GND | Riel − superior | Negro |
| | IN | GPIO **26** | Gris |
| | COM / NO / NC | Sin conectar (futura electroválvula) | — |
| **Caudalímetro** | — | GPIO 27 **sin conectar** (PENDIENTE) | — |

## 4. Verificación de conflictos

### Pines

- Ninguno de los pines usados es de arranque (0, 2, 5, 12, 15) ni de la flash (6–11). ✔
- GPIO 34 es de **solo entrada** y está en el **ADC1**, que sí funciona con Wi-Fi activo. ✔
- GPIO 25, 26 y 27 son del ADC2, pero se usan como **digitales**: no les afecta el Wi-Fi. ✔
- GPIO 1/3 (TX/RX) quedan libres para el USB. ✔
- No hay pines repetidos entre componentes. ✔
- GPIO 34 no tiene resistencias internas: si el cable del sensor se suelta, la entrada queda flotando y puede
  leer "mojado". Opcional: **100 kΩ de GPIO 34 a GND** para que un sensor desconectado lea "seco" (el firmware
  cierra la válvula). Verificar después que la calibración de `BACKUP_DRY_THRESHOLD` sigue siendo válida.

### Tensiones (el ESP32 es de 3,3 V; sus GPIO **no** toleran 5 V)

| Señal | Tensión que llega al ESP32 | Resultado |
|---|---|---|
| ECHO del HC-SR04 (5 V) | 5 V × 2k / (1k + 2k) = **3,33 V** | ✔ con divisor. **Sin divisor: 5 V, daña el GPIO 19** |
| TRIG (salida 3,3 V hacia un módulo de 5 V) | — | ✔ uso habitual; el HC-SR04 dispara con 3,3 V |
| PWM del servo (salida 3,3 V) | — | ✔ uso habitual con SG90. **Confirmar** con el modelo real |
| Sensor resistivo (alimentado a 3,3 V desde GPIO 25) | ≤ 3,3 V | ✔ |
| SDA/SCL del LCD | Hasta **5 V** si el módulo trae pull-ups a 5 V | ⚠ fuera de especificación, ver abajo |
| IN del relé | 3,3 V en ALTO | ⚠ puede no apagar el relé, ver abajo |

**I2C (⚠).** El módulo PCF8574 se alimenta a 5 V y muchos traen resistencias pull-up de SDA/SCL a 5 V; eso deja
5 V en los GPIO 21/22. Además, con VCC = 5 V el PCF8574 espera un ALTO de ≥ 0,7 × 5 V = 3,5 V, más de lo que da el
ESP32. Solución correcta: **conversor de niveles bidireccional** (lado HV a 5 V, lado LV a 3,3 V del ESP32,
GND común) entre el ESP32 y la LCD. Para confirmar si tu módulo trae pull-ups: con la LCD alimentada a 5 V y SDA
**desconectado** del ESP32, medir SDA contra GND; si da ~5 V, los trae.

**Relé (⚠, reservado).** Un módulo activo en bajo alimentado a 5 V suele tener un LED de optoacoplador o un
transistor PNP entre VCC e IN. Con IN = 3,3 V (apagado) quedan ~1,7 V sobre ese LED y algunos módulos no llegan a
soltar. Antes de usarlo: confirmar el modelo. Alternativas: módulo con jumper `JD-VCC` (VCC del lado de control
a 3,3 V), módulo compatible con 3,3 V o transistor de mando. Mientras sea reservado se puede dejar sin conectar.

### Corrientes

| Carga | Fuente | Consumo aproximado | Comentario |
|---|---|---|---|
| ESP32 con Wi-Fi | USB | picos de ~250–350 mA | Valor típico de la familia; depende de la placa |
| LCD con luz de fondo | 5 V USB | ~20–40 mA | Confirmar con el módulo |
| HC-SR04 | 5 V USB | ~15 mA | |
| Relé (si se activa) | 5 V USB | ~70–90 mA | Bobina típica de 5 V; reservado, normalmente apagado |
| Sensor resistivo | **GPIO 25** | pocos mA | **Confirmar**; mantener ≤ ~12 mA por GPIO (máx. absoluto 40 mA). Si consume más, conmutarlo con un transistor |
| Servo SG90 | **Fuente externa** | ~100–250 mA moviéndose; hasta ~0,7 A bloqueado | Por eso va con fuente propia ≥ 1 A y condensador |

Con el relé apagado, el puerto USB (500 mA) alcanza. El servo **nunca** se alimenta del USB, del pin `3V3` ni de la
batería de 9 V.

### Conexiones prohibidas

- Fuente externa de 5 V al pin `5V` del ESP32 mientras el USB está conectado (retroalimenta el puerto del PC).
- Riel + superior con riel + inferior.
- ECHO directo a GPIO 19.
- Cualquier señal de 5 V a un GPIO.

## 5. Resistencias, drivers, fuentes y protecciones

| Elemento | Valor | Dónde | Por qué |
|---|---|---|---|
| R1 | 1 kΩ | ECHO → GPIO 19 | Divisor 5 V → 3,33 V (obligatorio) |
| R2 | 2 kΩ (o 2 × 1 kΩ) | GPIO 19 → GND | Divisor (obligatorio). Con 2,2 kΩ da 3,44 V: sirve, pero queda más justo |
| C1 | 470 µF ≥ 10 V electrolítico | V+ / GND del servo | Absorbe los picos del servo (obligatorio en este diseño) |
| C2 (opcional) | 100 nF cerámico | En paralelo con C1 | Filtra ruido de alta frecuencia |
| R3 (opcional) | 100 kΩ | GPIO 34 → GND | Sensor desconectado = "seco" (falla segura) |
| Conversor I2C | BSS138 4 canales | Entre ESP32 y LCD | Niveles 3,3 V ↔ 5 V (recomendado) |
| Fuente externa | 5 V ≥ 1 A | Riel inferior | Solo servo, GND común con el ESP32 |
| Driver del relé | Según módulo | — | Reservado; ver §4 |

No hay protección por fusible ni diodos en el diseño actual; para un prototipo de banco con 5 V no es
imprescindible. El servo es un motor con su propio driver interno: no necesita diodo de rueda libre.

## 6. Qué no existe en Wokwi y cómo se representa

| Real | En el diagrama Wokwi | Diferencia |
|---|---|---|
| Sensor de nivel resistivo | `wokwi-potentiometer` (`water_sensor`): VCC→GPIO 25, SIG→GPIO 34, GND | El potenciómetro de Wokwi lee igual aunque GPIO 25 esté apagado (no simula el corte de alimentación). Girarlo simula seco/mojado |
| Fuente externa 5 V | Riel inferior de la protoboard + etiqueta | Wokwi no modela fuentes; el servo se mueve igual |
| Condensador 470 µF | Solo etiqueta | No existe la pieza |
| Conversor de niveles I2C | No aparece (SDA/SCL directos) | En el montaje real va entre el ESP32 y la LCD |
| Caudalímetro | No aparece; GPIO 27 libre | PENDIENTE |
| Etiqueta RFID/NFC | No aparece | No tiene conexión eléctrica |
| Relé activo en bajo | `wokwi-relay-module` con `transistor: "pnp"` | Polaridad no verificada en el simulador |

El divisor del ECHO sí se dibuja con dos resistencias. Se comprobó en Wokwi con un sketch mínimo que, con el
divisor, `pulseIn` en GPIO 19 mide 1008 mm cuando el HC-SR04 está a 100 cm, que la LCD responde en `0x27` y que el
ADC del GPIO 34 lee el potenciómetro.

## 7. Montaje en protoboard (paso a paso)

Trabajar **sin alimentación** (USB y fuente externa desconectados) hasta el paso 9.

1. **Rieles.** Revisar si los rieles de la protoboard están cortados a la mitad (línea roja/azul interrumpida). Si
   lo están, puentear cada mitad o usar solo una mitad. Designar: riel superior = 5 V USB / GND; riel inferior =
   5 V externa / GND. Marcar el inferior con cinta para no confundirlos.
2. **ESP32.** Insertarlo a caballo sobre la ranura central. En una protoboard de 830 puntos el DevKit suele dejar
   solo una fila libre por lado (o ninguna en un lado, según el modelo); si no queda espacio, usar dos protoboards
   unidas o conectar el ESP32 con cables dupont hembra-macho. Ubicar los pines por la serigrafía de la placa, no
   por posición (la DevKitC de 38 pines y la de 30 pines tienen distinto orden).
3. **Bus de 5 V USB.** Cable rojo de `5V` del ESP32 al riel + superior; cable negro de `GND` al riel − superior.
4. **Divisor del ECHO.** En una columna libre (nodo): R1 (1 kΩ) entre la columna del ECHO y el nodo; R2 (2 kΩ)
   entre el nodo y el riel − superior; cable verde claro del nodo a GPIO 19. **Medir** antes de seguir (paso 10).
5. **HC-SR04.** VCC al riel + superior, GND al riel − superior, TRIG a GPIO 23, ECHO a la columna de R1.
6. **LCD I2C.** VCC al riel +, GND al riel −. Con conversor: lado HV a 5 V, LV al `3V3` del ESP32, GND común;
   SDA/SCL del ESP32 (21/22) al lado LV y SDA/SCL de la LCD al lado HV. Sin conversor (fuera de especificación):
   SDA → 21, SCL → 22.
7. **Sensor resistivo.** `+` a GPIO 25, `S` a GPIO 34, `−` al riel − superior. (Opcional: 100 kΩ de GPIO 34 a GND.)
8. **Servo.** Señal a GPIO 18. V+ al riel + **inferior**, GND al riel − **inferior**. C1 470 µF entre ambos rieles
   inferiores, cerca del conector del servo, franja (−) al riel −. Cable negro entre riel − superior y riel −
   inferior (tierra común).
9. **Relé (opcional, reservado).** VCC al riel + superior, GND al riel −, IN a GPIO 26. Nada en COM/NO/NC.
10. **Comprobaciones sin alimentar** (multímetro en continuidad): riel + superior y riel + inferior **no** deben
    tener continuidad entre sí; ninguno de los dos con GND; los dos rieles − sí deben tener continuidad.
11. **Primer encendido solo con USB** (fuente externa apagada). Medir: riel + superior ≈ 5 V. Probar el divisor:
    con el cable del ECHO **desconectado** de R1, llevar la entrada de R1 al riel + superior con un cable y medir el
    nodo contra GND: debe dar ≈ 3,3 V (nunca más de 3,4 V). Quitar ese cable y volver a conectar el ECHO.
    Cargar el banco de pruebas ([`firmware/wokwi/sketch.ino`](../firmware/wokwi/sketch.ino)) y usar `level`.
12. **Encender la fuente externa** y probar el servo con `open` / `close`. Ajustar la mecánica de la llave antes de
    cargar el firmware real.
13. Calibrar según [hardware.md](hardware.md#calibración-obligatoria-antes-de-una-demo).

## 8. Datos por confirmar

1. Variante del ESP32 DevKit (38 o 30 pines). Los GPIO no cambian, la posición física sí.
2. Modelo del servo: rango de pulso (el código usa 500–2400 µs), consumo y torque sobre la llave.
3. Módulo de la LCD: dirección I2C (0x27 / 0x3F) y si trae pull-ups a 5 V.
4. Sensor resistivo: modelo, consumo a 3,3 V y si su salida es directa o por transistor.
5. Módulo relé: lógica (activo en bajo según el código), tensión de bobina, si tiene optoacoplador/`JD-VCC`.
6. Fuente externa: tipo y corriente nominal (≥ 1 A).
7. HC-SR04 o HC-SR04P. Con el P alimentado a 3,3 V el divisor no hace falta (pero no estorba).
8. Si el kit trae condensador de 470 µF y resistencias de 2 kΩ.
9. Caudalímetro (PENDIENTE): modelo. Si es tipo YF-S201 (Hall de colector abierto), su pull-up debe ir a 3,3 V.
10. Protoboard: tamaño y si los rieles están cortados.
