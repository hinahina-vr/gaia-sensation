// 再評価用: 通常演出・境界幅・実操作前の可視性を、既存の修正後検証とは分けて記録する。
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const out='artifacts/responsive-reevaluation-20260913';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const cases=[], failures=[];
const manifest={created:new Date().toISOString(),base:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),files:{}};
for(const f of ['index.html','gaia-mode-loader.js','responsive-audit-fixes.css','map-responsive-layout.js','map-mobile-shell.js','character-mode.js','statistics-lab.js','gaia-i18n.js','src/exploration/index.js','src/exploration/map-playback.js'])manifest.files[f]=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
fs.writeFileSync(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
async function session(w,h,lang='ja',mobile=false){
 const c=await browser.newContext({viewport:{width:w,height:h},hasTouch:mobile||w<=1024,isMobile:mobile,deviceScaleFactor:mobile?3:1,reducedMotion:'no-preference'});
 await c.route('https://**',r=>r.abort());
 await c.addInitScript(lang=>{if(location.protocol==='http:')localStorage.setItem('gaia:language:v1',lang);},lang);
 const p=await c.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>failures.push({w,h,lang,error:e.message}));return {c,p};
}
async function settledMap(p,n){await p.goto('http://127.0.0.1:4492/#world-'+n);await p.waitForFunction(n=>globalThis.GaiaMapPlayback?.getState().ready&&Number(document.querySelector('#japan-mode-number')?.textContent)===n&&!document.querySelector('#japan-layer').classList.contains('is-map-title-transitioning'),n,{timeout:30000});await p.locator('#gaia-boot').waitFor({state:'hidden'});await p.waitForTimeout(500);}
async function capture(p,id,meta={}){
 const data=await p.evaluate(()=>{
  const shown=e=>e.checkVisibility({visibilityProperty:true,opacityProperty:true})&&!e.closest('[hidden],[inert],[aria-hidden="true"]');
  const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
  const controls=[...document.querySelectorAll('button,a[href],input,summary,select')].filter(shown).map(e=>{
   const r=box(e), x=r.x+r.w/2,y=r.y+r.h/2,hit=document.elementFromPoint(x,y);
   const scrollParents=[];for(let a=e.parentElement;a;a=a.parentElement){const s=getComputedStyle(a);if(/auto|scroll/.test(s.overflowY)&&a.scrollHeight>a.clientHeight+2)scrollParents.push(a.id||a.className);}
   return {id:e.id,tag:e.tagName,cls:e.className,text:(e.getAttribute('aria-label')||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,100),...r,disabled:e.disabled||e.getAttribute('aria-disabled')==='true',hit:!!hit&&e.contains(hit),cover:hit&&!e.contains(hit)?hit.id||hit.className:null,inside:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,scrollParents};
  }).filter(r=>r.w&&r.h);
  const selectors=['.japan-heading','#map-stable-navigation','#map-responsive-data','.japan-credits','.signal-encoding-legend-dock','.gaia-live-metric-legend','.gaia-estat-heat-legend','.gaia-estat-prefecture-tooltip','.gaia-food-readout','.map-command-dock','.gaia-estat-readout','#gaia-statistics-visual','.character-book-hero-copy','.character-book-hero-detail','.character-book-hero-figure','.sound-player','#novel-dialogue'];
  const panels=selectors.flatMap(s=>[...document.querySelectorAll(s)].filter(shown).map(e=>({selector:s,...box(e),text:e.textContent.trim().replace(/\s+/g,' ').slice(0,200)})));
  return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,visualWidth:visualViewport.width,visualHeight:visualViewport.height},overflow:document.documentElement.scrollWidth-innerWidth,focus:document.activeElement?.id||document.activeElement?.className,controls,panels};
 });
 await p.screenshot({path:`${out}/${id}.png`,scale:'css'});cases.push({id,...meta,...data});fs.writeFileSync(`${out}/survey.json`,JSON.stringify({cases,failures},null,2));console.log('SHOT',id);
}
try{
 const profiles=[['small',320,568,'ja'],['phone',375,667,'ja'],['mobile-en',390,844,'en',true],['mobile-zh',390,844,'zh-CN',true],['landscape',844,390,'en',true],['tablet',768,1024,'ja'],['b900',900,700,'en'],['b901',901,700,'en'],['tablet-wide',1024,768,'ja'],['b1199',1199,700,'en'],['b1200',1200,700,'en'],['laptop',1366,768,'en'],['b1399',1399,768,'en'],['b1400',1400,768,'en'],['desktop',1920,1080,'ja'],['wide',2560,1440,'zh-CN']];
 for(const [id,w,h,lang,mobile=false]of profiles){
  const {c,p}=await session(w,h,lang,mobile);
  try{for(const n of (['small','mobile-en','landscape','tablet-wide','laptop','b1200'].includes(id)?[40,70,26,8]:[70])){await settledMap(p,n);await capture(p,`${id}-map${n}`,{kind:'map',n,lang,mobile});}}catch(e){failures.push({id,error:e.message});console.log('ERROR',id,e.message.slice(0,180));}finally{await c.close();}
 }
 for(const [id,w,h,lang,mobile]of [['small',320,568,'ja',false],['mobile-en',390,844,'en',true],['landscape',844,390,'en',true],['tablet',1024,768,'zh-CN',false],['desktop',1920,1080,'ja',false]]){
  for(const mode of ['character','sound']){
   const {c,p}=await session(w,h,lang,mobile);
   try{
    await p.goto('http://127.0.0.1:4492/#'+mode);await p.locator('#gaia-boot').waitFor({state:'hidden'});await p.waitForTimeout(1600);await capture(p,`${id}-${mode}-initial`,{kind:mode,lang,mobile});
    if(mode==='character'){
     await p.locator('[data-character-select="sakuya"]').click();await p.waitForTimeout(700);await p.locator('#character-book-profile').scrollIntoViewIfNeeded();await capture(p,`${id}-character-profile`,{kind:mode,lang,mobile});
     await p.locator('.character-book-hero-quote').scrollIntoViewIfNeeded();await capture(p,`${id}-character-quote`,{kind:mode,lang,mobile});
    }else{
     await p.locator('[data-sound-track="trueend"]').click();await p.waitForTimeout(1800);await capture(p,`${id}-sound-track12`,{kind:mode,lang,mobile,trackTitle:await p.locator('#sound-track-title').textContent()});
     await p.locator('#sound-play').click();await p.waitForTimeout(700);await capture(p,`${id}-sound-play`,{kind:mode,lang,mobile,pressed:await p.locator('#sound-play').getAttribute('aria-pressed')});
    }
   }catch(e){failures.push({id,mode,error:e.message});console.log('ERROR',id,mode,e.message.slice(0,200));}finally{await c.close();}
  }
 }
}finally{fs.writeFileSync(`${out}/survey.json`,JSON.stringify({cases,failures},null,2));await browser.close();}
