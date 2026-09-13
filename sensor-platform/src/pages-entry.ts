import sensorPlatform from "./index";
import { handleLiveSenseware } from "./live-senseware";
import { browserSecurityHeaders } from "./browser-security";

interface PagesEnv extends Env {
  ASSETS: Fetcher;
}

const NON_PUBLIC_FILES = new Set([
  "/.codex-write-probe",
  "/.gitattributes",
  "/.gitignore",
  "/AGENTS.md",
  "/CHARACTER-DESIGN.md",
  "/package.json",
  "/README.md",
  "/wrangler.jsonc",
].map((path) => path.toLowerCase()));

const NON_PUBLIC_PREFIXES = [
  "/.github/",
  "/.tmp/",
  "/.tmp-character-copy/",
  "/.wrangler/",
  "/artifacts/",
  "/contest-limited/",
  "/docs/",
  "/node_modules/",
  "/output/",
  "/scripts/",
  "/sensor-platform/",
  "/smartcity-sensor-starter-kit/",
  "/story/",
  "/tests/",
  "/tmp/",
];

const PUBLIC_CHARACTER_BIBLE_PATHS = new Set([
  "/artifacts/gx-setting-bible/01-three-ecologies-character-master.png",
  "/artifacts/gx-setting-bible/02-first-meeting-zushi-coast.png",
  "/artifacts/gx-setting-bible/03-gaia-senseware-installation.png",
  "/artifacts/gx-setting-bible/04-life-earth-coevolution.png",
  "/artifacts/gx-setting-bible/05-anthropocene-planetary-force.png",
  "/artifacts/gx-setting-bible/06-ai-earth-coevolution.png",
  "/artifacts/gx-setting-bible/07-three-ecologies-world.png",
  "/artifacts/gx-setting-bible/08-old-os-to-gx.png",
  "/artifacts/gx-setting-bible/09-next-stage-civilization.png",
  "/artifacts/gx-setting-bible/10-final-keyvisual.png",
]);

const isNonPublicPath = (pathname: string): boolean => {
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {}
  const normalizedPath = decodedPath.toLowerCase();
  if (PUBLIC_CHARACTER_BIBLE_PATHS.has(normalizedPath)) return false;
  return NON_PUBLIC_FILES.has(normalizedPath)
    || NON_PUBLIC_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
};

const nonPublicResponse = (): Response => new Response("Not Found", {
  status: 404,
  headers: {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  },
});

const handler = {
  async fetch(request: Request, env: PagesEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (isNonPublicPath(url.pathname)) return nonPublicResponse();
    const liveResponse = await handleLiveSenseware(request, env, ctx);
    if (liveResponse) return liveResponse;
    if (url.pathname.startsWith("/api/")) return sensorPlatform.fetch(request, env);
    const assetResponse = await env.ASSETS.fetch(request);
    if (!/^\/assets\/audio\/.+\.(?:mp3|wav)$/u.test(url.pathname) || !assetResponse.ok) return assetResponse;

    const headers = new Headers(assetResponse.headers);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    const range = request.headers.get("Range")?.match(/^bytes=(\d*)-(\d*)$/u);
    if (!range || assetResponse.status === 206 || request.method === "HEAD") {
      return new Response(assetResponse.body, { status: assetResponse.status, statusText: assetResponse.statusText, headers });
    }

    const bytes = await assetResponse.arrayBuffer();
    const suffixLength = range[1] ? 0 : Number(range[2]);
    const start = range[1] ? Number(range[1]) : Math.max(0, bytes.byteLength - suffixLength);
    const end = range[2] && range[1] ? Math.min(Number(range[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= bytes.byteLength) {
      headers.set("Content-Range", `bytes */${bytes.byteLength}`);
      headers.set("Content-Length", "0");
      return new Response(null, { status: 416, headers });
    }
    const chunk = bytes.slice(start, end + 1);
    headers.set("Content-Range", `bytes ${start}-${end}/${bytes.byteLength}`);
    headers.set("Content-Length", String(chunk.byteLength));
    return new Response(chunk, { status: 206, headers });
  },
} satisfies ExportedHandler<PagesEnv>;

export default {
  async fetch(request: Request, env: PagesEnv, ctx: ExecutionContext): Promise<Response> {
    const response = await handler.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(browserSecurityHeaders)) {
      if (name === "Referrer-Policy" && headers.get(name) === "no-referrer") continue;
      headers.set(name, value);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
} satisfies ExportedHandler<PagesEnv>;
