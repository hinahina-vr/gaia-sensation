// Keep Japan near the centre. The 30°W cut lies between South America and
// Africa; Greenland may cross it, as requested.
export const EARTH_CENTER_LONGITUDE = 150;
export const earthLongitudeToMapX = (longitude) =>
  ((longitude - EARTH_CENTER_LONGITUDE + 540) % 360);

// Show the complete longitude range on desktop; portrait retains zoom/pan.
export const earthBaseScale = ({ width, height }) =>
  Math.max(0.1, width >= 901 ? width / 360 : Math.max(width / 360, height / 180));
