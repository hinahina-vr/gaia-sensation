import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const inventory=process.argv.includes('--inventory'),out='artifacts/i18n/statistics-ai';fs.mkdirSync(out,{recursive:true});
const report={status:'running',scope:'Local Chrome, bundled observations, real form/confirmation/request serialization; all provider requests intercepted with a fixture answer. No external AI provider called.',checks:[],errors:[]},pending=new Set();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const width of inventory?[1440]:[1440,390])for(const language of inventory?['en']:['en','zh-CN']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390,reducedMotion:'reduce'});
  await context.route('https://**',r=>r.abort());await context.addInitScript(lang=>localStorage.setItem('gaia:language:v1',lang),language);
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:4492/#world-08');
  await page.waitForFunction(()=>globalThis.GaiaMapPlayback?.getState().ready);
  await page.evaluate(async()=>{GaiaMapPlayback.stop();GaiaModeEntryGuide.close('map',{restoreFocus:false});await GaiaModeLoader.load('statistics');});
  await page.waitForFunction(()=>Boolean(globalThis.GaiaMapObservationAdapter));
  await page.evaluate(async()=>{await GaiaMapObservationAdapter.waitSignalsReady();await GaiaStatisticsLab.open({datasetId:'co2-trend'});});
  await page.waitForFunction(()=>GaiaStatisticsLab.getState().analysisReady);
  await page.locator('#gaia-statistics-ai-open').click();
  const dialog=page.locator('#gaia-statistics-ai-dialog'),form=dialog.locator('form'),question=form.locator('[name=question]');
  const scan=async label=>{
   await page.waitForTimeout(200);
   const rows=await dialog.evaluate((root,{inventory,language})=>{
    if(inventory)GaiaI18n.set('ja');const strings=new Set(),w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    for(let n=w.nextNode();n;n=w.nextNode())if(n.parentElement.checkVisibility()&&!n.parentElement.closest('pre,code,input,textarea')&&n.data.trim())strings.add(n.data.trim());
    for(const el of root.querySelectorAll('[aria-label],[title],[placeholder]'))if(el.checkVisibility())for(const attr of ['aria-label','title','placeholder'])if(el.getAttribute(attr))strings.add(el.getAttribute(attr));
    if(inventory)GaiaI18n.set(language);
    return [...strings].filter(s=>(language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u:/[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(inventory?GaiaI18n.t(s):s));
   },{inventory,language});
   rows.forEach(s=>pending.add(s));if(!inventory)assert.deepEqual(rows,[],label);
   await page.screenshot({path:out+'/'+width+'-'+language+'-'+label+'.png'});
  };
  await scan('opened');
  const presets=await page.evaluate(async()=>{const m=await import('/statistics-ai.js');return m.statisticsAiQuestions.map(p=>({id:p.id,source:p.question,translated:GaiaI18n.t(p.question)}));});
  assert.equal(await question.inputValue(),presets[0].translated);
  for(const preset of presets){await form.locator('[data-ai-prompt="'+preset.id+'"]').click();assert.equal(await question.inputValue(),preset.translated);}
  await page.evaluate(()=>GaiaI18n.set('ja'));assert.equal(await question.inputValue(),presets.at(-1).source);
  await page.evaluate(lang=>GaiaI18n.set(lang),language);assert.equal(await question.inputValue(),presets.at(-1).translated);
  const draft='Keep my draft / この質問はそのまま';await question.fill(draft);
  await page.evaluate(()=>GaiaI18n.set('ja'));await page.evaluate(lang=>GaiaI18n.set(lang),language);assert.equal(await question.inputValue(),draft);
  await form.locator('[name=apiKey]').fill('qa-placeholder-not-a-real-key');
  const preview=JSON.parse(await dialog.locator('[data-ai-preview]').textContent());
  assert(preview.samples.length>0);
  let allow=false,requestBody;const messages=[];
  page.on('dialog',async d=>{messages.push(d.message());if(allow)await d.accept();else await d.dismiss();});
  await form.locator('[type=submit]').click();await scan('cancelled');
  assert.equal(messages.length,1);
  if(!inventory)assert(!(language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u:/[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(messages[0]));
  const reply=language==='en'?'Local fixture answer: review the observations.':'本地测试回答：请核查观测数据。';
  await context.route('https://openrouter.ai/api/v1/chat/completions',async r=>{requestBody=r.request().postDataJSON();await r.fulfill({json:{choices:[{message:{content:reply}}]}});});
  allow=true;await form.locator('[type=submit]').click();await page.waitForFunction(()=>document.querySelector('[data-ai-answer]').dataset.state==='complete');
  assert.equal(await dialog.locator('[data-ai-answer]').textContent(),reply);
  assert(requestBody.messages[0].content.includes(language==='en'?'英語で、':'簡体字中国語で、'));
  assert.deepEqual(JSON.parse(requestBody.messages[1].content.split('計算結果(JSON)：\n')[1]),preview);
  assert(requestBody.messages[1].content.includes(draft));await scan('fixture-answer');
  await dialog.locator('[data-ai-clear]').click();assert.equal(await form.locator('[name=apiKey]').inputValue(),'');await scan('cleared');
  await dialog.locator('[data-ai-end]').click();await dialog.waitFor({state:'hidden'});
  await page.locator('#gaia-statistics-ai-open').click();assert.equal(await question.inputValue(),'');assert.equal(await form.locator('[name=apiKey]').inputValue(),'');
  report.checks.push({width,language,presets:presets.length,sentRows:preview.samples.length,preservedSnapshot:true,preservedDraft:true,clearAndEnd:true});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status=inventory?'inventory-complete':'passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(out+'/'+(inventory?'inventory':'report')+'.json',JSON.stringify(report,null,2));fs.writeFileSync(out+'/pending.json',JSON.stringify([...pending],null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,pending:pending.size,failure:report.failure}));}
