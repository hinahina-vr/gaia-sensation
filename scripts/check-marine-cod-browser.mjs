import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
const base = process.argv[2] || "http://127.0.0.1:4447";
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || "artifacts/marine-cod/qa");
fs.mkdirSync(output, { recursive: true });
const payload = JSON.parse(fs.readFileSync("data/japan-marine-cod.json", "utf8"));
const latest = payload.periods.at(-1);
const tokyo = latest.stations.find(item => item.id === "1360101");
const files = ["src/exploration/marine-cod-catalog.js", "src/exploration/marine-cod-exhibit.js", "marine-cod-exhibit.css", "data/japan-marine-cod.json", "app-content.js", "app.js", "map-mobile-shell.js", "map-exhibit-categories.js", "gaia-mode-loader.js", "index.html", "statistics-discovery.js", "statistics-lab.js"];
const report = { status: "running", base, baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  environment: "Local Chrome; real bundled MOE 2020–2024 data, touch/device emulation, not production or physical phones. Unrelated live network requests blocked. Deliberate COD failure test identified separately.",
  sha256: Object.fromEntries(files.map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const boot = async (width, height, reducedMotion = "reduce", failCod = false) => {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 900, hasTouch: width <= 900, reducedMotion });
  await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
  await context.route("https://**", route => route.abort());
  if (failCod) await context.route("**/data/japan-marine-cod.json*", route => route.fulfill({ status: 503, body: "unavailable" }));
  page = await context.newPage();
  page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
  await page.goto(`${base}/?exhibit=31&preview=marine-cod-qa#world`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.GaiaMarineCod && globalThis.GaiaMapDemo);
  await page.evaluate(() => GaiaMapDemo.stop());
  if (!failCod) {
    await page.waitForFunction(() => globalThis.GaiaMarineCod?.getState().count === 2042
      && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning")
      && document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
    await page.evaluate(() => document.fonts.ready);
  }
  return context;
};
const step = async number => {
  await page.evaluate(number => GaiaMapCategories.buttons().find(item => Number(item.textContent) === number).click(), number);
  await page.waitForFunction(number => Number(document.querySelector("#japan-mode-number").textContent) === number
    && !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"), number);
};
const select = async (pref, id) => {
  await page.locator("[data-cod-prefecture]").selectOption(pref);
  await page.locator("[data-cod-station]").selectOption(id);
  await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
};
const action = async (mobile, kind) => {
  if (mobile) { await page.locator('[data-mobile-sheet="tools"]').click(); await page.getByRole("button", { name: kind === "source" ? "データの出典" : "統計分析", exact: true }).last().click(); }
  else await page.locator(`[data-cod-${kind}]`).click();
};
try {
  const sizes = process.env.COD_VIEWPORTS?.split(",").map(size => size.split("x").map(Number)) || [[1440, 900], [390, 844], [320, 568], [844, 390]];
  for (const [width, height] of sizes) {
    const mobile = width <= 900;
    const context = await boot(width, height);
    assert.equal(await page.locator('.map-mode-button[aria-current="true"]').textContent(), "31");
    assert.equal(await page.evaluate(() => GaiaMapCategories.buttons().length), 43);
    assert.equal(await page.locator("#japan-overlay").getAttribute("data-live-backdrop"), "marine-cod-reference-map-only");
    assert(Number(await page.locator("#japan-overlay").getAttribute("data-earth-zoom")) >= 1);
    assert(Number(await page.locator("#gaia-marine-cod-canvas").getAttribute("data-cod-visible-count")) > 1800);
    await page.screenshot({ path: path.join(output, `${width}-overview.png`) });
    await select("13", tokyo.id);
    assert.equal(await page.locator("[data-cod-value]").textContent(), "3.6 mg/L");
    assert.match(await page.locator("[data-cod-secondary]").textContent(), /3\.9 mg\/L/);
    for (const entry of payload.periods) {
      const input = page.locator("[data-cod-year]");
      await input.focus(); await page.keyboard.press("Home");
      for (let i = 2020; i < entry.year; i++) await page.keyboard.press("ArrowRight");
      const expected = entry.stations.find(item => item.id === tokyo.id);
      assert.equal(await page.locator("[data-cod-value]").textContent(), `${expected.cod.text} mg/L`);
      assert.equal((await page.evaluate(() => GaiaMarineCod.getState())).selectedId, tokyo.id);
      assert.equal(await page.locator("#gaia-marine-cod-canvas").getAttribute("data-cod-point-count"), String(entry.stations.length));
    }
    // All controls can be scrolled into view and really hit; no invisible cover.
    for (const selector of ["[data-cod-prefecture]", "[data-cod-station]", "[data-cod-year]", "[data-cod-play]", "[data-cod-overview]"]) {
      const control = page.locator(selector); await control.scrollIntoViewIfNeeded();
      assert(await control.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), `${width}: unreachable ${selector}`);
    }
    const bounds = await page.locator(".gaia-marine-cod-readout").evaluate(node => ({ rect: node.getBoundingClientRect().toJSON(), opacity: getComputedStyle(node).opacity, background: getComputedStyle(node).backgroundImage }));
    assert(bounds.rect.left >= 0 && bounds.rect.right <= width && bounds.rect.top >= 0 && bounds.rect.bottom <= height);
    assert.equal(bounds.opacity, "1"); assert.match(bounds.background, /0\.8/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.screenshot({ path: path.join(output, `${width}-selected.png`) });
    await action(mobile, "source");
    await page.locator("#japan-data-panel").waitFor({ state: "visible" });
    assert.match(await page.locator("#japan-data-panel").innerText(), /海域のCOD/);
    assert(await page.locator('#japan-data-panel a[href*="water-pub.env.go.jp"]').count());
    await page.locator("#japan-data-close").click();
    if (mobile) {
      await page.locator('[data-mobile-sheet="reading"]').click();
      assert.match(await page.locator("#map-mobile-sheet").innerText(), /DO（溶存酸素量）/);
      assert.equal(await page.locator("#map-mobile-sheet .gaia-cod-history > span").count(), 5);
      assert(await page.locator("#map-mobile-sheet .gaia-cod-history").isVisible(), "Selected station's five-year history remains visible in reading");
      await page.screenshot({ path: path.join(output, `${width}-reading.png`) });
      await page.locator("[data-mobile-sheet-close]").click();
    } else {
      await page.locator(".gaia-marine-cod-legend summary").click();
      assert.match(await page.locator(".gaia-marine-cod-legend").innerText(), /環境基準・危険度/);
      await page.locator(".gaia-marine-cod-legend summary").click();
    }
    await action(mobile, "analysis");
    await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady === true);
    const analysis = await page.evaluate(() => ({ state: GaiaStatisticsLab.getState(), dataset: GaiaMarineCod.getStatisticsDataset(), used: document.querySelector("#gaia-statistics-kpis").dataset.usedRows }));
    assert.equal(analysis.state.datasetId, `japan-marine-cod-${tokyo.id}`);
    assert.equal(analysis.dataset.rows.length, 5); assert.equal(Number(analysis.used), 5);
    assert.deepEqual(analysis.dataset.rows.map(item => item.y), payload.periods.map(item => item.stations.find(item => item.id === tokyo.id).cod.value));
    assert.equal(await page.locator("#gaia-statistics-canvas").getAttribute("data-point-count"), "5", "The actual analysis chart shows five observed COD values, not one record-count metric");
    assert.equal(await page.locator("#gaia-statistics-lab [download]").count(), 0, "Analysis remains screen-only; no unsupported export");
    await page.screenshot({ path: path.join(output, `${width}-analysis.png`) });
    await page.evaluate(() => GaiaStatisticsLab.close());
    await select("34", "3461851");
    assert.equal(await page.locator("[data-cod-value]").textContent(), "欠測");
    assert.equal((await page.evaluate(() => GaiaMarineCod.getStatisticsDataset())).rows.length, 0, "Missing values never become zero in analysis");
    await page.locator("[data-cod-year]").focus(); await page.keyboard.press("Home");
    await select("47", "4760252");
    assert.equal(await page.locator("[data-cod-secondary]").textContent(), "COD75（75%値）: <0.5 mg/L");
    await page.locator("[data-cod-year]").focus(); await page.keyboard.press("End");
    await page.locator("[data-cod-overview]").click();
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
    // Independently project actual source coordinates, then physically tap one
    // exposed point. No synthetic data or DOM click used for map selection.
    const hit = await page.evaluate(rows => {
      const map = document.querySelector("#japan-map"), rect = map.getBoundingClientRect(), d = document.querySelector("#japan-overlay").dataset;
      const base = rect.width >= 901 ? rect.width / 360 : Math.max(rect.width / 360, rect.height / 180);
      const scale = base * Number(d.earthZoom), ox = (rect.width - 360 * scale) / 2 + Number(d.earthOffsetX), oy = (rect.height - 180 * scale) / 2 + Number(d.earthOffsetY);
      for (const row of rows) {
        const x = rect.x + ox + ((row.lon - 150 + 540) % 360) * scale, y = rect.y + oy + (90 - row.lat) * scale;
        const panelTop = document.querySelector(".gaia-marine-cod-readout").getBoundingClientRect().top;
        if (x < 12 || x > innerWidth - 12 || y < 95 || y > panelTop - 5 || document.elementFromPoint(x, y) !== map) continue;
        const actual = GaiaMarineCod.findPoiAt(x, y, "touch");
        if (actual?.record.id === row.id) return { x, y, id: row.id };
      }
      return null;
    }, latest.stations);
    assert(hit, `${width}: exposed source point available`);
    if (mobile) await page.touchscreen.tap(hit.x, hit.y); else await page.mouse.click(hit.x, hit.y);
    assert.equal((await page.evaluate(() => GaiaMarineCod.getState())).selectedId, hit.id);
    // Numeric route's new boundary and each existing provider family.
    for (const number of [30, 31, 1, 31, 2, 31, 15, 31, 6, 31]) {
      await step(number);
      assert.equal(await page.locator("#gaia-marine-cod-canvas").isVisible(), number === 31);
    }
    report.checks.push({ width, height, bounds, mapTap: hit.id, source: "MOE original bundled records", analysisRows: 5, result: "passed" });
    console.log(`PASS ${width}x${height}: COD source values, years, missing, limit, map tap, source, analysis, provider navigation`);
    await context.close();
  }
  const context = await boot(1440, 900, "no-preference");
  const first = await page.locator("#gaia-marine-cod-canvas").evaluate(node => node.toDataURL());
  await page.waitForTimeout(650);
  const second = await page.locator("#gaia-marine-cod-canvas").evaluate(node => node.toDataURL());
  assert.notEqual(first, second, "Real canvas pixels animate station rings");
  await page.locator("[data-cod-play]").click();
  await page.waitForFunction(() => GaiaMarineCod.getState().year === 2020, null, { timeout: 8000 });
  await page.locator("[data-cod-play]").click();
  assert.equal((await page.evaluate(() => GaiaMarineCod.getState())).playing, false);
  report.checks.push({ motion: "actual canvas pixels change; automatic year 2024→2020 and stop passed" });
  await context.close();
  const failed = await boot(390, 844, "reduce", true);
  await page.getByText("読込に失敗しました。展示31を選び直して再試行してください。", { exact: true }).waitFor();
  assert(await page.locator("[data-cod-controls]").evaluate(node => node.disabled));
  assert(await page.locator("[data-cod-year]").isDisabled(), "The actual year control inherits the disabled fieldset");
  await step(6);
  assert.equal(await page.locator(".gaia-marine-cod-readout").isVisible(), false);
  report.checks.push({ errorPath: "Deliberate HTTP 503 shows failure and permits exit to existing exhibit" });
  await failed.close();
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
