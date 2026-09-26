// Run with node --experimental-vm-modules. DOM/network are modeled here;
// check-mode-loader-browser.mjs covers the real browser integration separately.
import assert from 'node:assert/strict';
import { readStartupBaseline } from './lib/startup-baseline.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../gaia-mode-loader.js', import.meta.url), 'utf8');
// Cache revisions may change for subsequent fixes; actual assets and their
// order must still match. Entry readiness is tested separately below.
const baseline = readStartupBaseline('gaia-mode-loader.js')
  .replace('app.js?v=entry-bottom', 'app.js?v=entry-ready-20260922-entry-bottom')
  // The catalog is intentionally inserted before app.js consumes it.
  .replace(/("\.\/app-content\.js[^"\n]*",)/u, '$1\n        "./src/exploration/map-data-intro-catalog.js",');
const routeSource = fs.readFileSync(new URL('../map-exhibit-route.js', import.meta.url), 'utf8');
const turn = () => new Promise(resolve => setImmediate(resolve));
const until = async predicate => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await turn();
  }
  assert.fail('Loader did not settle');
};

function fixture(code = source, { url = 'https://gaia.test/', fail, ready = 'true' } = {}) {
  const events = [], pending = [], nodes = [], errors = [];
  class Element extends EventTarget {
    dataset = {};
    attributes = new Map();
    selectors = new Set();
    setAttribute(key, value) { this.attributes.set(key, value); }
    removeAttribute(key) { this.attributes.delete(key); }
    closest(selector) { return this.selectors.has(selector) ? this : null; }
    remove() { nodes.splice(nodes.indexOf(this), 1); }
    click() { fire(document, 'click', this); }
  }
  class Template extends Element {
    content = {};
    replaceWith() { events.push(`template:${this.id}`); templates.delete(this.id); }
  }
  const templates = new Map();
  for (const name of ['exploration', 'story', 'gx', 'space', 'sound', 'character']) {
    const element = new Template(); element.id = `gaia-template-${name}`;
    templates.set(element.id, element);
  }
  function append(node) {
    const address = node.href || node.src;
    const kind = node.dataset.gaiaLazyAsset;
    nodes.push(node); events.push(`append:${kind}:${address}`);
    if (kind === 'preload') return;
    if (kind === 'script') assert.equal(node.async, false);
    const finish = () => {
      if (fail?.(node)) { events.push(`error:${address}`); node.onerror(); }
      else { events.push(`loaded:${kind}:${address}`); node.onload(); }
    };
    pending.push(finish);
    queueMicrotask(() => { if (!fixtureState.hold) pending.shift()?.(); });
  }
  const document = Object.assign(new EventTarget(), {
    baseURI: 'https://gaia.test/', documentElement: { dataset: { gaiaAppReady: ready, gaiaEntryReady: ready } },
    querySelector: () => null, getElementById: id => templates.get(id),
    head: { append }, body: { append },
    createElement(tag) {
      const node = new Element(); node.tag = tag;
      for (const key of ['href', 'src']) Object.defineProperty(node, key, {
        get() { return this[`_${key}`]; },
        set(value) { this[`_${key}`] = new URL(value, document.baseURI).href; },
      });
      return node;
    },
    get scripts() { return nodes.filter(node => node.tag === 'script'); },
    get styleSheets() { return nodes.filter(node => node.rel === 'stylesheet'); },
  });
  // Object.assign snapshots getters, so expose the live browser collections.
  Object.defineProperties(document, {
    scripts: { get: () => nodes.filter(node => node.tag === 'script') },
    styleSheets: { get: () => nodes.filter(node => node.rel === 'stylesheet') },
  });
  const window = Object.assign(new EventTarget(), { location: new URL(url), setTimeout, clearTimeout });
  const fixtureState = { hold: false };
  const context = vm.createContext({ document, window, Element, HTMLElement: Element,
    HTMLTemplateElement: Template, URL, URLSearchParams, CustomEvent,
    performance: { mark() {}, measure() {} }, console: { error: error => errors.push(error.message) },
  });
  // Read the manifest without changing its values or any production load path.
  code = code.replace('const assetPromises = new Map();', 'globalThis.manifest = groups; const assetPromises = new Map();');
  vm.runInContext(routeSource, context);
  vm.runInContext(code, context, { importModuleDynamically: async address => {
    events.push(`module:${address}`);
    return import('node:path');
  } });
  return { context, document, window, events, nodes, errors, pending, fixtureState, Element,
    loader: context.GaiaModeLoader,
    release() { fixtureState.hold = false; while (pending.length) pending.shift()(); },
  };
}

