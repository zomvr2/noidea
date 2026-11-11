// Banco de pruebas del cableado NoIdea (Wokwi y montaje real).
//
// NO es el firmware del dispensador: no usa Wi-Fi, Supabase ni órdenes firmadas.
// Solo comprueba que cada componente responde en los pines de firmware/noidea_esp32/config.h.
// Si cambias un pin en config.h, cámbialo también aquí.
//
// Monitor Serie a 115200. Comandos: open | close | level | relay-test
//   - El servo NO se mueve solo: hay que pedirlo con "open"/"close".
//   - "relay-test" activa el relé 1 s (en el montaje real, solo sin carga conectada).
//
// Librerías: ESP32Servo, LiquidCrystal I2C (Frank de Brabander). Placa: ESP32 Dev Module.

#include <ESP32Servo.h>
#include <LiquidCrystal_I2C.h>
#include <Wire.h>

// ---- Copia de los pines de config.h ----
#define PIN_SERVO 18
#define PIN_US_TRIG 23
#define PIN_US_ECHO 19
#define PIN_BACKUP_POWER 25
#define PIN_BACKUP_SIGNAL 34
#define PIN_I2C_SDA 21
#define PIN_I2C_SCL 22
#define PIN_RELAY 26
#define RELAY_ACTIVE_LOW 1
#define LCD_ADDRESS 0x27
#define SERVO_CLOSED_DEG 0
#define SERVO_OPEN_DEG 90
#define SERVO_MIN_US 500
#define SERVO_MAX_US 2400
#define BACKUP_DRY_THRESHOLD 1200

Servo valve;
LiquidCrystal_I2C lcd(LCD_ADDRESS, 16, 2);
bool valveOpen = false;

void relayOff() { digitalWrite(PIN_RELAY, RELAY_ACTIVE_LOW ? HIGH : LOW); }
void relayOn() { digitalWrite(PIN_RELAY, RELAY_ACTIVE_LOW ? LOW : HIGH); }

uint16_t readDistanceMm() {
  digitalWrite(PIN_US_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_US_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_US_TRIG, LOW);
  unsigned long us = pulseIn(PIN_US_ECHO, HIGH, 25000UL);
  return (uint16_t)((us * 343UL) / 2000UL);  // 0 = sin eco
}

int readBackupRaw() {
  digitalWrite(PIN_BACKUP_POWER, HIGH);
  delay(10);
  int v = analogRead(PIN_BACKUP_SIGNAL);
  digitalWrite(PIN_BACKUP_POWER, LOW);
  return v;
}

void showStatus() {
  uint16_t d = readDistanceMm();
  int raw = readBackupRaw();
  Serial.printf("d=%u mm  respaldo=%d (%s)  valvula=%s\n", d, raw,
                raw < BACKUP_DRY_THRESHOLD ? "SECO" : "mojado", valveOpen ? "abierta" : "cerrada");
  char row[17];
  if (d == 0) snprintf(row, sizeof(row), "d=sin eco       ");
  else snprintf(row, sizeof(row), "d=%-5umm       ", d);
  lcd.setCursor(0, 0);
  lcd.print(row);
  snprintf(row, sizeof(row), "S=%-4d %s ", raw, valveOpen ? "ABIERTA" : "CERRADA");
  lcd.setCursor(0, 1);
  lcd.print(row);
}

void setup() {
  pinMode(PIN_RELAY, OUTPUT);
  relayOff();
  valve.setPeriodHertz(50);
  valve.attach(PIN_SERVO, SERVO_MIN_US, SERVO_MAX_US);
  valve.write(SERVO_CLOSED_DEG);

  Serial.begin(115200);
  pinMode(PIN_US_TRIG, OUTPUT);
  digitalWrite(PIN_US_TRIG, LOW);
  pinMode(PIN_US_ECHO, INPUT);
  pinMode(PIN_BACKUP_POWER, OUTPUT);
  digitalWrite(PIN_BACKUP_POWER, LOW);
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_BACKUP_SIGNAL, ADC_11db);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcd.print("NoIdea: prueba");
  Serial.println("Banco de pruebas NoIdea. Comandos: open | close | level | relay-test");
}

void loop() {
  static unsigned long last = 0;
  static char buf[16];
  static uint8_t len = 0;

  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\r') continue;
    if (ch != '\n') {
      if (len < sizeof(buf) - 1) buf[len++] = ch;
      continue;
    }
    buf[len] = '\0';
    len = 0;
    if (strcmp(buf, "open") == 0) {
      valve.write(SERVO_OPEN_DEG);
      valveOpen = true;
    } else if (strcmp(buf, "close") == 0) {
      valve.write(SERVO_CLOSED_DEG);
      valveOpen = false;
    } else if (strcmp(buf, "relay-test") == 0) {
      Serial.println("Rele ON 1 s");
      relayOn();
      delay(1000);
      relayOff();
    } else if (strcmp(buf, "level") != 0 && buf[0]) {
      Serial.println("Comandos: open | close | level | relay-test");
    }
    showStatus();
  }

  if (millis() - last >= 2000) {
    last = millis();
    showStatus();
  }
  delay(10);
}
