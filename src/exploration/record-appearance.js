// Catalogs use immutable stops and colors. Parse their palette and logarithmic
// endpoints once, rather than once per station in every newly loaded year.
const scales = new WeakMap();
const identity = value => value;
const logarithmic = value => Math.log10(1 + value);
function scaleFor(definition) {
  const { stops, colors, logScale } = definition;
  let scale = scales.get(definition);
  if (scale && scale.stops === stops && scale.colors === colors && scale.logScale === logScale) return scale;
  const transform = logScale ? logarithmic : identity;
  const min = stops[0], max = stops.at(-1), low = transform(min), high = transform(max);
  scale = { stops, colors, logScale, transform, min, max, low, high,
    rgb: colors?.map(hex => hex.match(/[a-f0-9]{2}/gi).map(n => parseInt(n, 16))) };
  // Mutable ad-hoc definitions remain supported, without stale cache entries.
  if (Object.isFrozen(stops) && (!colors || Object.isFrozen(colors))) scales.set(definition, scale);
  return scale;
}
function fraction(scale, value) {
  return (scale.transform(Math.max(scale.min, Math.min(scale.max, value))) - scale.low) / (scale.high - scale.low);
}
export const displayFraction = (definition, value) => fraction(scaleFor(definition), value);
export function recordAppearance(definition, value) {
  if (!Number.isFinite(value)) return { color: '#abb5be', radius: 2.2 };
  const scale = scaleFor(definition), amount = fraction(scale, value), scaled = amount * (scale.rgb.length - 1);
  const low = Math.floor(scaled), high = Math.min(low + 1, scale.rgb.length - 1), blend = scaled - low;
  const a = scale.rgb[low], b = scale.rgb[high];
  return { color: `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * blend)).join(', ')})`, radius: 2.5 + Math.sqrt(amount) * 4.5 };
}
