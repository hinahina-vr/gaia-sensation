import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(`artifacts/sound-back-glint-20260912/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', before, checks: [], errors: [], missing: [], scope: 'Installed Chrome, real local UI under production CSP. Desktop and touch emulation; not physical devices or production. Native elapsed animation checks plus explicitly frozen CSS-animation frames for visual evidence. External APIs blocked.', hashes: Object.fromEntries(['app.js', 'gaia-mode-loader.js', 'index.html', 'styles.css', 'button-glint.js'].filter(file => fs.existsSync(file)).map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])) };
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let page;
try {
  for (const [width, height, reduced] of before ? [[1440, 900, false]] : [[1440, 900, false], [390, 844, false], [1440, 900, true], [390, 844, true]]) {
  const label = `${width}-${reduced ? 'reduced' : 'motion'}`;
  const mobile = width < 600;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await enforceBrowserSecurity(context, base);
  await context.route('https://**', route => route.abort());
  page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() === 404) report.missing.push(response.url()); });
  const scan = () => page.evaluate(() => {
    const button = document.querySelector('#sound-close');
    const glint = document.querySelector('.gaia-global-button-glint');
    return { count: document.querySelectorAll('.gaia-global-button-glint').length, button: button.getBoundingClientRect().toJSON(), buttonHovered: button.matches(':hover'), buttonFocused: document.activeElement === button, appLoaded: [...document.scripts].some(script => /\/app\.js\?/.test(script.src)), active: glint?.classList.contains('is-active') || false, glint: glint?.getBoundingClientRect().toJSON(), opacity: glint ? getComputedStyle(glint).opacity : null, display: glint ? getComputedStyle(glint).display : null, animation: glint ? getComputedStyle(glint).animationName : null, sweepTransform: glint ? getComputedStyle(glint, '::before').transform : null, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  const record = async phase => { const value = await scan(); report.checks.push({ label, phase, ...value }); return value; };
  const ready = async () => { await page.locator('#sound-layer.is-open').waitFor(); await page.locator('#gaia-boot').waitFor({ state: 'hidden' }); };
  const away = () => page.mouse.move(width - 2, height - 2);
  const assertGlint = value => {
    assert.equal(value.count, 1);
    assert.equal(value.overflow, 0);
    if (reduced) { assert.equal(value.display, 'none'); assert.equal(value.active, false); }
    else {
      assert.equal(value.active, true);
      assert.equal(value.animation, 'gaia-button-glint-frame');
      assert(Number(value.opacity) > 0.9, `Glint was not visibly painted: ${value.opacity}`);
      for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(value.button[key] - value.glint[key]) < 1, `Misaligned ${key}`);
    }
  };
  await page.goto(base + '/#sound', { waitUntil: 'domcontentloaded' });
  await ready();
  await away(); await page.locator('#sound-close').hover();
  await page.waitForTimeout(180);
  const direct = await scan();
  assert(direct.buttonHovered); assert.equal(direct.appLoaded, false);
  assert.equal(direct.count, before ? 0 : 1);
  assert.equal(direct.active, !before && !reduced);
  if (!before) assertGlint(direct);
  await page.screenshot({ path: path.join(output, `${label}-direct-sound-hover.png`), clip: { x: 0, y: 0, width: 180, height: 92 } });
  report.checks.push({ label, phase: 'direct sound hover, no map dependency', ...direct });
  await away(); await page.locator('#sound-close').focus();
  await page.waitForTimeout(180);
  const focus = await record('direct sound focus'); assert(focus.buttonFocused); assert.equal(focus.active, !before && !reduced);
  if (before) {
    await page.evaluate(() => GaiaModeLoader.load('exploration'));
    await page.locator('.gaia-global-button-glint').waitFor({ state: 'attached' });
    await record('after loading exploration dependency');
  } else {
    await page.keyboard.press('Tab');
    assert.equal((await scan()).buttonFocused, false);
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(180);
    const keyboard = await record('native keyboard traversal back to return');
    assert(keyboard.buttonFocused); assertGlint(keyboard);
    await page.waitForTimeout(760);
    assert.equal((await record('animation ends without leaving a frame')).active, false);
    for (let repeat = 0; repeat < 2; repeat++) {
      await away(); await page.locator('#sound-close').hover(); await page.waitForTimeout(140);
      assertGlint(await record(`repeat hover ${repeat + 1}`));
      await away(); await page.waitForTimeout(35);
      assert.equal((await scan()).active, false);
    }
    if (!reduced) {
      await page.locator('#sound-close').hover();
      for (const time of [70, 120, 180]) {
        await page.locator('.gaia-global-button-glint').evaluate((node, time) => {
          for (const animation of node.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = time; }
        }, time);
        await page.screenshot({ path: path.join(output, `${label}-frozen-sweep-${time}ms.png`), clip: { x: 0, y: 0, width: 180, height: 92 } });
        await record(`CSS animation frozen at ${time}ms for visual evidence`);
      }
      await away();
      // Exercise the retained moving/hidden/covered-button safeguards separately.
      for (const mutation of ['hidden', 'moved', 'covered', 'disabled']) {
        await page.locator('#sound-close').hover(); await page.waitForTimeout(140);
        assertGlint(await scan());
        await page.evaluate(mutation => {
          const button = document.querySelector('#sound-close');
          if (mutation === 'hidden') button.style.visibility = 'hidden';
          if (mutation === 'moved') button.style.translate = '12px 0';
          if (mutation === 'disabled') button.disabled = true;
          if (mutation === 'covered') {
            const cover = document.createElement('div'); cover.id = 'qa-glint-cover';
            cover.style.cssText = 'position:fixed;inset:0;z-index:2147483001;background:transparent'; document.body.append(cover);
          }
        }, mutation);
        await page.waitForTimeout(55);
        assert.equal((await record(`${mutation} return cancels its frame`)).active, false);
        await away();
        await page.evaluate(() => { const button = document.querySelector('#sound-close'); button.style.removeProperty('visibility'); button.style.removeProperty('translate'); button.disabled = false; document.querySelector('#qa-glint-cover')?.remove(); });
      }
    }
    if (mobile) {
      await away();
      const rect = await page.locator('#sound-close').boundingBox();
      const session = await context.newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }] });
      await page.waitForTimeout(140);
      assertGlint(await record('native touch contact feedback'));
      await page.screenshot({ path: path.join(output, `${label}-touch-contact.png`), clip: { x: 0, y: 0, width: 180, height: 92 } });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await session.detach();
    } else await page.locator('#sound-close').click();
    await page.locator('#sound-layer').waitFor({ state: 'hidden' });
    await page.waitForTimeout(40);
    assert.equal((await record('native return closes sound and clears old glint')).active, false);
    assert.equal(await page.evaluate(() => location.hash), '#top');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#intro-layer[aria-hidden="false"]').waitFor();
    await page.locator('#gaia-boot').waitFor({ state: 'hidden' });
    const titleEntry = page.locator('.intro-path-card--sound');
    if (mobile) await titleEntry.tap(); else await titleEntry.click();
    await ready();
    await away(); await page.locator('#sound-close').hover(); await page.waitForTimeout(140);
    const title = await record('title card entry with map already initialized');
    assert(title.appLoaded); assertGlint(title);
    // Re-running the shared initializer must not attach duplicate layers/listeners.
    await page.addScriptTag({ url: `${base}/button-glint.js?v=shared-mode-glint-20260912` });
    assert.equal((await record('idempotent shared initializer')).count, 1);
    await page.locator('#sound-close').focus(); await page.keyboard.press('Enter');
    await page.locator('#sound-layer').waitFor({ state: 'hidden' });
    await page.waitForTimeout(800);
    assert.equal((await record('keyboard return restores title')).active, false);
    assert.equal(await titleEntry.evaluate(button => button === document.activeElement), true);
    await page.screenshot({ path: path.join(output, `${label}-returned-title.png`) });
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
  assert.deepEqual(report.missing, []);
  await context.close(); console.log(`PASS ${label}`);
  }
  report.status = before ? 'reproduced' : 'passed';
} catch (error) { report.status = 'failed'; report.error = error.stack; if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); throw error; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
console.log(JSON.stringify(report));
