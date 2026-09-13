import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4458';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use only the local sensor QA fixture server');
const before = process.argv.includes('--before');
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/sensor-feature-imagegen-2026-09-09/${before ? 'tour-before' : 'tour-after'}`);
fs.mkdirSync(output, { recursive: true });
const files = ['sensors/sensor-platform.js', 'sensors/index.html', 'sensors/sensor-map-ui.css', 'mode-feature-intro.css', 'mode-entry-guide.js',
  ...(!before ? ['live','connect','analysis'].map(kind => `assets/modes/guide-sensor-${kind}-mizu-ame-v1.webp`) : [])];
const report = { status: 'running', base, before, baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  environment: 'Local Chrome; emulated mobile/touch; sensor QA fixtures, no live account or physical hardware',
  sha256: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  const sizes = process.env.GAIA_SENSOR_FEATURE_SIZES?.split(',').map(value => value.split('x').map(Number)) || (before ? [[1440,900],[390,844]] : [[1440,900],[390,844],[320,568],[844,390],[3840,2160]]);
  for (const [width, height] of sizes) {
    for (const view of (before ? ['map'] : ['map','login','devices'])) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900, isMobile: width < 900, reducedMotion: 'reduce' });
      assert.equal((await context.request.post(`${base}/__qa/reset`)).status(), 200);
      await context.addInitScript(() => {
        localStorage.setItem('gaia-senseware-bgm-muted', 'true');
        sessionStorage.setItem('gaia:mode-entry-guide:sensor:v2', 'seen');
      });
      page = await context.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      await page.goto(`${base}/sensors/${view === 'devices' ? '?authenticated=1' : ''}#${view}`, { waitUntil: 'domcontentloaded' });
      if (before) await page.locator('[data-gaia-mode-guide-replay="sensor"]').click();
      await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
      if (!before) {
        assert.equal(await page.locator('.gaia-feature-intro.is-illustrated').count(), 1);
        assert.equal(await page.locator('.has-feature-art img').count(), 3);
        await page.locator('.has-feature-art img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      }
      await page.screenshot({ path: path.join(output, `${width}x${height}-${view}-intro.png`) });
      await page.locator('[data-feature-guide]').click();
      await page.locator('.gaia-mode-entry-guide-card[data-positioned="true"]').waitFor();
      if (before) {
        const actualView = await page.locator('html').getAttribute('data-sensor-view');
        assert.equal(actualView, 'login', 'Reproduce the old map-to-login guide redirect');
        await page.screenshot({ path: path.join(output, `${width}x${height}-redirect.png`) });
        report.checks.push({ width, height, view, actualView, reproduced: 'Dark SVG intro and public-map guide redirects to login' });
        await context.close();
        continue;
      }
      const total = Number(await page.locator('[data-mode-guide-total]').textContent());
      assert.equal(total, view === 'map' ? 7 : 3);
      const steps = [];
      for (let i = 1; i <= total; i++) {
        await page.waitForFunction(index => document.querySelector('#gaia-mode-entry-guide').dataset.step === String(index), i);
        await page.waitForTimeout(140);
        const scan = await page.evaluate(() => {
          const target = document.querySelector('.is-gaia-mode-guide-target');
          const card = document.querySelector('.gaia-mode-entry-guide-card');
          const a = target.getBoundingClientRect(), b = card.getBoundingClientRect();
          return { view: document.documentElement.dataset.sensorView, target: target.id || target.getAttribute('data-nav') || target.className,
            title: document.querySelector('[data-mode-guide-title]').textContent, targetRect: a.toJSON(), card: b.toJSON(),
            overlap: Math.max(0, Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)),
            controls: [...card.querySelectorAll('button:not(:disabled)')].map(button => { const r=button.getBoundingClientRect(); return { hit: button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)), height:r.height }; }) };
        });
        assert.equal(scan.view, view, 'Operation guide preserves the current view');
        assert(scan.card.x >= 0 && scan.card.y >= 0 && scan.card.right <= width + 1 && scan.card.bottom <= height + 1, 'Guide stays within the viewport');
        assert(scan.targetRect.width > 0 && scan.targetRect.height > 0, 'Real visible target exists');
        assert(scan.targetRect.right > 0 && scan.targetRect.left < width && scan.targetRect.bottom > 0 && scan.targetRect.top < height, 'Target is on screen');
        assert(scan.overlap <= 1, `Guide does not cover ${scan.target}: ${JSON.stringify(scan)}`);
        assert(scan.controls.every(control => control.hit && control.height >= 44), 'Guide actions are reachable');
        await page.screenshot({ path: path.join(output, `${width}x${height}-${view}-step-${i}.png`) });
        steps.push(scan);
        if (i === 2) {
          await page.locator('[data-mode-guide-back]').click();
          assert.equal(await page.locator('[data-mode-guide-step]').textContent(), '1');
          await page.locator('[data-mode-guide-next]').click();
        }
        await page.locator('[data-mode-guide-next]').click();
      }
      await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.is-gaia-mode-guide-target').count(), 0);
      assert.equal(await page.locator('html').getAttribute('data-sensor-view'), view);
      await page.locator('[data-gaia-mode-guide-replay="sensor"]').click();
      await page.locator('[data-feature-guide]').click();
      await page.locator('.gaia-mode-entry-guide-card').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[data-gaia-mode-guide-replay="sensor"]').evaluate(element => element === document.activeElement), true);
      const actions = [];
      if (view === 'map' && [1440,390].includes(width)) {
        const zoom = await page.locator('#public-map-zoom').textContent();
        await page.locator('#public-map-zoom-in').click();
        await page.waitForFunction(previous => document.querySelector('#public-map-zoom').textContent !== previous, zoom);
        await page.locator('#public-map-reset').click();
        await page.waitForFunction(previous => document.querySelector('#public-map-zoom').textContent === previous, zoom);
        await page.locator('#public-map-search-open').click();
        await page.locator('#public-sensor-query').fill('no-such-observation-point-qa');
        await page.locator('#public-sensor-empty').waitFor({ state: 'visible' });
        await page.locator('#public-sensor-query').fill('');
        await page.locator('#public-sensor-list .sensor-public-card').first().click();
        await page.waitForFunction(() => document.querySelector('#public-sensor-directory').dataset.open === 'false');
        await page.locator('#public-sensor-detail h2').waitFor();
        assert.match(await page.locator('#public-sensor-detail .sensor-metric-hud-grid').innerText(), /24\.7/);
        await page.locator('#public-sensor-detail .sensor-analyze-trigger').click();
        await page.locator('#sensor-analysis-dialog[open]').waitFor();
        assert((await page.locator('#sensor-analysis-stats').innerText()).includes('平均'));
        assert.equal(await page.locator('#sensor-ai-key').inputValue(), '');
        await page.screenshot({ path: path.join(output, `${width}x${height}-local-analysis.png`) });
        await page.locator('#sensor-analysis-close').click();
        await page.locator('#sensor-analysis-dialog').waitFor({ state: 'hidden' });
        await page.locator('#refresh-map').click();
        await page.waitForFunction(() => !document.querySelector('#refresh-map').disabled);
        await page.locator('.sensor-topbar [data-nav="guide"]').click();
        await page.waitForFunction(() => document.documentElement.dataset.sensorView === 'guide');
        assert.equal(await page.locator('#gaia-mode-entry-guide').isVisible(), false);
        await page.screenshot({ path: path.join(output, `${width}x${height}-connection-guide.png`) });
        await page.locator('.sensor-topbar [data-nav="map"]').click();
        await page.waitForFunction(() => document.documentElement.dataset.sensorView === 'map');
        assert.equal(await page.locator('#gaia-mode-entry-guide').isVisible(), false);
        actions.push('Actual zoom, reset, search/no result, select point/latest value, local analysis without API key, refresh, connection-guide navigation and return; no repeated intro');
      }
      const requests = (await (await context.request.get(`${base}/__qa/report`)).json()).requests;
      assert.equal(requests.filter(request => request.method !== 'GET' && request.path.startsWith('/api/')).length, 0, 'Tour does not register, pair, publish, or mutate a sensor/account');
      report.checks.push({ width, height, view, steps, actions });
      console.log(`PASS ${width}x${height}/${view}: ${total} steps`);
      await context.close();
    }
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, errors: report.errors }));
}
