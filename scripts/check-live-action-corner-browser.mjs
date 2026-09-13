import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/live-action-corner");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [3840, 1920, 1440, 1024, 901, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2088 : width < 901 ? 844 : 900 }, reducedMotion: "reduce", hasTouch: width < 901 });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?mode=15&preview=action-corner#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMapDemo);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop(); GaiaModeEntryGuide.close("map", { restoreFocus: false });
      GaiaMapCategories.buttons()[14].click(); GaiaLiveExhibits.pausePoiAutoplay(); GaiaLiveExhibits.selectObservationPoint("tokyo");
      await document.fonts.ready;
    });
    for (const number of [15, 16, 17, 18, 19, 20]) {
      await page.evaluate(number => { GaiaMapCategories.buttons()[number - 1].click(); GaiaLiveExhibits.pausePoiAutoplay(); }, number);
      await page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
      if (width > 900) {
        const scan = async state => {
          const result = await page.locator(".gaia-live-exhibit-readout").evaluate(dock => {
            const frame = dock.getBoundingClientRect(), radius = parseFloat(getComputedStyle(dock).borderTopRightRadius);
            const actions = [...dock.querySelectorAll(".gaia-map-action")].map(button => {
              const box = button.getBoundingClientRect(), copy = button.querySelector("strong"), style = getComputedStyle(button);
              const range = document.createRange(); range.selectNodeContents(copy);
              return { box: box.toJSON(), text: copy.textContent, clipped: range.getBoundingClientRect().width > copy.clientWidth + 1,
                radius: style.borderRadius, transform: style.transform, hit: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
            });
            const corner = actions[1].box;
            return { frame: frame.toJSON(), radius, actions, rightInset: frame.right - corner.right,
              curveClearance: radius - Math.hypot(corner.right - (frame.right - radius), corner.top - (frame.top + radius)),
              overflow: document.documentElement.scrollWidth - innerWidth };
          });
          assert.equal(result.radius, 42, "Do not change the outer dock");
          assert(result.rightInset >= 21 && result.curveClearance >= 6, `${width}/${number}/${state}: touches outer curve ${JSON.stringify(result)}`);
          assert.equal(result.overflow, 0);
          for (const button of result.actions) {
            assert.equal(button.radius, "10px"); assert.equal(button.transform, "none");
            assert(!button.clipped && button.hit && button.box.width >= 44 && button.box.height >= 44, `${width}/${number}/${state}: ${JSON.stringify(button)}`);
            assert(button.box.bottom <= result.frame.bottom);
          }
          assert(result.actions[0].box.right < result.actions[1].box.left);
          return result;
        };
        await page.mouse.move(20, 200); await page.evaluate(() => document.activeElement?.blur());
        const normal = await scan("normal");
        await page.locator(".gaia-live-deck-actions .gaia-map-action--source").hover(); await scan("hover");
        await page.locator(".gaia-live-deck-actions .gaia-map-action--source").focus(); await scan("focus");
        await page.mouse.move(20, 200); await page.evaluate(() => document.activeElement?.blur());
        if (number === 15) {
          const left = normal.actions[0].box.left - 12;
          await page.screenshot({ path: path.join(output, `${width}-buttons.png`), clip: { x: left, y: normal.frame.top - 3, width: normal.frame.right - left + 3, height: normal.frame.height + 3 } });
        }
        report.checks.push({ width, number, normal });
      } else {
        assert.equal(await page.locator(".gaia-live-deck-actions").isVisible(), false);
        await page.locator('[data-mobile-sheet="tools"]').click();
        const actions = page.locator(".map-mobile-tool-grid button");
        const boxes = await actions.evaluateAll(nodes => nodes.map(node => {
          const box = node.getBoundingClientRect();
          return { width: box.width, height: box.height, hit: node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
        }));
        assert(boxes.length >= 2 && boxes.every(box => box.width >= 44 && box.height >= 44 && box.hit));
        await page.keyboard.press("Escape");
        report.checks.push({ width, number, mobileActions: boxes });
      }
    }
    // Adjacent exhibit families retain their original action corners.
    for (const number of [1, 21, 24]) {
      await page.evaluate(number => GaiaMapCategories.buttons()[number - 1].click(), number);
      await page.waitForFunction(number => document.querySelector("#japan-mode-number").textContent.trim() === String(number).padStart(2, "0"), number);
      if (width > 900) assert.equal(await page.locator(".gaia-map-actions:visible .gaia-map-action, .map-command-dock:visible .map-dock-action").first().evaluate(node => getComputedStyle(node).borderRadius), "14px");
    }
    console.log(`PASS ${width}: six live exhibits, corner clearance, hover/focus, readable 44px+ buttons and unchanged adjacent/mobile actions`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, "failure.jpg") }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
