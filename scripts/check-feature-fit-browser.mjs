import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4447';
const before = process.argv.includes('--before');
const baseline = 'b236255db4dc60f748aecfe4327d45d39f8ad33b';
const output = path.resolve(`artifacts/feature-fit/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const files = ['mode-feature-intro.css', 'gaia-mode-loader.js', 'index.html', 'sensors/index.html'];
const sources = Object.fromEntries(files.map(file => [file, before
  ? execFileSync('git', ['show', `${baseline}:${file}`], { maxBuffer: 5_000_000 }) : fs.readFileSync(file)]));
const report = { status: 'running', before, baseline,
  environment: 'Local Chrome, saved API fixtures and viewport/touch emulation; not physical devices or production',
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sha256: Object.fromEntries(files.map(file => [file, createHash('sha256').update(sources[file]).digest('hex')])),
  checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  const sizes = before ? [[2560,1272], [1440,720]] : [[3840,1908], [2560,1272], [1920,954], [1536,760], [1440,720], [1366,650], [1366,600], [1024,768], [390,844], [320,568], [844,390]];
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 900, reducedMotion: 'reduce' });
    await context.addInitScript(() => { localStorage.setItem('gaia-senseware-bgm-muted', 'true'); globalThis.EventSource = class { addEventListener() {} close() {} }; });
    await context.route('https://services.swpc.noaa.gov/**', route => route.fulfill({ path: 'data/ovation-aurora-snapshot.json', contentType: 'application/json' }));
    await context.route('**/api/live/v1/firms', route => route.fulfill({ path: 'data/firms-active-fire-snapshot.json', contentType: 'application/json' }));
    if (before) for (const file of files) await context.route(file === 'index.html' ? `${base}/?*` : `${base}/${file}*`, route => route.fulfill({
      body: sources[file], contentType: file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html',
    }));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ width, error: error.message }));
    await page.goto(`${base}/?exhibit=1&live=1#world`, { waitUntil: 'domcontentloaded' });
    await page.locator('.gaia-feature-intro.is-illustrated').waitFor();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.gaia-feature-intro')).opacity === '1');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.has-feature-art img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const scan = await page.locator('.gaia-feature-intro').evaluate(panel => {
      const scroller = panel.querySelector('.gaia-feature-scroll');
      const bounds = element => element.getBoundingClientRect().toJSON();
      const scrollBounds = bounds(scroller);
      const probe = document.createElement('span'); probe.style.fontFamily = 'var(--font-ja)'; panel.append(probe);
      const siteFont = getComputedStyle(probe).fontFamily; probe.remove();
      return { panel: bounds(panel), scrollBounds, verticalOverflow: scroller.scrollHeight - scroller.clientHeight,
        horizontalOverflow: scroller.scrollWidth - scroller.clientWidth, documentOverflow: document.documentElement.scrollWidth - innerWidth,
        siteFont, fonts: [...panel.querySelectorAll('h2,h3,p,.gaia-feature-card-copy>span,button,.gaia-feature-visual>span')].map(element => ({ text: element.textContent.slice(0,35), font: getComputedStyle(element).fontFamily })),
        text: [...panel.querySelectorAll('h2,h3,.gaia-feature-card-copy>span,.gaia-feature-note')].map(element => ({ rect: bounds(element), size: parseFloat(getComputedStyle(element).fontSize), text: element.textContent })),
        images: [...panel.querySelectorAll('img')].map(image => ({ rect: bounds(image), complete: image.complete, width: image.naturalWidth, fit: getComputedStyle(image).objectFit })),
        controls: [...panel.querySelectorAll('button')].map(button => { const r = bounds(button); return { rect: r, hit: button.contains(document.elementFromPoint(r.x+r.width/2, r.y+r.height/2)) }; }) };
    });
    assert.equal(scan.horizontalOverflow, 0); assert.equal(scan.documentOverflow, 0);
    assert(scan.panel.x >= 0 && scan.panel.y >= 0 && scan.panel.bottom <= height+1);
    assert(scan.controls.every(control => control.hit && control.rect.height >= 44 && control.rect.width >= 44));
    if (!before) {
      assert(scan.fonts.every(item => item.font === scan.siteFont), 'Entire introduction uses the site Japanese font');
      assert(scan.images.every(image => image.complete && image.width === 1536 && image.fit === 'contain'));
      if (width > 900) {
        assert(scan.verticalOverflow <= 1, `No vertical scrollbar: ${scan.verticalOverflow}px overflow`);
        assert(scan.text.every(item => item.rect.top >= scan.scrollBounds.top && item.rect.bottom <= scan.scrollBounds.bottom+1), 'All descriptions and API conditions fit without clipping');
        assert(scan.images.every(image => image.rect.height >= 100), 'All three illustrations remain visible');
        assert(scan.text.every(item => item.size >= 13), 'Do not shrink text beyond readable sizes');
      } else {
        await page.locator('.gaia-feature-note').scrollIntoViewIfNeeded();
        assert(await page.locator('.gaia-feature-note').isVisible());
        await page.locator('.gaia-feature-scroll').evaluate(element => { element.scrollTop = 0; });
      }
    }
    await page.screenshot({ path: path.join(output, `${width}x${height}.png`) });
    if (!before && width === 2560) {
      await page.setViewportSize({ width: 1440, height: 720 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert(await page.locator('.gaia-feature-scroll').evaluate(element => element.scrollHeight <= element.clientHeight + 1), 'Resizing an open introduction also fits');
      await page.setViewportSize({ width, height });
    }
    await page.locator('[data-feature-start]').click();
    await page.locator('#gaia-mode-entry-guide').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => GaiaModeEntryGuide.getState().active), false);
    report.checks.push({ width, height, scan });
    console.log(`${before ? 'BEFORE' : 'PASS'} ${width}x${height}: overflow ${scan.verticalOverflow}px`);
    await context.close();
  }
  if (before) assert(report.checks.some(check => check.scan.verticalOverflow > 0), 'Reproduce the reported scrollbar');
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally { await browser.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report,null,2)); console.log(JSON.stringify({ status: report.status, failure: report.failure })); }
