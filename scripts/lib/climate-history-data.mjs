// Pure source parsers. Missing measurements remain null, including invalid DHW days.
export function csvFields(line) {
  const cells = []; let cell = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (quoted && line[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { cells.push(cell.trim()); cell = ''; }
    else cell += c;
  }
  if (quoted) throw new Error('Unexpected multiline CSV record');
  cells.push(cell.trim()); return cells;
}
export const measurement = raw => {
  if (raw == null || String(raw).trim() === '') return null;
  const value = Number(raw); return Number.isFinite(value) && value > -900 ? value : null;
};
export function cycloneColumns(line) {
  const columns = csvFields(line.replace(/^\uFEFF/, ''));
  const required = ['SID','SEASON','NAME','BASIN','ISO_TIME','LAT','LON','USA_WIND','WMO_PRES','TRACK_TYPE','USA_AGENCY'];
  for (const key of required) if (!columns.includes(key)) throw new Error(`Missing IBTrACS column ${key}`);
  return Object.fromEntries(required.map(key => [key, columns.indexOf(key)]));
}
export function cycloneRecord(line, columns) {
  const row = csvFields(line), get = key => row[columns[key]], year = Number(get('SEASON'));
  if (!Number.isInteger(year) || year < 1980 || year > 2024 || get('TRACK_TYPE').toUpperCase() !== 'MAIN') return null;
  const lat = measurement(get('LAT')), lon = measurement(get('LON'));
  const time = Date.parse(get('ISO_TIME').replace(' ', 'T') + 'Z') / 3600000;
  if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 360 || !Number.isFinite(time)) throw new Error(`Invalid IBTrACS coordinate/time: ${get('SID')} ${get('ISO_TIME')} ${lat},${lon}`);
  const wind = measurement(get('USA_WIND')), pressure = measurement(get('WMO_PRES'));
  return { year, id: get('SID'), name: get('NAME'), basin: get('BASIN'),
    point: [time, lat, ((lon + 540) % 360) - 180, wind != null && wind >= 0 ? wind : null, pressure != null && pressure > 0 ? pressure : null, get('USA_AGENCY')] };
}
export function summarizeCyclones(storms) {
  let maximum = null, strongest = null, measured = 0;
  for (const storm of storms) {
    const values = storm.points.map(p => p[3]).filter(Number.isFinite);
    if (values.length) measured++;
    const peak = values.length ? Math.max(...values) : null;
    if (peak != null && (maximum == null || peak > maximum)) { maximum = peak; strongest = storm.id; }
  }
  return { count: storms.length, measured, maximum, strongest };
}
export function parseCoral(text, id) {
  const lines = text.split(/\r?\n/).map(line => line.trim());
  const after = label => lines[lines.indexOf(label) + 1];
  const name = after('Name:'), lon = measurement(after('Polygon Middle Longitude:')), lat = measurement(after('Polygon Middle Latitude:'));
  if (!name || lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error(`Invalid CRW metadata: ${id}`);
  const header = lines.findIndex(line => line.startsWith('YYYY MM DD '));
  if (header < 0 || !lines[header].includes('DHW_from_90th_HS>1')) throw new Error(`Invalid CRW columns: ${id}`);
  const years = new Map(), seen = new Set();
  for (const line of lines.slice(header + 1)) {
    if (!line) continue;
    // Some official rows end before DHW (e.g. Tuamotu 2002-04-13).
    // Retain that date as missing; never shift the preceding SST into DHW.
    const cells = line.split(/\s+/); if (cells.length < 3 || cells.length > 10) throw new Error(`Invalid CRW row: ${id}`);
    const [year, month, day] = cells.map(Number);
    if (year < 1986 || year > 2025) continue; // complete years, after the initial 84-day accumulation window
    const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if (seen.has(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date) throw new Error(`Duplicate/invalid CRW date: ${id} ${date}`);
    seen.add(date);
    const dhw = measurement(cells[8]); if (dhw == null || dhw < 0) continue;
    if (!years.has(year)) years.set(year, { year, max: null, peakDate: '', days4: 0, days8: 0, validDays: 0, monthly: Array(12).fill(null) });
    const row = years.get(year); row.validDays++;
    if (row.max == null || dhw > row.max) { row.max = dhw; row.peakDate = date; }
    if (dhw >= 4) row.days4++; if (dhw >= 8) row.days8++;
    row.monthly[month - 1] = Math.max(row.monthly[month - 1] ?? 0, dhw);
  }
  if (!years.size) throw new Error(`No valid CRW years: ${id}`);
  return { id, name, lon, lat, years: [...years.values()] };
}
