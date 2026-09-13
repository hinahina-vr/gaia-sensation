import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/i18n/concept';fs.mkdirSync(out,{recursive:true});
const report={status:'running',scope:'Actual local Chrome; desktop and mobile emulation; no external link navigation.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const width of [1440,390])for(const language of ['en','zh-CN']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390,reducedMotion:'reduce'});
  await context.route('https://**',r=>r.abort());
  await context.addInitScript(lang=>localStorage.setItem('gaia:language:v1',lang),language);
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto('http://127.0.0.1:4492/concept/');
  await page.waitForFunction(()=>document.body.dataset.enhanced==='true');
  const initial=await page.evaluate(()=>({
   htmlLang:document.documentElement.lang,
   title:document.title,
   passages:document.querySelectorAll('[data-concept-passage]').length,
   links:[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')),
   images:[...document.images].map(i=>i.getAttribute('src'))
  }));
  assert.equal(initial.passages,26);assert.equal(initial.htmlLang,language);
  assert.equal(await page.locator('.learning-courses > li').count(),5);
  assert.equal(await page.locator('.learning-courses > li').last().locator('a').getAttribute('href'),'https://syllabus.zen.ac.jp/subjects/2026/INF-2-C1-1030-014');
  for(const index of [2,4]){
    await page.locator('.learning-courses > li').nth(index).scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
    await page.screenshot({path:out+'/'+width+'-'+language+'-course-'+index+'.png'});
  }
  for(const id of ['top','first-world','learning','surface','depth','mechanism']){
   await page.locator('#'+id).scrollIntoViewIfNeeded();await page.waitForTimeout(180);
   await page.screenshot({path:out+'/'+width+'-'+language+'-'+id+'.png'});
  }
  const scan=await page.evaluate(()=>({
   text:document.body.innerText,
   attributes:[...document.querySelectorAll('[aria-label],[alt]')].flatMap(e=>[e.getAttribute('aria-label'),e.getAttribute('alt')]).filter(Boolean),
   overflow:document.documentElement.scrollWidth>innerWidth+1,
   passages:[...document.querySelectorAll('[data-concept-passage]')].map(el=>({text:el.textContent,html:el.innerHTML}))
  }));
  const forbidden=language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u:/[\p{Script=Hiragana}\p{Script=Katakana}]/u;
  assert(!forbidden.test(scan.text),'Untranslated concept text: '+scan.text);
  assert(scan.attributes.every(s=>!forbidden.test(s)),'Untranslated concept accessibility text');
  assert(!scan.overflow,'Page horizontal overflow');
  assert(await page.locator('.site-header a').evaluateAll(links=>links.every(a=>{
    const r=a.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;
  })),'Header navigation is clipped');
  await page.locator('[data-open-diagram]').click();
  assert(await page.locator('.diagram-viewer').evaluate(e=>e.open));
  await page.locator('[data-zoom-diagram]').click();
  assert.equal(await page.locator('[data-zoom-diagram]').getAttribute('aria-pressed'),'true');
  const zoom=await page.locator('[data-zoom-diagram]').textContent();assert(!forbidden.test(zoom));
  await page.screenshot({path:out+'/'+width+'-'+language+'-diagram.png'});
  await page.keyboard.press('Escape');
  assert(await page.locator('[data-open-diagram]').evaluate(e=>document.activeElement===e));
  await page.evaluate(()=>GaiaI18n.set('ja'));
  for(const index of [2,4]){
    await page.locator('.learning-courses > li').nth(index).scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
    await page.screenshot({path:out+'/'+width+'-ja-course-'+index+'.png'});
  }
  const restored=await page.evaluate(()=>({
   title:document.querySelector('#page-title').innerHTML,
   description:document.querySelector('.overview-description').innerHTML,
   links:[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')),
   images:[...document.images].map(i=>i.getAttribute('src'))
  }));
  assert.equal(restored.title,'『惑星の放課後』<span>とは</span>');
  assert(restored.description.includes('<strong>展示参加型ビジュアルノベル</strong>'));
  assert.deepEqual(initial.links,restored.links);assert.deepEqual(initial.images,restored.images);
  await page.evaluate(lang=>GaiaI18n.set(lang),language);
  assert.equal(await page.locator('#page-title').textContent(),scan.passages[0].text);
  await page.locator('.site-signature').click();await page.waitForURL('http://127.0.0.1:4492/');
  assert.equal(await page.locator('html').getAttribute('lang'),language);
  report.checks.push({width,language,initial,zoom,scan});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,errors:report.errors,failure:report.failure}));}
