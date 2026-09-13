// Human-readable coordinates; signed source values and their precision stay intact.
export const formatCoordinatesJa = (latitude, longitude, digits = 2, separator = ' ') => {
  const lat = Number(latitude), lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '位置不明';
  return `${lat >= 0 ? '北緯' : '南緯'}${Math.abs(lat).toFixed(digits)}°${separator}${lon >= 0 ? '東経' : '西経'}${Math.abs(lon).toFixed(digits)}°`;
};
