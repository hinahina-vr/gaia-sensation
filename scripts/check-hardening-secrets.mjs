import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(file => /\.(?:js|mjs|ts|json|jsonc|yml|yaml|html|md|txt|h|ino|sh)$/.test(file));
const patterns = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["provider-api-key", /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}/],
  ["github-token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/],
  ["aws-access-id", /\bAKIA[A-Z0-9]{16}\b/],
];
const matches = [];
for (const file of files) {
  const target = path.join(root, file);
  if (!fs.existsSync(target) || fs.statSync(target).size > 25_000_000) continue;
  const content = fs.readFileSync(target, "utf8");
  for (const [kind, pattern] of patterns) if (pattern.test(content)) matches.push({ path: file, kind });
}
// Never print a matching secret, even when this check fails.
console.log(JSON.stringify({ status: matches.length ? "review-required" : "passed", scannedFiles: files.length, matches, limit: "Targeted known token formats in the current tree, not a full secret/history scanner." }, null, 2));
assert.equal(matches.length, 0, "Possible credentials found; inspect privately and rotate if real");
