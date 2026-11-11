// NoIdea — dispensador con ESP32 DevKit (WROOM-32)
//
// Núcleo 1 (loop): sensores, válvula (servo), LCD y TODAS las protecciones de seguridad.
// Núcleo 0 (net.ino): Wi-Fi, NTP, Supabase Realtime (órdenes) y HTTPS a la API (telemetría/eventos).
// Las tareas se comunican solo por colas de FreeRTOS: una petición HTTPS lenta nunca retrasa un cierre.
//
// El ESP32 NO conoce familias ni saldos: ejecuta órdenes firmadas (HMAC) y mide.
// Cierra la válvula ante: tiempo cumplido, STOP, enlace caído 3 s, respaldo seco o tope de 60 s.
//
// Librerías (Gestor de librerías del IDE): ESP32Servo, LiquidCrystal I2C (Frank de Brabander),
// WebSockets (Markus Sattler), ArduinoJson 7. Placa: "ESP32 Dev Module" (core esp32 3.x).

#include <ESP32Servo.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
#include <WiFi.h>
#include <Wire.h>
#include "config.h"
#include "secrets.h"

// ---- Mensajes entre tareas ---------------------------------------------------
enum CmdType : uint8_t { CMD_OPEN, CMD_STOP, CMD_LCD };
struct Command {           // net -> loop (ya verificada la firma)
  CmdType type;
  uint32_t id;
  uint32_t ms;
  uint8_t row;
  char text[LCD_COLS + 1];
};
struct Outgoing {          // loop -> net (se firma y se envía por HTTPS)
  char path[12];           // "telemetry" o "events"
  char body[200];
};

QueueHandle_t cmdQueue;
QueueHandle_t outQueue;
volatile bool linkUp = false;          // Realtime unido al canal (lo escribe net)
volatile uint32_t lastLinkUpMs = 0;

Servo valve;
LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS);
Preferences prefs;

// ---- Estado de la válvula (solo núcleo 1) -----------------------------------
bool valveOpen = false;
uint32_t activeId = 0;
uint32_t lastOpenId = 0;     // anti-repetición, persistido en NVS
unsigned long openStartMs = 0, openTargetMs = 0, lastRunMs = 0, lastBackupMs = 0;
unsigned long lastTelemetryMs = 0;
char lcdRows[LCD_ROWS][LCD_COLS + 1] = {"NoIdea", "Conectando..."};

// ---- Utilidades --------------------------------------------------------------
void lcdShowRow(uint8_t row, const char *text) {
  lcd.setCursor(0, row);
  uint8_t i = 0;
  for (; i < LCD_COLS && text[i]; i++) lcd.print(text[i]);
  for (; i < LCD_COLS; i++) lcd.print(' ');
}

void lcdRestore() {
  for (uint8_t r = 0; r < LCD_ROWS; r++) lcdShowRow(r, lcdRows[r]);
}

void enqueue(const char *path, const char *body, TickType_t wait) {
  Outgoing o;
  strlcpy(o.path, path, sizeof(o.path));
  strlcpy(o.body, body, sizeof(o.body));
  if (xQueueSend(outQueue, &o, wait) != pdTRUE) Serial.printf("[out] cola llena, se descarta %s\n", path);
}

void sendEvent(const char *json, bool important) {
  enqueue("events", json, important ? pdMS_TO_TICKS(500) : 0);
}

bool linkLost() {
  return !linkUp && millis() - lastLinkUpMs > LINK_TIMEOUT_MS;
}

// ---- Válvula -----------------------------------------------------------------
void openValve(uint32_t id, uint32_t ms) {
  valve.write(SERVO_OPEN_DEG);
  valveOpen = true;
  activeId = id;
  openStartMs = lastRunMs = lastBackupMs = millis();
  openTargetMs = ms;
  lastOpenId = id;
  prefs.putUInt("lastOpen", id);
  lcdShowRow(1, "Entregando agua");
}

void closeValve(const char *reason) {
  valve.write(SERVO_CLOSED_DEG);
  if (!valveOpen) return;
  unsigned long openMs = millis() - openStartMs;  // tiempo real abierto
  valveOpen = false;
  char json[120];
  snprintf(json, sizeof(json), "{\"type\":\"DONE\",\"id\":%lu,\"openMs\":%lu,\"reason\":\"%s\"}",
           (unsigned long)activeId, openMs, reason);
  sendEvent(json, true);
  Serial.printf("[valve] cierre id=%lu ms=%lu r=%s\n", (unsigned long)activeId, openMs, reason);
  activeId = 0;
  lcdRestore();
  lastTelemetryMs = millis() - TELEMETRY_INTERVAL_MS + 4000;  // nivel ~4 s después (verificación cruzada)
}

void nak(const char *cmd, uint32_t id, const char *reason) {
  char json[100];
  snprintf(json, sizeof(json), "{\"type\":\"NAK\",\"cmd\":\"%s\",\"id\":%lu,\"reason\":\"%s\"}", cmd,
           (unsigned long)id, reason);
  sendEvent(json, true);
}

void ack(const char *cmd, uint32_t id) {
  char json[80];
  snprintf(json, sizeof(json), "{\"type\":\"ACK\",\"cmd\":\"%s\",\"id\":%lu}", cmd, (unsigned long)id);
  sendEvent(json, true);
}

