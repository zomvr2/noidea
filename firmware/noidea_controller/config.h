// Configuración del controlador NoIdea (Arduino Uno). Ver docs/hardware.md
#pragma once

// ---- Versión ----------------------------------------------------------------
#define FW_VERSION "0.1.0"
#define PROTO_VERSION 1  // Debe coincidir con PROTOCOL_VERSION en packages/shared

// ---- Serial -----------------------------------------------------------------
#define SERIAL_BAUD 115200
#define LINE_MAX 63  // caracteres por línea (sin \n)

// ---- Pines ------------------------------------------------------------------
#define PIN_SERVO 5          // señal del servo (alimentación 5V externa, GND común)
#define PIN_US_TRIG 7        // HC-SR04 TRIG
#define PIN_US_ECHO 8        // HC-SR04 ECHO
#define PIN_BACKUP_POWER 4   // + del sensor resistivo (se energiza solo al leer)
#define PIN_BACKUP_SIGNAL A0 // S del sensor resistivo
#define PIN_RELAY 2          // RESERVADO: futura electroválvula. Se mantiene apagado.
#define RELAY_ACTIVE_LOW 1   // la mayoría de módulos de relé se activan con LOW
// D3: reservado para caudalímetro (PENDIENTE). D10-D13: reservados para RC522 (SPI).
// A4/A5: I2C de la LCD.

// ---- LCD 16x2 I2C -----------------------------------------------------------
#define LCD_ADDRESS 0x27  // si no muestra nada, probar 0x3F (usar un escáner I2C)
#define LCD_COLS 16
#define LCD_ROWS 2

// ---- Servo (válvula) --------------------------------------------------------
#define SERVO_CLOSED_DEG 0  // ajustar para que cierre sin forzar
#define SERVO_OPEN_DEG 90   // ajustar para apertura completa

// ---- Tiempos de seguridad ---------------------------------------------------
#define MAX_OPEN_MS 60000UL      // tope absoluto de apertura
#define LINK_TIMEOUT_MS 3000UL   // cierre si no llega nada del servidor
#define RUN_REPORT_MS 500UL      // cada cuánto se informa RUN
#define LEVEL_INTERVAL_MS 2000UL // cada cuánto se informa LVL
#define BACKUP_CHECK_MS 500UL    // revisión del sensor de respaldo con válvula abierta

// ---- Sensor ultrasónico -----------------------------------------------------
#define US_SAMPLES 5             // lecturas por medición (se usa la mediana)
#define US_TIMEOUT_US 25000UL    // ~4 m ida y vuelta
#define US_SAMPLE_GAP_MS 30
#define US_MIN_MM 20             // zona ciega / lecturas absurdas
#define US_MAX_MM 4000

// ---- Sensor resistivo de respaldo -------------------------------------------
// Lectura menor al umbral = sin agua en la punta del sensor = nivel crítico.
// Calibrar: leer `b` en seco y sumergido, y dejar el umbral entre ambos.
#define BACKUP_DRY_THRESHOLD 300
