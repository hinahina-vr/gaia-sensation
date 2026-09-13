import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = JSON.parse(await readFile(path.join(root, "data", "space-signals.json"), "utf8"));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(snapshot.modes?.length === 10, "space-signals.json must contain exactly 10 modes");
assert(snapshot.sources?.length >= 8, "space-signals.json must contain the eight official source snapshots");
assert(snapshot.sources.every((source) => source.kind === "SOURCE"), "all space source entries must be SOURCE");
assert(snapshot.sources.every((source) => source.status === "SNAPSHOT_SAVED"), "every space source must be saved locally");
assert(snapshot.sources.every((source) => source.url && source.retrievedAt && source.period && source.unit), "source provenance is incomplete");
assert(snapshot.sources.every((source) => source.preview.length > 0 && source.preview.length <= 10), "source preview must contain 1–10 rows");
assert(snapshot.modes.slice(0, 9).every((mode) => mode.records?.length > 0), "space modes 01–09 need data records");
assert(snapshot.modes.every((mode, index) => mode.number === index + 1), "space mode numbers must be sequential");
assert(snapshot.modes.every((mode) => mode.sourceIds?.every((id) => snapshot.sources.some((source) => source.id === id))), "space mode references an unknown source");

const ryugu = snapshot.modes.find((mode) => mode.id === "ryugu-lidar");
assert(ryugu.records.every((row) => row.shotTime && Number.isFinite(row.rangeM) && Number.isFinite(row.topoHeightM)), "Ryugu LIDAR records must use the documented JAXA columns");

console.log(`space data ok: ${snapshot.modes.length} modes / ${snapshot.sources.length} sources / ${snapshot.modes.reduce((sum, mode) => sum + mode.records.length, 0)} runtime records`);
