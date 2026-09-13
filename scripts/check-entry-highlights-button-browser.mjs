import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before'),base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/entry-highlights-button-20260912/${before?'before':'after'}`);fs.mkdirSync(output,{recursive:true});
const files=['mode-entry-guide.js','mode-feature-intro.css','gaia-mode-loader.js','index.html','sensors/index.html'];const hashes=()=>Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const report={status:'running',before,checks:[],errors:[],hashes:hashes(),scope:'Installed Chrome, local repository assets and FIRMS snapshot fixture, production CSP. Native click/touch/keyboard and actual title timer; not physical devices or production.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
try{
 for(const [width,height,reduced=false] of process.argv.includes('--pressed-only')?[[1440,900],[1440,900,true]]:before?[[1440,900],[390,844]]:[[1440,900],[3840,2160],[901,768],[390,844],[320,568],[844,390],[1440,900,true]]){
  const mobile=width<=900,ctx=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,reducedMotion:reduced?'reduce':'no-preference'});await enforceBrowserSecurity(ctx,base);await ctx.route('https://**',r=>r.abort());await ctx.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/#world',{waitUntil:'domcontentloaded'});
  const button=page.locator('[data-entry-title-skip]'),layer=page.locator('#gaia-mode-entry-guide'),features=page.locator('#gaia-mode-entry-guide[data-phase="features"].is-feature-ready');
  const titleReady=async()=>{await page.locator('#gaia-mode-entry-guide[data-phase="title"].is-title-visible').waitFor();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.gaia-mode-entry-title')).opacity==='1');};
  await titleReady();
  const scan=await button.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),t=e.closest('.gaia-mode-entry-title');return{label:e.getAttribute('aria-label'),text:e.innerText,rect:r.toJSON(),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),focused:e===document.activeElement,style:{borderRadius:s.borderRadius,border:s.border,outline:s.outlineStyle,background:s.backgroundImage,color:s.color,font:s.font,transition:s.transitionDuration},heading:t.querySelector('h2').textContent,headingShadow:getComputedStyle(t.querySelector('h2')).textShadow,layerBackground:getComputedStyle(t.parentElement).backgroundColor,overflow:document.documentElement.scrollWidth-innerWidth,children:[...e.querySelectorAll('span,svg')].map(n=>({class:n.getAttribute('class'),rect:n.getBoundingClientRect().toJSON()}))};});
  assert.equal(scan.heading,'世界を観測する');assert.equal(scan.headingShadow,'none');assert.equal(scan.layerBackground,'rgba(10, 20, 30, 0.8)');assert(scan.focused&&scan.hit);assert.equal(scan.overflow,0);assert(scan.rect.width>=44&&scan.rect.height>=44&&scan.rect.left>=8&&scan.rect.right<=width-8&&scan.rect.top>=0&&scan.rect.bottom<=height);
  if(!before){assert(scan.text.includes('見どころへ'));assert(parseFloat(scan.style.borderRadius)>=30);assert.notEqual(scan.style.background,'none');assert(scan.label.includes('見どころ紹介へ'));for(const c of scan.children)assert(c.rect.left>=scan.rect.left&&c.rect.right<=scan.rect.right+1&&c.rect.top>=scan.rect.top&&c.rect.bottom<=scan.rect.bottom+1);}
  await page.screenshot({path:path.join(output,`${width}${reduced?'-reduced':''}-title.png`)});
  await page.screenshot({path:path.join(output,`${width}${reduced?'-reduced':''}-button.png`),clip:{x:scan.rect.x-7,y:scan.rect.y-7,width:scan.rect.width+14,height:scan.rect.height+14}});
  if(before){report.checks.push({width,height,reduced,...scan});await ctx.close();continue;}
  if(width===1440){
   await button.hover();await page.waitForTimeout(reduced?0:180);
   const hover=await button.evaluate(e=>({background:getComputedStyle(e).backgroundImage,border:getComputedStyle(e).borderColor,arrow:getComputedStyle(e.querySelector('.entry-highlight-arrow svg')).transform}));
   if(reduced)assert.equal(hover.arrow,'none');else assert.notEqual(hover.arrow,'none');
   await page.screenshot({path:path.join(output,`${width}${reduced?'-reduced':''}-hover.png`)});scan.hover=hover;
  }
  if(process.argv.includes('--pressed-only')){
   const r=await button.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.waitForTimeout(90);
   const pressed=await button.evaluate(e=>({active:e.matches(':active'),transform:getComputedStyle(e).transform}));assert(pressed.active);assert(reduced?pressed.transform==='none':pressed.transform!=='none');scan.pressed=pressed;
   await page.screenshot({path:path.join(output,`${width}${reduced?'-reduced':''}-pressed.png`)});await page.mouse.up();
  }else if(mobile)await button.tap();else await button.press('Enter');
  await features.waitFor();assert.equal(await button.isVisible(),false);assert.equal(await page.locator('[data-feature-start]').evaluate(e=>e===document.activeElement),true);
  await page.locator('[data-feature-guide]').click();await page.locator('.gaia-mode-entry-guide-card[data-positioned="true"]').waitFor();await page.locator('[data-mode-guide-next]').click();await page.keyboard.press('Escape');await layer.waitFor({state:'hidden'});
  const replay=async()=>{if(mobile){await page.locator('[data-mobile-sheet="tools"]').click();await page.locator('#map-mobile-sheet').getByRole('button',{name:'地図ガイド',exact:true}).click();}else await page.locator('[data-gaia-mode-guide-replay="map"]').click();await page.locator('#gaia-mode-entry-guide[data-phase="title"]').waitFor();};
  await replay();await page.keyboard.press('Tab');assert.equal(await button.evaluate(e=>e===document.activeElement),true);await button.press('Space');await features.waitFor();await page.locator('[data-feature-start]').click();await layer.waitFor({state:'hidden'});
  if(width===1440||width===390){
   await replay();await page.keyboard.press('Escape');await layer.waitFor({state:'hidden'});await page.waitForTimeout(3000);assert.equal(await layer.isVisible(),false);
   await replay();const start=Date.now();await features.waitFor();const elapsed=Date.now()-start;assert(elapsed>=1900&&elapsed<5000,'Original automatic title-to-features interval remains');await page.locator('[data-feature-close]').click();await layer.waitFor({state:'hidden'});scan.automaticMilliseconds=elapsed;
  }
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);report.checks.push({width,height,reduced,...scan,interactions:'Enter/tap, guide, replay, Tab/Space and start; 1440/390 also cancel and automatic timer'});await ctx.close();console.log('PASS',width,height,reduced?'reduced':'motion');
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(hashes(),report.hashes);report.status=before?'recorded':'passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
