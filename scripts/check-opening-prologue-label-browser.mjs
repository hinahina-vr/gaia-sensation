import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/opening-prologue-label-20260912/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const html = fs.readFileSync('index.html');
const report = { status: 'running', before, sha256: createHash('sha256').update(html).digest('hex'), checks: [], errors: [], scope: 'Local Chrome with production CSP, desktop/touch emulation; no physical-device or production test.' };
if (before) fs.writeFileSync(path.join(output, 'index.html'), html);
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600, reducedMotion: 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    const activate = selector => width < 600 ? page.locator(selector).tap() : page.locator(selector).click();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await activate('#gaia-opening-sound-off');
    await page.waitForFunction(() => {
      const panel = document.querySelector('.gaia-vn-panel-prologue');
      const progress = panel?.getAnimations()[0]?.effect.getComputedTiming().progress;
      return progress > .6 && progress < .76 && Number(getComputedStyle(panel).opacity) > .99;
    });
    assert.equal(await page.locator('.gaia-vn-project').count(), before ? 1 : 0);
    if (before) {
      assert.equal(await page.locator('.gaia-vn-project').innerText(), '序章 / 逗子海岸');
      // Existing mobile CSS hides this label; desktop is the reported visible case.
      if (width === 1440) assert(await page.locator('.gaia-vn-project').isVisible());
    } else assert.doesNotMatch(await page.locator('#gaia-opening').textContent(), /序章 \/ 逗子海岸/);
    assert.equal(await page.locator('.gaia-vn-season').count(), 0);
    assert.equal(await page.locator('.gaia-vn-prologue-lockup h2').innerText(), '「はじめまして。」');
    assert.match(await page.locator('.gaia-vn-prologue-copy').textContent(), /画面越しにコードやデータ/);
    assert((await page.locator('.gaia-vn-panel-prologue').evaluate(node => getComputedStyle(node).backgroundImage)).includes('opening-prologue-01'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.screenshot({ path: path.join(output, `${width}-prologue.png`) });
    await activate('#gaia-opening-skip');
    await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
    if (width < 600) {
      await page.locator('#gaia-opening-route-guide.is-visible').waitFor();
      await page.keyboard.press('Escape');
    }
    if (!before) {
      await activate('#gaia-opening-route-story');
      await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor();
      await activate('#gaia-story-prologue button:first-of-type');
      await page.waitForFunction(() => window.GaiaNovel?.getState().stepId === 'festival_concept_001' && document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible');
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push({ width, height, label: before ? 'present' : 'removed', headingAndArtworkPreserved: true, skipToTitle: true, storyEntry: !before });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = before ? 'reproduced' : 'passed';
} catch (error) { report.status = 'failed'; report.error = error.stack; throw error; }
finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify(report));
