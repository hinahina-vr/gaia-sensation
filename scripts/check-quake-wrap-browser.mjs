import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const out='artifacts/quake-wrap-20260912';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const width of [1440,390]){
const page=await browser.newPage({viewport:{width,height:900}});
await page.goto('http://127.0.0.1:4492/#world');
await page.waitForFunction(()=>globalThis.GaiaMapObservationAdapter&&globalThis.GaiaModeEntryGuide);
await page.evaluate(async()=>{await GaiaMapObservationAdapter.waitSignalsReady();GaiaModeEntryGuide.close('map',{restoreFocus:false});GaiaMapObservationAdapter.selectMode(5);});
await page.waitForFunction(()=>document.querySelector('#japan-overlay').dataset.selectionLabelLines);
const lines=await page.locator('#japan-overlay').evaluate(e=>JSON.parse(e.dataset.selectionLabelLines));
assert(lines.length);console.log(width,JSON.stringify(lines));
await page.screenshot({path:`${out}/${width}.png`});await page.close();
}}finally{await browser.close();}
