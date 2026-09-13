import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("../data/natural-earth-50m-land.geojson", import.meta.url);
const geojson = JSON.parse(await readFile(sourceUrl, "utf8"));
const countriesUrl = new URL("../data/natural-earth-50m-countries.geojson", import.meta.url);
const countriesGeojson = JSON.parse(await readFile(countriesUrl, "utf8"));
const prefecturesUrl = new URL("../data/japan-prefectures.topojson", import.meta.url);
const prefecturesTopology = JSON.parse(await readFile(prefecturesUrl, "utf8"));
const signalsUrl = new URL("../data/gaia-signals.json", import.meta.url);
const signals = JSON.parse(await readFile(signalsUrl, "utf8"));

assert.equal(geojson.type, "FeatureCollection", "Natural Earth file must be GeoJSON");
assert.ok(geojson.features.length >= 1000, "Natural Earth feature collection is incomplete");

let ringCount = 0;
let pointCount = 0;
let datelineJumps = 0;
const bounds = {
  west: Infinity,
  south: Infinity,
  east: -Infinity,
  north: -Infinity,
};

for (const feature of geojson.features) {
  const { geometry } = feature;
  if (!geometry) continue;
  const polygons = geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.type === "MultiPolygon"
      ? geometry.coordinates
      : [];

  for (const polygon of polygons) {
    for (const ring of polygon) {
      ringCount += 1;
      pointCount += ring.length;
      ring.forEach(([longitude, latitude], index) => {
        assert.ok(longitude >= -180 && longitude <= 180, `invalid longitude: ${longitude}`);
        assert.ok(latitude >= -90 && latitude <= 90, `invalid latitude: ${latitude}`);
        bounds.west = Math.min(bounds.west, longitude);
        bounds.south = Math.min(bounds.south, latitude);
        bounds.east = Math.max(bounds.east, longitude);
        bounds.north = Math.max(bounds.north, latitude);
        if (index > 0 && Math.abs(longitude - ring[index - 1][0]) > 180) {
          datelineJumps += 1;
        }
      });
    }
  }
}

assert.ok(ringCount >= 1400, `expected at least 1,400 coastline rings, got ${ringCount}`);
assert.ok(pointCount >= 60000, `expected at least 60,000 reference points, got ${pointCount}`);
assert.ok(bounds.west <= -179.99 && bounds.east >= 179.99, "land reference must span the globe");
assert.ok(bounds.south <= -89.9 && bounds.north >= 83, "polar coverage is incomplete");
assert.equal(datelineJumps, 0, "a coastline ring crosses the antimeridian and would draw a false line");

assert.equal(countriesGeojson.type, "FeatureCollection", "Natural Earth countries file must be GeoJSON");
assert.ok(countriesGeojson.features.length >= 200, "Natural Earth country collection is incomplete");
const countryCodes = new Set();
let countryBoundaryRingCount = 0;
for (const feature of countriesGeojson.features) {
  const geometry = feature.geometry;
  const polygons = geometry?.type === "Polygon"
    ? [geometry.coordinates]
    : geometry?.type === "MultiPolygon"
      ? geometry.coordinates
      : [];
  for (const polygon of polygons) countryBoundaryRingCount += polygon.length;
  const properties = feature.properties || {};
  const code = [properties.ADM0_A3, properties.ISO_A3, properties.SOV_A3, properties.BRK_A3, properties.WB_A3]
    .find((value) => typeof value === "string" && /^[A-Z]{3}$/.test(value) && value !== "-99");
  if (code) countryCodes.add(code);
}
assert.ok(countryCodes.size >= 200, `expected at least 200 country codes, got ${countryCodes.size}`);
assert.ok(countryBoundaryRingCount >= 400, `expected at least 400 country boundary rings, got ${countryBoundaryRingCount}`);

assert.equal(prefecturesTopology.type, "Topology", "Japan prefectures file must be TopoJSON");
const prefectureGeometries = prefecturesTopology.objects?.japan?.geometries || [];
assert.equal(prefectureGeometries.length, 47, "Japan prefecture topology must contain 47 prefectures");
assert.deepEqual(
  prefectureGeometries.map(({ properties }) => properties?.id).sort((a, b) => a - b),
  Array.from({ length: 47 }, (_, index) => index + 1),
  "Japan prefecture IDs must cover 1 through 47",
);
const referencedPrefectureArcs = new Set();
const collectArcIndexes = (value) => {
  if (Number.isInteger(value)) {
    referencedPrefectureArcs.add(value < 0 ? ~value : value);
    return;
  }
  if (Array.isArray(value)) value.forEach(collectArcIndexes);
};
prefectureGeometries.forEach(({ arcs }) => collectArcIndexes(arcs));
assert.ok(referencedPrefectureArcs.size >= 1000, "Japan prefecture boundary arcs are incomplete");
const { scale, translate } = prefecturesTopology.transform;
const prefectureBounds = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
for (const arcIndex of referencedPrefectureArcs) {
  let x = 0;
  let y = 0;
  for (const [deltaX, deltaY] of prefecturesTopology.arcs[arcIndex]) {
    x += deltaX;
    y += deltaY;
    const longitude = x * scale[0] + translate[0];
    const latitude = y * scale[1] + translate[1];
    prefectureBounds.west = Math.min(prefectureBounds.west, longitude);
    prefectureBounds.south = Math.min(prefectureBounds.south, latitude);
    prefectureBounds.east = Math.max(prefectureBounds.east, longitude);
    prefectureBounds.north = Math.max(prefectureBounds.north, latitude);
  }
}
assert.ok(prefectureBounds.west < 123 && prefectureBounds.east > 145, "Japan prefecture longitude coverage is incomplete");
assert.ok(prefectureBounds.south < 25 && prefectureBounds.north > 45, "Japan prefecture latitude coverage is incomplete");
const renewableRows = signals.modes.find(({ id }) => id === "earth-organ")?.signals?.current || [];
const missingRenewableCountries = renewableRows.filter(row => row.mapIso3 && !countryCodes.has(row.mapIso3));
assert.deepEqual(missingRenewableCountries, [], "Mapped renewable rows must have their own Natural Earth geometry");
assert.deepEqual(renewableRows.filter(row => !row.mapIso3).map(row => row.iso3), ["GIB"], "Only explicitly identified point-only territories may lack a polygon");

console.log(
  `Natural Earth check passed: ${geojson.features.length} features, ${ringCount} rings, ` +
    `${pointCount} points, ${countryCodes.size} countries, ${countryBoundaryRingCount} country rings, ` +
    `${prefectureGeometries.length} prefectures, ${referencedPrefectureArcs.size} prefecture arcs, ` +
    `${renewableRows.filter(row => row.mapIso3).length} renewable fills + Gibraltar point, bounds ${JSON.stringify(bounds)}.`,
);