function fire(host, type, target, detail) {
  const event = new CustomEvent(type, { cancelable: true, detail });
  if (target) Object.defineProperty(event, 'target', { value: target });
  host.dispatchEvent(event);
  return event;
}

const withoutCacheRevisions = value => JSON.parse(JSON.stringify(value).replace(/\?v=[\w-]+/gu, ''));
const originalManifest = JSON.parse(JSON.stringify(fixture(baseline).context.manifest));
assert.deepEqual(withoutCacheRevisions(fixture().context.manifest), withoutCacheRevisions(originalManifest),
  'All asset paths, template lists, shared CSS and evaluation order must remain unchanged');

let checks = 1;
for (const group of Object.keys(originalManifest)) {
  const logs = [];
  for (const code of [baseline, source]) {
    const f = fixture(code);
    const first = f.loader.load(group);
    assert.equal(first, f.loader.load(group), 'Concurrent callers share the same promise');
    await first;
    assert.equal(f.loader.isLoaded(group), true);
    const count = f.events.length;
    await f.loader.load(group);
    assert.equal(f.events.length, count, 'Loaded groups never remount or reload');
    logs.push(f.events);
  }
  assert.deepEqual(withoutCacheRevisions(logs[1]), withoutCacheRevisions(logs[0]), `${group}: observable asset lifecycle must match baseline`);
  checks++;
}

const routes = [
  ['', []], ['#story', ['story']], ['/story/', ['story']], ['/story/#character', ['story']],
  ['#top', ['exploration']], ['#world-01', ['exploration']], ['#world-15', ['exploration']],
  ['#sound', ['sound']], ['#character', ['exploration', 'character']], ['#tour', ['exploration', 'tour']],
  ...['source', 'concept', 'earth', 'japan', 'data'].map(hash => [`#${hash}`, ['exploration']]),
  ['?space', ['exploration', 'space']], ['?space#sound', ['sound']], ['#unknown', []],
];
for (const [route, expected] of routes) {
  for (const code of [baseline, source]) {
    const f = fixture(code, { url: new URL(route, 'https://gaia.test/').href });
    const routed = code === source && ['#top', '#character'].includes(route)
      ? expected.map(group => group === 'exploration' ? 'entry' : group) : expected;
    await until(() => routed.every(group => f.loader.isLoaded(group)));
    await turn();
    assert.deepEqual([...Object.keys(originalManifest), 'entry'].filter(group => f.loader.isLoaded(group)).sort(), [...routed].sort(), route);
    assert.equal(!!f.context.__gaiaInitialViewReady, expected.length > 0);
    if (route === '#tour') {
      const explorationEnd = f.events.findLastIndex(event => event.startsWith('loaded:script:') && event.includes('map-responsive-layout.js'));
      const tourStart = f.events.findIndex(event => event.startsWith('append:') && event.includes('guided-tour'));
      assert(explorationEnd < tourStart, 'Tour must start after exploration completes');
    }
  }
  checks++;
}

for (const kind of ['style', 'script']) {
  let failed = false;
  const f = fixture(source, { fail: node => {
    if (!failed && node.dataset.gaiaLazyAsset === kind) { failed = true; return true; }
    return false;
  } });
  await assert.rejects(f.loader.load('character'), /failed:/);
  assert.equal(f.loader.isLoaded('character'), false);
  await f.loader.load('character');
  assert.equal(f.loader.isLoaded('character'), true, 'A failed DOM asset/group must be retryable');
  assert.equal(f.events.filter(event => event.startsWith('template:')).length, 1, 'Retry must not remount a consumed template');
  checks++;
}

