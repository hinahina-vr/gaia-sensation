import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const dir = path.resolve('output/flyers/20260913-varied');
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(pathToFileURL(path.join(dir,'index.html')).href);
  const images = await page.locator('img').evaluateAll(async nodes => {
    await Promise.all(nodes.map(img => {img.loading='eager'; return img.decode();}));
    return nodes.map(img => ({file:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight}));
  });
  if(images.length !== 20 || images.some(i=>!i.width)) throw new Error('Expected 20 decoded flyers');
  const desktopOverflow = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  await page.setViewportSize({width:390,height:844});
  const mobileOverflow = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(desktopOverflow || mobileOverflow) throw new Error('Gallery horizontal overflow');
  await page.setViewportSize({width:1600,height:1200});
  await page.addStyleTag({content:'body{padding:12px}header{margin-bottom:12px}header p{font-size:12px;margin:4px}h1{font-size:24px}.grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;max-width:none}article{padding:8px}h2{font-size:12px;margin:0}article p{font-size:11px;margin:0}img{height:280px;max-height:280px}small{font-size:10px}'});
  await page.screenshot({path:path.join(dir,'contact-sheet.png'),fullPage:true});
  fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify({browser:'Local headless Google Chrome',checkedAt:new Date().toISOString(),images,desktopOverflow,mobileOverflow,scope:'Image decoding, orientation via packaging, local gallery layout; not print proof or production deployment'},null,2));
  console.log(JSON.stringify({decoded:images.length,desktopOverflow,mobileOverflow}));
} finally {await browser.close();}
