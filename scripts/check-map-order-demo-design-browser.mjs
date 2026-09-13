import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { chromium } from "playwright-core";
import { LIVE_EXHIBITS } from "../src/exploration/live-exhibit-catalog.js";
import { ESTAT_EXHIBITS } from "../src/exploration/estat-exhibit-catalog.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/exhibit-order-demo/design");
fs.mkdirSync(output, { recursive: true });
const content = { window: {} };
vm.runInNewContext(fs.readFileSync("app-content.js", "utf8"), content);
const routeIds = ["nasa-firms-active-fire", "global-wind-pressure", "global-aerosol-light", "usgs-earthquake-ripples", "global-cloud-radiance",
  ...Array.from(content.window.GaiaAppContent.modes, mode => mode.id), ...LIVE_EXHIBITS.map(mode => mode.id), ...ESTAT_EXHIBITS.map(mode => mode.id)];
const titles = ["燃える惑星", "大気をなぞる", "大気の散乱", "地殻の波紋", "雲を透る光",
  ...Array.from(content.window.GaiaAppContent.modes, mode => mode.titleJa), ...LIVE_EXHIBITS.map(mode => mode.shortTitle), ...ESTAT_EXHIBITS.map(mode => mode.shortTitle)];
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  const widths = (process.env.DESIGN_WIDTHS || "1440,3840,768,390,320").split(",").map(Number);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 3840, height: 2088 }, { width: 768, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 740 }].filter(viewport => widths.includes(viewport.width))) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 720, deviceScaleFactor: viewport.width < 600 ? 2 : 1,
      reducedMotion: viewport.width === 320 ? "reduce" : "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) {
      await context.route(`https://${host}/**`, route => {
        const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
        const rows = Array.from({ length: count }, () => ({ current: { time: "2026-09-06T00:00", wind_speed_10m: 5, wind_direction_10m: 90,
          surface_pressure: 1008, cloud_cover: 58, shortwave_radiation: 190, pm2_5: 9.9, aerosol_optical_depth: .18 } }));
        return route.fulfill({ json: count === 1 ? rows[0] : rows });
      });
    }
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ json: { type: "FeatureCollection", features: [] } }));
    let releaseSignals;
    const signalGate = new Promise(resolve => { releaseSignals = resolve; });
    await context.route("**/data/gaia-signals.json?*", async route => {
      await signalGate;
      await route.fulfill({ path: "data/gaia-signals.json", contentType: "application/json" });
    });
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push({ width: viewport.width, message: error.message }));
    await page.goto(`${base}/?preview=map-order-demo#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaMapCategories?.buttons().length === 30
      && document.querySelector("#japan-mode-number").textContent === "01" && document.querySelector("#japan-layer").classList.contains("is-firms-exhibit"));
    await page.evaluate(() => GaiaModeEntryGuide.close("map", { restoreFocus: false }));
    const signalsReady = page.evaluate(() => new Promise(resolve => addEventListener("gaia:signals-ready", resolve, { once: true })));
    releaseSignals();
    await signalsReady;
    assert.equal(await page.locator("#japan-mode-number").textContent(), "01", "Late base snapshot must not replace the featured heading");
    assert.deepEqual(await page.locator('.map-mode-button[aria-current="true"]').allTextContents(), ["01"]);
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    if (viewport.width === 768) {
      const titleBox = await page.locator("#japan-title").boundingBox();
      const legendBox = await page.locator(".gaia-firms-legend").boundingBox();
      assert(legendBox.y >= titleBox.y + titleBox.height + 8, "Tablet legend clears the featured title");
    }
    const route = await page.evaluate(() => GaiaMapCategories.buttons().map(button => ({
      number: button.textContent.trim(), id: button.dataset.firmsExhibit || button.dataset.planetExhibit || button.dataset.liveExhibit || button.dataset.estatExhibit
        || GaiaAppContent.modes[Number(button.dataset.mapStandardIndex)].id,
      label: button.getAttribute("aria-label"),
    })));
    assert.deepEqual(route.map(item => item.number), Array.from({ length: 30 }, (_, index) => String(index + 1).padStart(2, "0")));
    assert.deepEqual(route.map(item => item.id), routeIds);
    route.forEach((item, index) => assert(item.label.includes(titles[index]), `${item.number}: number/title mapping`));
    const firstGroup = await page.locator(".map-category-group").first().evaluate(group => [...group.querySelectorAll(".map-mode-button")].map(button => button.textContent.trim()));
    assert.deepEqual(firstGroup, ["01", "02", "03", "04", "05"]);

    const toggle = page.locator("#gaia-map-demo-toggle");
    const scan = () => toggle.evaluate(button => {
      const fill = button.querySelector("[data-demo-fill]");
      const style = getComputedStyle(button), fillStyle = getComputedStyle(fill), back = getComputedStyle(document.querySelector("#japan-close"));
      const animation = fill.getAnimations().find(animation => animation.effect.getKeyframes().some(frame => frame.clipPath));
      const box = button.getBoundingClientRect();
      return { label: button.textContent.trim(), pressed: button.getAttribute("aria-pressed"), font: style.fontFamily,
        radius: style.borderRadius, backRadius: back.borderRadius, height: box.height, backHeight: parseFloat(back.height),
        rect: box.toJSON(), fillRect: fill.getBoundingClientRect().toJSON(), fillOpacity: fillStyle.opacity,
        clip: fillStyle.clipPath, background: fillStyle.backgroundImage, ambientAnimation: fillStyle.animationName,
        duration: animation?.effect.getTiming().duration, progressTime: animation?.currentTime,
        frames: animation?.effect.getKeyframes().map(frame => frame.clipPath), state: GaiaMapDemo.getState() };
    });
    const idle = await scan();
    assert.equal(idle.label, "デモ");
    assert.equal(idle.radius, idle.backRadius); assert.equal(idle.height, idle.backHeight);
    assert.match(idle.font, /(?:Mincho|明朝|Serif)/u);
    const capture = async name => {
      const box = await toggle.boundingBox();
      await page.screenshot({ path: path.join(output, `${viewport.width}-${name}-header.png`), clip: {
        x: 0, y: 0, width: Math.min(viewport.width, box.x + box.width + 36), height: box.y + box.height + 30,
      } });
    };
    await capture("idle");
    if (viewport.width < 720) await toggle.tap(); else await toggle.click();
    await page.mouse.move(viewport.width / 2, viewport.height - 50);
    await page.waitForTimeout(650);
    const active = await scan();
    assert.equal(active.label, "デモ中"); assert.doesNotMatch(active.label, /\d/u);
    assert.equal(active.pressed, "true"); assert.equal(active.fillOpacity, "1");
    assert.match(active.background, /linear-gradient/u);
    assert(active.rect.width - active.fillRect.width <= 4.1 && active.rect.height - active.fillRect.height <= 4.1, "Countdown fills the button, not a thin bar");
    assert(Math.abs(active.duration - 25_000) < 10, "Countdown uses the actual remaining duration at start");
    assert(parseFloat(active.frames[0].split(" ")[1]) < .05);
    assert.equal(active.frames[1], "inset(0px 100% 0px 0px)");
    assert(Math.abs(active.progressTime - (25_000 - active.state.remainingMs)) < 200, "Color countdown follows the real controller deadline");
    if (viewport.width === 320) assert.equal(active.ambientAnimation, "none");
    await capture("active");
    await page.screenshot({ path: path.join(output, `${viewport.width}-first-exhibit.jpg`), type: "jpeg", quality: 90 });
    const phases = [];
    for (const progress of [.5, .9]) {
      await toggle.evaluate((button, progress) => {
        const fill = button.querySelector("[data-demo-fill]");
        const animation = fill.getAnimations().find(animation => animation.effect.getKeyframes().some(frame => frame.clipPath));
        animation.pause(); animation.currentTime = animation.effect.getTiming().duration * progress;
      }, progress);
      await page.waitForTimeout(60);
      const phase = await scan();
      assert(Math.abs(parseFloat(phase.clip.split(" ")[1]) - progress * 100) < .05);
      assert.equal(phase.label, "デモ中");
      phases.push({ progress, clip: phase.clip });
      await capture(`remaining-${Math.round((1 - progress) * 100)}`);
    }
    await toggle.click();
    await page.waitForTimeout(480);
    const stopped = await scan();
    assert.equal(stopped.label, "デモ"); assert.equal(stopped.fillOpacity, "0"); assert.equal(stopped.duration, undefined);

    // The new first exhibit and the planetary titles expose the same real picker.
    const featuredTitle = page.locator(".gaia-featured-selector-toggle:visible");
    await featuredTitle.click();
    await page.locator('.map-category-group [data-planet-exhibit="global-wind-pressure"]').click();
    await page.waitForFunction(() => document.querySelector("#japan-mode-number").textContent === "02");
    await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    assert.equal(await featuredTitle.getAttribute("aria-expanded"), "false");
    await featuredTitle.click();
    assert.equal(await featuredTitle.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await featuredTitle.getAttribute("aria-expanded"), "false");
    assert.equal(await featuredTitle.evaluate(button => document.activeElement === button), true);
    assert.equal(await page.locator("#japan-layer").getAttribute("aria-hidden"), "false");

    // Actual provider-boundary arrows, including the new 30 -> 01 wrap.
    for (const [number, selector, expected] of [[1, "[data-firms-step='-1']", "30"], [30, "[data-estat-step='1']", "01"],
      [5, "[data-planet-step='1']", "06"], [6, ".map-dock-bank-step--previous", "05"]]) {
      await page.evaluate(number => GaiaMapCategories.buttons().find(button => Number(button.textContent.trim()) === number).click(), number);
      await page.waitForFunction(number => Number(document.querySelector("#japan-mode-number").textContent) === number, number);
      await page.locator(selector).evaluate(button => button.click());
      await page.waitForFunction(expected => document.querySelector("#japan-mode-number").textContent === expected, expected);
    }
    if (viewport.width === 1440) {
      await page.evaluate(() => dispatchEvent(new CustomEvent("gaia:story-mode-open", { detail: {
        kind: "map01", index: 0, modeId: "breathing-earth", phase: "temperature-anomaly",
      } })));
      await page.waitForFunction(() => document.querySelector("#japan-mode-number").textContent === "06"
        && document.querySelector("#japan-layer").dataset.storyMode === "map01"
        && !document.querySelector("#japan-layer").matches(".is-firms-exhibit, .is-planet-signals-exhibit, .is-live-exhibit, .is-estat-exhibit"));
      assert.equal(await toggle.isVisible(), false, "Story detours retain their own exhibit and hide the demo");
    }
    report.checks.push({ viewport, route, firstGroup, idle, active, phases, stopped });
    console.log(`PASS ${viewport.width}: new route/entry, matching button frame, no digits, right-to-left full-color countdown, provider boundaries`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg", quality: 90 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
