import { collectMeasurements } from './transforms.js?v=gaia-live-loading-1';
const METRICS = {
  weatherWindSpeed: ['weather', 'm/s'], weatherTemperature: ['weather', '℃'],
  weatherPrecipitation: ['weather', 'mm'], cloudCover: ['weather', '%'],
  forecastCo2: ['air', 'ppm'], pm25: ['air', 'µg/m³'],
};
export const livePeriods = (field, key) => [...new Set((field?.[METRICS[key]?.[0]]?.history || [])
  .filter(frame => Number.isFinite(Date.parse(frame.observedAt)) && frame.points?.some(point => Number.isFinite(point.measurements?.[key])))
  .map(frame => frame.observedAt))].sort();
export const liveFieldAt = (field, time) => {
  if (!time) return field;
  return Object.fromEntries(Object.entries(field || {}).map(([key, value]) => {
    if (!['weather', 'air'].includes(key)) return [key, value];
    const frame = value?.history?.find(frame => frame.observedAt === time);
    return [key, { ...value, selectedTime: time, points: frame?.points || [] }];
  }));
};
export const liveStateAt = (base, field, cityId, time) => {
  const selected = liveFieldAt(field, time);
  const events = ['weather', 'air'].flatMap(provider => {
    const data = selected?.[provider], point = data?.points?.find(point => point.id === cityId);
    if (!point?.observedAt) return [];
    return [{ provider: 'open-meteo', datasetId: provider === 'air' ? 'Open-Meteo / CAMS global atmosphere forecast' : `Open-Meteo Best Match / ${point.name}`,
      status: data.source === 'snapshot' ? 'snapshot' : data.source === 'stale-cache' ? 'stale' : 'latest-published',
      observedAt: point.observedAt, retrievedAt: data.generatedAt, provenance: data.provenance,
      location: { label: point.name, lat: point.lat, lon: point.lon },
      measurements: Object.entries(METRICS).filter(([, [p]]) => p === provider).map(([key, [, unit]]) => ({
        key, unit, value: point.measurements?.[key] ?? null, quality: 'estimated', sourceKind: 'MODEL',
      })) }];
  });
  const measurements = collectMeasurements(events);
  if (!time && !Object.keys(measurements).length) return base;
  if (!time) {
    // A city emergency snapshot can be older than the national hourly window.
    // "Latest" means the newest available sample for that city and metric.
    for (const [key, measurement] of Object.entries(base.measurements || {})) {
      if (!measurements[key] || Date.parse(measurement.observedAt) > Date.parse(measurements[key].observedAt)) measurements[key] = measurement;
    }
  }
  const saved = Object.values(measurements).every(measurement => measurement.status === 'snapshot');
  const displayEvents = time ? events : [...(base.events || []), ...events].map(event => ({ ...event,
    measurements: event.measurements?.filter(measurement => {
      const displayed = measurements[measurement.key];
      return displayed?.observedAt === event.observedAt && displayed?.datasetId === event.datasetId;
    }) || [],
  })).filter(event => event.measurements.length);
  return { ...base, events: displayEvents, measurements, selectedTime: time, source: saved ? 'snapshot' : 'live',
    connected: !time && !saved && events.every(event => event.status !== 'stale'),
    requestState: field?.requestState === 'loading' && !time ? 'loading' : 'ready' };
};
