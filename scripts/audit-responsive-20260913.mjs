import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out=process.env.AUDIT_OUTPUT||'artifacts/responsive-audit-20260913/final';fs.mkdirSync(out,{recursive:true});
const profiles=[['small-phone',320,568,true],['phone',375,667,true],['modern-phone',390,844,true],['large-phone',430,932,true],['phone-landscape',844,390,true],['tablet',768,1024,true],['tablet-large',820,1180,true],['tablet-landscape',1024,768,true],['laptop-small',1280,800,false],['laptop',1366,768,false],['desktop',1920,1080,false],['desktop-large',2560,1440,false],['boundary900',900,700,true],['boundary901',901,700,true],['phone-en',390,844,true,'en'],['laptop-en',1366,768,false,'en']];
profiles.push(['phone-zh',390,844,true,'zh-CN'],['laptop-zh',1366,768,false,'zh-CN']);
const selected=process.env.AUDIT_PROFILES?profiles.filter(p=>process.env.AUDIT_PROFILES.split(',').includes(p[0])):profiles;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
async function run(profile){
 const [id,width,height,touch,lang='ja']=profile;const report={id,width,height,touch,lang,states:[],actions:[],errors:[]};
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,reducedMotion:'reduce'});await context.route('https://**',r=>r.abort());
 await context.addInitScript(lang=>{if(location.protocol!=='http:')return;localStorage.setItem('gaia:language:v1',lang);localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:true}));},lang);
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 const save=async(name,root='body')=>{
  await page.waitForTimeout(350);
  const state=await page.evaluate(root=>{
   const scope=document.querySelector(root)||document.body;
   const visible=e=>e.checkVisibility({visibilityProperty:true,opacityProperty:true})&&!e.closest('[hidden],[inert],[aria-hidden="true"]');
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const controls=[...scope.querySelectorAll('button,a[href],input,select,summary,[role="tab"]')].filter(visible).map(e=>{
    const r=rect(e),x=r.x+r.w/2,y=r.y+r.h/2;const at=document.elementFromPoint(x,y);
    return {tag:e.tagName,id:e.id,cls:e.className,text:(e.getAttribute('aria-label')||e.textContent||e.getAttribute('title')||'').trim().replace(/\s+/g,' ').slice(0,90),...r,disabled:e.disabled||false,hit:!!at&&(e.contains(at)||at===e),cover:at&&!e.contains(at)?(at.id||String(at.className)).slice(0,120):null,clipped:r.x<-.5||r.right>innerWidth+.5||r.y<-.5||r.bottom>innerHeight+.5,small:r.w<32||r.h<32};
   }).filter(e=>e.w>0&&e.h>0);
   const panels=[...scope.querySelectorAll('.japan-heading,[class*="legend"],#map-stable-navigation,[class$="readout"],.map-command-dock,#novel-dialogue,#novel-location')].filter(visible).map(e=>({id:e.id,cls:e.className,...rect(e)})).filter(e=>e.w>0&&e.h>0);
   return {overflow:document.documentElement.scrollWidth-innerWidth,controls,panels};
  },root);
  const file=id+'-'+name+'.png';await page.screenshot({path:out+'/'+file});report.states.push({name,file,...state});
 };
 const action=async(name,fn)=>{try{await fn();report.actions.push({name,passed:true});}catch(e){report.actions.push({name,passed:false,error:e.message.slice(0,1000)});await save('failure-'+name.replace(/[^a-z0-9-]/g,'')).catch(()=>{});}};
 try{
  await page.goto('http://127.0.0.1:4492/');await page.locator('#gaia-opening-sound-modal').waitFor({state:'visible'});await save('sound-settings','#gaia-opening-sound-modal');
  await action('sound-off',()=>page.locator('#gaia-opening-sound-off').click());
  await page.evaluate(()=>sessionStorage.setItem('gaia:title-return-resume','1'));await page.reload();await page.locator('#gaia-opening-route-other').waitFor({state:'visible'});await save('title','#gaia-opening');
  await action('title-other',()=>page.locator('#gaia-opening-route-other').click());await page.locator('[data-intro-guide=character]').waitFor({state:'visible'});await page.evaluate(()=>GaiaIntroEntryGuide?.close?.({restoreFocus:false}));await save('intro');
  await page.goto('http://127.0.0.1:4492/#world-15');await page.waitForFunction(()=>globalThis.GaiaMapPlayback?.getState().ready,null,{timeout:30000});
  for(const n of [15,8,26,40,70]){
   await page.evaluate(n=>location.hash='#world-'+n,n);await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n&&GaiaMapPlayback.getState().ready&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n,{timeout:25000});await save('map'+n,'#japan-layer');
  }
  await action('next',async()=>{await page.locator('[data-map-stable-step="1"]').click();await page.waitForFunction(()=>Number(document.querySelector('#japan-mode-number').textContent)===71);});
  await action('previous',async()=>{await page.locator('[data-map-stable-step="-1"]').click();await page.waitForFunction(()=>Number(document.querySelector('#japan-mode-number').textContent)===70);});
  await action('menu',async()=>{
   await page.locator('[data-map-menu-toggle]').click();const picker=page.locator(width>900?'#map-dock-bank-popover':'#map-mobile-sheet');await picker.waitFor({state:'visible'});await page.waitForTimeout(200);await save('menu-world');
   await picker.locator('[role="tab"][data-map-scope="japan"]').click();await save('menu-japan');
   const tile=width>900?picker.locator('.map-mode-button').filter({hasText:/^26$/}):picker.locator('[data-mobile-exhibit="26"]');await tile.click();await picker.waitFor({state:'hidden'});
  });
  await action('analysis',async()=>{
   await page.evaluate(()=>location.hash='#world-26');await page.waitForFunction(()=>GaiaMapPlayback.getState().ready&&Number(document.querySelector('#japan-mode-number').textContent)===26);
   if(width<=900){await page.locator('[data-mobile-sheet="tools"]').click();await page.locator('#map-mobile-sheet .map-mobile-action-card').filter({hasText:lang==='en'?'Statistical analysis':lang==='zh-CN'?'统计分析':'統計分析'}).first().click();}else await page.locator('[data-estat-analysis]').click();
   await page.waitForFunction(()=>globalThis.GaiaStatisticsLab?.getState().analysisReady,null,{timeout:20000});await save('analysis');await page.locator('[data-stat-view="records"]').click();await save('analysis-records');
  });
  await action('analysis-close',async()=>{const close=page.locator('#gaia-statistics-close');if(await close.isVisible())await close.click();});
  for(const mode of ['character','sound']){
   await page.goto('about:blank');
   await page.goto('http://127.0.0.1:4492/#'+mode);await page.locator(mode==='character'?'#character-book-layer':'#sound-layer').waitFor({state:'visible'});await page.waitForTimeout(900);await save(mode);
   await action(mode+'-select',async()=>{if(mode==='character')await page.locator('[data-character-select="sakuya"]').click();else {const buttons=page.locator('#sound-layer button');const last=buttons.last();await last.click();}await save(mode+'-selected');});
  }
  await page.goto('about:blank');await page.goto('http://127.0.0.1:4492/#story');await page.waitForFunction(()=>!!globalThis.GaiaNovel);await page.evaluate(()=>GaiaNovel.open(null,{autoStartFresh:true}));await page.waitForFunction(()=>document.querySelector('#novel-text')?.dataset.revealState==='complete',null,{timeout:25000});await save('story');
  await action('story-save-dialog',async()=>{await page.locator('#novel-save-button').click();await save('story-save');});
  await page.goto('http://127.0.0.1:4492/concept/');await page.waitForFunction(()=>document.body.dataset.enhanced==='true');await save('concept');await page.locator('.learning-courses > li').nth(2).scrollIntoViewIfNeeded();await save('concept-courses');
  await page.goto('http://127.0.0.1:4528/sensors/#map');await page.waitForFunction(()=>document.documentElement.dataset.sensorView==='map');await page.waitForTimeout(800);await page.evaluate(()=>globalThis.GaiaModeEntryGuide?.close?.('sensor',{restoreFocus:false}));await save('sensor');
 }catch(e){report.failure=e.stack;await save('failure').catch(()=>{});}
 finally{fs.writeFileSync(out+'/'+id+'.json',JSON.stringify(report,null,2));await context.close();console.log('DONE',id,report.states.length,report.actions.filter(a=>!a.passed).map(a=>a.name),report.failure?.slice(0,100)||'');}
}
try{for(let i=0;i<selected.length;i+=2)await Promise.all(selected.slice(i,i+2).map(run));}finally{await browser.close();}
