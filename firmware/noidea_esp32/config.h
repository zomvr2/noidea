// Configuración del dispensador NoIdea (ESP32 DevKit WROOM-32). Ver docs/hardware.md
#pragma once

// ---- Versión ----------------------------------------------------------------
#define FW_VERSION "0.2.0"
#define PROTO_VERSION 2  // Debe coincidir con PROTOCOL_VERSION en packages/shared

// ---- Pines (ESP32 DevKit WROOM-32) ------------------------------------------
// Evitar: GPIO 0, 2, 12, 15 (arranque), 6-11 (flash) y ADC2 (no funciona con Wi-Fi).
#define PIN_SERVO 18         // señal del servo (servo alimentado con 5V externo, GND común)
#define PIN_US_TRIG 23       // HC-SR04 TRIG (3,3 V basta para disparar)
#define PIN_US_ECHO 19       // HC-SR04 ECHO -> DIVISOR 1k/2k (5 V -> 3,3 V). ¡Obligatorio!
#define PIN_BACKUP_POWER 25  // + del sensor resistivo (se energiza solo al leer)
#define PIN_BACKUP_SIGNAL 34 // S del sensor resistivo (ADC1, solo entrada)
#define PIN_I2C_SDA 21       // LCD I2C
#define PIN_I2C_SCL 22
#define PIN_RELAY 26         // RESERVADO: futura electroválvula. Se mantiene apagado.
#define RELAY_ACTIVE_LOW 1
#define PIN_FLOW 27          // RESERVADO: caudalímetro (PENDIENTE)

// ---- LCD 16x2 I2C -----------------------------------------------------------
#define LCD_ADDRESS 0x27  // si no muestra nada, probar 0x3F (ver tools/i2c_scanner)
#define LCD_COLS 16
#define LCD_ROWS 2

// ---- Servo (válvula) --------------------------------------------------------
#define SERVO_CLOSED_DEG 0
#define SERVO_OPEN_DEG 90
#define SERVO_MIN_US 500
#define SERVO_MAX_US 2400

// ---- Tiempos (deben coincidir con packages/shared) --------------------------
#define MAX_OPEN_MS 60000UL
#define LINK_TIMEOUT_MS 3000UL       // enlace Realtime caído -> cierre
#define COMMAND_MAX_AGE_S 30         // antigüedad máxima de una orden firmada
#define TELEMETRY_INTERVAL_MS 10000UL
#define RUN_REPORT_MS 2000UL
#define BACKUP_CHECK_MS 500UL
#define PHX_HEARTBEAT_MS 25000UL     // heartbeat del protocolo Phoenix (Supabase Realtime)

// ---- Sensor ultrasónico -----------------------------------------------------
#define US_SAMPLES 5
#define US_TIMEOUT_US 25000UL
#define US_SAMPLE_GAP_MS 30
#define US_MIN_MM 20
#define US_MAX_MM 4000

// ---- Sensor resistivo de respaldo (ADC 12 bits: 0-4095) ---------------------
// Lectura menor al umbral = punta seca = nivel crítico. Calibrar en seco y sumergido.
#define BACKUP_DRY_THRESHOLD 1200
