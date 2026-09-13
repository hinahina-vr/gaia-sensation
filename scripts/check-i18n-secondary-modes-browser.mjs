import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const inventory=process.argv.includes('--inventory'),out='artifacts/i18n/secondary-runtime';fs.mkdirSync(out,{recursive:true});
const report={status:'running',scope:'Local Chrome, public APIs prepare embedded modes/GX phases; native space mode buttons, expanded explanations, source panels, and pointer interaction. Not production or natural story handoff timing.',checks:[],errors:[]};
const rows=new Map(),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});let page;
try{
 for(const width of inventory?[1440]:[1440,390])for(const language of inventory?['en']:['en','zh-CN']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},hasTouch:width===390,reducedMotion:'reduce'});
  await context.route('https://**',r=>r.abort());
  await context.addInitScript(lang=>localStorage.setItem('gaia:language:v1',lang),language);
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  for(const mode of ['space','gx']){
   await page.goto('http://127.0.0.1:4492/');
   await page.evaluate(async mode=>{
    await GaiaModeLoader.load(mode);
    const opening=document.querySelector('#gaia-opening');opening.hidden=true;opening.classList.remove('is-active');
    document.body.classList.remove('gaia-opening-active');
    document.querySelector('#gaia-opening-sound-modal')?.remove();
    if(mode==='space')await GaiaSpace.open(0);else await GaiaGX.open({returnTo:'intro',phase:0});
   },mode);
   const scan=async label=>{
    await page.waitForTimeout(180);
    const scan=await page.evaluate(({mode,inventory,language})=>{
     if(inventory)GaiaI18n.set('ja');
     const root=document.querySelector('#'+mode+'-layer'),sources=new Set();
     const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('[hidden],[aria-hidden="true"]');
     const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
     for(let n=walker.nextNode();n;n=walker.nextNode())if(n.data.trim()&&visible(n.parentElement)&&!n.parentElement.closest('script,style,input,textarea,code'))sources.add(n.data.trim());
     for(const el of root.querySelectorAll('[aria-label],[title]'))if(visible(el))for(const attr of ['aria-label','title'])if(el.getAttribute(attr))sources.add(el.getAttribute(attr));
     if(inventory)GaiaI18n.set(language);
     return [...sources].map(source=>({source,text:inventory?GaiaI18n.t(source):source}))
      .filter(r=>language==='en'?/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(r.text):/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(r.text));
    },{mode,inventory,language});
    for(const row of scan)rows.set(row.source,{...row,label});
    if(!inventory)assert.deepEqual(scan,[],'Untranslated '+label);
   };
   for(let i=0;i<(mode==='space'?10:8);i++){
    if(mode==='space'){
     await page.locator('.space-mode-option').nth(i).click();
     await page.waitForFunction(i=>GaiaSpaceTourAdapter.getState().modeIndex===i,i);
    }else{await page.evaluate(i=>GaiaGX.setPhase(i),i);}
    await page.waitForTimeout(600);await scan(mode+'-'+i);
    const point=await page.evaluate(({mode,i})=>{
     const canvas=document.querySelector('#'+mode+'-canvas'),box=canvas.getBoundingClientRect();
     const candidates=mode==='gx'?[[box.width<=620?.5:i===7?.6:.76,box.width<=620?.36:.48]]:
      [[.7,.3],[.5,.3],[.7,.45],[.5,.45],[.9,.4],[.5,.15],[.5,.65]];
     for(const [fx,fy] of candidates){
      const x=box.x+box.width*fx,y=box.y+box.height*fy;
      if(document.elementFromPoint(x,y)===canvas)return {x,y,dx:box.width*.035,dy:box.height*.025};
     }
     return null;
    },{mode,i});
    assert(point,'Canvas must be reachable through the actual UI: '+mode+' '+width);
    const effect=page.locator('#'+mode+'-effect'),beforeEffect=await effect.textContent();
    await page.mouse.move(point.x,point.y);await page.mouse.down();
    await page.mouse.move(point.x+point.dx,point.y+point.dy,{steps:2});await page.mouse.up();
    await page.waitForTimeout(220);
    assert.notEqual(await effect.textContent(),beforeEffect,'Native gesture must change feedback: '+mode+' '+i);
    await scan(mode+'-'+i+'-gesture');
    if(mode==='space'&&i===5)assert.match(await page.locator('#space-record-detail').textContent(),/—\s*km\/s/u,'Missing speed must not be zero');
    if(mode==='gx'){
     await page.locator('#gx-mobile-info-toggle').click();await scan(mode+'-'+i+'-explanation');
    }
    const dataButton=page.locator(mode==='space'?'#space-data-button':'#gx-data');
    const dataAvailable=await dataButton.isVisible();
    if(dataAvailable){await dataButton.click();await scan(mode+'-'+i+'-data');}
    await page.screenshot({path:out+'/'+width+'-'+language+'-'+mode+'-'+i+'.png'});
    if(dataAvailable)await page.locator(mode==='space'?'#space-data-close':'#gx-data-close').click();
    report.checks.push({width,language,mode,index:i,dataAvailable});
   }
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status=inventory?'inventory-complete':'passed';
}catch(e){report.status='failed';report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});process.exitCode=1;}
finally{
 fs.writeFileSync(out+'/'+(inventory?'inventory':'report')+'.json',JSON.stringify(report,null,2));
 fs.writeFileSync(out+'/pending.json',JSON.stringify([...rows.values()],null,2));
 await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,pending:rows.size,failure:report.failure}));
}
