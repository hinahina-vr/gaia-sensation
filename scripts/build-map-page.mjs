import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n?/g,'\n');
// One maintained application shell; the map URL owns a fresh document and boot.
const html=source.replace('data-build-profile="release"','data-build-profile="release" data-gaia-page="world"')
  .replace('    <meta charset="UTF-8" />','    <meta charset="UTF-8" />\n    <base href="/" />\n    <script src="./map-page-entry.js?v=world-entry-20261014"></script>\n    <link rel="stylesheet" href="./map-page-entry.css?v=world-entry-20261014" />');
assert.notEqual(html,source);assert(html.includes('data-gaia-page="world"'));
const target=path.join(root,'world.html');
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8').replace(/\r\n?/g,'\n'),html,'world.html is stale; run npm run build:map-page');
else fs.writeFileSync(target,html);
console.log(JSON.stringify({status:process.argv.includes('--check')?'passed':'generated',page:'world.html',bytes:Buffer.byteLength(html)}));
