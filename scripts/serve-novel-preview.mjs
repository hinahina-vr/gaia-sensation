import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.GAIA_PREVIEW_HOST || "127.0.0.1";
const port = Number(process.env.GAIA_PREVIEW_PORT || process.argv[2] || 4173);
// Opt-in transport simulation for performance QA; the default stays raw.
const useBrotli = process.env.GAIA_PREVIEW_COMPRESSION === "br";
// Read-only overlay for before/after performance QA; assets not captured in the
// snapshot still come from this workspace. Never changes the served files.
const baselineRoot = process.env.GAIA_PREVIEW_BASELINE
  ? path.resolve(root, process.env.GAIA_PREVIEW_BASELINE) : null;
if (baselineRoot && !baselineRoot.startsWith(`${root}${path.sep}`)) {
  throw new Error('GAIA_PREVIEW_BASELINE must be inside the workspace');
}
const compressedFiles = new Map();
const compressible = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".topojson", ".geojson"]);
const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"],
  [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".webp", "image/webp"], [".gif", "image/gif"],
  [".mp3", "audio/mpeg"], [".wav", "audio/wav"], [".woff2", "font/woff2"], [".ico", "image/x-icon"],
]);

const resolveRequest = (requestUrl) => {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${host}:${port}`).pathname);
  if (pathname === "/" || pathname === "/story" || pathname === "/story/") return path.join(root, "index.html");
  const relative = pathname.replace(/^\/+/, "");
  const candidate = path.resolve(root, relative);
  if (!candidate.startsWith(`${root}${path.sep}`)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    const index = path.join(candidate, "index.html");
    if (fs.existsSync(index) && fs.statSync(index).isFile()) return index;
  }
  return null;
};

const server = http.createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method || "")) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  let file = resolveRequest(request.url || "/");
  if (file && baselineRoot) {
    const saved = path.join(baselineRoot, path.relative(root, file));
    if (fs.existsSync(saved) && fs.statSync(saved).isFile()) file = saved;
  }
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end("Not found");
    return;
  }
  const stats = fs.statSync(file);
  const baseHeaders = {
    "Content-Type": mime.get(path.extname(file).toLowerCase()) || "application/octet-stream",
    "Cache-Control": "no-store",
    "Accept-Ranges": "bytes",
    ...(useBrotli ? { Vary: "Accept-Encoding" } : {}),
  };
  const rangeMatch = String(request.headers.range || "").match(/^bytes=(\d*)-(\d*)$/u);
  if (rangeMatch) {
    const start = rangeMatch[1] ? Number(rangeMatch[1]) : 0;
    const end = rangeMatch[2] ? Math.min(Number(rangeMatch[2]), stats.size - 1) : stats.size - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= stats.size) {
      response.writeHead(416, { ...baseHeaders, "Content-Range": `bytes */${stats.size}` });
      response.end();
      return;
    }
    response.writeHead(206, {
      ...baseHeaders,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
    });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(file, { start, end }).pipe(response);
    return;
  }
  if (useBrotli && compressible.has(path.extname(file).toLowerCase())
    && /(?:^|,)\s*br\s*(?:,|$)/u.test(request.headers["accept-encoding"] || "")) {
    let cached = compressedFiles.get(file);
    if (!cached || cached.mtime !== stats.mtimeMs || cached.size !== stats.size) {
      cached = { mtime: stats.mtimeMs, size: stats.size,
        body: brotliCompressSync(fs.readFileSync(file), { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }) };
      compressedFiles.set(file, cached);
    }
    response.writeHead(200, { ...baseHeaders, "Content-Encoding": "br", "Content-Length": cached.body.length });
    response.end(request.method === "HEAD" ? undefined : cached.body);
    return;
  }
  response.writeHead(200, { ...baseHeaders, "Content-Length": stats.size });
  if (request.method === "HEAD") response.end();
  else fs.createReadStream(file).pipe(response);
});

server.listen(port, host, () => console.log(`GAIA SENSATION preview: http://${host}:${port}/story`));
