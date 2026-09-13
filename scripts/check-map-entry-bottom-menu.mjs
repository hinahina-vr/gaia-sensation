import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright-core';
const out='artifacts/map-entry-bottom-menu-20260914';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  for(const width of [1440,390]) {
    const page=await browser.newPage({viewport:{width,height:900},hasTouch:width===390});
    await page.goto('http://127.0.0.1:4492/#top');
    await page.locator('#gaia-boot').waitFor({state:'hidden',timeout:60000});
    await page.keyboard.press('Escape');
    await page.locator('[data-intro-path="map"]').click();
    await page.locator('[data-feature-start]').click({timeout:60000});
    await page.waitForFunction(()=>GaiaMapPlayback.getState().playing,{},{timeout:20000});
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('[data-map-menu-toggle]').getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#map-mobile-sheet').getAttribute('open'),null);
    await page.waitForFunction(()=>Number(document.querySelector('#gaia-firms-canvas').dataset.firmsPlaybackProgress)>0,null,{timeout:20000});
    const before=await page.locator('#gaia-firms-canvas').getAttribute('data-firms-playback-progress');
    await page.waitForTimeout(1800);
    assert.notEqual(await page.locator('#gaia-firms-canvas').getAttribute('data-firms-playback-progress'),before);
    await page.screenshot({path:`${out}/${width}-entry.png`});
    console.log(`PASS ${width}: entry start, no menu, autoplay advances`);
    if(width>900) {
      await page.goto('http://127.0.0.1:4492/#world-06');
      await page.waitForFunction(()=>document.querySelector('#japan-mode-number').textContent.trim()==='06');
      await page.waitForTimeout(5000);
      await page.locator('[data-map-menu-toggle]').hover();
      await page.mouse.move(1400,400);
      await page.waitForTimeout(400);
      const trigger=page.locator('.map-dock-bank-trigger');
      await trigger.click();
      await page.waitForTimeout(700);
      const picker=page.locator('#map-dock-bank-popover');
      assert.equal(await picker.getAttribute('data-anchor'),'bottom');
      const a=await trigger.boundingBox(),b=await picker.boundingBox();
      assert(Math.abs(a.y-(b.y+b.height))<30,JSON.stringify({a,b}));
      await page.screenshot({path:`${out}/bottom-before-crossing.png`});
      await page.mouse.move(b.x+40,b.y+b.height-20,{steps:8});
      await page.waitForTimeout(300);
      assert(await picker.isVisible());
      await page.screenshot({path:`${out}/bottom-menu.png`});
      console.log('PASS: top menu then bottom dock click, bottom anchoring, pointer crossing');
      for(const number of [12,15]) {
        await page.goto(`http://127.0.0.1:4492/#world-${number}`);
        await page.waitForFunction(n=>Number(document.querySelector('#japan-mode-number').textContent)===n,number);
        await page.waitForTimeout(5000);
        await page.locator('[data-map-menu-toggle]').hover();
        const title=page.locator('[data-map-bank-toggle]:visible, .map-dock-bank-trigger:visible').first();
        await title.click();
        await page.waitForTimeout(700);
        assert.equal(await picker.getAttribute('data-anchor'),'bottom');
        assert(await picker.isVisible());
        const titleBox=await title.boundingBox(), menuBox=await picker.boundingBox();
        // Replacement titles sit inside a padded dock; its top edge is the anchor.
        const gap=titleBox.y-(menuBox.y+menuBox.height);
        assert(gap>=0 && gap<64,JSON.stringify({number,titleBox,menuBox}));
        console.log(`PASS ${number}: replacement dock anchors bottom`);
      }
    }
    await page.close();
  }
}finally{await browser.close();}
