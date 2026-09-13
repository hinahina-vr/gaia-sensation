import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/character-selector-alignment");
fs.mkdirSync(output, { recursive: true });
// Approximate landmarks read from the original, unmodified portrait files.
// Eye midpoint to chin is the facial scale; hair and full-body margins vary.
const landmarks = {
  amane: { chinX: 526, chinY: 295, eyesY: 212 },
  mizuha: { chinX: 489, chinY: 301, eyesY: 225 },
  sakuya: { chinX: 513, chinY: 270, eyesY: 191 },
};
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [3840, 1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width === 3840 ? 2160 : width > 900 ? 900 : 844 },
      reducedMotion: width === 1440 ? "no-preference" : "reduce" });
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/#character`, { waitUntil: "domcontentloaded" });
    await page.locator(".character-book-selector").waitFor({ state: "visible" });
    await page.waitForFunction(() => [...document.querySelectorAll(".character-book-selector img")].every(img => img.complete && img.naturalHeight));
    // The faceless Aoneko silhouette has no eye-to-chin scale to compare.
    const inspect = () => page.locator('.character-book-selector button:not([data-character-select="aoneko"]) img').evaluateAll((nodes, landmarks) => nodes.map(img => {
      const id = img.closest("button").dataset.characterSelect;
      const point = landmarks[id];
      const r = img.getBoundingClientRect(), circle = img.parentElement.getBoundingClientRect();
      const scale = r.height / img.naturalHeight;
      return { id, circle: circle.toJSON(), image: r.toJSON(),
        chinX: (r.x + point.chinX * scale - circle.x) / circle.width,
        chinY: r.y + point.chinY * scale,
        faceHeight: (point.chinY - point.eyesY) * scale,
        hit: img.parentElement.contains(document.elementFromPoint(circle.x + circle.width / 2, circle.y + circle.height / 2)),
      };
    }), landmarks);
    let baseline;
    const states = [];
    for (const id of Object.keys(landmarks)) {
      const button = page.locator(`[data-character-select="${id}"]`);
      await button.click();
      await page.mouse.move(0, 0);
      await page.waitForFunction(id => document.querySelector("#character-book-layer").dataset.characterId === id, id);
      await page.waitForTimeout(width === 1440 ? 380 : 40);
      const scan = await inspect();
      baseline ||= scan;
      const amane = scan[0];
      for (const [index, face] of scan.entries()) {
        assert(Math.abs(face.chinY - amane.chinY) < .5, `${width}: chin heights differ`);
        assert(Math.abs(face.chinX - amane.chinX) < .005, `${width}: chin horizontal position differs`);
        assert(Math.abs(face.faceHeight / amane.faceHeight - 1) < .005, `${width}: facial scale differs`);
        assert(face.hit && face.circle.width >= 44 && face.circle.right <= width, `${width}: inaccessible selector`);
        assert.deepEqual(face.image, baseline[index].image, `${width}: selection moved or scaled a face`);
      }
      assert.equal(await page.locator('.character-book-selector [aria-current="true"]').count(), 1);
      await button.hover();
      await page.waitForTimeout(width === 1440 ? 350 : 30);
      assert.deepEqual(await inspect(), scan, `${width}: hover changed alignment`);
      await page.keyboard.press("Tab");
      await button.focus();
      await page.waitForTimeout(width === 1440 ? 350 : 30);
      assert.deepEqual(await inspect(), scan, `${width}: keyboard focus changed alignment`);
      await page.mouse.move(0, 0);
      const first = scan[0].circle, last = scan.at(-1).circle;
      const clip = { x: first.x - 8, y: first.y - 8, width: last.right - first.x + 16, height: first.height + 16 };
      await page.screenshot({ path: path.join(output, `${width}-${id}-selector.png`), clip });
      states.push({ selected: id, faces: scan });
    }
    await page.screenshot({ path: path.join(output, `${width}-page.jpg`), type: "jpeg", quality: 88 });
    report.checks.push({ width, states });
    console.log(`PASS ${width}: three aligned faces; stable selection, hover and keyboard focus`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg" });
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
