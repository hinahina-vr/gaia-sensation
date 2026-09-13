// One selected annual file + one small history shard; no nationwide history
// download on every exhibition switch. Schema 1 stays readable during migration.
const states = new WeakMap();
const stateFor = data => {
  if (!states.has(data)) states.set(data, { years: new Map(), histories: new Map(), requests: new Map() });
  return states.get(data);
};
const fetchPart = async part => {
  if (!/^annual\/[a-z0-9-]+\/(?:\d{4}|history-\d+)\.json(?:\.gz)?$/.test(part.file)) throw new Error('Invalid annual file path');
  const url = new URL(`../../data/${part.file}?v=${part.sha256}`, import.meta.url);
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Annual file HTTP ${response.status}`);
  if (!part.file.endsWith('.gz')) return response.json();
  const bytes = await response.arrayBuffer();
  // Some asset servers transparently decompress Content-Encoding:gzip.
  const header = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  const body = header[0] === 0x1f && header[1] === 0x8b
    ? new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')) : new Blob([bytes]).stream();
  return new Response(body).json();
};
export const validateAnnualManifest = data => {
  if (![1, 2].includes(data.schemaVersion) || !Array.isArray(data.periods) || !data.periods.length) throw new Error('Invalid annual observation dataset');
  let last = -Infinity;
  for (const period of data.periods) {
    if (!Number.isInteger(period.year) || period.year <= last || !(data.schemaVersion === 1 ? period.stations?.length : period.stationCount)) throw new Error('Invalid annual period');
    last = period.year;
  }
  if (data.schemaVersion === 2 && data.historyShards?.length !== 64) throw new Error('Invalid annual history index');
  return data;
};
export const loadAnnualPeriod = async (data, year) => {
  const entry = data.periods.find(p => p.year === year);
  if (!entry) throw new Error('Annual period unavailable');
  if (data.schemaVersion === 1) return entry;
  const state = stateFor(data), key = `year-${year}`;
  if (state.years.has(year)) return state.years.get(year);
  if (!state.requests.has(key)) state.requests.set(key, fetchPart(entry).then(period => {
    if (period.year !== year || period.stations?.length !== entry.stationCount) throw new Error('Invalid annual station records');
    if (state.years.size >= 2) state.years.delete(state.years.keys().next().value);
    state.years.set(year, period);
    return period;
  }).finally(() => state.requests.delete(key)));
  return state.requests.get(key);
};
export const loadAnnualHistory = async (data, id) => {
  if (data.schemaVersion === 1) return Object.fromEntries(data.periods.map(p => [p.year, p.stations.find(s => s.id === id)]));
  const bucket = [...new TextEncoder().encode(id)].reduce((n, byte) => n + byte, 0) % 64;
  const state = stateFor(data), key = `history-${bucket}`;
  if (state.histories.has(bucket)) return state.histories.get(bucket)[id] || {};
  if (!state.requests.has(key)) state.requests.set(key, fetchPart(data.historyShards[bucket]).then(shard => {
    if (state.histories.size >= 2) state.histories.delete(state.histories.keys().next().value);
    state.histories.set(bucket, shard);
    return shard;
  }).finally(() => state.requests.delete(key)));
  return (await state.requests.get(key))[id] || {};
};
