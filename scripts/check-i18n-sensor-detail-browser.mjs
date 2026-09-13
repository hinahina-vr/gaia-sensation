import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const inventory=process.argv.includes('--inventory'),out='artifacts/i18n/sensor-detail';fs.mkdirSync(out,{recursive:true});
const report={status:'running',scope:'Local Chrome and local fixture sensor API; no real account, device or AI provider requests.',checks:[],errors:[]},sources=new Set();
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const width of inventory?[1440]:[1440,390])for(const language of inventory?['en']:['en','zh-CN']){
  await fetch('http://127.0.0.1:4528/__qa/reset',{method:'POST'});
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390,reducedMotion:'reduce'});
  await context.route('https://**',r=>r.abort());
  await context.addInitScript(lang=>{localStorage.setItem('gaia:language:v1',lang);sessionStorage.setItem('gaia:mode-entry-guide:sensor:v3','seen');},language);
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const scan=async label=>{
   await page.waitForTimeout(250);
   const rows=await page.evaluate(({language,inventory})=>{
    if(inventory)GaiaI18n.set('ja');
    const strings=new Set(),walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    for(let n=walker.nextNode();n;n=walker.nextNode())if(n.parentElement.checkVisibility()&&!n.parentElement.closest('script,style,code,pre,input,textarea,[translate=no]')&&n.data.trim())strings.add(n.data.trim());
    for(const el of document.querySelectorAll('[aria-label],[title]'))if(el.checkVisibility()&&!el.closest('[translate=no]'))for(const attr of ['aria-label','title'])if(el.getAttribute(attr))strings.add(el.getAttribute(attr));
    if(inventory)GaiaI18n.set(language);
    return [...strings].map(source=>({source,text:inventory?GaiaI18n.t(source):source})).filter(row=>(language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u:/[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(row.text.replaceAll('ベランダ環境センサー','').replaceAll('青猫センサー','')));
   },{language,inventory});
   for(const row of rows)sources.add(row.source);
   if(!inventory)assert.deepEqual(rows,[],label);
   await page.screenshot({path:out+'/'+width+'-'+language+'-'+label+'.png'});
   report.checks.push({width,language,label});
  };
  await page.goto('http://127.0.0.1:4528/sensors/?authenticated=1#device=dev_browser_qa');
  await page.locator('[data-view=detail]').waitFor();
  await scan('detail');await page.locator('#refresh-detail').click();await scan('history-refreshed');
  await page.locator('#analyze-detail').click();await scan('analysis');
  await page.locator('#sensor-ai-form textarea[name=question]').fill('Keep this user question / この入力は保持');
  await page.locator('#sensor-ai-form button[type=submit]').click();await scan('missing-key');
  await page.locator('#sensor-ai-key').fill('qa-placeholder-not-a-real-key');
  const dialogs=[];let allowMock=false;
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());if(allowMock)await dialog.accept();else await dialog.dismiss();});
  await page.locator('#sensor-ai-form button[type=submit]').click();await scan('destination-cancelled');
  if(!inventory){
   let requestBody;
   const reply=language==='en'?'Fixture answer: compare the recorded values.':'本地测试回答：请比较已记录的数值。';
   await context.route('https://openrouter.ai/api/v1/chat/completions',async route=>{
    requestBody=route.request().postDataJSON();
    await route.fulfill({json:{choices:[{message:{content:reply}}]}});
   });
   allowMock=true;await page.locator('#sensor-ai-form button[type=submit]').click();
   await page.waitForFunction(()=>document.querySelector('#sensor-ai-answer').dataset.state==='complete');
   allowMock=false;
   assert.equal(await page.locator('#sensor-ai-answer').textContent(),reply);
   assert(requestBody.messages[0].content.includes(language==='en'?'英語で答え':'簡体字中国語で答え'));
   assert(requestBody.messages[1].content.includes('Keep this user question / この入力は保持'));
   const data=JSON.parse(requestBody.messages[1].content.split('センサーデータ(JSON)：\n')[1]);
   assert.equal(data.sensor.name,'ベランダ環境センサー');assert.equal(data.summary.sampleCount,3);
   await page.evaluate(lang=>GaiaI18n.set(lang),language==='en'?'zh-CN':'en');
   assert.equal(await page.locator('#sensor-ai-form textarea[name=question]').inputValue(),'Keep this user question / この入力は保持');
   assert.equal(await page.locator('#sensor-ai-key').inputValue(),'qa-placeholder-not-a-real-key');
   await page.evaluate(lang=>GaiaI18n.set(lang),language);
   await scan('mock-answer');
   for(const [locale,phrase]of [['ja','日本語で、'],['en','英語で、'],['zh-CN','簡体字中国語で、']]){
    const prompt=await page.evaluate(async locale=>{
     GaiaI18n.set(locale);const {statisticsAiPrompt}=await import('/statistics-ai.js');
     return statisticsAiPrompt({sample:'QA raw ID',value:24.4},'Unchanged question');
    },locale);
    assert(prompt.system.includes(phrase));assert(prompt.user.includes('"value":24.4'));
   }
   await page.evaluate(lang=>GaiaI18n.set(lang),language);
  }
  await page.locator('#sensor-analysis-close').click();await page.locator('#revoke-device').click();
  assert.equal(dialogs.length,inventory?2:3);
  for(const source of dialogs)if(inventory)sources.add(source);else assert(!(language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u:/[\p{Script=Hiragana}\p{Script=Katakana}]/u).test(source.replaceAll('ベランダ環境センサー','')),source);
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status=inventory?'inventory-complete':'passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{
 fs.writeFileSync(out+'/'+(inventory?'inventory':'report')+'.json',JSON.stringify(report,null,2));
 fs.writeFileSync(out+'/pending.json',JSON.stringify([...sources],null,2));
 await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,pending:sources.size,failure:report.failure}));
}
