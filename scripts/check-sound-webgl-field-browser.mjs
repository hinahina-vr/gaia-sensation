import { mkdir } from "node:fs/promises";
import { seedHeardSoundArchive } from "./sound-archive-fixture.mjs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [playwrightRoot, chromePath, outputArg = "artifacts/sound-webgl-field", routeUrl = "http://127.0.0.1:4173/#sound"] = process.argv.slice(2);
if (!playwrightRoot || !chromePath) {
  throw new Error("usage: node scripts/check-sound-webgl-field-browser.mjs <playwright-root> <chrome-path> [output-dir] [url]");
}

const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);
const outputDir = path.resolve(outputArg);
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--disable-background-timer-throttling"],
});

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const viewport of [
  { name: "desktop", width: 2048, height: 1114 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await seedHeardSoundArchive(page);
  await page.goto(routeUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => {
    const layer = document.querySelector("#sound-layer");
    return layer instanceof HTMLElement
      && !layer.hidden
      && layer.getAttribute("aria-hidden") === "false"
      && layer.classList.contains("is-open");
  }, null, { timeout: 75_000 });
  await page.waitForFunction(() => document.querySelector("#sound-visualizer")?.dataset.renderer === "webgl", null, { timeout: 15_000 });
  await page.locator('[data-sound-track="opening"]').click();
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#sound-visualizer");
    return canvas?.dataset.analysisActive === "true"
      && [canvas.dataset.bass, canvas.dataset.mid, canvas.dataset.high].some((value) => Number(value) > 0.005)
      && Number(canvas.dataset.energy) > 0.005
      && Number.parseFloat(getComputedStyle(canvas).opacity || "0") >= 0.82;
  }, null, { timeout: 15_000 });

  const scan = await page.locator("#sound-visualizer").evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    const style = getComputedStyle(canvas);
    return {
      rect: rect.toJSON(),
      renderer: canvas.dataset.renderer,
      visualizer: canvas.dataset.visualizer,
      presentation: canvas.dataset.presentation,
      reactivity: canvas.dataset.reactivity,
      motionProfile: canvas.dataset.motionProfile,
      formLanguage: canvas.dataset.formLanguage,
      palette: canvas.dataset.palette,
      illumination: canvas.dataset.illumination,
      motionRate: canvas.dataset.motionRate,
      timbreBins: canvas.dataset.timbreBins,
      timbreProfile: String(canvas.dataset.timbreProfile || "").split(",").map(Number),
      dragControl: canvas.dataset.dragControl,
      viewYaw: Number(canvas.dataset.viewYaw || 0),
      viewPitch: Number(canvas.dataset.viewPitch || 0),
      geometryPoints: Number(canvas.dataset.geometryPoints || 0),
      webglFrame: Number(canvas.dataset.webglFrame || 0),
      webglError: Number(canvas.dataset.webglError || 0),
      shaderError: canvas.dataset.shaderError || "",
      bass: Number(canvas.dataset.bass),
      mid: Number(canvas.dataset.mid),
      high: Number(canvas.dataset.high),
      energy: Number(canvas.dataset.energy),
      opacity: Number(style.opacity),
      filter: style.filter,
      eqCount: document.querySelectorAll("#sound-eq-visualizer, .sound-eq-visualizer").length,
    };
  });

  assert(scan.renderer === "webgl" && !scan.shaderError, `${viewport.name}: WebGL shader failed: ${JSON.stringify(scan)}`);
  assert(scan.webglError === 0, `${viewport.name}: WebGL reported an error: ${JSON.stringify(scan)}`);
  assert(scan.visualizer === "audio-reactive-deep-galaxy" && scan.presentation === "full-screen-webgl", `${viewport.name}: wrong visualizer mode: ${JSON.stringify(scan)}`);
  assert(scan.reactivity === "fft8-local-timbre-regions" && scan.motionProfile === "fourfold-single-direction-galactic-drift" && scan.formLanguage === "spiral-nebula-starfield" && scan.palette === "stellar-obafgkm-and-emission-nebulae" && scan.illumination === "per-cluster-spectral-bin" && scan.motionRate === "4x" && scan.timbreBins === "8" && scan.timbreProfile.length === 8 && Math.max(...scan.timbreProfile) - Math.min(...scan.timbreProfile) >= 0.01 && scan.dragControl === "left-pointer-orbit-3d" && scan.geometryPoints >= 19000 && scan.webglFrame > 0, `${viewport.name}: visualizer did not restore the clustered stellar field: ${JSON.stringify(scan)}`);
  assert(scan.eqCount === 0, `${viewport.name}: detached EQ visualizer remains`);
  assert(scan.rect.left <= 0 && scan.rect.top <= 0 && scan.rect.right >= viewport.width && scan.rect.bottom >= viewport.height, `${viewport.name}: WebGL field is not full-screen: ${JSON.stringify(scan)}`);
  assert(scan.opacity >= 0.82 && scan.filter.includes("saturate") && scan.filter.includes("contrast"), `${viewport.name}: clustered WebGL field treatment is missing: ${JSON.stringify(scan)}`);
  assert(scan.energy > 0.005 && Math.max(scan.bass, scan.mid, scan.high) > 0.005, `${viewport.name}: audio analysis is not reaching WebGL: ${JSON.stringify(scan)}`);
  assert(errors.length === 0, `${viewport.name}: browser errors: ${errors.join(" | ")}`);

  const firstFrame = scan.webglFrame;
  await page.waitForTimeout(800);
  const laterFrame = await page.locator("#sound-visualizer").evaluate((canvas) => Number(canvas.dataset.webglFrame || 0));
  const minimumFrames = viewport.name === "mobile" ? 12 : 20;
  assert(laterFrame - firstFrame >= minimumFrames, `${viewport.name}: WebGL animation stalled (${firstFrame} -> ${laterFrame})`);

  if (viewport.name === "desktop") {
    await page.screenshot({ path: path.join(outputDir, "desktop-before-drag.png"), fullPage: false });
    const beforeDrag = await page.locator("#sound-visualizer").evaluate((canvas) => ({ yaw: Number(canvas.dataset.viewYaw), pitch: Number(canvas.dataset.viewPitch) }));
    await page.mouse.move(1470, 780);
    await page.mouse.down({ button: "left" });
    await page.mouse.move(1680, 670, { steps: 12 });
    await page.mouse.up({ button: "left" });
    await page.waitForTimeout(300);
    const afterDrag = await page.locator("#sound-visualizer").evaluate((canvas) => ({ yaw: Number(canvas.dataset.viewYaw), pitch: Number(canvas.dataset.viewPitch), dragging: canvas.dataset.dragging }));
    assert(afterDrag.yaw > beforeDrag.yaw + 0.07 && afterDrag.pitch > beforeDrag.pitch + 0.04 && afterDrag.dragging === "false", `desktop: left-drag did not rotate the WebGL view in 3D: ${JSON.stringify({ beforeDrag, afterDrag })}`);
    await page.screenshot({ path: path.join(outputDir, "desktop-after-drag.png"), fullPage: false });
  }

  await page.screenshot({ path: path.join(outputDir, `${viewport.name}-sound-webgl-field.png`), fullPage: false });
  await context.close();
}

await browser.close();
console.log("sound full-screen WebGL field check passed: desktop + mobile");
