import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const output = path.resolve(process.env.GAIA_SENSOR_GUIDE_OUTPUT || "artifacts/sensor-guide");
fs.mkdirSync(output, { recursive: true });
// Use the actual repository catalogue, without contacting production or devices.
const catalogueSource = stripTypeScriptTypes(fs.readFileSync("sensor-platform/src/measurements.ts", "utf8"))
  .replace(/^import .*;\s*/mu, "").replace(/\bexport /gu, "");
const catalogue = vm.runInNewContext(`${catalogueSource}\nlistMeasurementTypes()`, { json: value => value });
const html = fs.readFileSync("sensors/index.html", "utf8");
const guideMarkup = html.slice(html.indexOf('data-view="guide"'), html.indexOf('data-view="terms"'));
for (const copy of ["ESP32-WROOM-32", "4MB flash", "CH340", "Secure Boot", "SHA-256", "未検証", "模擬データ", "実測には", "最大16項目", "秘密", "バックアップ"]) assert(guideMarkup.includes(copy), copy);
const server = spawn(process.execPath, ["scripts/serve-sensor-platform-qa.mjs", "4498"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
const report = { status: "running", checks: [], errors: [], catalogueSize: catalogue.measurements.length };
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Mock server startup timed out")), 10000);
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Mock server exited: ${code}`)); });
    server.stdout.on("data", data => {
      if (data.toString().includes("sensor qa http://127.0.0.1:4498")) { clearTimeout(timeout); resolve(); }
    });
  });
  browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  for (const [width, height] of [[1440,900], [1024,768], [390,844], [320,568]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 600, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.addInitScript(() => sessionStorage.setItem("gaia:mode-entry-guide:sensor:v3", "seen"));
    await page.route("**/api/public/v1/measurement-types", route => route.fulfill({ json: catalogue }));
    const open = async (hash = "#guide", query = "") => {
      await page.goto(`http://127.0.0.1:4498/sensors/${query}${hash}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.querySelector("#measurement-catalog-summary").textContent.includes("つの分野"));
      await page.waitForTimeout(550);
      assert.equal(await page.locator("html").getAttribute("data-sensor-view"), "guide");
    };
    await open();
    const groups = page.locator("#guide .sensor-measurement-group");
    assert.equal(await groups.count(), catalogue.categories.length);
    assert.equal(await page.locator("#guide .sensor-measurement-group[open]").count(), 0);
    assert.equal(await page.locator("#guide .sensor-measurement-item").count(), catalogue.measurements.length);
    assert.equal(await page.locator("#measurement-catalog-disclaimer").textContent(), catalogue.disclaimerJa);
    for (const definition of catalogue.measurements.filter(item => item.noteJa)) {
      assert.equal(await page.locator("#guide .sensor-measurement-item").filter({ has: page.locator("code", { hasText: new RegExp(`^${definition.key}$`, "u") }) }).locator(".sensor-measurement-note").textContent(), definition.noteJa);
    }
    const layout = await page.evaluate(() => {
      const title = document.querySelector("#guide h1");
      return {
        overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        titleLines: Math.round(title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight)),
        kitColumns: getComputedStyle(document.querySelector("#guide .sensor-kit-list")).gridTemplateColumns.split(" ").length,
        closedHeights: [...document.querySelectorAll("#guide .sensor-measurement-group")].map(item => item.getBoundingClientRect().height),
      };
    });
    assert.equal(layout.overflowX, false, JSON.stringify(layout));
    assert.equal(layout.titleLines, 2);
    assert.equal(layout.kitColumns, width < 620 ? 2 : 4);
    assert(layout.closedHeights.every(value => value < 120));
    await page.screenshot({ path: path.join(output, `${width}-overview.png`) });
    for (const id of ["sensor-kit-title", "measurement-catalog-title", "sensor-connect-path", "sensor-trouble-title"]) {
      await page.locator(`#guide .sensor-guide-jump a[href='#${id}']`).click();
      await page.waitForTimeout(850);
      assert.equal(await page.locator("html").getAttribute("data-sensor-view"), "guide");
      const top = await page.locator(`#${id}`).evaluate(node => node.getBoundingClientRect().top);
      const headerBottom = await page.locator(".sensor-topbar").evaluate(node => node.getBoundingClientRect().bottom);
      assert(top >= headerBottom && top < height * .7, `Anchor ${id}: ${top} / header ${headerBottom}`);
      if (id === "sensor-connect-path") await page.screenshot({ path: path.join(output, `${width}-steps.png`) });
    }
    await open("#measurement-catalog-title");
    assert((await page.locator("#measurement-catalog-title").boundingBox()).y < height * .7);
    await page.screenshot({ path: path.join(output, `${width}-catalogue-closed.png`) });
    const first = groups.first();
    await first.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await first.getAttribute("open"), "");
    assert((await groups.nth(1).boundingBox()).height < 120, "Closed next group should not stretch");
    await page.screenshot({ path: path.join(output, `${width}-catalogue.png`) });
    const search = page.locator("#measurement-catalog-search");
    for (const query of ["気温", "BME280", "ＤＳ１８Ｂ２０", "水温", "no-such-sensor"]) {
      await search.fill(query);
      const normalized = query.normalize("NFKC").toLocaleLowerCase();
      const expected = catalogue.measurements.filter(d => [catalogue.categories.find(c => c.id === d.category).labelJa, d.labelJa, d.labelEn, d.key, d.unit, ...d.interfaces, ...d.exampleSensors].join(" ").normalize("NFKC").toLocaleLowerCase().includes(normalized)).length;
      assert.equal(await page.locator("#guide .sensor-measurement-item:visible").count(), expected, query);
      assert.equal(await page.locator("#measurement-catalog-empty").isVisible(), expected === 0);
      assert.match(await page.locator("#measurement-catalog-summary").textContent(), new RegExp(`${expected}項目が一致`));
    }
    await search.fill("");
    assert.equal(await page.locator("#guide .sensor-measurement-group[open]").count(), 1, "Clearing search restores disclosure state");
    assert.equal(await first.getAttribute("open"), "");
    await page.locator("#sensor-guide-copy").click();
    await page.waitForFunction(() => document.querySelector("#sensor-guide-copy-status").textContent.includes("コピーしました"));
    assert.match(await page.locator("#sensor-guide-copy-status").textContent(), /コピーしました/u);
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/gu, "\n"), await page.locator("#sensor-guide-request-text").textContent());
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, "writeText", { value: async () => { throw new Error("Permission denied"); } }));
    await page.locator("#sensor-guide-copy").click();
    assert.match(await page.locator("#sensor-guide-copy-status").textContent(), /手動でコピー/u);
    assert.equal(await page.evaluate(() => getSelection().toString()), await page.locator("#sensor-guide-request-text").textContent());
    await page.locator("#guide .sensor-troubleshooting summary").first().click();
    assert.match(await page.locator("#guide .sensor-troubleshooting details[open] p").textContent(), /認証情報・未送信データが消去/u);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open("#sensor-kit-title", "?authenticated=1");
    assert((await page.locator("#sensor-kit-title").boundingBox()).y < height * .7);
    // Registration has its own picker; guide filtering must not alter it.
    assert((await page.locator("[data-measurement-picker] input").count()) >= catalogue.measurements.length);
    await page.route("**/api/public/v1/measurement-types", route => route.fulfill({ status: 503, json: { message: "QA unavailable" } }));
    await page.goto("http://127.0.0.1:4498/sensors/#guide", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#measurement-catalog-search").disabled);
    assert.match(await page.locator("#measurement-catalog-summary").textContent(), /再読み込み/u);
    assert.equal(await page.locator("#guide").isVisible(), true);
    report.checks.push({ width, height, layout, navigation: "4 anchors + anonymous reload + authenticated/reduced motion", catalogue: "full definitions, safety notes, search, restore, error", clipboard: "success and denied fallback" });
    await context.close();
    console.log(`PASS ${width}×${height}: guide, search, anchors, clipboard and errors`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser?.close();
  server.kill();
}
