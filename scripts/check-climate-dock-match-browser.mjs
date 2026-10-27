import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const interactions = process.argv.includes('--interactions');
const compact = process.argv.includes('--compact');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const out = path.resolve(`artifacts/climate-dock-match-20261022/${before ? 'before' : interactions ? 'interactions' : compact ? 'compact' : 'verified'}`);
fs.mkdirSync(out, { recursive: true });
const report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), tree: 'uncommitted changes',
  environment: 'Installed headless Chrome; local snapshots and CSP, external APIs blocked. Mobile emulation, not physical devices or production.', checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  const sizes = process.env.GAIA_QA_SIZES ? JSON.parse(process.env.GAIA_QA_SIZES) : compact ? [[320, 568], [844, 390]] : before || interactions ? [[1440, 900], [390, 844]]
    : [[1920, 1080], [1440, 900], [1280, 800], [1024, 768], [2560, 1440], [390, 844], [320, 568], [844, 390]];
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 900, isMobile: width <= 900 });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', r => r.abort());
    await context.addInitScript(() => localStorage.setItem('gaia-senseware-bgm-muted', 'true'));
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/world.html#world-71`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 100, null, { timeout: 60000 });
    await page.evaluate(() => GaiaModeEntryGuide.close('map', { restoreFocus: false }));
    await page.waitForFunction(() => !document.querySelector('#map-data-intro')?.hidden, null, { timeout: 60000 });
    let reference;
    for (const number of [71, 72, 73, 74, 75]) {
      if (number !== 71) await page.evaluate(n => GaiaMapCategories.buttons().find(b => Number(b.textContent.trim()) === n).click(), number);
      await page.waitForFunction(n => {
        const provider = n === 71 ? globalThis.GaiaFoodExhibits : globalThis.GaiaClimateHistory;
        const layer = document.querySelector('#japan-layer');
        return GaiaMapPlayback.getState().number === n && provider?.getState().dataState === 'ready'
          && !layer.classList.contains('is-map-title-transitioning') && !layer.classList.contains('is-map-data-intro');
      }, number, { timeout: 60000 });
      await page.evaluate(() => GaiaMapPlayback.stop());
      await page.waitForTimeout(500);
      const prefix = number === 71 ? 'food' : 'climate';
      const dock = page.locator(`.gaia-${prefix}-readout`);
      // Short screens intentionally put the provider inside a disclosure.
      // Compare its visible outer frame, never the layout of a closed <details>.
      const disclosure = page.locator('#map-responsive-data');
      if (await disclosure.isVisible() && await disclosure.getAttribute('open') === null) await disclosure.locator(':scope > summary').click();
      const measured = await dock.evaluate(el => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        const frame = el.closest('#map-responsive-data') || el;
        const props = ['backgroundImage', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderColor', 'borderBottomWidth', 'boxShadow', 'backdropFilter', 'padding'];
        return { box: r.toJSON(), frame: frame.getBoundingClientRect().toJSON(), style: Object.fromEntries(props.map(p => [p, s[p]])), overflow: el.scrollWidth - el.clientWidth,
          pageOverflow: document.documentElement.scrollWidth - innerWidth, text: el.innerText,
          controls: [...el.querySelectorAll('button,select,input')].filter(c => c.getClientRects().length && !c.closest('[hidden]')).map(c => {
            const rect = c.getBoundingClientRect();
            return { name: c.getAttribute('aria-label') || c.textContent.trim(), box: rect.toJSON(),
              inside: rect.x >= r.x - 1 && rect.right <= r.right + 1 && rect.top >= r.top - 1 && rect.bottom <= r.bottom + 1,
              hit: c.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
          }) };
      });
      if (number === 71) reference = measured;
      if (!before && number > 71) {
        for (const prop of ['backgroundImage', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderColor', 'borderBottomWidth', 'boxShadow', 'backdropFilter', 'padding'])
          assert.equal(measured.style[prop], reference.style[prop], `${width}/${number}: ${prop} matches 71`);
        for (const prop of width > 900 ? ['x', 'width', 'height', 'bottom'] : ['x', 'width', 'bottom'])
          assert(Math.abs(measured.frame[prop] - reference.frame[prop]) < 1, `${width}/${number}: ${prop} matches 71`);
        assert(measured.overflow < 2 && measured.pageOverflow < 2, `${width}/${number}: no horizontal overflow`);
        if (width > 900) assert(measured.controls.every(c => c.inside && c.hit), `${width}/${number}: controls stay inside and clickable ${JSON.stringify(measured.controls.filter(c => !c.inside || !c.hit))}`);
      }
      await page.screenshot({ path: path.join(out, `${width}-${number}.png`) });
      report.checks.push({ width, height, number, ...measured });
      if (interactions && number > 71) {
        if (number === 72) {
          await page.locator('[data-climate-basin]').selectOption('WP');
          assert.equal(await page.evaluate(() => GaiaClimateHistory.getState().basin), 'WP');
        }
        await page.locator('[data-climate-year]').fill('2017');
        await page.waitForFunction(() => GaiaClimateHistory.getState().year === 2017 && GaiaClimateHistory.getState().dataState === 'ready');
        await page.locator('[data-climate-point]').selectOption({ index: 1 });
        assert.equal(await page.evaluate(() => GaiaClimateHistory.getState().selectedId), await page.locator('[data-climate-point]').inputValue());
        await page.locator('[data-climate-overview]').click();
        if (number === 72) {
          await page.locator('[data-climate-regional]').click();
          await page.locator('.gaia-cyclone-regions').waitFor({ state: 'visible' });
          await page.locator('[data-region-close]').click();
          await page.locator('.gaia-cyclone-regions').waitFor({ state: 'hidden' });
        }
        const action = async kind => {
          if (width < 901) {
            await page.locator('[data-mobile-sheet="tools"]').tap();
            await page.getByRole('button', { name: kind === 'source' ? 'データの出典' : '統計分析', exact: true }).last().tap();
          } else await page.locator(`[data-climate-${kind}]`).click();
        };
        await action('source');
        await page.locator('#japan-data-panel').waitFor({ state: 'visible' });
        assert((await page.locator('#japan-data-panel').innerText()).includes('NOAA'));
        await page.locator('#japan-data-close').click();
        await page.locator('#japan-data-panel').waitFor({ state: 'hidden' });
        const dataset = await page.evaluate(() => GaiaClimateHistory.getStatisticsDataset());
        assert(dataset.rows.length > 1);
        await action('analysis');
        await page.waitForFunction(id => globalThis.GaiaStatisticsLab?.getState().analysisReady && GaiaStatisticsLab.getState().datasetId === id, dataset.id);
        assert.equal(Number(await page.locator('#gaia-statistics-kpis').getAttribute('data-used-rows')), dataset.rows.length);
        await page.locator('#gaia-statistics-close').click();
        await page.locator('#gaia-statistics-lab').waitFor({ state: 'hidden' });
        if (width > 900) {
          await page.locator('.gaia-climate-chapter [data-map-bank-toggle]').click();
          await page.waitForFunction(() => document.querySelector('.map-dock-bank-popover')?.dataset.anchor === 'bottom');
          await page.keyboard.press('Escape');
        }
        report.checks.push({ width, number, interactions: ['year', 'record selection', 'overview', ...(number === 72 ? ['basin', 'regional analysis'] : []), 'source open/close', 'statistics open/close', ...(width > 900 ? ['bottom exhibition menu'] : ['mobile tools sheet'])], statisticsRows: dataset.rows.length });
      }
      console.log(`${before ? 'BEFORE' : 'PASS'} ${width}/${number} ${JSON.stringify({ box: measured.box, style: measured.style })}`);
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? 'baseline captured' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
