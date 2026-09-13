#include <Arduino.h>
#include <ArduinoJson.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>

#include "config.h"
#include "root_ca.h"

struct SensorMeasurement {
  const char* key;
  float value;
};

struct SensorValues {
  SensorMeasurement measurements[16];
  size_t count;
};

bool addMeasurement(SensorValues& values, const char* key, float value) {
  if (values.count >= 16 || key == nullptr || key[0] == '\0' || !isfinite(value)) return false;
  values.measurements[values.count++] = {key, value};
  return true;
}

Preferences preferences;
DNSServer dnsServer;
WebServer setupServer(80);
String deviceId;
String deviceToken;
String wifiSsid;
String wifiPassword;
String pairingCode;
String pendingPayload;
uint64_t sequenceNumber = 0;
uint64_t pendingSequence = 0;
bool setupMode = false;
unsigned long reprovisionPressedAt = 0;
uint8_t wifiReconnectFailures = 0;
String usbProvisionBuffer;

void clearPendingPayload() {
  preferences.remove("pending");
  pendingPayload = "";
  pendingSequence = 0;
}

void clearLocalProvisioning() {
  const char* keys[] = {"wifiSsid", "wifiPass", "pairCode", "deviceId", "deviceToken", "seq", "pending"};
  for (const char* key : keys) {
    preferences.remove(key);
  }
  wifiSsid = "";
  wifiPassword = "";
  pairingCode = "";
  deviceId = "";
  deviceToken = "";
  pendingPayload = "";
  sequenceNumber = 0;
  pendingSequence = 0;
}

bool checkReprovisionButton() {
  if (digitalRead(REPROVISION_BUTTON_PIN) != LOW) {
    reprovisionPressedAt = 0;
    return false;
  }
  if (reprovisionPressedAt == 0) reprovisionPressedAt = millis();
  if (millis() - reprovisionPressedAt < REPROVISION_HOLD_MS) return false;
  Serial.println("Reprovision requested. Clearing local credentials without printing them.");
  clearLocalProvisioning();
  return true;
}

bool waitWithRecovery(unsigned long durationMs) {
  const unsigned long startedAt = millis();
  while (millis() - startedAt < durationMs) {
    if (checkReprovisionButton()) return false;
    delay(50);
  }
  return true;
}

String htmlEscape(const String& value) {
  String escaped;
  escaped.reserve(value.length());
  for (size_t index = 0; index < value.length(); ++index) {
    switch (value[index]) {
      case '&': escaped += F("&amp;"); break;
      case '<': escaped += F("&lt;"); break;
      case '>': escaped += F("&gt;"); break;
      case '"': escaped += F("&quot;"); break;
      default: escaped += value[index];
    }
  }
  return escaped;
}

String setupPage(const String& message = "") {
  const bool pairingRequired = deviceId.length() == 0 || deviceToken.length() == 0;
  return String(F(
    "<!doctype html><html lang='ja'><meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>GAIA SENSEWARE 接続設定</title><style>body{font:16px system-ui;background:#071727;color:#eef9ff;"
    "max-width:34rem;margin:0 auto;padding:2rem;line-height:1.7}p{color:#b8cbd8}form{display:grid;gap:1rem;background:#102a40;padding:1.4rem;"
    "border-radius:1rem}label{display:grid;gap:.4rem}input,button{font:inherit;padding:.85rem;border-radius:.6rem;"
    "border:1px solid #80e7e0}button{background:#80e7e0;color:#071727;font-weight:700}small{color:#9bb1bd}</style>"
    "<h1>ESP32をWi-Fiへ接続</h1><p>普段使う2.4GHz Wi-Fiと、GAIA SENSEWAREに表示されたPairing Codeを入力してください。</p>")) +
    (message.length() ? "<p role='status'>" + htmlEscape(message) + "</p>" : "") +
    "<form method='post' action='/save'>"
    "<label>1. Wi-Fi名（SSID）<input name='ssid' maxlength='32' required value='" + htmlEscape(wifiSsid) + "' placeholder='例：Home-WiFi'></label>"
    "<label>2. Wi-Fiパスワード<input name='password' type='password' minlength='8' maxlength='63' required autocomplete='new-password'></label>"
    "<label>3. Pairing Code" + String(pairingRequired ? " *" : "（Wi-Fi変更だけなら空欄）") +
    "<input name='pairing' maxlength='9' pattern='[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}' " +
    String(pairingRequired ? "required " : "") + "autocomplete='off' placeholder='ABCD-EFGH'></label>"
    "<button type='submit'>接続して登録</button><small>押すとESP32が再起動します。PC・スマホは普段のWi-Fiへ戻してください。</small></form></html>";
}

