import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const baseUrl = process.argv[2] || "http://127.0.0.1:4173";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 360 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/atmosphere-check", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><head><link rel='icon' href='data:,'></head><body></body></html>" }));
  await page.goto(`${baseUrl}/atmosphere-check`);
  await page.evaluate(async () => {
    const { createAtmosphereRenderer } = await import("/src/exploration/atmosphere-webgl.js?v=gaia-satellite-clouds-1");
    const canvas = document.body.appendChild(document.createElement("canvas"));
    canvas.id = "test-field";
    globalThis.fieldRenderer = createAtmosphereRenderer(canvas);
    if (!fieldRenderer) throw new Error("WebGL2 unavailable in test browser");
  });
  const sample = async (kind, cloud, aerosol = 0.2, stamp = `${kind}-${cloud}-${aerosol}`) => {
    await page.evaluate(({ kind, cloud, aerosol, stamp }) => {
      fieldRenderer.setData(kind, { observedAt: stamp, sourceState: "LIVE", points: [{
        lon: 0, lat: 0, cloud, radiation: 700, windSpeed: 10, windDirection: 270, pressure: 1000, pm25: 30, aerosol,
      }] });
    }, { kind, cloud, aerosol, stamp });
    await page.waitForFunction(kind => {
      const d = document.querySelector("canvas").dataset;
      return d.fieldState === "ready" && (kind !== "wind" || d.windStyle === "luminous-drifting-veil")
        && (kind !== "cloud" || d.cloudTextureState === "ready");
    }, kind, { timeout: 30000 });
    return page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const view = { rect: { width: 720, height: 360 }, originX: 276, originY: 0, scale: 2 };
      const gl = canvas.getContext("webgl2");
      const pixels = new Uint8Array(720 * 360 * 4);
      const read = (t, reduced = true) => {
        fieldRenderer.render(performance.now() + t, view, reduced);
        gl.readPixels(0, 0, 720, 360, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let sum = 0, covered = 0, hash = 0, maxAlpha = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          sum += pixels[i]; if (pixels[i] > 30) covered++;
          maxAlpha = Math.max(maxAlpha, pixels[i]);
          hash = (Math.imul(hash, 31) + pixels[i]) | 0;
        }
        return { alpha: sum / (720 * 360 * 255), maxAlpha: maxAlpha / 255, covered: covered / (720 * 360), hash };
      };
      const first = read(2000), second = read(5000);
      const moving = read(2000, false), later = read(8000, false);
      return { ...first, reducedMotionStable: first.hash === second.hash, moving: moving.hash !== later.hash,
        glError: gl.getError(), builds: +canvas.dataset.fieldBuilds };
    });
  };
  const clear = await sample("cloud", 0);
  const partly = await sample("cloud", 50);
  const overcast = await sample("cloud", 100);
  assert.equal(clear.alpha, 0, "Clear sky must have zero cloud opacity");
  assert.ok(partly.alpha > 0.05 && partly.alpha < overcast.alpha, "Cloud cover must increase visible thickness/coverage");
  assert.ok(overcast.covered > partly.covered && overcast.covered < .8, "Archived cloud shapes keep their clear gaps, not a uniform white blanket");
  assert.ok(overcast.maxAlpha <= .465 && overcast.alpha < .2, "Even 100% cloud cover keeps the basemap visible");
  assert.ok(partly.moving && overcast.moving, "The reference layer drifts gently in normal motion mode");
  const clean = await sample("air", 0, 0);
  const hazy = await sample("air", 0, 1);
  assert.equal(clean.alpha, 0, "Zero AOD means no haze");
  assert.ok(hazy.covered > 0.9 && hazy.alpha > 0.3, "AOD makes a continuous scattering layer");
  // Wind and cloud now share the same source field, with no second weave build.
  const shared = await sample("cloud", 50, 0.2, "shared-atmosphere");
  const wind = await sample("wind", 50, 0.2, "shared-atmosphere");
  assert.ok(wind.covered > 0.1, "Wind is a continuous field");
  assert.ok(wind.maxAlpha <= .365, "The light veil cannot obscure the basemap");
  assert.ok(wind.moving, "Normal motion must visibly drift");
  assert.equal(wind.builds, shared.builds, "Wind uses the cached source vectors directly");
  const warm = await sample("cloud", 50, 0.2, "shared-atmosphere");
  assert.equal(warm.builds, wind.builds, "Mode changes reuse the field, no per-frame rebuild");
  for (const result of [clear, partly, overcast, clean, hazy, wind, warm]) {
    assert.equal(result.glError, 0);
    assert.equal(result.reducedMotionStable, true, "Reduced motion freezes all procedural motion");
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "passed", clear, partly, overcast, clean, hazy, wind }, null, 2));
} finally { await browser.close(); }
