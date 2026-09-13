import fs from 'node:fs';
import {chromium} from 'playwright-core';
const [path='sensors/#map',out='artifacts/i18n/sensor-untranslated.json']=process.argv.slice(2);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const context=await browser.newContext();
 await context.route('https://**',r=>r.abort());
 await context.route('**/api/web/v1/session',r=>r.fulfill({status:401,json:{error:{code:'UNAUTHENTICATED'}}}));
 for(const [route,json]of [['/api/public/v1/sensors',{sensors:[]}],['/api/public/v1/measurement-types',{categories:[],measurements:[]}],['/api/web/v1/countries',{countries:[]}]] )await context.route('**'+route,r=>r.fulfill({json}));
 const page=await context.newPage();await page.goto('http://127.0.0.1:4492/'+path);
 await page.waitForTimeout(1800);
 const rows=await page.evaluate(()=>{
  window.GaiaI18n?.set('ja');const rows=new Map();
  const add=(s,where)=>{s=s?.trim();if(!s||!/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(s))return;if(!rows.has(s))rows.set(s,new Set());rows.get(s).add(where);};
  const scan=root=>{
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode())if(!n.parentElement?.closest('script,style,pre,code,input,textarea,[translate=no]'))add(n.data,n.parentElement?.id||n.parentElement?.className||n.parentElement?.tagName);
   for(const el of root.querySelectorAll('[title],[aria-label],[aria-description],[placeholder],[data-description]'))for(const a of ['title','aria-label','aria-description','placeholder','data-description'])add(el.getAttribute(a),(el.id||el.tagName)+'@'+a);
  };
  scan(document);for(const t of document.querySelectorAll('template'))scan(t.content);
  window.GaiaI18n?.set('en');
  return [...rows].filter(([source])=>/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(window.GaiaI18n?.t(source)||source)).map(([source,selectors])=>({source,selectors:[...selectors]}));
 });
 fs.mkdirSync('artifacts/i18n',{recursive:true});fs.writeFileSync(out,JSON.stringify(rows,null,2));console.log(JSON.stringify({path,count:rows.length,out,scope:'DOM including hidden panels, unauthenticated read-only empty API fixtures. Not authenticated/runtime coverage.'}));
}finally{await browser.close();}