void handleCommand(const Command &c) {
  switch (c.type) {
    case CMD_OPEN:
      if (c.id <= lastOpenId) return;  // repetición: se ignora en silencio
      if (c.ms == 0) return nak("OPEN", c.id, "BAD_ARGS");
      if (c.ms > MAX_OPEN_MS) return nak("OPEN", c.id, "MAX_MS");
      if (valveOpen) return nak("OPEN", c.id, "BUSY");
      if (readBackupLow()) return nak("OPEN", c.id, "LOW_LEVEL");
      ack("OPEN", c.id);
      openValve(c.id, c.ms);
      break;
    case CMD_STOP:
      if (!valveOpen || c.id != activeId) return nak("STOP", c.id, "NOT_ACTIVE");
      ack("STOP", c.id);
      closeValve("STOP");
      break;
    case CMD_LCD:
      strlcpy(lcdRows[c.row], c.text, sizeof(lcdRows[c.row]));
      if (!(valveOpen && c.row == 1)) lcdShowRow(c.row, lcdRows[c.row]);
      break;
  }
}

void updateValve() {
  if (!valveOpen) return;
  unsigned long now = millis();
  unsigned long elapsed = now - openStartMs;

  if (elapsed >= openTargetMs) return closeValve("TARGET");
  if (elapsed >= MAX_OPEN_MS) return closeValve("MAX_MS");
  if (linkLost()) return closeValve("LINK_LOST");
  if (now - lastBackupMs >= BACKUP_CHECK_MS) {
    lastBackupMs = now;
    if (readBackupLow()) return closeValve("LOW_LEVEL");
  }
  if (now - lastRunMs >= RUN_REPORT_MS) {
    lastRunMs = now;
    char json[80];
    snprintf(json, sizeof(json), "{\"type\":\"RUN\",\"id\":%lu,\"elapsedMs\":%lu}", (unsigned long)activeId, elapsed);
    sendEvent(json, false);
  }
}

void sendTelemetry() {
  uint16_t d = readDistanceMm();
  int raw = readBackupRaw();
  char json[200];
  if (d == 0) {
    snprintf(json, sizeof(json),
             "{\"fw\":\"" FW_VERSION "\",\"proto\":%d,\"distanceMm\":null,\"error\":\"NO_ECHO\","
             "\"backupRaw\":%d,\"backupLow\":%s,\"rssi\":%d}",
             PROTO_VERSION, raw, raw < BACKUP_DRY_THRESHOLD ? "true" : "false", WiFi.RSSI());
  } else {
    snprintf(json, sizeof(json),
             "{\"fw\":\"" FW_VERSION "\",\"proto\":%d,\"distanceMm\":%u,\"error\":null,"
             "\"backupRaw\":%d,\"backupLow\":%s,\"rssi\":%d}",
             PROTO_VERSION, d, raw, raw < BACKUP_DRY_THRESHOLD ? "true" : "false", WiFi.RSSI());
  }
  enqueue("telemetry", json, 0);
}

// Comandos por el Monitor Serie (115200) para pruebas en banco.
void handleSerial() {
  static char buf[32];
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
    if (strcmp(buf, "level") == 0) {
      Serial.printf("d=%u mm, respaldo=%d (umbral %d)\n", readDistanceMm(), readBackupRaw(), BACKUP_DRY_THRESHOLD);
    } else if (strcmp(buf, "reset-id") == 0) {
      // Usar solo tras reiniciar la base de datos (los id de retiro vuelven a empezar).
      lastOpenId = 0;
      prefs.putUInt("lastOpen", 0);
      Serial.println("lastOpenId = 0");
    } else if (strcmp(buf, "status") == 0) {
      Serial.printf("wifi=%d link=%d valve=%d lastOpenId=%lu\n", WiFi.status() == WL_CONNECTED, linkUp, valveOpen,
                    (unsigned long)lastOpenId);
    } else if (buf[0]) {
      Serial.println("Comandos: level | status | reset-id");
    }
  }
}

// ---- Arduino -----------------------------------------------------------------
void setup() {
  // Primero lo seguro: relé apagado y válvula cerrada.
  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, RELAY_ACTIVE_LOW ? HIGH : LOW);
  valve.setPeriodHertz(50);
  valve.attach(PIN_SERVO, SERVO_MIN_US, SERVO_MAX_US);
  valve.write(SERVO_CLOSED_DEG);

  Serial.begin(115200);
  setupSensors();
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcdRestore();

  prefs.begin("noidea", false);
  lastOpenId = prefs.getUInt("lastOpen", 0);

  cmdQueue = xQueueCreate(4, sizeof(Command));
  outQueue = xQueueCreate(8, sizeof(Outgoing));
  startNetTasks();  // net.ino
  Serial.printf("NoIdea ESP32 fw %s proto %d\n", FW_VERSION, PROTO_VERSION);
}

void loop() {
  Command c;
  while (xQueueReceive(cmdQueue, &c, 0) == pdTRUE) handleCommand(c);
  updateValve();
  handleSerial();

  if (millis() - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = millis();
    sendTelemetry();  // ~200 ms bloqueante por el HC-SR04; aceptable (resolución de cierre)
  }
  delay(5);
}
