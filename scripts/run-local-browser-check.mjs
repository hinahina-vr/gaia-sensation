// Keep the preview server in the same Node process as the browser check. This
// avoids suspended background-shell servers contaminating navigation timings.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const target = path.resolve(root, process.argv[2] || '');
if (!target.startsWith(path.join(root, 'scripts') + path.sep) || !target.endsWith('.mjs')) throw new Error('Expected a local scripts/*.mjs check');
const baseline = process.env.GAIA_PREVIEW_BASELINE ? path.resolve(root, process.env.GAIA_PREVIEW_BASELINE) : null;
if (baseline && !baseline.startsWith(root + path.sep)) throw new Error('Baseline must be in the workspace');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const compressed = new Map();
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = ['/world', '/world/'].includes(pathname) ? 'world.html'
      : ['/', '/story', '/story/'].includes(pathname) ? 'index.html'
      : pathname.replace(/^\/+/, '') + (pathname.endsWith('/') ? 'index.html' : '');
    let file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (baseline && fs.existsSync(path.join(baseline, relative))) file = path.join(baseline, relative);
    let body = fs.readFileSync(file);
    const ext = path.extname(file);
    const headers = { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (process.env.GAIA_PREVIEW_COMPRESSION === 'br' && /\bbr\b/.test(req.headers['accept-encoding'] || '') && ['.html', '.js', '.mjs', '.css', '.json', '.svg'].includes(ext)) {
      if (!compressed.has(file)) compressed.set(file, brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }));
      body = compressed.get(file); headers['Content-Encoding'] = 'br'; headers.Vary = 'Accept-Encoding';
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers).end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
process.env.GAIA_BASE_URL = `http://127.0.0.1:${server.address().port}`;
console.log(`Local check: ${process.env.GAIA_BASE_URL}${baseline ? ' (baseline overlay)' : ''}`);
try { await import(pathToFileURL(target).href); }
finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
