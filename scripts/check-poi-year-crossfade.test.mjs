import assert from 'node:assert/strict';
import test from 'node:test';
import { createPoiYearCrossfade, POI_YEAR_FADE_MS } from '../src/exploration/poi-year-crossfade.js';

function fixture() {
  const copies = [], operations = [], snapshots = [];
  const fade = createPoiYearCrossfade(() => {
    const canvas = { width: 1, height: 1, getContext: () => ({ drawImage: source => copies.push(source) }) };
    snapshots.push(canvas); return canvas;
  });
  const source = { width: 100, height: 50 };
  const context = { canvas: source, save() {}, restore() {}, setTransform() {},
    fillRect() { operations.push(['mask', this.globalAlpha, this.globalCompositeOperation]); },
    drawImage() { operations.push(['old', this.globalAlpha, this.globalCompositeOperation]); } };
  return { fade, source, context, copies, operations, snapshots };
}
test('400ms blend weights sum to one; snapshot released at completion', () => {
  const { fade, source, context, copies, operations, snapshots } = fixture();
  assert.equal(POI_YEAR_FADE_MS, 400);
  fade.capture(source, 'view');
  for (const [time, expected] of [[100, 0], [200, .15625], [300, .5], [400, .84375]]) {
    fade.paint(context, 'view', time);
    assert.equal(fade.getState().progress, expected);
    assert.deepEqual(operations.at(-2), ['mask', expected, 'destination-in']);
    assert.deepEqual(operations.at(-1), ['old', 1 - expected, 'lighter']);
  }
  assert.equal(copies.length, 1, 'Old stations are not redrawn or recopied per frame');
  fade.paint(context, 'view', 500);
  assert.deepEqual(fade.getState(), { active: false, progress: 1, snapshotPixels: 0 });
  assert.equal(snapshots[0].width * snapshots[0].height, 1);
});
test('Rapid input replaces the snapshot without allocating more canvases', () => {
  const { fade, source, context, copies, snapshots } = fixture();
  for (let i = 0; i < 30; i++) {
    fade.capture(source, 'view'); fade.paint(context, 'view', i * 100);
    assert.equal(fade.getState().progress, 0);
    assert.equal(fade.getState().snapshotPixels, 5000);
  }
  assert.equal(snapshots.length, 1); assert.equal(copies.length, 30);
});
test('Camera/filter changes, disabled motion and explicit exit release snapshot', () => {
  const { fade, source, context, snapshots } = fixture();
  for (const cancel of [() => fade.paint(context, 'new-view', 0), () => fade.paint(context, 'view', 0, true), () => fade.reset()]) {
    fade.capture(source, 'view'); cancel();
    assert.equal(fade.getState().active, false);
    assert.equal(snapshots[0].width * snapshots[0].height, 1);
  }
});
test('Start time is first painted frame, not request completion', () => {
  const { fade, source, context } = fixture();
  fade.capture(source, 'view'); fade.paint(context, 'view', 100000);
  assert.equal(fade.getState().progress, 0);
  fade.paint(context, 'view', 100200); assert.equal(fade.getState().progress, .5);
});
test('Missing context or zero-size source falls back to no transition', () => {
  const fade = createPoiYearCrossfade(() => ({ getContext: () => null }));
  fade.capture({ width: 10, height: 10 }, 'view'); assert.equal(fade.getState().active, false);
  const { fade: valid, source } = fixture(); valid.capture(source, 'view');
  valid.capture({ width: 0, height: 0 }, 'view'); assert.equal(valid.getState().snapshotPixels, 0);
});
