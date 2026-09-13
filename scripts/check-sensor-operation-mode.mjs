import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const sensorRoot = path.join(root, "sensor-platform");
const output = path.join(root, "artifacts/hardening/operation-mode");
fs.mkdirSync(output, { recursive: true });
const report = { status: "running", checks: [], note: "Actual local workerd HTTP requests; no production configuration changed." };
try {
  for (const [index, mode] of ["read-only", "offline", "invalid-fails-closed", "normal"].entries()) {
    const origin = `http://127.0.0.1:${8850 + index}`;
    const server = spawn(process.execPath, [path.join(sensorRoot, "node_modules/wrangler/bin/wrangler.js"), "dev", "--local", "--port", String(8850 + index), "--var", `SENSOR_API_MODE:${mode}`, "--var", `WEB_ORIGIN:${origin}`], { cwd: sensorRoot, windowsHide: true, env: { ...process.env, XDG_CONFIG_HOME: path.join(output, "xdg"), WRANGLER_LOG_PATH: path.join(output, `${mode}.log`), WRANGLER_SEND_METRICS: "false" } });
    let logs = "";
    server.stdout.on("data", chunk => { logs = (logs + chunk).slice(-12000); }); server.stderr.on("data", chunk => { logs = (logs + chunk).slice(-12000); });
    try {
      let ready = false;
      for (let count = 0; count < 240; count++) {
        try { if ((await fetch(`${origin}/api/health`)).ok) { ready = true; break; } } catch {}
        if (server.exitCode !== null) throw new Error(`Worker exited: ${logs}`);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      assert(ready, logs);
      const routes = mode === "normal"
        ? [["GET", "/api/public/v1/measurement-types", 200], ["POST", "/api/v1/device/pair", 415]]
        : [["POST", "/api/auth/trial", 503], ["GET", "/api/auth/google/start", 503], ["POST", "/api/v1/device/pair", 503], ["POST", "/api/v1/devices/dev_test/telemetry", 503],
          ["GET", "/api/public/v1/measurement-types", mode === "read-only" ? 200 : 503], ["DELETE", "/api/web/v1/account", 401]];
      for (const [method, pathname, status] of routes) {
        const response = await fetch(`${origin}${pathname}`, { method, redirect: "manual" });
        assert.equal(response.status, status, `${mode}: ${method} ${pathname}`);
        assert.equal(response.headers.get("cache-control"), "no-store");
        if (status === 503) { assert.equal(response.headers.get("retry-after"), "300"); assert.equal((await response.json()).error.code, "SENSOR_MAINTENANCE"); }
        report.checks.push({ mode, method, pathname, status });
      }
    } finally { server.kill(); }
  }
  report.status = "passed";
} finally { fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
