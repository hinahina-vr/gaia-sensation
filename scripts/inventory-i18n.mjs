import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const context = vm.createContext({});
for (const file of ['novel-story-data.js', 'true-end-data.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const unique = new Map();
const walk = (value, path) => {
  if (typeof value === 'string' && japanese.test(value)) {
    if (!unique.has(value)) unique.set(value, { source: value, hash: createHash('sha256').update(value).digest('hex').slice(0, 16), paths: [] });
    unique.get(value).paths.push(path);
  } else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
};
for (const [kind, story] of [['novel', context.GAIA_NOVEL_STORY], ['ending', context.GAIA_TRUE_END_STORY]]) {
  for (const scene of story.scenes) {
    console.log(`\n${kind}/${scene.id} (${scene.steps.length})`);
    for (const step of scene.steps) console.log(JSON.stringify({ id: step.id, speaker: step.speaker, text: step.text, pages: step.pages, choices: step.choices }));
  }
  walk(story, kind);
}
fs.mkdirSync('artifacts/i18n', { recursive: true });
fs.writeFileSync('artifacts/i18n/story-sources.json', JSON.stringify([...unique.values()], null, 2));
console.log(`Unique Japanese story strings: ${unique.size}`);
