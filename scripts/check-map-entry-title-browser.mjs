import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const [base = 'http://127.0.0.1:4492', destination = 'artifacts/map-entry-title/after', stage = 'after'] = process.argv.slice(2);
const output = path.resolve(destination);
fs.mkdirSync(output, { recursive: true });
const files = ['mode-entry-guide.js', 'mode-feature-intro.css', 'app.js', 'statistics-game.css', 'gaia-mode-loader.js', 'index.html'];
const report = { stage, status: 'running', testedAt: new Date().toISOString(), base,
  environment: 'Local installed Chrome, desktop/mobile emulation. Repository NOAA/FIRMS snapshots and empty USGS fixture; no physical device/live-provider claim.',
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sha256: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  for (const [width, height, motion] of [[1440,900,'no-preference'],[390,844,'no-preference'],[320,568,'reduce'],[844,390,'no-preference'],[3840,2160,'no-preference']].filter(([width]) => !process.env.GAIA_ENTRY_WIDTH || width === Number(process.env.GAIA_ENTRY_WIDTH))) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 900, isMobile: width <= 900, reducedMotion: motion });
    await enforceBrowserSecurity(context, base);
    await context.addInitScript(() => {
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
      sessionStorage.setItem('gaia:intro-entry-guide:v1', 'seen');
      window.__entryFrames = [];
      addEventListener('gaia:mode-guide-open', () => {
        const start = performance.now();
        const sample = () => {
          const layer = document.querySelector('#gaia-mode-entry-guide');
          const title = layer.querySelector('.gaia-mode-entry-title');
          const panel = layer.querySelector('.gaia-feature-intro');
          window.__entryFrames.push({ time: performance.now() - start, phase: layer.dataset.phase,
            title: title && !title.hidden ? Number(getComputedStyle(title).opacity) : 0,
            panel: !panel.hidden ? Number(getComputedStyle(panel).opacity) : 0 });
          if (performance.now() - start < 3500 && !layer.hidden) requestAnimationFrame(sample);
        };
        sample();
      });
    });
    await context.route('https://services.swpc.noaa.gov/**', route => route.fulfill({ path: 'data/ovation-aurora-snapshot.json', contentType: 'application/json' }));
    await context.route('https://earthquake.usgs.gov/**', route => route.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
    await context.route('**/api/live/v1/firms', route => route.fulfill({ path: 'data/firms-active-fire-snapshot.json', contentType: 'application/json' }));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/#top`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-intro-path="map"]').click();
    const title = page.locator('#gaia-mode-entry-guide[data-phase="title"]');
    const panel = page.locator('#gaia-mode-entry-guide[data-phase="features"]');
    if (stage !== 'before') {
      await title.waitFor();
      assert.equal(await title.locator('h2').filter({ visible: true }).textContent(), '世界を観測する');
      assert.equal(await page.locator('.gaia-feature-intro').isVisible(), false);
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.gaia-mode-entry-title')).opacity) > .95);
      assert.equal(await page.evaluate(() => GaiaMapDemo.getState().paused), true);
      await page.keyboard.press('Tab');
      assert.equal(await title.evaluate(node => node.contains(document.activeElement)), true);
      await page.screenshot({ path: path.join(output, `${width}-title.png`) });
    }
    await panel.waitFor();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.gaia-feature-intro')).opacity === '1');
    await page.locator('.has-feature-art img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const rect = await page.locator('.gaia-feature-intro').evaluate(node => node.getBoundingClientRect().toJSON());
    const frames = await page.evaluate(() => window.__entryFrames);
    if (stage !== 'before') {
      assert(frames.some(frame => frame.title > .95 && frame.panel === 0), 'Title alone appears before introduction');
      assert(frames.every(frame => !(frame.title > .01 && frame.panel > .01)), 'Title and introduction do not overlap');
      if (motion !== 'reduce') assert(frames.some(frame => frame.phase === 'features' && frame.panel > 0 && frame.panel < .95), 'Introduction actually fades in');
      assert(rect.width <= width * (width > 900 ? .86 : .94) + 1 && rect.height <= height * .91 + 1, 'Introduction is one size smaller');
      const decoration = await page.locator('.gaia-feature-intro').evaluate(node => ({
        transition: getComputedStyle(node).transitionDuration,
        shine: getComputedStyle(node.querySelector('[data-feature-start]'), '::after').animationName,
        cards: [...node.querySelectorAll('.gaia-feature-card')].map(card => getComputedStyle(card).animationName),
      }));
      if (motion === 'reduce') {
        assert.equal(decoration.transition, '0s');
        assert.equal(decoration.shine, 'none');
        assert(decoration.cards.every(name => name === 'none'));
      } else {
        assert.equal(decoration.shine, 'gaia-entry-sheen');
        assert(decoration.cards.every(name => name === 'gaia-entry-card-reveal'));
        if (width > 900) {
          const primary = page.locator('[data-feature-start]');
          const before = await primary.evaluate(node => getComputedStyle(node).transform);
          await primary.hover(); await page.waitForTimeout(350);
          assert.notEqual(await primary.evaluate(node => getComputedStyle(node).transform), before, 'Hover responds visually');
          await page.mouse.move(0,0);
        }
      }
    }
    assert(rect.x >= 0 && rect.y >= 0 && rect.right <= width + 1 && rect.bottom <= height + 1);
    await page.screenshot({ path: path.join(output, `${width}-features.png`) });
    await page.locator('[data-feature-start]').click();
    await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => GaiaMapDemo.getState().paused), false);
    // Open/reopen with actual guide controls, cancel during the title, and
    // wait beyond the entire sequence to catch stale timeout resurrection.
    const replay = async () => {
      if (width <= 900) {
        await page.locator('[data-mobile-sheet="tools"]').click();
        await page.locator('#map-mobile-sheet').getByRole('button', { name: '地図ガイド', exact: true }).click();
      } else await page.locator('[data-gaia-mode-guide-replay="map"]').click();
    };
    if (stage !== 'before') {
      await replay(); await title.waitFor(); await page.keyboard.press('Escape');
      await page.waitForTimeout(3400);
      assert.equal(await page.evaluate(() => GaiaModeEntryGuide.getState().active), false);
      await replay(); await title.waitFor();
      await page.setViewportSize({ width: width + 12, height: height + 10 });
      // Explicit skip is allowed, but still transitions to the same panel.
      await page.locator('[data-entry-title-skip]').click();
      await panel.waitFor();
      await page.setViewportSize({ width, height });
      await page.locator('[data-feature-guide]').click();
      await page.locator('#gaia-mode-entry-guide[data-phase="guide"]').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
      // The map close path can close the guide again during its fade. Exercise
      // the public lifecycle API twice in the same task as a race regression;
      // all entries/replays above use actual UI controls.
      await replay(); await title.waitFor();
      await page.evaluate(() => { GaiaModeEntryGuide.close(); GaiaModeEntryGuide.close(); });
      await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden', timeout: 1500 });
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations || []), []);
    report.checks.push({ width, height, motion, rect, frames });
    console.log(`PASS ${stage}/${width}/${motion}`);
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
