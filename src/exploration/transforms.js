const RANGES = Object.freeze({
  windSpeed: [0, 45],
  airTemperature: [-20, 45],
  co2: [280, 650],
  precipitation: [0, 30],
  no2: [0, 0.0003],
  weatherWindSpeed: [0, 45],
  weatherTemperature: [-20, 45],
  weatherPrecipitation: [0, 30],
  cloudCover: [0, 100],
  forecastCo2: [280, 650],
  pm25: [0, 150],
});

export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const normalizeMeasurement = (key, value) => {
  const range = RANGES[key];
  if (!range || !Number.isFinite(Number(value))) return null;
  return clamp((Number(value) - range[0]) / (range[1] - range[0]), 0, 1);
};

export const collectMeasurements = (events = []) => {
  const result = {};
  for (const event of events) {
    for (const measurement of event?.measurements || []) {
      if (measurement?.value == null || measurement?.quality === "missing" || !Number.isFinite(Number(measurement?.value))) continue;
      result[measurement.key] = {
        ...measurement,
        provider: event.provider,
        datasetId: event.datasetId,
        status: event.status,
        observedAt: event.observedAt,
        location: event.location ? { ...event.location } : null,
        normalized: normalizeMeasurement(measurement.key, measurement.value),
      };
    }
  }
  return result;
};

export const toSoundParameters = (measurements = {}) => {
  const wind = measurements.weatherWindSpeed?.normalized ?? measurements.windSpeed?.normalized;
  const temperature = measurements.weatherTemperature?.normalized ?? measurements.airTemperature?.normalized;
  const co2 = measurements.forecastCo2?.normalized ?? measurements.co2?.normalized;
  const precipitation = measurements.weatherPrecipitation?.normalized ?? measurements.precipitation?.normalized;
  const no2 = measurements.pm25?.normalized ?? measurements.no2?.normalized;
  return Object.freeze({
    noiseGain: wind == null ? null : 0.004 + wind * 0.045,
    noiseCutoff: wind == null ? null : 260 + wind * 2_600,
    baseFrequency: temperature == null ? null : 48 + temperature * 52,
    lfoFrequency: co2 == null ? null : 0.025 + co2 * 0.12,
    detune: co2 == null ? null : -8 + co2 * 18,
    pulseDensity: precipitation == null ? null : 0.2 + precipitation * 9,
    resonance: no2 == null ? null : 0.5 + no2 * 8,
  });
};

export const STATUS_LABELS = Object.freeze({
  "near-real-time": "NEAR REAL TIME",
  "latest-published": "LATEST PUBLISHED",
  stale: "STALE",
  snapshot: "SNAPSHOT",
});
