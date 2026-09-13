import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/i18n/log-export';fs.mkdirSync(out,{recursive:true});
const report={status:'running',scope:'Actual local Chrome log UI, native downloads and clipboard; local QA comment only; no external writes.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
const readDownload=async(button)=>{
 const [download]=await Promise.all([page.waitForEvent('download'),button.click()]);
 const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
 return {name:download.suggestedFilename(),buffer:Buffer.concat(chunks)};
};
try{
 for(const width of [1440,390])for(const language of ['en','zh-CN']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390,reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
  await context.route('https://**',r=>r.abort());
  await context.addInitScript(lang=>{
   localStorage.setItem('gaia:language:v1',lang);
   localStorage.setItem('gaiaSensewareNovel:config:v4',JSON.stringify({messageSpeedPercent:400,reducedMotion:true}));
  },language);
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto((process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492')+'/#story');await page.waitForFunction(()=>!!window.GaiaNovel);
  await page.evaluate(()=>GaiaNovel.open(null,{autoStartFresh:true}));
  await page.waitForFunction(()=>document.querySelector('#novel-text')?.dataset.revealState==='complete',{},{timeout:30000});
  await page.locator('#novel-log-button').click();await page.locator('#novel-log-panel').waitFor();
  await page.keyboard.type('ruu');await page.locator('#novel-log-view-script').click();
  const expected=await page.evaluate(()=>[...GAIA_NOVEL_STORY.scenes,...GAIA_TRUE_END_STORY.scenes]
   .flatMap(s=>s.steps).map(s=>({id:s.id,text:GaiaI18n.t(s.text||'')})));
  const entries=await page.locator('.novel-script-entry').evaluateAll(es=>es.map(e=>({
   id:e.dataset.stepId,text:e.querySelector('.novel-log-entry-text').textContent
  })));
  assert.equal(entries.length,expected.length);
  for(const step of expected){const actual=entries.find(e=>e.id===step.id);assert(actual,'Missing ID '+step.id);if(step.text)assert.equal(actual.text,step.text);}
  await page.screenshot({path:out+'/'+width+'-'+language+'-script.png'});
  const exported=await readDownload(page.locator('#novel-log-script-export'));
  assert(exported.buffer.subarray(0,3).equals(Buffer.from([239,187,191])));
  const markdown=exported.buffer.toString('utf8'),tick=String.fromCharCode(96);
  fs.writeFileSync(out+'/'+width+'-'+language+'-'+exported.name,exported.buffer);
  for(const step of expected){
   assert(markdown.includes(tick+step.id+tick),'Export lost ID '+step.id);
   if(step.text)assert(markdown.includes(step.text.split('\n').map(s=>'> '+s).join('\n')),'Export lost text '+step.id);
  }
  // Technical metadata is deliberately machine-readable, not prose.
  const prose=markdown.replace(new RegExp(tick.repeat(3)+'json[\\s\\S]*?'+tick.repeat(3),'gu'),'');
  const forbidden=language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u:/[\p{Script=Hiragana}\p{Script=Katakana}]/u;
  const untranslated=prose.split('\n').filter(s=>forbidden.test(s));assert.deepEqual(untranslated,[],'Untranslated export prose');
  await page.locator('.novel-script-copy').first().click();
  assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/gu,'\n'),expected[0].id+'\n'+expected[0].text);
  const scan=await page.locator('#novel-log-panel').evaluate(el=>{
   const rows=[];const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode())if(!n.parentElement.closest('code,textarea,input,[translate=no]'))rows.push(n.data);
   return {text:rows.join('\n'),overflow:el.scrollWidth>el.clientWidth+1};
  });
  report.lastScan={width,language,...scan};
  assert(!scan.overflow,'Log panel horizontal overflow');
  assert(!forbidden.test(scan.text),'Untranslated log UI: '+scan.text.match(/[^\n]*[\p{Script=Hiragana}\p{Script=Katakana}][^\n]*/gu)?.slice(0,12));
  const ids=entries.map(e=>e.id);
  await page.evaluate(()=>GaiaI18n.set('ja'));await page.waitForTimeout(100);
  assert.deepEqual(await page.locator('.novel-script-entry').evaluateAll(es=>es.map(e=>e.dataset.stepId)),ids);
  assert.equal(await page.locator('.novel-log-entry-text').first().textContent(),await page.evaluate(()=>GAIA_NOVEL_STORY.scenes[0].steps[0].text));
  await page.evaluate(lang=>GaiaI18n.set(lang),language);await page.locator('#novel-log-view-heard').click();
  const comment='QA: 地点名・name保持 / English 中文';
  const editor=page.locator('.novel-log-comment-field textarea').first();
  await editor.fill(comment);await editor.blur();
  const comments=await readDownload(page.locator('#novel-log-export'));
  assert(comments.buffer.toString('utf8').includes(comment),'User comment changed');
  report.checks.push({width,language,steps:entries.length,export:exported.name,clipboard:true,userComment:true});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,failure:report.failure}));}
