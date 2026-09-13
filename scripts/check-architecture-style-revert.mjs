import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir='artifacts/architecture-style-revert-20260913';fs.mkdirSync(dir,{recursive:true});
assert(!fs.readFileSync('styles.css','utf8').includes('Reading copy is not a caption'));
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const p=await b.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 await p.goto('http://127.0.0.1:4492/#world-28');
 await p.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
 await p.evaluate(()=>GaiaModeEntryGuide?.close('map',{restoreFocus:false}));
 await p.locator('#japan-close').click();
 await p.locator('#intro-architecture-jump').click();
 const grid=p.locator('.architecture-copy-grid');await grid.scrollIntoViewIfNeeded();
 const styles=await grid.locator('.architecture-story li p').first().evaluate(n=>{const s=getComputedStyle(n);return {font:s.fontFamily,size:s.fontSize,color:s.color,lineHeight:s.lineHeight};});
 assert(!styles.font.includes('Yu Gothic UI'));
 await p.screenshot({path:`${dir}/restored.png`});
 fs.writeFileSync(`${dir}/verification.json`,JSON.stringify({status:'PASS',styles,checks:['copy typography override removed','actual architecture navigation and rendering'],localOnly:true},null,2));
 console.log(styles);
}finally{await b.close();}
