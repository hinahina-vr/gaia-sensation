import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const copyOnly = process.argv.includes('--copy-only');
const output = path.resolve('artifacts/map-data-intros-2026-09-26/concise-copy');
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktree: 'uncommitted changes', copyOnly, environment: 'Installed headless Chrome, local CSP; external APIs blocked, local saved datasets. Title animation accelerated 20x for menu sweep (representative entries in copy-only mode); separate wind regression uses natural timing. Layout matrix injects catalog text, not provider navigation. Mobile emulation, not physical devices or production.',
  hashes: Object.fromEntries(['app.js', 'map-ui-grid-polish.css', 'index.html', 'gaia-mode-loader.js', 'src/exploration/map-data-intro-catalog.js'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
  navigation: [], layout: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const dimensions = async () => page.locator('#map-data-intro').evaluate(node => {
  const band = document.querySelector('#map-title-transition');
  const r = band.getBoundingClientRect();
  const height = parseFloat(getComputedStyle(band, '::before').height);
  return { number: node.dataset.exhibitNumber, text: node.textContent.trim(), visible: !node.hidden,
    subject: node.querySelector('[data-intro-subject]').textContent,
    reading: node.querySelector('[data-intro-reading]').textContent,
    status: node.querySelector('#map-data-intro-status').textContent,
    height, top: r.top + (r.height - height) / 2, bottom: r.top + (r.height + height) / 2,
    boxes: [...node.querySelectorAll('p,small')].filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect().toJSON()),
    titleRunning: document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),
    overflow: document.documentElement.scrollWidth - innerWidth };
});
function fits(scan, width, label) {
  assert.equal(scan.overflow, 0, `${label}: viewport overflow`);
  for (const r of scan.boxes) assert(r.left >= 0 && r.right <= width + 1 && r.top >= scan.top - 1 && r.bottom <= scan.bottom + 1,
    `${label}: outside ${scan.height}px band: ${JSON.stringify(r)}`);
  if (width === 320) assert(scan.boxes.every(r => r.left >= 59), `${label}: zoom-rail clearance`);
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await enforceBrowserSecurity(context, base);
  await context.route('https://**', route => route.abort());
  await context.addInitScript(() => {
    localStorage.setItem('gaia:language:v1', 'ja');
    setInterval(() => {
      for (const animation of document.getAnimations()) {
        if (/^map-title-/.test(animation.animationName || '')) animation.playbackRate = 20;
      }
    }, 40);
  });
  page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(`${base}/#world-01`, { waitUntil: 'domcontentloaded' });
  await page.locator('#gaia-boot').waitFor({ state: 'hidden', timeout: 60000 });
  const select = async number => {
    await page.locator('[data-map-menu-toggle]').click();
    const scope = +number >= 15 && +number <= 69 ? 'japan' : 'world';
    const tab = page.locator(`.map-mode-bank [role="tab"][data-map-scope="${scope}"]`);
    if (await tab.getAttribute('aria-selected') !== 'true') {
      // Keyboard route avoids the pre-existing legend overlap over the tab.
      await tab.focus(); await tab.press('Enter');
    }
    const tile = page.locator('.map-mode-bank .map-mode-button').filter({ hasText: new RegExp(`^${number}$`) });
    await tile.scrollIntoViewIfNeeded();
    await tile.focus(); await tile.press('Enter');
  };
  for (const index of copyOnly ? [1,2,4,8,16,32,65,68,70,71] : Array.from({ length: 71 }, (_, i) => i + 1)) {
    const number = String(index).padStart(2, '0');
    if (index > 1) await select(number);
    await page.waitForFunction(number => {
      const intro = document.querySelector('#map-data-intro');
      return intro?.dataset.exhibitNumber === number && !intro.hidden && Number(getComputedStyle(intro).opacity) > .98;
    }, number, { timeout: 45000 });
    const scan = await dimensions();
    const expected = await page.evaluate(number => GaiaMapDataIntro.entries[number], number);
    assert.equal(scan.subject, expected.subject, `${number}: subject`);
    assert.equal(scan.reading, expected.reading, `${number}: reading`);
    assert.doesNotMatch(scan.text, /ではありません|ではなく|できません|分かりません|していません/);
    assert.equal(scan.titleRunning, false);
    fits(scan, 1440, number);
    report.navigation.push(scan);
    if ([4,6,16,22,31,49,65,68,70].includes(index)) await page.screenshot({ path: path.join(output, `desktop-${number}.png`) });
    if (index % 10 === 0) console.log(`PASS menu ${number}/71`);
  }
  assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
  // Full text/font geometry matrix, including the longest fallback/status note.
  // This intentionally isolates typography from provider fetch timings.
  await page.addStyleTag({ content: '#map-data-intro { display: grid !important; opacity: 1 !important; animation: none !important; } .japan-layer.is-map-data-intro .map-title-transition { animation: none !important; opacity: 1 !important; }' });
  for (const [width, height] of [[320,568], [390,844], [844,390]]) {
    await page.setViewportSize({ width, height });
    for (const language of ['ja', 'en', 'zh-CN']) {
      await page.evaluate(language => GaiaI18n.set(language), language);
      await page.evaluate(() => document.fonts.ready);
      for (let index = 1; index <= 71; index++) {
        const number = String(index).padStart(2, '0');
        await page.evaluate(number => {
          const node = document.querySelector('#map-data-intro');
          document.querySelector('#japan-layer').classList.add('is-map-data-intro');
          const entry = GaiaMapDataIntro.entries[number];
          node.dataset.exhibitNumber = number;
          for (const key of ['subject', 'reading', 'source']) node.querySelector(`[data-intro-${key}]`).textContent = GaiaI18n.t(entry[key]);
          node.querySelector('#map-data-intro-status').textContent = GaiaI18n.t(entry.kind === 'planet'
            ? number === '01' ? GaiaMapDataIntro.messages.windSample : GaiaMapDataIntro.messages.sample
            : ['records', 'food', 'live', 'firms'].includes(entry.kind) ? GaiaMapDataIntro.messages.error : '');
        }, number);
        const scan = await dimensions();
        fits(scan, width, `${width}/${language}/${number}`);
        report.layout.push({ width, height, language, number, bandHeight: scan.height, textTop: Math.min(...scan.boxes.map(r=>r.top)), textBottom: Math.max(...scan.boxes.map(r=>r.bottom)) });
        if (width === 320 && ['ja','en'].includes(language) && [4,16,49,55,68].includes(index)) await page.screenshot({ path: path.join(output, `layout-${width}-${language}-${number}.png`) });
      }
      console.log(`PASS layout ${width}/${language}: 71`);
    }
  }
  await context.close();
  // Real direct routes on narrow/mobile and a landscape viewport, without
  // accelerated animations or injected typography. Covers non-wind providers.
  for (const [number, width, height] of [['04',390,844],['16',320,568],['31',390,844],['49',844,390],['68',320,568],['70',390,844]]) {
    const mobile = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
    await enforceBrowserSecurity(mobile, base);
    await mobile.route('https://**', route => route.abort());
    page = await mobile.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(`${base}/#world-${number}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(number => {
      const intro = document.querySelector('#map-data-intro');
      return intro?.dataset.exhibitNumber === number && !intro.hidden && Number(getComputedStyle(intro).opacity) > .98;
    }, number, { timeout: 60000 });
    const scan = await dimensions(); fits(scan, width, `direct/${number}/${width}`);
    assert.equal(scan.subject, await page.evaluate(number => GaiaMapDataIntro.entries[number].subject, number));
    await page.screenshot({ path: path.join(output, `mobile-${number}-${width}.png`) });
    await page.locator('[data-mobile-sheet="tools"]').tap();
    await page.locator('#map-mobile-sheet').waitFor({ state: 'visible' });
    assert(await page.locator('#map-data-intro').isHidden(), `${number}: dismiss without swallowing tap`);
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.navigation.push({ direct: true, width, height, ...scan });
    await mobile.close();
    console.log(`PASS mobile direct ${number}`);
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(()=>{});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(`PASS ${report.navigation.length} navigation cases, ${report.layout.length} typography cases`);