void startSetupMode() {
  if (setupMode) return;
  setupMode = true;
  WiFi.disconnect(true, false);
  WiFi.mode(WIFI_AP);
  const String suffix = String(static_cast<uint32_t>(ESP.getEfuseMac()), HEX).substring(4);
  const String accessPoint = "CITY-SENSOR-" + suffix;
  WiFi.softAP(accessPoint.c_str());
  dnsServer.start(53, "*", WiFi.softAPIP());
  setupServer.on("/", HTTP_GET, []() {
    setupServer.sendHeader("Cache-Control", "no-store");
    setupServer.send(200, "text/html; charset=utf-8", setupPage());
  });
  setupServer.on("/save", HTTP_POST, []() {
    const String submittedSsid = setupServer.arg("ssid");
    const String submittedPassword = setupServer.arg("password");
    String submittedPairing = setupServer.arg("pairing");
    submittedPairing.toUpperCase();
    const bool pairingRequired = deviceId.length() == 0 || deviceToken.length() == 0;
    const bool codeShape = submittedPairing.length() == 9 && submittedPairing[4] == '-';
    if (submittedSsid.length() == 0 || submittedSsid.length() > 32 || submittedPassword.length() < 8 ||
        submittedPassword.length() > 63 || (pairingRequired && !codeShape) || (!pairingRequired && submittedPairing.length() > 0 && !codeShape)) {
      setupServer.send(400, "text/html; charset=utf-8", setupPage("入力内容を確認してください。"));
      return;
    }
    preferences.putString("wifiSsid", submittedSsid);
    preferences.putString("wifiPass", submittedPassword);
    if (submittedPairing.length() > 0) preferences.putString("pairCode", submittedPairing);
    setupServer.sendHeader("Cache-Control", "no-store");
    setupServer.send(200, "text/html; charset=utf-8", setupPage("保存しました。再起動して接続します。"));
    delay(700);
    ESP.restart();
  });
  setupServer.onNotFound([]() {
    setupServer.sendHeader("Location", "/", true);
    setupServer.send(302, "text/plain", "");
  });
  setupServer.begin();
  Serial.printf("Setup Wi-Fi started: %s; open http://192.168.4.1/\n", accessPoint.c_str());
  Serial.println("Wi-Fi password and Pairing Code are never printed.");
}

