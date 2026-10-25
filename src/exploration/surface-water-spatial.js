import {earthBaseScale, earthLongitudeToMapX} from './world-projection.js?v=gaia-japan-center-1';

export const LAKE_CLASSES = ['観測なし', '水域外', '季節的水域', '通年水域'];
export const lakeClass = red => red === 63 ? 3 : red === 138 ? 2 : red === 12 ? 1 : 0;

// North-up samples of the exact WGS84 window. Project bounds rather than the
// PNG's latitude-corrected natural aspect ratio. Never interpolate classes.
export function lakeRasterRect(bounds, view) {
  const [west,south,east,north] = bounds;
  return {x:view.x+earthLongitudeToMapX(west)*view.scale, y:view.y+(90-north)*view.scale,
    width:(east-west)*view.scale, height:(north-south)*view.scale};
}
export function lakeCellAt(bounds, width, height, lon, lat) {
  const [west,south,east,north] = bounds;
  if (lon<west || lon>east || lat<south || lat>north) return null;
  return {x:Math.min(width-1,Math.floor((lon-west)/(east-west)*width)),
    y:Math.min(height-1,Math.floor((north-lat)/(north-south)*height))};
}
export function lakeFitCamera(bounds, rect, area) {
  const [west,south,east,north] = bounds;
  const scale=Math.max(1,Math.min(area.width/(east-west),area.height/(north-south))*.9);
  return {lon:(west+east)/2,lat:(south+north)/2,zoom:Math.min(512,scale/earthBaseScale(rect)),
    targetX:(area.x+area.width/2)/rect.width,targetY:(area.y+area.height/2)/rect.height};
}
