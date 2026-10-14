// Pre-refactor painter from marine-cod-exhibit.js at 78a340bab4707bbc833902dd678c5b324f2e06a7.
// Keep this independent of the optimized renderer: it is the visual oracle.
import { drawRecordMarker } from '../../src/exploration/prtr-biology-drawing.js';
import { poiArrival } from '../../src/exploration/annual-poi-arrival.js';
export function paintAnnualPoiReference(context, options, style, readValue) {
  const { rows, definition, view, elapsed, reduced, time, prefecture, selectedId, renderedIds } = options;
  let visible = 0, detailedMarks = 0;
  renderedIds.clear();
  for (const [index, point] of rows.entries()) {
    const { color, radius, mapX, mapY } = style(point);
    const x = view.originX + mapX * view.scale, y = view.originY + mapY * view.scale;
    if (x < -30 || y < -30 || x > view.rect.width + 30 || y > view.rect.height + 30) continue;
    const arrival = poiArrival(index, rows.length, elapsed, reduced);
    if (arrival.alpha === 0) continue;
    visible++; renderedIds.add(point.id);
    const value = readValue(point), highlighted = point.id === selectedId;
    context.globalAlpha = (prefecture === 'all' || point.prefCode === prefecture ? .85 : .25) * arrival.alpha;
    if (definition.animation) {
      const detailed = highlighted || (detailedMarks < 140 && (view.scale > 80 || index % Math.max(1, Math.ceil(rows.length / 140)) === 0));
      drawRecordMarker(context, { x, y, radius, color, animation: definition.animation, time, index,
        selected: highlighted, arrival, reduced, value, detailed });
      if (detailed && value > 0 && arrival.progress === 1) detailedMarks++;
      continue;
    }
    context.fillStyle = color;
    context.beginPath(); context.arc(x, y, radius * arrival.scale, 0, Math.PI * 2);
    if (value === null) { context.strokeStyle = color; context.lineWidth = arrival.scale; context.stroke(); }
    else context.fill();
    if (arrival.progress === 1 && value !== null && (highlighted || index % 13 === 0)) {
      const phase = reduced ? .3 : (time / 3800 + index * .618) % 1;
      context.globalAlpha *= (1 - phase) * .42;
      context.strokeStyle = color; context.lineWidth = 1;
      context.beginPath(); context.arc(x, y, radius + 3 + phase * 13, 0, Math.PI * 2); context.stroke();
    }
  }
  context.globalAlpha = 1;
  return { visible, detailedMarks };
}
