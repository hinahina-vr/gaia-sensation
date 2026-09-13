import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const output = path.resolve(process.argv[3] || "artifacts/source-ledger-compact");
const baselineOnly = process.argv.includes("--baseline");
const baselinePath = path.resolve("artifacts/source-ledger-before/report.json");
const baseline = !baselineOnly && fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, "utf8")) : null;
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const checkSourceIcon = async (link, width) => {
  const geometry = await link.evaluate(node => {
    const label = node.querySelector(".data-source-link-label");
    const icon = node.querySelector("svg.data-source-link-icon");
    if (!label || !icon) return { missingIcon: true };
    const r = node.getBoundingClientRect();
    const text = document.createRange();
    text.selectNodeContents(label);
    const t = text.getBoundingClientRect();
    const i = icon.getBoundingClientRect();
    const labelBox = label.getBoundingClientRect();
    return {
      lineCount: new Set([...text.getClientRects()].map(rect => Math.round(rect.y))).size,
      centerDifference: Math.abs((labelBox.y + labelBox.height / 2) - (i.y + i.height / 2)),
      gap: i.x - t.right, iconWidth: i.width, iconHeight: i.height,
      fits: t.x >= r.x && i.right <= r.right && node.scrollWidth <= node.clientWidth + 1,
      hasLegacyArrow: node.textContent.includes("↗"),
      accessible: node.getAttribute("aria-label") === `${label.textContent}（新しいタブで開く）`
        && icon.getAttribute("aria-hidden") === "true" && icon.getAttribute("focusable") === "false",
    };
  });
  assert(!geometry.missingIcon && geometry.lineCount === 1 && geometry.centerDifference <= 1
    && geometry.gap >= 5 && geometry.iconWidth === 14 && geometry.iconHeight === 14
    && geometry.fits && !geometry.hasLegacyArrow && geometry.accessible,
  `${width}: source icon alignment/accessibility ${JSON.stringify(geometry)}`);
};
try {
  for (const width of [1440, 3840, 390, 320]) {
    const height = width === 3840 ? 2088 : width < 901 ? 844 : 900;
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      sessionStorage.setItem("gaia:mode-entry-guide:map:v3", "seen");
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    await context.route("https://services.swpc.noaa.gov/**", route => route.fulfill({ path: "data/ovation-aurora-snapshot.json", contentType: "application/json" }));
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${base}/?preview=compact-sources#world`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true" && document.querySelectorAll(".data-ledger-card").length > 5);
    let opener = page.locator(".map-dock-action--source:visible");
    if (!await opener.count()) {
      await page.locator("#map-mobile-heading-toggle").click();
      opener = page.locator("#japan-data-button");
    }
    await opener.click();
    await page.waitForFunction(() => document.querySelector("#japan-data-panel").getAttribute("aria-hidden") === "false");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(380);
    const initial = await page.evaluate(() => {
      const scroller = document.querySelector(".japan-data-scroll");
      const viewport = scroller.getBoundingClientRect();
      const cards = [...document.querySelectorAll(".data-ledger-card")].map(card => ({
        title: card.querySelector("h3").textContent,
        organisation: card.querySelector(".data-ledger-organisation").textContent,
        links: [...card.querySelectorAll("a")].map(a => ({ text: a.textContent, href: a.href, target: a.target, rel: a.rel })),
        height: card.getBoundingClientRect().height,
        bottom: card.getBoundingClientRect().bottom,
      }));
      return { cards, visibleCards: cards.filter(card => card.bottom <= viewport.bottom).length, scrollHeight: scroller.scrollHeight, viewportHeight: viewport.height, overflow: scroller.scrollWidth - scroller.clientWidth };
    });
    await page.screenshot({ path: path.join(output, `${width}-sources.jpg`), type: "jpeg", quality: 90 });
    if (!baselineOnly) {
      assert(initial.overflow <= 1, `${width}: horizontal overflow`);
      const before = baseline?.checks.find(check => check.width === width);
      if (before) {
        // The external-link glyph was intentionally replaced by a decorative SVG.
        const content = state => state.cards.map(({ title, organisation, links }) => ({
          title, organisation,
          links: links.map(link => ({ ...link, text: link.text.replace(/\s*↗$/u, "") })),
        }));
        assert.deepEqual(content(initial), content(before), "Source metadata or links changed during a layout-only edit");
        const totalHeight = state => state.cards.reduce((sum, card) => sum + card.height, 0);
        assert(totalHeight(initial) < totalHeight(before) * .9, `${width}: insufficient reduction ${totalHeight(initial)}/${totalHeight(before)}`);
      }
      for (const link of await page.locator(".data-ledger-card a").all()) {
        await link.scrollIntoViewIfNeeded();
        await checkSourceIcon(link, width);
        const geometry = await link.evaluate(node => {
          const rect = node.getBoundingClientRect();
          const title = node.closest(".data-ledger-card").querySelector("h3");
          return { height: rect.height, width: rect.width, hit: node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)), textFits: title.scrollWidth <= title.clientWidth + 1 };
        });
        assert(geometry.height >= 44 && geometry.width >= 44 && geometry.hit && geometry.textFits, `${width}: inaccessible source link ${JSON.stringify(geometry)}`);
      }
      if (width === 1440) {
        await page.locator(".japan-data-scroll").evaluate(node => { node.scrollTop = 0; });
        const firstCard = await page.locator(".data-ledger-card").first().boundingBox();
        await page.screenshot({ path: path.join(output, "source-link-detail.png"), clip: firstCard });
      }
      // Exercise the optional terms link, including long provider and source names.
      await page.evaluate(() => globalThis.GaiaDataLedger.create().updateLiveExhibit({ number: "10", shortTitle: "QA", id: "qa", key: "qa", caption: "QA", location: { label: "QA" } }, {
        source: "live", events: [{ provider: "esa", datasetId: "非常に長いデータセット名と出典表記が複数行になっても省略されないことを確認するQA", status: "snapshot", provenance: { sourceUrl: "https://source-qa.example/data", licenseUrl: "https://source-qa.example/terms" }, measurements: [{ key: "qa", value: 1, unit: "unit" }] }],
      }));
      assert.equal(await page.locator(".data-ledger-card a").count(), 2);
      await page.locator(".japan-data-scroll").evaluate(node => { node.scrollTop = 0; });
      for (const link of await page.locator(".data-ledger-card a").all()) {
        await link.scrollIntoViewIfNeeded();
        await checkSourceIcon(link, width);
        await page.keyboard.press("Tab");
        await link.focus();
        assert(await link.evaluate(node => node === document.activeElement && getComputedStyle(node).outlineStyle !== "none"), `${width}: no keyboard focus indicator`);
        assert(await link.evaluate(node => {
          const r = node.getBoundingClientRect();
          return r.height >= 44 && node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }), `${width}: terms/source link obstructed`);
      }
      assert.equal(await page.locator(".data-ledger-card").evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
      await page.screenshot({ path: path.join(output, `${width}-terms.jpg`), type: "jpeg", quality: 90 });
    }
    if (!baselineOnly) {
      await page.locator("#japan-data-close").click();
      assert(await opener.evaluate(node => node === document.activeElement));
    }
    report.checks.push({ width, ...initial, singleLineSvgIcons: !baselineOnly });
    console.log(`${baselineOnly ? "BASELINE" : "PASS"} ${width}px: ${initial.cards.length} sources, ${initial.visibleCards} fully visible, ${initial.scrollHeight}px scroll height`);
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
