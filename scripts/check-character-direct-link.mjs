import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:4492';
const out = 'artifacts/character-direct-link-20260914';
await fs.mkdir(out,{recursive:true});
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  for (const width of [1440,390]) {
    const page = await browser.newPage({viewport:{width,height:900}});
    // Empty browser storage, following a link from a separate document.
    await page.setContent(`<a href="${base}/#character">キャラクターを見る</a>`);
    await page.getByRole('link').click();
    const visible = async () => {
      await page.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
      await page.waitForFunction(()=>{
        const layer=document.querySelector('#character-book-layer');
        const image=document.querySelector('#character-book-image');
        return layer && !layer.hidden && !layer.inert && layer.classList.contains('is-open')
          && image?.complete && image.naturalWidth>0;
      },null,{timeout:30000});
      assert.equal(new URL(page.url()).hash,'#character');
    };
    await visible();
    await page.reload();
    await visible();
    await page.waitForTimeout(1000);
    await page.screenshot({path:`${out}/${width}.png`});
    await page.locator('#character-book-close').click();
    await page.waitForFunction(()=>location.hash==='#top');
    await page.evaluate(()=>{location.hash='#character';});
    await visible();
    console.log(`PASS ${width}: fresh link, reload, close to top, reopen`);
    await page.close();
  }
} finally {await browser.close();}
