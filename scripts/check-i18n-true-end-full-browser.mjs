import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/i18n/true-end-full';fs.mkdirSync(out,{recursive:true});
const report={status:'running',scope:'Real local Chrome; native scene-jump entry and dialogue clicks; reduced motion. Not natural audio/timing or production.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const width of [1440,390])for(const language of ['en','zh-CN']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390,reducedMotion:'reduce'});
  await context.route('https://**',r=>r.abort());
  await context.addInitScript(lang=>{
   localStorage.setItem('gaia:language:v1',lang);
   localStorage.setItem('gaia-senseware-bgm-volume','0');
   localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:true}));
  },language);
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:4492/#story');
  await page.waitForFunction(()=>!!window.GaiaNovel);
  await page.evaluate(()=>GaiaNovel.open(null,{autoStartFresh:true}));
  await page.waitForFunction(()=>document.querySelector('#novel-text')?.dataset.revealState==='complete',{},{timeout:30000});
  await page.locator('#novel-jump-button').click();
  await page.locator('[data-scene-id="ending"].novel-jump-item').click();
  await page.locator('#novel-layer.is-staff-roll').waitFor({timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
  if(await page.locator('.novel-staff-roll').getAttribute('data-phase')!=='complete')await page.locator('.novel-staff-roll-data-skip').click();
  await page.waitForFunction(()=>document.querySelector('.novel-staff-roll')?.dataset.phase==='complete');
  await page.locator('.novel-staff-roll-finale button').click();
  await page.locator('.true-end-shell').waitFor({timeout:30000});
  const sources=await page.evaluate(()=>GAIA_TRUE_END_STORY.scenes.flatMap(s=>s.steps).map(s=>({id:s.id,text:GaiaI18n.t(s.text||'')})));
  const pages=new Map();let count=0,lastScene='';
  while(count++<1500){
   await page.waitForFunction(()=>{
    const s=document.querySelector('.true-end-shell');
    const finale=s?.querySelector('.true-end-finale');
    return finale&&!finale.hidden&&!finale.inert||
      s?.dataset.sectionTransitionPhase==='idle'&&s.dataset.messagePage&&!s.classList.contains('is-revealing');
   },{},{timeout:30000});
   const current=await page.evaluate(()=>{
    const s=document.querySelector('.true-end-shell'),m=s.querySelector('.true-end-message'),d=s.querySelector('.true-end-dialogue');
    const finale=s.querySelector('.true-end-finale');
    const style=getComputedStyle(m);
    return {finale:finale&&!finale.hidden&&!finale.inert,step:s.dataset.step,scene:s.dataset.scene,page:s.dataset.messagePage,text:m.textContent,
     fits:m.scrollWidth<=m.clientWidth+1&&m.scrollHeight<=Math.min(parseFloat(style.maxHeight),d.clientHeight-parseFloat(style.top)-24)+1};
   });
   if(current.finale)break;
   assert(current.fits,JSON.stringify({width,language,current}));
   const [number,total]=current.page.split('/').map(Number);
   if(!pages.has(current.step))pages.set(current.step,[]);
   const seen=pages.get(current.step);
   assert.equal(number,seen.length+1,'Repeated or skipped page: '+JSON.stringify(current));
   seen.push(current.text);
   if(number===total)assert.equal(seen.join(''),sources.find(s=>s.id===current.step)?.text,'Missing/reordered text at '+current.step);
   if(lastScene!==current.scene){lastScene=current.scene;await page.screenshot({path:out+'/'+width+'-'+language+'-'+lastScene+'.png'});}
   if(pages.size===3&&number===1){
    await page.evaluate(lang=>GaiaI18n.set(lang==='en'?'zh-CN':'en'),language);
    await page.waitForFunction(step=>document.querySelector('.true-end-shell')?.dataset.step===step&&
     !document.querySelector('.true-end-shell')?.classList.contains('is-revealing'),current.step);
    assert(await page.locator('.true-end-message').textContent());
    await page.evaluate(lang=>GaiaI18n.set(lang),language);
    await page.waitForTimeout(180);
    assert.equal(await page.locator('.true-end-message').textContent(),current.text);
   }
   await page.locator('.true-end-dialogue').click();
   await page.waitForFunction(previous=>{
    const s=document.querySelector('.true-end-shell');
    const finale=s?.querySelector('.true-end-finale');
    return finale&&!finale.hidden&&!finale.inert||s?.dataset.step!==previous.step||s?.dataset.messagePage!==previous.page;
   },current,{timeout:30000});
  }
  assert.equal(pages.size,sources.length,'Every ending paragraph must be rendered');
  assert(count<1500,'Run did not finish');
  await page.screenshot({path:out+'/'+width+'-'+language+'-finale.png'});
  report.checks.push({width,language,paragraphs:pages.size,pages:[...pages.values()].reduce((n,p)=>n+p.length,0)});
  console.log(JSON.stringify(report.checks.at(-1)));await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
