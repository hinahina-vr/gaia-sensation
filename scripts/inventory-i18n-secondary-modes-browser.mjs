import fs from 'node:fs';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const rows=new Map();
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await context.route('https://**',r=>r.abort());
 const page=await context.newPage();await page.goto('http://127.0.0.1:4492/#sound');
 await page.waitForFunction(()=>!!window.GaiaModeLoader);
 for(const mode of ['space','gx','character']){
  await page.evaluate(async mode=>{
   await GaiaModeLoader.load(mode);
   if(mode==='space')await GaiaSpace.open(0);
   if(mode==='gx')await GaiaGX.open({returnTo:'intro',phase:0});
   if(mode==='character')location.hash='#character';
  },mode);
  await page.waitForTimeout(800);
  const sources=await page.evaluate(async mode=>{
   GaiaI18n.set('ja');const found=new Set();
   const add=s=>{s=s?.trim();if(s&&/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(s))found.add(s);};
   const root=document.querySelector(mode==='character'?'#character-book-layer':'#'+mode+'-layer');
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode())if(!n.parentElement.closest('script,style,input,textarea,code,[translate=no]'))add(n.data);
   for(const el of root.querySelectorAll('[aria-label],[title],[data-description]'))for(const attr of ['aria-label','title','data-description'])add(el.getAttribute(attr));
   const visit=value=>{
    if(typeof value==='string')add(value);
    else if(value&&typeof value==='object')for(const child of Object.values(value))visit(child);
   };
   if(mode==='space'||mode==='gx')visit(await(await fetch('/data/'+(mode==='space'?'space-signals.json':'gx-deep-time.json'))).json());
   GaiaI18n.set('en');const english=[...found].map(s=>GaiaI18n.t(s));
   GaiaI18n.set('zh-CN');return [...found].map((source,i)=>({source,en:english[i],'zh-CN':GaiaI18n.t(source)}))
    .filter(r=>/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(r.en)||/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(r['zh-CN']));
  },mode);
  for(const row of sources)rows.set(row.source,{...row,mode});
  console.log(mode,sources.length);
 }
 fs.writeFileSync('artifacts/i18n/secondary-modes-original.json',JSON.stringify([...rows.values()],null,2));
}finally{await browser.close();}
