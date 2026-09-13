import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const translations = new Map();
const register = entries => {
  for (const [source, en, zh] of entries) {
    assert.equal(typeof source, 'string');
    assert.equal(typeof en, 'string', `Missing English: ${source}`);
    assert.equal(typeof zh, 'string', `Missing Chinese: ${source}`);
    assert(en.trim() && zh.trim(), `Empty translation: ${source}`);
    assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(en), `Japanese in English: ${source}`);
    assert(!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(zh), `Japanese in Chinese: ${source}`);
    translations.set(source, { en, 'zh-CN': zh });
  }
};
const context = vm.createContext({ GaiaI18n: { register, registerStory(story, entries) {
  const steps = new Map(story.scenes.flatMap(scene => scene.steps).map(step => [step.id, step]));
  const ids = new Set();
  register(entries.map(([id, en, zh]) => {
    assert(!ids.has(id), `Duplicate translated step: ${id}`); ids.add(id);
    assert(steps.has(id), `Unknown translated step: ${id}`);
    return [steps.get(id).text, en, zh];
  }));
} } });
const files = ['novel-story-data.js', 'true-end-data.js', 'gaia-i18n-catalog.js', ...fs.readdirSync('locales').filter(file => file.endsWith('.js')).map(file => `locales/${file}`)];
for (const file of files) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
const missing = [], counts = {};
for (const [kind, story] of [['novel', context.GAIA_NOVEL_STORY], ['ending', context.GAIA_TRUE_END_STORY]]) {
  const visit = (value, key) => {
    // Ending pages are repaginated from the full translated text at runtime.
    if (key.endsWith('.pages')) return;
    if (typeof value === 'string' && /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value)) {
      if (!translations.has(value)) missing.push({ key, value });
    } else if (value && typeof value === 'object') for (const [childKey, child] of Object.entries(value)) visit(child, `${key}.${childKey}`);
  };
  visit(story, kind);
  counts[kind] = story.scenes.flatMap(scene => scene.steps).filter(step => step.text?.trim()).length;
}
assert.deepEqual(missing, [], 'All Japanese story text and metadata must have both translations');
console.log(JSON.stringify({ scope: 'Authored story and metadata (not whole-app UI coverage)', counts, entries: translations.size,
  sourceHashes: Object.fromEntries(files.slice(0, 2).map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])) }, null, 2));
