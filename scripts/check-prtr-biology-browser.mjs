import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { PRTR_BIOLOGY_EXHIBITS, recordAppearance } from '../src/exploration/prtr-biology-catalog.js';
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4487';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/prtr-biology-2026-09-09/browser');
fs.mkdirSync(output, { recursive: true });
const data = new Map([...new Set(PRTR_BIOLOGY_EXHIBITS.map(d => d.dataFile))].map(file => [file, JSON.parse(fs.readFileSync(`data/${file}`))]));
const files = ['src/exploration/marine-cod-exhibit.js', 'src/exploration/prtr-biology-catalog.js', 'src/exploration/prtr-biology-drawing.js', 'marine-cod-exhibit.css', 'map-exhibit-categories.js', 'statistics-discovery.js', ...[...data.keys()].map(f => `data/${f}`)];
const report = { status: 'running', base, environment: `Installed Chrome, ${base.startsWith('https:') ? 'deployed HTTPS site' : 'local site'} with original-source snapshots. Desktop and touch emulation, not physical phones. Same-origin responses are not mocked; unrelated external origins blocked.`,
  sha256: Object.fromEntries(files.map(f => [f, createHash('sha256').update(fs.readFileSync(f)).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const idle = async () => {
  await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && document.querySelector('#japan-overlay').dataset.viewAnimation === 'idle' && document.querySelector('#gaia-marine-cod-canvas').dataset.codArrivalState === 'complete');
};
const ready = async def => {
  await page.waitForFunction(id => GaiaMarineCod.getState().id === id && GaiaMarineCod.getState().dataState === 'ready', def.id);
  await idle();
};
const select = async def => { await page.evaluate(n => GaiaMapCategories.buttons().find(b => b.textContent.trim() === n).click(), def.number); await ready(def); };
try {
  for (const [width, height] of (process.env.RECORD_VIEWPORTS?.split(',').map(s => s.split('x').map(Number)) || [[1440, 900], [390, 844], [320, 568], [844, 390]])) {
    const mobile = width <= 900;
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference' });
    await context.route('https://**', r => new URL(r.request().url()).origin === new URL(base).origin ? r.continue() : r.abort());
    await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
    page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/?exhibit=65#world`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === globalThis.GaiaMapCategories?.exhibitCount && globalThis.GaiaMapDemo);
    await page.evaluate(() => GaiaMapDemo.stop());
    await ready(PRTR_BIOLOGY_EXHIBITS[0]);
    assert.equal(await page.locator('#japan-mode-number').textContent(), '65');
    for (const def of PRTR_BIOLOGY_EXHIBITS.filter(d => !process.env.RECORD_NUMBERS || process.env.RECORD_NUMBERS.split(',').includes(d.number))) {
      await select(def);
      const source = data.get(def.dataFile), latest = source.periods.at(-1);
      const read = s => s.metrics?.[def.measurementKey] || s.measurement;
      const row = [...latest.stations].filter(s => read(s).value > 0).sort((a, b) => read(b).value - read(a).value)[0];
      assert.equal(await page.locator('#japan-mode-title').textContent(), def.shortTitle);
      assert.equal(await page.locator('#gaia-marine-cod-canvas').getAttribute('data-record-animation'), def.animation);
      await page.screenshot({ path: path.join(output, `${width}-${def.number}-overview.png`) });
      await page.locator('[data-cod-prefecture]').selectOption(row.prefCode);
      await page.locator('[data-cod-station]').selectOption(row.id);
      await idle();
      assert.equal(await page.locator('[data-cod-value]').textContent(), `${read(row).text} ${def.unit}`);
      assert.equal(await page.locator('[data-cod-value]').evaluate(el => getComputedStyle(el).color), recordAppearance(def, read(row).value).color);
      const a = await page.locator('#gaia-marine-cod-canvas').evaluate(el => el.toDataURL());
      await page.waitForTimeout(420);
      const b = await page.locator('#gaia-marine-cod-canvas').evaluate(el => el.toDataURL());
      assert.notEqual(a, b, 'Actual canvas animation changes pixels');
      assert(Number(await page.locator('#gaia-marine-cod-canvas').getAttribute('data-record-detail-count')) > 0);
      await page.screenshot({ path: path.join(output, `${width}-${def.number}-selected.png`) });
      const position = await page.evaluate(row => {
        const p = document.querySelector('#japan-map').getBoundingClientRect(), d = document.querySelector('#japan-overlay').dataset;
        const scale = (p.width >= 901 ? p.width / 360 : Math.max(p.width / 360, p.height / 180)) * Number(d.earthZoom);
        return { x: p.left + (p.width - 360 * scale) / 2 + Number(d.earthOffsetX) + ((row.lon - 150 + 540) % 360) * scale,
          y: p.top + (p.height - 180 * scale) / 2 + Number(d.earthOffsetY) + (90 - row.lat) * scale };
      }, row);
      assert.equal(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.id, position), 'japan-map');
      if (mobile) await page.touchscreen.tap(position.x, position.y); else await page.mouse.click(position.x, position.y);
      const hitId = await page.evaluate(() => GaiaMarineCod.getState().selectedId);
      assert(latest.stations.some(s => s.id === hitId), 'Map hit selects an actual source record');
      await page.locator('[data-cod-station]').selectOption(row.id); await idle();
      await page.locator('[data-cod-records]').click();
      const dialog = page.locator('#gaia-record-detail'); await dialog.waitFor({ state: 'visible' });
      const names = def.category === 'biology' ? row.taxa.map(c => row.taxonNames[c].join(' / ')) : row.substances.map(r => source.substanceNames[r[0]]);
      assert.equal(await page.locator('[data-record-list] li').count(), names.length);
      assert((await dialog.innerText()).includes(names[0]));
      const firstCode = def.category === 'biology' ? row.taxa[0] : row.substances[0][0];
      await page.locator('[data-record-search]').fill(firstCode);
      assert(await page.locator('[data-record-list] li').count() >= 1);
      await page.locator('[data-record-search]').fill('存在しない検索文字列QA');
      assert.equal(await page.locator('[data-record-list] li').count(), 0);
      await page.locator('[data-record-search]').fill('');
      if (def.measurementKey === 'transfer') assert.match(await dialog.innerText(), /下水道への移動/);
      await page.screenshot({ path: path.join(output, `${width}-${def.number}-records.png`) });
      await page.locator('[data-record-close]').click();
      if (def.category === 'biology') {
        for (const p of source.periods) {
          await page.locator('[data-cod-year]').focus(); await page.keyboard.press('Home');
          for (let y = 2019; y < p.year; y++) await page.keyboard.press('ArrowRight');
          const target = p.stations.find(s => s.id === row.id);
          assert.equal(await page.locator('[data-cod-value]').textContent(), target ? `${target.measurement.text} ${def.unit}` : '—');
          assert.equal(await page.evaluate(() => GaiaMarineCod.getState().selectedId), row.id);
        }
      } else { assert(await page.locator('[data-cod-year]').isHidden()); assert(await page.locator('[data-cod-play]').isHidden()); }
      for (const s of ['[data-cod-prefecture]', '[data-cod-station]', '[data-cod-records]', '[data-cod-overview]']) {
        const r = await page.locator(s).evaluate(el => { const r = el.getBoundingClientRect(); return { ...r.toJSON(), reachable: el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) }; });
        assert(r.reachable && r.left >= 0 && r.right <= width + 1 && r.top >= 0 && r.bottom <= height + 1, `${width} ${def.number} reachable ${s}: ${JSON.stringify(r)}`);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      if (width === 1440 || width === 390) {
        const action = async type => {
          if (mobile) { await page.locator('[data-mobile-sheet="tools"]').click(); await page.getByRole('button', { name: type === 'source' ? 'データの出典' : '統計分析', exact: true }).last().click(); }
          else await page.locator(`[data-cod-${type}]`).click();
        };
        await action('source'); await page.locator('#japan-data-panel').waitFor({ state: 'visible' });
        assert((await page.locator('#japan-data-panel').innerText()).includes(def.metricLabel));
        await page.locator('#japan-data-close').click();
        await action('analysis');
        await page.waitForFunction(id => globalThis.GaiaStatisticsLab?.getState().analysisReady && GaiaStatisticsLab.getState().datasetId.startsWith(id), def.id);
        assert.equal(await page.locator('.gaia-marine-cod-readout').evaluate(el => getComputedStyle(el).visibility), 'hidden', 'Dock does not show through the analysis surface');
        assert.equal(await page.locator('.gaia-marine-cod-legend').evaluate(el => getComputedStyle(el).visibility), 'hidden', 'Legend does not show through the analysis surface');
        assert((await page.locator('#gaia-statistics-lab').innerText()).includes(def.category === 'biology' ? '確認記録' : '物質ごと'));
        await page.waitForFunction(() => {
          const lab = document.querySelector('#gaia-statistics-lab'), shell = lab.querySelector('.gaia-statistics-shell');
          return Number(getComputedStyle(lab).opacity) > .99 && [...lab.getAnimations(), ...shell.getAnimations()].every(a => a.playState !== 'running');
        });
        await page.screenshot({ path: path.join(output, `${width}-${def.number}-analysis.png`) });
        if (['65', '68'].includes(def.number)) {
          const dataset = await page.evaluate(() => GaiaMarineCod.getStatisticsDataset());
          const before = await page.evaluate(() => GaiaStatisticsLab.getState().savedViewCount);
          await page.locator('#gaia-statistics-menu-toggle').click();
          const options = page.locator('.gaia-statistics-data-options');
          if (await options.getAttribute('open') === null) await options.locator('summary').click();
          await page.locator('#gaia-statistics-view-save').click();
          assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().savedViewCount), before + 1);
          assert((await page.evaluate(() => JSON.parse(localStorage.getItem('gaia-statistics-saved-views:v1')))).some(v => v.datasetId === dataset.id));
          const saved = await page.locator('#gaia-statistics-saved-view').inputValue();
          await page.locator('#gaia-statistics-record-filter').fill('no-match-qa');
          await page.locator('#gaia-statistics-saved-view').selectOption(saved);
          await page.locator('#gaia-statistics-view-apply').click();
          await page.waitForTimeout(150);
          assert.equal(await page.locator('#gaia-statistics-record-filter').inputValue(), '');
          await page.locator('#gaia-statistics-menu-close').click();
        }
        await page.locator('#gaia-statistics-close').click();
      }
      if (def.number === '68' && [1440, 390].includes(width)) {
        const original = source.periods.find(p => p.year === 2020).stations.find(s => s.id === '85:9-85-511-001-001-1:雲雲三4');
        await page.evaluate(() => GaiaMarineCod.setYear(2020));
        await page.locator('[data-cod-prefecture]').selectOption(original.prefCode);
        await page.locator('[data-cod-station]').selectOption(original.id); await idle();
        await page.locator('[data-cod-records]').click();
        await page.locator('[data-record-search]').fill('50565');
        assert.equal(await page.locator('[data-record-list] li').count(), 1);
        assert.equal(await page.locator('[data-record-list] li strong').textContent(), original.taxonNames['50565'].join(' / '));
        assert((await page.locator('[data-record-list]').innerText()).includes('マルハナノミ科'), 'Preserves source name even when other surveys use a different name for this code');
        await page.screenshot({ path: path.join(output, `${width}-68-source-name-regression.png`) });
        await page.locator('[data-record-close]').click();
      }
      report.checks.push({ width, height, number: def.number, count: latest.stations.length, chosen: row.id, names: names.length, status: 'pass' });
      console.log(`PASS ${width} × ${height} / ${def.number} / points, animation, actual source names, navigation and ${width === 1440 || width === 390 ? 'analysis' : 'layout'}`);
    }
    // The biology section now continues into the independently rendered food section.
    await select(PRTR_BIOLOGY_EXHIBITS[4]);
    await page.locator(mobile ? '[data-mobile-exhibit-step="1"]' : '[data-cod-step="1"]').click();
    await page.waitForFunction(() => document.querySelector('#japan-mode-number').textContent.trim() === '70');
    await select(PRTR_BIOLOGY_EXHIBITS[4]);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'pass';
} catch (error) {
  report.status = 'fail'; report.failure = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, output }));
