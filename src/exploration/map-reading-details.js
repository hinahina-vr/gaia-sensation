// Preserve measurement semantics; a display summary must not turn a missing
// value into zero, a climatology into a country average, or a scenario into an
// observation. These cards are built only when an observation is opened.
const number = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : "—";
const compass = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
export const currentReading = (row) => {
  if (!Number.isFinite(row?.uMs) || !Number.isFinite(row?.vMs)) return null;
  const speed = Math.hypot(row.uMs, row.vMs);
  const bearing = speed > 0 ? (Math.atan2(row.uMs, row.vMs) * 180 / Math.PI + 360) % 360 : null;
  return { speed, bearing, direction: bearing === null ? "—" : `${compass[Math.round(bearing / 45) % 8]}へ` };
};

export const mapReadingDetails = (id, row, context = {}) => {
  if (!row) return null;
  const common = { location: context.location || "", coordinates: context.coordinates || "" };
  switch (id) {
    case "breathing-earth":
      return { ...common, metrics: [["CO₂濃度", Number.isFinite(row.valuePpm) ? `約 ${number(row.valuePpm)} ppm` : "NO DATA"],
        ["セル幅", `${number(row.bounds?.east - row.bounds?.west)}°`]],
      timeLabel: "対象時点", time: row.frameDate, state: row.provenance, source: "GOSAT / NIES" };
    case "blue-circulation": {
      const reading = currentReading(row);
      const days = Number.isFinite(context.horizonHours) ? context.horizonHours / 24 : null;
      return { ...common, metrics: [["海流速度", `${number(reading?.speed, 2)} m/s`],
        ["流れる向き", reading?.direction || "—"],
        ["一定の流速・方向での移動試算", days === null || !reading ? "—" : `${number(reading.speed * days * 86.4)} km`],
        ["試算期間", `${number(days)} 日`]],
      currentTo: reading?.bearing, timeLabel: "観測日", time: String(row.time || "").slice(0, 10),
      state: "保存済みの海流 / 移動距離は試算", source: "NOAA CoastWatch" };
    }
    case "forest-cloud-engine": {
      const years = String(row.period || "").match(/\b(?:19|20)\d{2}\b/g);
      const period = years?.length >= 2 ? `${years[0]}–${years.at(-1)}` : row.period || "—";
      return { ...common, metrics: [["参照地点の平均降水量", `${number(row.precipitationMmDay, 2)} mm/日`]],
        timeLabel: "集計期間", time: period, state: "地点の気候平均値",
        source: "NASA POWER", model: "緑の森林域：MODIS 2023年" };
    }
    case "nothing-is-waste":
      return { ...common, metrics: [[row.datasetId === "worldbank-waw3-recycling" ? "再資源化向け回収率" : "再資源化率", `${number(row.recyclePercent)}%`]],
        timeLabel: "報告年", time: String(row.year ?? "—"), state: context.recyclingDetails || "",
        source: context.recyclingSource || "", model: "国ごとに対象・分母・報告年が異なります" };
    case "anthropocene-scar":
      return { ...common, metrics: [["化石燃料・セメント由来CO₂", `${number(row.emissionsMtCo2)} Mt CO₂`]],
        timeLabel: "排出年", time: String(row.year ?? "—"), state: "国別の年間排出量", source: "Global Carbon Budget 2024",
        model: "白い夜間光：VIIRS 2016年固定" };
    case "rhythm-of-disaster":
      return { ...common, metrics: [["マグニチュード", `M${number(row.magnitude)}`], ["深さ", `${number(row.depthKm)} km`]],
        timeLabel: "発生時刻", time: context.eventTime || "—", state: "保存済みの地震記録", source: "USGS",
        model: "広がる輪：規模から求めた推定可感範囲" };
    case "earth-organ":
      return { ...common, metrics: [["再生可能エネルギー発電割合", `${number(row.renewablePercent)}%`]],
        timeLabel: "報告年", time: String(row.year ?? "—"), state: "総発電量に占める割合", source: "World Bank",
        model: "国ごとに公表年が異なります" };
    case "population-tide":
      return { ...common, metrics: [["人口", Number.isFinite(row.population) ? `${row.population.toLocaleString("en-US", { maximumFractionDigits: 0 })} 人` : "—"]],
        timeLabel: "対象年", time: String(row.year ?? "—"), state: "国・地域の人口", source: "World Bank",
        model: "円の面積：人口に比例 / 全年共通の尺度" };
    default: return null;
  }
};

export const mapReadingTranslations = [
  ["セル幅", "Grid cell width", "网格宽度"], ["対象時点", "Reference date", "对应时间"],
  ["観測日", "Observation date", "观测日期"], ["流れる向き", "Flow direction", "流动方向"],
  ["一定の流速・方向での移動試算", "Travel estimate at constant speed / direction", "流速与方向恒定时的移动估算"],
  ["試算期間", "Projection period", "估算时段"],
  ["保存済みの海流 / 移動距離は試算", "Archived currents / estimated travel distance", "已保存的海流／移动距离为估算值"],
  ["参照地点の平均降水量", "Mean precipitation at reference site", "参考地点平均降水量"],
  ["集計期間", "Averaging period", "统计期间"], ["地点の気候平均値", "Site climatology", "地点气候平均值"],
  ["緑の森林域：MODIS 2023年", "Green forest layer: MODIS 2023", "绿色森林区域：MODIS 2023年"],
  ["報告年", "Reporting year", "报告年份"], ["排出年", "Emissions year", "排放年份"],
  ["再資源化向け回収率", "Waste collected for recycling", "为再资源化而回收的比例"],
  ["国ごとに対象・分母・報告年が異なります", "Coverage, denominators and reporting years vary by country", "各国统计对象、分母和报告年份不同"],
  ["国別の年間排出量", "Annual emissions by country", "各国年度排放量"],
  ["白い夜間光：VIIRS 2016年固定", "White night lights: fixed VIIRS 2016 reference", "白色夜间灯光：固定为VIIRS 2016年"],
  ["保存済みの地震記録", "Archived earthquake record", "已保存的地震记录"],
  ["広がる輪：規模から求めた推定可感範囲", "Expanding rings: estimated felt range based on magnitude", "扩散圆环：根据震级估算的有感范围"],
  ["総発電量に占める割合", "Share of total electricity generation", "占总发电量的比例"],
  ["国ごとに公表年が異なります", "Reporting years vary by country", "各国公布年份不同"],
  ["対象年", "Reference year", "对应年份"], ["国・地域の人口", "Country / territory population", "国家或地区人口"],
  ["円の面積：人口に比例 / 全年共通の尺度", "Circle area: proportional to population / one scale across years", "圆面积：与人口成正比／各年份使用同一比例尺"],
  ...compass.map((ja, i) => [`${ja}へ`, `To ${["N","NE","E","SE","S","SW","W","NW"][i]}`, `向${["北","东北","东","东南","南","西南","西","西北"][i]}`]),
];
