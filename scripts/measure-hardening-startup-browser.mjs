import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright-core";
const root = path.resolve(import.meta.dirname, "..");
const reference = process.argv[2] || "43daee7";
const output = path.resolve(process.argv[3] || "artifacts/hardening/startup");
const networkProfile = process.argv[4] === "network";
const trials = networkProfile ? 2 : 3;
fs.mkdirSync(output, { recursive: true });
const originals = new Map(["index.html", "app.js", "gaia-mode-loader.js", "statistics-lab.js", "data/gaia-signals.json"].map(file => [file, execFileSync("git", ["show", `${reference}:${file}`], { cwd: root, maxBuffer: 30_000_000, windowsHide: true })]));
let variant = "before";
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".wav": "audio/wav", ".mp3": "audio/mpeg" };
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  if (pathname.startsWith("/api/")) { response.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" }); return response.end('{"error":"isolated benchmark: offline"}'); }
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); return response.end(); }
  const body = variant === "before" && originals.has(relative) ? originals.get(relative) : fs.readFileSync(file);
  const isManifest = relative.endsWith("gaia-manifest.json");
  const cache = path.extname(file) === ".html" || isManifest ? "no-cache" : "public, max-age=86400";
  response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Content-Length": body.length, "Cache-Control": cache });
  response.end(body);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.GAIA_BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-precise-memory-info"] });
const report = { status: "running", reference, startedAt: new Date().toISOString(), conditions: `Same local Chrome, uncompressed HTTP; ${trials} trials each; cold browser cache and warm navigation after about:blank (inspect resource transfer sizes for cache hits). ${networkProfile ? "Emulated 80ms latency, 20Mbps download, 5Mbps upload." : "Unthrottled loopback network."} External providers blocked through CDP, not Playwright routing. Mobile is 390px plus 4x CPU emulation, not physical hardware. No LCP/INP field percentile claims.`, runs: [], errors: [] };
try {
  for (const width of [1440, 390]) for (let trial = 0; trial < trials; trial++) for (const version of trial % 2 ? ["after", "before"] : ["before", "after"]) {
    variant = version;
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
    await context.addInitScript(() => {
      if (!/^https?:$/.test(location.protocol)) return;
      sessionStorage.setItem("gaia:mode-entry-guide:map:v5", "seen"); localStorage.setItem("gaia-senseware-bgm-muted", "true");
      window.__longTasks = [];
      new PerformanceObserver(list => { for (const entry of list.getEntries()) __longTasks.push(entry.duration); }).observe({ type: "longtask", buffered: true });
    });
    const page = await context.newPage();
    page.on("pageerror", error => report.errors.push(`${width}/${version}: ${error.message}`));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable"); await cdp.send("Network.clearBrowserCache");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
    if (networkProfile) await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 80, downloadThroughput: 2_500_000, uploadThroughput: 625_000, connectionType: "cellular4g" });
    await cdp.send("Network.setBlockedURLs", { urls: ["https://*"] });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: width === 390 ? 4 : 1 });
    for (const cache of ["cold", "warm"]) {
      if (cache === "warm") await page.goto("about:blank");
      await page.goto(`${base}/?mode=1#world`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction(() => globalThis.GaiaMapObservationAdapter && document.documentElement.dataset.gaiaAppReady === "true", null, { timeout: 60000 });
      const readyMs = await page.evaluate(async () => { await GaiaMapObservationAdapter.waitSignalsReady(); return performance.now(); });
      await page.waitForTimeout(600);
      await cdp.send("HeapProfiler.collectGarbage");
      const heap = await cdp.send("Runtime.getHeapUsage");
      const observed = await page.evaluate(() => ({ longTaskBlockingMs: __longTasks.reduce((total, duration) => total + Math.max(0, duration - 50), 0), resources: performance.getEntriesByType("resource").filter(entry => /\/data\/(gaia-signals\.json|runtime\/)/.test(new URL(entry.name).pathname)).map(entry => ({ url: entry.name, transfer: entry.transferSize, decoded: entry.decodedBodySize, duration: entry.duration })) }));
      assert(observed.resources.length > 0);
      report.runs.push({ width, trial, version, cache, readyMs, retainedHeapBytes: heap.usedSize, ...observed, decodedBytes: observed.resources.reduce((total, entry) => total + entry.decoded, 0), transferredBytes: observed.resources.reduce((total, entry) => total + entry.transfer, 0) });
      console.log(JSON.stringify({ width, trial, version, cache, readyMs: Math.round(readyMs), decodedBytes: report.runs.at(-1).decodedBytes, transferredBytes: report.runs.at(-1).transferredBytes }));
      fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.error = error.stack; throw error; }
finally { report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); await new Promise(resolve => server.close(resolve)); }
