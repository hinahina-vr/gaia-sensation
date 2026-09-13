import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/i18n/ending-music';fs.mkdirSync(out,{recursive:true});
const report={status:'running',scope:'Real local Chrome, desktop/touch emulation. Isolated test save starts at credits; reduced-motion manual credits and native scene skips. No production or full natural-timing run.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
const noJapanese=(text,label)=>assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text),label+': '+text);
try {
 for(const width of [1440,390])for(const language of ['en','zh-CN']) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390});
  await context.route('https://**',r=>r.abort());
  await context.addInitScript(lang=>{localStorage.setItem('gaia:language:v1',lang);localStorage.setItem('gaia-senseware-bgm-volume','0');sessionStorage.setItem('gaia:title-return-resume','1');},language);
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:4492/#sound');
  await page.locator('#sound-layer.is-open').waitFor({timeout:30000});
  const music=[];
  const buttons=page.locator('[data-sound-track]');
  for(let i=0;i<await buttons.count();i++){
   await buttons.nth(i).click();
   await page.waitForTimeout(150);
   const content=await page.locator('#sound-mode-description').textContent();
   noJapanese(content,'Music description');assert(content.trim());
   noJapanese(await page.locator('#sound-track-title').textContent(),'Music title');
   music.push(content);
  }
  await page.screenshot({path:`${out}/${width}-${language}-music.png`});
  await page.goto('http://127.0.0.1:4492/');
  await page.evaluate(()=>GaiaModeLoader.load('story'));
  await page.waitForFunction(()=>!!window.GaiaNovel);
  await page.evaluate(()=>{
   const progress={storyVersion:GAIA_NOVEL_STORY.storyVersion,stepId:'welcome_chat_095',reachedSceneIds:['welcome_chat'],viewed:{},metCharacters:{mizuha:true,amane:true,sakuya:true},evesRoute:[],observationOrder:'LOCAL_FIRST',editorialChoice:null,reflectionIds:[],resultTone:null,demoInterest:'太古の海',audio:{muted:true,volume:0},readStepIds:[],clear:false,archivesUnlocked:false,sessionId:'i18n-ending'};
   localStorage.setItem('gaiaSensewareNovel:progress',JSON.stringify(progress));
   localStorage.setItem('gaiaSensewareNovel:manual-saves',JSON.stringify([{progress,savedAt:Date.now(),meta:{title:'QA',excerpt:progress.stepId}}]));
   localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:true}));
  });
  await page.goto('http://127.0.0.1:4492/story');
  await page.locator('#novel-layer.is-staff-roll').waitFor({timeout:60000});
  await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
  await page.waitForTimeout(300);
  const roles=await page.locator('.novel-staff-roll-credit-role').allTextContents();
  const names=await page.locator('.novel-staff-roll-credit-name').allTextContents();
  noJapanese(roles.join(' '),'Credit roles');noJapanese(names.join(' '),'Credit names');
  assert.equal(roles[0],language==='en'?'Original concept and planning':'企划与原案');assert.equal(names[0],'Hinahina');
  await page.locator('.novel-staff-roll-credit').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/${width}-${language}-credits.png`});
  const closing=await page.locator('.novel-staff-roll-closing > p').textContent();
  noJapanese(closing,'Closing sentence');
  if(await page.locator('.novel-staff-roll').getAttribute('data-phase')!=='complete')await page.locator('.novel-staff-roll-data-skip').click();
  await page.waitForFunction(()=>document.querySelector('.novel-staff-roll')?.dataset.phase==='complete');
  const next=page.locator('.novel-staff-roll-finale button');
  await next.scrollIntoViewIfNeeded();
  noJapanese(await next.textContent(),'Credits final button');
  await page.screenshot({path:`${out}/${width}-${language}-credits-final.png`});
  await next.click();
  await page.locator('.true-end-shell').waitFor({timeout:30000});
  const scenes=[];
  for(let i=0;i<3;i++){
   await page.waitForFunction(()=>{const s=document.querySelector('.true-end-shell');return s&&!s.classList.contains('is-scene-separating')&&document.querySelector('.true-end-message')?.textContent;},{},{timeout:15000});
   await page.waitForTimeout(400);
   const data=await page.locator('.true-end-shell').evaluate(el=>({scene:el.dataset.scene,step:el.dataset.step,text:el.querySelector('.true-end-message').textContent}));
   noJapanese(data.text,'True-end scene');scenes.push(data);
   await page.locator('.true-end-skip-button').click();
   if(i<2)await page.waitForFunction(id=>document.querySelector('.true-end-shell')?.dataset.scene!==id,data.scene);
  }
  await page.locator('.true-end-finale').waitFor();
  await page.waitForFunction(()=>!document.querySelector('.true-end-finale').inert);
  const finale=await page.locator('.true-end-finale').textContent();
  noJapanese(finale,'True-end finale');
  await page.screenshot({path:`${out}/${width}-${language}-true-final.png`});
  await page.evaluate(()=>GaiaI18n.set('ja'));
  assert.equal(await page.locator('.true-end-finale > p').textContent(),'世界は、まだひらかれている。');
  assert.equal(await page.locator('.true-end-finale > button').textContent(),'世界とつながる');
  report.checks.push({width,language,music,roles,names,closing,scenes,finale});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}
finally{fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