void handleUsbProvisioning() {
  while (Serial.available() > 0) {
    const char input = static_cast<char>(Serial.read());
    if (input == '\r') continue;
    if (input != '\n') {
      if (usbProvisionBuffer.length() < 384) usbProvisionBuffer += input;
      else usbProvisionBuffer = "";
      continue;
    }

    JsonDocument request;
    const DeserializationError error = deserializeJson(request, usbProvisionBuffer);
    usbProvisionBuffer = "";
    if (error) {
      Serial.println("USB_PROVISION_ERROR: invalid request; secrets were not printed.");
      continue;
    }

    const String command = request["command"] | "";
    if (command == "GAIA_USB_SCAN") {
      WiFi.mode(WIFI_AP_STA);
      const int16_t networkCount = WiFi.scanNetworks(false, true);
      JsonDocument response;
      response["type"] = "GAIA_USB_SCAN_RESULT";
      JsonArray networks = response["networks"].to<JsonArray>();
      const int16_t resultLimit = networkCount > 24 ? 24 : networkCount;
      for (int16_t index = 0; index < resultLimit; ++index) {
        if (WiFi.SSID(index).length() == 0) continue;
        JsonObject network = networks.add<JsonObject>();
        network["ssid"] = WiFi.SSID(index);
        network["rssi"] = WiFi.RSSI(index);
        network["authMode"] = static_cast<int>(WiFi.encryptionType(index));
      }
      serializeJson(response, Serial);
      Serial.println();
      WiFi.scanDelete();
      continue;
    }

    if (command != "GAIA_USB_PROVISION") {
      Serial.println("USB_PROVISION_ERROR: invalid request; secrets were not printed.");
      continue;
    }

    const String submittedSsid = request["ssid"] | "";
    const String submittedPassword = request["password"] | "";
    String submittedPairing = request["pairingCode"] | "";
    submittedPairing.toUpperCase();
    const bool pairingRequired = deviceId.length() == 0 || deviceToken.length() == 0;
    const bool codeShape = submittedPairing.length() == 9 && submittedPairing[4] == '-';
    if (submittedSsid.length() == 0 || submittedSsid.length() > 32 || submittedPassword.length() < 8 ||
        submittedPassword.length() > 63 || (pairingRequired && !codeShape) ||
        (!pairingRequired && submittedPairing.length() > 0 && !codeShape)) {
      Serial.println("USB_PROVISION_ERROR: invalid field length or code shape; secrets were not printed.");
      continue;
    }

    const size_t savedSsid = preferences.putString("wifiSsid", submittedSsid);
    const size_t savedPassword = preferences.putString("wifiPass", submittedPassword);
    const size_t savedPairing = submittedPairing.length() > 0 ? preferences.putString("pairCode", submittedPairing) : 1;
    if (savedSsid != submittedSsid.length() || savedPassword != submittedPassword.length() ||
        (submittedPairing.length() > 0 && savedPairing != submittedPairing.length())) {
      Serial.println("USB_PROVISION_ERROR: NVS write failed; secrets were not printed.");
      continue;
    }

    Serial.println("USB_PROVISION_OK: credentials saved without printing them; restarting.");
    delay(300);
    ESP.restart();
  }
}

bool readSensors(SensorValues& values) {
#if USE_MOCK_SENSOR
  const float phase = static_cast<float>(millis() % 60000UL) / 60000.0f;
  return addMeasurement(values, "temperature", 24.0f + sinf(phase * TWO_PI) * 1.8f)
      && addMeasurement(values, "humidity", 58.0f + cosf(phase * TWO_PI) * 5.0f)
      && addMeasurement(values, "pm25", 8.0f + sinf(phase * TWO_PI * 0.6f) * 2.0f);
#else
  // Replace only this function. Add 1 to 16 keys from
  // /api/public/v1/measurement-types, for example:
  // return addMeasurement(values, "water_temperature", waterCelsius)
  //     && addMeasurement(values, "ph", waterPh)
  //     && addMeasurement(values, "turbidity", turbidityNtu);
  return false;
#endif
}

void reportTargetNetworkVisibility() {
  const int16_t networkCount = WiFi.scanNetworks(false, true);
  int matches = 0;
  int strongestRssi = -127;
  int authMode = -1;
  if (networkCount > 0) {
    for (int index = 0; index < networkCount; ++index) {
      if (WiFi.SSID(index) != wifiSsid) continue;
      ++matches;
      if (WiFi.RSSI(index) > strongestRssi) {
        strongestRssi = WiFi.RSSI(index);
        authMode = static_cast<int>(WiFi.encryptionType(index));
      }
    }
  }
  WiFi.scanDelete();
  Serial.printf("Target Wi-Fi scan: found=%s, matches=%d, strongestRssi=%d dBm, authMode=%d; SSID is not printed.\n",
                matches > 0 ? "yes" : "no", matches, strongestRssi, authMode);
}

bool connectWiFi() {
  WiFi.mode(WIFI_STA);
  reportTargetNetworkVisibility();
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
  Serial.print("Connecting to Wi-Fi");
  const unsigned long deadline = millis() + 30000UL;
  while (WiFi.status() != WL_CONNECTED && millis() < deadline) {
    if (!waitWithRecovery(350)) {
      startSetupMode();
      return false;
    }
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("Wi-Fi connection failed with status=%d. Credentials are never printed.\n",
                  static_cast<int>(WiFi.status()));
    return false;
  }
  Serial.println("Wi-Fi connected.");
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  return true;
}

