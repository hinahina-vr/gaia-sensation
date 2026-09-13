import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/realtime-exhibits");
fs.mkdirSync(output, { recursive: true });
const beforeStateLayout = process.argv.includes("--before-state-layout");
const baselineCss = process.argv.includes("--baseline-css");
const compactHeight = process.argv.includes("--compact-height");
const beforeReportPath = path.resolve(output, "../before/report.json");
const beforeReport = compactHeight && fs.existsSync(beforeReportPath) ? JSON.parse(fs.readFileSync(beforeReportPath, "utf8")) : null;
const currentCss = fs.readFileSync("realtime-exhibits.css", "utf8");
const testedCss = baselineCss ? execFileSync("git", ["show", "HEAD:realtime-exhibits.css"], { encoding: "utf8" })
  : beforeStateLayout ? currentCss.replace('"title title" "state time"', '"title state" "title time"')
  .replace('grid-area: title; justify-content: flex-start;', 'grid-area: title;') : currentCss;
const profiles = process.env.REALTIME_SIZES ? process.env.REALTIME_SIZES.split(",").map(size => size.split("x").map(Number))
  : [[1440, 900], [1920, 1080], [2560, 1392], [3840, 2088], [1024, 768], [390, 844], [320, 568], [844, 390]];
const report = { profiles: [], errors: [], beforeStateLayout, baselineCss, compactHeight,
  environment: "Local Chrome with saved/synthetic provider fixtures; not production or physical-device testing",
  baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sha256: Object.fromEntries(["realtime-exhibits.css", "gaia-mode-loader.js", "index.html"].map(file => [file,
    createHash("sha256").update(file === "realtime-exhibits.css" ? testedCss : fs.readFileSync(file)).digest("hex")])),
};
function assertStateLayout(layout, width) {
  if (width <= 900) return; // The compact mobile HUD deliberately omits the repeated title.
  if (beforeStateLayout && width >= 1800) {
    assert(layout.stateRect.left > layout.titleRect.left + 20 && layout.stateRect.top < layout.titleRect.bottom,
      "Reproduce the old state beside the title");
  } else {
    assert(Math.abs(layout.stateRect.left - layout.titleRect.left) <= 1 && layout.stateRect.top >= layout.titleRect.bottom - 1,
      `State and observation kind must be directly below the title: ${JSON.stringify(layout)}`);
  }
}
const now = Date.parse("2026-09-07T03:00:00Z");
const freshFirms = JSON.parse(fs.readFileSync("data/firms-active-fire-snapshot.json", "utf8"));
freshFirms.source = "nasa-firms-modis";
freshFirms.generatedAt = new Date(now).toISOString();
freshFirms.summary.end = new Date(now - 2 * 3600_000).toISOString();
freshFirms.summary.start = new Date(now - 24 * 3600_000).toISOString();
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let lastPage;
try {
  for (const [width, height] of profiles) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 900, reducedMotion: "reduce" });
    if (beforeStateLayout || baselineCss) await context.route(`${base}/realtime-exhibits.css*`, route => route.fulfill({ body: testedCss, contentType: "text/css" }));
    // Only the fixtures below may answer external requests in this layout test.
    await context.route("https://**", route => route.abort());
    let apiMode = "live";
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("**/api/live/v1/firms", route => apiMode === "offline" ? route.abort() : route.fulfill({ json: freshFirms }));
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ contentType: "application/json", body: fs.readFileSync("data/ovation-aurora-snapshot.json", "utf8") }));
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ json: {
      metadata: { generated: now }, features: [{ id: "qa-quake", geometry: { coordinates: [138, 36, 10] }, properties: { time: now - 3600_000, mag: 4.5, place: "検証用の公開地震観測" } }],
    } }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) await context.route(`https://${host}/**`, route => {
      if (apiMode === "offline") return route.abort();
      const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
      return route.fulfill({ json: Array.from({ length: count }, (_, i) => ({ current: { time: apiMode === "delayed" ? "2026-09-01T02:00" : "2026-09-07T02:00", wind_speed_10m: 4 + i / 20, wind_direction_10m: 100,
        surface_pressure: 1008, cloud_cover: 62, shortwave_radiation: 182, pm2_5: 10, aerosol_optical_depth: .2 } })) });
    });
    const page = await context.newPage();
    lastPage = page;
    page.on("pageerror", error => report.errors.push({ width, message: error.message }));
    await page.clock.install({ time: new Date(now) });
    await page.goto(`${base}/?preview=realtime-exhibits&live=1#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaMapCategories?.buttons().length >= 30 && document.documentElement.dataset.gaiaAppReady === "true", null, { timeout: 60000 });
    await page.evaluate(() => GaiaMapDemo.stop());
    const profile = { width, height, exhibits: [] };
    report.profiles.push(profile);
    for (let number = 1; number <= 5; number++) {
      await page.evaluate(number => GaiaMapCategories.buttons().find(item => Number(item.textContent) === number).click(), number);
      const readout = page.locator(number === 1 ? ".gaia-firms-readout" : ".gaia-planet-signals-readout");
      await readout.locator('[data-realtime-state="live"]').waitFor();
      await page.waitForTimeout(450);
      const layout = await readout.evaluate(node => {
        const r = node.getBoundingClientRect();
        const status = node.querySelector(".gaia-realtime-status"), s = status.getBoundingClientRect();
        const title = status.querySelector("h3"), t = title.getBoundingClientRect();
        const titleRange = document.createRange(); titleRange.selectNodeContents(title);
        const text = titleRange.getBoundingClientRect();
        const visible = element => { const style = getComputedStyle(element), b = element.getBoundingClientRect(); return style.display !== "none" && style.visibility !== "hidden" && b.width > 0 && b.height > 0; };
        const fields = [...status.children].filter(visible).map(element => ({ text: element.textContent, rect: element.getBoundingClientRect().toJSON() }));
        const actions = [...node.querySelectorAll(".gaia-map-action")].filter(visible).map(button => {
          const b = button.getBoundingClientRect(), hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return button === hit || button.contains(hit);
        });
        return { dock: r.toJSON(), status: s.toJSON(), titleRect: t.toJSON(), stateRect: status.querySelector(".gaia-realtime-state").getBoundingClientRect().toJSON(), titleSize: parseFloat(getComputedStyle(title).fontSize), fields,
          titleFits: text.left >= s.left && text.right <= s.right + 1 && text.bottom <= s.bottom + 1,
          fits: node.scrollWidth <= node.clientWidth + 2 && node.scrollHeight <= node.clientHeight + 2,
          inViewport: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
          fieldsFit: fields.every(({ rect: b }) => b.left >= r.left && b.right <= r.right + 1 && b.top >= r.top && b.bottom <= r.bottom + 1),
          readable: status.textContent, actionsReachable: actions.every(Boolean), state: status.dataset.realtimeState,
        };
      });
      profile.exhibits.push({ number, ...layout });
      await page.screenshot({ path: path.join(output, `${width}x${height}-${number}.png`) });
      await readout.screenshot({ path: path.join(output, `${width}x${height}-${number}-dock.png`) });
      assert(layout.fits && layout.inViewport && layout.fieldsFit && layout.titleFits && layout.actionsReachable, JSON.stringify({ number, ...layout }));
      if (compactHeight) {
        const before = beforeReport?.profiles.find(p => p.width === width && p.height === height)?.exhibits.find(e => e.number === number);
        if (before && !baselineCss) {
          assert(layout.dock.height <= before.dock.height - (width > 900 ? 15 : 8), `${width}/${number}: unused dock height was not removed`);
          assert.equal(layout.titleSize, before.titleSize, "Keep the existing font size");
          profile.exhibits.at(-1).previousHeight = before.dock.height;
        }
        if (width > 900 && !baselineCss) assert(layout.dock.height <= (width <= 1250 && [1, 4].includes(number) ? 126 : 124) + 1);
        const clippedText = await readout.evaluate(node => {
          const box = node.getBoundingClientRect(), walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), failures = [];
          while (walker.nextNode()) {
            const text = walker.currentNode, element = text.parentElement;
            if (!text.textContent.trim() || !element.checkVisibility({ visibilityProperty: true })) continue;
            const range = document.createRange(); range.selectNodeContents(text);
            for (const r of range.getClientRects()) if (r.height > 0 && (r.top < box.top - 1 || r.bottom > box.bottom + 1)) failures.push(text.textContent.trim());
          }
          return failures;
        });
        assert.deepEqual(clippedText, [], `${width}/${number}: visible text is vertically clipped`);
      }
      assertStateLayout(layout, width);
      if (!beforeStateLayout && width > 900) {
        for (let a = 0; a < layout.fields.length; a++) for (let b = a + 1; b < layout.fields.length; b++) {
          const left = layout.fields[a].rect, right = layout.fields[b].rect;
          assert(left.right <= right.left + 1 || right.right <= left.left + 1 || left.bottom <= right.top + 1 || right.bottom <= left.top + 1,
            "Title, connection state and time must not overlap");
        }
      }
      if (width <= 900) {
        // The compact mobile HUD replaced the repeated title with its badge.
        assert.equal(await readout.locator('.gaia-realtime-status h3 > span:first-child').isVisible(), false);
        assert(await readout.locator('.gaia-broadcast-badge').isVisible());
        assert(await readout.locator('.gaia-realtime-state b').evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 11));
        assert(await readout.locator('.gaia-realtime-time').evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 10));
      } else assert(layout.titleSize >= 22);
      assert.match(layout.readable, /リアルタイム展示/u);
      assert.match(layout.readable, /2026年9月7日/u);
      assert.match(layout.readable, /日本時間/u);
      assert.equal(await readout.locator('.gaia-broadcast-badge[data-broadcast-state="live"]').count(), 1);
      assert.equal(await readout.locator('.gaia-broadcast-badge').evaluate(badge => getComputedStyle(badge).backgroundColor), 'rgba(190, 28, 42, 0.8)', 'Live badge is red');
      assert.equal(await page.locator('.japan-heading > .gaia-broadcast-badge').count(), 0);
      if (number === 5) assert.match(layout.readable, /気象モデル/u);
      if (width > 900) {
        const legend = page.locator(number === 1 ? ".gaia-firms-legend" : ".gaia-planet-signals-legend");
        assert.equal(await legend.locator("details").evaluate(node => node.open), false);
        await legend.locator("summary").click();
        assert.equal(await legend.locator("details").evaluate(node => node.open), true);
        assert(await legend.locator(number === 1 ? "[data-firms-latest]" : "[data-metric-current]").isVisible());
        await legend.locator("summary").click();
      }
      if (compactHeight) {
        const tool = async name => {
          await page.locator('[data-mobile-sheet="tools"]').click();
          await page.getByRole("button", { name, exact: true }).last().click();
        };
        if (width > 900) {
          assert(await readout.locator(".gaia-map-action--analysis").isDisabled());
          await readout.locator(".gaia-map-action--source").click();
        } else await tool("データの出典");
        await page.locator("#japan-data-panel").waitFor({ state: "visible" });
        await page.locator("#japan-data-close").click();
        assert.equal(await page.locator(".experience").evaluate(n => n.scrollLeft), 0, "Returning from source must not horizontally scroll the whole map");
        if (number === 1) {
          const play = readout.locator("[data-firms-play]");
          await play.click(); assert.equal(await play.getAttribute("aria-pressed"), "false");
          const slider = readout.locator("[data-firms-progress]");
          await slider.focus(); await page.keyboard.press("Home");
          assert.equal(await slider.inputValue(), "0");
          await page.keyboard.press("ArrowRight"); assert.equal(await slider.inputValue(), "1");
          await play.click();
          await page.waitForFunction(() => document.querySelector("[data-firms-play]").getAttribute("aria-pressed") === "true");
        }
        if (number === 4) {
          if (width > 900) await readout.locator("[data-planet-epicenter]").click();
          else await tool("最大の震源へ");
          await page.waitForFunction(() => document.querySelector("#gaia-planet-signals-canvas").dataset.planetFocusedEpicenter === "qa-quake");
        }
        await page.locator(width > 900 ? (number === 1 ? '[data-firms-step="1"]' : '[data-planet-step="1"]') : '[data-mobile-exhibit-step="1"]').click();
        await page.waitForFunction(next => GaiaMapCategories.buttons().some(b => Number(b.textContent) === next && b.getAttribute("aria-current") === "true"), number + 1);
        profile.exhibits.at(-1).compactControls = "source and return, next exhibit, playback/keyboard timeline (01), epicenter (04) passed";
      }
    }
    await page.evaluate(() => GaiaMapCategories.buttons().find(item => Number(item.textContent) === 6).click());
    await page.waitForTimeout(300);
    assert.equal(await page.locator(".gaia-realtime-status:visible").count(), 0, "Historical exhibits must not be labelled realtime");
    if ([1440, 1920, 2560, 3840, 390, 320].includes(width)) {
      apiMode = "offline";
      const fallback = await context.newPage();
      fallback.on("pageerror", error => report.errors.push({ width, message: error.message }));
      await fallback.clock.install({ time: new Date(now) });
      await fallback.goto(`${base}/?preview=realtime-fallback&live=1#world`, { waitUntil: "domcontentloaded" });
      await fallback.waitForFunction(() => globalThis.GaiaMapDemo && document.documentElement.dataset.gaiaAppReady === "true");
      await fallback.evaluate(() => GaiaMapDemo.stop());
      const assertFallback = async (kind, selector) => {
        const panel = fallback.locator(selector);
        await panel.locator(`[data-realtime-state="${kind}"]`).waitFor();
        const state = await panel.evaluate(node => {
          const status = node.querySelector(".gaia-realtime-status"), r = node.getBoundingClientRect();
          return { fits: node.scrollHeight <= node.clientHeight + 2 && node.scrollWidth <= node.clientWidth + 2,
            titleRect: status.querySelector("h3").getBoundingClientRect().toJSON(), stateRect: status.querySelector(".gaia-realtime-state").getBoundingClientRect().toJSON(),
            text: status.textContent, visible: status.getBoundingClientRect().top >= r.top && status.getBoundingClientRect().bottom <= r.bottom + 1 };
        });
        assert(state.fits && state.visible, JSON.stringify(state));
        assertStateLayout(state, width);
        assert.doesNotMatch(state.text, /ライブ ·/u);
        await fallback.screenshot({ path: path.join(output, `${width}x${height}-${kind}.png`) });
        await panel.screenshot({ path: path.join(output, `${width}x${height}-${kind}-dock.png`) });
        (profile.fallbackLayouts ||= []).push({ kind, ...state });
        return state.text;
      };
      assert.match(await assertFallback("saved", ".gaia-firms-readout"), /保存観測.*ライブ未接続/u);
      await fallback.evaluate(() => { void GaiaPlanetSignals.select(0); });
      assert.match(await assertFallback("sample", ".gaia-planet-signals-readout"), /現在値ではありません/u);
      apiMode = "delayed";
      await fallback.evaluate(() => { void GaiaPlanetSignals.select(1); });
      assert.match(await assertFallback("delayed", ".gaia-planet-signals-readout"), /時刻に遅れ/u);
      profile.fallbackStates = ["saved", "sample", "delayed"];
    }
    await context.close();
    console.log(`${width}x${height}: MAP 01–05 identity, timestamp, compact legends and MAP 06 exclusion passed`);
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  if (lastPage && !lastPage.isClosed()) await lastPage.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
