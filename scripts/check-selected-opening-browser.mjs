import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { enforceBrowserSecurity } from './lib/browser-security-qa.mjs';

const base = process.env.GAIA_BASE_URL || 'http://127.0.0.1:4492';
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const output = path.resolve(process.env.GAIA_OUTPUT_DIR || `artifacts/opening-selected-20260912/${only || 'after'}`);
fs.mkdirSync(output, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const selected = 'assets/opening-selected-20260912/';
const manifest = JSON.parse(fs.readFileSync(selected + 'selection.json'));
const report = { status: 'running', base, checks: [], errors: [], missing: [], hashes: {}, scope: 'Installed Chrome with local production CSP; real opening playback, actual images and UI. Responsive/touch/capability emulation, not physical devices. External APIs blocked. Static layout probes explicitly separated from playback.' };
for (const file of ['opening.css', 'opening.js', 'index.html', ...manifest.assets.flatMap(asset => [selected + asset.original, ...asset.variants.map(v => selected + v.file)])]) report.hashes[file] = hash(fs.readFileSync(file));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
let page;
const scanPanel = panel => page.evaluate(panel => {
  const node = document.querySelector(`.gaia-vn-panel-${panel}`);
  const style = getComputedStyle(node);
  const copy = node.querySelector('.gaia-vn-prologue-lockup, .gaia-vn-character-copy');
  const text = [], walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent.trim()) continue;
    const range = document.createRange(); range.selectNodeContents(walker.currentNode);
    text.push(...[...range.getClientRects()].filter(rect => rect.width > 0).map(rect => rect.toJSON()));
  }
  return { art: style.backgroundImage, position: style.backgroundPosition, size: style.backgroundSize, panel: node.getBoundingClientRect().toJSON(), copy: copy.getBoundingClientRect().toJSON(), text };
}, panel);
const specs = [
  { name: 'pc', width: 1440, height: 900, playback: true },
  { name: 'mobile', width: 390, height: 844, playback: true },
  { name: 'compact', width: 390, height: 844, compact: true, playback: true },
  { name: 'small', width: 320, height: 568 },
  { name: 'landscape', width: 844, height: 390, playback: true },
  { name: 'short-landscape', width: 568, height: 320, playback: true },
  { name: '4k', width: 3840, height: 2160 },
  { name: 'wide', width: 2560, height: 1080 },
  { name: 'reduced', width: 390, height: 844, reduced: true },
].filter(spec => !only || spec.name === only);
assert(specs.length > 0, 'Unknown --only viewport');
const panels = [['prologue', 'prologue'], ['minamo', 'mizu'], ['sora', 'ame']];
// Hand-checked facial landmarks in the unmodified 1672×941 originals.
const faceBounds = { prologue: [[820, 170, 980, 330], [1230, 245, 1390, 385]], mizu: [[420, 140, 572, 278]], ame: [[430, 108, 570, 250]] };
function assertFacesAndText(spec, id, geometry) {
  const sizes = geometry.size.split(', '), positions = geometry.position.split(', ');
  const imageLayer = sizes.findIndex(size => size === 'cover' || /^auto [\d.]+px$/.test(size));
  assert(imageLayer >= 0, `Unrecognized image layout: ${geometry.size}`);
  const naturalWidth = spec.compact ? 834 : 1672, naturalHeight = spec.compact ? 469 : 941;
  const scale = sizes[imageLayer] === 'cover' ? Math.max(spec.width / naturalWidth, spec.height / naturalHeight) : parseFloat(sizes[imageLayer].split(' ')[1]) / naturalHeight;
  const width = naturalWidth * scale, height = naturalHeight * scale;
  const [px, py] = positions[imageLayer].split(' ').map(value => parseFloat(value) / 100);
  const offsetX = (spec.width - width) * px, offsetY = (spec.height - height) * py;
  const faces = faceBounds[id].map(([x1, y1, x2, y2]) => ({ left: offsetX + x1 / 1672 * width, top: offsetY + y1 / 941 * height, right: offsetX + x2 / 1672 * width, bottom: offsetY + y2 / 941 * height }));
  for (const face of faces) {
    assert(face.left >= 0 && face.top >= 0 && face.right <= spec.width && face.bottom <= spec.height, `${spec.name}/${id}: face cropped: ${JSON.stringify(face)}`);
    assert(!geometry.text.some(rect => rect.right > face.left && rect.left < face.right && rect.bottom > face.top && rect.top < face.bottom), `${spec.name}/${id}: copy covers a face`);
  }
  for (const rect of geometry.text) assert(rect.left >= -1 && rect.right <= spec.width + 1 && rect.top >= -1 && rect.bottom <= spec.height + 1, `${spec.name}/${id}: text clipped: ${JSON.stringify(rect)}`);
  geometry.faces = faces;
}
try {
  for (const spec of specs) {
    const mobile = spec.width < 900;
    const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, isMobile: mobile, hasTouch: mobile, reducedMotion: spec.reduced ? 'reduce' : 'no-preference' });
    await enforceBrowserSecurity(context, base);
    await context.route('https://**', route => route.abort());
    await context.addInitScript(compact => {
      Object.defineProperty(navigator, 'deviceMemory', { get: () => compact ? 2 : 8 });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => compact ? 2 : 8 });
      localStorage.setItem('gaiaSensewareNovel:config:v4', JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
    }, Boolean(spec.compact));
    page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ spec: spec.name, error: error.message }));
    page.on('response', response => { if (response.status() === 404) report.missing.push(response.url()); });
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    const activate = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await activate('#gaia-opening-sound-off');
    if (!spec.reduced) await page.waitForFunction(() => document.querySelector('#gaia-opening')?.classList.contains('is-active'));
    if (spec.playback) {
      for (const [panel, id] of panels) {
        await page.waitForFunction(panel => {
          const element = document.querySelector(`.gaia-vn-panel-${panel}`);
          const timing = element?.getAnimations()[0]?.effect.getComputedTiming();
          return timing?.progress > .64 && timing.progress < .76 && Number(getComputedStyle(element).opacity) > .99;
        }, panel, { timeout: 15000 });
        const geometry = await scanPanel(panel);
        assertFacesAndText(spec, id, geometry);
        await page.screenshot({ path: path.join(output, `${spec.name}-playback-${id}.png`) });
        report.checks.push({ spec: spec.name, phase: 'natural playback', panel, geometry });
      }
      await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
    } else {
      if (!spec.reduced) await activate('#gaia-opening-skip');
      await page.waitForFunction(() => document.querySelector('#gaia-opening-final-menu')?.classList.contains('is-visible'));
    }
    if (mobile) {
      await page.locator('#gaia-opening-route-guide.is-visible').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('#gaia-opening-route-guide').waitFor({ state: 'hidden' });
    }
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.gaiaArtworkQuality), spec.compact ? 'compact' : 'full');
    for (const asset of manifest.assets) {
      const variant = asset.variants.find(v => v.width === (spec.compact ? 834 : 1672));
      const decoded = await page.evaluate(async file => {
        const image = new Image(); image.src = '/' + file; await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      }, selected + variant.file);
      assert.deepEqual(decoded, [variant.width, variant.height]);
    }
    assert(!requests.some(url => /opening-mizuha-keyvisual|opening-amane-keyvisual|opening-keyvisual-v2/.test(url)), 'Old opening artwork must not load');
    const title = await page.evaluate(() => ({ art: getComputedStyle(document.querySelector('.gaia-vn-final-photo')).backgroundImage, overflow: document.documentElement.scrollWidth - innerWidth }));
    assert(title.art.includes('01-starlit-observatory.webp'), 'Unrelated title artwork is preserved');
    assert(title.overflow <= 1);
    await page.screenshot({ path: path.join(output, `${spec.name}-title.png`) });
    await page.mouse.move(0, 0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // Isolate finished panels solely for geometry/visual review; this is not playback evidence.
    for (const [panel, id] of panels) {
      await page.evaluate(panel => {
        document.querySelectorAll('.gaia-vn-panel').forEach(node => { node.style.animation = 'none'; node.style.opacity = '0'; node.style.visibility = 'hidden'; });
        const target = document.querySelector(`.gaia-vn-panel-${panel}`);
        Object.assign(target.style, { opacity: '1', visibility: 'visible', transform: 'none', filter: 'none' });
        target.querySelectorAll('*').forEach(node => { node.style.animation = 'none'; node.classList.remove('is-opening-focus-pending'); });
      }, panel);
      const geometry = await scanPanel(panel);
      assert(geometry.art.includes(`opening-${id}-01${spec.compact ? '-834' : ''}.webp`));
      assert(geometry.copy.left >= -1 && geometry.copy.right <= spec.width + 1 && geometry.copy.top >= -1 && geometry.copy.bottom <= spec.height + 1, JSON.stringify(geometry));
      assertFacesAndText(spec, id, geometry);
      await page.screenshot({ path: path.join(output, `${spec.name}-layout-${id}.png`) });
      report.checks.push({ spec: spec.name, phase: 'static layout', id, geometry });
    }
    if (spec.name === 'mobile') {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.screenshot({ path: path.join(output, 'mobile-rotated-ame.png') });
      assert((await page.locator('.gaia-vn-panel-sora').evaluate(node => getComputedStyle(node).backgroundImage)).includes('opening-ame-01.webp'));
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.evaluate(() => document.querySelectorAll('.gaia-vn-panel, .gaia-vn-panel *').forEach(node => node.removeAttribute('style')));
    if (['pc', 'mobile'].includes(spec.name)) {
      await activate('#gaia-opening-route-story');
      await page.locator('#gaia-story-prologue[data-phase="reading"]').waitFor();
      await activate('#gaia-story-prologue button:first-of-type');
      await page.waitForFunction(() => window.GaiaNovel?.getState().stepId === 'festival_concept_001' && document.querySelector('#novel-layer')?.dataset.entryTransition === 'visible');
      await page.screenshot({ path: path.join(output, `${spec.name}-story-entry.png`) });
      report.checks.push({ spec: spec.name, phase: 'native title → white prologue → first scene' });
    }
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    report.checks.push({ spec: spec.name, phase: 'correct tier, decode, old-art absence, unchanged title, CSP', title });
    await context.close();
    console.log(`${spec.name} passed`);
  }
  // The original and both display encodings must also survive HTTP save byte-for-byte.
  for (const asset of manifest.assets) {
    for (const variant of [{ file: asset.original, sha256: asset.sha256 }, ...asset.variants]) {
      const response = await fetch(`${base}/${selected}${variant.file}`);
      assert(response.ok);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(hash(bytes), variant.sha256);
      fs.mkdirSync(path.join(output, 'downloaded'), { recursive: true });
      fs.writeFileSync(path.join(output, 'downloaded', variant.file), bytes);
    }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.missing, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log('Selected opening artwork checks passed');
