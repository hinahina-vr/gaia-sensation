import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const [base = 'http://127.0.0.1:4492', destination = 'artifacts/statistics-cta', stage = 'after'] = process.argv.slice(2);
const output = path.resolve(destination);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', stage, environment: 'Installed Chrome; repository ecology data; desktop/touch emulation; production CSP; no live AI calls',
  sha256: Object.fromEntries(['statistics-game.css','statistics-lab.js','gaia-mode-loader.js','index.html'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
try {
  const sizes = process.env.GAIA_STAT_CTA_SIZES?.split(',').map(size => size.split('x').map(Number)) || [[3840,1878],[3840,1080],[2560,1080],[1440,900],[1024,768],[390,844],[320,568],[844,390]];
  for (const [width,height] of sizes) {
    const context = await browser.newContext({ viewport: { width,height }, hasTouch: width <= 980, reducedMotion: 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen'); localStorage.setItem('gaia-senseware-bgm-muted', 'true'); });
    await context.route('https://services.swpc.noaa.gov/**', route => route.fulfill({ path: 'data/ovation-aurora-snapshot.json', contentType: 'application/json' }));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/#world`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaMapDemo && globalThis.GaiaMapObservationAdapter);
    await page.evaluate(async () => {
      await GaiaMapObservationAdapter.waitSignalsReady(); GaiaMapDemo.stop();
      GaiaMapCategories.buttons().find(button => Number(button.textContent) === 12).click();
    });
    await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
    const openAnalysis = async () => {
      if (width > 980) await page.locator('.map-dock-action--statistics').click();
      else {
        await page.locator('[data-mobile-sheet="tools"]').tap();
        await page.locator('#map-mobile-sheet').getByRole('button', { name: '統計分析', exact: true }).tap();
      }
    };
    // Passive frame sampling of the original UI opening/closing, not a mock
    // animation or an API-open shortcut.
    await page.evaluate(() => {
      window.__statisticsFrames = [];
      window.__statisticsSampling = true;
      const sample = () => {
        const lab = document.querySelector('#gaia-statistics-lab');
        window.__statisticsFrames.push({ time: performance.now(), open: globalThis.GaiaStatisticsLab?.getState().open, hidden: lab?.hidden, opacity: lab ? Number(getComputedStyle(lab).opacity) : 0 });
        if (window.__statisticsSampling) requestAnimationFrame(sample);
      };
      sample();
    });
    await openAnalysis();
    await page.waitForFunction(() => globalThis.GaiaStatisticsLab?.getState().analysisReady);
    assert.equal(await page.evaluate(() => GaiaStatisticsLab.getState().datasetId), 'forest-urban');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(750);
    const cta = page.locator('.gaia-statistics-discover-cta');
    await cta.scrollIntoViewIfNeeded();
    await page.mouse.move(0,0);
    const scan = await cta.evaluate(button => {
      const bounds = button.getBoundingClientRect();
      const texts = [...button.querySelectorAll('span,strong')].map(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        return { text: node.textContent, bounds: range.getBoundingClientRect().toJSON() };
      });
      const shell = document.querySelector('.gaia-statistics-shell');
      return { button: bounds.toJSON(), texts, padding: getComputedStyle(button).padding,
        rows: getComputedStyle(button).gridTemplateRows, shell: shell.getBoundingClientRect().toJSON(),
        overflow: shell.scrollWidth - shell.clientWidth, caveat: document.querySelector('.gaia-statistics-takeaway-caveat').getBoundingClientRect().toJSON(),
        contained: texts.every(({bounds: text}) => text.top >= bounds.top + 2 && text.bottom <= bounds.bottom - 2 && text.left >= bounds.left && text.right <= bounds.right),
        hit: button.contains(document.elementFromPoint(bounds.x + bounds.width/2, bounds.y + bounds.height/2)) };
    });
    await page.screenshot({ path: path.join(output, `${width}x${height}-ecologies.png`) });
    await page.locator('.gaia-statistics-takeaway').screenshot({ path: path.join(output, `${width}x${height}-takeaway.png`) });
    if (stage !== 'before') {
      assert(scan.contained, `CTA text escapes button: ${JSON.stringify(scan)}`);
      assert(scan.caveat.top >= scan.button.bottom, 'CTA must not overlap caveat');
      assert(scan.hit && scan.button.height >= 44, 'CTA hit target');
      assert(scan.shell.width <= width * (width > 980 ? .9 : .94) + 1);
      assert(scan.shell.height <= height * .91 + 1);
      assert(scan.overflow <= 1, 'Statistics horizontal overflow');
    }
    await cta.click();
    assert.equal(await page.locator('[data-stat-view="findings"]').getAttribute('aria-selected'), 'true');
    await page.locator('#gaia-statistics-close').click();
    await page.locator('#gaia-statistics-lab').waitFor({ state: 'hidden' });
    if (stage !== 'before') {
      const frames = await page.evaluate(() => { window.__statisticsSampling = false; return window.__statisticsFrames; });
      assert(frames.some(frame => frame.open && frame.opacity > .01 && frame.opacity < .99), 'Statistics fades in');
      assert(frames.some(frame => frame.open === false && !frame.hidden && frame.opacity > .01 && frame.opacity < .99), 'Statistics fades out');
      scan.frames = frames;
      await openAnalysis();
      await page.waitForFunction(() => GaiaStatisticsLab.getState().analysisReady && getComputedStyle(document.querySelector('#gaia-statistics-lab')).opacity === '1');
      assert.equal(await page.locator('[data-stat-view="chart"]').getAttribute('aria-selected'), 'true');
      await page.keyboard.press('Escape');
      await page.locator('#gaia-statistics-lab').waitFor({ state: 'hidden' });
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations || []), []);
    report.checks.push({ width,height,...scan });
    console.log(`PASS ${stage}/${width}: contained=${scan.contained}`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: path.join(output,'failure.png') }).catch(() => {});
} finally {
  await browser.close(); fs.writeFileSync(path.join(output,'report.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure }));
}
