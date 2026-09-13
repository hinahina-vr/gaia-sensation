import assert from "node:assert/strict";
import { createPoiArrival, drawPoiArrivals, POI_ARRIVAL_LIFETIME_MS } from "../src/exploration/poi-arrival.js";

const point = { lon: 138, lat: 35, windDirection: 124, windSpeed: 7.2 };
const original = JSON.stringify(point);
const startedAt = 100;
const arrival = createPoiArrival([point], startedAt);
const sprite = {};
const calls = [];
const context = {
  globalAlpha: 1,
  save() {}, restore() {}, translate() {}, scale() {},
  drawImage(image, x, y, width, height) { calls.push({ image, x, y, width, height }); },
  // No line/curve primitives: a return to connected tendrils fails this test.
};
for (const kind of ["wind", "air", "cloud"]) {
  for (const age of [180, 450, 1000, 1500]) {
    calls.length = 0;
    const result = drawPoiArrivals(context, arrival, {
      now: arrival.startsAt + age, view: { rect: { width: 1440, height: 900 } },
      project: () => ({ x: 400, y: 300 }), kind, sprite, rgb: "99, 243, 255",
    });
    assert.deepEqual(result.indices, [0]);
    assert.equal(calls.length, 7, "One diffuse bloom/core and five detached glints");
    assert(calls.every(call => call.image === sprite && call.width === call.height), "No stretched stalks or rays");
    assert(calls.every(call => call.width <= 104 && call.width >= 6));
    assert.equal(calls[0].x + calls[0].width / 2, 0, "Bloom stays centred at the POI");
    assert.equal(calls[0].y + calls[0].height / 2, 0);
  }
}
for (const now of [startedAt, arrival.settlesAt, arrival.settlesAt + POI_ARRIVAL_LIFETIME_MS]) {
  calls.length = 0;
  assert.equal(drawPoiArrivals(context, arrival, {
    now, view: { rect: { width: 390, height: 844 } }, project: () => ({ x: 200, y: 300 }),
    kind: "wind", sprite, rgb: "99, 243, 255",
  }).count, 0);
  assert.equal(calls.length, 0, "Entrance does not persist as ambient visual clutter");
}
assert.equal(JSON.stringify(point), original, "Rendering does not alter source observations");
console.log("PASS light blooms: round falloff, five detached glints, anchored origin, no curves/rays, finite lifetime, source immutability");
