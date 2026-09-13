import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  for (const width of [1440,390]) {
    const context = await browser.newContext({viewport:{width,height:900}});
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4492/');
    await page.locator('#gaia-opening-sound-off').click();
    await page.locator('#gaia-opening-skip').click();
    const original = page.url();
    await page.locator('#gaia-opening-concept').hover();
    const effect = await page.locator('#gaia-opening-concept').evaluate(link => ({ underline:getComputedStyle(link).textDecorationLine, animation:getComputedStyle(link,'::after').animationName }));
    assert.equal(effect.underline,'none');
    assert.equal(effect.animation,'about-link-glint');
    const [tab] = await Promise.all([context.waitForEvent('page'), page.locator('#gaia-opening-concept').click()]);
    await tab.waitForLoadState('domcontentloaded');
    assert.equal(new URL(tab.url()).pathname,'/concept/');
    assert.equal(page.url(),original);
    assert.equal(await tab.evaluate(() => window.opener === null),true);
    assert(await page.locator('#gaia-opening-route-story').isVisible());
    console.log(`PASS ${width}: new concept tab, original title retained, no opener`);
    await context.close();
  }
} finally { await browser.close(); }
