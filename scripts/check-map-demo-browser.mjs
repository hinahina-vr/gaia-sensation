import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/map-demo");
const widths = (process.env.DEMO_WIDTHS || "320,768,3840,1440,390").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", profiles: [], errors: [] };
const ovation = fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8");
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width >= 2400 ? 2088 : 900 }, hasTouch: width < 720, reducedMotion: width === 320 ? "reduce" : "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ contentType: "application/json", body: ovation }));
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ json: { type: "FeatureCollection", features: [] } }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) {
      await context.route(`https://${host}/**`, route => {
        const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
        const rows = Array.from({ length: count }, () => ({ current: {
          time: "2026-09-06T00:00", wind_speed_10m: 5, wind_direction_10m: 80,
          surface_pressure: 1005, cloud_cover: 58, shortwave_radiation: 194,
          temperature_2m: 23, precipitation: 0, pm2_5: 9.9, aerosol_optical_depth: .18,
        } }));
        return route.fulfill({ json: count === 1 ? rows[0] : rows });
      });
    }
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    // Install before navigation: production still runs its normal 25s timer.
    await page.clock.install();
    await page.goto(`${base}/?preview=map-demo#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaMapDemo && GaiaMapCategories.buttons().length === 30);
    await page.evaluate(() => GaiaModeEntryGuide.close("map", { restoreFocus: false }));
    await page.waitForTimeout(1200);
    const mobile = width <= 900;
    const toggle = page.locator("#gaia-map-demo-toggle");
    const profile = { width, visited: [], layout: [], lifecycle: [] };
    report.profiles.push(profile);
    const snapshot = () => page.evaluate(() => ({
      demo: GaiaMapDemo.getState(),
      number: document.querySelector("#japan-mode-number").textContent.trim(),
      selected: GaiaMapCategories.buttons().filter(item => item.getAttribute("aria-current") === "true").map(item => item.textContent.trim()),
      muted: localStorage.getItem("gaia-senseware-bgm-muted"),
      title: document.querySelector("#japan-title").textContent,
      dockTitle: document.querySelector("#japan-mode-title").textContent,
    }));
    const layout = async state => {
      const result = await page.evaluate(mobile => {
        const b = document.querySelector(mobile ? '[data-mobile-sheet="tools"]' : "#gaia-map-demo-toggle");
        const rect = b.getBoundingClientRect();
        const peers = ["#japan-close", "#gaia-statistics-button-mobile", '[data-gaia-mode-guide-replay="map"]', ".gaia-audio-dock"].map(selector => {
          const node = document.querySelector(selector);
          const r = node?.getBoundingClientRect();
          return { selector, x: r?.x, y: r?.y, width: r?.width, height: r?.height, overlap: !!r && r.width > 0 && r.height > 0 && rect.left < r.right && rect.right > r.left && rect.top < r.bottom && rect.bottom > r.top };
        });
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        const text = b.querySelector("[data-demo-label]") || b;
        const range = document.createRange(); range.selectNodeContents(text);
        return { width: rect.width, height: rect.height, x: rect.x, y: rect.y, right: rect.right, inViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
          reachable: b === hit || b.contains(hit), hit: hit?.outerHTML.slice(0, 250), peers, labelLines: range.getClientRects().length, overflow: b.scrollWidth > b.clientWidth + 1, outline: getComputedStyle(b).outlineStyle };
      }, mobile);
      profile.layout.push({ state, ...result });
      await page.screenshot({ path: path.join(output, `${width}-${state}.jpg`), type: "jpeg", quality: 86 });
      assert(result.width >= 44 && result.height >= 44 && result.inViewport && result.reachable && !result.overflow, `${width} ${state}: control layout ${JSON.stringify(result)}`);
      assert(result.peers.every(peer => !peer.overlap), `${width}: overlapping header control ${JSON.stringify(result.peers)}`);
      assert.equal(result.labelLines, 1);
    };
    const start = async () => {
      if (mobile) {
        if (!(await page.locator("#map-mobile-sheet").evaluate(node => node.open))) await page.locator('[data-mobile-sheet="tools"]').click();
        await page.getByRole("button", { name: "全展示のデモ再生", exact: true }).click();
      } else await toggle.click();
      assert.equal(await toggle.getAttribute("aria-pressed"), "true");
    };
    const select = async number => {
      await page.evaluate(number => GaiaMapCategories.buttons().find(item => Number(item.textContent.trim()) === number).click(), number);
      await page.waitForFunction(number => Number(document.querySelector("#japan-mode-number").textContent) === number, number);
      await page.clock.runFor(800);
    };
    assert.equal((await snapshot()).demo.active, true);
    await page.evaluate(() => GaiaMapDemo.stop());
    await layout("idle");
    await select(1);
    await start();
    await layout("running");
    await page.screenshot({ path: path.join(output, `${width}-demo.jpg`), type: "jpeg", quality: 86 });
    // Mouse movement alone does not stop a passive display.
    await page.mouse.move(width / 2, 280);
    assert.equal((await snapshot()).demo.active, true);
    const count = [1440, 390].includes(width) ? 30 : 1;
    for (let step = 1; step <= count; step++) {
      const remaining = (await snapshot()).demo.remainingMs;
      await page.clock.fastForward(remaining + 1);
      await page.clock.runFor(800);
      const result = await snapshot();
      const expected = String(step % 30 + 1).padStart(2, "0");
      assert.equal(result.number, expected, `${width}: automatic step ${step}`);
      assert.deepEqual(result.selected, [expected]);
      assert.equal(result.title, result.dockTitle);
      assert.equal(result.demo.active, true, "Synthetic navigation stopped the demo");
      assert.equal(result.muted, "true");
      profile.visited.push(expected);
      if (step % 10 === 0) console.log(`${width}: automatic step ${step}/30 passed`);
    }
    await page.screenshot({ path: path.join(output, `${width}-after-loop.jpg`), type: "jpeg", quality: 86 });
    // Stop button, keyboard escape, ordinary input, leave and re-entry.
    if (mobile) await page.locator('[data-mobile-sheet="tools"]').click();
    else await toggle.click();
    assert.equal((await snapshot()).demo.active, false);
    profile.lifecycle.push("stop-button");
    await start();
    await page.keyboard.press("Escape");
    assert.equal((await snapshot()).demo.active, false);
    assert.equal(await page.locator("#japan-layer").getAttribute("aria-hidden"), "false");
    profile.lifecycle.push("escape-keeps-map-open");
    if (mobile) {
      await page.locator('[data-mobile-sheet="tools"]').click();
      await page.getByRole("button", { name: "全展示のデモ再生", exact: true }).focus();
    } else await toggle.focus();
    await page.keyboard.press("Enter");
    assert.equal((await snapshot()).demo.active, true);
    await layout("keyboard");
    await page.keyboard.press("Tab");
    assert.equal((await snapshot()).demo.active, false);
    profile.lifecycle.push("keyboard-start-and-yield");
    await start();
    await page.mouse.wheel(0, 1);
    await page.waitForFunction(() => !GaiaMapDemo.getState().active);
    profile.lifecycle.push("wheel-stop");
    await start();
    if (width < 720) await page.touchscreen.tap(width / 2, 300); else await page.mouse.click(width / 2, 300);
    assert.equal((await snapshot()).demo.active, false);
    profile.lifecycle.push("pointer-stop");
    const stopped = (await snapshot()).number;
    await page.clock.fastForward(75_000);
    assert.equal((await snapshot()).number, stopped, "Stopped demo retained a timer");
    await start();
    // Emulate visibility, while the unit test verifies exact retained time.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const paused = await snapshot();
    await page.clock.fastForward(180_000);
    assert.equal((await snapshot()).number, paused.number);
    assert.equal((await snapshot()).demo.remainingMs, paused.demo.remainingMs);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
    assert.equal((await snapshot()).demo.paused, false);
    profile.lifecycle.push("hidden-tab-retains-time");
    // A guide pauses (but does not turn off) the running demo.
    await page.evaluate(() => sessionStorage.removeItem("gaia:mode-entry-guide:map:v5"));
    assert.equal(await page.evaluate(() => GaiaModeEntryGuide.open("map")), true);
    assert.equal((await snapshot()).demo.active, true);
    assert.equal((await snapshot()).demo.paused, true);
    await page.evaluate(() => GaiaModeEntryGuide.close("map"));
    assert.equal((await snapshot()).demo.paused, false);
    await page.clock.runFor(400);
    profile.lifecycle.push("guide-pauses-and-resumes");
    await page.locator("#japan-close").click();
    assert.equal((await snapshot()).demo.active, false);
    await page.clock.runFor(1000);
    await page.evaluate(() => { sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); location.hash = "#world"; });
    await page.waitForFunction(() => document.querySelector("#japan-layer").getAttribute("aria-hidden") === "false");
    assert.equal((await snapshot()).demo.active, true);
    assert.equal(await page.locator("#gaia-map-demo-toggle").count(), 1);
    profile.lifecycle.push("leave-and-reenter-default-on");
    assert.equal((await snapshot()).muted, "true");
    await context.close();
    console.log(JSON.stringify({ width, visited: profile.visited.length, lifecycle: profile.lifecycle.length, status: "passed" }));
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
