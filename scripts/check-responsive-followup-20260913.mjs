// E01〜E06を同じ条件・通常操作で確認し、境界幅と日英中を回帰試験する。
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {chromium} from 'playwright-core';
const probe=process.env.FOLLOWUP_STAGE==='probe';
const out=`artifacts/responsive-followup-20260913/${process.env.FOLLOWUP_OUTPUT||(probe?'probe':'final')}`;fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[],errors=[];let c,p;
const files=['index.html','gaia-mode-loader.js','map-responsive-layout.js','responsive-audit-fixes.css','statistics-lab.js','sound-mode.js','novel-mode.css'];
fs.writeFileSync(`${out}/manifest.json`,JSON.stringify({date:new Date().toISOString(),browser:b.version(),motion:probe?'normal':'normal reproduction; reduced motion boundary matrix',files:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))},null,2));
async function start(w,h,lang='en',motion='no-preference'){
 await c?.close();c=await b.newContext({viewport:{width:w,height:h},hasTouch:w<=1024,isMobile:w<=900,deviceScaleFactor:w<=900?3:1,reducedMotion:motion});await c.route('https://**',r=>r.abort());
 await c.addInitScript(lang=>{if(location.protocol==='http:')localStorage.setItem('gaia:language:v1',lang);},lang);p=await c.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));
}
async function map(n){await p.goto('http://127.0.0.1:4492/#world-'+n);await p.locator('#gaia-boot').waitFor({state:'hidden'});await p.waitForFunction(n=>globalThis.GaiaMapPlayback?.getState().ready&&Number(document.querySelector('#japan-mode-number')?.textContent)===n,n);await p.waitForTimeout(probe?4300:2600);await p.waitForFunction(()=>!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'));await p.waitForTimeout(180);}
async function shot(id){await p.screenshot({path:`${out}/${id}.png`,scale:'css'});}
async function rect(sel){return p.locator(sel).first().evaluate(e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,inside:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:!!at&&e.contains(at),cover:at&&!e.contains(at)?at.id||at.className:null};});}
async function reachable(sel){const r=await rect(sel);assert(r.inside&&r.hit,`${sel} ${JSON.stringify(r)}`);return r;}
const wants=id=>!process.env.FOLLOWUP_ONLY||process.env.FOLLOWUP_ONLY.split(',').some(prefix=>id.startsWith(prefix));
async function check(id,fn){if(!wants(id))return;try{const evidence=await fn();results.push({id,passed:true,evidence});console.log('PASS',id);}catch(e){results.push({id,passed:false,error:e.stack});console.log('FAIL',id,e.message.slice(0,220));await shot(id+'-FAIL').catch(()=>{});}fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));}
try{
 const widths=probe?[1200,901]:[900,901,1024,1199,1200,1201,1399,1400];
 if(wants('E01'))for(const lang of probe?['en']:['ja','en','zh-CN'])for(const w of widths){await start(w,700,lang,probe?'no-preference':'reduce');
  for(const n of [8,70])await check(`E01-${w}-${lang}-${n}`,async()=>{
   await map(n);const selectors=['.japan-heading [data-map-heading-step="-1"]','.japan-heading [data-map-heading-step="1"]','[data-map-stable-step="-1"]','[data-map-stable-step="1"]'];
   const geometry=[];for(const sel of selectors)geometry.push(await reachable(sel));
   const heading=await rect('.japan-heading'),nav=await rect('#map-stable-navigation');
   const legends=await p.locator('.signal-encoding-legend-dock:visible,.gaia-food-legend:visible,.gaia-live-metric-legend:visible').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
   for(const r of legends)assert(r.top>=Math.max(heading.bottom,nav.bottom)-1,'legend below header/navigation');
   await shot(`E01-${w}-${lang}-${n}`);
   // Real clicks, including during rapid changes; never force through an overlay.
   let number=n;for(let i=0;i<selectors.length;i++){await p.locator(selectors[i]).click();number+=i%2?1:-1;await p.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n,number);}
   assert.equal(Number(await p.locator('#japan-mode-number').textContent()),n);return{geometry,heading,legends};
  });
 }
 if(wants('E02')||wants('E05'))for(const lang of probe?['ja']:['ja','en','zh-CN']){await start(1024,768,lang);await map(26);
  await check(`E02-${lang}`,async()=>{
   const points=[],manual=[];
   if(!await p.evaluate(()=>GaiaMapPlayback.getState().playing))await p.locator('#gaia-map-playback-toggle').click();
   await p.waitForFunction(()=>GaiaMapPlayback.getState().playing);
   for(let i=0;i<3;i++){const previous=await p.evaluate(()=>GaiaEstatExhibits.getState().selectedIndex);await p.waitForFunction(n=>GaiaEstatExhibits.getState().selectedIndex!==n,previous,{timeout:15000});assert.equal(await p.locator('.gaia-estat-prefecture-tooltip').isVisible(),false);assert(await p.locator('.gaia-estat-heat-legend').isVisible());points.push({state:await p.evaluate(()=>GaiaEstatExhibits.getState()),text:await p.locator('.gaia-estat-heat-legend').textContent()});}
   assert.equal(new Set(points.map(v=>v.state.selectedIndex)).size,3);
   await p.locator('#gaia-map-playback-toggle').click();await p.waitForFunction(()=>!GaiaEstatExhibits.getState().playbackEnabled);
   for(const n of [0,12,46]){const poi=p.locator('.gaia-estat-prefecture-region[data-estat-prefecture="'+String(n+1).padStart(2,'0')+'"]');await poi.focus();await poi.press('Enter');await p.waitForFunction(n=>GaiaEstatExhibits.getState().selectedIndex===n,n);assert.equal(await p.locator('.gaia-estat-prefecture-tooltip').isVisible(),false);assert(await p.locator('.gaia-estat-heat-legend').isVisible());manual.push(await p.evaluate(()=>GaiaEstatExhibits.getState()));}
   await p.waitForFunction(()=>document.querySelector('.gaia-estat-readout')?.dataset.estatValueCountState==='settled');
   await shot(`E02-${lang}`);return{points,manual};
  });
  await check(`E05-${lang}`,async()=>{await reachable('#map-responsive-sources-button');const fonts=await p.locator('.japan-credits a:visible').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)));assert(fonts.every(n=>n>=11));await p.locator('#map-responsive-sources-button').click();await p.locator('#map-responsive-sources').waitFor({state:'visible'});
   const links=p.locator('#map-responsive-sources a');assert.equal(await links.count(),5);for(let i=0;i<await links.count();i++){await links.nth(i).focus();await links.nth(i).press('Tab');await links.nth(i).click({trial:true});}
   await shot(`E05-${lang}`);await p.keyboard.press('Escape');assert.equal(await p.locator('#map-responsive-sources').isVisible(),false);assert.equal(await p.evaluate(()=>document.activeElement.id),'map-responsive-sources-button');return{fonts,count:await links.count()};
  });
 }
 if(wants('E03'))for(const lang of probe?['en']:['ja','en','zh-CN'])for(const w of probe?[320]:[320,375,390]){await start(w,568,lang);await map(26);
  await check(`E03-${w}-${lang}`,async()=>{await p.locator('[data-mobile-sheet="tools"]').click();await p.locator('.map-mobile-action-card').filter({hasText:/Statistical analysis|統計分析|统计分析/}).first().click();await p.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady);await p.waitForFunction(()=>!!document.querySelector('#gaia-statistics-canvas')?.dataset.axisYLines);await p.waitForTimeout(500);
   const heading=await rect('.gaia-statistics-header h2'),actions=await rect('.gaia-statistics-header-actions');assert(heading.bottom<=actions.y,'analysis heading and actions use separate rows');await reachable('#gaia-statistics-close');const labels=await p.locator('#gaia-statistics-canvas').evaluate(e=>{const s=e.getBoundingClientRect(),ctx=e.getContext('2d');return{lines:JSON.parse(e.dataset.axisYLines),widths:JSON.parse(e.dataset.axisYLines).map(t=>ctx.measureText(t).width),width:s.width,plotTop:Number(e.dataset.plotTop),plotBottom:Number(e.dataset.plotBottom)};});assert(labels.widths.every(n=>n<=labels.width-66));assert(labels.plotBottom-labels.plotTop>=120);await shot(`E03-${w}-${lang}`);
   await p.locator('[data-stat-view="records"]').click();assert.equal(await p.locator('[data-stat-view="records"]').getAttribute('aria-selected'),'true');await p.locator('[data-stat-view="chart"]').click();await p.setViewportSize({width:844,height:390});await p.waitForTimeout(700);assert(await p.locator('#gaia-statistics-canvas').evaluate(e=>{const ctx=e.getContext('2d');return JSON.parse(e.dataset.axisYLines).every(t=>ctx.measureText(t).width<=e.getBoundingClientRect().width-66)&&Number(e.dataset.plotBottom)-Number(e.dataset.plotTop)>=120;}),'rotated chart labels and plot fit');await reachable('#gaia-statistics-close');await p.locator('#gaia-statistics-close').click();return labels;
  });
 }
 if(wants('E04'))for(const [w,h]of probe?[[844,390]]:[[844,390],[1024,500],[320,568]]){await start(w,h,'en');await p.goto('http://127.0.0.1:4492/#story');await p.locator('#gaia-boot').waitFor({state:'hidden'});await p.waitForFunction(()=>!!globalThis.GaiaNovel);await p.evaluate(()=>GaiaNovel.open(null,{autoStartFresh:true}));await p.waitForFunction(()=>document.querySelector('#novel-text')?.dataset.revealState==='complete',null,{timeout:40000});
  await check(`E04-${w}`,async()=>{await p.locator('#novel-save-button').click();await p.locator('[data-slot-index="0"]').click();const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('gaiaSensewareNovel:manual-saves'))[0]);assert(saved.savedAt);await p.waitForTimeout(500);const list=await rect('#novel-save-slots'),card=await rect('[data-slot-index="0"]');assert(list.inside&&card.inside&&card.y>=list.y&&card.bottom<=list.bottom,'complete saved row visible');const header=await rect('[data-slot-index="0"] header'),title=await rect('[data-slot-index="0"] h3'),excerpt=await rect('[data-slot-index="0"] > p');assert(excerpt.bottom<=card.bottom,'excerpt stays in card');assert(title.bottom<=excerpt.y+1,'title and excerpt do not overlap');if(w<=600)assert(header.bottom<=title.y+1,'metadata and title do not overlap');for(const sel of ['[data-slot-index="0"] header','[data-slot-index="0"] h3','[data-slot-index="0"] footer']){const r=await rect(sel);assert(r.y>=list.y&&r.bottom<=list.bottom);}await reachable('#novel-save-close');await shot(`E04-${w}`);await p.locator('#novel-save-close').click();await p.reload();await p.locator('#gaia-boot').waitFor({state:'hidden'});await p.waitForFunction(()=>!!globalThis.GaiaNovel);await p.evaluate(()=>GaiaNovel.open(null,{autoStartFresh:true}));await p.waitForTimeout(1500);await p.locator('#novel-load-button').click();await p.locator('[data-slot-index="0"]').click();await p.locator('#novel-save-panel').waitFor({state:'hidden'});assert.equal(await p.evaluate(()=>GaiaNovel.getState().stepId),saved.progress.stepId);return{list,card,stepId:saved.progress.stepId};});
 }
 if(wants('E06'))for(const [w,h]of probe?[[320,568]]:[[320,568],[390,844],[844,390]]){await start(w,h,'en');await p.goto('http://127.0.0.1:4492/#sound');await p.locator('#gaia-boot').waitFor({state:'hidden'});
  await check(`E06-${w}`,async()=>{const tracks=[];for(const track of ['opening','snowfire','trueend']){await p.locator(`[data-sound-track="${track}"]`).click();await p.waitForFunction(t=>document.querySelector('#sound-layer').dataset.track===t,track);await p.waitForTimeout(600);const mini=await reachable('#sound-mini-play'),selected=await rect(`[data-sound-track="${track}"]`),bar=await rect('#sound-mini-player');assert(selected.inside&&selected.bottom<=bar.y,'selected track remains above the mini player');const before=await p.locator('#sound-mini-play').getAttribute('aria-pressed');await p.locator('#sound-mini-play').click();await p.waitForFunction(before=>document.querySelector('#sound-mini-play').getAttribute('aria-pressed')!==before,before);assert.equal(await p.locator('#sound-mini-play').getAttribute('aria-pressed'),await p.locator('#sound-play').getAttribute('aria-pressed'));tracks.push({track,mini,selected,bar});}await shot(`E06-${w}`);return{tracks};});
 }
}finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await b.close();}
if(results.some(r=>!r.passed)||errors.length)process.exitCode=1;
