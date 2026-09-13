import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const starter = fs.readFileSync(path.join(root, "smartcity-sensor-starter-kit/esp32-arduino/SmartCitySensorDemo/SmartCitySensorDemo.ino"), "utf8");
const config = fs.readFileSync(path.join(root, "smartcity-sensor-starter-kit/esp32-arduino/SmartCitySensorDemo/config.example.h"), "utf8");
const report = [];
const check = (name, run) => { run(); report.push({ name, status: "passed" }); };

check("wrong Wi-Fi returns to Setup AP", () => {
  assert.match(starter, /if \(!connectWiFi\(\)\) \{\s*startSetupMode\(\);/u);
  assert.match(starter, /wifiReconnectFailures >= WIFI_RECONNECT_LIMIT\) startSetupMode\(\)/u);
  assert.match(config, /#define WIFI_RECONNECT_LIMIT 3/u);
});

check("failed Pairing Code is removed and Setup AP accepts replacement", () => {
  assert.match(starter, /if \(!pairDevice\(\)\) \{[\s\S]*preferences\.remove\("pairCode"\);[\s\S]*startSetupMode\(\);/u);
  assert.match(starter, /preferences\.putString\("pairCode", submittedPairing\)/u);
});

check("long hold provides explicit reprovision", () => {
  assert.match(starter, /checkReprovisionButton/u);
  assert.match(starter, /millis\(\) - reprovisionPressedAt < REPROVISION_HOLD_MS/u);
  assert.match(starter, /clearLocalProvisioning\(\)/u);
  assert.match(config, /REPROVISION_BUTTON_PIN 0/u);
});

check("pending envelope is persisted before HTTPS", () => {
  const persist = starter.indexOf('preferences.putString("pending", encodedEnvelope)');
  const post = starter.indexOf("httpsPost(endpoint, pendingPayload");
  assert(persist >= 0 && post > persist);
  assert.match(starter, /envelope\["seq"\] = sequenceNumber/u);
  assert.match(starter, /envelope\["body"\] = body/u);
});

check("power loss after server accept replays byte-equivalent payload", () => {
  const advance = starter.indexOf('preferences.putULong64("seq", nextSequence)');
  const clear = starter.indexOf("clearPendingPayload();", advance);
  assert(advance >= 0 && clear > advance);
  assert.match(starter, /if \(preferences\.putULong64\("seq", nextSequence\) != sizeof\(nextSequence\)\) \{[\s\S]*retaining the pending payload[\s\S]*return false;/u);
  const server = new Map();
  const nvs = { seq: 7, pending: null };
  const canonicalBody = JSON.stringify({ seq: 7, observedAt: "2026-08-12T08:21:32Z", data: { temperature: 24.1 } });
  nvs.pending = JSON.stringify({ seq: nvs.seq, body: canonicalBody });
  const first = accept(server, canonicalBody);
  assert.equal(first, 202);
  // Power fails before seq update: NVS still contains the exact envelope.
  const rebooted = JSON.parse(nvs.pending);
  assert.equal(rebooted.body, canonicalBody);
  const replay = accept(server, rebooted.body);
  assert.equal(replay, 200);
  nvs.seq = rebooted.seq + 1;
  nvs.pending = null;
  assert.deepEqual(nvs, { seq: 8, pending: null });
});

check("power loss after seq update discards old pending envelope", () => {
  const nvs = { seq: 8, pending: JSON.stringify({ seq: 7, body: '{"seq":7}' }) };
  const pending = JSON.parse(nvs.pending);
  if (pending.seq < nvs.seq) nvs.pending = null;
  assert.deepEqual(nvs, { seq: 8, pending: null });
  assert.match(starter, /if \(pendingSequence < sequenceNumber\) \{[\s\S]*clearPendingPayload\(\)/u);
});

check("secret logging and insecure TLS stay prohibited", () => {
  assert.doesNotMatch(starter, /setInsecure\s*\(/u);
  assert.doesNotMatch(starter, /Serial\.(?:print|printf).*deviceToken/iu);
  assert.doesNotMatch(starter, /Serial\.(?:print|printf).*wifiPassword/iu);
  assert.doesNotMatch(starter, /Serial\.(?:print|printf).*pairingCode/iu);
});

console.log(JSON.stringify({ status: "passed", scans: report.length, report }, null, 2));

function accept(server, body) {
  const parsed = JSON.parse(body);
  const existing = server.get(parsed.seq);
  if (existing === undefined) {
    server.set(parsed.seq, body);
    return 202;
  }
  return existing === body ? 200 : 409;
}
