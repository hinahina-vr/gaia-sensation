import assert from "node:assert/strict";
import fs from "node:fs";
import { createMapDemoController, MAP_DEMO_INTERVAL_MS } from "../src/exploration/map-demo-controller.js";

function fixture({ current = 1, available = true, items = Array.from({ length: 71 }, (_, i) => i + 1), select } = {}) {
  let time = 0;
  let id = 0;
  const jobs = new Map();
  const changes = [];
  const visits = [];
  const state = { current, available, items };
  const controller = createMapDemoController({
    now: () => time,
    schedule: (fn, delay) => { jobs.set(++id, { fn, at: time + delay }); return id; },
    cancel: id => jobs.delete(id),
    getItems: () => state.items,
    getCurrent: () => state.current,
    isAvailable: () => state.available,
    select: next => { visits.push(next); state.current = next; return select?.(next, controller); },
    onChange: snapshot => changes.push(snapshot),
  });
  const advance = delta => {
    const end = time + delta;
    for (;;) {
      const entry = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      time = entry[1].at;
      jobs.delete(entry[0]);
      entry[1].fn();
      assert(jobs.size <= 1, "Only one timer may own the demo");
    }
    time = end;
  };
  const suspend = delta => {
    time += delta;
    const pending = [...jobs.values()];
    jobs.clear();
    for (const job of pending) job.fn();
  };
  return { controller, state, jobs, visits, changes, advance, suspend };
}

assert.equal(MAP_DEMO_INTERVAL_MS, 25_000);
{
  const f = fixture();
  assert.equal(f.controller.getState().active, false);
  f.advance(1_000_000);
  assert.deepEqual(f.visits, []);
  assert(f.controller.start());
  assert.equal(f.controller.start(), false);
  f.advance(24_999);
  assert.equal(f.state.current, 1);
  f.advance(1);
  assert.equal(f.state.current, 2);
  f.advance(70 * MAP_DEMO_INTERVAL_MS);
  assert.deepEqual(f.visits, [...Array.from({ length: 70 }, (_, i) => i + 2), 1]);
  assert(f.controller.stop());
  assert.equal(f.controller.stop(), false);
  assert.equal(f.jobs.size, 0);
  f.advance(1_000_000);
  assert.equal(f.visits.length, 71);
  f.controller.start();
  f.advance(24_999);
  assert.equal(f.state.current, 1);
  f.advance(1);
  assert.equal(f.state.current, 2);
}
{
  const f = fixture({ current: 71 });
  f.controller.start();
  f.advance(9000);
  f.controller.setPaused(true);
  assert.equal(f.controller.getState().remainingMs, 16000);
  assert.equal(f.jobs.size, 0);
  f.advance(10 * 60_000);
  f.controller.setPaused(true);
  assert.deepEqual(f.visits, []);
  f.controller.setPaused(false);
  f.advance(15_999);
  assert.equal(f.state.current, 71);
  f.advance(1);
  assert.equal(f.state.current, 1);
  f.suspend(10 * 60_000);
  assert.deepEqual(f.visits, [1, 2], "Overdue callbacks must not catch up in a burst");
  assert.equal(f.controller.getState().remainingMs, 25000);
  f.controller.setPaused(true);
  f.controller.stop("leave");
  f.controller.setPaused(false);
  assert.equal(f.jobs.size, 0);
}
{
  const f = fixture({ available: false });
  assert.equal(f.controller.start(), false);
  f.state.available = true;
  f.controller.start();
  f.state.available = false;
  f.advance(1000);
  assert.equal(f.controller.getState().active, false);
  assert.equal(f.jobs.size, 0);
  f.state.available = true;
  f.state.items = [1];
  assert.equal(f.controller.start(), false);
}
for (const select of [() => false, () => { throw new Error("unavailable"); }, (_, controller) => controller.stop("leave")]) {
  const f = fixture({ select });
  f.controller.start();
  f.advance(MAP_DEMO_INTERVAL_MS);
  assert.equal(f.controller.getState().active, false);
  assert.equal(f.jobs.size, 0);
}
{
  const f = fixture({ current: 99 });
  f.controller.start();
  f.advance(MAP_DEMO_INTERVAL_MS);
  assert.equal(f.state.current, 1);
  f.state.items = [];
  f.advance(MAP_DEMO_INTERVAL_MS);
  assert.equal(f.controller.getState().active, false);
}
const root = new URL("../", import.meta.url);
{
  const f = fixture({ select: (_, controller) => controller.setPaused(true) });
  f.controller.start();
  f.advance(MAP_DEMO_INTERVAL_MS);
  assert.equal(f.controller.getState().paused, true);
  assert.equal(f.controller.getState().remainingMs, MAP_DEMO_INTERVAL_MS);
  f.advance(40_000);
  assert.deepEqual(f.visits, [2]);
  f.controller.setPaused(false);
  f.advance(24_999);
  assert.deepEqual(f.visits, [2], "Late-ready chapter retains its full dwell time");
  f.advance(1);
  assert.deepEqual(f.visits, [2, 3]);
}
const read = name => fs.readFileSync(new URL(name, root), "utf8");
assert.match(read("src/exploration/index.js"), /map-demo\.js\?v=gaia-firms-cruise-animation-20260914/u);
assert.match(read("gaia-mode-loader.js"), /map-demo\.css\?v=gaia-demo-aurora-1/u);
assert.match(read("src/exploration/map-demo.js"), /map-demo-controller\.js\?v=gaia-map-demo-1/u);
assert.match(read("app.js"), /version: "v5"/u);
assert.match(read("src/exploration/map-demo.js"), /defaultPending = false;[\s\S]*start\(\{ automatic: true \}\)/u);
assert.doesNotMatch(read("src/exploration/map-demo.js"), /(?:localStorage|sessionStorage|switchTrack|setVolume|setMuted)/u);
assert.doesNotMatch(read("src/exploration/map-demo.js"), /data-demo-seconds/u);
assert.match(read("src/exploration/map-demo.js"), /data-demo-fill/u);
assert.match(read("src/exploration/map-demo.js"), /clipPath: "inset\(0 100% 0 0\)"/u);
assert.match(read("src/exploration/map-demo.js"), /duration: state\.remainingMs, easing: "linear"/u);
console.log("Map demo: 25-second full loop, single timer, pause/resume, input lifecycle and failure guards passed.");
