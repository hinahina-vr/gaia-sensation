import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const translations = new Map();
const context = vm.createContext({ GaiaI18n: { register(rows) {
  for (const row of rows) {
    assert.equal(row.length, 3);
    assert(row.every(value => typeof value === 'string' && value.trim()));
    assert(!row.some(value => /undefined|null/.test(value)));
    if (translations.has(row[0])) assert.deepEqual([...row], translations.get(row[0]));
    translations.set(row[0], [...row]);
  }
} } });
vm.runInContext(fs.readFileSync(new URL('../src/exploration/map-data-intro-catalog.js', import.meta.url), 'utf8'), context);
const { entries, status, messages } = context.GaiaMapDataIntro;
assert.deepEqual(Object.keys(entries).sort(), Array.from({ length: 71 }, (_, i) => String(i + 1).padStart(2, '0')).sort());
assert(Object.isFrozen(entries));
for (const [number, entry] of Object.entries(entries)) {
  assert.equal(entry.number, number);
  assert(Object.isFrozen(entry));
  for (const key of ['subject', 'reading', 'source']) assert(translations.has(entry[key]), `${number}: ${key}`);
  for (const key of ['subject', 'reading']) for (const text of translations.get(entry[key]))
    assert.doesNotMatch(text, /ではありません|ではなく|とは異な|できません|分かりません|していません|\bnot\b|并非|并不|并未|不是/iu,
      `${number}: explain the data directly, without negative disclaimers`);
  const expected = +number <= 5 ? number === '04' ? 'firms' : 'planet'
    : +number >= 70 ? 'food' : +number >= 31 ? 'records' : +number >= 15 && +number <= 20 ? 'live' : 'saved';
  assert.equal(entry.kind, expected);
}
const planet = sourceState => ({ GaiaPlanetSignals: { getState: () => ({ sourceState }) } });
assert.equal(status('01', {}), messages.loading);
assert.equal(status('01', planet('LIVE')), '');
assert.equal(status('01', planet('LIVE CACHE')), messages.cached);
assert.equal(status('01', planet('SAVED SNAPSHOT')), messages.saved);
assert.equal(status('01', planet('SAVED VALUES')), messages.windSample);
assert.equal(status('03', planet('SAVED VALUES')), messages.sample);
assert.equal(status('02', planet('ERROR')), messages.error);
const firms = (source, error = false) => ({ GaiaFirmsExhibit: { getState: () => ({ source }) },
  document: { querySelector: () => ({ dataset: { realtimeState: error ? 'error' : 'ready' } }) } });
assert.equal(status('04', firms(null)), messages.loading);
assert.equal(status('04', firms('nasa-firms-modis')), messages.cached);
assert.equal(status('04', firms('saved')), messages.saved);
assert.equal(status('04', firms('saved', true)), messages.error);
const live = (value, extra = {}) => ({ GaiaLiveExhibits: { definitions: [{ number: '15', key: 'wind' }] },
  GaiaLiveData: { getState: () => ({ connected: true, measurements: { wind: { value } }, ...extra }) } });
assert.equal(status('15', live(null, { requestState: 'loading' })), messages.loading);
assert.equal(status('15', live(null, { requestState: 'unavailable' })), messages.error);
assert.equal(status('15', live(0)), '');
assert.equal(status('15', live(5, { connected: false })), messages.saved);
assert.equal(status('15', live(5, { requestState: 'unavailable' })), messages.cached);
for (const [number, provider] of [['31', 'GaiaMarineCod'], ['70', 'GaiaFoodExhibits']]) {
  for (const [dataState, expected] of [['loading', messages.loading], ['error', messages.error], ['ready', '']])
    assert.equal(status(number, { [provider]: { getState: () => ({ dataState }) } }), expected);
}
assert.equal(status('06', planet('ERROR')), '');
assert.equal(status('99', {}), '');
assert.equal(messages.sample, '演出用の参考値を表示しています。');
assert.equal(messages.windSample, messages.sample);
assert.equal(messages.error, 'データ取得エラー');
const loader = fs.readFileSync(new URL('../gaia-mode-loader.js', import.meta.url), 'utf8');
assert(loader.indexOf('./app-content.js') < loader.indexOf('./src/exploration/map-data-intro-catalog.js'));
assert(loader.indexOf('./src/exploration/map-data-intro-catalog.js') < loader.indexOf('./app.js'));
console.log(`PASS: 71 introductions, ${translations.size} translated messages, provider states, ordered loading`);
