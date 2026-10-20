// Bounded display emphasis, not health thresholds or a physical light radius.
// Keep zero/missing samples visible and selectable; never turn missing into zero.
export const observationLight = (kind, point) => {
  const value = kind === "air" ? point.pm25 : point.radiation;
  const ceiling = kind === "air" ? 100 : 1000;
  const strength = Number.isFinite(value) ? Math.sqrt(Math.max(0, Math.min(1, value / ceiling))) : 0;
  return { radius: 7 + strength * 6, opacity: .44 + strength * .5 };
};

export const observationReadingTranslations = [
  ["AOD（光学的厚さ）", "AOD (optical depth)", "AOD（光学厚度）"],
  ["日射（短波放射）", "Sunlight (shortwave radiation)", "日射（短波辐射）"],
  ["霞の色・光点の大きさ：PM2.5 · 霞の濃さ：AOD", "Haze tint / point size: PM2.5 · Haze opacity: AOD", "薄雾颜色／光点大小：PM2.5 · 薄雾浓度：AOD"],
  ["雲の濃淡：雲量 · 光点の明るさ・大きさ：日射", "Cloud opacity: cloud cover · Point brightness / size: sunlight", "云层浓淡：云量 · 光点亮度／大小：日射"],
  ["観測時刻", "Observed at", "观测时间"],
  ["火点の大きさ：FRP · 色：昼間／夜間の検知", "Point size: FRP · Color: daytime / nighttime detection", "火点大小：FRP · 颜色：日间／夜间探测"],
  ["FRPは取得データ内の最大値を基準に粒径へ変換", "FRP is scaled to point size relative to the maximum in this dataset", "火点大小按本次数据的最大FRP换算"],
];
