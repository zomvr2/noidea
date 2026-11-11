// Red (núcleo 0): Wi-Fi, NTP, Supabase Realtime y HTTPS a la API en Vercel.
//
// Seguridad: las órdenes llegan firmadas con HMAC-SHA256 (secreto del dispositivo) y las
// peticiones a la API se firman igual. Por eso TLS se usa sin validar certificado
// (setInsecure): un intermediario no puede falsificar órdenes ni telemetría.
// PENDIENTE: fijar certificados raíz para además ocultar el contenido.

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <mbedtls/md.h>
#include <time.h>

static WebSocketsClient ws;
static uint8_t deviceSecret[32];
static char topic[64];
static uint32_t phxRef = 1;
static unsigned long lastHeartbeatMs = 0;

// ---- Criptografía -------------------------------------------------------------
static void hexToBytes(const char *hex, uint8_t *out, size_t len) {
  for (size_t i = 0; i < len; i++) {
    char b[3] = {hex[2 * i], hex[2 * i + 1], 0};
    out[i] = (uint8_t)strtoul(b, nullptr, 16);
  }
}

static void hmacHex(const char *msg, char out[65]) {
  uint8_t mac[32];
  mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), deviceSecret, sizeof(deviceSecret),
                  (const uint8_t *)msg, strlen(msg), mac);
  for (int i = 0; i < 32; i++) sprintf(out + 2 * i, "%02x", mac[i]);
}

static bool sigEquals(const char *a, const char *b) {  // tiempo constante
  if (strlen(a) != 64 || strlen(b) != 64) return false;
  uint8_t diff = 0;
  for (int i = 0; i < 64; i++) diff |= (uint8_t)(tolower(a[i]) ^ tolower(b[i]));
  return diff == 0;
}

static bool clockReady() {
  return time(nullptr) > 1700000000;  // NTP sincronizado
}

// ---- Órdenes por Realtime -----------------------------------------------------
static void verifyAndQueue(JsonObjectConst p) {
  const char *cmd = p["cmd"] | "";
  const char *sig = p["sig"] | "";
  uint32_t ts = p["ts"] | 0;
  char msg[96];
  Command c = {};

  if (strcmp(cmd, "OPEN") == 0) {
    c.type = CMD_OPEN;
    c.id = p["id"] | 0;
    c.ms = p["ms"] | 0;
    snprintf(msg, sizeof(msg), "OPEN|%lu|%lu|%lu", (unsigned long)c.id, (unsigned long)c.ms, (unsigned long)ts);
  } else if (strcmp(cmd, "STOP") == 0) {
    c.type = CMD_STOP;
    c.id = p["id"] | 0;
    snprintf(msg, sizeof(msg), "STOP|%lu|%lu", (unsigned long)c.id, (unsigned long)ts);
  } else if (strcmp(cmd, "LCD") == 0) {
    c.type = CMD_LCD;
    c.row = (p["row"] | 0) ? 1 : 0;
    strlcpy(c.text, p["text"] | "", sizeof(c.text));
    snprintf(msg, sizeof(msg), "LCD|%u|%s|%lu", c.row, (const char *)(p["text"] | ""), (unsigned long)ts);
  } else {
    return;
  }

  char expected[65];
  hmacHex(msg, expected);
  if (!sigEquals(expected, sig)) {
    Serial.printf("[rt] firma inválida: %s\n", cmd);
    return;
  }
  long age = (long)time(nullptr) - (long)ts;
  if (!clockReady() || age > COMMAND_MAX_AGE_S || age < -COMMAND_MAX_AGE_S) {
    Serial.printf("[rt] orden vencida (%ld s): %s\n", age, cmd);
    return;
  }
  xQueueSend(cmdQueue, &c, pdMS_TO_TICKS(100));
}

static void phxSend(const char *event, const char *payload, const char *t) {
  char frame[320];
  snprintf(frame, sizeof(frame), "{\"topic\":\"%s\",\"event\":\"%s\",\"payload\":%s,\"ref\":\"%lu\",\"join_ref\":\"1\"}", t,
           event, payload, (unsigned long)phxRef++);
  ws.sendTXT(frame);
}

