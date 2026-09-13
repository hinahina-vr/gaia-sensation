import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "artifacts/hardening/dependency-audit");
fs.mkdirSync(output, { recursive: true });
const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const report = [];
for (const directory of [root, path.join(root, "sensor-platform")]) {
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath, [npmCli, "audit", "--json", "--package-lock-only", "--cache", path.join(output, "cache")], { cwd: directory, windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", error => resolve({ code: -1, stdout, stderr: error.message }));
    child.on("exit", code => resolve({ code, stdout, stderr }));
  });
  const name = directory === root ? "web" : "sensor-platform";
  fs.writeFileSync(path.join(output, `${name}.json`), result.stdout);
  let audit; try { audit = JSON.parse(result.stdout); } catch {}
  report.push({ name, exitCode: result.code, summary: audit?.metadata?.vulnerabilities || null, error: audit?.error?.summary || (!audit?.metadata ? result.stderr.slice(0, 300) : null) });
}
fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.some(item => !item.summary)) process.exitCode = 2;
else if (report.some(item => item.summary.total > 0)) process.exitCode = 1;