bool httpsPost(const String& url, const String& body, const String& authorization, int& status, String& responseBody) {
  if (!url.startsWith("https://")) {
    Serial.println("Refusing non-HTTPS URL.");
    return false;
  }
  WiFiClientSecure client;
  client.setCACert(ROOT_CA);  // Certificate validation always stays enabled.
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (!http.begin(client, url)) return false;
  http.addHeader("Content-Type", "application/json");
  if (authorization.length() > 0) http.addHeader("Authorization", authorization);
  status = http.POST(body);
  if (status > 0 && status < 500) responseBody = http.getString();
  http.end();
  return status > 0;
}

bool pairDevice() {
  JsonDocument request;
  request["pairingCode"] = pairingCode;
  String requestBody;
  serializeJson(request, requestBody);

  int status = 0;
  String responseBody;
  if (!httpsPost(String(API_BASE_URL) + "/device/pair", requestBody, "", status, responseBody)) return false;
  if (status != 201) {
    Serial.printf("Pairing failed with HTTP %d. Generate a new code in GAIA SENSEWARE.\n", status);
    return false;
  }

  JsonDocument response;
  if (deserializeJson(response, responseBody) != DeserializationError::Ok) return false;
  const char* returnedId = response["deviceId"] | "";
  const char* returnedToken = response["deviceToken"] | "";
  if (strlen(returnedId) < 5 || strlen(returnedToken) < 40) return false;
  deviceId = returnedId;
  deviceToken = returnedToken;
  sequenceNumber = 0;
  preferences.putString("deviceId", deviceId);
  preferences.putString("deviceToken", deviceToken);
  preferences.putULong64("seq", sequenceNumber);
  clearPendingPayload();
  preferences.remove("pairCode");
  pairingCode = "";
  Serial.println("Pairing succeeded. Device Token is stored in NVS and is not printed.");
  return true;
}

String isoTimestampIfSynchronized() {
  struct tm currentTime;
  if (!getLocalTime(&currentTime, 1000) || currentTime.tm_year < 120) return "";
  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &currentTime);
  return String(buffer);
}

bool loadPendingPayload() {
  const String envelope = preferences.getString("pending", "");
  if (envelope.length() == 0) return false;
  JsonDocument stored;
  if (deserializeJson(stored, envelope) != DeserializationError::Ok || !stored["seq"].is<uint64_t>() || !stored["body"].is<const char*>()) {
    Serial.println("Discarding invalid pending telemetry metadata; no secret was printed.");
    clearPendingPayload();
    return false;
  }
  pendingSequence = stored["seq"].as<uint64_t>();
  pendingPayload = stored["body"].as<String>();
  if (pendingPayload.length() == 0) {
    clearPendingPayload();
    return false;
  }
  if (pendingSequence < sequenceNumber) {
    // The seq update reached NVS but power was lost before pending cleanup.
    clearPendingPayload();
    return false;
  }
  if (pendingSequence > sequenceNumber) {
    // A complete pending envelope is authoritative if an older seq write was lost.
    sequenceNumber = pendingSequence;
    preferences.putULong64("seq", sequenceNumber);
  }
  return true;
}

bool persistPendingPayload(const SensorValues& values) {
  if (values.count == 0 || values.count > 16) return false;
  JsonDocument payload;
  payload["seq"] = sequenceNumber;
  const String observedAt = isoTimestampIfSynchronized();
  if (observedAt.length() > 0) payload["observedAt"] = observedAt;
  JsonObject data = payload["data"].to<JsonObject>();
  for (size_t index = 0; index < values.count; ++index) {
    const SensorMeasurement& measurement = values.measurements[index];
    data[measurement.key] = roundf(measurement.value * 1000.0f) / 1000.0f;
  }
  String body;
  serializeJson(payload, body);
  JsonDocument envelope;
  envelope["seq"] = sequenceNumber;
  envelope["body"] = body;
  String encodedEnvelope;
  serializeJson(envelope, encodedEnvelope);
  if (preferences.putString("pending", encodedEnvelope) != encodedEnvelope.length() ||
      preferences.getString("pending", "") != encodedEnvelope) {
    Serial.println("Could not persist pending telemetry; nothing was sent.");
    return false;
  }
  pendingSequence = sequenceNumber;
  pendingPayload = body;
  return true;
}

