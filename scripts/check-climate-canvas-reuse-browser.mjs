import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL, output = path.resolve('artifacts/polish-20261015/canvas');
fs.mkdirSync(output, { recursive: true });
// Previous production commit contains the identical pre-optimization renderer.
const baselineSha = '03394773194412c4cc21673ce3b91b407d837fa2';
const original = execFileSync('git', ['show', `${baselineSha}:src/exploration/climate-history-exhibits.js`], { encoding: 'utf8' });
const report = { baselineSha, scope: 'Actual local Chrome canvas pixels and dimension assignments; not FPS or physical device memory.', cases: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const width of [1440, 390]) {
    for (const number of [72, 73]) {
      const result = { width, number }; report.cases.push(result);
      // 73 now intentionally has data-scaled heat glyphs. Keep the original
      // pixel comparison for unchanged 72, and verify 73's current frame is
      // deterministic when redrawn without a resize.
      for (const version of number===73?['after']:['before', 'after']) {
        const context = await browser.newContext({ viewport: { width, height: width < 900 ? 844 : 900 }, deviceScaleFactor: 1 });
        await enforceBrowserSecurity(context, base); await context.route('https://**', r => r.abort());
        if (version === 'before') await context.route('**/climate-history-exhibits.js?*', r => r.fulfill({ body: original, contentType: 'text/javascript' }));
        await context.addInitScript(() => {
          globalThis.__canvasAssignments = 0;
          for (const key of ['width', 'height']) {
            const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, key);
            Object.defineProperty(HTMLCanvasElement.prototype, key, { ...descriptor, set(value) {
              if (this.id === 'gaia-climate-canvas') __canvasAssignments++;
              descriptor.set.call(this, value);
            } });
          }
        });
        const page = await context.newPage(); page.setDefaultTimeout(60000);
        page.on('pageerror', e => report.errors.push(e.message));
        await page.goto(`${base}/world/#world-${number}`);
        await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === 'true' && GaiaClimateHistory?.getState().dataState === 'ready');
        await page.evaluate(() => GaiaMapPlayback.stop());
        await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro') && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
        // Both versions use the same deterministic final projection, then redraw
        // four records without resizing. Compare the complete transparent layer.
        await page.evaluate(() => GaiaClimateHistory.focusAll());
        await page.waitForTimeout(1000);
        if(number===73)await page.waitForFunction(()=>document.querySelector('#gaia-climate-canvas').dataset.climateArrival==='complete');
        const hashes = [], count = await page.evaluate(() => __canvasAssignments);
        const ids = await page.locator('[data-climate-point] option').evaluateAll(nodes => nodes.slice(0, 4).map(el => el.value));
        for (const id of ids) {
          const oldCount = await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count');
          await page.evaluate(id => GaiaClimateHistory.selectPoint(id, { focus: false }), id);
          await page.waitForFunction(oldCount => document.querySelector('#gaia-climate-canvas').dataset.climatePaintCount !== oldCount, oldCount);
          const image = await page.locator('#gaia-climate-canvas').evaluate(el => el.toDataURL());
          hashes.push(createHash('sha256').update(image).digest('hex'));
          if(number===73){
            const painted=await page.locator('#gaia-climate-canvas').getAttribute('data-climate-paint-count');
            await page.evaluate(id=>GaiaClimateHistory.selectPoint(id,{focus:false}),id);
            await page.waitForFunction(n=>document.querySelector('#gaia-climate-canvas').dataset.climatePaintCount!==n,painted);
            assert.equal(await page.locator('#gaia-climate-canvas').evaluate(el=>el.toDataURL()),image,'Unchanged heat record redraw is pixel-stable');
          }
        }
        result[version] = { hashes, assignments: await page.evaluate(() => __canvasAssignments) - count };
        await context.close();
      }
      if(result.before){assert.deepEqual(result.after.hashes,result.before.hashes,'Canvas pixels must be identical');assert(result.before.assignments>=8);}
      assert.equal(result.after.assignments,0);
      console.log(`Canvas reuse ${width}/${number}: stable pixels, 0 resize assignments`);
    }
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
