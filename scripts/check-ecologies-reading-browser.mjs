import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/ecologies-reading");
const requested = process.argv[4]?.split(",");
const countries = JSON.parse(fs.readFileSync("data/gaia-signals.json", "utf8")).modes.find(mode => mode.id === "three-ecologies").signals.pairedCountries;
const nearest = iso3 => {
  const selected = countries.find(row => row.iso3 === iso3);
  return countries.filter(row => row.iso3 !== iso3).sort((a, b) => Math.abs(a.urbanPercent - selected.urbanPercent) - Math.abs(b.urbanPercent - selected.urbanPercent) || a.iso3.localeCompare(b.iso3))[0];
};
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const viewport of [{ width: 3840, height: 2088 }, { width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740, reduced: true }]) {
    const name = `${viewport.width}${viewport.reduced ? "-reduced" : ""}`;
    if (requested && !requested.includes(name)) continue;
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: viewport.reduced ? "reduce" : "no-preference" });
    await context.addInitScript(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true"); });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${name}: ${error.message}`));
    await page.goto(`${base}/?preview=ecologies-reading#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
    await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); document.querySelector('.map-mode-bank [data-map-standard-index="6"]').click(); });
    await page.waitForFunction(() => !document.querySelector("#ecologies-exhibit")?.hidden && document.querySelector("#japan-overlay").dataset.plotRevealState === "complete");
    await page.evaluate(() => document.fonts.ready);
    const panel = page.locator("#ecologies-exhibit");
    assert.equal(await panel.getAttribute("data-selected"), "JPN");
    assert.equal(await panel.getAttribute("data-peer"), nearest("JPN").iso3);
    assert.equal(await page.locator("#japan-overlay").getAttribute("data-ecologies-culture-count"), "0");
    const japan = countries.find(row => row.iso3 === "JPN"), peer = nearest("JPN");
    const insight = await panel.locator(".eco-insight").innerText();
    assert(insight.includes(`都市人口率の差は${Math.abs(japan.urbanPercent - peer.urbanPercent).toFixed(1)}ポイント`));
    assert(insight.includes(`森林率の差は${Math.abs(japan.forestPercent - peer.forestPercent).toFixed(1)}ポイント`));
    assert.match(await panel.locator(".eco-definition").first().innerText(), /陸地.*人口.*100%/u);
    const bounds = await panel.evaluate(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }; });
    assert(bounds.x >= 0 && bounds.right <= viewport.width && bounds.bottom <= viewport.height - 70);
    assert(bounds.scrollWidth <= bounds.clientWidth + 1, `${name}: horizontal panel overflow`);
    const bars = await panel.locator('[role="meter"]').evaluateAll(elements => elements.map(element => {
      const r = element.getBoundingClientRect(), b = element.firstElementChild.getBoundingClientRect(); return { value: Number(element.getAttribute("aria-valuenow")), ratio: b.width / r.width * 100 }; }));
    bars.forEach(bar => assert(Math.abs(bar.value - bar.ratio) < .1));
    await page.screenshot({ path: path.join(output, `${name}-compare.jpg`), type: "jpeg", quality: 92 });
    await page.waitForTimeout(1200);
    assert.equal(await panel.getAttribute("data-selected"), "JPN");
    await panel.locator(".eco-country").selectOption("IND");
    await page.waitForFunction(() => document.querySelector("#ecologies-exhibit").dataset.selected === "IND" && document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
    await page.waitForTimeout(viewport.reduced ? 40 : 750);
    assert.equal(await panel.getAttribute("data-peer"), nearest("IND").iso3);
    const focused = await page.locator("#japan-overlay").evaluate(element => ({ x: Number(element.dataset.ecologiesSelectedScreenX), y: Number(element.dataset.ecologiesSelectedScreenY), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
    assert(Math.abs(focused.x / focused.width - (viewport.width < 680 ? .48 : .38)) < .015);
    assert(Math.abs(focused.y / focused.height - (viewport.width < 680 ? .2 : .44)) < .015, JSON.stringify(focused));
    await panel.locator('[data-eco-view="pattern"]').click();
    await page.waitForFunction(count => document.querySelectorAll(".eco-scatter-point").length === count, countries.length);
    const chart = await panel.locator(".eco-chart svg").evaluate(svg => ({ count: svg.querySelectorAll(".eco-scatter-point").length, ticks: [...svg.querySelectorAll(".eco-tick")].map(node => node.textContent), reading: svg.closest('[role="tabpanel"]').textContent }));
    assert.equal(chart.count, countries.length); assert.equal(chart.ticks.filter(text => text === "100").length, 2);
    assert.match(chart.reading, /一方向の強い関係は見られません/u);
    await panel.locator('[data-eco-country="SWE"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#ecologies-exhibit").dataset.selected === "SWE");
    await page.waitForTimeout(viewport.reduced ? 40 : 750);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-eco-country")), "SWE");
    await panel.locator(".eco-method").evaluate(element => { element.open = true; });
    await page.screenshot({ path: path.join(output, `${name}-pattern.jpg`), type: "jpeg", quality: 92 });
    await panel.locator('[data-eco-view="culture"]').click();
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.ecologiesCultureCount === "24");
    assert.equal(await panel.locator(".eco-site option").count(), 24);
    await panel.locator(".eco-site").selectOption("3");
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.viewAnimation === "idle");
    await page.waitForTimeout(viewport.reduced ? 40 : 750);
    await page.screenshot({ path: path.join(output, `${name}-culture.jpg`), type: "jpeg", quality: 92 });
    await panel.locator('[data-eco-view="compare"]').click();
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.ecologiesCultureCount === "0");
    if (!viewport.reduced) {
      await panel.locator(".eco-play").click();
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.ecologiesPlaying === "true");
      await panel.locator(".eco-play").click();
      await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.ecologiesPlaying === "false");
    }
    await page.evaluate(() => document.querySelector('.map-mode-bank [data-map-standard-index="8"]').click());
    await page.waitForFunction(() => document.querySelector("#ecologies-exhibit").hidden && !document.querySelector("#japan-layer").classList.contains("is-ecologies-exhibit"));
    await page.waitForFunction(() => Number(document.querySelector("#japan-overlay").dataset.populationCircleCount) > 200);
    report.checks.push({ name, bounds, bars, chart, exitClean: true });
    await context.close();
    console.log(`PASS ${name}: comparison, denominators, SVG keyboard selection, cultural view, playback, mode exit`);
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; await page?.screenshot({ path: path.join(output, "failure.jpg") }).catch(() => {}); throw error; }
finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
