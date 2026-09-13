import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {enforceBrowserSecurity} from './lib/browser-security-qa.mjs';
import {conceptEditorialCopy as copy} from './lib/concept-editorial-copy.mjs';

const before = process.argv.includes('--before');
const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/concept-editorial-20260910/${before ? 'before' : 'after'}`);
fs.mkdirSync(output, {recursive: true});
const report = {status: 'running', before, base, checks: [], errors: [], hashes: {}, environment: 'Installed Chrome, isolated contexts and real target assets. Local targets receive production CSP; HTTPS targets retain actual server headers. Mobile is viewport/touch emulation.'};
for (const file of ['concept/index.html', 'concept/concept.css', 'concept/concept.js']) report.hashes[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let page;
try {
  for (const [width, height] of (before ? [[1440, 900], [390, 844]] : [[1440, 900], [2274, 1100], [3840, 2160], [768, 1024], [390, 844], [320, 568], [280, 653], [844, 390]])) {
    const context = await browser.newContext({viewport: {width, height}, hasTouch: width <= 844, isMobile: width <= 390, reducedMotion: width === 320 ? 'reduce' : 'no-preference'});
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => new URL(route.request().url()).origin === new URL(base).origin ? route.fallback() : route.abort());
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => {if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`);});
    await page.goto(`${base}/concept/#depth`, {waitUntil: 'networkidle'});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.body.dataset.enhanced === 'true' && document.querySelector('.site-header').dataset.theme === 'deep');
    await page.waitForTimeout(700);
    await page.screenshot({path: path.join(output, `${width}-depth.png`)});
    if (before) {
      await page.locator('.work-disclaimer').scrollIntoViewIfNeeded();
      const broken = [];
      for (const scanWidth of [width, 1440, 1280, 1100, 1024, 900, 768, 640, 500, 390, 360, 320]) {
        await page.setViewportSize({width: scanWidth, height});
        const lines = await page.locator('.work-disclaimer').evaluate(node => {
          const text = node.firstChild, at = text.textContent.indexOf('フィクション'), range = document.createRange();
          range.setStart(text, at); range.setEnd(text, at + 'フィクション'.length);
          return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size;
        });
        if (lines > 1) {broken.push(scanWidth); await page.screenshot({path: path.join(output, `${scanWidth}-broken-footer.png`)}); break;}
      }
      report.checks.push({width, brokenFictionWordAt: broken});
      await context.close(); continue;
    }
    assert.deepEqual(await page.locator('.depth-question .copy-phrase').allTextContents(), copy.question);
    assert.deepEqual(await page.locator('.depth-description').allTextContents(), copy.depth);
    assert.equal(await page.locator('.depth-manifesto').textContent(), copy.manifesto.join(''));
    assert.equal(await page.locator('#mechanism-title').textContent(), copy.mechanismTitle);
    assert.deepEqual(await page.locator('.vision-step h3').allTextContents(), copy.components.map(item => item[0]));
    assert.deepEqual(await page.locator('.vision-step p').allTextContents(), copy.components.map(item => item[1]));
    assert.deepEqual(await page.locator('.agency-closing > p').allTextContents(), copy.closing.map(lines => lines.join('')));
    assert.equal(await page.locator('.work-disclaimer').textContent(), copy.disclaimer, 'Keep the disclaimer meaning while omitting the redundant author reference');
    assert.equal(await page.locator('#learning-title').textContent(), copy.learning.title);
    assert.equal(await page.locator('.university-kicker').textContent(), copy.learning.kicker);
    assert.equal(await page.locator('.university-story h3').textContent(), copy.learning.heading);
    assert.deepEqual(await page.locator('.university-story > p:not(.university-kicker)').allTextContents(), [copy.learning.introduction]);
    assert.equal(await page.locator('.learning-reference-label').textContent(), copy.learning.referenceTitle + copy.learning.preface);
    for (const [index, course] of (await page.locator('.learning-courses > li').all()).entries()) assert.deepEqual(await course.locator('p').allTextContents(), copy.learning.courses[index]);
    const mainText = await page.locator('main').textContent();
    assert.doesNotMatch(mainText, /作者/u);
    for (const removed of copy.learning.removed) assert(!mainText.replace(/\s/gu, '').includes(removed.replace(/\s/gu, '')), `Deleted text remains: ${removed}`);
    assert.equal(await page.locator('.learning-plate figcaption, .threshold-copy > p:not(.eyebrow)').count(), 0);
    assert.equal(await page.locator('.learning-plate img').count(), 1, 'Delete the caption only, keeping the illustration');
    assert(await page.locator('.learning-reference-label > span').evaluate(node => parseFloat(getComputedStyle(node).fontSize) >= 14), 'The expanded course preface is readable body copy');
    assert.equal(await page.locator('#question, .oracle-evidence-note, .depth-overline, .depth-heading > .text-link, .mechanism-heading .section-index, .author-profile').count(), 0);
    assert.deepEqual(await page.locator('.experience-label').allTextContents(), ['A GIS MODE', 'B GIS MODE', 'C STORY MODE']);
    assert.equal(await page.locator('.site-footer .author-colophon > p').count(), 2);
    assert.equal(await page.locator('.author-colophon a').getAttribute('href'), 'https://note.com/hinahina_vr/n/nd03dec22e46a');
    assert.match(await page.locator('.author-colophon').textContent(), /作者：ひなひな.*ZEN大学 知能情報社会学部1期生。/s);
    const header = await page.locator('.site-header').evaluate(node => {
      const a = node.querySelector('.site-signature').getBoundingClientRect(), b = node.querySelector('nav').getBoundingClientRect();
      return {signature: a.toJSON(), navigation: b.toJSON(), overlap: a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top};
    });
    assert(!header.overlap && header.signature.left >= 0 && header.navigation.right <= width + 1, JSON.stringify(header));
    for (const selector of ['#top', '#first-world', '#learning', '#surface', '#depth', '.vision-steps', '.agency-closing', '.author-colophon', '.work-disclaimer']) {
      const target = page.locator(selector);
      await target.scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${width}/${selector}: page overflow`);
      const clipped = await target.locator('p, h1, h2, h3, .copy-phrase').evaluateAll(nodes => nodes.filter(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        return [...range.getClientRects()].some(rect => rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1));
      }).map(node => node.textContent));
      assert.deepEqual(clipped, [], `${width}/${selector}: clipped copy`);
      if (['#top', '#first-world', '#learning', '#surface', '.vision-steps', '.agency-closing', '.author-colophon', '.work-disclaimer'].includes(selector)) await target.screenshot({path: path.join(output, `${width}-${selector.replace(/^[#.]/, '')}.png`), style: '.site-header, .skip-link { visibility: hidden !important; }'});
    }
    const fragments = await page.locator('.work-disclaimer .copy-phrase').evaluateAll(nodes => nodes.map(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      return {text: node.textContent, lines: new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size, width: node.getBoundingClientRect().width};
    }));
    assert(fragments.length > 5 && fragments.every(item => item.lines === 1 && item.width < width), 'Semantic footer phrases stay whole');
    assert.equal(await page.locator('#page-title').textContent(), copy.title);
    assert.equal(await page.locator('.site-signature small').textContent(), copy.signatureEnglish);
    assert.equal(await page.locator('.site-signature > span:last-child').textContent(), copy.signature + copy.signatureEnglish);
    assert.deepEqual(await page.locator('.overview-description').allTextContents(), copy.overview);
    assert.deepEqual(await page.locator('.experience-heading h3').allTextContents(), ['世界を、直視する', '地球の動きを、感じる', '出会い、変わる']);
    for (const [index, article] of (await page.locator('.world-experience').all()).entries()) {
      const picture = await article.locator('.experience-figure').boundingBox();
      const heading = await article.locator('.experience-heading').boundingBox();
      if (width > 600) {
        assert(index === 1 ? picture.x >= heading.x + heading.width : heading.x >= picture.x + picture.width, 'A/B/C headings remain beside alternating images');
        for (const paragraph of await article.locator('.experience-copy > p').all()) assert((await paragraph.boundingBox()).y >= picture.y + picture.height, 'Reading rows stay beneath image and label');
      } else assert(heading.y >= picture.y + picture.height, 'Mobile image precedes the letter label and heading');
    }
    assert.deepEqual(await page.locator('.experience-figure figcaption').allTextContents(), ['GIS MODE 地図・公開データの可視化', 'GIS MODE 海流の速さと向きを感じる', 'STORY MODE ゲームで物語をたどる']);
    for (const anchor of ['first-world', 'learning', 'depth', 'mechanism']) {
      const link = `.site-header a[href="#${anchor}"]`;
      if (width <= 844) await page.locator(link).tap(); else await page.locator(link).click();
      await page.waitForFunction(anchor => {
        const target = document.getElementById(anchor).getBoundingClientRect();
        const header = document.querySelector('.site-header').getBoundingClientRect();
        return target.top >= header.height - 1 && target.top < header.height + 160;
      }, anchor);
      const top = await page.locator(`#${anchor}`).evaluate(node => node.getBoundingClientRect().top);
      assert(top >= (await page.locator('.site-header').boundingBox()).height - 1, `${width}/${anchor}: anchor hidden by header`);
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push({width, height, exactCopy: true, learningRevision: true, courses: 4, courseParagraphs: 8, removedSections: true, redundantAuthorReferencesRemoved: true, header, footerFragments: fragments, anchors: true});
    console.log(`PASS ${width}x${height}: exact copy, removals, phrase wrapping, anchors`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.failure = error.stack;
  await page?.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close();
}
