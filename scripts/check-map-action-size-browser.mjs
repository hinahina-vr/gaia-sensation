import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/map-action-size-20260912/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, {recursive:true});
const files = ['map-unified-dock.css','map-observation-typography.css','map-exhibit-actions.css','realtime-exhibits.css','food-exhibits.css','ecologies-exhibit.js','gaia-mode-loader.js','index.html'];
const report = {status:'running',before,checks:[],errors:[],missing:[],scope:'Installed Chrome, local application and production CSP. Repository data with external APIs blocked; desktop/mobile emulation, not physical devices or production.',hashes:Object.fromEntries(files.map(file => [file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))};
const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
const select = async n => {
  await page.evaluate(n=>GaiaMapCategories.buttons()[n-1].click(),n);
  await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n && !document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n);
  await page.waitForTimeout(160);
};
const actions = '.map-dock-action:visible,.gaia-map-actions > .gaia-map-action:visible';
const exercise = async (width, n, mobile = false) => {
  if(n>=31 && n<=69){
    await page.waitForFunction(()=>GaiaMarineCod.getState().dataState==='ready');
    const region=page.locator('[data-cod-prefecture]');
    const regionValue=await region.locator('option').evaluateAll(options=>options.find(option=>option.value==='13')?.value || options.find(option=>option.value!=='all' && !option.disabled)?.value);
    await region.selectOption(regionValue);
    const station=page.locator('[data-cod-station]');
    const value=await station.locator('option').evaluateAll(options=>options.find(option=>option.value && !option.disabled)?.value);
    assert(value,'A real station is available for analysis');
    await station.selectOption(value);
    await page.waitForFunction(()=>!document.querySelector('[data-cod-analysis]').disabled);
  }
  if(n>=70){
    await page.waitForFunction(()=>GaiaFoodExhibits.getState().dataState==='ready');
    await page.locator('[data-food-country]').selectOption('392');
  }
  const openTools = async () => { if(mobile)await page.locator('[data-mobile-sheet="tools"]').click(); };
  const action = name => mobile ? page.locator('#map-mobile-sheet').getByRole('button',{name,exact:true}) : page.locator(actions).filter({hasText:name});
  await openTools();
  // Include keyboard activation of the original 06 entry.
  const source=action('データの出典');
  if(n===6 && !mobile){await source.focus();await source.press('Enter');}else await source.click();
  await page.locator('#japan-data-panel[aria-hidden="false"]').waitFor();
  assert((await page.locator('#japan-data-panel').innerText()).length>80);
  await page.locator('#japan-data-close').click();
  await page.locator('#japan-data-panel').waitFor({state:'hidden'});
  await openTools();
  const analysis=action('統計分析');
  const unavailable = n<=5 || (n>=15 && n<=20);
  if(unavailable){
    assert(await analysis.isDisabled() || await analysis.getAttribute('aria-disabled')==='true');
    if(mobile)await page.locator('[data-mobile-sheet-close]').click();
    else {
      await analysis.hover();
      await page.locator('#map-analysis-unavailable-tooltip:not([hidden])').waitFor();
      const box=await analysis.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
      assert(!(await page.locator('#gaia-statistics-lab').isVisible()));
    }
  }else{
    await analysis.click();
    await page.locator('#gaia-statistics-lab[aria-hidden="false"]').waitFor();
    await page.waitForFunction(()=>GaiaStatisticsLab.getState().analysisReady);
    assert((await page.locator('#gaia-statistics-canvas').getAttribute('data-point-count'))>0);
    await page.locator('#gaia-statistics-close').click();
    await page.locator('#gaia-statistics-lab').waitFor({state:'hidden'});
  }
  await page.mouse.move(0,0);
  report.checks.push({width,n,phase:mobile?'mobile source/analysis':'source/analysis',analysis:unavailable?'unavailable preserved':'opened real chart'});
};
try {
  const sizes = before ? [[1440,900],[3840,2160],[1024,768]] : [[1440,900],[3840,2160],[1920,1080],[1400,900],[1280,900],[1024,768],[901,768],[390,844],[900,768]];
  for (const [width,height] of sizes.filter(([w]) => !process.env.QA_WIDTHS || process.env.QA_WIDTHS.split(',').map(Number).includes(w))) {
    const context = await browser.newContext({viewport:{width,height},hasTouch:width<=900,isMobile:width<600,reducedMotion:'reduce'});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',route=>route.abort());
    await context.route('**/api/live/v1/firms',route=>route.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
    page = await context.newPage();
    page.on('pageerror',error=>report.errors.push(`${width}: ${error.message}`));
    page.on('response',response=>{if(response.status()===404) report.missing.push(response.url());});
    await page.goto(base+'/#world',{waitUntil:'domcontentloaded'});
    await page.locator('[data-feature-start]').click();
    await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});
    await page.waitForFunction(()=>globalThis.GaiaMapCategories?.buttons().length===71);
    await page.evaluate(async()=>{await GaiaMapObservationAdapter.waitSignalsReady();GaiaMapDemo.stop();});
    if(width<=900){
      for(const n of [6,15,21,70]){
        await select(n);
        assert.equal(await page.locator(actions).count(),0,'Desktop tiles stay hidden on mobile');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
        await page.locator('[data-mobile-sheet="tools"]').click();
        await page.screenshot({path:path.join(output,`${width}-${n}-mobile-tools.png`)});
        await page.locator('[data-mobile-sheet-close]').click();
        await exercise(width,n,true);
      }
      assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);
      await context.close();console.log(`PASS ${width}: mobile tools, source, analysis and unavailable state`);continue;
    }
    const samples = [6,9,12,1,4,15,21,31,44,55,65,68,70,71];
    const numbers = process.env.QA_EXHIBITS ? [6,...process.env.QA_EXHIBITS.split(',').map(Number).filter(n=>n!==6)] : before || width!==3840 ? samples : [6,...Array.from({length:71},(_,i)=>i+1).filter(n=>n!==6)];
    let reference;
    for (const n of numbers) {
      await select(n);
      await page.mouse.move(0,0);
      const data = await page.evaluate(()=>{
        const buttons=[...document.querySelectorAll('.map-dock-action,.gaia-map-actions > .gaia-map-action')].filter(node=>node.checkVisibility({checkVisibilityCSS:true}));
        const type = node => {if(!node)return null;const s=getComputedStyle(node);return {fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing};};
        return {overflow:document.documentElement.scrollWidth-innerWidth,layerClass:document.querySelector('#japan-layer').className,ecologiesVisible:document.querySelector('.ecologies-exhibit')?.checkVisibility({checkVisibilityCSS:true}),buttons:buttons.map(button=>{
          const r=button.getBoundingClientRect(),s=getComputedStyle(button);
          const child=selector=>{const node=button.querySelector(selector);if(!node)return null;const box=node.getBoundingClientRect();return {x:box.x-r.x,y:box.y-r.y,width:box.width,height:box.height,overflow:node.scrollWidth-node.clientWidth,...type(node)};};
          return {className:button.className,text:button.textContent,disabled:button.disabled,ariaDisabled:button.getAttribute('aria-disabled'),rect:r.toJSON(),padding:s.padding,gap:s.gap,rows:s.gridTemplateRows,columns:s.gridTemplateColumns,alignItems:s.alignItems,alignContent:s.alignContent,minHeight:s.minHeight,maxHeight:s.maxHeight,font:type(button),icon:child('i'),copy:child('span'),small:child('small'),strong:child('strong'),hit:button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
        })};
      });
      assert(data.buttons.length>0,`${width}/${n}: no visible actions`);
      if(n===6)reference=data.buttons[0];
      report.checks.push({width,height,n,...data});
      if(samples.includes(n)) {
        const rects=data.buttons.map(button=>button.rect);
        const x=Math.max(0,Math.min(...rects.map(r=>r.x))-8), y=Math.max(0,Math.min(...rects.map(r=>r.y))-8);
        const right=Math.min(width,Math.max(...rects.map(r=>r.right))+8), bottom=Math.min(height,Math.max(...rects.map(r=>r.bottom))+8);
        await page.screenshot({path:path.join(output,`${width}-${n}-buttons.png`),clip:{x,y,width:right-x,height:bottom-y}});
        if([6,9,15,21,31,70].includes(n))await page.screenshot({path:path.join(output,`${width}-${n}-page.png`)});
      }
      if(!before) {
        assert.equal(data.overflow,0);
        assert.equal(Boolean(data.ecologiesVisible),n===12,`${width}/${n}: previous ecology panel remained visible`);
        for(const button of data.buttons) {
          for(const key of ['width','height'])assert(Math.abs(button.rect[key]-reference.rect[key])<.6,`${width}/${n} ${key}: ${button.rect[key]} != 06 ${reference.rect[key]}`);
          assert(button.rect.x>=0 && button.rect.right<=width+1 && button.rect.y>=0 && button.rect.bottom<=height+1 && button.hit,`${width}/${n} button offscreen/covered`);
          assert(button.rect.height>=44);
          assert(button.strong.overflow<=1,`${width}/${n} title clipped`);
          for(const key of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing']) {
            assert.equal(button.small[key],reference.small[key],`${width}/${n} label ${key}`);
            assert.equal(button.strong[key],reference.strong[key],`${width}/${n} title ${key}`);
          }
          for(const child of ['small','strong','icon'])for(const key of ['x','y','height'])assert(Math.abs(button[child][key]-reference[child][key])<.6,`${width}/${n} ${child} ${key} differs from 06`);
          for(const child of ['small','strong','icon'])assert(button[child].y>=0 && button[child].y+button[child].height<=button.rect.height,`${width}/${n} ${child} vertically clipped`);
        }
        if(width===1440 && [6,1,15,21,31,70].includes(n))await exercise(width,n);
      }
    }
    console.log(`${before?'BASELINE':'PASS'} ${width}: ${numbers.length} exhibits; 06 ${reference.rect.width}x${reference.rect.height}, label ${reference.small.fontSize}/${reference.small.lineHeight}, title ${reference.strong.fontSize}`);
    if(!before)assert.deepEqual(await page.evaluate(()=>window.__securityViolations),[]);
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    await context.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
