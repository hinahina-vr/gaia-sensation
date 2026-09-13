import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4417"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) {
  throw new Error("Playwright module root and browser executable are required");
}

const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/sound-return-layout-browser");
fs.mkdirSync(outputDir, { recursive: true });

const viewports = [
  { name: "pc-4k", width: 3840, height: 2088 },
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-320", width: 320, height: 568, mobile: true },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };
const browser = await chromium.launch({ headless: true, executablePath });

const readLayout = (page) => page.evaluate(() => {
  const rect = (element) => element?.getBoundingClientRect().toJSON();
  const layoutSize = (element) => element ? {
    width: element.offsetWidth,
    height: element.offsetHeight,
  } : null;
  const grid = document.querySelector("#intro-path-grid");
  const primary = document.querySelector(".intro-story-return[data-primary-action='true']");
  const cards = Array.from(grid?.querySelectorAll(".intro-path-card") || []);
  const gridColumns = grid ? getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/u).filter(Boolean) : [];
  return {
    grid: rect(grid),
    primary: rect(primary),
    cards: cards.map((card) => ({
      label: card.querySelector("strong")?.textContent.trim() || "",
      rect: rect(card),
      layoutSize: layoutSize(card),
    })),
    gridColumns,
    soundModeOpen: document.body.classList.contains("sound-mode-open"),
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
  };
});

const assertStableLayout = (viewport, before, after) => {
  const tolerance = 1;
  const expectedColumns = viewport.mobile ? 2 : 4;
  assert.equal(before.cards.length, 4, `${viewport.name}: entrance does not have four exploration cards`);
  assert.equal(after.cards.length, 4, `${viewport.name}: exploration card count changed after sound return`);
  assert.equal(before.gridColumns.length, expectedColumns, `${viewport.name}: entrance starts with the wrong grid: ${before.gridColumns}`);
  assert.equal(after.gridColumns.length, expectedColumns, `${viewport.name}: sound CSS changed the grid: ${after.gridColumns}`);
  assert(Math.abs(before.grid.width - before.primary.width) <= tolerance, `${viewport.name}: entrance actions do not start at the same width`);
  assert(Math.abs(after.grid.width - after.primary.width) <= tolerance, `${viewport.name}: returned actions do not have the same width`);
  assert(Math.abs(before.grid.width - after.grid.width) <= tolerance, `${viewport.name}: grid width shrank after sound return`);
  assert(Math.abs(before.primary.width - after.primary.width) <= tolerance, `${viewport.name}: story button width changed after sound return`);
  before.cards.forEach((card, index) => {
    assert.equal(after.cards[index].label, card.label, `${viewport.name}: card order changed after sound return`);
    assert(
      Math.abs(card.layoutSize.width - after.cards[index].layoutSize.width) <= tolerance,
      `${viewport.name}: ${card.label} layout width changed from ${card.layoutSize.width}px to ${after.cards[index].layoutSize.width}px`,
    );
    assert(
      Math.abs(card.layoutSize.height - after.cards[index].layoutSize.height) <= tolerance,
      `${viewport.name}: ${card.label} layout height changed after sound return`,
    );
  });
  assert.equal(after.soundModeOpen, false, `${viewport.name}: sound-mode-open remained on body`);
  assert.equal(after.horizontalOverflow, 0, `${viewport.name}: sound return introduced horizontal overflow`);
};

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: Boolean(viewport.mobile),
      isMobile: Boolean(viewport.mobile),
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      localStorage.setItem("gaia-senseware-bgm-muted", "true");
    });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`);
    });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => {
      if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`);
    });

    await page.goto(new URL(`/?preview=sound-return-${viewport.name}#earth`, baseUrl).href, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === "true");
    await page.waitForFunction(() => !document.documentElement.classList.contains("gaia-booting"));
    await page.waitForFunction(() => document.querySelector("#japan-layer")?.getAttribute("aria-hidden") === "false");
    await page.locator("#japan-close").click();
    await page.waitForFunction(() => {
      const intro = document.querySelector("#intro-layer");
      return intro && !intro.hidden && intro.getAttribute("aria-hidden") === "false";
    });
    const before = await readLayout(page);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-before-sound.png`), animations: "disabled" });

    await page.locator(".intro-path-card--sound").click();
    await page.waitForFunction(() => document.body.classList.contains("sound-mode-open"));
    await page.waitForFunction(() => document.querySelector("#sound-layer")?.classList.contains("is-open"));
    await page.locator("#sound-close").click();
    await page.waitForFunction(() => !document.body.classList.contains("sound-mode-open"));
    await page.waitForFunction(() => document.querySelector("#sound-layer")?.hidden === true);
    const after = await readLayout(page);
    assertStableLayout(viewport, before, after);
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}-after-sound.png`), animations: "disabled" });
    report.scans.push({ viewport: viewport.name, before, after });
    await context.close();
  }

  assert.deepEqual(report.consoleErrors, [], "console errors were emitted");
  assert.deepEqual(report.pageErrors, [], "page errors were emitted");
  assert.deepEqual(report.responses404, [], "404 responses were observed");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error?.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
