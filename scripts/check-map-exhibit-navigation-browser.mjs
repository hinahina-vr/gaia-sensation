import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const language=process.env.QA_LANGUAGE||'ja';
const output=process.env.GAIA_OUTPUT_DIR||'artifacts/map-exhibit-navigation'+(language==='ja'?'':'-'+language);fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const results=[];let page;
const number=()=>page.locator('#japan-mode-number').textContent().then(Number);
const settle=async n=>{
  await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number')?.textContent)===n&&globalThis.GaiaMapPlayback?.getState().ready,n,{timeout:45000});
  await page.waitForTimeout(800);
};
try {
  for(const [width,height] of (process.env.QA_VIEWPORTS||'1440x900,390x844,320x568,844x390').split(',').map(value=>value.split('x').map(Number))) {
    const context=await browser.newContext({viewport:{width,height},isMobile:width<=900,hasTouch:width<=900});
    await context.addInitScript(lang=>localStorage.setItem('gaia:language:v1',lang),language);
    page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://**',route=>route.abort());
    await page.goto('http://127.0.0.1:4492/#world-08');
    await settle(8);
    const next=page.locator('[data-map-stable-step="1"]'),previous=page.locator('[data-map-stable-step="-1"]'),menu=page.locator('[data-map-menu-toggle]');
    await menu.waitFor({state:'visible'});
    await page.waitForTimeout(3000);
    await page.screenshot({path:`${output}/${width}-8.png`});
    const samples=[];
    await page.mouse.move(1,1);
    for(let i=0;i<38;i++){
      samples.push(await next.evaluate(node=>({transform:getComputedStyle(node,'::before').transform,animation:getComputedStyle(node,'::before').animationName,playState:getComputedStyle(node,'::before').animationPlayState,nav:node.parentElement.className,rect:node.getBoundingClientRect().toJSON()})));
      await page.waitForTimeout(80);
    }
    fs.writeFileSync(`${output}/${width}-heartbeat.json`,JSON.stringify(samples,null,2));
    assert(samples.every(s=>s.animation==='map-next-heartbeat'));
    assert(new Set(samples.map(s=>s.transform)).size>6,'heartbeat must visibly animate');
    assert(samples.some(s=>Number(s.transform.match(/matrix\(([^,]+)/)?.[1])>1.04),'heartbeat must visibly expand');
    assert(Math.max(...samples.map(s=>s.rect.width))-Math.min(...samples.map(s=>s.rect.width))<1,'animated surface must not move the click target');
    await next.click();await settle(9);await previous.click();await settle(8);
    assert.equal(new URL(page.url()).hash,'#world-08');
    await menu.click();
    const picker=page.locator(width>900?'#map-dock-bank-popover':'#map-mobile-sheet');
    await picker.waitFor({state:'visible'});await page.waitForTimeout(250);
    await page.screenshot({path:`${output}/${width}-menu.png`});
    if(width>900) {
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.activeElement?.matches('[data-map-menu-toggle]'));
      await menu.click();
      await picker.locator('.map-mode-button').filter({hasText:/^13$/}).click();
    } else await picker.locator('[data-mobile-exhibit="13"]').click();
    await settle(13);
    if(width>900){
      await menu.hover();await picker.waitFor({state:'visible'});
      await menu.click();await picker.waitFor({state:'visible'});
      await page.keyboard.press('Escape');await picker.waitFor({state:'hidden'});
    }
    else {await menu.click();await picker.locator('[data-mobile-sheet-close]').click();await page.waitForFunction(()=>document.activeElement?.matches('[data-map-menu-toggle]'));}
    const positions=[];
    for(const n of [1,2,8,12,17,21,31,69,70,71]) {
      await page.evaluate(n=>{location.hash=`#world-${String(n).padStart(2,'0')}`;},n);await settle(n);
      const scan=await page.locator('#map-stable-navigation').evaluate(nav=>{
        const rect=nav.getBoundingClientRect();
        return {rect:rect.toJSON(),overflow:document.documentElement.scrollWidth-innerWidth,
          // The heartbeat intentionally expands its decorative ::before.
          // Check actual text bounds, not scrollWidth including that surface.
          controls:[...nav.querySelectorAll('button')].map(button=>{
            const r=button.getBoundingClientRect();
            const textBounds=[...button.children].map(child=>{const range=document.createRange();range.selectNodeContents(child);return range.getBoundingClientRect().toJSON();});
            return {label:button.textContent,rect:r.toJSON(),textBounds,scrollWidth:button.scrollWidth,hit:button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),overflow:textBounds.some(t=>t.width&&(t.left<r.left-1||t.right>r.right+1))};
          })};
      });
      assert(scan.rect.top>=0&&scan.rect.bottom<=height,`navigation in viewport: ${width}/${n}`);
      assert.equal(scan.overflow,0);assert(scan.controls.every(b=>b.hit&&!b.overflow),`usable labels/targets: ${width}/${n} ${JSON.stringify(scan)}`);
      positions.push({n,...scan});
      if([17,31,71].includes(n))await page.screenshot({path:`${output}/${width}-${n}.png`});
    }
    await next.click();await settle(1);await previous.click();await settle(71);
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await next.evaluate(node=>getComputedStyle(node,'::before').animationName),'none');
    assert.deepEqual(errors,[]);
    results.push({width,height,heartbeatSamples:samples,positions,menuSelection:13,wrapBothWays:true,reducedMotion:true,errors});
    console.log('PASS exhibit navigation',width,height);
    await context.close();
  }
} catch(error) {
  console.error(await page?.evaluate(()=>({number:document.querySelector('#japan-mode-number')?.textContent,playback:globalThis.GaiaMapPlayback?.getState(),nav:document.querySelector('#map-stable-navigation')?.getBoundingClientRect().toJSON()})));
  await page?.screenshot({path:`${output}/failure.png`}).catch(()=>{});
  throw error;
} finally {fs.writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2));await browser.close();}