{
  const f = fixture();
  await Promise.all(['character', 'sound', 'story'].map(f.loader.load));
  const appends = f.events.filter(event => event.startsWith('append:') && !event.startsWith('append:preload:'));
  assert.equal(new Set(appends).size, appends.length, 'Shared resources deduplicate across concurrent groups');
  await assert.rejects(f.loader.load('unknown'), /Unknown GAIA mode group/);
  checks++;
}
{
  const f = fixture(); f.fixtureState.hold = true;
  const trigger = new f.Element(); trigger.selectors.add('[data-sound-gallery-open]');
  let delivered = 0; f.document.addEventListener('click', () => delivered++);
  trigger.click(); trigger.click();
  assert.equal(trigger.dataset.gaiaLazyPending, 'true');
  assert.equal(trigger.attributes.get('aria-busy'), 'true');
  assert.equal(delivered, 0, 'Pending clicks must not reach mode handlers');
  f.release(); await until(() => delivered === 1);
  assert.equal(trigger.dataset.gaiaLazyPending, undefined);
  assert.equal(trigger.attributes.has('aria-busy'), false);
  trigger.click(); assert.equal(delivered, 2, 'Loaded click passes through normally');
  checks++;
}
for (const eventType of ['pointerover', 'focusin']) {
  const f = fixture(); const trigger = new f.Element();
  trigger.selectors.add('[data-character-gallery-open]');
  fire(f.document, eventType, trigger);
  await until(() => f.loader.isLoaded('character'));
  assert.equal(trigger.dataset.gaiaLazyPending, undefined, 'Warmup must not present a busy click');
  checks++;
}
{
  const f = fixture(source, { ready: '' });
  let complete = false;
  const loading = f.loader.load('exploration').then(() => { complete = true; });
  await until(() => f.events.some(event => event.startsWith('loaded:script:') && event.includes('map-responsive-layout.js')));
  await turn(); assert.equal(complete, false, 'Runtime readiness is a separate gate from asset loading');
  fire(f.window, 'gaia:app-ready'); await loading; assert(complete);
  checks++;
}
{
  const f = fixture(); const detail = { mode: 2 }; const received = [];
  f.window.addEventListener('gaia:novel-open-at-mode', event => received.push(event.detail));
  fire(f.window, 'gaia:novel-open-at-mode', null, detail);
  await until(() => received.length === 1);
  assert.equal(received[0], detail, 'Deferred events retain detail identity and dispatch once');
  checks++;
}
{
  let shouldFail = true;
  const f = fixture(source, { fail: node => shouldFail && node.dataset.gaiaLazyAsset === 'script' });
  const trigger = new f.Element(); trigger.selectors.add('[data-sound-gallery-open]');
  let delivered = 0; f.document.addEventListener('click', () => delivered++);
  trigger.click();
  await until(() => !trigger.dataset.gaiaLazyPending);
  assert.equal(delivered, 0);
  assert.equal(trigger.attributes.has('aria-busy'), false, 'Failure restores the interactive control');
  shouldFail = false; trigger.click(); await until(() => delivered === 1);
  checks++;
}
{
  const f = fixture();
  for (const url of f.context.manifest.sound.styles) {
    const node = f.document.createElement('link'); node.rel = 'stylesheet'; node.href = url; f.nodes.push(node);
  }
  for (const url of f.context.manifest.sound.scripts) {
    const node = f.document.createElement('script'); node.src = url; f.nodes.push(node);
  }
  await f.loader.load('sound');
  assert(!f.events.some(event => event.startsWith('append:')), 'Already-present resources must be reused');
  checks++;
}
{
  const f = fixture(source, { ready: '' });
  let mapReady = false;
  const entry = f.loader.load('entry');
  const map = f.loader.load('exploration').then(() => { mapReady = true; });
  await until(() => f.events.some(event => event.startsWith('loaded:script:') && event.includes('map-responsive-layout.js')));
  await turn();
  fire(f.window, 'gaia:entry-ready'); await entry;
  assert.equal(mapReady, false, 'Entry may finish before shader initialization, but map must wait');
  const appends = f.events.filter(event => event.startsWith('append:'));
  assert.equal(new Set(appends).size, appends.length, 'Entry and exploration share their assets');
  fire(f.window, 'gaia:app-ready'); await map;
  checks++;
}
console.log(`Mode loader lifecycle PASS: ${checks} checks; 8 manifests, 18 direct routes and independent entry/map readiness`);
