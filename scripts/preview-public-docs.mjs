// Local layout preview of public Markdown; not a GitHub-rendering equivalence test.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'artifacts/public-docs-20260913');
fs.mkdirSync(out, { recursive: true });
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const inline = value => escape(value).replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
  .replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2">$1</a>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
function render(source) {
  let code = false, table = false;
  return source.split(/\r?\n/).map(line => {
    if (line.startsWith('```')) { code = !code; return code ? '<pre>' : '</pre>'; }
    if (code) return escape(line) + '\n';
    if (line.startsWith('|')) {
      if (/^\|[-| :]+\|$/.test(line)) return '';
      const prefix = table ? '' : '<table>'; table = true;
      return prefix + '<tr>' + line.slice(1, -1).split(/(?<!\\)\|/).map(cell => `<td>${inline(cell)}</td>`).join('') + '</tr>';
    }
    const prefix = table ? '</table>' : ''; table = false;
    const heading = line.match(/^(#{1,6}) (.*)/);
    return prefix + (heading ? `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>` : line ? `<p>${inline(line)}</p>` : '');
  }).join('\n') + (table ? '</table>' : '');
}
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'docs.local') return route.abort();
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) return route.abort();
    await route.fulfill({ path: target });
  });
  for (const file of ['docs/README.md', 'docs/CONTEST_2026_SUBMISSION.md', 'docs/DATA_SOURCES.md', 'docs/MEDIA_RIGHTS_LEDGER.md']) {
    await page.setContent(`<base href="http://docs.local/${file}"><style>body{font:16px/1.7 sans-serif;color:#243547;max-width:1080px;margin:32px auto;padding:0 24px}h1{font-size:28px}h2{margin-top:32px}a{color:#0969da}table{border-collapse:collapse;width:100%;font-size:14px}td{border:1px solid #ccd4dd;padding:9px;overflow-wrap:anywhere}pre{background:#edf2f5;padding:12px;white-space:pre-wrap}img{max-width:100%}code{background:#edf2f5}</style>${render(fs.readFileSync(path.join(root, file), 'utf8'))}`);
    await page.screenshot({ path: path.join(out, path.basename(file, '.md') + '.png'), fullPage: false });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error(`Horizontal overflow: ${file}`);
  }
  console.log(JSON.stringify({ status: 'passed', preview: out, scope: 'Local simplified Markdown preview in Chrome, 1366x900; not GitHub rendering' }));
} finally { await browser.close(); }
