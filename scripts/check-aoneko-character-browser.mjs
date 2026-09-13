import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [base = "http://127.0.0.1:4397", output = "artifacts/aoneko-character"] = process.argv.slice(2);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
try {
  for (const width of [3840, 1920, 1440, 390, 320]) {
    const height = width === 3840 ? 2160 : width > 900 ? 1080 : width === 320 ? 568 : 844;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900, reducedMotion: width === 1440 ? "no-preference" : "reduce" });
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    page.on("response", response => { if (response.status() === 404) report.errors.push(`${width}: 404 ${response.url()}`); });
    await page.goto(`${base}/#character`, { waitUntil: "domcontentloaded" });
    const selector = page.locator('[data-character-select="aoneko"]');
    await selector.waitFor({ state: "visible" });
    await page.waitForFunction(() => [...document.querySelectorAll(".character-book-selector img")].every(img => img.complete && img.naturalWidth));
    assert.equal(await page.locator("[data-character-select]").count(), 4);
    assert.equal(await selector.getAttribute("aria-label"), "青猫を表示");
    const geometry = await page.locator(".character-book-selector button").evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect();
      return { x: r.x, right: r.right, width: r.width, height: r.height,
        hit: node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
    }));
    assert(geometry.every(box => box.hit && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.right <= width), `${width}: selector overflow/overlap`);
    const waitCharacter = id => page.waitForFunction(id => {
      const layer = document.querySelector("#character-book-layer"), image = document.querySelector("#character-book-image");
      return layer.dataset.characterId === id && layer.dataset.imageState === "ready" && image.complete && image.naturalWidth && image.src.includes(id === "aoneko" ? "aoneko-silhouette-imagegen-v4.png" : `${id}-calm`);
    }, id);
    const verifyAnonymous = async () => {
      const state = await page.evaluate(() => {
        const text = id => document.getElementById(id).textContent.replaceAll("\u00a0", " ");
        return {
          native: text("character-book-native"), fullName: text("character-book-full-name"), reading: text("character-book-reading"),
          title: text("character-book-page-title"), profile: text("character-book-profile"), counter: document.querySelector(".character-book-hero-figure figcaption").textContent,
          hiddenName: document.querySelector("#character-book-full-name").hidden && document.querySelector("#character-book-reading").hidden,
          separatorHidden: getComputedStyle(document.querySelector("#character-book-page-title > i")).display === "none",
          expressionsHidden: getComputedStyle(document.querySelector(".character-book-expressions")).display === "none",
          image: document.querySelector("#character-book-image").currentSrc,
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      assert.equal(state.native, "青猫");
      assert.equal(state.fullName, "");
      assert.equal(state.reading, "");
      assert(state.hiddenName && state.separatorHidden && state.expressionsHidden);
      assert.doesNotMatch(state.profile, /本名|男性|女性|男子|女子/u);
      assert.match(state.profile, /ESP32/u);
      assert.match(state.counter, /04\s*\/\s*04/u);
      assert.equal(state.overflow, 0);
      assert.equal(await page.locator('.character-book-selector [aria-current="true"]').count(), 1);
      return state;
    };
    await selector.click();
    await waitCharacter("aoneko");
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1400);
    const state = await verifyAnonymous();
    if (width === 3840) {
      report.asset = await page.locator("#character-book-image").evaluate(image => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let clear = 0, nearOpaque = 0, visibleNeutralMattePixels = 0;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] === 0) clear++;
          // ImageGen's filled interior commonly uses alpha 251–254, while
          // the outside is exactly zero. Do not require byte-exact 255.
          if (data[i] >= 240) nearOpaque++;
          const low = Math.min(data[i - 3], data[i - 2], data[i - 1]);
          const high = Math.max(data[i - 3], data[i - 2], data[i - 1]);
          if (data[i] > 0 && low >= 180 && high - low <= 22) visibleNeutralMattePixels++;
        }
        return {
          width: canvas.width, height: canvas.height,
          clearFraction: clear / (canvas.width * canvas.height),
          nearOpaqueFraction: nearOpaque / (canvas.width * canvas.height),
          visibleNeutralMattePixels,
          cornerAlpha: [0, canvas.width - 1, canvas.width * (canvas.height - 1), canvas.width * canvas.height - 1]
            .map(index => data[index * 4 + 3]),
          alt: image.alt,
        };
      });
      assert.deepEqual(report.asset.cornerAlpha, [0, 0, 0, 0], "Aoneko background must be genuinely transparent");
      assert(report.asset.clearFraction > 0.3 && report.asset.nearOpaqueFraction > 0.1, "Aoneko must have a solid figure on transparent alpha");
      assert.equal(report.asset.visibleNeutralMattePixels, 0, "Baked white/checkerboard matte must not remain in the blue silhouette's hair");
      assert.match(report.asset.alt, /首を自然に起こし.+低めの頭身.+シルエット/u);
      assert.equal(report.asset.width, 941);
      assert.equal(report.asset.height, 1489);
      assert.match(await selector.locator('img').getAttribute('src'), /aoneko-silhouette-imagegen-v4\.png/u);
    }
    await page.screenshot({ path: path.join(output, `${width}-aoneko.${width > 2000 ? 'jpg' : 'png'}`), ...(width > 2000 ? { type: 'jpeg', quality: 85 } : {}) });
    await page.locator('.character-book-selector').screenshot({ path: path.join(output, `${width}-selector.png`) });
    await page.locator(".character-book-hero-detail").scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    const detail = await page.locator(".character-book-hero-detail").evaluate(node => ({
      rect: node.getBoundingClientRect().toJSON(), overflow: node.scrollWidth - node.clientWidth,
      text: document.querySelector("#character-book-profile").getBoundingClientRect().toJSON(),
      quote: document.querySelector("#character-book-quote").getBoundingClientRect().toJSON(),
    }));
    assert(detail.overflow <= 1 && detail.rect.x >= 0 && detail.rect.right <= width, `${width}: profile is clipped`);
    if (width <= 720) assert(detail.quote.bottom + 8 <= detail.rect.top, `${width}: quote overlaps biography`);
    if (width <= 900) await page.screenshot({ path: path.join(output, `${width}-aoneko-profile.png`) });
    // The fourth character participates in keyboard wrapping and preserves the
    // original three profiles and four expressions when returning to them.
    await page.keyboard.press("ArrowRight");
    await waitCharacter("amane");
    assert.equal(await page.locator("#character-book-full-name").getAttribute("hidden"), null);
    assert.equal(await page.locator(".character-book-expressions").getAttribute("hidden"), null);
    assert.equal(await page.locator("[data-character-expression]").count(), 4);
    await page.keyboard.press("ArrowLeft");
    await waitCharacter("aoneko");
    await verifyAnonymous();
    for (const [id, name] of [["amane", "雨宮 周"], ["mizuha", "青野 瑞葉"], ["sakuya", "木下 咲弥"]]) {
      await page.locator(`[data-character-select="${id}"]`).click();
      await waitCharacter(id);
      assert.equal(await page.locator("#character-book-full-name").getAttribute("aria-label"), name);
      assert.equal(await page.locator("#character-book-full-name").getAttribute("hidden"), null);
      assert.equal(await page.locator(".character-book-expressions").getAttribute("hidden"), null);
      assert.equal(await page.locator("[data-character-expression]").count(), 4);
      await selector.click();
      await waitCharacter("aoneko");
      await verifyAnonymous();
    }
    await page.locator("#character-book-close").click();
    await page.waitForFunction(() => document.querySelector("#character-book-layer").getAttribute("aria-hidden") === "true");
    report.checks.push({ width, height, state, geometry, detail, transitions: "aoneko ↔ all original characters; keyboard wrap" });
    console.log(`PASS ${width}: Aoneko ImageGen silhouette, no real name, four-character navigation, original expressions restored`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, "failure.png") });
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
