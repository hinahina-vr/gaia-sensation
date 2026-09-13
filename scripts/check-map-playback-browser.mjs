import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || 'artifacts/map-playback-20260912/after');
fs.mkdirSync(output, {recursive: true});
const files = ['app.js','statistics-lab.js','src/exploration/map-demo.js','src/exploration/map-playback.js','src/exploration/live-exhibits.js',
  'src/exploration/estat-exhibits.js','src/exploration/firms-exhibit.js','src/exploration/marine-cod-exhibit.js','src/exploration/food-exhibits.js',
  'src/exploration/index.js','map-demo.css','map-mobile-shell.js','map-mobile-shell.css','marine-cod-exhibit.css','gaia-mode-loader.js','index.html'];
const hashes = () => Object.fromEntries(files.map(f => [f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const report = {status:'running',hashes:hashes(),checks:[],errors:[],scope:'Installed Chrome, localhost and production CSP. Repository snapshots, external HTTPS blocked. Real-time waits and native control clicks/taps; mobile emulation, not physical devices or production.'};
const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
  for(const width of (process.env.QA_WIDTHS || '1440,390').split(',').map(Number)) {
    const mobile = width <= 900, height = width === 3840 ? 2160 : mobile ? 844 : 900;
    const context = await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile,reducedMotion:process.argv.includes('--reduced')?'reduce':'no-preference'});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',r=>r.abort());
    await context.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
    page = await context.newPage();page.on('pageerror',e=>report.errors.push({width,message:e.message}));
    await page.goto(`${base}/?exhibit=21#world`,{waitUntil:'domcontentloaded'});
    await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
    await page.waitForFunction(()=>globalThis.GaiaMapPlayback?.getState().ready && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
    const control = async kind => {
      if(mobile){await page.locator('[data-mobile-sheet="tools"]').tap();return page.locator(`[data-mobile-transport="gaia-map-${kind==='tour'?'demo':'playback'}-toggle"]`);}
      return page.locator(kind==='tour'?'#gaia-map-demo-toggle':'#gaia-map-playback-toggle');
    };
    const click = async kind => { const target=await control(kind);if(mobile)await target.tap();else await target.click(); };
    const position = () => page.evaluate(()=>{
      const n=GaiaMapPlayback.getState().number;
      if(n===1)return document.querySelector('[data-firms-progress]').value;
      if(n<=14)return GaiaMapObservationAdapter.getState().signalTimePosition;
      if(n<=20)return GaiaLiveData.getSelectedTime();
      if(n<=30)return GaiaEstatExhibits.getState().periodIndex;
      if(n<=69)return GaiaMarineCod.getState().year;
      return GaiaFoodExhibits.getState().periodKey;
    });
    const waitStopped = () => page.waitForFunction(()=>!GaiaMapPlayback.getState().playing&&!GaiaMapPlayback.getState().requested);
    const select = async n => {
      await page.evaluate(n=>{GaiaMapDemo.stop();GaiaMapCategories.buttons()[n-1].click();},n);
      await page.waitForFunction(n=>GaiaMapPlayback.getState().number===n&&GaiaMapPlayback.getState().ready&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);
    };
    await click('tour');await waitStopped();
    assert.equal(await page.evaluate(()=>GaiaEstatExhibits.getState().playbackEnabled),false,'21: stopping tour also stops year and region playback');
    if(!process.argv.includes('--matrix-only')) {
      const held=await position();await page.waitForTimeout(1600);assert.equal(await position(),held,'21 must not continue after tour stop');
      for(const n of [21,70,71,35,15,6,1]) {
        await select(n);
        await click('current');
        await page.waitForFunction(()=>GaiaMapPlayback.getState().playing);
        assert.equal(await page.evaluate(()=>GaiaMapDemo.getState().active),false);
        const first=await position();await page.waitForTimeout(n===21?1600:n===1?1600:4400);const advanced=await position();
        assert.notEqual(advanced,first,`${width}/${n}: playback must advance real data`);
        const number=await page.locator('#japan-mode-number').textContent();assert.equal(Number(number),n);
        await click('current');await waitStopped();
        const stopped=await position();await page.waitForTimeout(n===21?1500:1200);assert.equal(await position(),stopped,`${width}/${n}: stopping must hold the position`);
        await click('tour');await page.waitForFunction(()=>GaiaMapDemo.getState().active&&GaiaMapPlayback.getState().playing);
        await click('tour');await waitStopped();
        report.checks.push({width,phase:'real playback',number:n,first,advanced,stopped});
        console.log('PASS playback',width,n);
      }
    }
    const numbers=process.argv.includes('--all')?Array.from({length:71},(_,i)=>i+1):[1,2,5,6,9,12,15,20,21,30,31,35,65,66,67,68,69,70,71];
    for(const n of numbers) {
      await select(n);
      const expectedUnsupported=[2,3,4,5,9].includes(n);
      const state=await page.evaluate(()=>GaiaMapPlayback.getState());
      assert.equal(state.supported,!expectedUnsupported,`${width}/${n}: only providers with real sequences are playable`);
      const target=await control('current');assert.equal(await target.isDisabled(),expectedUnsupported);
      const box=await target.boundingBox();assert(box&&box.width>=44&&box.height>=44);
      assert.equal(await target.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true);
      if([1,6,9,15,21,35,65,70].includes(n))await page.screenshot({path:path.join(output,`${width}-${n}-controls.png`)});
      if(mobile)await page.locator('[data-mobile-sheet-close]').tap();
      if(process.argv.includes('--all')&&!expectedUnsupported) {
        await click('current');await page.waitForFunction(()=>GaiaMapPlayback.getState().playing);
        await click('current');await waitStopped();
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
      report.checks.push({width,phase:'availability',number:n,...state});
    }
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    await context.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(hashes(),report.hashes);report.status='passed';
} catch(error) {report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally {fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
