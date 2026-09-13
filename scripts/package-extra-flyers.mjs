// Copy generated originals and verify the local gallery without publishing anything.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
const dir=path.resolve('output/flyers/20260913-extra');
const {jobs}=JSON.parse(fs.readFileSync(path.join(dir,'prompts.json')));
const results=JSON.parse(fs.readFileSync(path.join(dir,'results.json')));
const manifest=[];
for(const job of jobs){
  const row=results.find(r=>r.id===job.id);
  if(!row?.source || row.error) throw new Error('Missing '+job.id);
  const source=path.resolve(row.source);
  if(!source.toLowerCase().startsWith('e:\\codexdata\\home\\generated_images\\')) throw new Error('Unexpected source');
  const target=path.join(dir,job.id+'.png');
  if(!fs.existsSync(target)) fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
  const bytes=fs.readFileSync(target);
  if(!bytes.equals(fs.readFileSync(source))) throw new Error('Original mismatch');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(job.orientation==='vertical'?height<=width:width<=height) throw new Error('Orientation mismatch');
  manifest.push({id:job.id,file:job.id+'.png',width,height,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const section=group=>jobs.filter(j=>j.group===group).map(j=>`<article><h3>${j.id} · ${esc(j.name)}</h3><a href="${j.id}.png"><img src="${j.id}.png" alt="${esc(j.headline)}"></a></article>`).join('');
fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>追加チラシ20案</title><style>body{margin:24px;background:#eeeae3;color:#172c36;font:16px/1.5 sans-serif}main{max-width:1500px;margin:auto}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article{background:white;border-radius:10px;padding:14px}h3{font-size:16px}img{width:100%;height:720px;object-fit:contain}@media(max-width:700px){body{margin:12px}.grid{grid-template-columns:1fr}img{height:auto}}</style><main><h1>惑星の放課後｜追加チラシ20案</h1><p>①ゲーム会社の広告風10案　②手描き脱力キャラ10案。各シリーズ縦5・横5。画像を押すと原寸PNGが開きます。</p><p>販促デザイン案です。画面は実UIを参考に再構成しています。生成された細かなコピー・画面・地理形状は、採用後に実作品との整合を校正する必要があります。</p><h2>① ゲーム広告</h2><section class="grid">${section('game')}</section><h2>② 手描き脱力キャラ</h2><section class="grid">${section('mascot')}</section></main></html>`);
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(pathToFileURL(path.join(dir,'index.html')).href);
  const decoded=await page.locator('img').evaluateAll(async imgs=>{await Promise.all(imgs.map(i=>i.decode()));return imgs.length;});
  if(decoded!==20) throw new Error('Missing image');
  const overflow=[];
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});overflow.push(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));}
  if(overflow.some(Boolean)) throw new Error('Horizontal overflow');
  await page.setViewportSize({width:1600,height:1200});
  await page.addStyleTag({content:'body{margin:12px}main{max-width:none}.grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}article{padding:6px}h3{font-size:12px;margin:2px}img{height:320px}h1{font-size:24px}p{font-size:12px}'});
  await page.screenshot({path:path.join(dir,'contact-sheet.png'),fullPage:true});
  fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),browser:'Local headless Google Chrome',decoded,viewports:[1440,390],horizontalOverflow:overflow,scope:'PNG decoding and local gallery layout; no print proof or deployment'},null,2));
  console.log(JSON.stringify({images:decoded,groups:{game:10,mascot:10},horizontalOverflow:overflow}));
}finally{await browser.close();}
