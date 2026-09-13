import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { FOOD_EXHIBITS } from '../src/exploration/food-catalog.js';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve('artifacts/fao-food-2026-09-09/attribution'); fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', checks: [], sha256: {} };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const width of [1440, 390]) {
    const c = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: width === 390 });
    await enforceBrowserSecurity(c, base); await c.route('https://**', r => r.abort());
    await c.addInitScript(() => sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'));
    const p = await c.newPage(); await p.goto(`${base}/?exhibit=70#world`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaFoodExhibits && globalThis.GaiaMapCategories?.buttons().length === 71 && GaiaFoodExhibits.getState().dataState === 'ready'); await p.evaluate(() => GaiaMapDemo.stop());
    for (const def of FOOD_EXHIBITS) {
      const bytes = fs.readFileSync(`data/${def.dataFile}`), data = JSON.parse(bytes);
      report.sha256[def.dataFile] = createHash('sha256').update(bytes).digest('hex');
      assert(data.citation.includes('09 September 2026'));
      await p.evaluate(id => GaiaFoodExhibits.select(id), def.id);
      await p.waitForFunction(() => GaiaFoodExhibits.getState().dataState === 'ready' && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
      if (width === 390) { await p.locator('[data-mobile-sheet="tools"]').click(); await p.getByRole('button', { name: 'データの出典', exact: true }).last().click(); }
      else await p.locator('[data-food-source]').click();
      await p.locator('#japan-data-panel').waitFor({ state: 'visible' });
      await p.waitForFunction(() => { const el = document.querySelector('#japan-data-panel'), r = el.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1 && el.getAnimations().every(a => a.playState !== 'running'); });
      assert((await p.locator('#japan-data-panel').innerText()).includes(data.citation));
      for (const selector of ['.gaia-food-legend', '.gaia-food-readout']) assert.equal(await p.locator(selector).evaluate(el => getComputedStyle(el).visibility), 'hidden', 'Food overlays do not obscure the source panel');
      const sourceLink = p.locator('#japan-data-panel a').first();
      assert(await sourceLink.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), 'Original-source link is actually reachable');
      await p.screenshot({ path: path.join(output, `${width}-${def.number}-citation.png`) });
      await p.locator('#japan-data-close').click();
      assert.equal(await p.locator('.gaia-food-readout').evaluate(el => getComputedStyle(el).visibility), 'visible', 'Closing the source panel restores food controls');
      report.checks.push(`${width}/${def.number}: final JSON citation is displayed in the actual source panel`);
    }
    assert.deepEqual(await p.evaluate(() => __securityViolations), []); await c.close();
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack; throw error;
} finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify(report)); }
