import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import "../novel-story-data.js";

const base = process.argv[2] || "http://127.0.0.1:4397";
const baseline = process.argv.includes("--baseline");
const actionsOnly = process.argv.includes('--actions-only');
const preActionStyle = process.argv.includes('--pre-action-style');
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || "artifacts/story-map-dock");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", actionsOnly, preActionStyle, checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const [width, height, warm = false] of (baseline ? [[2176, 1072]] : process.argv.includes('--focused') ? [[2176, 1072], [901, 768]] : [[2176, 1072], [1440, 900], [1024, 768], [901, 768], [390, 844], [320, 568], [1440, 900, true]])) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "no-preference" });
    // Diagnostic comparison: the action block was appended to this stylesheet.
    // Serve its unchanged prefix only, without editing any application file.
    if(preActionStyle) await context.route('**/map-unified-dock.css?*', route=>route.fulfill({contentType:'text/css',body:fs.readFileSync('map-unified-dock.css','utf8').split('/* Every desktop exhibit uses 06')[0]}));
    await context.addInitScript(storyVersion => {
      const progress = { storyVersion, stepId: "map_mode01_004", reachedSceneIds: [], viewed: {}, evesRoute: [], observationOrder: null, editorialChoice: null, reflectionIds: [], resultTone: null, demoInterest: "気候の長期変化", metCharacters: { mizuha: true, amane: true, sakuya: true }, audio: { muted: true, volume: 0.37 }, readStepIds: [], clear: false, archivesUnlocked: false, sessionId: "story-map-dock-test" };
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(progress));
      localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{ progress, savedAt: Date.now(), meta: { title: "MAP layout QA", excerpt: progress.stepId } }]));
      localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: false }));
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
    }, GAIA_NOVEL_STORY.storyVersion);
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=story-map-dock#${warm ? "world" : "story"}`, { waitUntil: "domcontentloaded" });
    if (warm) {
      await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && globalThis.GaiaStatisticsLab);
      await page.evaluate(async () => { await GaiaModeLoader.load("story"); await GaiaNovel.open(); });
    }
    await page.waitForFunction(() => globalThis.GaiaNovel);
    await page.waitForFunction(() => document.body.classList.contains("novel-mode-detour") && document.querySelector("#japan-layer")?.getBoundingClientRect().width > 0 && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(() => GaiaMapObservationAdapter.waitSignalsReady());
    await page.waitForFunction(() => document.querySelector("#japan-overlay").dataset.quantitativeLegendId === "co2-concentration"
      && document.querySelector("#japan-overlay").dataset.plotRevealState === "complete");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const scan = await page.evaluate(() => {
      const layer = document.querySelector("#japan-layer");
      const measure = selector => {
        const element = layer.querySelector(selector), box = element?.getBoundingClientRect(), style = element && getComputedStyle(element);
        return element ? { selector, text: element.textContent.trim().slice(0, 180), box: box.toJSON(), display: style.display, position: style.position,
          overflow: element.scrollWidth - element.clientWidth, grid: style.gridTemplateColumns, visible: style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0,
          hit: document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.outerHTML.slice(0, 150) } : null;
      };
      return { width: innerWidth, body: document.body.className, layer: layer.getBoundingClientRect().toJSON(), phase: layer.dataset.storyPhase,
        metric: { left: Number(layer.querySelector("#japan-overlay").dataset.auxiliaryPanelScreenLeft), top: Number(layer.querySelector("#japan-overlay").dataset.auxiliaryPanelScreenTop),
          right: Number(layer.querySelector("#japan-overlay").dataset.auxiliaryPanelScreenRight), bottom: Number(layer.querySelector("#japan-overlay").dataset.auxiliaryPanelScreenBottom) },
        skipText: layer.querySelector("#story-map-modal-skip").textContent.replace(/\s+/gu, ""),
        skipHit: (() => { const b = layer.querySelector("#story-map-modal-skip"), r = b.getBoundingClientRect(); return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })(),
        guide: measure('[data-gaia-mode-guide-replay="map"]'),
        scale: [...layer.querySelectorAll(".map-dock-timeline-scale span")].map(node => Number(node.textContent.replace(/年$/u, ""))),
        controls: [".map-command-dock", ".signal-console-map", ".signal-console-heading", ".signal-console-map > label", ".map-dock-year", ".map-dock-year b", "[data-signal-time]", ".map-dock-action--source", ".map-dock-action--statistics", "#story-map-modal-skip", ".japan-map-actions", ".signal-encoding-legend-dock"].map(measure) };
    });
    report.checks.push({ ...scan, warm });
    await page.screenshot({ path: path.join(output, `${baseline ? "before" : "after"}-${width}${warm ? "-warm" : ""}.png`) });
    if (baseline) console.log(JSON.stringify(scan));
    if (actionsOnly) {
      for (const selector of ['.map-dock-action--source', '.map-dock-action--statistics']) {
        const item=scan.controls.find(item=>item.selector===selector);
        assert.equal(item.box.width,144);assert.equal(item.box.height,66);
        assert.equal(item.overflow,0);assert(item.visible && item.hit);
        assert(item.box.left>=scan.layer.left && item.box.right<=scan.layer.right && item.box.bottom<=scan.layer.bottom);
        assert(await page.locator(selector+' strong').evaluate(node=>node.scrollWidth<=node.clientWidth+1));
        await page.locator(selector).click();
        if(selector.endsWith('--source')) {
          await page.locator('#japan-data-panel[aria-hidden="false"]').waitFor();
          await page.locator('#japan-data-close').click();
        } else {
          await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);
          await page.locator('#gaia-statistics-close').click();
        }
        assert(await page.evaluate(()=>document.body.classList.contains('novel-mode-detour')));
      }
      await page.locator('#story-map-modal-skip').click();
      await page.waitForFunction(()=>GaiaNovel.getState().stepId==='map_mode01_005' && !document.body.classList.contains('novel-mode-detour'));
      await context.close();console.log(`PASS ${width}: story action geometry, source/analysis and return`);continue;
    }
    if (!baseline) {
      const skip = scan.controls.find(item => item.selector === "#story-map-modal-skip").box;
      assert.equal(scan.skipText, "スキップ▶"); assert(scan.skipHit, "Skip must be pointer-accessible");
      assert(skip.left > scan.layer.left + scan.layer.width / 2 && scan.layer.right - skip.right < 24 && skip.top - scan.layer.top < 24, `${width}: skip is not at the upper right`);
      assert(scan.metric.left - scan.layer.left < 30, `${width}: quantitative panel is not on the left`);
      if (width > 900) {
        const legend = scan.controls.find(item => item.selector === ".signal-encoding-legend-dock").box;
        assert(legend.left - scan.layer.left < 24 && legend.top - scan.layer.top < 24, `${width}: legend is not upper left`);
        assert(Math.abs(scan.metric.left - legend.left) < 2 && Math.abs(scan.metric.right - legend.right) < 2, `${width}: observation column is not aligned`);
        assert(scan.metric.top >= legend.bottom + 6 && scan.metric.bottom < scan.controls.find(item => item.selector === ".map-command-dock").box.top);
        assert(scan.guide.box.left >= legend.left && scan.guide.box.right <= legend.right && scan.guide.box.bottom <= legend.bottom, "Guide must move with legend");
        assert(legend.right < skip.left, "Legend overlaps skip");
      }
      assert.equal(scan.scale[0], 1958); assert.equal(scan.scale.at(-1), 2050);
      assert(scan.scale.every((value, index) => !index || value > scan.scale[index - 1]), "Year scale must not include playback speed");
      for (const control of scan.controls.filter(item => item?.visible && [".signal-console-map", ".signal-console-map > label", ".map-dock-year", ".map-dock-year b", "[data-signal-time]", ".map-dock-action--source", ".map-dock-action--statistics"].includes(item.selector))) {
        assert(control.box.left >= scan.layer.left - 1 && control.box.right <= scan.layer.right + 1, `${width}: ${control.selector} outside map horizontally`);
        assert(control.box.top >= scan.layer.top - 1 && control.box.bottom <= scan.layer.bottom + 1, `${width}: ${control.selector} outside map vertically`);
        assert(control.overflow <= 1, `${width}: ${control.selector} overflows internally`);
      }
      const timeline = page.locator("#japan-layer [data-signal-time]").first();
      const box = await timeline.boundingBox();
      assert(box && box.width >= 80 && box.height >= 16, `${width}: usable timeline`);
      const before = await timeline.inputValue();
      await timeline.focus(); await timeline.press("ArrowRight");
      assert.notEqual(await timeline.inputValue(), before, "Keyboard changes the year");
      await page.mouse.click(box.x + box.width * .75, box.y + box.height / 2);
      assert.notEqual(await timeline.inputValue(), before, "Pointer reaches the timeline");
      if (width === 1440 || width === 390) {
        await page.locator(".map-dock-action--source").click();
        await page.locator("#japan-data-panel").waitFor({ state: "visible" });
        await page.locator("#japan-data-close").click();
        await page.locator(".map-dock-action--statistics").click();
        await page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady);
        await page.locator("#gaia-statistics-close").click();
        assert.equal(await page.evaluate(() => document.body.classList.contains("novel-mode-detour")), true);
      }
      if (width < 901) {
        const toggle = await page.locator("#map-mobile-legend-toggle").boundingBox();
        assert(toggle.x < scan.layer.left + 30 && toggle.x + toggle.width < skip.left, "Mobile legend control overlaps skip");
        await page.locator("#map-mobile-legend-toggle").click();
        await page.locator("#map-signal-encoding-legend-dock").waitFor({ state: "visible" });
        const legend = await page.locator("#map-signal-encoding-legend-dock").boundingBox();
        assert(legend.y + legend.height < scan.controls.find(item => item.selector === ".map-command-dock").box.top);
        await page.locator("#map-mobile-legend-toggle").click();
      }
      await page.locator("#story-map-modal-skip").click();
      await page.waitForFunction(() => GaiaNovel.getState().stepId === "map_mode01_005" && !document.body.classList.contains("novel-mode-detour"));
      console.log(`PASS ${width}${warm ? " warm" : ""}: left observation column, upper-right skip, bounded dock, pointer/keyboard, actions, story return`);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = error.stack; if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") }); throw error; }
finally { fs.writeFileSync(path.join(output, `${baseline ? "baseline" : "report"}.json`), JSON.stringify(report, null, 2)); await browser.close(); }
