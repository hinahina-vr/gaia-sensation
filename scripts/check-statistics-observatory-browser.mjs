import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/statistics-observatory-20260912/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const files = ['statistics-game.css', 'statistics-observatory.css', 'statistics-lab.js', 'gaia-mode-loader.js', 'index.html', 'button-glint.js'];
const report = { status: 'running', before, checks: [], errors: [], missing: [], scope: 'Installed Chrome, production CSP on local assets; real calculations using repository snapshots. Responsive/touch emulation, not physical devices. No external AI calls or production deployment.', hashes: Object.fromEntries(files.filter(file => fs.existsSync(file)).map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])) };
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let page;
try {
  const sizes = before ? [[1440,900], [3442,1690]] : [[1440,900], [3442,1690], [1920,1080], [1366,768], [1024,768], [390,844], [320,568], [844,390], [1440,900,true]];
  for (const [width, height, reduced = false] of sizes.filter(([w]) => !process.env.QA_WIDTHS || process.env.QA_WIDTHS.split(',').map(Number).includes(w))) {
    const label = `${width}x${height}${reduced ? '-reduced' : ''}`;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 980, isMobile: width < 600, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    await context.route('**/api/live/v1/firms', route => route.fulfill({ path: 'data/firms-active-fire-snapshot.json', contentType: 'application/json' }));
    await context.addInitScript(() => {
      sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen');
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
    });
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${label}: ${error.message}`));
    page.on('response', response => { if (response.status() === 404) report.missing.push(response.url()); });
    const load = async (reload = false) => {
      if (reload) await page.reload({ waitUntil: 'domcontentloaded' });
      else await page.goto(base + '/#world', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && globalThis.GaiaMapCategories?.buttons().length >= 30 && globalThis.GaiaMapDemo);
      await page.locator('#gaia-boot').waitFor({ state: 'hidden' });
      await page.locator('[data-feature-start]').waitFor({ state: 'visible' });
      await page.locator('[data-feature-start]').click();
      await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
      await page.evaluate(async () => {
        await GaiaMapObservationAdapter.waitSignalsReady();
        GaiaMapDemo.stop(); GaiaModeEntryGuide.close('map', { restoreFocus: false });
        GaiaMapCategories.buttons().find(button => Number(button.textContent) === 6).click();
      });
      await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
    };
    const ready = async () => {
      await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.gaia-statistics-shell')).transform === 'none');
      await page.locator('#gaia-statistics-lab img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
    };
    const open = async () => {
      if (width > 980) await page.locator('.map-dock-action--statistics').click();
      else {
        await page.locator('[data-mobile-sheet="tools"]').click();
        await page.locator('#map-mobile-sheet').getByRole('button', { name: '統計分析', exact: true }).click();
      }
      await ready();
    };
    const scan = () => page.evaluate(() => {
      const rect = node => node.getBoundingClientRect().toJSON();
      const selectors = ['.gaia-statistics-shell', '.gaia-statistics-header', '.gaia-statistics-stage-header', '.gaia-statistics-view-tabs', '#gaia-statistics-visual', '#gaia-statistics-takeaway', '.gaia-statistics-discover-cta', '#gaia-statistics-takeaway-caveat'];
      return { state: GaiaStatisticsLab.getState(), geometry: Object.fromEntries(selectors.map(selector => {
        const node = document.querySelector(selector), style = getComputedStyle(node);
        return [selector, { rect: rect(node), overflowX: node.scrollWidth - node.clientWidth, overflowY: node.scrollHeight - node.clientHeight, overflow: style.overflow, background: style.backgroundImage, shadow: style.boxShadow }];
      })), pointCount: document.querySelector('#gaia-statistics-canvas').dataset.pointCount, documentOverflow: document.documentElement.scrollWidth - innerWidth,
      metrics: document.querySelector('#gaia-statistics-metrics').textContent,
      evidence: [...document.querySelectorAll('.gaia-statistics-takeaway-evidence button')].map(node => {
        const range = document.createRange(); range.selectNode(node.querySelector('strong').firstChild);
        return { text: node.textContent, rect: rect(node), overflow: node.scrollWidth - node.clientWidth, numberLines: range.getClientRects().length };
      }) };
    });
    const capture = async name => {
      await page.mouse.move(0, 0);
      await page.waitForFunction(() => [...document.querySelectorAll('#gaia-statistics-lab, #gaia-statistics-ai-dialog')].every(node => node.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running' || animation.effect.getTiming().iterations === Infinity)));
      await page.screenshot({ path: path.join(output, `${label}-${name}.png`) });
    };
    await load(); await open();
    const initial = await scan();
    assert.equal(initial.state.datasetId, 'co2-trend');
    assert.equal(initial.pointCount, '120');
    await capture('chart');
    report.checks.push({ label, phase: 'CO2 graph', ...initial });
    console.log(`${label}: chart top ${initial.geometry['#gaia-statistics-visual'].rect.y}, takeaway overflow ${initial.geometry['#gaia-statistics-takeaway'].overflowY}`);
    const glint = async selector => {
      await page.locator(selector).hover();
      await page.waitForTimeout(180);
      return page.locator(selector).evaluate(button => {
        const layer = document.querySelector('.gaia-global-button-glint');
        return { hovered: button.matches(':hover'), focused: button === document.activeElement, button: button.getBoundingClientRect().toJSON(), active: layer.classList.contains('is-active'), display: getComputedStyle(layer).display, opacity: getComputedStyle(layer).opacity, rect: layer.getBoundingClientRect().toJSON() };
      });
    };
    const hover = await glint('#gaia-statistics-menu-toggle');
    report.checks.push({ label, phase: 'menu hover 180ms', ...hover });
    if (before) { await capture('hover-baseline'); await context.close(); continue; }
    assert.equal(initial.documentOverflow, 0);
    assert.equal(initial.geometry['.gaia-statistics-shell'].overflowX, 0);
    if (width > 980) {
      assert.equal(initial.geometry['.gaia-statistics-shell'].overflowY, 0, `${label} outer scroll`);
      assert.equal(initial.geometry['#gaia-statistics-takeaway'].overflowY, 0, `${label} takeaway scroll`);
      const caveat = initial.geometry['#gaia-statistics-takeaway-caveat'].rect;
      assert(caveat.bottom <= initial.geometry['.gaia-statistics-shell'].rect.bottom, `${label} caveat clipped`);
      assert(initial.geometry['#gaia-statistics-visual'].rect.height >= height * .48, `${label} insufficient plot height`);
    }
    for (const card of initial.evidence) { assert(card.overflow <= 1 && card.rect.height >= 44); assert.equal(card.numberLines, 1, 'Do not split the observation number across lines'); }
    const shellBounds = initial.geometry['.gaia-statistics-shell'].rect;
    assert(shellBounds.left >= 0 && shellBounds.right <= width + 1 && shellBounds.top >= 0 && shellBounds.bottom <= height + 1);
    if (width <= 980) {
      assert.equal(initial.geometry['#gaia-statistics-takeaway'].overflowY, 0, 'Mobile explanation must not create a nested scroll area');
      const plot = initial.geometry['#gaia-statistics-visual'].rect;
      assert(Math.min(plot.bottom, height) - plot.y >= 90, 'Show the graph immediately on small screens');
      await page.locator('#gaia-statistics-takeaway-caveat').scrollIntoViewIfNeeded();
      await capture('scrolled-explanation');
    }
    const assertGlint = value => {
      if (reduced) { assert.equal(value.display, 'none'); return; }
      assert(value.active, 'Highlight stopped before sweep'); assert(Number(value.opacity) > .9);
      for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(value.button[key] - value.rect[key]) < 1);
    };
    assertGlint(hover);
    if (width === 1440 && !reduced) {
      const r = hover.button;
      const paintedFrames = [];
      for (const time of [70, 120, 180]) {
        await page.locator('.gaia-global-button-glint').evaluate((node, time) => {
          for (const animation of node.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = time; }
        }, time);
        const clip = { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 };
        const painted = await page.screenshot({ path: path.join(output, `${label}-hover-sweep-frozen-${time}ms.png`), clip });
        // Compare actual painted pixels against the same hovered button with
        // only the sweep temporarily hidden. CSS opacity alone missed the old
        // equal-z-index layer, which animated behind the lazy-mounted modal.
        await page.locator('.gaia-global-button-glint').evaluate(node => { node.style.visibility = 'hidden'; });
        const without = await page.screenshot({ clip });
        await page.locator('.gaia-global-button-glint').evaluate(node => { node.style.visibility = ''; });
        const a = await sharp(painted).removeAlpha().raw().toBuffer();
        const b = await sharp(without).removeAlpha().raw().toBuffer();
        assert.equal(a.length, b.length);
        let changed = 0;
        for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]) > 45) changed++;
        paintedFrames.push({ frozenAtMs: time, changedPixels: changed, totalPixels: a.length / 3 });
      }
      assert(paintedFrames.some(frame => frame.changedPixels / frame.totalPixels > .04), 'Sweep must be visibly painted above the modal, not merely have active CSS');
      report.checks.push({ label, phase: 'painted glint pixel comparison (frozen CSS frames, temporary hidden-layer control)', paintedFrames });
      await page.mouse.move(0, 0);
    }
    for (const selector of ['#stat-view-chart', '#stat-view-findings', '.gaia-statistics-companion', '.gaia-statistics-takeaway-evidence button', '.gaia-statistics-discover-cta']) {
      const button = page.locator(selector).first();
      await button.scrollIntoViewIfNeeded(); await page.waitForTimeout(100);
      const result = await glint(selector + (selector.endsWith('button') ? ':first-child' : ''));
      assertGlint(result);
      report.checks.push({ label, phase: `hover ${selector}`, ...result });
    }
    await page.locator('#gaia-statistics-menu-toggle').focus();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(180);
    const focus = await page.locator('#gaia-statistics-close').evaluate(button => {
      const layer = document.querySelector('.gaia-global-button-glint');
      return { focused: button === document.activeElement, active: layer.classList.contains('is-active'), display: getComputedStyle(layer).display, opacity: getComputedStyle(layer).opacity, button: button.getBoundingClientRect().toJSON(), rect: layer.getBoundingClientRect().toJSON(), outline: getComputedStyle(button).outlineColor };
    });
    assert(focus.focused); assertGlint(focus); report.checks.push({ label, phase: 'native Tab focus close', ...focus });
    await page.waitForTimeout(750);
    assert.equal(await page.locator('.gaia-global-button-glint').evaluate(node => node.classList.contains('is-active')), false);
    for (const name of ['findings', 'values', 'records', 'insights', 'chart']) {
      await page.locator(`[data-stat-view="${name}"]`).click();
      assert.equal(await page.locator(`[data-stat-view="${name}"]`).getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#gaia-statistics-metrics').textContent(), initial.metrics);
      assert.equal(await page.locator('.gaia-statistics-shell').evaluate(node => node.scrollWidth - node.clientWidth), 0);
      if (['findings', 'records'].includes(name)) await capture(name);
      if (name === 'records') {
        const labelStyle = await page.locator('#gaia-statistics-records-body th strong').first().evaluate(node => getComputedStyle(node).color);
        assert.equal(labelStyle, 'rgb(35, 71, 95)', 'Record IDs must stay legible on paper');
      }
    }
    await page.locator('.gaia-statistics-discover-cta').click();
    await page.locator('#stat-panel-findings .gaia-statistics-panel-back').click();
    await page.waitForFunction(() => document.activeElement.id === 'gaia-statistics-canvas');
    await page.keyboard.press('Home'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#stat-view-records').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#gaia-statistics-records-body tr[data-selected="true"]').count(), 1);
    await page.locator('#stat-view-chart').click();
    const canvas = page.locator('#gaia-statistics-canvas');
    await canvas.scrollIntoViewIfNeeded(); await canvas.focus();
    await page.keyboard.press('Home');
    const point = await page.evaluate(() => {
      const canvas = document.querySelector('#gaia-statistics-canvas'), tip = document.querySelector('.gaia-statistics-chart-tooltip');
      const rect = canvas.getBoundingClientRect();
      return { x: rect.x + parseFloat(tip.style.left), y: rect.y + parseFloat(tip.style.top), id: tip.dataset.recordId };
    });
    assert(point.id); await page.mouse.click(point.x, point.y);
    assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().selectedRecordId), point.id, 'Resized plot pointer must resolve the original observation');
    assert.equal(await page.locator('#stat-view-records').getAttribute('aria-selected'), 'true');
    await page.locator('#gaia-statistics-menu-toggle').click();
    await page.locator('[data-analysis-group="descriptive"]').click();
    await page.locator('[data-method="summary"]').click(); await ready();
    assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().methodId), 'summary');
    await page.locator('#gaia-statistics-menu-toggle').click(); await capture('menu');
    const drawer = await page.locator('#gaia-statistics-controls').evaluate(node => ({ rect: node.getBoundingClientRect().toJSON(), overflow: node.scrollWidth - node.clientWidth }));
    assert(drawer.rect.left >= 0 && drawer.rect.right <= width + 1 && drawer.overflow <= 1);
    await page.locator('#gaia-statistics-menu-close').click();
    if ([1440,390].includes(width) && !reduced) {
      await page.locator('#gaia-statistics-menu-toggle').click();
      await page.locator('.gaia-statistics-data-options > summary').click();
      await page.locator('#gaia-statistics-record-filter').fill('2025');
      await page.waitForFunction(() => GaiaStatisticsLab.getState().recordQuery === '2025'); await ready();
      await page.locator('#gaia-statistics-view-save').click();
      assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().savedViewCount), 1);
      await load(true); await open();
      await page.locator('#gaia-statistics-menu-toggle').click();
      await page.locator('.gaia-statistics-data-options > summary').click();
      await page.locator('#gaia-statistics-saved-view').selectOption({ index: 1 });
      await page.locator('#gaia-statistics-view-apply').click(); await ready();
      assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().recordQuery), '2025');
      assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().methodId), 'summary');
      await page.locator('#gaia-statistics-view-delete').click();
      await page.locator('#gaia-statistics-menu-close').click();
    }
    await page.locator('#gaia-statistics-ai-open').click();
    await page.locator('#gaia-statistics-ai-dialog').waitFor({ state: 'visible' });
    await capture('ai');
    assert.equal(await page.locator('#gaia-statistics-ai-dialog').evaluate(node => node.scrollWidth - node.clientWidth), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#gaia-statistics-ai-dialog').isVisible(), false);
    await page.locator('#gaia-statistics-close').click();
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    await page.locator('#gaia-statistics-lab').waitFor({ state: 'hidden' });
    await open();
    assert.equal(await page.locator('#stat-view-chart').getAttribute('aria-selected'), 'true');
    await page.locator('#gaia-statistics-close').click();
    report.checks.push({ label, phase: 'functional regression', allFiveTabs: true, metricsUnchanged: true, sourceDrilldown: true, resizedPlotPointer: true, changeMethod: true, savedReload: [1440,390].includes(width) && !reduced, aiOpenCloseWithoutRequest: true, closeReopen: true });
    console.log(`PASS ${label}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
