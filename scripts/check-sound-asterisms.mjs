import { chromium } from "playwright-core";
import { seedHeardSoundArchive } from "./sound-archive-fixture.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [url = "http://127.0.0.1:4173/?soundMorph=1#sound", output = "artifacts/sound-asterisms"] = process.argv.slice(2);
const outputDir = path.resolve(output);
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
const report = { errors: [] };
const assert = (value, message) => { if (!value) throw new Error(message); };
try {
  const page = await browser.newPage({ viewport: { width: 2048, height: 1114 } });
  page.on("pageerror", error => report.errors.push(error.message));
  await seedHeardSoundArchive(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#sound-layer.is-open");
  await page.waitForTimeout(600);
  report.symbols = await page.locator(".sound-track-constellation").evaluateAll(symbols => symbols.map(symbol => ({
    name: symbol.dataset.asterism,
    shape: [...symbol.querySelectorAll(".sound-star-trace")].map(p => p.getAttribute("points")).join("|"),
    principal: symbol.querySelectorAll(".is-principal").length,
    glints: symbol.querySelectorAll(".sound-constellation-glint").length,
    coreRadii: [...symbol.querySelectorAll(".sound-star-core")].map(e => e.r.baseVal.value),
    filters: [...symbol.querySelectorAll("*"), symbol].filter(e => getComputedStyle(e).filter !== "none").length,
    border: getComputedStyle(symbol.parentElement).borderWidth,
    gradients: [...symbol.querySelectorAll("linearGradient")].map(e => e.getAttribute("gradientUnits")),
  })));
  assert(report.symbols.length === 12 && new Set(report.symbols.map(s => s.shape)).size === 12, "constellations must have twelve distinct silhouettes");
  assert(report.symbols.every(s => s.principal === 2 && s.glints === 2 && new Set(s.coreRadii).size === 3), "star magnitude hierarchy or glints missing");
  assert(report.symbols.every(s => s.filters === 0 && s.border === "0px"), "blur or a surrounding button outline returned");
  assert(report.symbols.every(s => s.gradients.every(g => g === "userSpaceOnUse")), "horizontal/vertical star links may lose their gradient");
  const ids = await page.locator(".sound-track-constellation [id]").evaluateAll(elements => elements.map(e => e.id));
  assert(new Set(ids).size === ids.length, "duplicate SVG resource ids");
  await page.locator(".sound-track-panel").screenshot({ path: path.join(outputDir, "constellations-desktop.png") });
  await page.setViewportSize({ width: 3840, height: 2088 });
  await page.waitForTimeout(650);
  const rail = await page.locator(".sound-track-panel").boundingBox();
  await page.locator(".sound-track-panel").screenshot({ path: path.join(outputDir, "constellations-4k.png") });
  await page.screenshot({ path: path.join(outputDir, "constellations-detail.png"), clip: { ...rail, width: rail.width / 3 } });
  await page.locator('[data-sound-track="moonbook"]').focus();
  await page.waitForTimeout(100);
  assert(await page.locator('.is-morph-focus .sound-constellation-star').evaluateAll(stars => stars.every(s => getComputedStyle(s).animationPlayState === "paused")), "invisible constellation stars keep animating");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert(await page.locator('.sound-track-constellation svg, .sound-constellation-star, .sound-constellation-glint').evaluateAll(stars => stars.every(s => getComputedStyle(s).animationName === "none")), "reduced motion still animates");
  assert(report.errors.length === 0, report.errors.join(" | "));
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = String(error); throw error;
} finally {
  await writeFile(path.join(outputDir, "asterisms-report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log("12 distinct asterisms verified: magnitude hierarchy, no blur/outline, paused hidden stars, reduced motion.");
