import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/saku-selector-position");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const width of [1440, 3840, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 3840 ? 2160 : width < 720 ? 844 : 900 }, reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/#character`, { waitUntil: "domcontentloaded" });
    const selector = page.locator(".character-book-selector");
    await selector.waitFor({ state: "visible" });
    await selector.locator('[data-character-select="sakuya"]').click();
    await page.waitForFunction(() => [...document.querySelectorAll(".character-book-selector img")].every(img => img.complete && img.naturalWidth > 0));
    await page.waitForTimeout(200);
    const scan = () => selector.locator("button").evaluateAll(buttons => buttons.map(button => {
      const img = button.querySelector("img");
      const rect = img.getBoundingClientRect();
      return {
        id: button.dataset.characterSelect, top: parseFloat(getComputedStyle(img).top),
        parentHeight: img.parentElement.clientHeight, height: rect.height, width: rect.width,
        selected: button.getAttribute("aria-current"), source: img.currentSrc,
      };
    }));
    const baselineStyle = await page.addStyleTag({ content: '.character-book-selector [data-character-select="sakuya"] img { top: -63%; }' });
    const before = await scan();
    await selector.screenshot({ path: path.join(output, `${width}-before.png`) });
    await baselineStyle.evaluate(node => node.remove());
    const after = await scan();
    for (let i = 0; i < after.length; i++) {
      if (after[i].id === "sakuya") {
        assert(Math.abs(after[i].top - before[i].top - after[i].parentHeight * .12) < .05, "Saku must move down by 12% of the circle");
        assert.equal(after[i].width, before[i].width, "Do not resize the portrait");
        assert.equal(after[i].height, before[i].height);
      } else assert.deepEqual(after[i], before[i], "Other portraits must not change");
    }
    await selector.screenshot({ path: path.join(output, `${width}-after.png`) });
    await selector.locator('[data-character-select="amane"]').click();
    await page.waitForTimeout(200);
    const unselected = (await scan()).find(row => row.id === "sakuya");
    assert.equal(unselected.selected, "false");
    assert(Math.abs(unselected.top / unselected.parentHeight + .51) < .002, "Unselected Saku keeps the new crop");
    report.checks.push({ width, before, after, unselected });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
  console.log("PASS: Saku crop lowered on desktop, 4K and mobile; size and other characters unchanged.");
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
