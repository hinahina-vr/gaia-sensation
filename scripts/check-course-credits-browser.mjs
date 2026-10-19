// Focused visual QA: real story renderer resumed from an isolated ending save.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
const base=process.env.GAIA_BASE_URL,out=process.env.GAIA_QA_OUTPUT_DIR || 'artifacts/course-credits-20261018';fs.mkdirSync(out,{recursive:true});
const report={sha:execFileSync('git',['--no-optional-locks','rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:'SHA + uncommitted changes',scope:'Local installed Chrome; desktop and mobile emulation; isolated ending save with reduced-motion credits. Not full natural story playback.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const width of [1440,390]){
  console.log(`Course credit screenshot: ${width}`);
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce',hasTouch:width<900});
  await enforceBrowserSecurity(context,base);await context.route('https://**',r=>r.abort());
  await context.addInitScript(()=>{localStorage.setItem('gaia:language:v1','ja');localStorage.setItem('gaia-senseware-bgm-volume','0');sessionStorage.setItem('gaia:title-return-resume','1');});
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.setDefaultNavigationTimeout(120000);
  await page.goto(`${base}/concept/index.html`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.enhanced==='true');
  const course=page.locator('.learning-courses li').filter({has:page.locator('a[href="https://syllabus.zen.ac.jp/subjects/2026/SOC-2-C1-1030-005"]')});
  await course.scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await course.locator('a').getAttribute('href'),'https://syllabus.zen.ac.jp/subjects/2026/SOC-2-C1-1030-005');
  assert.equal(await page.locator('.learning-courses li').count(),6);
  assert.match(await course.locator('p').innerText(),/国家化・産業化・情報化が重なり合う現代を/);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`${out}/${width}-concept.png`});await course.screenshot({path:`${out}/${width}-concept-course.png`});
  for(const [lang,title]of [['en','Information Society Studies'],['zh-CN','信息社会论'],['ja','情報社会論']]){
   await page.evaluate(lang=>GaiaI18n.set(lang),lang);
   assert.equal(await course.locator('h4').textContent(),title);
   assert.match(await course.locator('p').innerText(),lang==='en'?/contemporary society/:lang==='zh-CN'?/当代社会/:/重なり合う現代を/);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert(!(await page.locator('.learning-reference-label').innerText()).match(/5つ|five |五门/));
  }
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!globalThis.GaiaModeLoader);
  await page.evaluate(()=>GaiaModeLoader.load('story'));await page.waitForFunction(()=>!!globalThis.GAIA_NOVEL_STORY);
  await page.evaluate(()=>{
   const progress={storyVersion:GAIA_NOVEL_STORY.storyVersion,stepId:'welcome_chat_095',reachedSceneIds:['welcome_chat'],viewed:{},metCharacters:{mizuha:true,amane:true,sakuya:true},evesRoute:[],observationOrder:'LOCAL_FIRST',editorialChoice:null,reflectionIds:[],resultTone:null,demoInterest:'太古の海',audio:{muted:true,volume:0},readStepIds:[],clear:false,archivesUnlocked:false,sessionId:'course-credits-qa'};
   localStorage.setItem('gaiaSensewareNovel:progress',JSON.stringify(progress));
   localStorage.setItem('gaiaSensewareNovel:manual-saves',JSON.stringify([{progress,savedAt:Date.now(),meta:{title:'QA',excerpt:progress.stepId}}]));
   localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:true}));
  });
  await page.goto(`${base}/story`,{waitUntil:'domcontentloaded'});await page.locator('#novel-layer.is-staff-roll').waitFor({timeout:60000});
  await page.waitForFunction(()=>document.querySelector('#novel-layer')?.dataset.entryTransition==='visible');
  const credits=page.locator('[data-credit-role="ACADEMIC INSPIRATION"]');
  assert.equal(await credits.locator('.novel-staff-roll-credit-name').count(),6);
  assert((await credits.innerText()).includes('ZEN大学『情報社会論』'));
  await credits.scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);
  const bounds=await credits.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width+1);
  await page.screenshot({path:`${out}/${width}-ending.png`});await credits.screenshot({path:`${out}/${width}-ending-credit.png`});
  for(const [lang,name]of [['en','ZEN University: Information Society Studies'],['zh-CN','ZEN大学《信息社会论》'],['ja','ZEN大学『情報社会論』']]){
   await page.evaluate(lang=>GaiaI18n.set(lang),lang);assert((await credits.innerText()).includes(name));
  }
  report.checks.push({width,conceptCourses:6,endingCourses:6,syllabusLink:true,languages:['ja','en','zh-CN'],bounds});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;if(page&&!page.isClosed())await page.screenshot({path:`${out}/failure.png`});throw error;}
finally{fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
