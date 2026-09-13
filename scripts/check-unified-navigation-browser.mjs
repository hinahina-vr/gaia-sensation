import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const baseline = process.argv.includes('--baseline');
const selectedWidths = process.env.GAIA_NAV_WIDTHS?.split(',').map(Number);
const output = path.resolve('artifacts/unified-navigation');
fs.mkdirSync(output, { recursive: true });
const port = process.env.GAIA_NAV_PORT || '4498';
const server = spawn(process.execPath, ['scripts/serve-sensor-platform-qa.mjs', port], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const base = `http://127.0.0.1:${port}`;
const report = { status: 'running', baseline, environment: 'Local Chrome, real UI, local sensor API fixture (not production)', baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scans: [], errors: [], navigations: [] };
report.sha256 = Object.fromEntries(['navigation-controls.css', 'mode-exit.css', 'index.html', 'sensors/index.html', 'sensors/sensor-platform.css', 'app.js', 'gaia-mode-loader.js'].filter(file => fs.existsSync(file)).map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
// Replay the committed navigation sources read-only for an independently
// repeatable before/after reproduction; never alter the working tree for QA.
const baselineFiles = baseline ? Object.fromEntries(['index.html', 'app.js', 'sensors/index.html', 'sensors/sensor-platform.css', 'sensors/sensor-platform.js'].map(file => [file, execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' })])) : null;
report.source = baseline ? 'HEAD navigation markup and styles routed to browser; remaining assets from working tree' : 'working tree';
let browser;
let page;
let reference;
let width;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('QA server startup timeout')), 10000);
    server.once('error', reject);
    server.stdout.on('data', data => { if (data.toString().includes('sensor qa')) { clearTimeout(timer); resolve(); } });
  });
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  for (const viewport of [[1440,900], [1024,768], [390,844], [320,568]].filter(([value]) => !selectedWidths || selectedWidths.includes(value))) {
    width = viewport[0];
    const context = await browser.newContext({ viewport: { width, height: viewport[1] }, reducedMotion: 'reduce' });
    page = await context.newPage();
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) report.navigations.push({ width, url: frame.url() }); });
    if (baseline) await page.route(url => url.origin === base && ['/', '/index.html', '/app.js', '/sensors/', '/sensors/index.html', '/sensors/sensor-platform.css', '/sensors/sensor-platform.js', '/navigation-controls.css'].includes(url.pathname), route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = pathname === '/' ? 'index.html' : pathname === '/sensors/' ? 'sensors/index.html' : pathname.slice(1);
      return route.fulfill({ contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html', body: baselineFiles[file] || '' });
    });
    page.on('pageerror', error => report.errors.push(error.message));
    await page.addInitScript(() => {
      for (const mode of ['map', 'sensor', 'character']) sessionStorage.setItem(`gaia:mode-entry-guide:${mode}:v1`, 'seen');
    });
    await page.goto(`${base}/#top`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => globalThis.GaiaModeLoader.load('exploration'));
    await page.waitForFunction(() => Boolean(globalThis.GaiaMapObservationAdapter?.showIntro));
    await settle();
    await scan('#intro-title-return', 'title-return');
    if (!baseline) {
      await page.locator('#intro-title-return').press('Enter');
      await page.locator('#gaia-opening-route-other').waitFor({ state: 'visible' });
      report.scans.at(-1).keyboardReturned = true;
      await page.locator('#gaia-opening-route-other').click();
      await page.locator('#intro-layer:not([hidden])').waitFor({ state: 'visible' });
      await settle();
    }
    // Use the actual map entry and close handlers, then load galleries in sequence
    // to catch style-order regressions caused by deferred mode stylesheets.
    for (const [name, trigger, selector, ready] of [
      ['map', '#japan-button', '#japan-close', '#japan-layer:not([hidden])'],
      ['sound', '[data-sound-gallery-open]', '#sound-close', '#sound-layer:not([hidden])'],
      ['character', '[data-character-gallery-open]', '#character-book-close', '#character-book-layer:not([hidden])'],
    ]) {
      await page.evaluate(selector => document.querySelector(selector).click(), trigger);
      await page.locator(ready).waitFor({ state: 'visible' });
      await settle();
      await scan(selector, name);
      if (!baseline && name === 'map') await checkMapNeighbours();
      if (!baseline && name === 'character') {
        await page.locator('.character-book-scroll').evaluate(element => element.scrollTo(0, 900));
        await settle();
        await scan(selector, 'character-scrolled');
      }
      await page.locator(selector).press('Enter');
      await page.locator(ready).waitFor({ state: 'hidden' });
      report.scans.at(-1).keyboardReturned = true;
    }
    await page.evaluate(async () => { await globalThis.GaiaModeLoader.load('space'); await globalThis.GaiaSpace.open(0); });
    await page.locator('#space-layer').waitFor({ state: 'visible' });
    await settle();
    await scan('#space-close', 'space');
    await page.locator('#space-close').click();
    await page.locator('#space-layer').waitFor({ state: 'hidden' });
    report.scans.at(-1).pointerReturned = true;
    await page.evaluate(async () => { await globalThis.GaiaModeLoader.load('story'); await globalThis.GaiaNovel.open(); });
    await page.locator('#novel-home-button').waitFor({ state: 'visible' });
    await settle();
    await scan('#novel-home-button', 'story');
    if (!baseline) {
      const back = await page.locator('#novel-home-button').boundingBox();
      const skip = await page.locator('#novel-close-button').boundingBox();
      assert(skip.x >= back.x + back.width + 4, 'Story skip overlaps back');
      await page.locator('#gaia-audio-toggle').click();
      await page.waitForTimeout(350);
      const audio = await page.locator('#gaia-audio-dock').boundingBox();
      assert(audio.x >= skip.x + skip.width || audio.y >= skip.y + skip.height, 'Expanded audio overlaps navigation');
      await page.screenshot({ path: path.join(output, `after-${width}-story-audio.png`) });
      await page.locator('#gaia-audio-toggle').click();
    }
    await page.locator('#novel-home-button').click();
    await page.waitForFunction(() => document.querySelector('#novel-layer').getAttribute('aria-hidden') === 'true');
    await page.locator('#intro-layer:not([hidden])').waitFor({ state: 'visible' });
    await settle();
    report.scans.at(-1).pointerReturned = true;
    for (const view of (baseline ? ['map', 'guide', 'terms', 'devices', 'profile'] : ['map', 'guide', 'terms', 'devices', 'profile', 'add', 'device=dev_browser_qa'])) {
      await page.goto(`${base}/sensors/?authenticated=1#${view}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(view => document.documentElement.dataset.sensorView === (view.startsWith('device=') ? 'detail' : view), view);
      await settle();
      await scan('.sensor-home-back', `sensor-${view.replace('=', '-')}`);
      if (!baseline) {
        if (['guide', 'terms'].includes(view)) {
          await page.evaluate(() => window.scrollTo(0, 900));
          await settle();
          await scan('.sensor-home-back', `sensor-${view}-scrolled`);
        }
        if (['add', 'device=dev_browser_qa'].includes(view)) {
          await scan('[data-view]:not([hidden]) > .sensor-back', `sensor-${view.replace('=', '-')}-local-back`, false);
          await page.locator('[data-view]:not([hidden]) > .sensor-back').click();
          await page.locator('[data-view="devices"]').waitFor({ state: 'visible' });
          report.scans.at(-1).pointerReturned = true;
        }
        await page.locator('.sensor-home-back').click();
        await page.waitForURL(`${base}/#top`);
        await page.locator('#intro-title-return').waitFor({ state: 'visible' });
        report.scans.at(-1).homeLinkReturned = true;
      }
    }
    fs.writeFileSync(path.join(output, `${baseline ? 'baseline' : 'regression'}-${width}-report.json`), JSON.stringify({ ...report, status: 'passed', scans: report.scans.filter(scan => scan.width === width) }, null, 2));
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  report.failureState = await page?.evaluate(() => ({
    url: location.href, ready: globalThis.__gaiaInitialViewReady, appReady: document.documentElement.dataset.gaiaAppReady,
    bodyClass: document.body.className, bootHidden: document.querySelector('#gaia-boot')?.hidden,
    styles: [...document.querySelectorAll('link[rel="stylesheet"],link[rel="preload"][as="style"]')].map(link => ({ href: link.href, rel: link.rel, loaded: link.dataset.gaiaLoaded, sheet: !!link.sheet })),
    introHidden: document.querySelector('#intro-layer')?.hidden,
  })).catch(() => null);
  await page?.screenshot({ path: path.join(output, `${baseline ? 'before' : 'after'}-failure.png`) }).catch(() => {});
} finally {
  await browser?.close(); server.kill();
  fs.writeFileSync(path.join(output, `${baseline ? 'baseline' : 'regression'}-report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, count: report.scans.length, failure: report.failure, errors: report.errors }));
}

async function settle() {
  await page.waitForFunction(() => !globalThis.GaiaSceneTransition?.running);
  await page.evaluate(() => globalThis.GaiaModeEntryGuide?.close?.(null, { restoreFocus: false }));
  await page.evaluate(() => globalThis.GaiaIntroEntryGuide?.close?.({ restoreFocus: false }));
  await page.mouse.move(width - 1, page.viewportSize().height - 1);
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(400);
}

async function scan(selector, surface, primary = true) {
  const target = page.locator(selector);
  await target.waitFor({ state: 'visible', timeout: 15000 });
  const data = await target.evaluate(button => {
    const rect = button.getBoundingClientRect();
    const css = getComputedStyle(button);
    const arrow = getComputedStyle(button, '::before');
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { text: button.textContent.trim(), rect: rect.toJSON(), hit: button.contains(hit),
      visual: Object.fromEntries(['height', 'borderRadius', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'paddingLeft', 'paddingRight', 'gap', 'color', 'borderColor', 'backgroundImage', 'backgroundColor', 'boxShadow'].map(key => [key, css[key]])),
      arrow: { content: arrow.content, width: arrow.width, fontSize: arrow.fontSize, color: arrow.color },
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  report.scans.push({ width, surface, ...data });
  await page.screenshot({ path: path.join(output, `${baseline ? 'before' : 'after'}-${width}-${surface}.png`) });
  if (!baseline) {
    if (primary) {
      assert.equal(data.rect.x, 16, `${width}/${surface}: left inset`);
      assert.equal(data.rect.y, 16, `${width}/${surface}: top inset`);
    }
    assert.equal(data.rect.height, 44, `${width}/${surface}: height`);
    assert(data.rect.width >= 88, `${width}/${surface}: minimum width`);
    assert(data.hit, `${width}/${surface}: blocked button`);
    assert(data.overflow <= 1, `${width}/${surface}: horizontal overflow`);
    reference ||= data.visual;
    assert.deepEqual(data.visual, reference, `${width}/${surface}: differing visual style`);
    assert(data.arrow.content.includes('◀'), `${width}/${surface}: missing back arrow`);
    await target.hover();
    await page.waitForTimeout(220);
    assert.notEqual(await target.evaluate(button => getComputedStyle(button).borderColor), data.visual.borderColor, `${width}/${surface}: hover state`);
    await page.mouse.move(width - 1, page.viewportSize().height - 1);
  }
  console.log(`${baseline ? 'baseline' : 'checked'} ${width}/${surface} ${Math.round(data.rect.x)},${Math.round(data.rect.y)} ${Math.round(data.rect.width)}x${Math.round(data.rect.height)}`);
}

async function checkMapNeighbours() {
  const overlapping = await page.locator('#japan-close').evaluate(back => {
    const rect = back.getBoundingClientRect();
    const overlaps = element => {
      if (!element?.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })) return false;
      const other = element.getBoundingClientRect();
      return rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top;
    };
    return ['.japan-heading', '#gaia-map-demo-toggle', '#gaia-audio-dock'].filter(selector => overlaps(document.querySelector(selector)));
  });
  assert.deepEqual(overlapping, [], 'Map back overlaps another header action');
}
