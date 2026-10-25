import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
const dir=path.resolve(`artifacts/quality-review-20261022/${process.env.GAIA_REVIEW_GALLERY||'01-20-native-entry'}`);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  for(const [width,start,end,columns] of [[1920,1,20,4],[390,1,10,5],[390,11,20,5]]) {
    const page=await browser.newPage({viewport:{width:1600,height:900}});
    const pictures=Array.from({length:end-start+1},(_,i)=>{const n=String(start+i).padStart(2,'0');return `<figure><figcaption>${n} / ${width}px</figcaption><img src="data:image/png;base64,${fs.readFileSync(path.join(dir,`${width}-${n}.png`)).toString('base64')}"></figure>`;});
    await page.setContent(`<style>body{margin:0;padding:12px;background:#050d14;color:#d7e8ef;font:16px sans-serif;display:grid;grid-template-columns:repeat(${columns},1fr);gap:10px}figure{margin:0}figcaption{padding:4px}img{width:100%;display:block}</style>${pictures.join('')}`);
    await page.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
    await page.screenshot({path:path.join(dir,`gallery-${width}-${start}-${end}.png`),fullPage:true});await page.close();
  }
} finally {await browser.close();}
