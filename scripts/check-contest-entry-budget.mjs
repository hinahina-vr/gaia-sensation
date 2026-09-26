import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENTRY_BUDGET_BYTES, assertEntryBudget } from "./lib/contest-entry-budget.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const head = indexSource.match(/<head>[\s\S]*?<\/head>/iu)?.[0] || "";
const openingCss = fs.readFileSync(path.join(root, "opening.css"), "utf8");
const localHeadAssets = [...head.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^" ]*)?"/giu)].map((match) => match[1]);
const firstScreenImages = [
  "assets/brand/brand-logo-dark-surface-590.webp",
  ...new Set([...openingCss.matchAll(/--opening-keyvisual-image:\s*url\("\.\/(.*?)"\)/gu)].map((match) => match[1])),
];
const files = [...new Set(["index.html", ...localHeadAssets, ...firstScreenImages])];
const report = files.map((file) => ({ file, bytes: fs.statSync(path.join(root, file)).size }));
const totalBytes = report.reduce((sum, entry) => sum + entry.bytes, 0);

assertEntryBudget(totalBytes, "初期画面の保守的な未圧縮合計");
for (const forbidden of ["guided-tour", "observation-notebook", "gaia-signals.json", "space-signals.json", "novel-mode", "novel-story", ".mp3"]) {
  assert.equal(head.includes(forbidden), false, `操作前に遅延資産 ${forbidden} を参照しています`);
}
assert.match(head, /gaia-mode-loader\.js/u);
assert.match(indexSource, /id="gaia-opening-sound-modal"/u);
assert.match(indexSource, /id="gaia-opening-sound-on"/u);
assert.match(indexSource, /id="gaia-opening-sound-off"/u);
assert.doesNotMatch(indexSource, /id="gaia-opening-entry-(?:continue|story|explore|sound-toggle)"/u);

console.log(JSON.stringify({ status: "passed", limitBytes: ENTRY_BUDGET_BYTES, totalBytes, files: report }, null, 2));
