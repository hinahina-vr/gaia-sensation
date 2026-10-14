import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnnualPoiRenderer, POI_CACHE_PATHS } from '../src/exploration/annual-poi-renderer.js';

function fixture(count = 600, maxPaths) {
  const calls = { styles: 0, values: 0, paths: 0, paint: 0 };
  const noop = () => {};
  const path = () => { calls.paths++; return { arc: noop, lineTo: noop, moveTo: noop, closePath: noop }; };
  const renderer = createAnnualPoiRenderer({ maxPaths, createPath: path,
    style: p => { calls.styles++; return { color: '#abcdef', radius: 3, mapX: p.x, mapY: p.y }; },
    readValue: p => { calls.values++; return p.value; } });
  const context = { canvas: { width: 1000, height: 800 }, globalAlpha: 1,
    arc: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, save: noop, restore: noop,
    fill() { calls.paint++; }, stroke() { calls.paint++; } };
  const rows = Array.from({ length: count }, (_, i) => ({ id: String(i), x: i % 1000, y: Math.floor(i / 1000), value: i % 11 ? i : null, prefCode: '01' }));
  const options = { rows, definition: {}, view: { rect: { width: 1000, height: 800 }, scale: 1, originX: 0, originY: 0 },
    key: 'view', ratio: 1, prefecture: 'all', selectedId: '', elapsed: 3000, reduced: false, time: 1000, renderedIds: new Set() };
  return { renderer, context, calls, options, paint: patch => renderer.paint(context, { ...options, ...patch }) };
}
test('waiting title/camera frames do no per-station work, even with reduced motion', () => {
  const f = fixture();
  for (const reduced of [false, true]) assert.deepEqual(f.paint({ elapsed: -1, reduced }), { visible: 0, detailedMarks: 0 });
  assert.deepEqual(f.calls, { styles: 0, values: 0, paths: 0, paint: 0 });
});
test('stable view reuses projection, readings, picking IDs and vector paths but still paints each frame', () => {
  const f = fixture(); f.paint();
  const first = { ...f.calls };
  f.paint({ time: 1700 }); f.paint({ time: 2400 });
  assert.equal(f.calls.styles, first.styles); assert.equal(f.calls.values, first.values); assert.equal(f.calls.paths, first.paths);
  assert(f.calls.paint > first.paint * 2);
  assert.deepEqual([...f.options.renderedIds], f.options.rows.map(p => p.id));
  f.options.renderedIds.clear(); f.paint(); assert.equal(f.options.renderedIds.size, 600);
});
test('same-count year replacement invalidates coordinates, values and picking order', () => {
  const f = fixture(); f.paint();
  const next = f.options.rows.map(p => ({ ...p, id: `next-${p.id}`, value: p.value === null ? null : p.value * 2 })).reverse();
  f.paint({ rows: next });
  assert.equal(f.calls.styles, 1200); assert.equal(f.calls.values, 1200);
  assert.deepEqual([...f.options.renderedIds], next.map(p => p.id));
});
test('pan, resize/DPR, selection/filter key and exhibit all invalidate projected paths', () => {
  for (const patch of [{ key: 'pan', view: { rect: { width: 1000, height: 800 }, scale: 1, originX: 400, originY: 0 } },
    { ratio: 1.5 }, { key: 'filter/selection', prefecture: '02', selectedId: '400' }, { definition: { animation: 'air-flow' } }]) {
    const f = fixture(); f.paint(); const count = f.calls.paths;
    f.paint(patch); assert.equal(f.calls.styles, 1200); assert(f.calls.paths > count);
  }
});
test('arrival replay and reset discard references to previous point geometry', () => {
  const f = fixture(); f.paint(); assert(f.renderer.getState().cachedPoints > 0);
  f.paint({ elapsed: 400 }); assert.equal(f.renderer.getState().cachedPoints, 0);
  f.paint({ elapsed: -1 }); assert.equal(f.options.renderedIds.size, 0);
  assert.deepEqual(f.renderer.getState(), { cachedPoints: 0, projectedPoints: 0 });
  f.paint(); f.renderer.reset(); assert.deepEqual(f.renderer.getState(), { cachedPoints: 0, projectedPoints: 0 });
});
test('path budget is independent of dataset size; uncached observations remain visible', () => {
  const f = fixture(45000); const result = f.paint();
  assert.equal(f.calls.paths, POI_CACHE_PATHS); assert.equal(result.visible, 45000); assert.equal(f.options.renderedIds.size, 45000);
  const uncached = fixture(600, 0); assert.equal(uncached.paint().visible, 600); assert.equal(uncached.calls.paths, 0);
});
test('only a completed, unchanged reduced-motion frame can skip painting', () => {
  const f = fixture();
  const reduced = { ...f.options, reduced: true };
  assert.equal(f.renderer.canReuseFrame(reduced), false);
  f.paint(); assert.equal(f.renderer.canReuseFrame(reduced), false);
  f.paint({ reduced: true }); assert.equal(f.renderer.canReuseFrame(reduced), true);
  for (const patch of [{ key: 'other' }, { rows: [] }, { definition: {} }, { ratio: 1.5 }, { elapsed: -1 }, { reduced: false }, { renderedIds: new Set() }]) {
    assert.equal(f.renderer.canReuseFrame({ ...reduced, ...patch }), false);
  }
  f.renderer.reset(); assert.equal(f.renderer.canReuseFrame(reduced), false);
});
