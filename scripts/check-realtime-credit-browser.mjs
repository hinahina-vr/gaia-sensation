import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4447';
const before = process.argv.includes('--before');
const baseline = 'b236255db4dc60f748aecfe4327d45d39f8ad33b';
const output = path.resolve(`artifacts/realtime-credit/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, { recursive: true });
const files = ['src/exploration/realtime-exhibit-status.js', 'src/exploration/planet-signals-exhibit.js', 'src/exploration/firms-exhibit.js', 'src/exploration/live-exhibits.js', 'src/exploration/index.js', 'realtime-exhibits.css', 'gaia-mode-loader.js', 'index.html'];
const sources = Object.fromEntries(files.map(file => [file, before ? execFileSync('git',['show',`${baseline}:${file}`],{maxBuffer:5_000_000}) : fs.readFileSync(file)]));
const report = { status: 'running', before, baseline, environment: 'Local Chrome, saved/synthetic provider fixtures; no production or live-provider claim',
  baseCommit: execFileSync('git', ['rev-parse','HEAD'], { encoding:'utf8' }).trim(),
  sha256: Object.fromEntries(files.map(file => [file, createHash('sha256').update(sources[file]).digest('hex')])), checks: [], errors: [] };
const browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true });
let page;
try {
  for (const [width,height] of before ? [[1440,900]] : [[3840,2088],[2560,1392],[1440,900],[1024,768],[390,844],[320,568],[844,390]]) {
    const context = await browser.newContext({ viewport:{width,height}, hasTouch:width<=900, reducedMotion:'reduce' });
    await context.addInitScript(() => { sessionStorage.setItem('gaia:mode-entry-guide:map:v5','seen'); localStorage.setItem('gaia-senseware-bgm-muted','true'); globalThis.EventSource = class { addEventListener(){} close(){} }; });
    await context.route('**/api/live/v1/firms', route => route.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
    await context.route('https://services.swpc.noaa.gov/**', route => route.fulfill({path:'data/ovation-aurora-snapshot.json',contentType:'application/json'}));
    await context.route('https://earthquake.usgs.gov/**', route => route.fulfill({json:{metadata:{generated:Date.now()},features:[{id:'credit-qa-quake',geometry:{coordinates:[138,36,10]},properties:{time:Date.now()-3600000,mag:4.5,place:'検証用の地震'}}]}}));
    for(const host of ['api.open-meteo.com','air-quality-api.open-meteo.com']) await context.route(`https://${host}/**`, route => {
      const count = new URL(route.request().url()).searchParams.get('latitude')?.split(',').length || 1;
      return route.fulfill({json:Array.from({length:count},()=>({current:{time:new Date().toISOString().slice(0,16),wind_speed_10m:4,wind_direction_10m:100,surface_pressure:1008,cloud_cover:62,shortwave_radiation:182,pm2_5:10,aerosol_optical_depth:.2}}))});
    });
    if(before) for(const file of files) await context.route(file==='index.html'?`${base}/?*`:`${base}/${file}*`,route=>route.fulfill({body:sources[file],contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html'}));
    page = await context.newPage(); page.on('pageerror', error=>report.errors.push({width,error:error.message}));
    await page.goto(`${base}/?exhibit=1&live=1#world`, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>globalThis.GaiaMapDemo && globalThis.GaiaMapCategories?.buttons().length===30 && globalThis.GaiaPlanetSignals);
    await page.evaluate(()=>GaiaMapDemo.stop());
    const expected = ['NASA FIRMS / MODIS','Open-Meteo / DWD・ECMWFほか','Open-Meteo / CAMS','USGS · 直近24時間の地震','Open-Meteo / DWD・ECMWFほか'];
    for(let number=1;number<=5;number++) {
      const readout = page.locator(number===1 ? '.gaia-firms-readout' : '.gaia-planet-signals-readout');
      await readout.waitFor();
      await page.waitForFunction(()=>[...document.querySelectorAll('.gaia-realtime-status')].some(e=>e.getClientRects().length && e.dataset.realtimeState!=='loading'));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const scan = await page.evaluate(() => {
        const visible = e=>!e.closest('[hidden]') && e.getClientRects().length && getComputedStyle(e).display!=='none';
        const status = [...document.querySelectorAll('.gaia-realtime-status')].find(visible);
        const footer = document.querySelector('.japan-credits');
        const credits = [...footer.querySelectorAll('.gaia-realtime-credit')].filter(visible);
        const links = [...footer.querySelectorAll(':scope > a')].filter(visible).map(link=>({text:link.textContent.trim(),href:link.href,rect:link.getBoundingClientRect().toJSON()}));
        return {statusText:status.innerText,kicker:status.querySelector('.gaia-realtime-kicker')?.textContent,
          sourceInStatus:status.querySelector('[data-realtime-source]')?.textContent,
          credit:credits.map(e=>({text:e.textContent,href:e.href,rect:e.getBoundingClientRect().toJSON(),hit:e.contains(document.elementFromPoint(e.getBoundingClientRect().x+e.clientWidth/2,e.getBoundingClientRect().y+e.clientHeight/2))})),
          links,footer:footer.getBoundingClientRect().toJSON(),direction:getComputedStyle(footer).flexDirection,
          overflow:document.documentElement.scrollWidth-innerWidth,state:status.dataset.realtimeState,
          timestamp:status.querySelector('time').textContent};
      });
      if(before) { assert.match(scan.kicker,/地球のいま/); assert(scan.sourceInStatus.startsWith(expected[number-1])); assert.equal(scan.credit.length,0); }
      else {
        assert.equal(scan.kicker,undefined); assert.equal(scan.sourceInStatus,undefined);
        assert.equal(scan.credit.length,1); assert(scan.credit[0].text.startsWith(expected[number-1])); assert(scan.credit[0].href.startsWith('https://'));
        assert.equal(scan.direction,'row'); assert.equal(scan.overflow,0); assert(scan.credit[0].hit,'Credit link is reachable');
        assert(scan.links.some(link=>link.text.includes('Natural Earth'))); assert(scan.links.some(link=>link.text.includes('OpenStreetMap')));
        assert(scan.links.every(link=>link.rect.left>=0 && link.rect.right<=width+1 && link.rect.top>=0 && link.rect.bottom<=height+1),'All visible credits remain inside the viewport');
        if(width>=1440) assert(Math.max(...scan.links.map(l=>l.rect.top))-Math.min(...scan.links.map(l=>l.rect.top))<3,'Wide-screen credits share one horizontal row');
        assert(scan.timestamp && scan.timestamp!=='—','Keep observation time');
      }
      report.checks.push({width,height,number,scan});
      if(number===3 || number===1) await page.screenshot({path:path.join(output,`${width}-${number}.png`)});
      if(!before && number===3 && width>=1440) {
        const dock = await readout.boundingBox();
        const top = Math.max(0,Math.floor(Math.min(scan.footer.top,dock.y)-10));
        await page.screenshot({path:path.join(output,`${width}-${number}-credits.png`),clip:{x:0,y:top,width,height:height-top}});
      }
      if(!before && number===3 && width===1440) {
        const target = scan.credit[0].href;
        await context.route(target,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local source navigation fixture</title>'}));
        const opened = page.waitForEvent('popup');
        await page.locator('.gaia-realtime-credit:not([hidden])').click();
        const popup = await opened; await popup.waitForLoadState('domcontentloaded');
        assert.equal(popup.url(),target); await popup.close(); await context.unroute(target);
        assert.equal(await page.evaluate(()=>Number(document.querySelector('.map-mode-button[aria-current="true"]').textContent)),3);
        scan.sourceLinkNavigation = 'passed with local destination fixture';
      }
      if(width<=900) await page.locator('[data-mobile-exhibit-step="1"]').click();
      else await readout.locator(number===1 ? '[data-firms-step="1"]' : '[data-planet-step="1"]').click();
      await page.waitForFunction(n=>Number(document.querySelector('.map-mode-button[aria-current="true"]')?.textContent)===n,number+1);
    }
    if(!before) {
      await page.waitForFunction(()=>document.querySelectorAll('.gaia-realtime-credit:not([hidden])').length===0);
      assert.equal(await page.locator('.gaia-realtime-status:visible').count(),0,'Historical exhibit has no stale realtime source');
    }
    console.log(`${before?'BEFORE':'PASS'} ${width}x${height}: 01–05 source location and 06 cleanup`);
    await context.close();
  }
  assert.deepEqual(report.errors,[]); report.status='passed';
} catch(error) {report.status='failed';report.failure=error.stack;process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally {await browser.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,failure:report.failure}));}
