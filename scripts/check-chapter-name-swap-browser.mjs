import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const out = 'artifacts/chapter-name-swap-20260912';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      localStorage.setItem('gaiaSensewareNovel:progress', JSON.stringify({storyVersion:13, stepId:'welcome_chat_023', reachedSceneIds:['circle_invitation','welcome_chat'], viewed:{}, metCharacters:{mizuha:true,amane:true,sakuya:true},evesRoute:[],observationOrder:'LOCAL_FIRST',reflectionIds:[],readStepIds:[],audio:{muted:true,volume:0},sessionId:'chapter-name-qa'}));
    });
    await page.goto('http://127.0.0.1:4492/story');
    await page.waitForFunction(() => document.querySelector('#novel-layer')?.dataset.stepId === 'welcome_chat_023');
    await page.locator('#gaia-boot').waitFor({state:'hidden'});
    await page.locator('#novel-jump-button').click();
    for (const [id, chapter, title] of [['circle_invitation','05 / WELCOME','つながる世界'],['welcome_chat','06 / AFTER SCHOOL','惑星の放課後']]) {
      const item = page.locator(`.novel-jump-item[data-scene-id="${id}"]`);
      assert.equal(await item.locator('small').textContent(), chapter);
      assert.equal(await item.locator('strong').textContent(), title);
      await item.scrollIntoViewIfNeeded();
      await page.screenshot({path:`${out}/${width}-${id}.png`});
      results.push({width,id,chapter,title});
    }
    await page.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(`${out}/report.json`, JSON.stringify(results,null,2));
console.log('Chapter names: 4 visible browser checks passed');
