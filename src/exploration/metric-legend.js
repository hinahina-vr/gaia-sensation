// DOM counterpart of the map's CO2 quantitative legend. Values stay numeric;
// formatting, source scope and units belong to the exhibit that owns the data.
const instances = new WeakMap();
export const metricLegendProgress = (value, minimum, maximum, scale = "linear") => {
  if (![value, minimum, maximum].every(Number.isFinite) || maximum <= minimum) return null;
  if (scale === "log" && (minimum < 0 || value < 0)) return null;
  const transform = scale === "log" ? Math.log1p : value => value;
  return Math.max(0, Math.min(1, (transform(value) - transform(minimum)) / (transform(maximum) - transform(minimum))));
};

export function createMetricLegend({ className = "", label = "観測値と色の目盛り" } = {}) {
  const element = document.createElement("section");
  element.className = `gaia-metric-legend ${className}`.trim();
  element.setAttribute("aria-label", label);
  element.innerHTML = `
    <header class="gaia-metric-legend-heading"><span data-metric-scope></span></header>
    <div class="gaia-metric-legend-current"><span data-metric-title></span><strong data-metric-current>—</strong></div>
    <div class="gaia-metric-legend-context"><span data-metric-period></span><span data-metric-scale-note hidden></span></div>
    <div class="gaia-metric-legend-track" aria-hidden="true"><i data-metric-marker hidden></i></div>
    <div class="gaia-metric-legend-range"><span data-metric-minimum></span><span data-metric-maximum></span></div>`;
  const fields = Object.fromEntries(["title", "scope", "period", "current", "marker", "minimum", "maximum", "scale-note"].map(name => [name, element.querySelector(`[data-metric-${name}]`)]));
  const row = element.querySelector(".gaia-metric-legend-current");
  const measure = document.createElement("canvas").getContext("2d");
  const fit = () => {
    if (!row.clientWidth || !measure) return;
    const style = getComputedStyle(row);
    const family = style.fontFamily;
    const preferred = parseFloat(style.getPropertyValue("--metric-preferred-size")) || 21;
    measure.font = `400 ${preferred}px ${family}`;
    const textWidth = measure.measureText(fields.current.textContent).width;
    row.style.setProperty("--metric-current-size", `${Math.min(preferred, Math.max(16, preferred * row.clientWidth / Math.max(1, textWidth))).toFixed(2)}px`);
  };
  const observer = new ResizeObserver(fit);
  observer.observe(row);
  document.fonts?.ready.then(fit);
  instances.set(element, { fields, fit, observer });
  return element;
}

export function updateMetricLegend(element, { title, scope = "", period = "", current = "—", value = null,
  minimum = null, maximum = null, minimumLabel = "—", maximumLabel = "—", gradient = "", description = "", scale = "linear" }) {
  const instance = instances.get(element);
  if (!instance) return;
  const { fields, fit } = instance;
  for (const [name, content] of Object.entries({ title, scope, period, current, minimum: minimumLabel, maximum: maximumLabel })) {
    fields[name].textContent = String(content ?? "");
  }
  const progress = metricLegendProgress(value, minimum, maximum, scale);
  fields["scale-note"].textContent = scale === "log" ? "色：対数目盛" : "";
  fields["scale-note"].hidden = scale !== "log";
  element.dataset.metricScale = scale;
  fields.marker.hidden = progress === null;
  fields.marker.style.left = `${(progress ?? 0) * 100}%`;
  if (gradient) element.style.setProperty("--metric-gradient", gradient);
  element.dataset.metricValue = Number.isFinite(value) ? String(value) : "";
  element.dataset.metricMinimum = Number.isFinite(minimum) ? String(minimum) : "";
  element.dataset.metricMaximum = Number.isFinite(maximum) ? String(maximum) : "";
  element.dataset.metricProgress = progress === null ? "" : String(progress);
  element.title = description;
  const descriptionParts = [title, scope, period, current, `${minimumLabel}〜${maximumLabel}`, scale === "log" ? "色：対数目盛" : "", description].filter(Boolean);
  if (globalThis.GaiaI18n) globalThis.GaiaI18n.bind(element, "{description}", {
    get description() { return descriptionParts.map(part => globalThis.GaiaI18n.t(part)).join(globalThis.GaiaI18n.get() === "en" ? ", " : "、"); },
  }, "aria-label");
  else element.setAttribute("aria-label", descriptionParts.join("、"));
  fit();
  requestAnimationFrame(() => globalThis.GaiaMapLegendDrag?.syncObservationPanels?.());
}
