import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4492';
const out = process.argv[3] || 'artifacts/firms-cruise-20260925';
await fs.mkdir(out, {recursive:true});
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport:{width, height:900}});
    await page.route('https://**', route => route.abort());
    await page.goto(`${base}/#world-04`, { waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
    await page.evaluate(()=>GaiaModeEntryGuide.close('map',{restoreFocus:false}));
    await page.waitForFunction(()=>globalThis.GaiaFirmsExhibit?.getPlaybackState().ready);
    if (width < 720) {
      await page.locator('[data-mobile-sheet="tools"]').click();
      await page.locator('[data-mobile-cruise]').click();
      assert.equal(await page.locator('#map-mobile-sheet').getAttribute('open'), null);
    } else await page.locator('#gaia-map-cruise-toggle').click();
    // Real-time animation: the former manual scrub advanced points but never flames.
    await page.waitForFunction(()=>Number(document.querySelector('#gaia-firms-canvas').dataset.firmsActiveColumns)>0, null, {timeout:15000});
    const read = ()=>page.evaluate(()=>({cruise:GaiaMapCruise.getState(), canvas:{...document.querySelector('#gaia-firms-canvas').dataset}}));
    const first = await read();
    await page.waitForTimeout(1500);
    const next = await read();
    assert(next.cruise.elapsed > first.cruise.elapsed);
    assert(Number(next.canvas.firmsPlaybackProgress) > Number(first.canvas.firmsPlaybackProgress));
    assert.equal(next.canvas.firmsPlaybackPhase, 'igniting');
    await page.screenshot({path:`${out}/${width}-igniting.png`});
    await page.waitForFunction(()=>document.querySelector('#gaia-firms-canvas').dataset.firmsPlaybackPhase==='extinguishing', null, {timeout:40000});
    const extinguishing = await read();
    await page.waitForFunction(()=>document.querySelector('#japan-mode-number').textContent.trim()==='05', null, {timeout:20000});
    assert.equal(await page.evaluate(()=>GaiaMapCruise.getState().active), true);
    // Return to fire (04) and exercise the separate automatic-playback transport.
    await page.goto(`${base}/#world-04`, { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
    await page.evaluate(()=>GaiaModeEntryGuide.close('map',{restoreFocus:false}));
    await page.waitForFunction(()=>globalThis.GaiaFirmsExhibit?.getPlaybackState().playing);
    const togglePlayback = async () => {
      if (width < 720) {
        await page.locator('[data-mobile-sheet="tools"]').click();
        await page.locator('[data-mobile-transport="gaia-map-playback-toggle"]').click();
      } else await page.locator('#gaia-map-playback-toggle').click();
    };
    await togglePlayback();
    await page.waitForTimeout(250);
    const stopped = await read();
    await page.waitForTimeout(700);
    assert.equal((await read()).canvas.firmsPlaybackProgress, stopped.canvas.firmsPlaybackProgress);
    await togglePlayback();
    await page.waitForFunction(()=>GaiaFirmsExhibit.getPlaybackState().playing);
    await page.waitForFunction(()=>Number(document.querySelector('#gaia-firms-canvas').dataset.firmsActiveColumns)>0, null, {timeout:15000});
    results.push({width, first, next, extinguishing, advancedTo:'05'});
    console.log(`PASS ${width}: cruise click → flames → extinguishing → exhibit 05`);
    await page.close();
  }
} finally {
  await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
  await browser.close();
}
