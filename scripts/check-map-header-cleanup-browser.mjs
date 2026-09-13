import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://127.0.0.1:4447';
const before = process.argv.includes('--before');
const output = path.resolve(`artifacts/map-header-cleanup-${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', environment: 'Local Chrome; synthetic cached atmosphere response', checks: [], errors: [] };
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const [width,height] of [[1440,900],[390,844],[320,568],[3840,2088]]) {
    const context = await browser.newContext({ viewport: { width,height }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      sessionStorage.setItem('gaia:mode-entry-guide:map:v5', 'seen');
      sessionStorage.setItem('gaia:intro-entry-guide:v1', 'seen');
      localStorage.setItem('gaia-senseware-bgm-muted', 'true');
      sessionStorage.setItem('gaia-planet-signals-v3:atmosphere', JSON.stringify({ cachedAt: Date.now(), data: { observedAt: new Date().toISOString(), points: [{ lat:35,lon:139,label:'検証地点',windSpeed:7,windDirection:120,pressure:1014,cloud:36,radiation:512 }] } }));
    });
    await context.route('https://services.swpc.noaa.gov/**', route => route.fulfill({ path: 'data/ovation-aurora-snapshot.json', contentType: 'application/json' }));
    await context.route('**/api/live/v1/firms', route => route.fulfill({ path: 'data/firms-active-fire-snapshot.json', contentType: 'application/json' }));
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`${base}/#top`, { waitUntil: 'domcontentloaded' });
    await page.locator('#intro-title-return').waitFor();
    await page.evaluate(() => GaiaIntroEntryGuide?.close?.({ restoreFocus:false }));
    const header = () => page.locator('#intro-layer').evaluate(element => {
      const css = getComputedStyle(element, '::after');
      return { background:css.backgroundColor, position:css.position, opacity:css.opacity, height:css.height, reading:element.classList.contains('is-reading-data') };
    });
    const top = await header();
    assert.equal(top.background === 'rgb(3, 11, 16)' && top.position === 'fixed', before, 'Opaque strip is absent from top screen');
    await page.screenshot({ path:path.join(output, `${width}-top.png`) });
    await page.locator('#data-chapter-air .data-source-card').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const reading = await header();
    assert.equal(reading.background, 'rgb(3, 11, 16)', 'Reading header still masks scrolling data');
    await page.screenshot({ path:path.join(output, `${width}-reading.png`) });
    await page.locator('#intro-layer').evaluate(element => element.scrollTo(0,0));
    await page.waitForTimeout(300);
    if (!before) assert.equal((await header()).reading, false, 'Returning to top clears reading-only header');
    await page.goto(`${base}/?exhibit=2&live=1#world`, { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => globalThis.GaiaMapCategories?.buttons().length === 30 && globalThis.GaiaMapDemo);
    await page.evaluate(() => { GaiaMapDemo.stop(); GaiaMapCategories.buttons().find(button => Number(button.textContent) === 2).click(); });
    await page.waitForFunction(() => !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
    await page.locator('.gaia-planet-signals-readout .gaia-broadcast-badge[data-broadcast-state="live"]').waitFor();
    const map = await page.evaluate(() => {
      const title = document.querySelector('#japan-title');
      const badge = document.querySelector('.gaia-planet-signals-readout .gaia-broadcast-badge');
      return { title:title.textContent, accessible:title.getAttribute('aria-label'), prefix:getComputedStyle(title,'::before').content,
        headingBadges:document.querySelectorAll('.japan-heading > .gaia-broadcast-badge').length,
        badgeBackground:getComputedStyle(badge).backgroundColor, badgeColor:getComputedStyle(badge).color };
    });
    if (before) { assert.equal(map.headingBadges,1); assert.match(map.prefix,/02/); }
    else { assert.equal(map.headingBadges,0); assert.equal(map.prefix,'none'); assert.equal(map.accessible,map.title); assert.equal(map.badgeBackground,'rgba(190, 28, 42, 0.8)'); }
    await page.screenshot({ path:path.join(output,`${width}-map.png`) });
    report.checks.push({ width,height,top,reading,map });
    await context.close();
    console.log(`PASS ${width}: ${before ? 'baseline reproduced' : 'top/readout/heading'}`);
  }
  assert.deepEqual(report.errors,[]); report.status=before?'reproduced':'passed';
} catch(error) { report.status='failed'; report.failure=error.stack; process.exitCode=1; }
finally { await browser.close(); fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify({status:report.status,failure:report.failure})); }
