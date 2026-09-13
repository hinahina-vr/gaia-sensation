import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4447';
const output = path.resolve(process.argv[3] || 'artifacts/sound-choice-game-ui');
const baseline = process.argv.includes('--baseline');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', base, baseline, files: {}, cases: [], errors: [] };
for (const file of ['opening.css', 'opening.js', 'index.html']) {
  report.files[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const variants = [
  { name: 'pc1440', width: 1440, height: 900 },
  { name: 'pc4k', width: 3840, height: 2160 },
  { name: 'mobile390', width: 390, height: 844, touch: true },
  { name: 'mobile320', width: 320, height: 568, touch: true },
  { name: 'landscape', width: 844, height: 390, touch: true },
  { name: 'reduced', width: 1440, height: 900, reduced: true },
].filter(item => !process.env.GAIA_VIEWPORT || process.env.GAIA_VIEWPORT.split(',').includes(item.name));
const read = page => page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - innerWidth,
  audio: globalThis.GaiaOpeningAudio?.getState(),
  buttons: [...document.querySelectorAll('.gaia-opening-sound-option-button')].map(el => ({
    id: el.id, rect: el.getBoundingClientRect().toJSON(),
    label: el.querySelector('.gaia-opening-sound-option-label').getBoundingClientRect().toJSON(),
    copy: el.querySelector('.gaia-opening-sound-option-copy').getBoundingClientRect().toJSON(),
    disabled: el.disabled, selected: el.getAttribute('aria-pressed'),
    before: { animation: getComputedStyle(el, '::before').animationName, opacity: getComputedStyle(el, '::before').opacity },
    after: { animation: getComputedStyle(el, '::after').animationName, opacity: getComputedStyle(el, '::after').opacity, transform: getComputedStyle(el, '::after').transform },
    background: getComputedStyle(el).backgroundImage, shadow: getComputedStyle(el).boxShadow,
    animations: el.getAnimations({ subtree: true }).map(a => ({ name: a.animationName, time: a.currentTime })),
  })),
}));
try {
  for (const variant of variants) {
    const ctx = await browser.newContext({ viewport: { width: variant.width, height: variant.height }, hasTouch: !!variant.touch, isMobile: !!variant.touch, reducedMotion: variant.reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    page.on('pageerror', error => report.errors.push(`${variant.name}: ${error.stack}`));
    await page.mouse.move(2, 2);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-opening-sound-modal.is-visible').waitFor();
    await page.waitForTimeout(900);
    const scan = { name: variant.name, initial: await read(page), hovers: [] };
    report.cases.push(scan);
    await page.screenshot({ path: path.join(output, `${variant.name}-initial.png`) });
    for (const button of scan.initial.buttons) {
      assert(button.rect.x >= 0 && button.rect.right <= variant.width, `${variant.name}: button outside viewport`);
      assert(button.rect.y >= 0 && button.rect.bottom <= variant.height, `${variant.name}: button outside screen`);
      assert(button.rect.height >= 44, `${variant.name}: touch target`);
      assert(button.label.width <= button.copy.width + 1, `${variant.name}: label overflow`);
    }
    assert(scan.initial.overflow <= 1, `${variant.name}: horizontal overflow`);
    if (baseline) { await ctx.close(); continue; }
    if (!variant.touch) {
      for (const id of ['gaia-opening-sound-on', 'gaia-opening-sound-off']) {
        const button = page.locator(`#${id}`);
        // Keep keyboard focus on the card: hover must still retrigger each time.
        await button.focus();
        for (let repeat = 0; repeat < 3; repeat++) {
          await page.mouse.move(2, 2);
          await page.waitForTimeout(750);
          await button.hover();
          await page.waitForTimeout(160);
          const current = (await read(page)).buttons.find(el => el.id === id);
          scan.hovers.push({ id, repeat, state: current });
          if (variant.reduced) assert.equal(current.after.animation, 'none');
          else {
            assert.equal(current.after.animation, 'sound-choice-sheen');
            assert(Number(current.after.opacity) > 0, 'Visible sheen in real computed style');
          }
          if (repeat === 0) await page.screenshot({ path: path.join(output, `${variant.name}-${id}-hover.png`) });
        }
      }
    }
    await page.mouse.move(2, 2);
    await page.waitForTimeout(750);
    const settled = await read(page);
    assert(settled.buttons.every(el => !el.animations.some(a => /^sound-choice-/u.test(a.name))), 'No recurring selection flash while idle');
    // Capture a real click's synchronous selected feedback, before the existing
    // double-rAF handoff. Do not hold the app or extend the transition for QA.
    await page.evaluate(() => {
      document.querySelector('#gaia-opening-sound-off').addEventListener('click', () => {
        const on = document.querySelector('#gaia-opening-sound-on');
        const off = document.querySelector('#gaia-opening-sound-off');
        globalThis.__soundGameClick = {
          onDisabled: on.disabled, offDisabled: off.disabled,
          onSelected: on.getAttribute('aria-pressed'), offSelected: off.getAttribute('aria-pressed'),
          animation: getComputedStyle(off, '::after').animationName,
          audio: globalThis.GaiaOpeningAudio.getState(),
        };
      }, { once: true });
    });
    if (variant.touch) await page.locator('#gaia-opening-sound-off').tap();
    else { await page.locator('#gaia-opening-sound-off').focus(); await page.keyboard.press('Enter'); }
    scan.click = await page.evaluate(() => globalThis.__soundGameClick);
    assert(scan.click.onDisabled && scan.click.offDisabled);
    assert.equal(scan.click.onSelected, 'false');
    assert.equal(scan.click.offSelected, 'true');
    assert.equal(scan.click.animation, variant.reduced ? 'none' : 'sound-choice-confirm');
    await page.locator('#gaia-opening-sound-modal').waitFor({ state: 'hidden' });
    scan.handoff = await page.evaluate(() => ({
      awaiting: document.querySelector('#gaia-opening').classList.contains('is-awaiting-sound'),
      muted: globalThis.GaiaOpeningAudio.getState().muted,
      marks: performance.getEntriesByType('mark').filter(mark => /sound-choice|opening-preload/u.test(mark.name)).map(mark => ({ name: mark.name, time: mark.startTime })),
    }));
    assert.equal(scan.handoff.awaiting, false);
    assert.equal(scan.handoff.muted, true);
    await ctx.close();
    console.log(`${variant.name}: PASS`);
  }
  assert.equal(report.errors.length, 0);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
