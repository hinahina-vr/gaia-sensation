import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [base = "http://127.0.0.1:4397", output = "artifacts/mizuha-expression-alignment", mode = "check"] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
// Chin landmarks in the unchanged 887 × 1774 source portraits.
const chins = { calm: { x: 489, y: 301 }, sad: { x: 489, y: 329 }, teasing: { x: 489, y: 305 }, worried: { x: 475, y: 308 } };
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of mode === "record" ? [3840] : [3840, 1920, 1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2160 : width > 900 ? 1080 : 844 }, reducedMotion: width === 1440 ? "no-preference" : "reduce" });
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/#character`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-character-select="mizuha"]').click();
    await page.waitForFunction(() => document.querySelector("#character-book-layer").dataset.characterId === "mizuha"
      && document.querySelectorAll('[data-character-expression][data-character-id="mizuha"]').length === 4
      && [...document.querySelectorAll(".character-book-expression-list img")].every(img => img.complete && img.naturalHeight));
    await page.locator("#character-book-expression-list").scrollIntoViewIfNeeded();
    const inspect = () => page.locator(".character-book-expression-list img").evaluateAll((nodes, chins) => nodes.map(img => {
      const id = img.closest("button").dataset.characterExpression;
      const image = img.getBoundingClientRect(), circle = img.parentElement.getBoundingClientRect(), button = img.closest("button").getBoundingClientRect();
      const scale = image.height / img.naturalHeight, chin = chins[id];
      return { id, image: image.toJSON(), circle: circle.toJSON(),
        chinX: image.x + chin.x * scale - button.x, chinY: image.y + chin.y * scale,
        hit: img.closest("button").contains(document.elementFromPoint(circle.x + circle.width / 2, circle.y + circle.height / 2)),
      };
    }), chins);
    let baseline;
    for (const id of Object.keys(chins)) {
      const button = page.locator(`[data-character-expression="${id}"]`);
      await button.click();
      await page.mouse.move(0, 0);
      await page.waitForFunction(id => document.querySelector("#character-book-layer").dataset.expressionId === id, id);
      await page.waitForTimeout(width === 1440 ? 380 : 40);
      const scan = await inspect();
      baseline ||= scan;
      if (mode !== "record") {
        const reference = scan.at(-1);
        for (const [index, face] of scan.entries()) {
          assert(Math.abs(face.chinY - reference.chinY) < .25, `${width}/${id}: chin height differs: ${JSON.stringify(scan)}`);
          assert(Math.abs(face.chinX - reference.chinX) < .25, `${width}/${id}: chin horizontal position differs`);
          assert(face.hit && face.circle.x >= 0 && face.circle.right <= width, `${width}/${id}: inaccessible expression`);
          assert.deepEqual(face.image, baseline[index].image, `${width}/${id}: selection moved a face`);
        }
        assert.equal(await page.locator('.character-book-expression-list [aria-pressed="true"]').count(), 1);
        for (const activation of ["hover", "focus"]) {
          await button[activation]();
          await page.waitForTimeout(width === 1440 ? 350 : 30);
          assert.deepEqual(await inspect(), scan, `${width}/${id}: ${activation} moved a face`);
        }
      }
      await page.mouse.move(0, 0);
      await page.waitForTimeout(50);
      const box = await page.locator("#character-book-expression-list").boundingBox();
      await page.screenshot({ path: path.join(output, `${width}-${id}.png`), clip: { x: box.x - 6, y: box.y - 6, width: box.width + 12, height: box.height + 12 } });
      report.checks.push({ width, selected: id, faces: scan });
    }
    if (mode === "record") {
      // Inspect the source face landmarks at native pixel scale using a browser
      // crop; this does not edit any portrait asset.
      await page.setContent(`<div style="display:flex;gap:10px">${Object.keys(chins).map(id => `<div style="position:relative;width:240px;height:250px;overflow:hidden;background:#324e5b"><img src="${base}/assets/characters/mizuha-${id}-07-v2.png" style="position:absolute;width:887px;height:1774px;left:-365px;top:-130px;max-width:none"></div>`).join("")}</div>`);
      await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalHeight));
      await page.screenshot({ path: path.join(output, "source-face-landmarks.png"), clip: { x: 8, y: 8, width: 990, height: 250 } });
    }
    console.log(`${mode === "record" ? "RECORD" : "PASS"} ${width}: four expression crops; selection, hover and focus`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = mode === "record" ? "recorded" : "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
