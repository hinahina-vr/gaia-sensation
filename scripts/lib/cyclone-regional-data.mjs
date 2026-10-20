// Deterministic summaries of the checked-in MAIN tracks, never a live forecast.
export const REGIONS = Object.freeze([
  { id: 'naha', name: '那覇', lat: 26.21, lon: 127.68 },
  { id: 'tokyo', name: '東京', lat: 35.68, lon: 139.76 },
  { id: 'manila', name: 'マニラ', lat: 14.60, lon: 120.98 },
  { id: 'hong_kong', name: '香港', lat: 22.32, lon: 114.17 },
  { id: 'miami', name: 'マイアミ', lat: 25.76, lon: -80.19 },
  { id: 'honolulu', name: 'ホノルル', lat: 21.31, lon: -157.86 },
  { id: 'cairns', name: 'ケアンズ', lat: -16.92, lon: 145.77 },
  { id: 'suva', name: 'スバ', lat: -18.14, lon: 178.44 },
]);
export const RADIUS_KM = 300;
export const MAX_INTERVAL_HOURS = 6;
const radians = value => value * Math.PI / 180;
export function distanceKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(radians(lat2-lat1)/2)**2
    + Math.cos(radians(lat1))*Math.cos(radians(lat2))*Math.sin(radians(lon2-lon1)/2)**2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1-a)));
}
const round = value => Math.round(value * 1000) / 1000;
export function summarizeRegion(storms, region, year) {
  const row = { year, count: 0, months: Array(12).fill(0), measured: 0, peak: null,
    speedTracks: 0, distanceKm: 0, hours: 0 };
  const seen = new Set();
  for (const storm of storms) {
    if (seen.has(storm.id)) throw new Error(`Duplicate track ${storm.id}`);
    seen.add(storm.id);
    let closest = null, nearest = Infinity, wind = null, distance = 0, hours = 0;
    for (let i = 0; i < storm.points.length; i++) {
      const p = storm.points[i], previous = storm.points[i-1];
      if (previous && p[0] <= previous[0]) throw new Error(`Unordered track ${storm.id}`);
      const d = distanceKm(region.lat, region.lon, p[1], p[2]);
      if (d > RADIUS_KM) continue;
      if (d < nearest) { nearest = d; closest = p; }
      if (Number.isFinite(p[3]) && p[3] >= 0 && (wind === null || p[3] > wind)) wind = p[3];
      // Time-weighted translation speed inside the circle. Do not bridge gaps
      // or include the unobserved entry/exit portion of a track segment.
      if (previous && p[0]-previous[0] <= MAX_INTERVAL_HOURS
          && distanceKm(region.lat, region.lon, previous[1], previous[2]) <= RADIUS_KM) {
        distance += distanceKm(previous[1], previous[2], p[1], p[2]);
        hours += p[0]-previous[0];
      }
    }
    if (!closest) continue;
    row.count++;
    row.months[new Date(closest[0]*3600000).getUTCMonth()]++;
    if (wind !== null) {
      row.measured++;
      if (!row.peak || wind > row.peak.windKnots) row.peak = { id: storm.id, name: storm.name, windKnots: wind };
    }
    if (hours > 0) { row.speedTracks++; row.distanceKm += distance; row.hours += hours; }
  }
  row.distanceKm = round(row.distanceKm); row.hours = round(row.hours);
  return row;
}
