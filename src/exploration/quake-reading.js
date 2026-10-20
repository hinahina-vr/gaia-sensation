// Display sizes, not a physical radius or an estimate of shaking intensity.
// Read recency against the feed's timestamp so cached/reference views retain
// the same relative ordering and do not age away while the user explores.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const quakeMarkerStyle = (point, referenceTime) => {
  const magnitude = Number.isFinite(point?.magnitude) ? clamp(point.magnitude, 0, 9) : 0;
  const age = Number.isFinite(point?.time) && Number.isFinite(referenceTime)
    ? clamp((referenceTime - point.time) / 86400000, 0, 1) : 1;
  return {
    core: 1.15 + magnitude * .5 + magnitude * magnitude * .055,
    radius: 10 + magnitude * 5 + magnitude * magnitude * .65,
    opacity: .38 + (1 - age) * .62,
    rings: magnitude < 2.5 ? 0 : magnitude < 5 ? 1 : 2,
    period: 11 - magnitude * .45,
  };
};

export const quakeReadingTranslations = [
  ['発生時刻', 'Occurred at', '发生时间'],
  ['円の大きさ：規模 · 光の強さ：配信時点からの新しさ', 'Circle size: magnitude · Brightness: recency at feed time', '圆圈大小：震级 · 亮度：相对数据发布时间的新近程度'],
];
