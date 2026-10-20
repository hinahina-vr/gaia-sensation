// Meteorological bearings describe where wind comes FROM. Screen vectors
// point where it travels TO (screen y increases downwards).
const directions = [
  ['北', 'N', '北'], ['北北東', 'NNE', '东北偏北'], ['北東', 'NE', '东北'], ['東北東', 'ENE', '东北偏东'],
  ['東', 'E', '东'], ['東南東', 'ESE', '东南偏东'], ['南東', 'SE', '东南'], ['南南東', 'SSE', '东南偏南'],
  ['南', 'S', '南'], ['南南西', 'SSW', '西南偏南'], ['南西', 'SW', '西南'], ['西南西', 'WSW', '西南偏西'],
  ['西', 'W', '西'], ['西北西', 'WNW', '西北偏西'], ['北西', 'NW', '西北'], ['北北西', 'NNW', '西北偏北'],
];
export const windReadingTranslations = directions.map(([ja, en, zh]) =>
  [`風向 · ${ja}から`, `Wind · from ${en}`, `风向 · 来自${zh}`]);

export const windReading = (point) => {
  if (!Number.isFinite(point?.windDirection) || !(point?.windSpeed > 0)) return null;
  const from = ((point.windDirection % 360) + 360) % 360;
  const radians = (from + 180) * Math.PI / 180;
  return {
    from, dx: Math.sin(radians), dy: -Math.cos(radians),
    label: windReadingTranslations[Math.round(from / 22.5) % 16][0],
  };
};
