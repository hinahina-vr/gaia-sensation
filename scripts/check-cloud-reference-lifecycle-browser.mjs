import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4397";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  let requests = 0, releaseImage;
  const gate = new Promise(resolve => { releaseImage = resolve; });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/cloud-lifecycle", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><canvas id='cloud'></canvas>" }));
  await page.route("**/nasa-blue-marble-clouds-2048.jpg", async route => { requests++; await gate; await route.continue(); });
  await page.goto(`${base}/cloud-lifecycle`);
  await page.evaluate(async () => {
    const { createAtmosphereRenderer } = await import("/src/exploration/atmosphere-webgl.js?v=gaia-satellite-clouds-1");
    const canvas = document.querySelector("canvas");
    globalThis.data = { sourceState: "LIVE", observedAt: "same-source", points: [{
      lon: 0, lat: 0, cloud: 100, radiation: 700, windSpeed: 10, windDirection: 270, pressure: 1000,
    }] };
    globalThis.renderer = createAtmosphereRenderer(canvas);
    globalThis.draw = () => {
      renderer.render(performance.now() + 2000, { rect: { width: 720, height: 360 }, originX: 276, originY: 0, scale: 2 }, true);
      const gl = canvas.getContext("webgl2"), pixels = new Uint8Array(720 * 360 * 4);
      gl.readPixels(0, 0, 720, 360, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let alpha = 0;
      for (let i = 3; i < pixels.length; i += 4) alpha += pixels[i];
      return { alpha, draws: +canvas.dataset.draws, builds: +canvas.dataset.fieldBuilds, error: gl.getError() };
    };
    canvas.addEventListener("webglcontextrestored", () => {
      globalThis.renderer = createAtmosphereRenderer(canvas);
      renderer.setData("cloud", data);
    });
    renderer.setData("wind", data);
  });
  await page.waitForFunction(() => document.querySelector("canvas").dataset.fieldState === "ready");
  assert.equal(requests, 0, "Do not load the satellite asset for other maps");
  await page.evaluate(() => renderer.setData("cloud", data));
  const before = await page.evaluate(() => draw());
  assert.equal(before.alpha, 0, "No procedural cloud placeholder during image loading");
  releaseImage();
  await page.waitForFunction(() => document.querySelector("canvas").dataset.cloudTextureState === "ready");
  const after = await page.evaluate(() => draw());
  assert(after.alpha > 0 && after.draws > before.draws, "Reduced motion must invalidate its static cache when the image loads");
  assert.equal(after.builds, before.builds, "Image loading must not rebuild source data");
  assert.equal(after.error, 0);
  const reused = await page.evaluate(() => {
    renderer.suspend(); renderer.setData("wind", data); renderer.setData("cloud", data);
    return draw();
  });
  assert.equal(reused.alpha, after.alpha);
  assert.equal(requests, 1, "Returning to map 30 reuses its texture");
  await page.evaluate(() => {
    globalThis.loss = document.querySelector("canvas").getContext("webgl2").getExtension("WEBGL_lose_context");
    if (!loss) throw new Error("Context-loss test extension unavailable");
    loss.loseContext();
  });
  await page.waitForFunction(() => document.querySelector("canvas").dataset.fieldState === "context-lost");
  await page.evaluate(() => loss.restoreContext());
  await page.waitForFunction(() => {
    const d = document.querySelector("canvas").dataset;
    return d.fieldState === "ready" && +d.fieldBuilds > 1 && d.cloudTextureState === "ready";
  });
  const restored = await page.evaluate(() => draw());
  assert.equal(restored.alpha, after.alpha, "Cloud texture must survive WebGL context recreation");
  assert.equal(restored.error, 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "passed", lazyLoad: true, delayedReveal: true, textureReuse: true, contextRestore: true }));
} finally { await browser.close(); }
