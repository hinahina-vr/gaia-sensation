import { earthLongitudeToMapX } from "./world-projection.js?v=gaia-japan-center-1";

// Pick in CSS pixels using the same projection as the exhibit's renderer.
// The transparent canvas stays pointer-events:none; the map owns pan/pinch/tap.
export const pickProjectedPoi = (points, view, clientX, clientY, pointerType = "", isVisible = () => true) => {
  if (!view) return null;
  const x = clientX - view.rect.left;
  const y = clientY - view.rect.top;
  if (x < 0 || y < 0 || x > view.rect.width || y > view.rect.height) return null;
  const radius = pointerType === "touch" || pointerType === "pen" ? 28 : 18;
  let closest = null;
  let distanceSquared = radius * radius;
  points.forEach((point, index) => {
    if (!isVisible(point, index)) return;
    const mapX = earthLongitudeToMapX(point.lon);
    const px = view.originX + mapX * view.scale;
    const py = view.originY + (90 - point.lat) * view.scale;
    if (px < 0 || py < 0 || px > view.rect.width || py > view.rect.height) return;
    const distance = (x - px) ** 2 + (y - py) ** 2;
    if (distance <= distanceSquared) {
      closest = { point, index };
      distanceSquared = distance;
    }
  });
  return closest;
};
