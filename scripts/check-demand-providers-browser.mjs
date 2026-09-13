import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4486';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/performance-high-2026-09-09/demand-providers');
fs.mkdirSync(output, { recursive: true });
const files = ['app.js','src/exploration/estat-exhibits.js','src/exploration/firms-exhibit.js','src/exploration/index.js','gaia-mode-loader.js','index.html'];
const report = { status:'running', conditions:'Local bundled original provider data, external requests blocked; actual e-Stat request delayed 4 seconds to test stale completion.', sha256:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')])), checks:[], errors:[] };
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  for (const width of [1440,390]) {
    const context = await browser.newContext({viewport:{width,height:width<900?844:900},hasTouch:width<900,isMobile:width<900,reducedMotion:'reduce'});
    await context.addInitScript(()=>{sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen');localStorage.setItem('gaia-senseware-bgm-muted','true');});
    await context.route('https://**',r=>r.abort());
    await context.route('**/data/estat-prefecture-series.json*',async r=>{await new Promise(done=>setTimeout(done,4000));await r.continue();});
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    const requests=[];page.on('request',r=>requests.push(r.url()));
    await page.goto(base+'/?exhibit=31#world',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>globalThis.GaiaMapDemo&&globalThis.GaiaMarineCod?.getState().dataState==='ready');
    await page.evaluate(()=>GaiaMapDemo.stop());
    assert(!requests.some(s=>/estat-prefecture-series|firms-active-fire-snapshot/.test(s)));
    await page.evaluate(()=>{void GaiaEstatExhibits.select(0);});
    await page.waitForTimeout(100);
    await page.evaluate(()=>GaiaMarineCod.select());
    await page.waitForTimeout(4500);
    assert.equal(await page.evaluate(()=>GaiaEstatExhibits.getState().activeIndex),-1,'Stale first-use load does not reactivate e-Stat');
    assert(await page.evaluate(()=>document.querySelector('#japan-layer').classList.contains('is-marine-cod-exhibit')));
    await page.evaluate(()=>GaiaEstatExhibits.select(0));
    await page.waitForFunction(()=>document.querySelector('.gaia-estat-readout')?.dataset.estatValueCountCurrent && !document.querySelector('.gaia-estat-readout').hidden);
    const estat=await page.evaluate(()=>({state:GaiaEstatExhibits.getState(),dataset:GaiaEstatExhibits.getStatisticsDataset()}));
    assert(estat.dataset.rows.length>0&&estat.dataset.rows.some(r=>Number.isFinite(r.value)));
    await page.screenshot({path:path.join(output,width+'-estat.png')});
    await page.evaluate(()=>GaiaMapCategories.buttons().find(b=>b.dataset.firmsExhibit).click());
    await page.waitForFunction(()=>GaiaFirmsExhibit.getState().active&&GaiaFirmsExhibit.getState().pointCount>0);
    const firms=await page.evaluate(()=>GaiaFirmsExhibit.getState());
    assert(requests.some(s=>/firms-active-fire-snapshot/.test(s)));
    await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.viewAnimation==='idle');
    await page.screenshot({path:path.join(output,width+'-firms.png')});
    await page.evaluate(()=>GaiaMarineCod.select());
    await page.waitForFunction(()=>GaiaMarineCod.getState().dataState==='ready');
    assert.equal(await page.evaluate(()=>GaiaFirmsExhibit.getState().active),false);
    assert.equal(await page.evaluate(()=>GaiaMarineCod.getState().count),2042);
    report.checks.push({width,estatRows:estat.dataset.rows.length,firms,returnedTo31:true});
    console.log(`PASS ${width}: stale e-Stat load discarded, real statistics and FIRMS render on first use, return to31`);
    await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
