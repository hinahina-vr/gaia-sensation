import assert from "node:assert/strict";
import { buildVectorGrid, buildCurrentWeave } from "../current-flow-worker.js";

const offset = (x, y, width = 360) => (y * width + x) * 4;
const rows = [
  { lon: -1.5, lat: 0.5, uMs: 0.8, vMs: 0.2 },
  { lon: 2.5, lat: 0.5, uMs: 0.4, vMs: 0.6 },
];
const unchanged = JSON.stringify(rows);
const field = buildVectorGrid(rows);
const middle = offset(180, 90);
assert.ok(Math.abs(field.data[middle] - 0.6) < 0.001, "Interpolate measured eastward components");
assert.ok(Math.abs(field.data[middle + 1] - 0.4) < 0.001, "Interpolate measured northward components");
assert.equal(field.data[middle + 2], 1, "No coverage hole midway between neighbouring samples");
assert.equal(field.data[offset(220, 90) + 2], 0, "Do not extrapolate across unobserved oceans");
assert.equal(field.sampleCount, 2, "Interpolated pixels must not become extra observations");
assert.equal(JSON.stringify(rows), unchanged, "Source values remain immutable");

const opposing = buildVectorGrid(rows.map((row, i) => ({ ...row, uMs: i ? -0.8 : 0.8, vMs: 0 })));
assert.ok(Math.abs(opposing.data[middle]) < 0.001, "Opposing vectors cancel, not average their angles");
assert.ok(opposing.data[middle + 3] < 0.001, "Do not fabricate speed at a stagnation point");
const land = new Uint8Array(360 * 180);
land[90 * 360 + 180] = 1;
assert.deepEqual([...buildVectorGrid(rows, 360, 180, land).data.slice(middle, middle + 4)], [0, 0, 0, 0]);
const wrapped = buildVectorGrid([{ lon: 180, lat: 0.5, uMs: 1, vMs: 0 }]);
assert.equal(wrapped.data[offset(0, 90) + 2], wrapped.data[offset(359, 90) + 2], "Date-line support wraps");
assert.deepEqual([...buildVectorGrid([]).data.slice(0, 4)], [0, 0, 0, 0]);

// A uniform eastward vector field must stretch pigment east/west. This tests
// the actual convolution, not only a diagnostic dataset attribute.
const uniform = { width: 180, height: 90, data: new Float32Array(180 * 90 * 4) };
for (let i = 0; i < uniform.data.length; i += 4) uniform.data.set([1, 0, 1, 1], i);
const weave = buildCurrentWeave(uniform, 360, 180);
let across = 0, along = 0, animated = 0;
for (let y = 10; y < 170; y += 1) {
  for (let x = 10; x < 350; x += 1) {
    const i = offset(x, y);
    along += Math.abs(weave.data[i] - weave.data[i + 4]);
    across += Math.abs(weave.data[i] - weave.data[i + 360 * 4]);
    animated += Math.abs(weave.data[i + 1] - 128) + Math.abs(weave.data[i + 2] - 128);
  }
}
assert.ok(across > along * 1.5, "Pigment follows the measured vector direction");
assert.ok(animated > 1000, "Cached terms retain motion without regenerating textures");
const masked = buildCurrentWeave(uniform, 16, 8, new Uint8Array(128).fill(1));
assert.ok(masked.data.every((value) => value === 0), "Land pixels never receive interpolated sea pigment");
console.log("PASS current flow: u/v interpolation, gap coverage, land, dateline, cached advection");
