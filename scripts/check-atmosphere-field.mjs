import assert from "node:assert/strict";
import { buildAtmosphereField } from "../src/exploration/atmosphere-field-worker.js";

const base = { lon: 0, lat: 0, windSpeed: 10, windDirection: 0, pressure: 1000, cloud: 0, radiation: 500 };
const clear = buildAtmosphereField([base], "cloud", 36, 18);
assert.equal(clear.sourceCount, 1);
for (let i = 0; i < clear.scalar.length; i += 4) {
  assert.equal(clear.scalar[i], 0, "Zero cloud cover is clear, not a default cloud amount");
  assert.ok(Math.abs(clear.vector[i]) < 0.0001);
  assert.ok(Math.abs(clear.vector[i + 1] + 10) < 0.001, "Northerly wind travels south");
}
const overcast = buildAtmosphereField([{ ...base, cloud: 100, windDirection: 270 }], "wind", 36, 18);
assert.ok(Math.abs(overcast.scalar[0] - 1) < 0.001);
assert.ok(Math.abs(overcast.vector[0] - 10) < 0.001, "Westerly wind travels east");
const cancelling = buildAtmosphereField([base, { ...base, windDirection: 180 }], "wind", 36, 18);
assert.ok(Math.hypot(...cancelling.vector.slice(0, 2)) < 0.001, "Opposite vectors cancel without averaging bearings");

const sources = [{ ...base, lon: 180, cloud: 100 }, { ...base, lon: 0, cloud: 0 }];
const original = JSON.stringify(sources);
const seam = buildAtmosphereField(sources, "cloud", 360, 180);
const row = 90 * 360 * 4;
assert.ok(Math.abs(seam.scalar[row] - seam.scalar[row + 359 * 4]) < 0.001, "Date-line interpolation is continuous");
assert.ok(seam.scalar[row] > 0.99, "Date-line neighbours are nearby, not 360 degrees away");
assert.equal(JSON.stringify(sources), original, "Display interpolation does not change POI values");
assert.equal(seam.sourceCount, 2, "Interpolated texels must not count as observations");
for (const cloud of [null, undefined, NaN]) {
  assert.equal(buildAtmosphereField([{ ...base, cloud }], "cloud", 4, 2).sourceCount, 0, "Missing values are not clear-sky observations");
}
const air = buildAtmosphereField([{ lon: 0, lat: 0, pm25: 30, aerosol: 0.25 }], "air", 4, 2);
assert.ok(Math.abs(air.scalar[2] - 0.5) < 0.001);
assert.ok(Math.abs(air.scalar[3] - 0.25) < 0.001);
assert.ok(buildAtmosphereField([], "cloud", 4, 2).scalar.every(v => v === 0));
console.log("PASS atmosphere: cloud endpoints, wind direction/cancellation, spherical seam, missing values, source immutability");
