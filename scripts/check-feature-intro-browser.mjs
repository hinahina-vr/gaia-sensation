import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4447';
const output = path.resolve(process.env.GAIA_FEATURE_OUTPUT || 'artifacts/feature-intro');
fs.mkdirSync(output, { recursive: true });
const sizes = process.env.GAIA_FEATURE_SIZES?.split(',').map(value => value.split('x').map(Number)) || [[1440,900],[390,844],[320,568],[844,390],[768,1024],[3840,2160]];
const modes = process.env.GAIA_FEATURE_MODES?.split(',') || ['map', 'sensor'];
const files = ['mode-entry-guide.js', 'mode-feature-intro.css', 'app.js', 'sensors/sensor-platform.js', 'sensors/sensor-map-ui.css', 'gaia-mode-loader.js', 'index.html', 'sensors/index.html',
  ...['live','time','discovery'].map(kind => `assets/modes/guide-map-${kind}-mizu-ame-v2.webp`),
  ...['live','connect','analysis'].map(kind => `assets/modes/guide-sensor-${kind}-mizu-ame-v1.webp`)];
const report = { status: 'running', environment: 'Local Chrome; mobile/touch emulation; local sensor/API fixtures, no live providers or physical sensors',
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sha256: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
  checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
// Self-contained local read-only fixtures. A static preview has no account API;
// returning its HTML/404 would test an unavailable backend, not the guide.
const sensorFixtures = async (context, authenticated = false) => {
  await context.route('**/api/public/v1/measurement-types', route => route.fulfill({ json: { categories: [], measurements: [] } }));
  await context.route('**/api/public/v1/sensors', route => route.fulfill({ json: { sensors: [] } }));
  await context.route('**/api/web/v1/session', route => route.fulfill(authenticated
    ? { json: { user: { id: 'qa-user', accountKind: 'trial', displayName: 'QA fixture' } } }
    : { status: 401, json: { error: { code: 'UNAUTHENTICATED', message: 'QA unauthenticated fixture' } } }));
  await context.route('**/api/web/v1/countries', route => route.fulfill({ json: { countries: [] } }));
  await context.route('**/api/web/v1/devices', route => route.fulfill({ json: { devices: [] } }));
  await context.route('**/api/web/v1/social', route => route.fulfill({ json: { sensors: [] } }));
};
let page;
try {
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 900, isMobile: width <= 900, reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
    await sensorFixtures(context);
    await context.addInitScript(() => {
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
      // Old guides were seen; the new introduction has its own new version.
      sessionStorage.setItem('gaia:mode-entry-guide:map:v4', 'seen');
      sessionStorage.setItem('gaia:mode-entry-guide:sensor:v2', 'seen');
      sessionStorage.setItem('gaia:intro-entry-guide:v1', 'seen');
    });
    await context.route('https://services.swpc.noaa.gov/**', route => route.fulfill({ path: 'data/ovation-aurora-snapshot.json', contentType: 'application/json' }));
    await context.route('https://earthquake.usgs.gov/**', route => route.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
    await context.route('**/api/live/v1/firms', route => route.fulfill({ path: 'data/firms-active-fire-snapshot.json', contentType: 'application/json' }));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ width, error: error.message }));
    for (const mode of modes) {
      const fromTop = [1440, 390].includes(width);
      if (fromTop) {
        await page.goto(`${base}/#top`, { waitUntil: 'domcontentloaded' });
        await page.locator(mode === 'map' ? '[data-intro-path="map"]' : '[data-intro-guide="sensor"]').click();
      } else await page.goto(mode === 'map' ? `${base}/#world` : `${base}/sensors/#map`, { waitUntil: 'domcontentloaded' });
      const modal = page.locator('#gaia-mode-entry-guide[data-phase="features"]');
      await modal.waitFor();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.gaia-feature-intro')).opacity === '1');
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.has-feature-art img').count(), 3);
      await page.locator('.has-feature-art img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      await page.waitForTimeout(450);
      assert.equal(await page.locator('.gaia-feature-card').count(), 3);
      assert.equal(await page.locator('.is-gaia-mode-guide-target').count(), 0, 'No simultaneous spotlight tour');
      if (mode === 'sensor') assert.equal(await page.locator('html').getAttribute('data-sensor-view'), 'map', 'Introduction must not redirect the public map to login');
      const scan = await modal.evaluate(layer => {
        const panel = layer.querySelector('.gaia-feature-intro'), rect = panel.getBoundingClientRect();
        const scroller = panel.querySelector('.gaia-feature-scroll');
        const controls = [...panel.querySelectorAll('button')].map(button => {
          const bounds = button.getBoundingClientRect(), hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          return { text: button.textContent, rect: bounds.toJSON(), hit: button.contains(hit) };
        });
        return { panel: rect.toJSON(), background: getComputedStyle(panel).backgroundImage, opacity: getComputedStyle(panel).opacity,
          overflow: document.documentElement.scrollWidth - innerWidth, scrollOverflow: scroller.scrollWidth - scroller.clientWidth,
          titles: [...panel.querySelectorAll('h3')].map(element => element.textContent), copy: panel.innerText, controls,
          focusWithin: panel.contains(document.activeElement), paused: globalThis.GaiaMapDemo?.getState().paused,
          animation: getComputedStyle(panel.querySelector('.feature-beacon')).animationName };
      });
      assert(scan.panel.x >= 0 && scan.panel.y >= 0 && scan.panel.right <= width + 1 && scan.panel.bottom <= height + 1, 'Panel is inside the viewport');
      assert(scan.overflow <= 1 && scan.scrollOverflow <= 1, 'No horizontal overflow');
      assert.equal(scan.opacity, '1');
      assert(scan.background.includes('0.8'), 'Only the panel background has 80% opacity');
      assert(scan.focusWithin);
      assert(scan.controls.every(control => control.hit && control.rect.height >= 44 && control.rect.width >= 44), 'Fixed close and footer controls remain reachable');
      assert(scan.copy.includes('APIキー'));
      if (mode === 'map') assert.equal(scan.paused, true, 'Default map demo pauses during introduction');
      if (width === 320) assert.equal(scan.animation, 'none');
      await page.screenshot({ path: path.join(output, `${width}x${height}-${mode}.png`) });
      // Text/decoration clicks do not accidentally dismiss or advance.
      await page.locator('.gaia-feature-heading h2').click();
      assert.equal(await modal.isVisible(), true);
      const close = page.locator('[data-feature-close]');
      await close.focus(); await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('[data-feature-start]').evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await close.evaluate(element => element === document.activeElement), true);
      // Scroll inside small screens; the third complete card and conditions
      // remain available, while primary and close buttons stay on screen.
      await page.locator('.gaia-feature-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
      await page.screenshot({ path: path.join(output, `${width}x${height}-${mode}-details.png`) });
      await page.locator('[data-feature-start]').click();
      await modal.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => GaiaModeEntryGuide.getState().active), false);
      assert.equal(await page.locator('.is-gaia-mode-guide-target').count(), 0, 'Primary action starts experience without a second modal');
      if (mode === 'sensor') assert.equal(await page.locator('html').getAttribute('data-sensor-view'), 'map');
      if (mode === 'map') {
        assert.equal(await page.evaluate(() => GaiaMapDemo.getState().paused), false);
        await page.evaluate(() => GaiaMapDemo.stop());
      }
      // Replay through the real existing guide entry; mobile map exposes it
      // inside its tools sheet rather than in the small header.
      if (mode === 'map' && width <= 900) {
        await page.locator('[data-mobile-sheet="tools"]').click();
        await page.locator('#map-mobile-sheet').getByRole('button', { name: '地図ガイド', exact: true }).click();
      } else await page.locator(`[data-gaia-mode-guide-replay="${mode}"]`).click();
      await modal.waitFor();
      await page.locator('[data-feature-guide]').click();
      await page.waitForFunction(() => GaiaModeEntryGuide.getState().phase === 'guide' && document.querySelector('.is-gaia-mode-guide-target'));
      await page.locator('.gaia-mode-entry-guide-card').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.gaia-feature-intro').isVisible(), false);
      assert.equal(await page.locator('.gaia-mode-entry-guide-card').isVisible(), true);
      if (mode === 'sensor') assert.equal(await page.locator('html').getAttribute('data-sensor-view'), 'map', 'Public-map operation guide must not redirect to login');
      await page.keyboard.press('Escape');
      await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
      await page.reload({ waitUntil: 'domcontentloaded' });
      if (mode === 'map') await page.waitForFunction(() => globalThis.GaiaMapDemo);
      else await page.waitForFunction(() => globalThis.GaiaModeEntryGuide && document.documentElement.dataset.sensorView);
      await page.waitForTimeout(1600);
      if (mode === 'map') {
        assert.equal(await page.evaluate(() => GaiaModeEntryGuide.getState().active), true, 'Map welcome repeats despite the seen flag');
        await modal.waitFor();
        await page.locator('[data-feature-start]').click();
        await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
      } else assert.equal(await page.evaluate(() => GaiaModeEntryGuide.getState().active), false, 'Sensor seen state survives reload in this tab');
      report.checks.push({ width, height, mode, entry: fromTop ? 'Actual top-screen card click' : 'Direct URL', ...scan, lifecycle: 'Automatic intro; no redirect; fixed controls; focus loop; scroll; start; actual replay; optional tour; Escape; map repeats / sensor first visit' });
      console.log(`PASS ${width}x${height}/${mode}`);
    }
    await context.close();
  }
  for (const view of modes.includes('sensor') ? (process.env.GAIA_FEATURE_SENSOR_LANDINGS?.split(',') || ['login', 'devices']) : []) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await sensorFixtures(context, view === 'devices');
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ view, error: error.message }));
    await page.goto(`${base}/sensors/${view === 'devices' ? '?authenticated=1' : ''}#${view}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-mode-entry-guide[data-phase="features"]').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-sensor-view'), view);
    await page.locator('[data-feature-close]').click();
    await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('html').getAttribute('data-sensor-view'), view);
    report.checks.push({ width: 390, mode: 'sensor', view, lifecycle: 'Automatic overview on login/device landing; close preserves destination' });
    console.log(`PASS sensor landing/${view}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, errors: report.errors, failure: report.failure }));
}
