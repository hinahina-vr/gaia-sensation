// Follow the public documentation links, not GitHub's repository file browser.
// Internal histories remain in the repository but must not be in this reading path.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const publicMarkdown = new Set([
  'README.md', 'docs/README.md', 'docs/CONTEST_2026_SUBMISSION.md',
  'docs/ARCHITECTURE.md', 'docs/DATA_SOURCES.md', 'docs/MEDIA_RIGHTS_LEDGER.md',
  'PRIVACY.md', 'SECURITY.md', 'LICENSE.md', 'docs/REGION-CODE-SOURCES.md',
  'data/japan-prefectures-NOTICE.md',
]);
const slug = text => text.toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
const visited = new Set(), queue = ['README.md'];
let links = 0;
while (queue.length) {
  const file = queue.shift();
  if (visited.has(file)) continue;
  assert(publicMarkdown.has(file), `Internal document reachable from README: ${file}`);
  visited.add(file);
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert(!/SUBMISSION_STATUS|OWNER_DECISION|HANDOFF|artifacts\/|[A-Z]:[\\/]/.test(source), `Internal memo reference in ${file}`);
  // Current public docs use inline Markdown links. Recognise balanced URL
  // parentheses, including scientific download names, without following prose.
  const pattern = /\]\(((?:[^\s()]|\([^()]*\))+?)\)/g;
  for (const match of source.matchAll(pattern)) {
    const href = match[1].replace(/^<|>$/g, '');
    if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) continue;
    const [url, fragment] = href.split('#');
    const target = url ? path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(url))) : file;
    assert(!target.startsWith('../'), `Link escapes repository: ${file} -> ${href}`);
    assert(fs.existsSync(path.join(root, target)), `Broken link: ${file} -> ${href}`);
    assert(!/internal\/|rights-review\.json|media-rights-ledger\.json|SUBMISSION_STATUS|OWNER_DECISION|HANDOFF|artifacts\//.test(target), `Internal target: ${file} -> ${href}`);
    links++;
    if (target.endsWith('.md')) {
      queue.push(target);
      if (fragment) {
        const document = fs.readFileSync(path.join(root, target), 'utf8');
        const headings = [...document.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => slug(m[1]));
        assert(headings.includes(decodeURIComponent(fragment)), `Missing heading: ${file} -> ${href}`);
      }
    }
  }
}
assert(visited.has('docs/MEDIA_RIGHTS_LEDGER.md'), 'Public provenance must remain reachable');
assert(visited.has('PRIVACY.md') && visited.has('SECURITY.md'), 'Visitor safety policies must remain reachable');
console.log(JSON.stringify({ status: 'passed', documents: [...visited], localLinks: links, scope: 'README recursive local Markdown links; external sites and GitHub file browsing excluded' }, null, 2));