static void onWsEvent(WStype_t type, uint8_t *data, size_t len) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("[rt] conectado, uniéndose al canal");
      phxRef = 1;
      phxSend("phx_join",
              "{\"config\":{\"broadcast\":{\"self\":false},\"presence\":{\"key\":\"\"},\"private\":false}}", topic);
      lastHeartbeatMs = millis();
      break;
    case WStype_DISCONNECTED:
      linkUp = false;
      Serial.println("[rt] desconectado");
      break;
    case WStype_TEXT: {
      JsonDocument doc;
      if (deserializeJson(doc, data, len)) return;
      const char *event = doc["event"] | "";
      if (strcmp(event, "phx_reply") == 0 && strcmp(doc["topic"] | "", topic) == 0) {
        bool ok = strcmp(doc["payload"]["status"] | "", "ok") == 0;
        if (ok && !linkUp) Serial.println("[rt] canal unido");
        linkUp = ok;
      } else if (strcmp(event, "broadcast") == 0) {
        verifyAndQueue(doc["payload"]["payload"].as<JsonObjectConst>());
      } else if (strcmp(event, "phx_error") == 0 || strcmp(event, "phx_close") == 0) {
        linkUp = false;
      }
      break;
    }
    default:
      break;
  }
}

static void realtimeTask(void *) {
  char url[200];
  snprintf(url, sizeof(url), "/realtime/v1/websocket?apikey=%s&vsn=1.0.0", SUPABASE_PUBLISHABLE_KEY);
  snprintf(topic, sizeof(topic), "realtime:device:%s", DEVICE_ID);
  ws.beginSSL(SUPABASE_HOST, 443, url);
  ws.onEvent(onWsEvent);
  ws.setReconnectInterval(3000);
  ws.enableHeartbeat(5000, 2000, 1);  // ping/pong: detecta enlaces muertos en ~7 s

  for (;;) {
    if (WiFi.status() != WL_CONNECTED) linkUp = false;
    ws.loop();
    if (linkUp) {
      lastLinkUpMs = millis();
      if (millis() - lastHeartbeatMs > PHX_HEARTBEAT_MS) {
        lastHeartbeatMs = millis();
        phxSend("heartbeat", "{}", "phoenix");
      }
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// ---- HTTPS a la API ----------------------------------------------------------
static void httpTask(void *) {
  WiFiClientSecure client;
  client.setInsecure();  // ver nota al inicio del archivo
  Outgoing o;
  for (;;) {
    if (xQueueReceive(outQueue, &o, portMAX_DELAY) != pdTRUE) continue;
    if (WiFi.status() != WL_CONNECTED || !clockReady()) continue;  // sin red o sin hora: se descarta

    char ts[16], toSign[230], sig[65], url[96];
    snprintf(ts, sizeof(ts), "%lu", (unsigned long)time(nullptr));
    snprintf(toSign, sizeof(toSign), "%s\n%s", ts, o.body);
    hmacHex(toSign, sig);
    snprintf(url, sizeof(url), "https://%s/api/device/%s", API_HOST, o.path);

    HTTPClient http;
    http.setTimeout(8000);
    if (!http.begin(client, url)) continue;
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Id", DEVICE_ID);
    http.addHeader("X-Timestamp", ts);
    http.addHeader("X-Signature", sig);
    int code = http.POST((uint8_t *)o.body, strlen(o.body));
    if (code != 204) Serial.printf("[http] %s -> %d %s\n", o.path, code, http.getString().c_str());
    http.end();
  }
}

// ---- Wi-Fi + arranque ----------------------------------------------------------
static void wifiTask(void *) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  bool announced = false;
  for (;;) {
    bool ok = WiFi.status() == WL_CONNECTED;
    if (ok && !announced) {
      Serial.printf("[wifi] conectado, IP %s\n", WiFi.localIP().toString().c_str());
      announced = true;
    } else if (!ok && announced) {
      Serial.println("[wifi] desconectado, reintentando");
      announced = false;
    }
    vTaskDelay(pdMS_TO_TICKS(1000));
  }
}

void startNetTasks() {
  hexToBytes(DEVICE_SECRET_HEX, deviceSecret, sizeof(deviceSecret));
  xTaskCreatePinnedToCore(wifiTask, "wifi", 4096, nullptr, 1, nullptr, 0);
  xTaskCreatePinnedToCore(realtimeTask, "realtime", 8192, nullptr, 2, nullptr, 0);
  xTaskCreatePinnedToCore(httpTask, "http", 8192, nullptr, 1, nullptr, 0);
}
