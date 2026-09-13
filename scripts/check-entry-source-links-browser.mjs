import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const [base = 'https://gaia-senseware.pages.dev', directory = 'artifacts/entry-source-links'] = process.argv.slice(2);
const output = path.resolve(directory);
fs.mkdirSync(output, { recursive: true });
const report = { status: 'running', base, testedAt: new Date().toISOString(), environment: 'Actual Chrome navigation, no response mocks or account actions', links: [], internal: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const route of ['/#top', '/concept/']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
    if (route === '/#top') await page.locator('#gaia-boot').waitFor({ state: 'hidden' });
    else await page.waitForFunction(() => document.body.dataset.enhanced === 'true');
    const selector = route === '/#top' ? '#intro-layer a[href^="https:"]' : 'a[href^="https:"]';
    const count = await page.locator(selector).count();
    for (let index = 0; index < count; index++) {
      const link = page.locator(selector).nth(index);
      const item = { route, index, text: (await link.innerText()).trim(), href: await link.getAttribute('href'), status: 'running' };
      let popup;
      try {
        await link.scrollIntoViewIfNeeded();
        const opened = context.waitForEvent('page', { timeout: 12000 });
        await link.click();
        popup = await opened;
        const documents = [];
        popup.on('response', response => { if (response.request().isNavigationRequest() && response.frame() === popup.mainFrame()) documents.push({ url: response.url(), status: response.status() }); });
        await popup.waitForLoadState('domcontentloaded', { timeout: 15000 });
        item.destination = popup.url(); item.title = await popup.title(); item.documents = documents;
        assert.notEqual(item.destination, 'about:blank');
        item.bodyExcerpt = (await popup.locator('body').innerText({ timeout: 3000 })).slice(0, 220);
        assert(item.title.trim() || item.bodyExcerpt.trim(), 'Destination did not render content');
        const errorResponse = documents.find(response => response.status >= 400);
        item.status = errorResponse ? 'external-error' : 'opened';
        if (errorResponse) item.error = `External server returned ${errorResponse.status}`;
        if (/セキュリティ検証|Just a moment|Verifying you are human|Checking your browser/i.test(`${item.title}\n${item.bodyExcerpt}`)) {
          item.status = 'external-verification';
          item.error = 'Destination requires human verification; source content is not verified';
        }
        await popup.screenshot({ path: path.join(output, `${route.includes('concept') ? 'concept' : 'data'}-${index}.png`) });
      } catch (error) { item.status = 'unconfirmed'; item.error = error.message; item.destination = popup?.url(); }
      finally { if (popup) await popup.close().catch(() => {}); }
      report.links.push(item);
      fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
      console.log(`${item.status.toUpperCase()} ${route} ${index}: ${item.href}`);
    }
    await context.close();
  }
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, isMobile: width === 390, hasTouch: width === 390 });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    await page.goto(`${base}/concept/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.dataset.enhanced === 'true');
    const activate = async selector => { const element = page.locator(selector); await element.scrollIntoViewIfNeeded(); if (width === 390) await element.tap(); else await element.click(); };
    const checks = [];
    for (const selector of ['.site-header a[href="#first-world"]', '.site-header a[href="#learning"]', '.site-header a[href="#depth"]', '.site-header a[href="#mechanism"]', '.threshold-copy a[href="#depth"]', '.depth-heading a[href="#mechanism"]', '.site-footer a[href="#top"]']) {
      await activate(selector);
      const hash = await page.locator(selector).getAttribute('href');
      await page.waitForFunction(hash => location.hash === hash && document.querySelector(hash).getBoundingClientRect().top >= 0 && document.querySelector(hash).getBoundingClientRect().top < innerHeight, hash);
      checks.push(selector);
    }
    await activate('[data-open-diagram]');
    await page.locator('.diagram-viewer').waitFor({ state: 'visible' });
    await page.locator('.viewer-stage img').evaluate(image => image.decode());
    await activate('[data-zoom-diagram]'); assert.equal(await page.locator('[data-zoom-diagram]').getAttribute('aria-pressed'), 'true');
    await activate('[data-zoom-diagram]'); assert.equal(await page.locator('[data-zoom-diagram]').getAttribute('aria-pressed'), 'false');
    await activate('[data-close-diagram]'); await page.locator('.diagram-viewer').waitFor({ state: 'hidden' });
    await activate('[data-open-diagram]'); await page.keyboard.press('Escape'); await page.locator('.diagram-viewer').waitFor({ state: 'hidden' });
    checks.push('diagram open / zoom / reset / close / reopen / Escape');
    await activate('.site-signature'); await page.waitForURL(`${base}/`);
    await page.locator('#gaia-opening-sound-modal').waitFor({ state: 'visible' });
    checks.push('site signature to title');
    report.internal.push({ width, status: 'passed', checks });
    console.log(`PASS concept controls ${width}`);
    await context.close();
  }
  report.status = report.links.some(item => item.status !== 'opened') ? 'completed-with-external-issues' : 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally { fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify({ status: report.status, links: report.links.length, internal: report.internal.length })); }
