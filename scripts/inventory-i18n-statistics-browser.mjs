import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {METHOD_LOOKUP} from '../statistics-methods.js';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const sources=new Map();
try {
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await context.route('https://**',r=>r.abort());
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:4492/#world-26');
 await page.waitForFunction(()=>globalThis.GaiaMapPlayback?.getState().ready);
 await page.evaluate(async()=>{GaiaMapPlayback.stop();GaiaModeEntryGuide.close('map',{restoreFocus:false});await GaiaModeLoader.load('statistics');});
 await page.locator('[data-estat-analysis]').click();
 await page.waitForFunction(()=>GaiaStatisticsLab.getState().analysisReady);
 const scan=async label=>{
  const rows=await page.evaluate(async()=>{
   GaiaI18n.set('ja');const rows=new Set();
   const add=s=>{if(typeof s==='string'&&/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(s))rows.add(s.trim());};
   const root=document.querySelector('#gaia-statistics-lab');
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode())if(!n.parentElement?.closest('script,style,input,textarea,code,pre,[translate=no]'))add(n.data);
   for(const el of root.querySelectorAll('[title],[aria-label],[placeholder]'))for(const a of ['title','aria-label','placeholder'])add(el.getAttribute(a));
   const result=await GaiaStatisticsLab.run(GaiaStatisticsLab.getState().methodId);
   const visit=value=>{if(typeof value==='string')add(value);else if(value&&typeof value==='object')Object.values(value).forEach(visit);};
   visit(result);
   GaiaI18n.set('en');return [...rows].filter(s=>/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(GaiaI18n.t(s)));
  });
  for(const source of rows){if(!sources.has(source))sources.set(source,{source,selectors:[]});sources.get(source).selectors.push(label);}
  console.log(label,sources.size);
 };
 await scan('actual-exhibit-26');
 for(const [id,method]of METHOD_LOOKUP) {
  const datasetId=id==='paired'?'jma-co2':id==='discrete'?'earthquakes':['categorical','fisher'].includes(id)?'forest-urban':['multiple','anova','logistic'].includes(id)?'renewables':'co2-trend';
  await page.evaluate(async ({id,group,datasetId})=>{
   await GaiaStatisticsLab.open({datasetId});
   const select=document.querySelector('#gaia-statistics-lectures');select.value=group;select.dispatchEvent(new Event('change'));
   document.querySelector(`[data-method="${id}"]`).click();
  },{id,group:method.group.id,datasetId});
  await page.waitForFunction(id=>GaiaStatisticsLab.getState().analysisReady&&GaiaStatisticsLab.getState().methodId===id,id);
  await scan(id);
 }
}finally{fs.mkdirSync('artifacts/i18n',{recursive:true});fs.writeFileSync('artifacts/i18n/statistics-untranslated.json',JSON.stringify([...sources.values()],null,2));await browser.close();}
