import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before');
const focused=process.argv.includes('--focused');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/map-periodic-picker-20260912/${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const report={status:'running',before,checks:[],errors:[],hashes:{},scope:'Installed Chrome, actual local renderer/data and production CSP; saved external-feed fixtures. Emulated desktop/touch sizes, not physical devices or live-provider validation.'};
for(const f of ['app.js','map-exhibit-categories.js','map-exhibit-categories.css','map-mobile-shell.js','map-mobile-shell.css','gaia-mode-loader.js','index.html'])report.hashes[f]=createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
  const sizes=before?[[1440,900],[3840,2160],[390,844]]:focused?[[1440,900],[390,844]]:[[1440,900],[1920,1080],[3840,2160],[1024,768],[390,844],[320,568],[844,390],[1440,900,true]];
  for(const [width,height,reduced=false] of sizes){
    const mobile=width<=900;
    const context=await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile,reducedMotion:reduced?'reduce':'no-preference'});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',r=>r.abort());
    await context.route('https://services.swpc.noaa.gov/**',r=>r.fulfill({path:'data/ovation-aurora-snapshot.json',contentType:'application/json'}));
    await context.route('https://earthquake.usgs.gov/**',r=>r.fulfill({json:{type:'FeatureCollection',features:[]}}));
    await context.route('**/api/live/v1/firms',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
    page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(base+'/?exhibit=44#world',{waitUntil:'domcontentloaded'});
    if(focused){
      await page.locator('[data-feature-guide]').click();
      await page.locator('.gaia-mode-entry-guide-card[data-positioned="true"]').waitFor();
      assert.match(await page.locator('[data-mode-guide-copy]').textContent(),/赤いLIVE/);
      await page.screenshot({path:path.join(output,`${width}-guide-live.png`)});
      await page.keyboard.press('Escape');await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
    }else await page.locator('[data-feature-start]').click();
    await page.evaluate(()=>GaiaMapDemo.stop());
    const idle=n=>page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);
    await idle(44);await page.waitForFunction(()=>GaiaMapCategories.buttons().length===71);
    const menu=page.locator(mobile?'#map-mobile-sheet':'.map-dock-bank-popover');
    const open=async()=>{
      if(mobile)await page.locator('[data-map-menu-toggle]').tap();
      else {const extended=page.locator('[data-map-bank-toggle]:visible').first();await (await extended.count()?extended:page.locator('.map-dock-bank-trigger')).click();}
      await menu.waitFor({state:'visible'});
    };
    await open();
    const all=mobile?'[data-mobile-exhibit]':'.map-category-list .map-mode-button';
    const tab=scope=>menu.locator(`[role="tab"][data-map-scope="${scope}"]`);
    assert.deepEqual(await page.evaluate(()=>GaiaMapCategories.buttons().map(b=>Number(b.textContent))),Array.from({length:71},(_,i)=>i+1));
    for(const scope of ['world','japan']){
      await tab(scope).click();await page.mouse.move(width-2,2);
      await page.waitForFunction(()=>document.getAnimations().every(a=>a.id!=='map-picker-reveal'));
      const panel=menu.locator(`[role="tabpanel"][data-map-scope="${scope}"]`);
      const metrics=await menu.evaluate((e,mobile)=>{const s=mobile?e.querySelector('.map-mobile-sheet-body'):e;return {box:e.getBoundingClientRect().toJSON(),scrollHeight:s.scrollHeight,clientHeight:s.clientHeight,overflow:s.scrollHeight-s.clientHeight};},mobile);
      const tiles=await panel.locator(all).evaluateAll(bs=>bs.map(b=>({number:Number(b.dataset.mobileExhibit||b.textContent),symbol:b.dataset.mapSymbol,detail:b.dataset.mapDetail,time:b.dataset.mapTime,name:b.getAttribute('aria-label'),box:b.getBoundingClientRect().toJSON(),font:getComputedStyle(b).fontSize,caption:getComputedStyle(b,'::before').content,captionFont:getComputedStyle(b,'::before').fontSize,live:b.querySelector('.map-tile-live')?getComputedStyle(b.querySelector('.map-tile-live')).animationName:null})));
      assert.equal(tiles.length,scope==='world'?16:55);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
      if(!before){
        assert(tiles.every(t=>t.symbol&&t.box.width>=44&&t.box.height>=44&&t.font==='0px'));
        assert(tiles.every(t=>t.caption===JSON.stringify(t.symbol)));
        assert(tiles.every(t=>(t.time==='realtime')===(t.live!==null)));
        assert(tiles.filter(t=>t.live).every(t=>t.live===(reduced?'none':'map-tile-live-pulse')));
        if(scope==='japan')assert.equal(tiles.find(t=>t.number===44).symbol,'SO₂');
        if(width>=1440)assert(metrics.overflow<=1,'The roomy desktop picker should fit without scrolling');
      }else assert(tiles.every(t=>!t.symbol));
      await menu.screenshot({path:path.join(output,`${width}-${scope}${reduced?'-reduced':''}.png`)});
      report.checks.push({width,height,reduced,scope,metrics,tiles});
    }
    if(!before){
      if(focused){
        await tab('japan').press('Home');assert.equal(await tab('world').getAttribute('aria-selected'),'true');
        await tab('world').press('ArrowRight');assert.equal(await tab('japan').getAttribute('aria-selected'),'true');
        await page.waitForFunction(()=>document.getAnimations().every(a=>a.id!=='map-picker-reveal'));
        if(mobile){
          const box=await menu.locator('.map-mobile-sheet-body').boundingBox();
          const cdp=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height-20;
          await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
          for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*30}]});await page.waitForTimeout(20);}
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          await page.waitForFunction(()=>document.querySelector('.map-mobile-sheet-body').scrollTop>0);
          await menu.locator('[role="tabpanel"]:visible .map-mobile-category-nav').getByRole('button',{name:'大気と汚染',exact:true}).tap();
          await page.screenshot({path:path.join(output,`${width}-air-after-swipe.png`)});
        }else{
          const hit=await menu.locator('.map-mode-button:visible').evaluateAll(bs=>bs.every(b=>{const r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
          assert(hit,'No provider legend/readout covers any of the 55 tile hit targets');
          const live=menu.locator('.map-tile-live:visible').first();
          const opacity=()=>live.evaluate(e=>Number(getComputedStyle(e).opacity));
          const samples=[await opacity()];
          for(let i=0;i<3;i++){await page.waitForTimeout(180);samples.push(await opacity());}
          assert(Math.max(...samples)-Math.min(...samples)>.03,'The LIVE badge opacity actually pulses');
        }
      }
      for(const number of focused?[44,16,70]:width===1440&&!reduced?[44,45,46,47,48,49,50,51,52,53,54,32,34,36,56,57,65,66,67,69,6,15,24,7,70,71,14]:width===390?[44,51,54,34,57,66,3,16,25,70]:[44,16,70]){
        await tab(number<=14||number>=70?'world':'japan').click();
        const target=mobile?menu.locator(`[data-mobile-exhibit="${number}"]`):menu.locator('.map-mode-button').filter({hasText:new RegExp(`^${String(number).padStart(2,'0')}$`)});
        await target.click();await idle(number);await open();
        assert.equal(await menu.locator(`${all}[aria-current="true"]:visible`).count(),1);
      }
      await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
      const next=page.locator('[data-map-stable-step="1"]');
      const current=Number(await page.locator('#japan-mode-number').textContent());await next.click();await idle(current===71?1:current+1);
      assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);
    }
    await context.close();console.log(`PASS ${width}x${height}${reduced?' reduced':''}`);
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
