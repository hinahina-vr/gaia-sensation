import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "data", "firms-active-fire-snapshot.json");
const SOURCE_URL = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv";
const SOURCE_PAGE = "https://firms.modaps.eosdis.nasa.gov/active_fire/";
const CONFIDENCE_MIN = 60;
const MAX_POINTS = 1_600;
const MAX_SOURCE_BYTES = 4_000_000;
const SPATIAL_BIN_DEGREES = 2.5;
const TIME_BIN_MINUTES = 60;

const parseNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
};

const acquiredAt = (date, time) => {
  const digits = String(time || "").padStart(4, "0");
  const iso = `${date}T${digits.slice(0, 2)}:${digits.slice(2)}:00Z`;
  return Number.isFinite(Date.parse(iso)) ? iso : "";
};

const scorePoint = (point) => Math.log1p(point.frp) * (0.55 + point.confidence / 200) + (point.daynight === "N" ? 0.04 : 0);

const compactFirmsCsv = (csv) => {
  const lines = csv.trim().split(/\r?\n/u);
  const header = lines.shift()?.split(",") || [];
  const column = Object.fromEntries(header.map((name, index) => [name.trim(), index]));
  for (const required of ["latitude", "longitude", "brightness", "acq_date", "acq_time", "satellite", "confidence", "frp", "daynight"]) {
    if (!Number.isInteger(column[required])) throw new Error(`FIRMS column missing: ${required}`);
  }

  const bins = new Map();
  let detected = 0;
  for (const line of lines) {
    if (!line) continue;
    const cells = line.split(",");
    const lat = parseNumber(cells[column.latitude]);
    const lon = parseNumber(cells[column.longitude]);
    const brightness = parseNumber(cells[column.brightness]);
    const frp = parseNumber(cells[column.frp]);
    const confidence = parseNumber(cells[column.confidence]);
    const observedAt = acquiredAt(cells[column.acq_date], cells[column.acq_time]);
    const daynight = cells[column.daynight] === "N" ? "N" : "D";
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
      || !Number.isFinite(brightness) || !(frp >= 0) || confidence < CONFIDENCE_MIN || !observedAt) continue;
    detected += 1;
    const point = {
      id: `${cells[column.satellite] || "M"}:${observedAt}:${lat.toFixed(5)}:${lon.toFixed(5)}`,
      lat: Number(lat.toFixed(5)),
      lon: Number(lon.toFixed(5)),
      brightness: Number(brightness.toFixed(2)),
      frp: Number(frp.toFixed(2)),
      confidence: Math.round(confidence),
      daynight,
      acquiredAt: observedAt,
      satellite: cells[column.satellite] || "MODIS",
    };
    const minutes = Math.floor(Date.parse(observedAt) / 60_000 / TIME_BIN_MINUTES);
    const bin = `${Math.floor((lon + 180) / SPATIAL_BIN_DEGREES)}:${Math.floor((lat + 90) / SPATIAL_BIN_DEGREES)}:${minutes}`;
    const previous = bins.get(bin);
    if (!previous || scorePoint(point) > scorePoint(previous)) bins.set(bin, point);
  }

  const points = [...bins.values()]
    .sort((left, right) => scorePoint(right) - scorePoint(left))
    .slice(0, MAX_POINTS)
    .sort((left, right) => left.acquiredAt.localeCompare(right.acquiredAt) || left.id.localeCompare(right.id));
  if (!points.length) throw new Error("FIRMS feed did not contain any usable fire detections");
  const totalFrp = points.reduce((sum, point) => sum + point.frp, 0);
  return {
    points,
    summary: {
      detected,
      displayed: points.length,
      maxFrp: Number(Math.max(...points.map((point) => point.frp)).toFixed(2)),
      totalFrp: Number(totalFrp.toFixed(2)),
      nightShare: Number((points.filter((point) => point.daynight === "N").length / points.length).toFixed(4)),
      highConfidenceShare: Number((points.filter((point) => point.confidence >= 80).length / points.length).toFixed(4)),
      start: points[0].acquiredAt,
      end: points.at(-1).acquiredAt,
    },
  };
};

const response = await fetch(SOURCE_URL, { headers: { Accept: "text/csv" } });
if (!response.ok) throw new Error(`NASA FIRMS responded with HTTP ${response.status}`);
const contentLength = Number(response.headers.get("content-length"));
if (Number.isFinite(contentLength) && contentLength > MAX_SOURCE_BYTES) {
  throw new Error(`NASA FIRMS response is too large: ${contentLength} bytes`);
}
const csv = await response.text();
const sourceBytes = Buffer.byteLength(csv);
if (sourceBytes > MAX_SOURCE_BYTES) throw new Error(`NASA FIRMS response exceeded ${MAX_SOURCE_BYTES} bytes`);
const compacted = compactFirmsCsv(csv);
const snapshot = {
  schemaVersion: 1,
  source: "snapshot",
  generatedAt: new Date().toISOString(),
  ...compacted,
  provenance: {
    provider: "NASA LANCE FIRMS",
    dataset: "MODIS Collection 6.1 NRT Global 24h",
    sourceUrl: SOURCE_URL,
    sourcePage: SOURCE_PAGE,
    resolution: "1 km nominal",
    transformVersion: "firms-global-fire-v1",
    filters: {
      confidenceMin: CONFIDENCE_MIN,
      spatialBinDegrees: SPATIAL_BIN_DEGREES,
      timeBinMinutes: TIME_BIN_MINUTES,
      maxPoints: MAX_POINTS,
      method: "highest FRP-weighted confidence detection per space-time bin",
    },
  },
};

await fs.writeFile(OUTPUT, `${JSON.stringify(snapshot)}\n`, "utf8");
console.log(JSON.stringify({ output: OUTPUT, sourceBytes, detected: snapshot.summary.detected, displayed: snapshot.summary.displayed, start: snapshot.summary.start, end: snapshot.summary.end }, null, 2));
