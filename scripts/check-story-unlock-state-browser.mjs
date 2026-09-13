import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const normalMotion = process.argv.includes('--motion=normal');
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/story-unlock-state-2026-09-10/${before ? 'before' : normalMotion ? 'after-normal-motion' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const progressKey = 'gaiaSensewareNovel:progress';
const pendingKey = 'gaiaSensewareTrueEnd:pending:v1';
const completeKey = 'gaiaSensewareTrueEnd:complete:v1';
const selector = '.intro-story-return[data-primary-action="true"]';
const report = { status: 'running', base, before, normalMotion, checks: [], errors: [], violations: [], hashes: {},
  environment: 'Installed Chrome; real same-origin files, production CSP, external APIs blocked. Isolated storage fixtures followed by native clicks/taps, not user browser data or physical devices.' };
for (const f of ['app.js', 'novel-mode.js', 'true-end-mode.js', 'gaia-mode-loader.js', 'index.html']) report.hashes[f] = createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const scan = () => page.evaluate(({ selector, progressKey, pendingKey, completeKey }) => ({
  destination: document.querySelector(selector)?.dataset.storyDestination,
  title: document.querySelector(selector)?.innerText,
  stored: JSON.parse(localStorage.getItem(progressKey) || 'null'),
  pending: localStorage.getItem(pendingKey), complete: localStorage.getItem(completeKey),
  runtime: globalThis.GaiaNovel?.getState?.(),
}), { selector, progressKey, pendingKey, completeKey });
const waitStory = () => page.waitForFunction(() => globalThis.GaiaNovel && document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible' && document.querySelector('#novel-text')?.dataset.revealState === 'complete');
try {
  for (const [name, width, height] of [['pc', 1440, 900], ['mobile', 390, 844]].filter(s => !only || s[0] === only)) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900, isMobile: width < 900, reducedMotion: normalMotion ? 'no-preference' : 'reduce', acceptDownloads: true });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await context.addInitScript(normal => {
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
      localStorage.setItem('gaiaSensewareNovel:config:v4', JSON.stringify({ messageSpeedPercent: 400, reducedMotion: !normal }));
    }, normalMotion);
    page = await context.newPage();
    page.on('pageerror', e => report.errors.push({ name, message: e.message }));
    const activate = s => width < 900 ? page.locator(s).tap() : page.locator(s).click();
    // Seed the exact contradictory state: a current unfinished save and an old pending marker.
    await page.goto(base + '/story', { waitUntil: 'domcontentloaded' });
    await waitStory();
    await page.evaluate(({ progressKey, pendingKey }) => {
      const progress = GaiaNovel.getState();
      Object.assign(progress, { stepId: 'festival_concept_006', clear: false, archivesUnlocked: false, trueEndComplete: false, sessionId: 'unfinished-current-run' });
      localStorage.setItem(progressKey, JSON.stringify(progress));
      localStorage.setItem(pendingKey, '2026-09-09T00:00:00.000Z');
    }, { progressKey, pendingKey });
    // The real title/story entrance starts a new run but must not inherit that marker.
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await activate('#gaia-opening-sound-off');
    await page.locator('#gaia-opening-final-menu.is-visible').waitFor();
    if (width < 900) {
      await page.locator('#gaia-opening-route-guide.is-visible').waitFor();
      await page.keyboard.press('Escape');
    }
    await activate('#gaia-opening-route-story');
    await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor();
    await activate('#gaia-story-prologue button:first-of-type');
    await waitStory();
    assert.equal((await scan()).runtime.clear, false);
    await activate('#novel-home-button');
    await page.locator('#intro-layer[aria-hidden="false"]').waitFor();
    if (await page.locator('#intro-entry-guide').isVisible()) await page.keyboard.press('Escape');
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    const returned = await scan();
    assert.equal(returned.stored.clear, false);
    assert.equal(returned.runtime.clear, false);
    assert.equal(returned.destination, before ? 'apeironcene' : 'story');
    await page.screenshot({ path: path.join(output, name + '-unfinished-return.png') });
    report.checks.push({ name, check: 'native title → story first scene → home with old pending marker', returned });
    if (!before) {
      assert.equal(returned.pending, null, 'A new unfinished run removes only the stale pending marker');
      await activate(selector);
      await waitStory();
      assert.equal(await page.locator('.true-end-shell').count(), 0);
      assert.equal((await scan()).runtime.clear, false);
      report.checks.push({ name, check: 'primary CTA still starts the main story, not APEIRONCENE' });
    }
    report.violations.push(...await page.evaluate(() => window.__securityViolations || []));
    await context.close();
    console.log('PASS ' + name);
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.violations, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
