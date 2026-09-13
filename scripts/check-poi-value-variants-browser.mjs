import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { FOOD_EXHIBITS, foodValue, foodFormat } from '../src/exploration/food-catalog.js';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';
import { formatCoordinatesJa } from '../src/shared/coordinates.js';
const base = 'http://127.0.0.1:4492', out = path.resolve('artifacts/poi-value-emphasis-20260912/variants');
fs.mkdirSync(out, { recursive: true });
const files = ['app.js', 'map-ui-grid-polish.css', 'src/shared/coordinates.js', ...['poi-preview-readings', 'marine-cod-exhibit', 'food-exhibits', 'firms-exhibit', 'planet-signals-exhibit'].map(f => `src/exploration/${f}.js`)];
const report = { checks: [], errors: [], scope: 'Local Chrome, bundled food observations and explicitly synthetic layout/cache fixtures. No production or physical-phone claim.', sha256: Object.fromEntries(files.map(f => [f, createHash('sha256').update(fs.readFileSync(f)).digest('hex')])) };
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let page;
const idle = () => page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning') && document.querySelector('#japan-overlay').dataset.viewAnimation !== 'running');
const focus = async point => {
  const xy = await page.evaluate(p => {
    GaiaMapObservationAdapter.closePoi(); GaiaMapObservationAdapter.focusEarthLocation({ lon: p.lon, lat: p.lat, zoom: 4, targetX: .5, targetY: .42, durationMs: 0 });
    const r = GaiaMapObservationAdapter.getViewportRect(), d = document.querySelector('#japan-overlay').dataset, s = r.width / 360 * Number(d.earthZoom);
    return { x: r.left + (r.width - 360 * s) / 2 + Number(d.earthOffsetX) + ((p.lon - 150 + 540) % 360) * s, y: r.top + (r.height - 180 * s) / 2 + Number(d.earthOffsetY) + (90 - p.lat) * s };
  }, point);
  await page.mouse.move(1, 1); await page.mouse.move(xy.x, xy.y);
  await page.waitForFunction(() => document.querySelector('#japan-poi-preview').getAttribute('aria-hidden') === 'false');
  await page.locator('#japan-poi-preview').evaluate(n => Promise.all(n.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))));
  return xy;
};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await enforceBrowserSecurity(context, base); await context.route('https://**', r => r.abort());
  const planet = { lat: 12.34, lon: 130.12, label: 'fixture', windSpeed: 7.2, windDirection: 124, pressure: 1014, cloud: 36, radiation: 512, pm25: 13.4, aerosol: .27 };
  await context.addInitScript(p => { for (const loader of ['atmosphere', 'air']) sessionStorage.setItem(`gaia-planet-signals-v3:${loader}`, JSON.stringify({ cachedAt: Date.now(), data: { observedAt: '2026-09-05T05:30:00Z', points: [p] } })); }, planet);
  page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(base + '/?exhibit=70#world', { waitUntil: 'domcontentloaded' }); await page.locator('[data-feature-start]').click();
  await page.waitForFunction(() => globalThis.GaiaFoodExhibits?.getState().dataState === 'ready'); await page.evaluate(() => GaiaMapDemo.stop());
  for (const def of FOOD_EXHIBITS) {
    await page.evaluate(n => GaiaMapCategories.buttons().find(b => b.textContent.trim() === n).click(), def.number);
    await page.waitForFunction(() => GaiaFoodExhibits.getState().dataState === 'ready'); await idle();
    const source = JSON.parse(fs.readFileSync(`data/${def.dataFile}`)), series = source.series.find(s => s.id === '21035') || source.series[0], period = series.periods.at(-1);
    const row = period.rows.find(r => (def.id === 'food-security' ? foodValue(def.id, r) < 0 : foodValue(def.id, r) > 100) && source.countries.find(c => c.id === r[0] && Number.isFinite(c.lon)));
    assert(row, 'Real extreme food observation exists');
    await page.selectOption('[data-food-series]', series.id); await page.locator('[data-food-year]').fill(String(series.periods.length - 1)); await page.locator('[data-food-year]').dispatchEvent('input');
    await page.selectOption('[data-food-country]', row[0]); await idle();
    const xy = await focus(source.countries.find(c => c.id === row[0]));
    assert.deepEqual(await page.locator('.poi-preview-number').allTextContents(), [foodFormat(foodValue(def.id, row))]);
    await page.locator('#japan-poi-preview').screenshot({ path: path.join(out, `${def.number}-real-food.png`) });
    await page.mouse.click(xy.x, xy.y); assert.equal(await page.locator('[data-food-value]').textContent(), `${foodFormat(foodValue(def.id, row))} %`);
    report.checks.push({ actual: def.number, country: row[0], period: period.key, value: foodFormat(foodValue(def.id, row)), workflow: 'Select series/period/country -> hover -> click; source unchanged' });
  }
  await page.evaluate(() => document.querySelector('[data-firms-exhibit]').click());
  await page.waitForFunction(() => GaiaFirmsExhibit.getState().pointCount > 0); await idle();
  await page.locator('[data-firms-progress]').fill('1000'); await page.locator('[data-firms-progress]').dispatchEvent('input');
  await page.waitForFunction(() => document.querySelector('#gaia-firms-canvas').dataset.firmsPlaybackPhase === 'scrub');
  const fire = JSON.parse(fs.readFileSync('data/firms-active-fire-snapshot.json'));
  for (const [north, east] of [[true, true], [true, false], [false, true], [false, false]]) {
    const point = fire.points.find(p => (p.lat >= 0) === north && (p.lon >= 0) === east); assert(point);
    await focus(point);
    const lines = await page.locator('.poi-preview-coordinate').allTextContents();
    assert.deepEqual(lines, formatCoordinatesJa(point.lat, point.lon).split(' '));
    const dataset = await page.evaluate(() => GaiaFirmsExhibit.getStatisticsDataset()), row = dataset.rows.find(r => r.id === point.id);
    assert.equal(row.lat, point.lat); assert.equal(row.lon, point.lon); assert.equal(row.value, point.frp); assert(row.label.includes(formatCoordinatesJa(point.lat, point.lon)));
    await page.locator('#japan-poi-preview').screenshot({ path: path.join(out, `01-real-${north ? 'north' : 'south'}-${east ? 'east' : 'west'}.png`) });
    report.checks.push({ actual: '01', point: point.id, signedLatitude: point.lat, signedLongitude: point.lon, lines, rawMeasurementUnchanged: true });
  }
  for (const [id, values] of [['global-wind-pressure', ['7.2', '124', '1,014.0', '36']], ['global-aerosol-light', ['13.4', '0.27']]]) {
    await page.evaluate(id => document.querySelector(`[data-planet-exhibit="${id}"]`).click(), id);
    await page.waitForFunction(() => document.querySelector('.gaia-planet-signals-readout').dataset.loading !== 'true' && GaiaPlanetSignals.getState().pointCount > 0); await idle();
    await focus(planet);
    const actual = await page.locator('.poi-preview-number').allTextContents();
    assert.deepEqual(actual.map(v => Number(v.replaceAll(',', ''))), values.map(v => Number(v.replaceAll(',', ''))));
    assert.deepEqual(await page.locator('.poi-preview-coordinate').allTextContents(), ['北緯12.3°', '東経130.1°']);
    await page.locator('#japan-poi-preview').screenshot({ path: path.join(out, `${id}-cache-fixture.png`) });
    report.checks.push({ fixture: id, values: actual, smallLabels: await page.locator('.poi-preview-reading-label').allTextContents() });
  }
  const fixtures = [
    { id: 'negative', readings: [{ label: '変動', value: '-125.6', unit: '%' }], expect: ['-125.6'] },
    { id: 'zero', readings: [{ label: 'PM2.5', value: '0', unit: 'µg/m³' }], expect: ['0'] },
    { id: 'qualified', readings: [{ label: '濃度', value: '<0.0001', unit: 'mg/L' }], expect: ['<0.0001'] },
    { id: 'long', readings: [{ label: '排出量', value: '1,234,567,890,123.456', unit: 'kg/年' }], expect: ['1,234,567,890,123.456'] },
    { id: 'missing', readings: [{ label: 'PM2.5', value: '—', unit: 'µg/m³' }], expect: [] },
    { id: 'mixed', readings: [{ label: '濃度', value: '0.27', unit: '' }, { label: 'PM2.5', value: null, unit: 'µg/m³' }], expect: ['0.27'] },
    { id: 'safe-label', readings: [{ label: '<img src=x onerror=alert(1)> PM2.5', value: '10', unit: 'mg/L' }], expect: ['10'] },
  ];
  for (const width of [901, 1440, 3840]) {
    await page.setViewportSize({ width, height: 900 }); await idle();
    for (const fixture of fixtures) {
      const result = await page.evaluate(async fixture => {
        const { renderPoiPreviewReadings } = await import('/src/exploration/poi-preview-readings.js');
        const card = document.querySelector('#japan-poi-preview'); card.setAttribute('aria-hidden', 'false'); card.classList.add('is-visible');
        card.style.left = '18px'; card.style.top = '200px';
        const meta = document.querySelector('#japan-poi-preview-meta');
        renderPoiPreviewReadings(meta, { context: '2024年度 / ID 1401758', readings: fixture.readings }, '2024年度 / PM2.5 / 記録なし');
        const sizes = selector => [...meta.querySelectorAll(selector)].map(n => ({ text: n.textContent, size: parseFloat(getComputedStyle(n).fontSize) }));
        return { values: sizes('.poi-preview-number'), small: sizes('.poi-preview-context,.poi-preview-reading-label,.poi-preview-unit,.poi-preview-missing'), overflow: Math.max(meta.scrollWidth - meta.clientWidth, ...[...meta.querySelectorAll('.poi-preview-reading')].map(n => n.scrollWidth - n.clientWidth)), images: meta.querySelectorAll('img').length };
      }, fixture);
      assert.deepEqual(result.values.map(v => v.text), fixture.expect); assert.equal(result.images, 0); assert(result.small.every(v => v.size <= 14)); assert(result.overflow <= 1, `${width}/${fixture.id}: overflow ${result.overflow}`);
      if (fixture.id === 'zero') assert(result.values[0].size >= 56);
      report.checks.push({ width, fixture: fixture.id, ...result });
      if (width === 901 && fixture.id === 'long') await page.locator('#japan-poi-preview').screenshot({ path: path.join(out, '901-long-layout-fixture.png') });
    }
    for (const title of ['北緯12.3° 東経130.1°', '北緯12.3° 西経160.1°', '南緯12.3° 東経130.1°', '南緯12.3° 西経160.1°', '緯度 -12.34° / 経度 -160.12°', '震源 北緯35.43°・東経139.04°', '酒匂川上流 / 湖流入前（河内川）']) {
      const result = await page.evaluate(async title => {
        const { renderPoiPreviewTitle } = await import('/src/exploration/poi-preview-readings.js');
        const node = document.querySelector('#japan-poi-preview-title'); renderPoiPreviewTitle(node, title);
        return { text: node.textContent, lines: [...node.querySelectorAll('.poi-preview-coordinate')].map(n => { const r = n.getBoundingClientRect(); return { text: n.textContent, top: r.top, bottom: r.bottom, height: r.height, overflow: n.scrollWidth - n.clientWidth }; }) };
      }, title);
      if (title.startsWith('酒匂')) { assert.deepEqual(result.lines, []); assert.equal(result.text, title); }
      else { assert.equal(result.lines.length, 2); assert(result.lines[1].top >= result.lines[0].bottom - 1); assert(result.lines.every(l => l.height < 26 && l.overflow <= 1), 'One intact coordinate per line'); }
      report.checks.push({ width, fixture: 'latitude-longitude-lines', title, ...result });
    }
  }
  assert.deepEqual(report.errors, []); report.status = 'passed'; console.log(`PASS ${report.checks.length} actual/fixture POI variants`);
} catch (error) { report.status = 'failed'; report.failure = error.stack; if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); throw error; }
finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
