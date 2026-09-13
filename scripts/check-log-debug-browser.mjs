import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {logWordingCorrection as correction} from '../story/log-wording-20260912.js';
import '../novel-story-data.js';

const base = 'http://127.0.0.1:4492';
const out = path.resolve('artifacts/log-debug-20260912');
fs.mkdirSync(out, {recursive: true});
const report = {status: 'running', checks: [], errors: []};
const browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
let page;
try {
  for (const [width, height] of [[1440,900], [390,844]]) {
    const context = await browser.newContext({viewport: {width,height}, hasTouch: width < 900, acceptDownloads: true,
      permissions: ['clipboard-read','clipboard-write']});
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    await context.addInitScript(({version,id}) => {
      if (!localStorage.getItem('gaiaSensewareNovel:progress')) localStorage.setItem('gaiaSensewareNovel:progress', JSON.stringify({
        storyVersion: version, stepId: id, reachedSceneIds: ['circle_invitation'], readStepIds: [id],
        viewed: {}, evesRoute: [], metCharacters: {amane:true,mizuha:true,sakuya:true}, audio: {muted:true,volume:0},
        clear:false, archivesUnlocked:false, sessionId:'log-debug-qa',
      }));
      if (!sessionStorage.getItem('gaiaSensewareNovel:log-comments:v1')) sessionStorage.setItem('gaiaSensewareNovel:log-comments:v1', JSON.stringify({[id]:'保存済みコメント'}));
      localStorage.setItem('gaiaSensewareNovel:config:v4', JSON.stringify({messageSpeedPercent:400,reducedMotion:true}));
    }, {version: GAIA_NOVEL_STORY.storyVersion, id:correction.id});
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    const ready = async () => {
      await page.waitForFunction(() => document.querySelector('#novel-layer')?.dataset.runtimeReveal === 'revealed'
        && document.querySelector('#novel-layer').dataset.entryTransition === 'visible'
        && document.querySelector('#novel-text').dataset.revealState === 'complete');
      await page.locator('#gaia-boot').waitFor({state:'hidden'});
    };
    await page.goto(base+'/#story'); await ready();
    let displayed = await page.locator('#novel-text').textContent();
    for (let count = 0; displayed !== correction.after && count < 4; count++) {
      assert(correction.after.startsWith(displayed), 'Dialogue pages must preserve the requested wording');
      const previous = await page.locator('#novel-text').textContent();
      const box = await page.locator('#novel-text').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(previous => document.querySelector('#novel-text').textContent !== previous
        && document.querySelector('#novel-text').dataset.revealState === 'complete', previous);
      assert.equal(await page.locator('#novel-layer').getAttribute('data-step-id'), correction.id);
      displayed += await page.locator('#novel-text').textContent();
    }
    assert.equal(displayed, correction.after);
    await page.locator('#novel-log-button').click();
    const entry = page.locator(`#novel-log-content article[data-step-id="${correction.id}"]`);
    assert.equal(await entry.locator('.novel-log-entry-text').textContent(), correction.after);
    const hidden = async () => {
      for (const selector of ['.novel-log-view-tabs','.novel-log-tools','.novel-log-entry-actions','.novel-log-comment-field','.novel-log-entry-id']) {
        assert.equal(await page.locator('#novel-log-panel '+selector).first().isVisible(), false, selector);
      }
      assert.equal(await page.locator('#novel-log-content').getAttribute('data-view'), 'heard');
    };
    await hidden();
    await page.screenshot({path:path.join(out,`${width}-normal.png`)});
    await page.keyboard.type('ruxuu'); await hidden();
    await page.keyboard.type('ruu');
    assert.equal(await page.locator('#novel-log-panel').getAttribute('data-debug-mode'), 'true');
    assert(await page.locator('.novel-log-view-tabs').isVisible());
    assert(await entry.locator('.novel-log-entry-actions').isVisible());
    await entry.getByRole('button', {name: `${correction.id}のLOG IDをコピー`, exact:true}).click();
    await page.waitForFunction(id => document.querySelector('#novel-log-status').textContent === `${id} のIDをコピーしました`, correction.id);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), correction.id);
    await entry.getByRole('button', {name: `${correction.id}のLOG IDと本文をコピー`, exact:true}).click();
    await page.waitForFunction(id => document.querySelector('#novel-log-status').textContent === `${id} のIDと本文をコピーしました`, correction.id);
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g,'\n'), correction.id+'\n'+correction.after);
    const field = entry.locator('textarea');
    assert.equal(await field.inputValue(), '保存済みコメント');
    await field.fill(''); await field.pressSequentially('ruu');
    assert.equal(await page.locator('#novel-log-panel').getAttribute('data-debug-mode'), 'true');
    await field.fill('回帰試験のコメント');
    const layout = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
      return {title:rect('#novel-log-title'), tabs:rect('.novel-log-view-tabs'), header:rect('#novel-log-panel > header')};
    });
    assert(layout.tabs.left >= layout.title.right, 'Tabs must sit to the right of the title');
    assert(layout.tabs.top < layout.title.bottom && layout.tabs.bottom > layout.title.top, 'Title and tabs must share a row');
    assert(layout.header.height < (width > 720 ? 90 : 270), 'Log header must remain compact');
    await page.screenshot({path:path.join(out,`${width}-debug.png`)});
    const downloadText = async (selector, name) => {
      const download = page.waitForEvent('download'); await page.locator(selector).click();
      const file = await download; const dest = path.join(out,`${width}-${name}.md`);
      await file.saveAs(dest); return fs.readFileSync(dest,'utf8');
    };
    const comments = await downloadText('#novel-log-export','comments');
    assert(comments.includes(correction.after) && comments.includes('回帰試験のコメント'));
    const script = await downloadText('#novel-log-script-export','script');
    assert(script.includes(correction.after) && !script.includes(correction.before));
    await page.locator('#novel-log-view-script').click();
    assert.equal(await page.locator('#novel-log-content').getAttribute('data-view'), 'script');
    assert.equal(await page.locator('.novel-script-entry').count(),544);
    await page.keyboard.type('ruu'); await hidden();
    await page.locator('#novel-log-close').click();
    await page.locator('#novel-log-button').click(); await hidden();
    await page.keyboard.type('ruu');
    assert.equal(await entry.locator('textarea').inputValue(),'回帰試験のコメント');
    await page.reload(); await ready();
    await page.locator('#novel-log-button').click(); await hidden();
    await page.keyboard.type('ruu');
    assert.equal(await entry.locator('textarea').inputValue(),'回帰試験のコメント');
    assert.deepEqual(await page.evaluate(() => __securityViolations),[]);
    report.checks.push({width,height,normalHidden:true,ruuToggle:true,inputIgnored:true,commentPreserved:true,downloads:true,wording:true,reloadNormal:true});
    await context.close(); console.log('PASS',width);
  }
  assert.deepEqual(report.errors,[]); report.status='passed';
} catch(error) {
  report.status='failed'; report.error=error.stack;
  await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{}); throw error;
} finally {
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)); await browser.close();
}
