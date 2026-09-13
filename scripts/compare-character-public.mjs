import {chromium} from 'playwright-core';
import fs from 'node:fs';
const out='artifacts/character-published-layout-20260913';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
 for(const [name,url] of [['public','https://gaia-senseware.pages.dev/#character'],['local','http://127.0.0.1:4492/#character']]) {
  const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#character-book-layer.is-open').waitFor();
  await page.locator('[data-character-select]').first().click();
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(6000);
  await page.screenshot({path:`${out}/${name}-1920.png`,animations:'disabled'});
  const styles=await page.evaluate(()=>Object.fromEntries(['.character-book-hero','.character-book-hero-copy','.character-book-hero-detail','.character-book-hero-figure','.character-book-hero-quote','#character-book-profile','#character-book-title'].map(sel=>{const el=document.querySelector(sel),s=getComputedStyle(el),r=el.getBoundingClientRect();return [sel,{text:el.innerText,rect:{x:r.x,y:r.y,width:r.width,height:r.height},font:s.font,color:s.color,display:s.display}];})));
  fs.writeFileSync(`${out}/${name}-styles.json`,JSON.stringify(styles,null,2));
  console.log(name,styles);
  await page.close();
 }
}finally{await browser.close();}
