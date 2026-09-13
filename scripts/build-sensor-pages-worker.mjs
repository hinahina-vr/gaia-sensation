import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const sensorRoot = path.join(root, "sensor-platform");
const output = path.join(root, "_worker.js");
const temp = path.join(root, "tmp", `sensor-pages-worker-build-${process.pid}`);
const checkOnly = process.argv.includes("--check");

const candidates = [
  process.env.GAIA_WRANGLER_PATH,
  path.join(sensorRoot, "node_modules", "wrangler", "bin", "wrangler.js"),
].filter(Boolean);
const wranglerPath = candidates.find((candidate) => fs.existsSync(candidate));
if (!wranglerPath) throw new Error("Wrangler 4.121.0 is required. Install sensor-platform devDependencies or set GAIA_WRANGLER_PATH.");
const version = spawnSync(process.execPath, [wranglerPath, "--version"], { cwd: sensorRoot, encoding: "utf8", windowsHide: true });
if (version.status !== 0 || version.stdout.trim() !== "4.121.0") throw new Error("Pages worker build requires Wrangler 4.121.0 exactly.");

fs.rmSync(temp, { recursive: true, force: true });
fs.mkdirSync(temp, { recursive: true });
try {
  const result = spawnSync(process.execPath, [
    wranglerPath,
    "deploy",
    "--dry-run",
    "--config",
    "wrangler.pages-build.jsonc",
    "--outdir",
    temp,
  ], { cwd: sensorRoot, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`.trim());
  const generatedPath = findGeneratedModule(temp);
  const generated = fs.readFileSync(generatedPath, "utf8")
    .replace(/\r\n/gu, "\n")
    // xml-utils ships a template literal with a literal space before a line
    // break. Preserve the character-class semantics without release-blocking
    // trailing whitespace in the committed Pages bundle.
    .replace("`<${tagName}[ \n>/]`", "`<${tagName}[\\x20\\n>/]`")
    .replace(/^\/\/# sourceMappingURL=.*(?:\n|$)/gmu, "");
  validateGenerated(generated);
  if (checkOnly) {
    if (!fs.existsSync(output) || fs.readFileSync(output, "utf8").replace(/\r\n/gu, "\n") !== generated) {
      throw new Error("_worker.js is stale. Run the sensor Pages worker build before committing.");
    }
    console.log(JSON.stringify({ status: "passed", output: "_worker.js", bytes: Buffer.byteLength(generated), stale: false }));
  } else {
    fs.writeFileSync(output, generated, "utf8");
    console.log(JSON.stringify({ status: "generated", output: "_worker.js", bytes: Buffer.byteLength(generated) }));
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

function findGeneratedModule(directory) {
  const matches = fs.readdirSync(directory, { recursive: true })
    .map((relative) => path.join(directory, relative))
    .filter((candidate) => fs.statSync(candidate).isFile() && candidate.endsWith(".js"));
  if (matches.length !== 1) throw new Error(`Expected one generated JavaScript module, found ${matches.length}.`);
  return matches[0];
}

function validateGenerated(source) {
  if (!source.includes("env.ASSETS.fetch(request)")) throw new Error("Generated worker lost the static ASSETS fallback.");
  if (!source.includes("Accept-Ranges") || !source.includes("Content-Range")) throw new Error("Generated worker lost audio byte-range support.");
  if (/\b(?:from|import)\s*\(?["'][^"']+\.ts["']/u.test(source)) throw new Error("Generated worker still imports TypeScript.");
  if (/sourceMappingURL/u.test(source)) throw new Error("Generated worker must not reference a local source map.");
  for (const secret of ["GOOGLE_CLIENT_SECRET", "SESSION_SECRET", "DEVICE_TOKEN_PEPPER", "PAIRING_CODE_PEPPER"]) {
    if (new RegExp(`(?:const|let|var)\\s+${secret}\\s*=`, "u").test(source)) throw new Error(`Generated worker embeds ${secret}.`);
  }
}
