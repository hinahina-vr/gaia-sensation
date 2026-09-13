import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const language=process.env.QA_LANGUAGE||'ja';
const out = 'artifacts/map-exhibit-links'+(language==='ja'?'':'-'+language);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
const hash = n => `#world-${String(n).padStart(2, '0')}`;
const waitExhibit = async (page, number) => {
  await page.waitForFunction(n => {
    const layer = document.querySelector('#japan-layer');
    return layer && !layer.hidden && layer.getAttribute('aria-hidden') === 'false'
      && Number(document.querySelector('#japan-mode-number')?.textContent) === n
      && globalThis.GaiaMapPlayback?.getState().number === n
      && globalThis.GaiaMapPlayback?.getState().ready
      && !layer.dataset.mapEntryExhibit;
  }, number, { timeout: 45000 }).catch(async error => {
    console.error('Exhibit readiness failed', number, await page.evaluate(() => ({
      hash: location.hash, number: document.querySelector('#japan-mode-number')?.textContent,
      layer: document.querySelector('#japan-layer')?.className,
      pending: document.querySelector('#japan-layer')?.dataset.mapEntryExhibit,
      playback: globalThis.GaiaMapPlayback?.getState(), cruise: globalThis.GaiaMapCruise?.getState(),
    })));
    await page.screenshot({ path: `${out}/failure-${number}.png` });
    throw error;
  });
  await page.waitForURL(`**${hash(number)}`, { timeout: 10000 });
};
try {
  for (const width of (process.env.QA_WIDTHS || '1440,390').split(',').map(Number)) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.addInitScript(lang=>{if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('gaia:language:v1',lang);},language);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Local saved datasets are real; external live services are not exercised.
    await page.route('https://**', route => route.abort());
    // Only the cruising clock can be accelerated in the final URL-follow test.
    await page.route('**/map-cruise.js*', route => route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync('src/exploration/map-cruise.js','utf8').replace('now = () => performance.now()', 'now = () => performance.now() + (globalThis.__cruiseTestAdvance || 0)') }));
    for (const number of (process.env.QA_DIRECT || '8,1,2,15,21,31,70,71').split(',').map(Number)) {
      await page.goto('about:blank');
      await page.goto(`${base}/${hash(number)}`);
      await waitExhibit(page, number);
      await page.waitForTimeout(2200);
      await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
      await page.waitForTimeout(1200);
      assert.equal(await page.locator('#gaia-opening').isVisible(), false);
      assert.equal(await page.locator('#gaia-mode-entry-guide').isVisible(), false);
      assert.equal(await page.locator('[data-feature-start]').isVisible(), false);
      await page.screenshot({ path: `${out}/${width}-direct-${number}.png` });
      results.push({ width, check: 'fresh direct URL, no entry overlays, data ready', number });
      console.log(results.at(-1));
    }
    await page.goto(`${base}/?exhibit=31&test=preserved#world-08`);
    await waitExhibit(page, 8);
    await page.reload();
    await waitExhibit(page, 8);
    assert.equal(new URL(page.url()).searchParams.get('test'), 'preserved');
    results.push({ width, check: 'hash wins over query, reload preserves selection and query' });

    const numbers = width === 1440 ? Array.from({ length: 71 }, (_, i) => i + 1) : [12, 17, 33, 69, 70, 71, 8];
    for (const number of numbers) {
      console.log('Hash selection', width, number);
      await page.evaluate(hash => { location.hash = hash; }, hash(number));
      await waitExhibit(page, number);
      // A following animation frame must not revert to the previous renderer.
      await page.waitForTimeout(150);
      assert.equal(new URL(page.url()).hash, hash(number));
    }
    results.push({ width, check: 'same-tab hash navigation', numbers });
    console.log({ width, check: 'same-tab hash navigation', count: numbers.length });

    await page.evaluate(() => { location.hash = '#world-08'; });
    await waitExhibit(page, 8);
    await page.evaluate(() => { location.hash = '#world-13'; });
    await waitExhibit(page, 13);
    await page.goBack();
    await waitExhibit(page, 8);
    await page.goForward();
    await waitExhibit(page, 13);
    results.push({ width, check: 'browser Back and Forward select matching exhibit' });

    await page.waitForTimeout(2000);
    const historyLength = await page.evaluate(() => history.length);
    if (width === 1440) await page.locator('[data-map-stable-step="1"]').click();
    else await page.evaluate(() => GaiaMapCategories.buttons().find(button => Number(button.textContent) === 14).click());
    await waitExhibit(page, 14);
    assert.equal(await page.evaluate(() => history.length), historyLength);
    results.push({ width, check: 'exhibit UI updates share URL without growing history' });

    await page.evaluate(() => { location.hash = '#world-71'; });
    await waitExhibit(page, 71);
    await page.waitForTimeout(2200);
    await page.evaluate(() => GaiaMapCruise.start());
    await page.waitForFunction(() => ['slider', 'poi'].includes(GaiaMapCruise.getState().phase));
    const state = await page.evaluate(() => GaiaMapCruise.getState());
    const advance = async ms => {
      await page.evaluate(ms => { globalThis.__cruiseTestAdvance = (globalThis.__cruiseTestAdvance || 0) + ms; }, ms);
      await page.waitForTimeout(150);
    };
    if (state.phase === 'slider') { await advance(state.duration + 10); await advance(3010); }
    else for (let i = 0; i < 5; i += 1) await advance(5010);
    await waitExhibit(page, 1);
    assert.equal(await page.evaluate(() => GaiaMapCruise.getState().active), true);
    await page.evaluate(() => { location.hash = '#world-08'; });
    await waitExhibit(page, 8);
    assert.equal(await page.evaluate(() => GaiaMapCruise.getState().active), false);
    results.push({ width, check: 'cruise 71 to 01 updates URL; incoming URL stops cruise' });

    for (const url of ['?exhibit=08#world', '#earth', '#japan', '#world-99', '#world-00']) {
      await page.goto('about:blank');
      await page.goto(`${base}/${url}`);
      const number = url.includes('exhibit=08') ? 8 : 1;
      await waitExhibit(page, number);
      await page.locator('[data-feature-start]').click();
      await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
      results.push({ width, check: 'legacy link / invalid numeric fallback', url, number });
    }
    await page.goto(`${base}/?exhibit=08#data`);
    await page.waitForFunction(() => document.querySelector('#japan-layer')?.classList.contains('japan-data-open'));
    assert.equal(new URL(page.url()).hash, '#data');
    await page.goto(`${base}/#world-8`);
    await waitExhibit(page, 8);
    await page.evaluate(() => { location.hash = '#top'; });
    await page.waitForFunction(() => document.querySelector('#japan-layer')?.getAttribute('aria-hidden') === 'true');
    await page.evaluate(() => { location.hash = '#world-12'; });
    await waitExhibit(page, 12);
    results.push({ width, check: 'data panel route retained; unpadded link normalized; top to numbered route' });
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally {
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
