import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const baseline = process.argv.includes('--baseline');
const output = path.resolve('artifacts/statistics-workspace');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const report = { errors: [], views: [] };
try {
  for (const [width, height] of [[1440, 900], [2080, 1171], [1366, 768], [390, 844], [320, 568]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    await context.addInitScript(() => sessionStorage.setItem('gaia:mode-entry-guide:map:v3', 'seen'));
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/?preview=statistics-workspace#world');
    await page.waitForFunction(() => typeof window.GaiaModeLoader?.load === 'function');
    await page.evaluate(() => window.GaiaModeLoader.load('exploration'));
    await page.waitForFunction(() => document.documentElement.dataset.gaiaAppReady === 'true');
    await page.waitForFunction(() => typeof GaiaStatisticsLab?.open === 'function');
    await page.evaluate(async () => {
      await GaiaStatisticsLab.open({ datasetId: 'wind-climate' });
      const select = document.querySelector('#gaia-statistics-lectures');
      select.value = '01'; select.dispatchEvent(new Event('change'));
    });
    await page.waitForFunction(() => document.querySelector('#gaia-statistics-status').textContent === '解析済み');
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(output, `${baseline ? 'before' : 'after'}-${width}.png`) });
    if (!baseline) {
      const geometry = await page.evaluate(() => {
        const rect = s => document.querySelector(s).getBoundingClientRect().toJSON();
        const shell = document.querySelector('.gaia-statistics-shell');
        return { chart: rect('#gaia-statistics-visual'), summary: rect('#gaia-statistics-takeaway'), title: rect('.gaia-statistics-stage-header'), overflow: shell.scrollWidth > shell.clientWidth + 1, label: document.querySelector('#gaia-statistics-method-title').textContent, axis: document.querySelector('#gaia-statistics-canvas').dataset.axisY };
      });
      assert.equal(geometry.overflow, false, `${width}: horizontal overflow`);
      assert.match(geometry.label, /風速/, 'Analyzed variable must be explicit');
      assert.equal(geometry.axis, '観測数');
      if (width >= 1000) {
        assert.ok(geometry.chart.right <= geometry.summary.left, 'Chart and reading should be separate columns');
        assert.ok(geometry.chart.height > (height >= 850 ? 350 : 280), 'Desktop chart must be the main surface');
      } else assert.ok(geometry.chart.bottom <= geometry.summary.top + 1, 'Mobile chart must precede the reading');
      report.views.push({ width, ...geometry });
      for (const view of ['values', 'records', 'insights', 'chart']) {
        await page.locator(`[data-stat-view="${view}"]`).click();
        await page.waitForTimeout(50);
        assert.equal(await page.locator(`[data-stat-view="${view}"]`).getAttribute('aria-selected'), 'true');
        if (view !== 'chart') assert.equal(await page.locator(`.gaia-statistics-stage > details[data-stat-panel="${view}"]`).evaluate(el => el.open), true);
        if (view === 'records') {
          const table = await page.evaluate(() => {
            const body = document.querySelector('.gaia-statistics-records-scroll').getBoundingClientRect();
            const row = document.querySelector('#gaia-statistics-records-body tr').getBoundingClientRect();
            return { visible: row.height > 20 && row.bottom < body.bottom && row.left >= body.left, width: body.width };
          });
          assert.equal(table.visible, true, 'Table rows must be visible, not merely present in the DOM');
          assert.ok(table.width > geometry.chart.width - 5, 'Record table must fill the plot area');
          await page.screenshot({ path: path.join(output, `records-${width}.png`) });
        }
      }
      const tab = page.locator('[data-stat-view="chart"]');
      await tab.focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('[data-stat-view="values"]').getAttribute('aria-selected'), 'true');
      await page.keyboard.press('Home');
      await page.locator('#gaia-statistics-canvas').focus();
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.gaia-statistics-records').open);
      assert.equal(await page.locator('#gaia-statistics-records-body tr[data-selected="true"]').count(), 1);
      await page.locator('.gaia-statistics-records .gaia-statistics-panel-back').click();
      await page.waitForFunction(() => document.activeElement.id === 'gaia-statistics-canvas');
      await page.locator('#gaia-statistics-canvas').scrollIntoViewIfNeeded();
      const pointer = await page.evaluate(() => {
        const canvas = document.querySelector('#gaia-statistics-canvas');
        canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        const tip = document.querySelector('.gaia-statistics-chart-tooltip');
        const rect = canvas.getBoundingClientRect();
        return { x: rect.left + parseFloat(tip.style.left), y: rect.top + parseFloat(tip.style.top), plotBottom: rect.top + Number(canvas.dataset.plotBottom) };
      });
      assert.ok(pointer.y > pointer.plotBottom, 'Observation marks should be outside the frequency plot');
      await page.mouse.click(pointer.x, pointer.y);
      await page.waitForFunction(() => document.querySelector('.gaia-statistics-records').open, null, { timeout: 5000 }).catch(error => { console.error({ width, pointer }); throw error; });
      await page.locator('.gaia-statistics-records .gaia-statistics-panel-back').click();
      await page.waitForFunction(() => document.activeElement.id === 'gaia-statistics-canvas');
      await page.locator('#gaia-statistics-menu-toggle').click();
      await page.locator('#gaia-statistics-lectures').selectOption('11');
      await page.locator('#gaia-statistics-menu-close').click();
      await page.waitForFunction(() => document.querySelector('#gaia-statistics-status').textContent === '解析済み');
      await page.waitForTimeout(360);
      await page.screenshot({ path: path.join(output, `regression-${width}.png`) });
      if (width === 1440) {
        for (const [datasetId, label] of [['jma-co2', '綾里のCO₂'], ['forest-urban', '森林率']]) {
          await page.evaluate(async id => {
            await GaiaStatisticsLab.open({ datasetId: id });
            const select = document.querySelector('#gaia-statistics-lectures'); select.value = '01'; select.dispatchEvent(new Event('change'));
          }, datasetId);
          await page.waitForFunction(() => document.querySelector('#gaia-statistics-status').textContent === '解析済み');
          await page.waitForFunction(expected => document.querySelector('#gaia-statistics-canvas').dataset.axisX?.includes(expected), label);
          assert.match(await page.locator('#gaia-statistics-method-title').textContent(), new RegExp(label));
          assert.match(await page.locator('#gaia-statistics-canvas').getAttribute('data-axis-x'), new RegExp(label));
        }
      }
    }
    await context.close();
    console.log(`Statistics workspace ${width} × ${height}: passed`);
  }
  assert.deepEqual(report.errors, []);
  fs.writeFileSync(path.join(output, `${baseline ? 'baseline' : 'report'}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
