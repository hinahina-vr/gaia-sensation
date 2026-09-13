import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PRTR_BIOLOGY_EXHIBITS } from '../src/exploration/prtr-biology-catalog.js';
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4487';
const output = path.resolve('artifacts/prtr-biology-2026-09-09/edge');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', conditions: 'Local Chrome with real bundled source data; explicit synthetic 503/delay routes. Reduced-motion setting and emulated mobile, not physical phone.', checks: [], errors: [], timings: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const create = async (width = 1440, reduced = false) => {
  const context = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 }, isMobile: width < 900, hasTouch: width < 900, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await context.route('https://**', r => r.abort());
  await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
  return context;
};
const select = async (page, n) => page.evaluate(n => GaiaMapCategories.buttons().find(b => Number(b.textContent) === n).click(), n);
const ready = async (page, n) => page.waitForFunction(n => Number(globalThis.GaiaMarineCod?.definition.number) === n && GaiaMarineCod.getState().dataState === 'ready'
  && document.querySelector('#gaia-marine-cod-canvas').dataset.codArrivalState === 'complete' && document.querySelector('#japan-overlay').dataset.viewAnimation === 'idle'
  && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'), n);
const boot = async (context, n = 65) => {
  const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(`${base}/?exhibit=${n}#world`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaMapCategories?.buttons().length === 69);
  await page.evaluate(() => GaiaMapDemo.stop());
  return page;
};
try {
  for (const width of [1440, 390]) {
    const ctx = await create(width, true), requests = [];
    ctx.on('request', r => { if (r.url().includes('japan-prtr-2022.json')) requests.push(r.url()); });
    const page = await boot(ctx);
    for (const def of PRTR_BIOLOGY_EXHIBITS) {
      await select(page, Number(def.number)); await ready(page, Number(def.number));
      const a = await page.locator('#gaia-marine-cod-canvas').evaluate(c => c.toDataURL());
      await page.waitForTimeout(260);
      const b = await page.locator('#gaia-marine-cod-canvas').evaluate(c => c.toDataURL());
      assert.equal(a, b, `${width} ${def.number}: reduced-motion pixels stay still`);
      report.checks.push(`${width} / ${def.number} reduced-motion freeze`);
    }
    assert.equal(requests.length, 1, 'Three PRTR channels share one data request');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await select(page, 65); await ready(page, 65);
    const timing = await page.evaluate(async () => {
      const c = document.querySelector('#gaia-marine-cod-canvas'), samples = []; let last = c.dataset.codFrame;
      const start = performance.now();
      while (performance.now() - start < 2200) {
        await new Promise(requestAnimationFrame);
        if (c.dataset.codFrame !== last) { last = c.dataset.codFrame; samples.push(Number(c.dataset.recordDrawMs)); }
      }
      samples.sort((a, b) => a - b);
      return { samples: samples.length, meanMs: samples.reduce((a, b) => a + b, 0) / samples.length, p95Ms: samples[Math.floor(samples.length * .95)], maxMs: samples.at(-1), pointCount: Number(c.dataset.codPointCount) };
    });
    report.timings.push({ width, ...timing });
    assert(timing.samples > 10 && timing.pointCount > 30000);
    await ctx.close();
  }
  {
    const ctx = await create(), page = await boot(ctx, 69);
    await ready(page, 69);
    await ctx.route('**/data/japan-prtr-2022.json*', r => r.fulfill({ status: 503, body: 'QA simulated transport failure' }));
    await select(page, 65);
    await page.waitForFunction(() => GaiaMarineCod.getState().dataState === 'error');
    assert.match(await page.locator('[data-cod-status]').innerText(), /読込に失敗/);
    assert(await page.locator('[data-cod-station]').isDisabled());
    await ctx.unroute('**/data/japan-prtr-2022.json*');
    await select(page, 65); await ready(page, 65);
    report.checks.push('503 is not a zero-filled map; selecting the exhibit retries successfully');
    await ctx.close();
  }
  {
    const ctx = await create(), page = await boot(ctx, 69);
    await ready(page, 69);
    await ctx.route('**/data/japan-prtr-2022.json*', async r => { await new Promise(done => setTimeout(done, 3000)); await r.continue(); });
    await select(page, 65);
    await page.waitForFunction(() => GaiaMarineCod.getState().dataState === 'loading');
    await select(page, 68); await ready(page, 68);
    await page.waitForTimeout(3300);
    assert.equal(await page.evaluate(() => GaiaMarineCod.getState().id), 'japan-river-benthos');
    await select(page, 66); await ready(page, 66);
    assert.equal(await page.locator('#gaia-marine-cod-canvas').getAttribute('data-record-animation'), 'water-flow');
    report.checks.push('Late PRTR response cannot overwrite biological selection; cached alternate channel recovers');
    await ctx.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'pass';
} catch (e) { report.status = 'fail'; report.failure = e.stack; throw e; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report));
