import { EARTH_CENTER_LONGITUDE } from './world-projection.js?v=gaia-japan-center-1';
import { foodAppearance, foodValue } from './food-catalog.js?v=fao-food-country-fill-1';
import { poiArrival } from './annual-poi-arrival.js?v=gaia-annual-pop-20260909';

// Country Path2Ds use longitude+180, latitude inverted, exactly like exhibit 13.
// Draw both copies across the 30 W seam, clipped to a single geographic frame.
export const foodCountryCopies = view => [0, 360].map(repeat => ({
  x: view.originX + (repeat - EARTH_CENTER_LONGITUDE) * view.scale,
  y: view.originY,
}));

export function drawFoodCountryFill(ctx, { view, shapes, rows, kind, seriesId, selectedId, arrivalTime, reduced }) {
  let filledCount = 0, measuredCount = 0;
  const copies = foodCountryCopies(view);
  ctx.save(); ctx.beginPath(); ctx.rect(view.originX,view.originY,360*view.scale,180*view.scale); ctx.clip();
  for (const [index, shape] of shapes.entries()) {
    const arrival = poiArrival(index, shapes.length, arrivalTime, reduced);
    if (!arrival.alpha) continue;
    const value = foodValue(kind,rows.get(shape.id)), style = foodAppearance(kind,seriesId,value);
    const selected = shape.id === selectedId, measured = Number.isFinite(value);
    filledCount++; if (measured) measuredCount++;
    for (const copy of copies) {
      ctx.save(); ctx.translate(copy.x,copy.y); ctx.scale(view.scale,view.scale);
      ctx.fillStyle = style.color;
      ctx.globalAlpha = arrival.alpha * (measured ? .62 + style.fraction * .22 : .18);
      ctx.fill(shape.path,'evenodd');
      ctx.globalAlpha = arrival.alpha * (selected ? .98 : measured ? .5 : .3);
      ctx.strokeStyle = selected ? '#fff0a0' : measured ? style.color : '#9eaeb6';
      ctx.lineWidth = (selected ? 2.8 : .8)/view.scale;
      ctx.stroke(shape.path); ctx.restore();
    }
  }
  ctx.restore();
  return { filledCount, measuredCount };
}

export function pickFoodCountry(ctx, shapes, view, clientX, clientY) {
  const x = clientX-view.rect.left, y = clientY-view.rect.top;
  if (x<0 || y<0 || x>view.rect.width || y>view.rect.height || x<view.originX || x>view.originX+360*view.scale || y<view.originY || y>view.originY+180*view.scale) return null;
  ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  try {
    // Inverse-transform the pointer instead of testing against the DPR-scaled
    // canvas transform. evenodd also excludes lakes / interior holes.
    for (const copy of foodCountryCopies(view)) for (const shape of shapes) {
      const gx = (x-copy.x)/view.scale, gy = (y-copy.y)/view.scale;
      const b = shape.bounds;
      if (b && (gx<b.left || gx>b.right || gy<b.top || gy>b.bottom)) continue;
      if (ctx.isPointInPath(shape.path,gx,gy,'evenodd')) return shape.id;
    }
    return null;
  } finally { ctx.restore(); }
}
