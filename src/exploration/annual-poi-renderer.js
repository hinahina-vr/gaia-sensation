import { poiArrival, poiArrivalDuration } from './annual-poi-arrival.js?v=gaia-annual-pop-20260909';
import { drawRecordMarker } from './prtr-biology-drawing.js?v=prtr-biology-1';

// Keep every mark in source order and preserve per-point alpha compositing.
// Raster batching changes the rounding of overlapping translucent dots. Cache
// vector paths instead: the browser still paints exactly the original marks.
export const POI_CACHE_PATHS = 40_000;
const ARRIVED = Object.freeze({ alpha: 1, scale: 1, progress: 1 });

function paintPoint(ctx, entry, animation, arrival, time, reduced) {
  const { x, y, radius, color, value, index, selected, alpha, detailed } = entry;
  ctx.globalAlpha = alpha * arrival.alpha;
  if (entry.path && arrival === ARRIVED) {
    if (value === null || (animation && value === 0)) {
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke(entry.path);
    } else { ctx.fillStyle = color; ctx.fill(entry.path); }
    return;
  }
  if (animation) {
    drawRecordMarker(ctx, { x, y, radius, color, animation, time, index, selected, arrival, reduced, value, detailed });
    return;
  }
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, radius * arrival.scale, 0, Math.PI * 2);
  if (value === null) { ctx.strokeStyle = color; ctx.lineWidth = arrival.scale; ctx.stroke(); }
  else ctx.fill();
  if (arrival.progress === 1 && value !== null && (selected || index % 13 === 0)) {
    const phase = reduced ? .3 : (time / 3800 + index * .618) % 1;
    ctx.globalAlpha *= (1 - phase) * .42;
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, radius + 3 + phase * 13, 0, Math.PI * 2); ctx.stroke();
  }
}

export function createAnnualPoiRenderer({ style, readValue, createPath = () => typeof Path2D === 'function' ? new Path2D() : null, maxPaths = POI_CACHE_PATHS } = {}) {
  let plan = null;
  const reset = () => { plan = null; };
  const prepare = ({ rows, definition, view, key, ratio, prefecture, selectedId }) => {
    reset();
    const entries = [];
    for (let index = 0; index < rows.length; index++) {
      const point = rows[index], { color, radius, mapX, mapY } = style(point);
      const x = view.originX + mapX * view.scale, y = view.originY + mapY * view.scale;
      if (x < -30 || y < -30 || x > view.rect.width + 30 || y > view.rect.height + 30) continue;
      entries.push({ color, radius, x, y, index, id: point.id, value: readValue(point), selected: point.id === selectedId,
        alpha: prefecture === 'all' || point.prefCode === prefecture ? .85 : .25, detailed: false });
    }
    plan = { rows, definition, key, ratio, entries, complete: false, cachedPoints: 0 };
  };
  const cachePaths = () => {
    const { entries, definition } = plan;
    for (const entry of entries) {
      const dynamic = definition.animation ? entry.detailed && entry.value !== null && entry.value !== 0
        : entry.value !== null && (entry.selected || entry.index % 13 === 0);
      if (dynamic || plan.cachedPoints >= maxPaths) continue;
      const path = createPath(), { x, y, radius } = entry;
      if (!path) continue;
      if (definition.animation?.endsWith('flow') && entry.detailed) {
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
          if (i) path.lineTo(px, py); else path.moveTo(px, py);
        }
        path.closePath();
      } else path.arc(x, y, radius, 0, Math.PI * 2);
      entry.path = path; plan.cachedPoints++;
    }
    plan.complete = true;
  };
  const paint = (ctx, options) => {
    const { rows, definition, view, key, ratio, elapsed, reduced, time, renderedIds } = options;
    if (elapsed < 0) {
      reset(); renderedIds.clear();
      return { visible: 0, detailedMarks: 0 };
    }
    if (!plan || plan.rows !== rows || plan.definition !== definition || plan.key !== key || plan.ratio !== ratio) {
      prepare(options);
    }
    const complete = elapsed >= 0 && (reduced || elapsed >= poiArrivalDuration(rows.length));
    // A title/arrival replay can occur without changing the dataset or camera.
    if (!complete && plan.complete) prepare(options);
    let visible = 0, detailedMarks = 0;
    if (!plan.complete) {
      renderedIds.clear();
      for (const entry of plan.entries) {
        const arrival = complete ? ARRIVED : poiArrival(entry.index, rows.length, elapsed, reduced);
        if (!arrival.alpha) continue;
        visible++; renderedIds.add(entry.id);
        entry.detailed = entry.selected || (detailedMarks < 140 && (view.scale > 80 || entry.index % Math.max(1, Math.ceil(rows.length / 140)) === 0));
        if (definition.animation && entry.detailed && entry.value > 0 && arrival.progress === 1) detailedMarks++;
        if (!complete) paintPoint(ctx, entry, definition.animation, arrival, time, reduced);
      }
      if (complete) {
        plan.visible = visible; plan.detailedMarks = detailedMarks;
        cachePaths();
      }
    }
    if (complete) {
      visible = plan.visible; detailedMarks = plan.detailedMarks;
      // Loading the same year intentionally clears the external picking set.
      if (renderedIds.size !== visible) {
        renderedIds.clear(); for (const entry of plan.entries) renderedIds.add(entry.id);
      }
      for (const entry of plan.entries) paintPoint(ctx, entry, definition.animation, ARRIVED, time, reduced);
    }
    ctx.globalAlpha = 1;
    plan.lastPaintReduced = reduced;
    return { visible, detailedMarks };
  };
  // Only the owner of the unchanged destination canvas may take this shortcut.
  // It must not clear/resize/composite that canvas between paint and reuse.
  const canReuseFrame = ({ rows, definition, key, ratio, reduced, elapsed, renderedIds }) => Boolean(
    plan?.complete && plan.lastPaintReduced && reduced && elapsed >= 0
    && plan.rows === rows && plan.definition === definition && plan.key === key && plan.ratio === ratio
    && renderedIds.size === plan.visible);
  return { paint, reset, canReuseFrame, getState: () => ({ cachedPoints: plan?.cachedPoints || 0, projectedPoints: plan?.entries.length || 0 }) };
}
