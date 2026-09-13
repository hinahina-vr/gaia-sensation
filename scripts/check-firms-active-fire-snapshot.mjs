import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "data", "firms-active-fire-snapshot.json");
const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));

assert.equal(snapshot.schemaVersion, 1);
assert.equal(snapshot.source, "snapshot");
assert.match(snapshot.provenance?.provider || "", /NASA.+FIRMS/u);
assert.match(snapshot.provenance?.sourceUrl || "", /^https:\/\/firms\.modaps\.eosdis\.nasa\.gov\/data\/active_fire\//u);
assert.equal(snapshot.provenance?.filters?.confidenceMin, 60);
assert(snapshot.points.length > 100, "snapshot should retain enough global detections for the exhibit");
assert(snapshot.points.length <= 1_600, "browser payload point budget exceeded");
assert.equal(snapshot.summary.displayed, snapshot.points.length);
assert(snapshot.summary.detected >= snapshot.summary.displayed);

let previousTime = "";
const ids = new Set();
for (const point of snapshot.points) {
  assert(!ids.has(point.id), `duplicate FIRMS point id: ${point.id}`);
  ids.add(point.id);
  assert(point.lat >= -90 && point.lat <= 90);
  assert(point.lon >= -180 && point.lon <= 180);
  assert(point.frp >= 0);
  assert(point.confidence >= 60 && point.confidence <= 100);
  assert(["D", "N"].includes(point.daynight));
  assert(Number.isFinite(Date.parse(point.acquiredAt)));
  assert(previousTime <= point.acquiredAt, "points must be ordered by acquisition time");
  previousTime = point.acquiredAt;
}

assert.equal(snapshot.summary.start, snapshot.points[0].acquiredAt);
assert.equal(snapshot.summary.end, snapshot.points.at(-1).acquiredAt);
console.log(JSON.stringify({ status: "passed", points: snapshot.points.length, detected: snapshot.summary.detected, start: snapshot.summary.start, end: snapshot.summary.end }, null, 2));
