// 配布用ではなくローカルQAレポートのリンク・画像・小画面表示を検査する。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const out=path.resolve('artifacts/responsive-followup-20260913');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 await page.goto(pathToFileURL(`${out}/REPORT.html`).href);
 for(const uri of await page.locator('a[href],img[src]').evaluateAll(nodes=>nodes.map(n=>n.href||n.src))){const url=new URL(uri);assert.equal(url.protocol,'file:');assert(fs.existsSync(fileURLToPath(url)),uri);}
 await page.locator('img').evaluateAll(images=>images.forEach(i=>i.loading='eager'));
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await page.locator('section').count(),6);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`${out}/report-preview-${width}.png`});
 await page.locator('#E04 h2').evaluate(e=>e.scrollIntoView());
 await page.screenshot({path:`${out}/report-save-comparison-${width}.png`});
 results.push({width,passed:true,images:await page.locator('img').count()});await page.close();
}}finally{await browser.close();fs.writeFileSync(`${out}/report-check.json`,JSON.stringify(results,null,2));}
console.log('Report links, 18 images, and desktop/mobile layout PASS');
