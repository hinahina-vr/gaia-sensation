import assert from 'node:assert/strict';
import { classify, parseTree, prepare } from './prepare-production-repository.mjs';

const cases = [
  ['.env', 'exclude'], ['sensor-platform/.dev.vars', 'exclude'],
  ['sensor-platform/.dev.vars.example', 'candidate'], ['AGENTS.md', 'exclude'],
  ['.codex/settings.json', 'exclude'], ['assets/modes/guide.webp', 'candidate'],
  ['artifacts/gx-setting-bible/01-world.png', 'candidate'],
  ['artifacts/qa/screen.png', 'review'], ['output/pdf/book.pdf', 'review'],
  ['docs/internal/RIGHTS_SCOPE.md', 'review'], ['docs/rights-review.json', 'review'],
  ['docs/QA_WHITEBOARD.md', 'review'], ['docs/DATA_SOURCES.md', 'candidate'],
  ['wrangler.jsonc', 'review'], ['.github/workflows/check.yml', 'review'],
  ['assets/opening-selected-20260912/scene.webp', 'review'],
  ['scripts/check-release-rights.mjs', 'candidate'],
  ['data/sources/example.csv', 'review'], ['data/runtime/example.json.gz', 'review'],
  ['data/annual/2025.json', 'review'], ['data/gbif-rights.json', 'review'],
];
for (const [file, expected] of cases) assert.equal(classify(file)[0], expected, file);
assert.equal(classify('link', '120000')[0], 'review');
const entries = parseTree('100644 blob abc 12\tdata/日本 語.json\0');
assert.equal(entries[0].path, 'data/日本 語.json');
assert.equal(entries[0].bytes, 12);
assert.throws(() => parseTree('100644 blob abc 12\t../escape\0'));
assert.throws(() => prepare('.', '--all'));
console.log(JSON.stringify({ status: 'passed', classificationCases: cases.length, parserAndSafetyAssertions: 5, networkOrExport: false }));
