import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const index = read("index.html");
const sensors = read("sensors/index.html");
const css = read("sensors/sensor-platform.css");
const report = [];
const check = (name, run) => { run(); report.push({ name, status: "passed" }); };

check("ESP32 registration card follows map and links to the sensor SPA", () => {
  const map = index.indexOf('data-intro-path="map"');
  const sensor = index.indexOf("data-sensor-platform-link");
  assert(map >= 0 && map < sensor);
  const card = index.slice(index.lastIndexOf("<a", sensor), index.indexOf("</a>", sensor) + 4);
  assert.match(card, /href="\.\/sensors\/#esp32"/u);
  assert.match(card, /<strong>センサーを地球につなぐ<\/strong>/u);
  assert.match(card, /<p>実物の観測点を、地球の感覚器へ。<\/p>/u);
  assert.match(card, /class="intro-path-enter">観測点を追加/u);
});

check("logged-out registration CTA and four-step preview are explicit", () => {
  assert.match(sensors, /Googleで続ける/u);
  const preview = sensors.slice(sensors.indexOf("sensor-register-preview"), sensors.indexOf("</ol>", sensors.indexOf("sensor-register-preview")));
  for (const fragment of ["対応確認とバックアップ", "GAIAファームウェアを書き込む", "公開観測点を追加", "Pairing Code", "USBで設定", "ONLINE"]) assert(preview.includes(fragment), fragment);
  assert.match(sensors, /コードの準備から順番に見る/u);
});

check("sensor workspace shares the exhibition scene and observation-node onboarding", () => {
  for (const fragment of ["sensor-atmosphere-visual", "OBSERVATION NODE", "FIRST OBSERVATION", "WAITING FOR SIGNAL", "DECLARE", "PAIR", "OBSERVE"]) {
    assert(sensors.includes(fragment), fragment);
  }
  assert.match(css, /gateway-keyvisual-v2\.png/u);
  assert.match(css, /\.sensor-dashboard:has\(\.sensor-empty:not\(\[hidden\]\)\)/u);
  assert.match(css, /\.sensor-empty-flow \{[\s\S]*grid-template-columns: repeat\(3,minmax\(0,1fr\)\)/u);
});

check("pairing view presents USB first and Setup AP as fallback", () => {
  const pairing = sensors.slice(sensors.indexOf('data-view="pairing"'), sensors.indexOf("</section>", sensors.indexOf('data-view="pairing"')));
  for (const fragment of ["USB", "Codex", "CITY-SENSOR-XXXX", "http://192.168.4.1/", "2.4GHz Wi-Fi", "Pairing Code", "ONLINE", "PCの常時接続は不要"]) assert(pairing.includes(fragment), fragment);
});

check("public guide documents verified firmware, backup, USB provisioning, and limits", () => {
  const guide = sensors.slice(sensors.indexOf('data-view="guide"'), sensors.indexOf("</section>\n    </main>", sensors.indexOf('data-view="guide"')));
  for (const fragment of ["ESP32-WROOM-32", "4MB flash", "CH340", "Secure Boot", "SHA-256", "模擬データ", "GAIAファームウェア", "匿名のおためし参加", "USB", "CITY-SENSOR-XXXX", "ONLINE", "未検証"]) assert(guide.includes(fragment), fragment);
  assert.doesNotMatch(guide, />Starter Kit README</u);
  const script = read("sensors/sensor-platform.js");
  assert.match(script, /location\.hash === "#guide"\) showView\("guide"\)/u);
});

check("registration is public-only and terms are visible without login", () => {
  assert.doesNotMatch(sensors, /name="isPublic" type="checkbox"/u);
  assert.match(sensors, /name="isPublic" type="hidden" value="true"/u);
  assert.match(sensors, /name="acceptTerms" type="checkbox" required/u);
  for (const fragment of ["利用条件", "非公開登録はありません", "展示・教育・試作用途", "秘密情報を表示・共有しない"]) assert(sensors.includes(fragment), fragment);
  assert.match(read("sensors/sensor-platform.js"), /"map", "guide", "terms"/u);
});

check("registration uses canonical region selectors and the shared Natural Earth map", () => {
  for (const field of ['name="subdivisionCode"', 'name="municipalityCode"', "ISO 3166-2", "全国地方公共団体コード"]) assert(sensors.includes(field), field);
  assert.match(read("sensors/sensor-platform.js"), /natural-earth-50m-land\.geojson/u);
  assert.doesNotMatch(read("sensors/sensor-platform.js"), /mapSvg|<svg viewBox/u);
});

check("responsive styles preserve readable setup layouts", () => {
  for (const selector of [".sensor-register-preview", ".sensor-setup-steps"]) assert(css.includes(selector));
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.sensor-register-preview, \.sensor-setup-steps \{ grid-template-columns: 1fr;/u);
  assert.match(css, /\.sensor-code-downloads \{ grid-template-columns: 1fr;/u);
  assert.match(css, /\.sensor-login-actions > button \{ width: 100%; min-width: 0;/u);
});

check("sensor workspace uses the same typographic roles as the GAIA main UI", () => {
  assert.match(css, /--font-ja: "Yu Mincho"/u);
  assert.match(css, /--font-ui: "Arial Narrow"/u);
  assert.match(css, /--font-display: Georgia/u);
  assert.match(css, /body \{[\s\S]*font-family: var\(--font-ui\)/u);
  assert.match(css, /\.sensor-login h1,[\s\S]*font-family: var\(--font-ja\)/u);
  assert.match(css, /\.sensor-primary,[\s\S]*font-family: var\(--font-ja\)/u);
});

console.log(JSON.stringify({ status: "passed", scans: report.length, report }, null, 2));
