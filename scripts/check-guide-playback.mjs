import {chromium} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='artifacts/guide-playback-20260913';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
const p=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});await p.route('https://**',r=>r.abort());
await p.goto('http://127.0.0.1:4492/#world-21');
await p.waitForFunction(()=>globalThis.GaiaMapPlayback?.getState().ready);await p.locator('#gaia-boot').waitFor({state:'hidden'});
await p.evaluate(()=>GaiaModeEntryGuide.open('map',{force:true}));
await p.evaluate(()=>GaiaMapPlayback.stop());
await p.waitForTimeout(1500);
console.log('before',await p.evaluate(()=>({guide:GaiaModeEntryGuide.getState(),play:GaiaMapPlayback.getState()})));
await p.locator('[data-feature-close]').click();await p.waitForTimeout(1000);
const result=await p.evaluate(()=>({guide:GaiaModeEntryGuide.getState(),play:GaiaMapPlayback.getState()}));console.log('after',result);
await p.screenshot({path:`${out}/after-close.png`});fs.writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));
assert(result.play.requested && result.play.playing,'X preserves automatic playback');
}finally{await browser.close();}
