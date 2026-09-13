import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const language=process.env.QA_LANGUAGE||'ja';
const output = 'artifacts/map-exhibit-link-entry'+(language==='ja'?'':'-'+language);
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.addInitScript(lang=>{if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('gaia:language:v1',lang);},language);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**', route => route.abort());
    await page.goto('http://127.0.0.1:4492/');
    await page.locator('#gaia-opening-sound-on').waitFor({ state: 'visible' });
    await page.evaluate(() => { location.hash = '#world-08'; });
    await page.waitForFunction(() => globalThis.GaiaMapPlayback?.getState().number === 8 && GaiaMapPlayback.getState().ready);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${output}/${width}.png` });
    assert.equal(await page.locator('#gaia-opening').isVisible(), false, 'incoming exhibit URL must retire the opening');
    assert.equal(await page.locator('#gaia-opening-sound-modal').isVisible(), false);
    assert.equal(await page.locator('#gaia-mode-entry-guide').isVisible(), false);
    // Exercise incoming hashes on animation frames, when outgoing UI sync may
    // already be queued. The previous chapter must never restore its old URL.
    for (let i = 0; i < 12; i += 1) {
      const number = i % 2 ? 8 : 13;
      await page.evaluate(number => new Promise(resolve => requestAnimationFrame(() => {
        location.hash = `#world-${String(number).padStart(2, '0')}`;
        resolve();
      })), number);
      await page.waitForFunction(number => Number(document.querySelector('#japan-mode-number').textContent) === number, number);
      await page.waitForTimeout(80);
      assert.equal(new URL(page.url()).hash, `#world-${String(number).padStart(2, '0')}`);
    }
    assert.deepEqual(errors, []);
    results.push({ width, openingHashHandoff: true, incomingRenderFrameHashes: 12, pageErrors: errors });
    console.log(results.at(-1));
    await page.close();
  }
} finally {
  fs.writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
