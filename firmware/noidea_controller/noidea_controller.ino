// NoIdea — controlador del dispensador (Arduino Uno)
//
// Responsabilidades: medir nivel (HC-SR04 + sensor resistivo de respaldo), abrir/cerrar la
// válvula con un servo, mostrar estado en LCD 16x2 I2C y hablar el protocolo serial v1
// (docs/protocolo-serial.md). NO conoce familias, cuentas ni saldos.
//
// Seguridad local: la válvula se cierra por tiempo cumplido, STOP, pérdida de enlace (3 s),
// sensor de respaldo seco o tope de 60 s. No quitar estas protecciones.
//
// Librerías: Servo (incluida en el IDE), LiquidCrystal I2C (Frank de Brabander).

#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "config.h"

Servo valve;
LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS);

// ---- Estado ------------------------------------------------------------------
char lineBuf[LINE_MAX + 1];
uint8_t lineLen = 0;
bool lineOverflow = false;

unsigned long lastRxMs = 0;
unsigned long lastLevelMs = 0;

bool valveOpen = false;
uint32_t activeId = 0;
unsigned long openStartMs = 0;
unsigned long openTargetMs = 0;
unsigned long lastRunReportMs = 0;
unsigned long lastBackupCheckMs = 0;

char lcdRows[LCD_ROWS][LCD_COLS + 1] = {"NoIdea", "Esperando srv"};

// ---- Utilidades ----------------------------------------------------------------
void lcdShowRow(uint8_t row, const char *text) {
  lcd.setCursor(0, row);
  uint8_t i = 0;
  for (; i < LCD_COLS && text[i]; i++) lcd.print(text[i]);
  for (; i < LCD_COLS; i++) lcd.print(' ');  // limpia el resto de la fila
}

void lcdRestore() {
  for (uint8_t r = 0; r < LCD_ROWS; r++) lcdShowRow(r, lcdRows[r]);
}

void relayOff() {
  digitalWrite(PIN_RELAY, RELAY_ACTIVE_LOW ? HIGH : LOW);
}

// Lectura del sensor resistivo. Se energiza solo durante la lectura para reducir corrosión.
int readBackupRaw() {
  digitalWrite(PIN_BACKUP_POWER, HIGH);
  delay(10);
  int v = analogRead(PIN_BACKUP_SIGNAL);
  digitalWrite(PIN_BACKUP_POWER, LOW);
  return v;
}

// Distancia en mm con mediana de US_SAMPLES pulsos. Devuelve 0 si no hay lectura válida.
uint16_t readDistanceMm() {
  uint16_t samples[US_SAMPLES];
  uint8_t n = 0;
  for (uint8_t i = 0; i < US_SAMPLES; i++) {
    digitalWrite(PIN_US_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_US_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_US_TRIG, LOW);
    unsigned long us = pulseIn(PIN_US_ECHO, HIGH, US_TIMEOUT_US);
    // velocidad del sonido ~343 m/s => mm = us * 0.343 / 2
    uint32_t mm = (us * 343UL) / 2000UL;
    if (us > 0 && mm >= US_MIN_MM && mm <= US_MAX_MM) samples[n++] = (uint16_t)mm;
    delay(US_SAMPLE_GAP_MS);
  }
  if (n == 0) return 0;
  // ordenamiento por inserción (n <= 5)
  for (uint8_t i = 1; i < n; i++) {
    uint16_t k = samples[i];
    int8_t j = i - 1;
    while (j >= 0 && samples[j] > k) { samples[j + 1] = samples[j]; j--; }
    samples[j + 1] = k;
  }
  return samples[n / 2];
}

void reportLevel() {
  uint16_t d = readDistanceMm();
  int b = readBackupRaw();
  uint8_t low = b < BACKUP_DRY_THRESHOLD ? 1 : 0;
  if (d == 0) {
    Serial.print(F("LVL err=NO_ECHO b="));
  } else {
    Serial.print(F("LVL d="));
    Serial.print(d);
    Serial.print(F(" b="));
  }
  Serial.print(b);
  Serial.print(F(" low="));
  Serial.println(low);
}

// ---- Válvula -------------------------------------------------------------------
void openValve(uint32_t id, unsigned long ms) {
  valve.write(SERVO_OPEN_DEG);
  valveOpen = true;
  activeId = id;
  openStartMs = millis();
  openTargetMs = ms;
  lastRunReportMs = openStartMs;
  lastBackupCheckMs = openStartMs;
  lcdShowRow(1, "Entregando agua");
}

void closeValve(const char *reason) {
  valve.write(SERVO_CLOSED_DEG);
  if (!valveOpen) return;
  // Se informa el tiempo real abierto (puede superar el objetivo por la lectura bloqueante de nivel).
  unsigned long elapsed = millis() - openStartMs;
  valveOpen = false;
  Serial.print(F("DONE id="));
  Serial.print(activeId);
  Serial.print(F(" ms="));
  Serial.print(elapsed);
  Serial.print(F(" r="));
  Serial.println(reason);
  activeId = 0;
  lcdRestore();
  reportLevel();  // nivel inmediatamente después del retiro (verificación cruzada)
}

