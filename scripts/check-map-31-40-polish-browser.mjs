import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import { readAnnualPart } from './lib/annual-snapshot.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const stage = process.env.GAIA_POLISH_STAGE || 'after';
const before = stage.startsWith('before');
const first = Number(process.env.GAIA_POLISH_FROM || 31), last = Number(process.env.GAIA_POLISH_TO || 40);
const output = path.resolve(`artifacts/map-${first}-${last}-polish-20261022/${stage}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', stage, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), tree: 'working tree', checks: [], errors: [], environment: 'Local installed Chrome; bundled data; external requests blocked; mobile/touch emulated.' };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const settle = () => page.waitForFunction(() => GaiaMarineCod.getState().dataState === 'ready' && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && !document.querySelector('#japan-layer').classList.contains('is-map-data-intro') && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
const measure = (point, definition) => definition.number === '31' ? point?.cod : point?.metrics?.[definition.measurementKey] || point?.measurement;
try {
  for (const width of (process.env.GAIA_POLISH_WIDTHS || '1920,768,390,320').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: width === 1920 ? 1080 : width === 320 ? 568 : 844 }, hasTouch: width < 900, isMobile: width < 900, reducedMotion: 'reduce' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**/*', route => route.abort());
    await context.addInitScript(() => {
      sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen');
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
    });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${width}: ${error.message}`));
    await page.goto(`${base}/world.html#world-${first}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaMarineCod?.getState().dataState === 'ready');
    await page.evaluate(() => { GaiaModeEntryGuide.close('map', { restoreFocus: false }); GaiaMapPlayback.stop(); });
    for (let number = first; number <= last; number++) {
      await page.evaluate(() => document.activeElement?.blur());
      await page.mouse.move(1, 1);
      await page.evaluate(async number => { await GaiaMarineCod.select(GaiaMarineCod.definitions.find(d => Number(d.number) === number).id); GaiaMapPlayback.stop(); }, number);
      await settle();
      const def = await page.evaluate(() => GaiaMarineCod.definition);
      const manifest = JSON.parse(fs.readFileSync(`data/${def.dataFile}`, 'utf8'));
      const period = readAnnualPart(manifest.periods.find(p => p.year === 2016).file);
      assert.equal(await page.evaluate(() => GaiaMarineCod.getState().year), 2016);
      assert.equal(await page.locator('#gaia-marine-cod-canvas').getAttribute('data-cod-point-count'), String(period.stations.length));
      const initial = await page.locator('.gaia-marine-cod-legend:not(.map-mobile-reading-copy)').textContent();
      await page.screenshot({ path: path.join(output, `${width}-${number}-overview.png`) });
      if (!before) {
        assert(initial.includes(def.readingBasis));
        assert(initial.includes(def.visualMap));
        assert.doesNotMatch(def.caption, /ではありません|示しません|混同しない/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
        if (number >= 41 && number <= 60 && width >= 900) {
          assert(await page.locator('.gaia-marine-cod-legend:not(.map-mobile-reading-copy) [data-metric-title]').evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight), 'Full metric title remains readable');
        }
        if (width < 900) {
          await page.locator('[data-mobile-sheet="reading"]').click();
          const sheet = page.locator('#map-mobile-sheet');
          await sheet.locator('.gaia-observation-reading').waitFor({ state: 'visible' });
          assert((await sheet.textContent()).includes(def.readingBasis));
          await sheet.locator('.gaia-observation-details > summary').click();
          assert(await sheet.locator('.gaia-observation-details').getAttribute('open') !== null);
          assert((await sheet.innerText()).includes(def.explanation));
          assert.equal(await sheet.evaluate(el => el.scrollWidth - el.clientWidth), 0);
          if (number >= 41 && number <= 60) assert(await sheet.locator('.gaia-metric-legend-current > span').evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight), 'Mobile metric title remains readable');
          await page.screenshot({ path: path.join(output, `${width}-${number}-reading.png`) });
          if (width === 320) {
            // The mobile snapshot deliberately strips live data attributes.
            const guide = sheet.locator('.gaia-observation-details > p:last-child');
            await guide.scrollIntoViewIfNeeded();
            const bounds = await guide.boundingBox();
            assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 568, 'The end of the reading remains reachable by scrolling');
            await page.screenshot({ path: path.join(output, `${width}-${number}-reading-scrolled.png`) });
          }
          await page.locator('[data-mobile-sheet-close]').click();
        }
        const selected = period.stations.find(p => measure(p, def)?.quality === 'measured' && (!def.secondaryLabel || (number === 31 ? p.cod75 : p.secondary)?.quality === 'measured'));
        await page.evaluate(id => GaiaMarineCod.selectStation(id, { focus: false }), selected.id);
        await page.waitForFunction(() => Boolean(GaiaMarineCod.getStatisticsDataset()));
        assert.equal(await page.locator('.gaia-marine-cod-legend:not(.map-mobile-reading-copy)').getAttribute('data-metric-value'), String(measure(selected, def).value));
        if (def.measurementKey === 'ph') {
          const range = await page.locator('[data-annual-range]').evaluate(el => ({ hidden: el.hidden, min: el.dataset.minimum, max: el.dataset.maximum, text: el.textContent }));
          assert(!range.hidden);
          assert.equal(range.min, String(selected.measurement.value));
          assert.equal(range.max, String(selected.secondary.value));
          assert(range.text.includes(selected.secondary.text));
        }
        await page.screenshot({ path: path.join(output, `${width}-${number}-selected.png`) });
        const history = await page.evaluate(() => GaiaMarineCod.getStatisticsDataset());
        const bucket = [...new TextEncoder().encode(selected.id)].reduce((n, b) => n + b, 0) % 64;
        const sourceHistory = readAnnualPart(manifest.historyShards[bucket].file)[selected.id];
        assert.deepEqual(history.rows.map(r => r.value), manifest.periods.map(p => measure(sourceHistory[p.year], def)?.value).filter(Number.isFinite));
        // Native slider keyboard interactions keep the selected source ID.
        const drawer = page.locator('#map-responsive-data');
        if (width < 900 && await drawer.isVisible() && await drawer.getAttribute('open') === null) await drawer.locator(':scope > summary').click();
        for (const [key, year] of [['Home', manifest.periods[0].year], ['End', manifest.periods.at(-1).year]]) {
          await page.locator('[data-cod-year]').focus(); await page.locator('[data-cod-year]').press(key);
          await page.waitForFunction(year => GaiaMarineCod.getState().year === year && GaiaMarineCod.getState().dataState === 'ready', year);
          assert.equal(await page.evaluate(() => GaiaMarineCod.getState().selectedId), selected.id);
          const record = readAnnualPart(manifest.periods.find(p => p.year === year).file).stations.find(p => p.id === selected.id);
          assert.equal(await page.locator('.gaia-marine-cod-legend:not(.map-mobile-reading-copy)').getAttribute('data-metric-value'), Number.isFinite(measure(record, def)?.value) ? String(measure(record, def).value) : '');
        }
        if (width < 900 && await drawer.isVisible() && await drawer.getAttribute('open') !== null) await drawer.locator(':scope > summary').click();
        report.checks.push({ width, number, points: period.stations.length, selected: selected.id, analysisRows: history.rows.length, initial });
      } else report.checks.push({ width, number, points: period.stations.length, initial });
    }
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    await context.close();
    console.log(`PASS ${width}: ${first}–${last} (${stage})`);
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
