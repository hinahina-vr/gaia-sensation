import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4447';
const record = process.argv.includes('--record');
const output = path.resolve(process.argv[3] || 'artifacts/opening-four-voices');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', base, record, files: {}, cases: [], errors: [] };
for (const file of ['index.html', 'opening.js', 'opening.css']) report.files[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let activePage;
const variants = [
  { name: 'pc1440', width: 1440, height: 900 },
  { name: 'pc4k', width: 3840, height: 2160 },
  { name: 'mobile390', width: 390, height: 844, touch: true },
  { name: 'mobile320', width: 320, height: 568, touch: true },
].filter(item => !process.env.GAIA_VIEWPORT || process.env.GAIA_VIEWPORT.split(',').includes(item.name));
try {
  for (const variant of variants) {
    const context = await browser.newContext({ viewport: { width: variant.width, height: variant.height }, hasTouch: !!variant.touch, isMobile: !!variant.touch, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(60_000);
    page.on('pageerror', error => report.errors.push(`${variant.name}: ${error.stack}`));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-opening-sound-off').click();
    await page.locator('#gaia-opening.is-active').waitFor();
    // Wait against the real CSS timeline, not an assumed sound/preload delay.
    const scan = { name: variant.name, frames: [] };
    report.cases.push(scan);
    if (!record) {
      await page.waitForFunction(() => document.querySelector('.gaia-vn-panel-montage').getAnimations().find(a => a.animationName === 'opening-panel-calm')?.currentTime >= 12600);
      scan.earth = await page.evaluate(() => ({
        panelOpacity: Number(getComputedStyle(document.querySelector('.gaia-vn-panel-real-earth')).opacity),
        lines: [...document.querySelectorAll('.gaia-vn-real-earth-copy [data-opening-focus]')].map(el => ({ text: el.textContent, opacity: Number(getComputedStyle(el).opacity), pending: el.classList.contains('is-opening-focus-pending') })),
      }));
      assert(scan.earth.panelOpacity > .9 && scan.earth.lines.every(el => !el.pending && el.opacity > .99), 'All three real-earth text blocks must appear during their own scene');
      await page.screenshot({ path: path.join(output, `${variant.name}-real-earth.png`) });
    }
    for (const time of [15600, 16200]) {
      await page.waitForFunction(ms => {
        const animation = document.querySelector('.gaia-vn-panel-montage').getAnimations().find(a => a.animationName === 'opening-panel-calm');
        return animation?.currentTime >= ms;
      }, time);
      const state = await page.evaluate(() => {
        const panel = document.querySelector('.gaia-vn-panel-montage');
        return {
          time: panel.getAnimations().find(a => a.animationName === 'opening-panel-calm')?.currentTime,
          panelOpacity: Number(getComputedStyle(panel).opacity),
          finalOpacity: Number(getComputedStyle(document.querySelector('.gaia-vn-panel-final')).opacity),
          rows: [...document.querySelectorAll('.gaia-vn-word-rails p')].map(row => {
            const label = row.querySelector('strong');
            const range = document.createRange(); range.selectNodeContents(label);
            return {
              text: label.textContent, pending: label.classList.contains('is-opening-focus-pending'),
              opacity: Number(getComputedStyle(label).opacity), blur: getComputedStyle(label).filter,
              rowOpacity: Number(getComputedStyle(row).opacity), rowBlur: getComputedStyle(row).filter,
              textRect: range.getBoundingClientRect().toJSON(), rect: row.getBoundingClientRect().toJSON(),
            };
          }),
          timings: [...document.querySelectorAll('[data-opening-focus]')].map(el => ({ text: el.textContent.trim().slice(0, 35), timing: el.dataset.openingFocus })),
        };
      });
      scan.frames.push(state);
      // A 4K PNG can take longer than the 600ms sampling interval to encode.
      // Collect both live states first; capture only the second frame so QA
      // does not miss the scene while waiting for its own image output.
      if (time === 16200) await page.screenshot({ path: path.join(output, `${variant.name}-${time}.png`) });
      if (!record) {
        assert.equal(state.rows.length, 4);
        assert.deepEqual(state.rows.map(row => row.text), ['感じる。', '測る。', 'つなぐ。', 'ともに選ぶ。']);
        assert(state.panelOpacity > .9 && state.finalOpacity < .05, 'Check the actual montage before the title transition');
        for (const row of state.rows) {
          assert(!row.pending && row.opacity > .99 && row.rowOpacity > .95, `${variant.name}: ${row.text} missing at ${time}`);
          // At 15.6s the row's own entrance is still completing (under 0.1px
          // blur). By 16.2s both the text and its parent must be fully sharp.
          const rowBlur = Number(row.rowBlur.match(/blur\(([\d.]+)px\)/u)?.[1] ?? Infinity);
          assert(row.blur === 'blur(0px)' && rowBlur <= (time < 16000 ? .1 : 0), `${variant.name}: text not sharp`);
          assert(row.textRect.x >= 0 && row.textRect.right <= variant.width + 1 && row.textRect.y >= 0 && row.textRect.bottom <= variant.height + 1, `${variant.name}: text clipped`);
        }
        assert(state.timings.every(item => /^\d+ \d+$/u.test(item.timing)), 'Every focus target has explicit timing');
      }
    }
    if (!record) {
      await page.locator('#gaia-opening-final-menu.is-visible').waitFor();
      await page.locator('#gaia-opening-route-story').waitFor();
      // Normal playback retains the title's own delayed text entrance; unlike
      // Skip it does not settle all text at the first menu frame.
      await page.waitForFunction(() => document.querySelectorAll('[data-opening-focus].is-opening-focus-pending').length === 0, null, { timeout: 3000 });
      scan.menuReached = true;
    }
    console.log(`${variant.name}: ${record ? 'recorded' : 'passed'}`);
    await context.close();
  }
  assert.equal(report.errors.length, 0);
  report.status = record ? 'recorded' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  if (activePage && !activePage.isClosed()) {
    report.failurePage = await activePage.evaluate(() => ({
      rootClass: document.documentElement.className, bodyClass: document.body.className,
      openingClass: document.querySelector('#gaia-opening')?.className,
      styles: [...document.styleSheets].map(sheet => sheet.href),
      boot: document.querySelector('#gaia-boot')?.outerHTML.slice(0, 800),
    })).catch(() => null);
    await activePage.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  }
  throw error;
}
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
