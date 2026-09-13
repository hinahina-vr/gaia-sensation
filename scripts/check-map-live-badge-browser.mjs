import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const before=process.argv.includes('--before'),base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/map-live-badge-20260912/${before?'before':'after'}`);fs.mkdirSync(output,{recursive:true});
const files=['map-exhibit-categories.css','map-exhibit-categories.js','gaia-mode-loader.js','index.html'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const report={status:'running',before,checks:[],errors:[],hashes:hashes(),scope:'Local installed Chrome, production CSP, repository data. Emulated desktop/touch and reduced-motion; not physical devices, production or live API verification.'};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let page;
const contrast=(a,b)=>{const luminance=c=>c.match(/[\d.]+/g).slice(0,3).map(v=>Number(v)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
try{
 const sizes=process.env.QA_VIEWPORTS?.split(',').map(s=>s.split('x').map(Number))||(before?[[1440,900],[390,844]]:[[1440,900],[3840,2160],[901,900],[390,844],[320,568],[844,390],[1440,900,true],[390,844,true]]);
 for(const [width,height,reduced=false] of sizes){
  const mobile=width<=900,ctx=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,reducedMotion:reduced?'reduce':'no-preference'});await enforceBrowserSecurity(ctx,base);await ctx.route('https://**',r=>r.abort());await ctx.route('**/api/live/v1/firms*',r=>r.fulfill({path:'data/firms-active-fire-snapshot.json',contentType:'application/json'}));
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/?exhibit=21#world',{waitUntil:'domcontentloaded'});await page.locator('[data-feature-start]').click();await page.locator('#gaia-mode-entry-guide').waitFor({state:'hidden'});await page.evaluate(()=>GaiaMapDemo.stop());
  const menu=page.locator(mobile?'#map-mobile-sheet':'#map-dock-bank-popover');
  const open=async()=>{await page.locator(mobile?'[data-mobile-sheet="exhibits"]':'[data-map-bank-toggle]:visible').first().click();await menu.waitFor({state:'visible'});};
  await page.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));
  await open();const tileSelector=mobile?'[data-mobile-exhibit]':'.map-mode-button';
  for(const scope of ['world','japan']){
   await menu.locator(`[role="tab"][data-map-scope="${scope}"]`).click();await page.mouse.move(width-2,2);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
   const panel=menu.locator(`[role="tabpanel"][data-map-scope="${scope}"]`);
   const scan=await panel.locator(tileSelector).evaluateAll(nodes=>nodes.map(e=>{const badge=e.querySelector('.map-tile-live'),s=badge&&getComputedStyle(badge);return {number:Number(e.dataset.mobileExhibit||e.textContent),name:e.getAttribute('aria-label'),time:e.dataset.mapTime,symbol:e.dataset.mapSymbol,tile:e.getBoundingClientRect().toJSON(),badge:badge?.getBoundingClientRect().toJSON(),style:s&&{color:s.color,background:s.backgroundColor,opacity:s.opacity,fontSize:s.fontSize,animation:s.animationName,duration:s.animationDuration},symbolFont:getComputedStyle(e,'::before').fontSize};}));
   const lives=scan.filter(t=>t.badge);assert.deepEqual(lives.map(t=>t.number).sort((a,b)=>a-b),scope==='world'?[1,2,3,4,5]:[15,16,17,18,19,20]);assert(scan.every(t=>(t.time==='realtime')===Boolean(t.badge)));
   for(const t of lives){assert(t.badge.left>=t.tile.left&&t.badge.right<=t.tile.right&&t.badge.top>=t.tile.top&&t.badge.bottom<=t.tile.bottom);if(!before){assert.equal(t.style.color,'rgb(255, 255, 255)');assert(contrast(t.style.color,t.style.background)>=4.5);assert.equal(t.style.opacity,'1');assert.equal(t.style.animation,reduced?'none':'map-tile-live-pulse');}}
   assert((await menu.textContent()).includes('保存値を含む'),'The LIVE exhibit classification must not imply a verified active connection');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
   // Inspect the browser's actual generated symbol box, not only CSS values.
   if(!before){
    const cdp=await ctx.newCDPSession(page),{root}=await cdp.send('DOM.getDocument');
    for(const t of lives){
     await panel.locator(tileSelector).evaluateAll((nodes,n)=>{nodes.find(e=>Number(e.dataset.mobileExhibit||e.textContent)===n).dataset.qaLiveTile=String(n);},t.number);
     const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:`[data-qa-live-tile="${t.number}"]`});const {node}=await cdp.send('DOM.describeNode',{nodeId});
     const symbol=node.pseudoElements.find(p=>p.pseudoType==='before');assert(symbol);
     const [{model},{model:tileBox}]=await Promise.all([cdp.send('DOM.getBoxModel',{backendNodeId:symbol.backendNodeId}),cdp.send('DOM.getBoxModel',{nodeId})]);
     // Compare within the tile; the popup itself can reposition while a provider finishes loading.
     const top=Math.min(model.border[1],model.border[3],model.border[5],model.border[7])-Math.min(tileBox.border[1],tileBox.border[3],tileBox.border[5],tileBox.border[7]);assert(t.badge.bottom-t.tile.top<=top+1,`${width}/${t.number}: LIVE overlaps the symbol`);t.symbolOffsetTop=top;
    }
    await cdp.detach();
   }
   const first=panel.locator('.map-tile-live').first();await first.scrollIntoViewIfNeeded();
   if(!before){
    const sample=()=>first.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return{color:s.color,background:s.backgroundColor,opacity:s.opacity,shadow:s.boxShadow,rect:r.toJSON(),offset:{x:r.x-p.x,y:r.y-p.y}};});
    const frames=[];for(let i=0;i<5;i++){frames.push(await sample());await page.waitForTimeout(160);}
    if(reduced)assert.equal(new Set(frames.map(f=>f.background+f.shadow)).size,1);else assert(new Set(frames.map(f=>f.background+f.shadow)).size>1,'Badge fill/glow must actually pulse');
    assert(frames.every(f=>f.color==='rgb(255, 255, 255)'&&f.opacity==='1'&&contrast(f.color,f.background)>=4.5));
    assert(frames.every(f=>f.offset.x===frames[0].offset.x&&f.offset.y===frames[0].offset.y&&f.rect.width===frames[0].rect.width&&f.rect.height===frames[0].rect.height));
    if(!reduced){
     for(const [name,time] of [['dim',0],['bright',900]]){await panel.locator('.map-tile-live').evaluateAll((nodes,time)=>nodes.forEach(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=time;})),time);await menu.screenshot({path:path.join(output,`${width}-${scope}-${name}.png`)});}
    }
    report.checks.push({width,height,reduced,scope,tiles:scan,frames});
   }else report.checks.push({width,height,reduced,scope,tiles:scan});
   await menu.screenshot({path:path.join(output,`${width}-${scope}${reduced?'-reduced':''}.png`)});
   if(!before){
    const number=scope==='world'?3:15,target=panel.locator(tileSelector).filter({has:page.locator('.map-tile-live')}).filter({hasText:new RegExp(`^${String(number).padStart(2,'0')}$`)});
    // Mobile buttons keep their number in a data attribute rather than text.
    const chosen=mobile?panel.locator(`[data-mobile-exhibit="${number}"]`):target;
    await chosen.scrollIntoViewIfNeeded();const badge=await chosen.locator('.map-tile-live').boundingBox();if(mobile)await page.touchscreen.tap(badge.x+badge.width/2,badge.y+badge.height/2);else await page.mouse.click(badge.x+badge.width/2,badge.y+badge.height/2);
    await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),number);await menu.waitFor({state:'hidden'});await open();
   }
  }
  assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await ctx.close();console.log('PASS',width,height,reduced?'reduced':'motion');
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(hashes(),report.hashes);report.status=before?'recorded':'passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
