import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import '../novel-story-data.js';
import '../true-end-data.js';

const before=process.argv.includes('--before');
const base=process.env.GAIA_BASE_URL||'http://127.0.0.1:4492';
const output=path.resolve(process.env.GAIA_OUTPUT_DIR||`artifacts/story-reading-breaks-2026-09-11/${before?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const beyond=GAIA_TRUE_END_STORY.scenes.flatMap(s=>s.steps);
const main=GAIA_NOVEL_STORY.scenes.flatMap(s=>s.steps);
const targetIds=new Set(['beyond_02_009','beyond_02_020','beyond_03_002','beyond_03_003','beyond_03_009','beyond_03_040','beyond_03_048','beyond_03_053','beyond_03_add_049']);
const report={status:'running',before,checks:[],errors:[],missing:[],hashes:{},environment:'Installed headless Chrome, actual local assets, production CSP on local navigation, external services blocked. Isolated saved final-scene fixture; native staff-roll entry and dialogue input. Mobile viewport/touch emulation, not a physical device.'};
for(const file of ['dialogue-typography.js','novel-mode.js','novel-mode.css','true-end-data.js','true-end-mode.js','true-end.css','gaia-mode-loader.js','index.html'])report.hashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
const readFrame=()=>{
  const root=document.querySelector('.true-end-shell'),node=document.querySelector('.true-end-message');
  const rows=[];
  const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const text=walker.currentNode;let offset=0;
    for(const glyph of Array.from(text.nodeValue||'')){
      const range=document.createRange();range.setStart(text,offset);offset+=glyph.length;range.setEnd(text,offset);
      const rect=range.getBoundingClientRect();
      let row=rows.find(r=>Math.abs(r.top-rect.top)<2);
      if(!row){row={top:rect.top,left:rect.left,right:rect.right,bottom:rect.bottom,text:''};rows.push(row);}
      row.text+=glyph;row.right=Math.max(row.right,rect.right);row.bottom=Math.max(row.bottom,rect.bottom);
    }
  }
  return {id:root.dataset.step,page:root.dataset.messagePage,text:node.textContent,aria:node.getAttribute('aria-label'),rows,box:node.getBoundingClientRect().toJSON(),clipX:node.scrollWidth-node.clientWidth,clipY:node.scrollHeight-node.clientHeight,bodyOverflow:document.documentElement.scrollWidth-innerWidth,next:document.querySelector('.true-end-next').getBoundingClientRect().toJSON()};
};
try{
  for(const width of (process.env.GAIA_WIDTHS|| (before?'1920,390':'1920,1440,390,320')).split(',').map(Number)){
    const height=width===320?568:width<900?844:width===1920?1080:900;
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<900,isMobile:width<900,reducedMotion:'reduce',acceptDownloads:true});
    await enforceBrowserSecurity(context,base);await context.route('https://**',r=>r.abort());
    await context.addInitScript(version=>{
      localStorage.setItem('gaia-senseware-bgm-muted','true');
      localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:true}));
      if(!localStorage.getItem('gaiaSensewareNovel:progress'))localStorage.setItem('gaiaSensewareNovel:progress',JSON.stringify({storyVersion:version,stepId:'esp32_pitch_016',reachedSceneIds:[],viewed:{},metCharacters:{mizuha:true,amane:true,sakuya:true},evesRoute:[],reflectionIds:[],readStepIds:[],clear:false,archivesUnlocked:false,audio:{muted:true,volume:0}}));
    },13);
    page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
    const activate=s=>width<900?page.locator(s).tap():page.locator(s).click();
    await page.goto(base+'/story',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.stepId==='esp32_pitch_016'&&document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
    await page.locator('#gaia-boot').waitFor({state:'hidden'});await page.evaluate(()=>document.fonts.ready);
    if(!before){
      const mainAudit=await page.evaluate(()=>GAIA_NOVEL_STORY.scenes.flatMap(s=>s.steps).filter(s=>['narration','dialogue'].includes(s.type)).map(s=>({id:s.id,...GaiaNovel.inspectDialoguePagination(s.text)})));
      for(const scan of mainAudit){
        assert.equal(scan.pages.map(p=>p.text).join(''),scan.source,scan.id+' source');
        for(const p of scan.pages){
          assert(p.fits&&p.lines<=p.maxLines&&p.horizontalOverflow<=1,`${width}/${scan.id} does not fit`);
          for(const row of p.tokenLines){
            assert(!/^[、。，．？！」』）】］〉》〕ぁぃぅぇぉっゃゅょァィゥェォッャュョー]/u.test(row.text.trim()),scan.id+' forbidden line start');
            assert(!/^(?:く|いる|いた)[。！」]*$/u.test(row.text.trim()),scan.id+' isolated verb ending');
          }
        }
      }
      const esp=mainAudit.find(s=>s.id==='esp32_pitch_016');
      if(width>=1440)assert(esp.pages.flatMap(p=>p.tokenLines).some(r=>r.text.includes('『身近な街角の1点を測る触角』')),'Short ESP32 quotation must fit on one line');
      report.checks.push({width,mainAudit});
      await activate('#novel-save-button');await activate('.novel-save-slot[data-slot-index="0"]');await activate('#novel-save-close');
    }
    const mainPages=[];
    while(await page.locator('#novel-layer').getAttribute('data-step-id')==='esp32_pitch_016'){
      await page.locator('#novel-continue.is-visible').waitFor();
      mainPages.push(await page.locator('#novel-text').getAttribute('aria-label'));
      await page.screenshot({path:path.join(output,`${width}-esp32-${mainPages.length}.png`)});
      await activate('#novel-dialogue');await page.waitForTimeout(120);
    }
    assert.equal(mainPages.join(''),main.find(s=>s.id==='esp32_pitch_016').text);
    report.checks.push({width,mainPages});
    if(!before){
      await activate('#novel-load-button');await activate('.novel-save-slot[data-slot-index="0"]');
      await page.waitForFunction(expected=>document.querySelector('#novel-layer')?.dataset.stepId==='esp32_pitch_016'&&document.querySelector('#novel-text')?.dataset.revealState==='complete'&&document.querySelector('#novel-text')?.getAttribute('aria-label')===expected,mainPages[0]);
      assert.equal(await page.locator('#novel-text').getAttribute('aria-label'),mainPages[0]);
      report.checks.push({width,nativeSaveLoad:true});
    }
    await page.evaluate(()=>{const s=GaiaNovel.getState();s.stepId='welcome_chat_095';s.clear=false;localStorage.setItem(GaiaNovel.storageKey,JSON.stringify(s));});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.novel-staff-roll[data-phase="complete"] .novel-staff-roll-finale button').waitFor();
    await activate('.novel-staff-roll-finale button');
    await page.waitForFunction(()=>document.querySelector('.true-end-shell')?.dataset.entryPhase==='ready');
    const played=[];
    for(const step of beyond){
      await page.waitForFunction(id=>document.querySelector('.true-end-shell')?.dataset.step===id&&!document.querySelector('.true-end-shell')?.classList.contains('is-revealing'),step.id);
      const frames=[];
      if(['beyond_03_053','beyond_03_add_049'].includes(step.id))assert.equal(await page.locator('.true-end-log-button').count(),0);
      do{
        const frame=await page.evaluate(readFrame);frames.push(frame);
        if(targetIds.has(step.id))await page.screenshot({path:path.join(output,`${width}-${step.id}-${frames.length}.png`)});
        if(!before){
          assert(frame.clipX<=1&&frame.clipY<=1,`${width}/${step.id}: clipped ${frame.clipX}/${frame.clipY}`);
          assert(frame.bodyOverflow<=1&&frame.box.left>=0&&frame.box.right<=width+1&&frame.box.bottom<=height+1,`${width}/${step.id}: outside viewport`);
          assert.equal(frame.text,frame.aria);
          for(const row of frame.rows){assert(!/^[、。，．？！」』）】］〉》〕ぁぃぅぇぉっゃゅょァィゥェォッャュョー]/u.test(row.text.trim()),`${width}/${step.id}: forbidden line start ${row.text}`);assert(!/[「『（【［〈《〔]$/u.test(row.text.trim()),`${width}/${step.id}: opening bracket at line end`);}
        }
        await activate('.true-end-dialogue');
        await page.waitForFunction(({id,marker})=>{const s=document.querySelector('.true-end-shell');return s?.classList.contains('is-finale')||s?.dataset.step!==id||s?.dataset.messagePage!==marker;},{id:step.id,marker:frame.page});
      }while(await page.locator('.true-end-shell').getAttribute('data-step')===step.id&&!await page.locator('.true-end-finale').isVisible());
      assert.equal(frames.map(f=>f.text).join(''),step.text,`${width}/${step.id}: source changed or lost`);
      if(!before&&targetIds.has(step.id))for(const frame of frames.slice(0,-1))assert(/[、。！？…][」』）]*\s*$/u.test(frame.text),`${width}/${step.id}: unnatural fixed page boundary`);
      if(step.id==='beyond_03_053')assert(frames.some(f=>f.text==='『次は、どこを測ってみようか？』'));
      if(step.id==='beyond_03_add_049')assert.equal(frames.at(-1).text,'放課後は、どこまでも終わらない。');
      played.push({id:step.id,frames});
      if(played.length%40===0)console.log(`${width}px ${played.length}/${beyond.length} messages`);
    }
    await page.locator('.true-end-finale').waitFor({state:'visible'});await page.screenshot({path:path.join(output,`${width}-finale.png`)});
    report.checks.push({width,played,finale:true});
    if(!before){
      assert.equal(await page.locator('.true-end-log-button').count(),0,'Finale must not contain LOG');
    }
    assert.deepEqual(await page.evaluate(()=>__securityViolations),[]);await context.close();console.log(`PASS ${width}px ${before?'reproduction':'reading boundaries and finale'}`);
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