bool sendTelemetry(const SensorValues& values) {
  if (pendingPayload.length() == 0 && !loadPendingPayload() && !persistPendingPayload(values)) return false;

  const String endpoint = String(API_BASE_URL) + "/devices/" + deviceId + "/telemetry";
  for (int attempt = 0; attempt < RETRY_ATTEMPTS; ++attempt) {
    int status = 0;
    String responseBody;
    const bool sent = httpsPost(endpoint, pendingPayload, String("Bearer ") + deviceToken, status, responseBody);
    if (sent && (status == 202 || status == 200)) {
      const uint64_t nextSequence = pendingSequence + 1;
      if (preferences.putULong64("seq", nextSequence) != sizeof(nextSequence)) {
        Serial.println("Could not persist the next sequence; retaining the pending payload for an exact replay.");
        return false;
      }
      sequenceNumber = nextSequence;
      clearPendingPayload();
      Serial.printf("Telemetry accepted; next seq=%llu.\n", sequenceNumber);
      return true;
    }
    if (status == 401 || status == 409 || status == 429) {
      Serial.printf("Telemetry rejected with HTTP %d; not retrying this payload.\n", status);
      return false;
    }
    const unsigned long baseDelay = 5000UL << attempt;
    const unsigned long jitter = esp_random() % 800UL;
    Serial.printf("Telemetry retry %d after %lu ms.\n", attempt + 1, baseDelay + jitter);
    if (!waitWithRecovery(baseDelay + jitter)) {
      startSetupMode();
      return false;
    }
  }
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(400);
  preferences.begin("gaia-sensor", false);
  pinMode(REPROVISION_BUTTON_PIN, INPUT_PULLUP);
  const unsigned long bootRecoveryDeadline = millis() + REPROVISION_HOLD_MS;
  while (digitalRead(REPROVISION_BUTTON_PIN) == LOW && millis() < bootRecoveryDeadline) delay(25);
  if (digitalRead(REPROVISION_BUTTON_PIN) == LOW || checkReprovisionButton()) {
    clearLocalProvisioning();
  }
  deviceId = preferences.getString("deviceId", "");
  deviceToken = preferences.getString("deviceToken", "");
  wifiSsid = preferences.getString("wifiSsid", "");
  wifiPassword = preferences.getString("wifiPass", "");
  pairingCode = preferences.getString("pairCode", "");
  sequenceNumber = preferences.getULong64("seq", 0);
  loadPendingPayload();
  if (wifiSsid.length() == 0 || wifiPassword.length() == 0 ||
      ((deviceId.length() == 0 || deviceToken.length() == 0) && pairingCode.length() == 0)) {
    startSetupMode();
    return;
  }
  if (!connectWiFi()) {
    startSetupMode();
    return;
  }
  if (deviceId.length() == 0 || deviceToken.length() == 0) {
    if (!pairDevice()) {
      preferences.remove("pairCode");
      pairingCode = "";
      Serial.println("Pairing is incomplete. Obtain a new code, then enter it in Setup AP.");
      startSetupMode();
    }
  } else {
    Serial.println("Device credential loaded from NVS. Secret value is not printed.");
  }
}

void loop() {
  if (setupMode) {
    handleUsbProvisioning();
    dnsServer.processNextRequest();
    setupServer.handleClient();
    delay(2);
    return;
  }
  if (checkReprovisionButton()) {
    startSetupMode();
    return;
  }
  if (WiFi.status() != WL_CONNECTED) {
    if (connectWiFi()) wifiReconnectFailures = 0;
    else if (++wifiReconnectFailures >= WIFI_RECONNECT_LIMIT) startSetupMode();
    waitWithRecovery(1000);
    return;
  }
  if (deviceId.length() == 0 || deviceToken.length() == 0) {
    waitWithRecovery(TELEMETRY_INTERVAL_MS);
    return;
  }
  SensorValues values{};
  if (readSensors(values)) sendTelemetry(values);
  else Serial.println("Sensor read failed.");
  if (!waitWithRecovery(TELEMETRY_INTERVAL_MS)) startSetupMode();
}