void updateValve() {
  if (!valveOpen) return;
  unsigned long now = millis();
  unsigned long elapsed = now - openStartMs;

  if (elapsed >= openTargetMs) return closeValve("TARGET");
  if (elapsed >= MAX_OPEN_MS) return closeValve("MAX_MS");
  if (now - lastRxMs >= LINK_TIMEOUT_MS) return closeValve("LINK_LOST");

  if (now - lastBackupCheckMs >= BACKUP_CHECK_MS) {
    lastBackupCheckMs = now;
    if (readBackupRaw() < BACKUP_DRY_THRESHOLD) return closeValve("LOW_LEVEL");
  }

  if (now - lastRunReportMs >= RUN_REPORT_MS) {
    lastRunReportMs = now;
    Serial.print(F("RUN id="));
    Serial.print(activeId);
    Serial.print(F(" ms="));
    Serial.println(elapsed);
  }
}

// ---- Comandos ------------------------------------------------------------------
void nak(const __FlashStringHelper *cmd, uint32_t id, const __FlashStringHelper *reason) {
  Serial.print(F("NAK cmd="));
  Serial.print(cmd);
  Serial.print(F(" id="));
  Serial.print(id);
  Serial.print(F(" r="));
  Serial.println(reason);
}

void ack(const __FlashStringHelper *cmd, uint32_t id) {
  Serial.print(F("ACK cmd="));
  Serial.print(cmd);
  Serial.print(F(" id="));
  Serial.println(id);
}

// Convierte un token decimal a uint32. Devuelve false si no es un número válido.
bool parseUint(const char *s, uint32_t &out) {
  if (!s || !*s) return false;
  uint32_t v = 0;
  for (; *s; s++) {
    if (*s < '0' || *s > '9') return false;
    uint32_t next = v * 10 + (*s - '0');
    if (next < v) return false;  // desbordamiento
    v = next;
  }
  out = v;
  return true;
}

void handleLine(char *line) {
  // LCD conserva los espacios del texto: se procesa antes de tokenizar.
  if (strncmp(line, "LCD ", 4) == 0) {
    char row = line[4];
    if ((row == '0' || row == '1') && (line[5] == ' ' || line[5] == '\0')) {
      uint8_t r = row - '0';
      const char *text = line[5] ? line + 6 : "";
      strncpy(lcdRows[r], text, LCD_COLS);
      lcdRows[r][LCD_COLS] = '\0';
      if (!(valveOpen && r == 1)) lcdShowRow(r, lcdRows[r]);
      Serial.println(F("ACK cmd=LCD"));
    } else {
      Serial.println(F("NAK cmd=LCD r=BAD_ARGS"));
    }
    return;
  }

  char *cmd = strtok(line, " ");
  if (!cmd) return;
  char *a1 = strtok(NULL, " ");
  char *a2 = strtok(NULL, " ");

  if (strcmp(cmd, "PING") == 0) {
    Serial.print(F("PONG fw=" FW_VERSION " proto="));
    Serial.println(PROTO_VERSION);
  } else if (strcmp(cmd, "LEVEL") == 0) {
    reportLevel();
  } else if (strcmp(cmd, "OPEN") == 0) {
    uint32_t id = 0, ms = 0;
    if (!parseUint(a1, id) || !parseUint(a2, ms) || ms == 0) return nak(F("OPEN"), id, F("BAD_ARGS"));
    if (ms > MAX_OPEN_MS) return nak(F("OPEN"), id, F("MAX_MS"));
    if (valveOpen) return nak(F("OPEN"), id, F("BUSY"));
    if (readBackupRaw() < BACKUP_DRY_THRESHOLD) return nak(F("OPEN"), id, F("LOW_LEVEL"));
    ack(F("OPEN"), id);
    openValve(id, ms);
  } else if (strcmp(cmd, "STOP") == 0) {
    uint32_t id = 0;
    if (!parseUint(a1, id)) return nak(F("STOP"), id, F("BAD_ARGS"));
    if (!valveOpen || id != activeId) return nak(F("STOP"), id, F("NOT_ACTIVE"));
    ack(F("STOP"), id);
    closeValve("STOP");
  } else {
    Serial.println(F("ERR code=UNKNOWN_CMD"));
  }
}

void readSerial() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      lastRxMs = millis();
      if (lineOverflow) {
        Serial.println(F("ERR code=LINE_TOO_LONG"));
      } else {
        lineBuf[lineLen] = '\0';
        if (lineLen > 0) handleLine(lineBuf);
      }
      lineLen = 0;
      lineOverflow = false;
    } else if (lineLen < LINE_MAX) {
      lineBuf[lineLen++] = c;
    } else {
      lineOverflow = true;
    }
  }
}

// ---- Arduino -----------------------------------------------------------------
void setup() {
  // Primero lo seguro: relé apagado y válvula cerrada.
  pinMode(PIN_RELAY, OUTPUT);
  relayOff();
  valve.attach(PIN_SERVO);
  valve.write(SERVO_CLOSED_DEG);

  pinMode(PIN_US_TRIG, OUTPUT);
  pinMode(PIN_US_ECHO, INPUT);
  pinMode(PIN_BACKUP_POWER, OUTPUT);
  digitalWrite(PIN_BACKUP_POWER, LOW);

  lcd.init();
  lcd.backlight();
  lcdRestore();

  Serial.begin(SERIAL_BAUD);
  Serial.print(F("BOOT fw=" FW_VERSION " proto="));
  Serial.println(PROTO_VERSION);
  lastRxMs = millis();
}

void loop() {
  readSerial();
  updateValve();

  unsigned long now = millis();
  if (now - lastLevelMs >= LEVEL_INTERVAL_MS) {
    lastLevelMs = now;
    // Durante la entrega, la lectura bloqueante (~300 ms) es aceptable: los cierres
    // por tiempo tienen esa resolución y se informa el tiempo real abierto.
    reportLevel();
  }
}
