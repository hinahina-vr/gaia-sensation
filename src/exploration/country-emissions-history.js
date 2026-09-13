// Annual country totals from the already-loaded GCB snapshot. No interpolation,
// land-use emissions, night-light conversion or additional network data.
import { formatJapaneseNumber } from "../shared/number-format.js";
export function getCountryEmissionsSeries(rows, iso3) {
  if (!iso3 || !Array.isArray(rows)) return [];
  const years = new Map();
  for (const row of rows) {
    if (row.iso3 !== iso3 || row.year == null || row.emissionsMtCo2 == null) continue;
    const year = Number(row.year), value = Number(row.emissionsMtCo2);
    if (Number.isInteger(year) && Number.isFinite(value) && value >= 0) years.set(year, { year, value });
  }
  return [...years.values()].sort((a, b) => a.year - b.year);
}

export function getCountryEmissionsPlot(series) {
  const firstYear = series[0]?.year ?? 0, lastYear = series.at(-1)?.year ?? firstYear;
  const maximum = Math.max(0, ...series.map(row => row.value));
  const magnitude = maximum > 0 ? 10 ** Math.floor(Math.log10(maximum)) : 1;
  const ceiling = maximum > 0 ? Math.ceil(maximum / magnitude * 2) / 2 * magnitude : 1;
  const left = 52, right = 454, top = 16, bottom = 168;
  const x = year => firstYear === lastYear ? (left + right) / 2
    : left + (year - firstYear) / (lastYear - firstYear) * (right - left);
  const y = value => bottom - value / ceiling * (bottom - top);
  const points = series.map(row => ({ ...row, x: x(row.year), y: y(row.value) }));
  const path = points.map((point, index) => {
    // Missing years stay missing: do not connect across an absent record.
    const move = !index || point.year !== points[index - 1].year + 1;
    return `${move ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).join(" ");
  return { firstYear, lastYear, ceiling, left, right, top, bottom, x, y, points, path };
}

export function renderCountryEmissionsHistory(container, { rows, iso3, country, selectedYear }) {
  const series = getCountryEmissionsSeries(rows, iso3);
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const svgElement = (tag, attributes = {}, text) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    if (text != null) node.textContent = text;
    return node;
  };
  const number = (value, digits = 1) => formatJapaneseNumber(value, digits);
  if (!series.length) {
    container.replaceChildren(element("p", "country-emissions-status", "この国には表示できる経年データがありません。"));
    container.dataset.state = "empty";
    return;
  }
  const plot = getCountryEmissionsPlot(series);
  const selected = plot.points.find(row => row.year === selectedYear);
  const figure = element("figure", "country-emissions-figure");
  const caption = element("figcaption", "country-emissions-caption");
  caption.append(element("strong", "", "CO₂排出量の推移"),
    element("span", "", `${plot.firstYear}–${plot.lastYear}年 · Mt CO₂`));
  const chart = svgElement("svg", { viewBox: "0 0 470 198", role: "img", class: "country-emissions-chart",
    "aria-label": `${country}の年間CO₂排出量、${plot.firstYear}年から${plot.lastYear}年。縦軸はゼロからの線形目盛、単位はMt CO₂。${selected ? `選択年は${selected.year}年、${number(selected.value)} Mt CO₂。` : ""}各年の値は下の一覧で確認できます。` });
  chart.append(svgElement("title", {}, `${country}のCO₂排出量の経年変化`));
  for (const value of [0, plot.ceiling / 2, plot.ceiling]) {
    chart.append(svgElement("line", { x1: plot.left, x2: plot.right, y1: plot.y(value), y2: plot.y(value), class: "country-emissions-grid" }),
      svgElement("text", { x: plot.left - 9, y: plot.y(value) + 4, "text-anchor": "end" }, number(value, 2)));
  }
  const ticks = plot.firstYear === plot.lastYear ? [plot.firstYear]
    : [plot.firstYear, Math.round((plot.firstYear + plot.lastYear) / 2), plot.lastYear];
  for (const year of [...new Set(ticks)]) {
    chart.append(svgElement("text", { x: plot.x(year), y: 190, "text-anchor": "middle" }, year));
  }
  chart.append(svgElement("path", { d: plot.path, class: "country-emissions-line", "data-series-country": iso3 }));
  // Isolated observations remain visible even without an adjacent annual value.
  plot.points.forEach((point, index) => {
    if (plot.points[index - 1]?.year !== point.year - 1 && plot.points[index + 1]?.year !== point.year + 1) {
      chart.append(svgElement("circle", { cx: point.x, cy: point.y, r: 2.5, class: "country-emissions-point" }));
    }
  });
  if (selected) {
    chart.append(svgElement("line", { x1: selected.x, x2: selected.x, y1: plot.top, y2: plot.bottom, class: "country-emissions-selected-guide" }),
      svgElement("circle", { cx: selected.x, cy: selected.y, r: 4.5, class: "country-emissions-selected", "data-year": selected.year, "data-value": selected.value }));
  }
  const selectedNote = element("p", "country-emissions-selected-note", selected
    ? `● 選択年 ${selected.year}年 · ${number(selected.value)} Mt CO₂`
    : `${selectedYear}年の値はありません。`);
  const missing = plot.lastYear - plot.firstYear + 1 !== series.length;
  const note = element("p", "country-emissions-note", `GCB 2024 · 国全体の年間排出量 · 線形目盛${missing ? "（欠測年は線をつなぎません）" : ""}。土地利用変化・CO₂以外の温室効果ガスは含みません。`);
  figure.append(caption, chart, selectedNote, note);

  const details = element("details", "country-emissions-values");
  details.append(element("summary", "", `各年の値を見る（${series.length}年分）`));
  const table = element("table");
  table.append(element("caption", "", `${country} · 年間CO₂排出量（Mt CO₂）`));
  const head = element("thead"), header = element("tr");
  for (const label of ["年", "Mt CO₂"]) {
    const cell = element("th", "", label); cell.scope = "col"; header.append(cell);
  }
  head.append(header);
  const body = element("tbody");
  for (const row of series) {
    const tr = element("tr");
    if (row.year === selectedYear) tr.className = "is-selected";
    const year = element("th", "", row.year); year.scope = "row";
    const value = element("td", "", number(row.value, 3));
    value.dataset.value = String(row.value);
    tr.append(year, value); body.append(tr);
  }
  table.append(head, body);
  const scroll = element("div", "country-emissions-table-scroll");
  scroll.tabIndex = 0;
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-label", "各年の排出量一覧");
  scroll.append(table); details.append(scroll);
  container.replaceChildren(figure, details);
  container.dataset.state = "ready";
  container.dataset.country = iso3;
}
