import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://127.0.0.1:4447";
const output = path.resolve(process.argv[3] || "artifacts/opening-route-hover");
fs.mkdirSync(output, { recursive: true });
const baselineOnly = process.argv.includes('--baseline-only');
const report = { status: "running", base, baselineOnly, checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
let page;
const readState = () => page.evaluate(() => ({
  active: document.activeElement?.id,
  guide: { hidden: document.querySelector('#gaia-opening-route-guide').hidden, role: document.querySelector('#gaia-opening-route-guide').getAttribute('role'), step: document.querySelector('#gaia-opening-route-guide').dataset.step },
  cards: [...document.querySelectorAll('.gaia-opening-route-grid button')].map(button => ({
    id: button.id, hovered: button.matches(':hover'), focused: button.matches(':focus-visible'),
    before: { animation: getComputedStyle(button, '::before').animationName, opacity: getComputedStyle(button, '::before').opacity },
    after: { animation: getComputedStyle(button, '::after').animationName, opacity: getComputedStyle(button, '::after').opacity },
    animations: button.getAnimations({ subtree: true }).map(animation => ({ name: animation.animationName, state: animation.playState, time: animation.currentTime })),
  })),
}));
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.stack));
  await page.mouse.move(4, 4);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('#gaia-opening-sound-off').click();
  await page.locator('#gaia-opening-skip').click();
  await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu').classList.contains('is-visible'));
  await page.mouse.move(4, 4);
  await page.waitForTimeout(340);
  const initial = await readState();
  report.checks.push({ initial });
  await page.screenshot({ path: path.join(output, 'initial.png') });
  await page.waitForTimeout(3100);
  if (await page.locator('#gaia-opening-route-guide').isVisible()) await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  const story = page.locator('#gaia-opening-route-story');
  for (let pass = 0; pass < 3; pass++) {
    await page.mouse.move(4, 4);
    await page.waitForTimeout(800);
    await story.hover();
    await page.waitForTimeout(170);
    report.checks.push({ hover: pass + 1, state: await readState() });
    await page.screenshot({ path: path.join(output, `story-hover-${pass + 1}.png`) });
  }
  assert(initial.cards.every(card => ![card.before.animation, card.after.animation].some(name => /opening-(route|choice)-(glint|focus-flash)/u.test(name))), 'Untouched route cards must not run selection glints');
  assert(!initial.cards.some(card => card.id === initial.active), 'Do not preselect the story button when the menu appears');
  if (!baselineOnly) {
    await context.close();
    const cases = [
      { name: 'pc1440', width: 1440, height: 900, navigate: true },
      { name: 'pc4k', width: 3840, height: 2160 },
      { name: 'pc150pct', width: 2560, height: 1392, dpr: 1.5 },
      { name: 'pc-reduced', width: 1440, height: 900, reduced: true },
      { name: 'mobile390', width: 390, height: 844, touch: true, navigate: true },
      { name: 'mobile-landscape', width: 844, height: 390, touch: true },
    ];
    const selectedCases = cases.filter(item => !process.env.GAIA_VIEWPORT || process.env.GAIA_VIEWPORT.split(',').includes(item.name));
    assert(selectedCases.length > 0, `Unknown GAIA_VIEWPORT: ${process.env.GAIA_VIEWPORT}`);
    for (const variant of selectedCases) {
      const ctx = await browser.newContext({
        viewport: { width: variant.width, height: variant.height },
        deviceScaleFactor: variant.dpr || 1,
        hasTouch: !!variant.touch, isMobile: !!variant.touch,
        reducedMotion: variant.reduced ? 'reduce' : 'no-preference',
      });
      page = await ctx.newPage();
      page.on('pageerror', error => report.errors.push(`${variant.name}: ${error.stack}`));
      const scan = { name: variant.name, checks: [] };
      report.checks.push(scan);
      const record = (label, state) => scan.checks.push({ label, state });
      const capture = name => page.screenshot({
        path: path.join(output, `${variant.name}-${name}.${variant.width > 2000 ? 'jpg' : 'png'}`),
        ...(variant.width > 2000 ? { type: 'jpeg', quality: 85 } : {}),
      });
      const guide = page.locator('#gaia-opening-route-guide');
      const replay = page.locator('#gaia-opening-route-guide-replay');
      const cards = ['#gaia-opening-route-story', '#gaia-opening-route-other'];
      const detail = () => page.evaluate(() => {
        const guide = document.querySelector('#gaia-opening-route-guide');
        const bubble = guide.querySelector('.gaia-opening-route-guide-bubble');
        return {
          hidden: guide.hidden, role: guide.getAttribute('role'), step: guide.dataset.step,
          active: document.activeElement?.id,
          shade: getComputedStyle(guide.querySelector('.gaia-opening-route-guide-shade')).display,
          pointerEvents: getComputedStyle(guide).pointerEvents,
          bodyDimmed: document.querySelector('#gaia-opening').classList.contains('is-route-guide-active'),
          rect: bubble.getBoundingClientRect().toJSON(), text: bubble.innerText,
          surfaceOpacity: Number(getComputedStyle(guide.querySelector('.gaia-opening-route-guide-surface')).opacity),
          copyOpacity: Number(getComputedStyle(guide.querySelector('[data-route-guide-copy]')).opacity),
          described: [...document.querySelectorAll('.gaia-opening-route-grid button')].map(el => el.getAttribute('aria-describedby')),
          overflowX: document.documentElement.scrollWidth - innerWidth,
          overflowY: document.documentElement.scrollHeight - innerHeight,
        };
      });
      const checkHint = async index => {
        await page.waitForFunction(step => {
          const layer = document.querySelector('#gaia-opening-route-guide');
          return !layer.hidden && layer.classList.contains('is-presented') && layer.dataset.step === String(step);
        }, index + 1);
        await page.waitForTimeout(variant.touch ? 850 : 220);
        const state = await detail();
        assert(state.surfaceOpacity > 0.99 && state.copyOpacity > 0.99, `${variant.name}: hint has not become readable`);
        assert.equal(state.role, variant.touch ? 'dialog' : 'tooltip');
        assert.equal(state.bodyDimmed, !!variant.touch);
        if (!variant.touch) {
          assert.equal(state.shade, 'none');
          assert.equal(state.pointerEvents, 'none');
          assert.match(state.described[index], /gaia-opening-route-guide-copy/u);
          assert.equal(state.described[1 - index], null);
        }
        assert.match(state.text, index === 0 ? /ストーリーを読みながら/u : /探索・分析できます/u);
        assert(state.rect.left >= 0 && state.rect.right <= variant.width + 1, `${variant.name}: hint horizontal clipping`);
        assert(state.rect.top >= 0 && state.rect.bottom <= variant.height + 1, `${variant.name}: hint vertical clipping`);
        assert(state.overflowX <= 0 && state.overflowY <= 0, `${variant.name}: viewport overflow`);
        return state;
      };
      const checkNeutral = async label => {
        const state = await readState();
        record(label, state);
        assert(!state.cards.some(card => card.id === state.active), `${variant.name}: automatic route focus`);
        assert(state.guide.hidden, `${variant.name}: unsolicited help`);
        for (const card of state.cards) {
          assert(!/opening-route/u.test(`${card.before.animation} ${card.after.animation}`), `${variant.name}: unsolicited glint`);
        }
      };
      await page.mouse.move(4, 4);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#gaia-opening-sound-off').click();
      if (!variant.reduced) await page.locator('#gaia-opening-skip').click();
      await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu').classList.contains('is-visible'));
      await page.mouse.move(4, 4);
      await page.waitForTimeout(350);
      await checkNeutral('initial-neutral');
      await capture('initial');
      if (variant.touch) {
        assert(await replay.isVisible(), `${variant.name}: touch guide entry missing`);
        record('touch-auto-guide-story', await checkHint(0));
        await capture('guide-story');
        await guide.locator('.gaia-opening-route-guide-bubble').tap();
        record('touch-guide-data', await checkHint(1));
        await capture('guide-data');
        await guide.locator('.gaia-opening-route-guide-bubble').tap();
        await guide.waitFor({ state: 'hidden' });
        await replay.tap();
        record('touch-replay', await checkHint(0));
        await page.keyboard.press('Escape');
        await guide.waitFor({ state: 'hidden' });
      } else {
        assert(!await replay.isVisible(), `${variant.name}: desktop guide entry remains`);
        await page.waitForTimeout(3300);
        await checkNeutral('after-old-auto-guide-delay');
        for (let pass = 1; pass <= 3; pass++) {
          for (const [index, selector] of cards.entries()) {
            await page.mouse.move(4, 4);
            await guide.waitFor({ state: 'hidden' });
            await page.locator(selector).hover();
            // Inspect the real pseudo animations before they finish, without
            // freezing them or bypassing the browser's pointer/focus events.
            await page.waitForTimeout(100);
            const state = await readState();
            const card = state.cards[index];
            if (!variant.reduced) {
              assert.equal(card.after.animation, 'opening-route-glint');
              assert.equal(card.before.animation, 'opening-route-focus-flash');
              assert(Number(card.after.opacity) > 0.1 && Number(card.before.opacity) > 0.1, `${variant.name}: invisible reflection`);
              assert(card.animations.some(animation => animation.name === 'opening-route-glint' && animation.state === 'running' && animation.time < 680));
            } else assert(!/opening-route/u.test(`${card.before.animation} ${card.after.animation}`));
            record(`hover-${index + 1}-pass-${pass}`, state);
            await checkHint(index);
            if (pass === 1) await capture(index === 0 ? 'hover-story' : 'hover-data');
            await page.waitForTimeout(850);
            const ended = await readState();
            assert.equal(ended.cards[index].after.animation, 'none');
            assert(!ended.guide.hidden, 'Hint must remain while the pointer is on the card');
          }
        }
        await guide.locator('.gaia-opening-route-guide-bubble').hover();
        await page.waitForTimeout(700);
        assert(await guide.isVisible(), 'Hint must remain while its bubble is hovered');
        record('hover-bubble-persistent', await detail());
        await page.keyboard.press('Escape');
        await guide.waitFor({ state: 'hidden' });
        await page.waitForTimeout(700);
        assert(!await guide.isVisible(), 'Escape must dismiss until a new selection');
        await page.mouse.move(4, 4);
        await page.keyboard.press('Tab');
        // Neutral group is before the two route buttons in the tab order.
        assert.equal(await page.evaluate(() => document.activeElement.id), 'gaia-opening-route-story');
        record('keyboard-story', await checkHint(0));
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'gaia-opening-route-other');
        record('keyboard-data', await checkHint(1));
        await page.keyboard.press('Shift+Tab');
        await checkHint(0);
        await page.keyboard.press('Escape');
        await guide.waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => document.activeElement.id), 'gaia-opening-route-story', 'Escape must not move keyboard focus');
        // A focus-preserving re-entry used to compete with completed animations.
        for (let pass = 0; pass < 2; pass++) {
          await page.mouse.move(4, 4);
          await page.locator(cards[0]).hover();
          await checkHint(0);
          const state = await readState();
          if (!variant.reduced) assert.equal(state.cards[0].after.animation, 'opening-route-glint');
          record(`focused-pointer-reentry-${pass + 1}`, state);
          await page.waitForTimeout(850);
        }
        await page.mouse.move(4, 4);
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await guide.waitFor({ state: 'hidden' });
        record('blur-hides-hint', await detail());
      }
      if (variant.navigate) {
        if (!variant.touch) await page.locator(cards[1]).hover();
        await page.locator(cards[1]).click();
        await page.waitForFunction(() => location.hash === '#top' && document.querySelector('#gaia-opening').hidden);
        await page.locator('#intro-title-return').waitFor({ state: 'visible' });
        record('data-real-destination', { url: page.url() });
        await capture('data-destination');
        await page.locator('#intro-title-return').click();
        await page.mouse.move(4, 4);
        await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu').classList.contains('is-visible'));
        await page.waitForTimeout(350);
        await checkNeutral('returned-title-neutral');
        if (variant.touch) {
          await checkHint(0);
          await page.keyboard.press('Escape');
          await guide.waitFor({ state: 'hidden' });
        } else {
          await page.waitForTimeout(3300);
          await checkNeutral('returned-title-no-auto-guide');
          await page.locator(cards[0]).hover();
          await checkHint(0);
        }
        await page.locator(cards[0]).click();
        await page.waitForFunction(() => location.hash === '#story' && document.querySelector('#gaia-opening').hidden && document.body.classList.contains('novel-open'));
        await page.locator('#novel-layer').waitFor({ state: 'visible' });
        record('story-real-destination', { url: page.url() });
        await capture('story-destination');
      }
      scan.passed = true;
      console.log(`${variant.name}: passed (${scan.checks.length} checks)`);
      await ctx.close();
    }
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
