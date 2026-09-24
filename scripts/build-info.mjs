import fs from 'node:fs';
import path from 'node:path';
import { readBuildInfo } from './lib/build-info.mjs';

const root = path.resolve(import.meta.dirname, '..');
const info = readBuildInfo(root);
if (!info.commit) throw new Error('Cannot identify the source commit; build from a Git checkout or Cloudflare Pages build.');
// Generated metadata is not committed: a fixed SHA would identify the previous build.
fs.writeFileSync(path.join(root, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`);
console.log(`Build: ${info.shortCommit} (${info.worktree})\nSHA: ${info.commit}`);
