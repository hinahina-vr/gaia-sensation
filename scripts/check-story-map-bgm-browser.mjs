import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const before = process.argv.includes('--before');
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/story-map-bgm-20260910/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, {recursive: true});
const storyContext = {};
vm.runInNewContext(fs.readFileSync('novel-story-data.js', 'utf8'), storyContext);
const storyVersion = storyContext.GAIA_NOVEL_STORY.storyVersion;
const report = {status: 'running', base, before, checks: [], errors: [], missing: [], hashes: {}, environment: 'Installed Chrome; real same-origin MP3 decoding/playback, native mouse/touch, isolated saved-position fixture, no audio mocks. Not a physical-device or human listening test.'};
for (const file of ['novel-mode.js', 'opening-audio.js', 'gaia-mode-loader.js', 'index.html', 'assets/audio/moonlit-reopen.mp3']) {
  report.hashes[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
const browser = await chromium.launch({headless: true, executablePath: process.env.GAIA_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
  for (const [name, width, height] of [['pc',1440,900], ['mobile',390,844]]) {
    const context = await browser.newContext({viewport: {width,height}, isMobile: width < 900, hasTouch: width < 900, acceptDownloads: true});
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await context.addInitScript(({storyVersion}) => {
      localStorage.setItem('gaiaSensewareNovel:config:v4', JSON.stringify({messageSpeedPercent:400, reducedMotion:false}));
      if (!localStorage.getItem('gaiaSensewareNovel:progress')) localStorage.setItem('gaiaSensewareNovel:progress', JSON.stringify({
        storyVersion, stepId:'festival_concept_076', reachedSceneIds:['festival_concept'], viewed:{}, evesRoute:[], reflectionIds:[], readStepIds:[],
        metCharacters:{amane:true,mizuha:true,sakuya:true}, audio:{muted:true,volume:0.23}, clear:false, archivesUnlocked:false,
      }));
      localStorage.setItem('gaia-senseware-bgm-volume', '0.23');
    }, {storyVersion});
    page = await context.newPage();
    const audioResponses = [];
    page.on('pageerror', error => report.errors.push(`${name}: ${error.message}`));
    page.on('response', response => {
      if (response.status() === 404) report.missing.push(response.url());
      if (response.url().includes('/assets/audio/')) audioResponses.push({url:response.url(), status:response.status()});
    });
    const activate = selector => width < 900 ? page.locator(selector).tap() : page.locator(selector).click();
    const at = id => page.waitForFunction(id => document.querySelector('#novel-layer')?.dataset.stepId === id, id);
    const playback = () => page.evaluate(() => GaiaOpeningAudio.getPlaybackState());
    const track = expected => page.waitForFunction(expected => GaiaOpeningAudio.getState().track === expected, expected);
    const advanceTo = async id => {
      assert(storyContext.GAIA_NOVEL_STORY.scenes.some(scene => scene.steps.some(step => step.id === id)), `Unknown target step: ${id}`);
      for (let n = 0; n < 700; n++) {
        if (await page.locator('#novel-layer').getAttribute('data-step-id') === id) return;
        if (await page.locator('#novel-chapter-card').isVisible()) {
          await page.waitForTimeout(120);
          continue;
        }
        await activate('#novel-dialogue');
        await page.waitForTimeout(110);
      }
      await at(id);
    };
    await page.goto(base + '/story', {waitUntil:'domcontentloaded'});
    await at('festival_concept_076');
    await page.waitForFunction(() => document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible');
    await page.locator('#gaia-boot').waitFor({state:'hidden'});
    await track('mapambient');
    await activate('#gaia-audio-toggle');
    await activate('#gaia-audio-toggle');
    await page.waitForFunction(() => GaiaOpeningAudio.getState().playing && !GaiaOpeningAudio.getState().muted);
    await advanceTo('map_mode01_001');
    await track(before ? 'mapambient' : 'moonreopen');
    if (before) {
      report.checks.push({name, oldChapterTrack:await playback()});
      await page.screenshot({path:path.join(output,`${name}-old-chapter.png`)});
      await context.close();
      continue;
    }
    await page.waitForFunction(() => { const a=GaiaOpeningAudio.getPlaybackState(); return a.playing && a.outputVolume > 0.05 && a.currentTime > 0.3; });
    await page.evaluate(() => GaiaOpeningAudio.enableAnalysis());
    await page.waitForFunction(() => GaiaOpeningAudio.getAnalysisFrame().rms > 0.001);
    const entry = await playback();
    const chapterSamples = [];
    const sample = async label => {
      const value = await playback();
      assert.equal(value.track, 'moonreopen', `${name}: wrong BGM at ${label}`);
      assert.equal(value.playing, true, `${name}: stopped at ${label}`);
      assert.equal(value.muted, false);
      assert.equal(value.volume, 0.23);
      chapterSamples.push({label, ...value});
      console.log(`${name}: ${label} / ${value.track} / ${value.currentTime.toFixed(2)}s`);
    };
    await sample('chapter-entry');
    await advanceTo('map_mode01_003');
    await activate('#novel-save-button');
    await activate('.novel-save-slot[data-slot-index="0"]');
    await activate('#novel-save-close');
    await advanceTo('map_mode01_004');
    await page.waitForFunction(() => !document.querySelector('#japan-layer')?.hidden && document.querySelector('#japan-overlay')?.dataset.quantitativeLegendId === 'co2-concentration');
    await sample('co2-demo');
    await activate('#story-map-modal-skip');
    await at('map_mode01_005');
    await page.locator('#japan-layer').waitFor({state:'hidden'});
    await advanceTo('map_mode01_015');
    await sample('temperature-background');
    await advanceTo('map_mode01_023');
    await page.waitForFunction(() => document.querySelector('.story-temperature')?.dataset.ready === 'true');
    await sample('temperature-demo');
    await page.locator('[data-temperature-time]').press('End');
    await page.waitForTimeout(500);
    await sample('temperature-2025');
    await page.screenshot({path:path.join(output,`${name}-temperature.png`)});
    await activate('[data-temperature-return]');
    await at('map_mode01_024');
    await page.locator('#japan-layer').waitFor({state:'hidden'});
    await sample('return-from-temperature');
    await advanceTo('map_mode01_030');
    await sample('data-provenance-background');
    await advanceTo('map_mode01_043');
    await sample('last-line');
    for (let i=1; i<chapterSamples.length; i++) {
      const previous=chapterSamples[i-1], current=chapterSamples[i];
      assert(current.currentTime > previous.currentTime || previous.currentTime > previous.duration - 5, `${name}: restarted between ${previous.label} and ${current.label}`);
    }
    await advanceTo('gx_experience_001');
    await track('snowfire');
    await page.waitForFunction(() => GaiaOpeningAudio.getPlaybackState().playing && GaiaOpeningAudio.getPlaybackState().outputVolume > 0.05);
    const nextChapter = await playback();
    await activate('#novel-load-button');
    await activate('.novel-save-slot[data-slot-index="0"]');
    await at('map_mode01_003');
    await track('moonreopen');
    await page.waitForFunction(() => GaiaOpeningAudio.getPlaybackState().playing && GaiaOpeningAudio.getPlaybackState().currentTime > 0.5);
    const loaded = await playback();
    await page.screenshot({path:path.join(output,`${name}-loaded.png`)});
    // Native mute selection survives the loaded chapter and further scene changes.
    if (!(await page.locator('#gaia-audio-dock').evaluate(e => e.classList.contains('is-expanded')))) await activate('#gaia-audio-toggle');
    await activate('#gaia-audio-toggle');
    await page.waitForFunction(() => GaiaOpeningAudio.getState().muted);
    await advanceTo('map_mode01_004');
    await page.waitForFunction(() => !document.querySelector('#japan-layer')?.hidden);
    assert.equal((await playback()).muted, true);
    await activate('#story-map-modal-skip');
    await at('map_mode01_005');
    await page.locator('#japan-layer').waitFor({state:'hidden'});
    await page.reload({waitUntil:'domcontentloaded'});
    await at('map_mode01_005');
    await track('moonreopen');
    assert.equal((await playback()).muted, true);
    assert.equal((await playback()).playing, false);
    assert(audioResponses.some(r => r.url.includes('/moonlit-reopen.mp3?v=gaia-blue-glass-tide-1') && [200,206].includes(r.status)), 'The actual TRACK 10 asset was not served');
    assert.deepEqual(await page.evaluate(() => __securityViolations), []);
    report.checks.push({name, entry, chapterSamples, nextChapter, loaded, nativeMutePreserved:true, reloadRestoresChapterTrack:true, decodedPcmVerified:true, audioResponses});
    await context.close();
    console.log(`PASS ${name}: chapter, both demos, following chapter, save/load, mute, reload, real MP3`);
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.missing, []);
  report.status = 'passed';
} catch(error) {
  report.status='failed'; report.failure=error.stack;
  await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  throw error;
} finally {
  fs.writeFileSync(path.join(output,'report.json'), JSON.stringify(report,null,2));
  await browser.close();
}
