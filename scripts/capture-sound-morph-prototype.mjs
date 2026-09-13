import { mkdir, writeFile } from "node:fs/promises";
import { seedHeardSoundArchive } from "./sound-archive-fixture.mjs";
import path from "node:path";
import { chromium } from "playwright-core";

const [routeUrl = "http://127.0.0.1:4173/?soundMorph=1#sound", outputArg = "artifacts/sound-stroke-archive"] = process.argv.slice(2);
const outputDir = path.resolve(outputArg);
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
const report = { errors: [], tracks: [], viewports: [], phases: [] };
const assert = (ok, message) => { if (!ok) throw new Error(message); };
try {
  const page = await browser.newPage({ viewport: { width: 2048, height: 1114 }, deviceScaleFactor: 1 });
  page.on("pageerror", e => report.errors.push(e.message));
  await seedHeardSoundArchive(page);
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#sound-layer")?.classList.contains("is-open"));
  await page.waitForFunction(() => document.querySelector(".sound-character-scene")?.complete);
  await page.waitForTimeout(700);
  const ids = await page.locator("[data-sound-track]").evaluateAll(elements => elements.map(e => e.dataset.soundTrack));
  // Capture the order of appearance, not just the final frame.
  const moon = page.locator('[data-sound-track="moonbook"]');
  await moon.focus();
  for (const delay of [180, 1400, 650, 1250]) {
    await page.waitForTimeout(delay);
    report.phases.push(await moon.locator("canvas").evaluate(c => ({ ...c.dataset })));
  }
  assert(Number(report.phases[0].litNodes) > 0 && Number(report.phases[0].linePhase) === 0, "lines appeared before stars");
  assert(report.phases[0].morphPhase === "constellation-to-letter-nodes", "original constellation flight missing");
  assert(report.phases[1].cometVisible === "true" && report.phases[2].cometVisible === "true", "moving star missing during lettering");
  assert(Number(report.phases[2].cometX) > Number(report.phases[1].cometX), "comet does not advance through letters left to right");
  assert(report.phases.at(-1).cometVisible === "false", "comet did not fade after writing");
  assert(Number(report.phases.at(-1).connectionProgress) === 1, "title did not finish");
  await page.screenshot({ path: path.join(outputDir, "desktop.png") });
  const cards = [];
  for (const id of ids) {
    const button = page.locator('[data-sound-track="' + id + '"]');
    await button.focus();
    await page.waitForFunction(id => document.querySelector('[data-sound-track="' + id + '"]').classList.contains("is-morph-settled"), id);
    const result = await button.evaluate(b => {
      const c = b.querySelector("canvas"), r = b.getBoundingClientRect(), cr = c.getBoundingClientRect();
      const pr = b.parentElement.getBoundingClientRect();
      const title = b.querySelector(".sound-track-name");
      return {
        id: b.dataset.soundTrack, title: title.textContent.trim(),
        width: r.width, titleWidth: cr.width,
        contained: cr.left >= r.left - 1 && cr.right <= r.right + 1 && cr.top >= r.top - 1 && cr.bottom <= r.bottom + 1,
        railContained: r.left >= pr.left && r.right <= pr.right,
        visibleTitles: document.querySelectorAll(".is-morph-focus").length,
        fontHidden: getComputedStyle(title).display === "none",
        source: c.toDataURL(), renderer: c.dataset.geometry,
      };
    });
    assert(result.contained && result.railContained, "title overflow: " + result.title);
    assert(result.visibleTitles === 1 && result.fontHidden, "duplicate title or font overlay: " + result.title);
    cards.push({ title: result.title, source: result.source });
    delete result.source;
    report.tracks.push(result);
  }
  // Fast input switches must leave exactly one title, including keyboard focus.
  for (const id of ids) {
    await page.locator('[data-sound-track="' + id + '"]').focus();
    await page.waitForTimeout(30);
  }
  assert(await page.locator(".is-morph-focus").count() === 1, "multiple titles during rapid focus");
  await moon.focus();
  await page.waitForTimeout(1800);
  await page.locator("#sound-play").click();
  await page.waitForFunction(() => document.querySelector("#sound-layer")?.dataset.playing === "true");
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(outputDir, "desktop-playing.png") });
  for (const viewport of [
    { name: "wide-4k", width: 3840, height: 2088 },
    { name: "laptop", width: 1366, height: 768 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(1900);
    const geometry = await page.evaluate(() => {
      const layer = document.querySelector("#sound-layer"), panel = document.querySelector(".sound-track-panel");
      const player = document.querySelector(".sound-player");
      const volume = document.querySelector(".sound-volume");
      const box = el => el.getBoundingClientRect().toJSON();
      const layout = document.querySelector(".sound-layout");
      return { viewportWidth: innerWidth, layer: box(layer), panel: box(panel), player: box(player), volume: box(volume), scrollWidth: layout.scrollWidth, clientWidth: layout.clientWidth };
    });
    assert(geometry.scrollWidth <= geometry.clientWidth + 2, viewport.name + " horizontal overflow");
    if (viewport.width > 920) assert(geometry.volume.bottom < geometry.panel.top, viewport.name + " player overlaps rail");
    report.viewports.push({ ...viewport, ...geometry });
    await page.screenshot({ path: path.join(outputDir, viewport.name + ".png") });
  }
  // Reduced motion renders immediately and does not schedule ongoing frames.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 2048, height: 1114 });
  await page.locator('[data-sound-track="snowfire"]').focus();
  await page.waitForTimeout(250);
  const reducedFrame = await page.locator('[data-sound-track="snowfire"] canvas').getAttribute("data-frame");
  await page.waitForTimeout(350);
  assert(reducedFrame === await page.locator('[data-sound-track="snowfire"] canvas').getAttribute("data-frame"), "reduced motion keeps drawing");
  const sheet = await browser.newPage({ viewport: { width: 1800, height: 1350 } });
  await sheet.setContent('<html><body style="margin:0;padding:28px;background:#061320;color:#a3c5c0;font:16px sans-serif"><div id="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:16px"></div></body></html>');
  await sheet.evaluate(cards => {
    for (const [i,card] of cards.entries()) {
      const div=document.createElement("div"); div.style.cssText="padding:16px;border-bottom:1px solid #233f49;min-width:0;height:184px";
      const label=document.createElement("div"); label.textContent=String(i+1).padStart(2,"0")+"  "+card.title;
      const image=new Image(); image.src=card.source; image.style.cssText="display:block;max-width:100%;height:140px;object-fit:contain;margin-top:14px";
      div.append(label,image); document.querySelector("#grid").append(div);
    }
  },cards);
  await sheet.screenshot({ path: path.join(outputDir,"all-titles.png"), fullPage:true });
  assert(!report.errors.length, report.errors.join(" | "));
  report.status="passed";
} catch(error) {
  report.status="failed"; report.failure=String(error); throw error;
} finally {
  await writeFile(path.join(outputDir,"report.json"),JSON.stringify(report,null,2));
  await browser.close();
}
console.log("Constellation archive verified: all 12 titles, star-first formation, exclusive focus, desktop/4K/mobile, reduced motion.");
