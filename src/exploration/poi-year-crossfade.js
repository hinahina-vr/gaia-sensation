// Keep one raster of the outgoing POIs, never a second animated station set.
// The caller draws the new year normally, then blends the two whole layers.
export const POI_YEAR_FADE_MS = 400;

export function createPoiYearCrossfade(createCanvas = () => document.createElement('canvas')) {
  let snapshot, snapshotContext, viewKey, startedAt = null, active = false, progress = 1;
  const reset = () => {
    active = false; progress = 1; startedAt = null; viewKey = undefined;
    // Release the full-size backing store between transitions and on exit.
    if (snapshot && (snapshot.width !== 1 || snapshot.height !== 1)) snapshot.width = snapshot.height = 1;
  };
  return {
    reset,
    capture(source, key) {
      if (!source.width || !source.height) { reset(); return; }
      snapshot ||= createCanvas();
      snapshotContext ||= snapshot.getContext('2d');
      if (!snapshotContext) { reset(); return; }
      snapshot.width = source.width; snapshot.height = source.height;
      // During a rapid scrub the source is the last visible blend, so a new
      // transition replaces the old one continuously, without stacking layers.
      snapshotContext.drawImage(source, 0, 0);
      viewKey = key; startedAt = null; progress = 0; active = true;
    },
    paint(context, key, time, disabled = false) {
      if (!active) return;
      if (disabled || key !== viewKey) { reset(); return; }
      startedAt ??= time;
      const fraction = Math.max(0, Math.min(1, (time - startedAt) / POI_YEAR_FADE_MS));
      if (fraction === 1) { reset(); return; }
      progress = fraction * fraction * (3 - 2 * fraction);
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      // Scale alpha AFTER drawing all new points: overlapping stations must
      // fade as one image. Add premultiplied layers to avoid a dark midpoint.
      context.globalCompositeOperation = 'destination-in';
      context.globalAlpha = progress;
      context.fillStyle = '#000';
      context.fillRect(0, 0, context.canvas.width, context.canvas.height);
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = 1 - progress;
      context.drawImage(snapshot, 0, 0);
      context.restore();
    },
    getState: () => ({ active, progress, snapshotPixels: active ? snapshot.width * snapshot.height : 0 }),
  };
}
