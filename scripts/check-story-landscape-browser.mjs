import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import '../novel-story-data.js';

const before=process.argv.includes('--before');
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7).split(',').map(Number);
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const sourceRoot=path.resolve(process.env.GAIA_SOURCE_ROOT||'.');
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/story-landscape-2026-09-11/${before?'reproduction':'final'}`);
assert(!fs.existsSync(path.join(output,'report.json')),'Preserve previous runs; choose a new output directory');
fs.mkdirSync(output,{recursive:true});
const report={status:'running',before,base,sourceRoot,checks:[],errors:[],missing:[],hashes:{},environment:'Installed Chrome, real served CSS/PNG/data, production CSP on localhost and unmodified HTTPS headers. Viewport/touch emulation, not physical devices. Isolated preceding-step saves, then native dialogue, SAVE/LOAD, AUTO and LOG/export controls. Rotation uses real viewport resizing. All-script layout measurement is separate from native traversal.'};
for(const file of ['novel-mode.css','novel-mode.js','dialogue-typography.js','gaia-mode-loader.js','index.html'])report.hashes[file]=createHash('sha256').update(fs.readFileSync(path.join(sourceRoot,file))).digest('hex');
const scenarios=(before?[[844,390],[568,320]]:[[844,390],[568,320],[667,375],[932,430],[1024,520],[1440,480]]).filter(([width])=>!only||only.includes(width));
assert(scenarios.length>0);
const storySteps=GAIA_NOVEL_STORY.scenes.flatMap(s=>s.steps);
const sourceFor=id=>storySteps.find(s=>s.id===id).text;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;

// Conservative hair/face bounds from the unchanged full-resolution PNGs.
// These include the complete head, not merely a transparent element box.
const headBounds={sora:{x:305,y:10,width:365,height:310},minamo:{x:290,y:64,width:350,height:276}};
const scan=()=>page.evaluate(async bounds=>{
  const rect=n=>n.getBoundingClientRect().toJSON();
  const layer=document.querySelector('#novel-layer'),dialogue=document.querySelector('#novel-dialogue'),text=document.querySelector('#novel-text');
  const cast=document.querySelector('#novel-cast'),speaker=cast.dataset.speaker;
  const d=rect(dialogue),t=rect(text),indicator=rect(document.querySelector('#novel-continue'));
  const result={step:layer.dataset.stepId,page:Number(text.dataset.pageIndex),pageCount:Number(text.dataset.pageCount),text:text.getAttribute('aria-label'),font:parseFloat(getComputedStyle(text).fontSize),dialogue:d,textBox:t,indicator,glassTop:d.top+parseFloat(getComputedStyle(dialogue,'::after').top),heading:rect(document.querySelector('#novel-source-label')),overflow:document.documentElement.scrollWidth-innerWidth,clipX:text.scrollWidth-text.clientWidth,clipY:text.scrollHeight-text.clientHeight,lines:Number(text.dataset.measuredLineCount),maxLines:Number(text.dataset.maxLineCount)};
  result.buttons=[...document.querySelectorAll('.novel-topbar nav > button:not(#novel-close-button):not(#novel-home-button):not(#novel-restart-button)')].filter(n=>!n.hidden&&getComputedStyle(n).display!=='none').map(n=>{const r=rect(n);return{id:n.id,rect:r,hit:n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
  if(bounds[speaker]&&getComputedStyle(cast).opacity!=='0'){
    const figure=document.querySelector('#novel-character-'+speaker),portrait=figure.querySelector('.novel-character-portrait'),c=getComputedStyle(portrait),p=rect(portrait);
    const url=/url\(["']?([^"')]+)/u.exec(c.backgroundImage)?.[1];
    const image=new Image();image.src=url;await image.decode();
    const h=Number(/auto\s+([\d.]+)px/u.exec(c.backgroundSize)?.[1]);assertFinite(h);
    const scale=h/image.naturalHeight,w=image.naturalWidth*scale,b=bounds[speaker];
    const imageTop=p.top+parseFloat(c.backgroundPosition.split(/\s+/).at(-1));
    const left=p.left+(p.width-w)/2+b.x*scale,top=imageTop+b.y*scale;
    result.head={speaker,url,left,top,right:left+b.width*scale,bottom:top+b.height*scale,width:b.width*scale,height:b.height*scale,figure:rect(figure),opacity:Number(getComputedStyle(figure).opacity)};
    result.clearance=result.glassTop-result.head.bottom;
  }
  function assertFinite(n){if(!Number.isFinite(n))throw Error('Expected an explicit served portrait background height');}
  return result;
},headBounds);

function checkGeometry(s,width,height,{head=true}={}){
  assert(s.font>=16,'Do not solve clipping by making the text unreadable');
  assert(s.overflow<=1&&s.clipX<=1&&s.clipY<=1,JSON.stringify(s));
  assert(s.textBox.bottom<=s.dialogue.bottom+1&&s.lines<=s.maxLines,'Text fits the actual message capacity');
  assert(Math.max(s.indicator.top-s.textBox.bottom,s.indicator.left-s.textBox.right)>=11,'Keep the next marker clear of text');
  for(const b of s.buttons){assert(b.rect.width>=43.9&&b.rect.height>=43.9&&b.hit,b.id+' has a usable hit target');assert(b.rect.left>=0&&b.rect.right<=width+1&&b.rect.bottom<=height+1,b.id+' stays in the viewport');assert(b.rect.top>=s.dialogue.bottom+1,b.id+' stays below the message');}
  assert.equal(s.buttons.length,7,'Preserve all seven progression controls');
  if(head){
    assert(s.head?.opacity>=.99,'The active portrait remains visible');
    assert(s.head.height>=60&&s.head.left>=0&&s.head.right<=width,'The painted head remains large enough and inside the viewport');
    assert(s.head.top>=s.head.figure.top-1&&s.head.bottom<=s.head.figure.bottom+1,'Do not crop away the head');
    assert(s.clearance>=4,`Head/glass clearance ${s.clearance}px`);
    assert(s.heading.bottom<=s.head.top+1,'The centered clock must not cover the head');
  }
}

try {
  for(const [width,height] of scenarios){
    const touch=width<1200,reduced=before||width!==844;
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:reduced?'reduce':'no-preference'});
    await enforceBrowserSecurity(context,base);
    await context.route('https://**',r=>new URL(r.request().url()).origin===new URL(base).origin?r.fallback():r.abort());
    await context.addInitScript(({version,reduced})=>{
      localStorage.setItem('gaia-senseware-bgm-muted','true');
      localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:reduced}));
      if(!localStorage.getItem('gaiaSensewareNovel:progress'))localStorage.setItem('gaiaSensewareNovel:progress',JSON.stringify({storyVersion:version,stepId:'festival_concept_new_025',reachedSceneIds:[],viewed:{},metCharacters:{amane:true,mizuha:true,sakuya:true},evesRoute:[],reflectionIds:[],readStepIds:[],clear:false,archivesUnlocked:false,audio:{muted:true,volume:0}}));
    },{version:GAIA_NOVEL_STORY.storyVersion,reduced});
    page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
    const activate=s=>touch?page.locator(s).tap():page.locator(s).click();
    const ready=async id=>{await page.waitForFunction(id=>{const n=document.querySelector('#novel-layer');return n?.dataset.stepId===id&&n.dataset.runtimeReveal==='revealed'&&n.dataset.entryTransition==='visible'&&n.getAttribute('aria-busy')!=='true'&&document.querySelector('#novel-text')?.dataset.revealState==='complete';},id);await page.locator('#gaia-boot').waitFor({state:'hidden'});};
    const reach=async id=>{for(let n=0;n<24&&await page.locator('#novel-layer').getAttribute('data-step-id')!==id;n++){await activate('#novel-dialogue');await page.waitForTimeout(110);}await ready(id);await page.waitForTimeout(550);};
    const seed=async id=>{await page.evaluate(id=>{const s=GaiaNovel.getState();s.stepId=id;s.clear=false;localStorage.setItem(GaiaNovel.storageKey,JSON.stringify(s));},id);await page.reload({waitUntil:'domcontentloaded'});await ready(id);};
    await page.goto(base+'/story',{waitUntil:'domcontentloaded'});await ready('festival_concept_new_025');
    await reach('festival_concept_057');
    const amane=await scan();await page.screenshot({path:path.join(output,`${width}-amane.png`)});
    if(!before){checkGeometry(amane,width,height);await activate('#novel-save-button');await activate('.novel-save-slot[data-slot-index="0"]');await activate('#novel-save-close');}
    await reach('festival_concept_058');
    const mizuha=await scan();await page.screenshot({path:path.join(output,`${width}-mizuha.png`)});
    if(before){assert(amane.clearance<0&&mizuha.clearance<0,'Reproduce both characters underneath the dialogue glass');report.checks.push({width,height,reproduced:true,amane,mizuha});}
    else {
      checkGeometry(mizuha,width,height);report.checks.push({width,height,kind:'painted-heads-and-controls',amane,mizuha});
      await activate('#novel-load-button');await activate('.novel-save-slot[data-slot-index="0"]');await ready('festival_concept_057');await page.waitForTimeout(550);
      assert.equal((await scan()).text,amane.text);checkGeometry(await scan(),width,height);
      report.checks.push({width,height,kind:'native-save-load',restoredStep:'festival_concept_057'});
      await seed('festival_concept_new_031');
      const candidates=storySteps.filter(s=>['dialogue','narration'].includes(s.type));
      const auditSource=width===568?candidates:[...candidates].sort((a,b)=>b.text.length-a.text.length).slice(0,12);
      const audit=await page.evaluate(rows=>rows.map(s=>({id:s.id,...GaiaNovel.inspectDialoguePagination(s.text)})),auditSource.map(s=>({id:s.id,text:s.text})));
      for(const row of audit){assert.equal(row.pages.map(p=>p.text).join(''),row.source,row.id+' source preserved');for(const p of row.pages)assert(p.fits&&p.lines<=p.maxLines&&p.horizontalOverflow<=1,row.id+' complete text fits');}
      report.checks.push({width,height,kind:'measured-pagination',steps:audit.length,pages:audit.reduce((n,r)=>n+r.pages.length,0)});
      const longSource=sourceFor('festival_concept_new_031'),pages=[];
      while(await page.locator('#novel-layer').getAttribute('data-step-id')==='festival_concept_new_031'){
        await ready('festival_concept_new_031');const s=await scan();checkGeometry(s,width,height,{head:false});pages.push(s.text);
        if(pages.length===2)await page.screenshot({path:path.join(output,`${width}-long-page-2.png`)});
        assert(pages.length<20);await activate('#novel-dialogue');await page.waitForTimeout(150);
      }
      assert.equal(pages.join(''),longSource);assert(pages.length>=2);
      report.checks.push({width,height,kind:'native-full-text',pages});
      if(width===844||width===568){
        await seed('festival_concept_new_031');await activate('#novel-dialogue');await ready('festival_concept_new_031');
        const second=await scan();assert.equal(second.page,2);const anchor=longSource.indexOf(second.text);assert(anchor>0);
        await page.setViewportSize({width:390,height:844});await page.waitForTimeout(450);
        const portrait=await scan(),portraitStart=longSource.indexOf(portrait.text);assert.equal(portrait.step,second.step);assert(portraitStart<=anchor&&portraitStart+portrait.text.length>anchor);
        await page.setViewportSize({width,height});await page.waitForTimeout(450);
        const restored=await scan(),restoredStart=longSource.indexOf(restored.text);assert.equal(restored.step,second.step);assert(restoredStart<=portraitStart&&restoredStart+restored.text.length>portraitStart);checkGeometry(restored,width,height,{head:false});
        await activate('#novel-auto-button');await page.waitForFunction(({id,page})=>document.querySelector('#novel-layer')?.dataset.stepId!==id||Number(document.querySelector('#novel-text')?.dataset.pageIndex)!==page,{id:restored.step,page:restored.page},{timeout:8000});await activate('#novel-auto-button');
        report.checks.push({width,height,kind:'rotation-and-auto',second,portrait,restored});
        await activate('#novel-log-button');await activate('#novel-log-view-script');const download=page.waitForEvent('download');await activate('#novel-log-script-export');const file=path.join(output,`${width}-script.md`);await(await download).saveAs(file);assert(fs.readFileSync(file,'utf8').includes(longSource));await activate('#novel-log-close');
        report.checks.push({width,height,kind:'native-script-export',file});
      }
    }
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await context.close();console.log('PASS '+width+'x'+height+(before?' reproduction':' landscape layout/lifecycle'));
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
