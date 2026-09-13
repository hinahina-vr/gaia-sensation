import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/map-exhibit-categories");
const widths = (process.argv[4] || "1440,3840,1024,768,390,320").split(",").map(Number);
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let activePage;
const labels = ["惑星のいま", "気候と炭素", "空と天気", "水と森", "人口と暮らし", "資源とエネルギー", "大地の活動"];
const numbers = [[1, 2, 3, 4, 5], [6, 16, 24, 25, 26], [15, 18, 19, 20, 27, 28], [7, 8, 12, 17, 29, 30], [14, 21, 22, 23], [9, 10, 13], [11]];
const inspectPalette = async (page, width, selected) => {
  await page.locator("#japan-close").focus();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(320);
  const palette = await page.locator(".map-mode-bank .map-mode-button").evaluateAll(buttons => buttons.map(button => {
    const style = getComputedStyle(button);
    const mark = getComputedStyle(button, "::after");
    return { number: Number(button.textContent.trim()), current: button.getAttribute("aria-current") === "true",
      disabled: button.disabled, color: style.color, border: style.borderTopColor, background: style.backgroundColor,
      image: style.backgroundImage, shadow: style.boxShadow, animation: style.animationName,
      mark: mark.content, markBorder: mark.borderRightWidth };
  }));
  assert.equal(palette.length, 30);
  assert.deepEqual(palette.filter(button => button.current).map(button => button.number), [selected]);
  for (const button of palette) {
    assert.equal(button.disabled, false, `${width}/${button.number}: selectable button disabled`);
    assert.equal(button.image, "none", `${width}/${button.number}: provider gradient leaked into picker`);
    assert.equal(button.animation, "none", `${width}/${button.number}: old colored selection flash remains`);
    if (button.current) {
      assert.equal(button.color, "rgb(240, 255, 253)");
      assert.equal(button.border, "rgb(131, 222, 214)");
      assert.equal(button.background, "rgb(22, 69, 80)");
      assert.equal(button.mark, '\"\"');
      assert.equal(parseFloat(button.markBorder) > 0, true);
    } else {
      assert.equal(button.color, "rgb(197, 213, 223)", `${width}/${button.number}: inconsistent idle text`);
      assert.equal(button.border, "rgb(66, 92, 107)", `${width}/${button.number}: inconsistent idle border`);
      assert.equal(button.background, "rgb(16, 35, 46)", `${width}/${button.number}: inconsistent idle surface`);
      assert.equal(button.shadow, "none");
    }
  }
  (report.palettes ||= []).push({ width, selected, buttons: palette });
};
try {
  for (const width of widths) {
    const height = width === 3840 ? 2160 : width < 600 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 900,
      deviceScaleFactor: width < 600 ? 2 : 1, reducedMotion: width === 320 ? "reduce" : "no-preference" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    for (const host of ["api.open-meteo.com", "air-quality-api.open-meteo.com"]) {
      await context.route(`https://${host}/**`, route => {
        const count = new URL(route.request().url()).searchParams.get("latitude")?.split(",").length || 1;
        const rows = Array.from({ length: count }, () => ({ current: {
          time: "2026-09-06T00:00", wind_speed_10m: 5, wind_direction_10m: 80, surface_pressure: 1005,
          cloud_cover: 58, shortwave_radiation: 194, pm2_5: 9.9, aerosol_optical_depth: .18,
        } }));
        return route.fulfill({ json: count === 1 ? rows[0] : rows });
      });
    }
    await context.route("https://earthquake.usgs.gov/**", route => route.fulfill({ json: {
      type: "FeatureCollection", metadata: { generated: Date.now() }, features: [{ type: "Feature", id: "category-test",
        geometry: { type: "Point", coordinates: [140, 36, 10] }, properties: { mag: 3, time: Date.now(), place: "TEST" } }],
    } }));
    const page = await context.newPage(); activePage = page;
    page.on("pageerror", error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/?preview=subject-categories#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true"
      && document.querySelectorAll(".map-category-group .map-mode-button").length === 30
      && document.querySelector("#japan-mode-number").textContent === "01"
      && document.querySelector("#japan-layer").classList.contains("is-firms-exhibit"));
    await page.evaluate(() => GaiaModeEntryGuide?.close?.("map", { restoreFocus: false }));
    const settled = () => page.waitForFunction(() => !document.querySelector("#japan-layer").classList.contains("is-map-title-transitioning"));
    const select = async number => {
      await page.evaluate(number => GaiaMapCategories.buttons().find(button => Number(button.textContent.trim()) === number).click(), number);
      await page.waitForFunction(number => Number(document.querySelector("#japan-mode-number").textContent.trim()) === number, number);
      await settled();
      await page.waitForTimeout(120);
    };
    const openMainPicker = async () => {
      if (await page.locator(".gaia-featured-selector-toggle:visible").count()) await page.locator(".gaia-featured-selector-toggle:visible").click();
      else if (width > 900) await page.locator(".map-dock-bank-trigger").click();
      else if (await page.locator("#map-mobile-bank-toggle").isVisible()) await page.locator("#map-mobile-bank-toggle").click();
      await page.waitForTimeout(250);
    };
    await settled();
    await openMainPicker();
    await page.keyboard.press("Tab");
    const groups = await page.locator(".map-category-group").evaluateAll(groups => groups.map(group => ({
      label: group.querySelector("strong").textContent,
      numbers: [...group.querySelectorAll(".map-mode-button")].map(button => Number(button.textContent.trim())),
    })));
    assert.deepEqual(groups.map(group => group.label), labels);
    assert.deepEqual(groups.map(group => group.numbers), numbers);
    assert.equal(await page.locator(".map-mode-bank [data-map-source-mount] .map-mode-button").count(), 0);
    assert.deepEqual(await page.evaluate(() => GaiaMapCategories.buttons().map(button => Number(button.textContent.trim()))), Array.from({ length: 30 }, (_, i) => i + 1));
    // Every real button is visible, hittable after scrolling, and keeps its preview.
    for (let number = 1; number <= 30; number++) {
      const button = page.locator(".map-category-group .map-mode-button").filter({ hasText: new RegExp(`^${String(number).padStart(2, "0")}$`) });
      await button.scrollIntoViewIfNeeded();
      await button.focus();
      const focus = await button.evaluate(button => ({ style: getComputedStyle(button).outlineStyle, width: getComputedStyle(button).outlineWidth }));
      assert.equal(focus.style, "solid", `${width}/${number}: keyboard focus missing`);
      assert.equal(focus.width, "2px");
      await page.waitForFunction(number => document.querySelector("#map-mode-preview").getAttribute("aria-hidden") === "false"
        && document.querySelector("#map-mode-preview-number").textContent.startsWith(`${String(number).padStart(2, "0")} /`), number);
      const scan = await button.evaluate(button => {
        const r = button.getBoundingClientRect();
        return { rect: r.toJSON(), hit: button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)),
          bankOverflow: document.querySelector(".map-mode-groups").scrollWidth - document.querySelector(".map-mode-groups").clientWidth };
      });
      assert(scan.hit, `${width}/${number}: picker button obscured`);
      assert(scan.rect.x >= 0 && scan.rect.right <= width && scan.rect.y >= 0 && scan.rect.bottom <= height);
      assert(scan.bankOverflow <= 2, `${width}/${number}: picker horizontal overflow ${scan.bankOverflow}`);
      assert.equal(await page.locator("#japan-mode-number").textContent(), "01");
    }
    await inspectPalette(page, width, 1);
    await page.locator(".map-mode-groups").evaluate(node => { node.scrollTop = 0; });
    if (width < 900) await page.locator(".map-mode-bank").evaluate(node => { node.scrollTop = 0; });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(output, `${width}-picker.jpg`), type: "jpeg", quality: 90 });
    if (width === 1440) await page.locator(".map-dock-bank-popover").screenshot({ path: path.join(output, `${width}-picker-detail.png`) });
    // Actual click through a moved button, then all 30 renderer/category pairings.
    await page.locator(".map-category-group .map-mode-button").filter({ hasText: /^12$/ }).click();
    await settled();
    assert.equal(await page.locator("#japan-mode-number").textContent(), "12");
    for (let number = 1; number <= 30; number++) {
      await select(number);
      const chapter = number === 1 ? ".gaia-firms-chapter" : number <= 5 ? ".gaia-planet-chapter"
        : number <= 14 || (number <= 20 && width <= 900) ? ".map-dock-bank-copy" : number <= 20 ? ".gaia-live-deck-chapter" : ".gaia-estat-chapter";
      const scan = await page.locator(chapter).evaluate(chapter => {
        const label = chapter.querySelector("[data-map-category-label]");
        const title = chapter.querySelector("[data-map-dock-title], [data-live-deck-title], [data-estat-title], .gaia-featured-selector-toggle strong, [data-planet-title]");
        const range = document.createRange(); range.selectNodeContents(label);
        const r = range.getBoundingClientRect();
        const style = getComputedStyle(label);
        const rect = label.getBoundingClientRect();
        const labels = [...document.querySelectorAll(".map-mode-button[aria-current='true']")].map(button => button.textContent.trim());
        const titleRect = title?.getBoundingClientRect().toJSON();
        let visible = rect.width > 0 && rect.height > 0;
        for (let node = label; node; node = node.parentElement) {
          const s = getComputedStyle(node);
          if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < .01) visible = false;
        }
        return { label: label.textContent, visible, rect: rect.toJSON(), glyphs: r.toJSON(), titleRect,
          font: style.fontFamily, size: parseFloat(style.fontSize), labels,
          category: document.querySelector("#japan-layer").dataset.mapCategory,
          currentGroups: [...document.querySelectorAll(".map-category-group.is-current-category strong")].map(node => node.textContent),
          liveActive: document.querySelector("#japan-layer").classList.contains("is-live-exhibit") };
      });
      const category = labels[numbers.findIndex(group => group.includes(number))];
      report.checks.push({ width, number, ...scan });
      assert.equal(scan.label, category); assert.equal(scan.visible, true, `${width}/${number}: lower-strip category hidden`);
      assert.equal(scan.size >= 10, true); assert.match(scan.font, /Yu Gothic UI/);
      assert.deepEqual(scan.labels, [String(number).padStart(2, "0")], `${width}/${number}: stale active buttons`);
      assert.deepEqual(scan.currentGroups, [category]);
      assert.equal(scan.liveActive, number >= 15 && number <= 20, `${width}/${number}: live renderer deactivation`);
      assert(scan.glyphs.x >= 0 && scan.glyphs.right <= width + 1 && scan.glyphs.y > height / 2 && scan.glyphs.bottom <= height,
        `${width}/${number}: category missing from lower strip ${JSON.stringify(scan.glyphs)}`);
      assert(scan.glyphs.width <= scan.rect.width + 1, `${width}/${number}: truncated category`);
      if (scan.titleRect) assert(scan.glyphs.bottom <= scan.titleRect.top + 1, `${width}/${number}: category/title overlap`);
      if ([4, 12, 16, 26, 30].includes(number)) {
        await page.screenshot({ path: path.join(output, `${width}-${number}.jpg`), type: "jpeg", quality: 85 });
        if (width > 900) await page.screenshot({ path: path.join(output, `${width}-${number}-band.png`), clip: { x: 0, y: height - 110, width, height: 110 } });
      }
    }
    await inspectPalette(page, width, 30);
    if (width > 900) {
      await select(17);
      await page.locator(".gaia-live-deck-selector-toggle").click();
      await page.waitForTimeout(300);
      const quick = await page.locator(".map-category-group").evaluateAll(groups => groups.map(group => ({
        label: group.querySelector("strong").textContent,
        numbers: [...group.querySelectorAll(".map-mode-button")].map(node => Number(node.textContent)),
      })));
      assert.deepEqual(quick.map(group => group.label), labels);
      assert.deepEqual(quick.map(group => group.numbers), numbers);
      await page.screenshot({ path: path.join(output, `${width}-quick-picker.jpg`), type: "jpeg", quality: 90 });
      await page.locator('.map-mode-bank [data-map-standard-index="3"]').click();
      await page.waitForFunction(() => document.querySelector("#japan-mode-number").textContent === "09"
        && !document.querySelector("#japan-layer").classList.contains("is-live-exhibit"));
    }
    console.log(`PASS ${width}: featured five first, seven categories, 30 unique/hittable previews, all 30 lower-strip labels, renderer cleanup, numeric sorting`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack;
  await activePage?.screenshot({ path: path.join(output, "failure.jpg"), type: "jpeg", quality: 90 }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
