import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4447";
const output = path.resolve(process.argv[3] || "artifacts/statistics-game/verified");
const requested = process.argv[4]?.split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = {
  status: "running", environment: "Local Chrome with repository snapshot/fixture data; not physical devices or live AI providers",
  baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sha256: Object.fromEntries(["index.html", "gaia-mode-loader.js", "statistics-lab.js", "statistics-ai.js", "statistics-game.css", "assets/modes/analysis-mizu-ame-companions-v1.webp"].map(file => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])),
  checks: [], errors: [],
};
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const [width, height] of [[3840, 2088], [2560, 1392], [1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 568], [844, 390]].filter(([w]) => !requested || requested.includes(w))) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 980, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    page.on("console", message => { if (message.type() === "error" && message.text().includes("Statistics Lab analysis failed")) report.errors.push(message.text()); });
    const load = async (reload = false) => {
      if (reload) await page.reload({ waitUntil: "domcontentloaded" });
      else await page.goto(`${base}/?preview=statistics-game-qa#world`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapCategories?.buttons().length >= 30 && globalThis.GaiaMapDemo);
      await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false }); });
    };
    const ready = async () => {
      await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const view = name => page.locator(`[data-stat-view="${name}"]`);
    const analyzeFromMap = async () => {
      if (width > 980) await page.locator(".map-dock-action--statistics").click();
      else {
        await page.locator('[data-mobile-sheet="tools"]').tap();
        await page.locator("#map-mobile-sheet").getByRole("button", { name: "統計分析", exact: true }).tap();
      }
    };
    const shell = () => page.locator(".gaia-statistics-shell");
    const atTop = () => shell().evaluate(node => { node.scrollTop = 0; });
    const capture = async name => {
      await page.locator("#gaia-statistics-lab img").evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
      await atTop(); await page.mouse.move(0, 0);
      await page.screenshot({ path: path.join(output, `${width}-${name}.png`) });
    };
    const bounds = async () => {
      const scan = await shell().evaluate(node => ({
        rect: node.getBoundingClientRect().toJSON(), overflow: node.scrollWidth - node.clientWidth,
        documentOverflow: document.documentElement.scrollWidth - innerWidth,
        tabs: [...node.querySelectorAll("[data-stat-view]")].map(tab => tab.getBoundingClientRect().toJSON()),
      }));
      assert(scan.rect.left >= 0 && scan.rect.right <= width + 1 && scan.rect.top >= 0 && scan.rect.bottom <= height + 1, `Shell outside viewport: ${JSON.stringify(scan)}`);
      assert(scan.rect.width >= width * .86 && scan.rect.width <= width * .94, `${width}: compact statistics panel width`);
      assert(scan.overflow <= 1 && scan.documentOverflow <= 1, `${width}: horizontal overflow`);
      for (const tab of scan.tabs) assert(tab.width >= 44 && tab.height >= 44 && tab.left >= scan.rect.left && tab.right <= scan.rect.right, `${width}: tab bounds`);
      return scan;
    };
    await load();
    // Reproduce the user's exact entry: exhibit 11 -> actual Analyze button.
    await page.evaluate(() => GaiaMapCategories.buttons().find(button => Number(button.textContent) === 11).click());
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    await analyzeFromMap();
    await ready();
    assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().datasetId), "earthquakes");
    assert.equal(await view("chart").getAttribute("aria-selected"), "true", "Analyze opened findings instead of graph");
    const geometry = await bounds();
    const plot = await page.locator("#gaia-statistics-visual").evaluate(node => ({
      background: getComputedStyle(node).backgroundColor, width: node.clientWidth, height: node.clientHeight,
      font: Number(node.querySelector("canvas").dataset.labelSize), points: Number(node.querySelector("canvas").dataset.pointCount),
      visibleHeight: Math.max(0, Math.min(innerHeight, node.getBoundingClientRect().bottom) - node.getBoundingClientRect().top),
    }));
    assert.equal(plot.background, "rgb(251, 254, 255)"); assert.equal(plot.points, 25);
    assert(plot.font >= (width >= 2560 ? 20 : 13), "Graph labels remain tiny");
    assert(plot.visibleHeight >= 100, "The selected graph must be visible immediately, including landscape");
    const actionContrast = await page.locator('.gaia-statistics-view-tabs [aria-selected="true"], .gaia-statistics-discover-cta, .gaia-statistics-ai-open').evaluateAll(nodes => {
      const luminance = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      return nodes.flatMap(node => [...getComputedStyle(node).backgroundImage.matchAll(/rgb\((\d+), (\d+), (\d+)\)/g)].map(match => 1.05 / (luminance(match.slice(1).map(Number)) + .05)));
    });
    assert(actionContrast.length >= 6 && actionContrast.every(ratio => ratio >= 4.5), "White action labels need readable contrast");
    const before = await page.locator("#gaia-statistics-metrics").textContent();
    await capture("chart");
    await page.locator(".gaia-statistics-companion").click();
    assert.equal(await view("findings").getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#gaia-statistics-takeaway").isVisible(), false);
    await bounds();
    const findings = page.locator("#gaia-statistics-findings");
    const reading = await findings.evaluate(node => ({ width: node.clientWidth, overflow: node.scrollWidth - node.clientWidth,
      font: parseFloat(getComputedStyle(node.querySelector('[data-kind="meaning"] p')).fontSize),
      kinds: [...node.querySelectorAll(":scope > [data-kind]")].map(card => card.dataset.kind),
    }));
    assert(reading.overflow <= 1); assert(reading.width >= geometry.rect.width * .86);
    assert(reading.font >= (width >= 2560 ? 25 : 16));
    assert.deepEqual(reading.kinds, ["observation", "meaning", "limit"]);
    assert.doesNotMatch(await findings.textContent(), /NaN|undefined|Infinity/);
    await capture("findings");
    await findings.locator('[data-kind="observation"] button').first().click();
    assert.equal(await view("records").getAttribute("aria-selected"), "true");
    assert.equal(await page.locator('#gaia-statistics-records-body tr[data-selected="true"]').count(), 1);
    for (const name of ["values", "insights", "chart"]) {
      await view(name).click(); await bounds();
      assert.equal(await view(name).getAttribute("aria-selected"), "true");
      assert.equal(await page.locator("#gaia-statistics-metrics").textContent(), before, "Navigation changed the calculated values");
    }
    await page.locator(".gaia-statistics-discover-cta").click();
    assert.equal(await view("findings").getAttribute("aria-selected"), "true");
    await page.locator("#stat-panel-findings .gaia-statistics-panel-back").click();
    await page.waitForFunction(() => document.activeElement.id === "gaia-statistics-canvas");
    assert.equal(await view("chart").getAttribute("aria-selected"), "true");
    await view("chart").focus(); await page.keyboard.press("ArrowRight");
    assert.equal(await view("findings").getAttribute("aria-selected"), "true");
    await page.locator("#gaia-statistics-close").click();
    await analyzeFromMap();
    await ready(); assert.equal(await view("chart").getAttribute("aria-selected"), "true", "Reopening retained findings");

    // Histogram keyboard + actual pointer hit tests also cover 4K scaling.
    await page.locator("#gaia-statistics-menu-toggle").click();
    await page.locator('[data-analysis-group="descriptive"]').click();
    await page.locator('[data-method="summary"]').click(); await ready();
    const canvas = page.locator("#gaia-statistics-canvas");
    // Coincident histogram marks share a pointer location; the first mark is
    // the deterministic pointer target. Keyboard selection reaches every row.
    await canvas.scrollIntoViewIfNeeded(); await canvas.focus(); await page.keyboard.press("Home");
    const pointer = await page.evaluate(() => {
      const canvas = document.querySelector("#gaia-statistics-canvas");
      const tip = document.querySelector(".gaia-statistics-chart-tooltip"); const rect = canvas.getBoundingClientRect();
      return { x: rect.left + parseFloat(tip.style.left), y: rect.top + parseFloat(tip.style.top), id: tip.dataset.recordId, bottom: rect.top + Number(canvas.dataset.plotBottom) };
    });
    assert(pointer.id); assert(pointer.y > pointer.bottom, "Histogram rug should sit below count plot");
    await page.mouse.click(pointer.x, pointer.y);
    assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().selectedRecordId), pointer.id, "Scaled pointer lost record identity");
    assert.equal(await view("records").getAttribute("aria-selected"), "true");
    await view("chart").click(); await ready(); await canvas.focus(); await page.keyboard.press("End"); await page.keyboard.press("Enter");
    assert.equal(await view("records").getAttribute("aria-selected"), "true");

    // Optional AI is decorated, still user initiated, and does not require a key to close.
    await page.locator("#gaia-statistics-ai-open").click();
    const ai = page.locator("#gaia-statistics-ai-dialog");
    await ai.locator(".gaia-statistics-ai-companions").evaluate(img => img.decode());
    assert.equal(await ai.locator('[name="apiKey"]').inputValue(), "");
    assert.equal(await ai.locator("[data-ai-prompt]").count(), 6);
    assert((await ai.evaluate(node => node.scrollWidth - node.clientWidth)) <= 1);
    await page.screenshot({ path: path.join(output, `${width}-ai.png`) });
    await page.keyboard.press("Escape"); assert.equal(await ai.isVisible(), false);

    // Persist real settings, reload the page, and restore them through the drawer.
    if ([1440, 390].includes(width)) {
      await page.locator("#gaia-statistics-menu-toggle").click();
      await page.locator(".gaia-statistics-data-options > summary").click();
      await page.locator("#gaia-statistics-record-filter").fill("2007");
      await page.waitForFunction(() => GaiaStatisticsLab.getState().recordQuery === "2007"); await ready();
      await page.locator("#gaia-statistics-view-save").click();
      assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().savedViewCount), 1);
      await load(true);
      await page.evaluate(() => GaiaMapCategories.buttons().find(button => Number(button.textContent) === 11).click());
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
      await analyzeFromMap(); await ready();
      assert.equal(await view("chart").getAttribute("aria-selected"), "true");
      await page.locator("#gaia-statistics-menu-toggle").click();
      await page.locator(".gaia-statistics-data-options > summary").click();
      await page.locator("#gaia-statistics-saved-view").selectOption({ index: 1 });
      await page.locator("#gaia-statistics-view-apply").click(); await ready();
      assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().recordQuery), "2007");
      assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().methodId), "summary");
      await page.locator("#gaia-statistics-view-delete").click();
      assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().savedViewCount), 0);
      await page.locator("#gaia-statistics-menu-close").click();
    }
    await page.locator("#gaia-statistics-close").click();
    await page.locator("#gaia-statistics-lab").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#gaia-statistics-lab").isVisible(), false);
    report.checks.push({ width, height, geometry, plot, reading, defaultGraph: true, reopenGraph: true, companionsToFindings: true, sourceValuesUnchanged: true, scaledPointerAndKeyboard: true, savedReload: [1440, 390].includes(width) });
    console.log(`PASS ${width}x${height}: graph-first, responsive artwork, findings, source values, pointer/keyboard, menu, AI, ${[1440, 390].includes(width) ? "saved settings reload" : "close/reopen"}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
