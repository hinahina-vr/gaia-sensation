import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseline = process.argv.includes('--baseline');
const baseUrl = process.env.SENSOR_QA_URL || 'http://127.0.0.1:4397';
const output = path.resolve('artifacts/sensor-map-reference');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = { fixture: 'Local mock API, not live observations', scans: [], pageErrors: [] };
try {
  for (const [width, height] of [[1672, 941], [1440, 900], [1024, 768], [390, 844], [320, 568]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', e => report.pageErrors.push(e.message));
    await page.goto(`${baseUrl}/sensors/#map`, { waitUntil: 'domcontentloaded' });
    await page.locator('.sensor-map-marker').first().waitFor({ state: 'visible' });
    await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.('sensor', { restoreFocus: false }));
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(output, `${baseline ? 'before' : 'after'}-${width}.png`) });
    if (baseline) { await context.close(); continue; }
    const inspect = () => {
      const rect = s => document.querySelector(s).getBoundingClientRect().toJSON();
      return { map: rect('#public-sensor-map'), card: rect('#public-sensor-detail'), metrics: rect('.sensor-observation-hud'), actions: rect('.sensor-relationship-bar'), sync: rect('.sensor-global-sync'), header: rect('.sensor-topbar'), overflow: document.documentElement.scrollWidth > innerWidth };
    };
    const layout = await page.evaluate(inspect);
    assert(!layout.overflow, `${width}: horizontal overflow`);
    assert(layout.metrics.height > 0 && layout.metrics.bottom <= layout.actions.top + 1, `${width}: readings must precede actions`);
    assert(layout.card.left >= 0 && layout.card.right <= width && layout.card.bottom <= height, `${width}: card outside viewport`);
    assert(layout.actions.bottom <= layout.card.bottom - 4, `${width}: action row is clipped`);
    assert.equal(await page.locator('.sensor-belonging, .sensor-presence-node').count(), 0, `${width}: decorative presence UI must not return`);
    assert(layout.sync.top >= layout.header.bottom - 1 && layout.sync.bottom <= layout.map.top + 1, `${width}: telemetry is not in a separate strip`);
    const targets = await page.locator('#public-map-search-open, #refresh-map, .sensor-map-navigation button, .sensor-map-card-expand, .sensor-map-card-close, .sensor-relationship-bar button').evaluateAll(nodes => nodes.map(n => ({ id: n.id || n.className, width: n.getBoundingClientRect().width, height: n.getBoundingClientRect().height })));
    assert(targets.every(r => r.width >= 44 && r.height >= 44), `${width}: small hit target ${JSON.stringify(targets)}`);
    await page.locator('#public-map-search-open').click();
    await page.waitForFunction(() => document.activeElement?.id === 'public-sensor-query');
    await page.locator('#public-sensor-query').fill('みず');
    assert.equal(await page.locator('.sensor-public-card:visible').count(), 1);
    await page.locator('.sensor-public-card:visible').click();
    await page.waitForTimeout(400);
    assert.match(await page.locator('#public-sensor-detail h2').innerText(), /みず/);
    assert(await page.locator('.sensor-demo-disclosure').isVisible(), `${width}: demo disclosure hidden`);
    {
      const clearMarker = await page.locator('.sensor-map-marker[aria-current]').evaluate(n => {
        const r = n.getBoundingClientRect();
        return n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      });
      assert(clearMarker, `${width}: card masks selected POI`);
      if (width > 760) assert(await page.locator('.sensor-selection-link').evaluate(n => n.dataset.visible === 'true'), `${width}: missing selection link`);
    }
    await page.screenshot({ path: path.join(output, `selected-${width}.png`) });
    await page.locator('.sensor-map-card-expand').click();
    assert.equal(await page.locator('#public-sensor-detail').getAttribute('data-expanded'), 'true');
    await page.screenshot({ path: path.join(output, `expanded-${width}.png`) });
    await page.locator('.sensor-map-card-close').click();
    await page.locator('#public-sensor-detail').waitFor({ state: 'hidden' });
    await page.locator('#public-map-search-open').click();
    await page.locator('#public-sensor-query').fill('');
    await page.locator('#public-sensor-directory-close').click();
    const beforeZoom = await page.locator('#public-map-zoom').evaluate(n => n.value);
    await page.locator('#public-map-zoom-in').click();
    assert.notEqual(await page.locator('#public-map-zoom').evaluate(n => n.value), beforeZoom);
    await page.locator('#public-map-reset').click();
    await page.locator('#refresh-map').click();
    await page.waitForFunction(() => document.querySelector('#refresh-map').textContent === '更新しました');
    assert.equal(await page.locator('#refresh-map svg').count(), 1, 'refresh must keep its icon');
    if (width === 1672) {
      await page.locator('#public-map-search-open').click();
      await page.locator('.sensor-public-card[data-sensor-id="sensor_demo_ame"]').click();
      await page.locator('#public-map-reset').click();
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(output, 'reference-desktop.png') });
    }
    assert(Number(await page.locator('.sensor-sense-field').getAttribute('data-render-pixels')) <= 905000);
    report.scans.push({ width, height, layout, targets, status: 'passed' });
    await context.close();
  }
  assert.deepEqual(report.pageErrors, []);
  report.status = 'passed';
} finally {
  fs.writeFileSync(path.join(output, baseline ? 'baseline.json' : 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, scans: report.scans.map(({ width, height, status }) => ({ width, height, status })), pageErrors: report.pageErrors }));
