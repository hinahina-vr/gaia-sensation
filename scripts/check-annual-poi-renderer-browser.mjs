import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PRTR_BIOLOGY_EXHIBITS } from '../src/exploration/prtr-biology-catalog.js';
import { readAnnualPart } from './lib/annual-snapshot.mjs';

const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/annual-poi-renderer');
fs.mkdirSync(output, { recursive: true });
const base = process.env.GAIA_BASE_URL;
const report = { scope: 'Real Chrome Canvas2D, actual local annual records and adversarial overlapping points. Not a physical mobile test.', checks: [] };
const browser = await chromium.launch({ executablePath: process.env.GAIA_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  page = await browser.newPage();
  await page.route(`${base}/__renderer-test`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>POI rendering regression</title>' }));
  await page.goto(`${base}/__renderer-test`);
  const definitions = [...PRTR_BIOLOGY_EXHIBITS, { ...PRTR_BIOLOGY_EXHIBITS[0], number: 'observation-rings', animation: undefined }];
  for (const readback of [true, false]) for (const def of definitions) {
    const manifest = JSON.parse(fs.readFileSync(`data/${def.dataFile}`));
    const period = manifest.periods.find(p => p.year === 2018) || manifest.periods[0];
    const stations = (period.file ? readAnnualPart(period.file) : period).stations;
    const rows = (def.animation ? stations : stations.slice(0, 2100)).map(point => ({ id: point.id, prefCode: point.prefCode, lon: point.lon, lat: point.lat,
      value: (point.metrics?.[def.measurementKey] || point.measurement).value }));
    const result = await page.evaluate(async ({ def, rows, readback }) => {
      const { createAnnualPoiRenderer, POI_CACHE_PATHS } = await import('/src/exploration/annual-poi-renderer.js');
      const { recordAppearance } = await import('/src/exploration/record-appearance.js');
      const { paintAnnualPoiReference } = await import('/scripts/fixtures/annual-poi-reference.js');
      const styles = new WeakMap();
      const style = point => {
        if (!styles.has(point)) styles.set(point, { ...recordAppearance(def, point.value), mapX: point.lon, mapY: -point.lat });
        return styles.get(point);
      };
      const renderer = createAnnualPoiRenderer({ style, readValue: p => p.value });
      const a = document.createElement('canvas'), b = document.createElement('canvas');
      window.__referenceCanvas = a; window.__optimizedCanvas = b;
      const ac = a.getContext('2d', { willReadFrequently: readback }), bc = b.getContext('2d', { willReadFrequently: readback });
      const checks = [];
      let ordinal = 0;
      const run = ({ ratio = 1, scale = 24, elapsed = 3000, time = 1800, reduced = false, prefecture = 'all', selectedId = '', testRows = rows } = {}) => {
        const width = 1280, height = 800;
        a.width = b.width = Math.round(width * ratio); a.height = b.height = Math.round(height * ratio);
        const options = { rows: testRows, definition: def, view: { rect: { width, height }, scale, originX: -120 * scale, originY: 48 * scale }, ratio,
          elapsed, time, reduced, prefecture, selectedId, key: `${ratio}|${scale}|${prefecture}|${selectedId}`, renderedIds: new Set() };
        ac.setTransform(ratio, 0, 0, ratio, 0, 0); bc.setTransform(ratio, 0, 0, ratio, 0, 0);
        const expectedIds = new Set(), expected = paintAnnualPoiReference(ac, { ...options, renderedIds: expectedIds }, style, p => p.value);
        const actual = renderer.paint(bc, options);
        if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Counts differ: ${JSON.stringify({expected, actual})}`);
        if (JSON.stringify([...expectedIds]) !== JSON.stringify([...options.renderedIds])) throw new Error('Visible picking IDs/order differ');
        const source = ac.getImageData(0, 0, a.width, a.height).data, optimized = bc.getImageData(0, 0, b.width, b.height).data;
        let max = 0, sum = 0, changed = 0;
        // Compare visible premultiplied channels: unpremultiplication magnifies
        // a one-step alpha rounding difference in otherwise transparent pixels.
        for (let i = 0; i < source.length; i += 4) {
          let pixelMax = Math.abs(source[i + 3] - optimized[i + 3]);
          for (let c = 0; c < 3; c++) pixelMax = Math.max(pixelMax, Math.abs(source[i + c] * source[i + 3] / 255 - optimized[i + c] * optimized[i + 3] / 255));
          max = Math.max(max, pixelMax); sum += pixelMax; if (pixelMax > 2) changed++;
        }
        const cache = renderer.getState();
        if (cache.cachedPoints > POI_CACHE_PATHS) throw new Error('Vector path budget exceeded');
        const sample = { ordinal: ordinal++, ratio, scale, elapsed, time, reduced, prefecture, selectedId, count: testRows.length, max, mean: sum / (a.width * a.height), aboveTwo: changed, cache };
        checks.push(sample);
        // Vector caching must preserve exact visible pixels, not merely stay
        // below a perceptual threshold. Raster grouping failed this contract.
        if (max !== 0) throw new Error(`Visual regression: ${JSON.stringify(sample)}`);
      };
      for (const elapsed of [-1, 0, 400, 1200, 2400, 3000]) run({ elapsed });
      run({ time: 3210 }); run({ time: 4890 });
      run({ ratio: 1.5 }); run({ ratio: Math.sqrt(1600000 / (3840 * 2160)) });
      run({ scale: 96 }); run({ scale: 24, prefecture: rows[0].prefCode, selectedId: rows[0].id });
      run({ reduced: true }); run({ reduced: true, elapsed: -1 }); run({ reduced: true, elapsed: 0 });
      run({ testRows: rows.slice().reverse() }); run({ testRows: rows.slice(0, 150) });
      // Static points both before and after a moving mark, at identical source
      // coordinates, catch incorrect static-background/dynamic-foreground batching.
      const overlaps = Array.from({ length: 1200 }, (_, i) => ({ ...rows[i % rows.length], id: `overlap-${i}`, lon: 133.111 + (i % 3) * .03, lat: 35.777, value: i % 9 ? i * 10 : null }));
      run({ testRows: overlaps }); run({ testRows: overlaps, time: 3300 });
      renderer.reset();
      if (renderer.getState().cachedPoints || renderer.getState().projectedPoints) throw new Error('Reset retains old period/paths');
      return checks;
    }, { def, rows, readback });
    report.checks.push({ number: def.number, readback, cases: result });
    console.log(`Exhibit ${def.number} (readback=${readback}): ${result.length} pixel/count/order/budget/release comparisons passed`);
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  if (page) for (const [name, key] of [['reference', '__referenceCanvas'], ['optimized', '__optimizedCanvas']]) {
    const data = await page.evaluate(key => window[key]?.toDataURL().split(',')[1], key);
    if (data) fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(data, 'base64'));
  }
  throw error;
}
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
