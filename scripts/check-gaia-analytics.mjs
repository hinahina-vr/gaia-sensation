import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const out='artifacts/analytics-regional-consent-20260915';await fs.mkdir(out,{recursive:true});
const origin='https://gaia-senseware.pages.dev';
const choiceKey='gaia-analytics-choice-v2';
try {
 for(const variant of [{country:'JP',width:1440},{country:'JP',width:390},{country:'DE',width:1440},{country:'US',width:390},{country:'GB',width:390,path:'/'},{country:'XX'},{country:'fail'},{country:'timeout'},{country:'JP',denied:true},{country:'US',gpc:true},{country:'US',dnt:true},{country:'DE',saved:'granted'},{country:'DE',saved:'denied'},{country:'DE',saved:'granted',expired:true}]) {
  const context=await browser.newContext({viewport:{width:variant.width||390,height:900},locale:'ja-JP'});
  let tags=0,traces=0;
  await context.addInitScript(({v,key})=>{
    if(v.denied)localStorage.setItem('gaia-analytics-consent-v1','denied');
    if(v.saved&&!sessionStorage.getItem('seeded')) {localStorage.setItem(key,JSON.stringify({value:v.saved,at:Date.now()-(v.expired?181*86400000:0)}));sessionStorage.setItem('seeded','1');}
    if(v.gpc)Object.defineProperty(navigator,'globalPrivacyControl',{value:true});
    if(v.dnt)Object.defineProperty(navigator,'doNotTrack',{value:'1'});
  },{v:variant,key:choiceKey});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='www.googletagmanager.com'){tags++;return route.fulfill({contentType:'text/javascript',body:'/* Google stub; no actual GA collection */'});}
    if(url.pathname==='/cdn-cgi/trace') {
      traces++;
      if(variant.country==='timeout'){await new Promise(r=>setTimeout(r,4300));return route.abort().catch(()=>{});}
      return variant.country==='fail'?route.abort():route.fulfill({body:'loc='+variant.country+'\n'});
    }
    if(url.hostname==='gaia-senseware.pages.dev')return route.fulfill({response:await context.request.get('http://127.0.0.1:4492'+url.pathname+url.search)});
    return route.abort();
  });
  const page=await context.newPage();
  await page.goto(origin+(variant.path||'/concept/'));
  await page.waitForTimeout(variant.country==='timeout'?4600:1000);
  const protectedByPreference=variant.denied||variant.gpc||variant.dnt||variant.saved==='denied';
  const expected=!protectedByPreference&&(variant.country==='JP'||(variant.saved==='granted'&&!variant.expired));
  assert.equal(tags,expected?1:0,JSON.stringify(variant));
  assert.equal(traces,1);
  const popup=page.locator('#gaia-analytics-consent');
  if(variant.country==='JP') {
    assert.equal(await popup.count(),0);
    assert.equal(await page.locator('#gaia-analytics-settings').count(),0);
  } else {
    assert.equal(await popup.isVisible(),!!(!protectedByPreference&&(!variant.saved||variant.expired)));
    assert.equal(await popup.locator('h2').textContent(),'Analytics preferences');
    if(!await popup.isVisible())await page.locator('#gaia-analytics-settings').click();
    const box=await popup.boundingBox();
    assert(box.x>=0&&box.y>=0&&box.x+box.width<=(variant.width||390)&&box.y+box.height<=900);
    if(variant.width)await page.screenshot({path:`${out}/${variant.country}-${variant.width}.png`});
    await popup.locator('[data-ga-reject]').click();
    assert.equal(await popup.isVisible(),false);
    const before=await page.evaluate(()=>window.dataLayer?.length||0);
    await page.evaluate(()=>history.replaceState(null,'','/?secret=private#sound'));
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(()=>window.dataLayer?.length||0),before);
    await page.reload();await page.waitForTimeout(variant.country==='timeout'?4600:500);
    assert.equal(await popup.isVisible(),false,'Persisted rejection');
    await page.locator('#gaia-analytics-settings').click();
    if(variant.gpc||variant.dnt)assert(await popup.locator('[data-ga-accept]').isDisabled());
    else {
      const previousTags=tags;
      await popup.locator('[data-ga-accept]').click();
      await page.waitForTimeout(100);
      assert.equal(tags,previousTags+1);
      await page.evaluate(()=>{history.replaceState(null,'','/?secret=private#story');history.replaceState(null,'','/?secret=private#story');});
      await page.waitForTimeout(50);
      const commands=await page.evaluate(()=>window.dataLayer.map(x=>Array.from(x)));
      assert.equal(commands.filter(x=>x[1]==='page_view').length,2);
      assert(!JSON.stringify(commands).includes('private'));
      await page.reload();await page.waitForTimeout(variant.country==='timeout'?4600:500);
      assert.equal(await popup.isVisible(),false,'Persisted consent');
      assert.equal(tags,previousTags+2);
      await page.locator('#gaia-analytics-settings').click();
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(()=>window['ga-disable-G-GY90YZSS4D']),true);
    }
  }
  console.log('PASS',JSON.stringify(variant));await context.close();
 }
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4492/concept/');
 assert.equal(await page.locator('script[src*="googletagmanager"],#gaia-analytics-consent,#gaia-analytics-settings').count(),0);
 console.log('PASS localhost excluded');
} finally {await browser.close();}
