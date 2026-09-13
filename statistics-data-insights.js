import { descriptive } from "./statistics-lab-core.js";
import { discoverData } from "./statistics-discovery.js?v=gaia-readable-comparison-1-marine-cod-1-fao-food-1-i18n-20260913";

// Observation-level copy is separate from the statistical explanation. Only
// the rows used by the current analysis are supplied; no network or AI needed.
export const DATA_INSIGHT_METHODS = Object.freeze([
  "discovery",
  "summary", "scatter", "moments", "discrete", "continuous", "sampling", "unbiased",
  "interval", "difference-ci", "hypothesis", "welch", "paired", "anova", "binomial",
  "categorical", "fisher", "bh", "regression", "multiple", "logistic", "diagnostics",
  "prediction", "bayes", "mcmc", "exercise",
]);
const number = (value) => Number.isFinite(value)
  ? new Intl.NumberFormat("ja-JP", { maximumFractionDigits: Math.abs(value) > 0 && Math.abs(value) < 0.01 ? 5 : 2 }).format(value) : "—";
const named = (label) => String(label || "観測値").replaceAll("再生可能比率", "再生可能エネルギー発電割合").replaceAll("Solar", "日射").replaceAll("Wind", "風速").replace(/^CO₂$/, "CO₂濃度");
const deltaUnit = (unit) => unit === "%" ? "ポイント" : unit;
const metric = (result, key) => result.metrics?.find(([label]) => label === key)?.[1];
const temporal = (dataset) => ["year", "month", "time"].includes(dataset.xKind)
  || /^(観測)?(年|月|年月)$/.test(dataset.xLabel || "");

function timeChange(dataset, rows, unit, label) {
  if (!temporal(dataset)) return null;
  const ordered = rows.filter(row => Number.isFinite(row.x) && Number.isFinite(row.value)).sort((a, b) => a.x - b.x);
  if (ordered.length < 2 || new Set(ordered.map(row => row.x)).size !== ordered.length) return null;
  const first = ordered[0], last = ordered.at(-1), change = last.value - first.value;
  const dateYear = row => Number(String(row.label).match(/^(\d{4})(?:[-/年]|$)/)?.[1]);
  const years = dateYear(last) - dateYear(first);
  const period = Number.isFinite(years) && years > 1 ? `約${years}年間で` : "収録期間の始めと終わりで";
  return {
    headline: change === 0 ? `${label}は、期間の始めと終わりで同じ値です。`
      : `${period}、${label}が${number(Math.abs(change))}${deltaUnit(unit)}${change > 0 ? "増えています" : "減っています"}。`,
    summary: `${first.label}の${number(first.value)}${unit}から、${last.label}の${number(last.value)}${unit}へ。期間全体の始点・終点を比べた変化です。`,
    evidence: [["始点", first.value, unit], ["終点", last.value, unit], ["変化量", change, deltaUnit(unit)]],
    detail: { title: "変化を確認した範囲", body: `${first.label}〜${last.label}の${ordered.length}時点を収録。途中の上下や欠測を含む可能性があり、毎年・毎月同じ方向に動いたという意味ではありません。` },
  };
}

export function buildDataInsight(input) {
  if (input.result.dataInsight) return input.result.dataInsight;
  const statisticalReading = buildStatisticalReading(input);
  // An unavailable or unstable model must not acquire a confident headline.
  if (input.result.kind === "not-applicable" || (input.methodId === "logistic" && !input.result.model?.converged)
    || (input.methodId === "mcmc" && !(metric(input.result, "R-hat") <= 1.05))) return statisticalReading;
  return { ...discoverData(input), statisticalReading };
}

export function buildStatisticalReading({ result, dataset, rows = [], methodId, recordQuery = "" }) {
  const chart = result.chart || {};
  const unit = methodId === "unbiased" ? dataset.unit || "" : chart.unit ?? chart.yUnit ?? dataset.unit ?? "";
  const label = named(result.family === "exponential" ? chart.label : dataset.valueLabel || dataset.yLabel || dataset.title);
  const yLabel = named(dataset.yLabel || label), xLabel = named(dataset.xLabel);
  const stats = result.stats || chart.summary || descriptive(rows.map(row => row.value));
  const scope = `${dataset.title} / 現在の対象 ${rows.length}行${recordQuery ? ` / 絞り込み「${recordQuery}」` : ""}。${result.family === "exponential" || rows.some(row => row.provenance && row.provenance !== "SOURCE") ? "補完・派生値を含みます。" : "実測・出典データのみ。"}`;
  const make = (headline, summary, evidence = [], detail = null, caveat = "この結果は選択中の観測範囲についてのものです。原因や未観測の地域・将来まで断定するものではありません。") => {
    caveat = [...new Set([caveat, dataset.comparisonNote, dataset.missingCount ? `全収録期間の欠測${dataset.missingCount}年は計算から除外しています。` : ""].filter(Boolean).flatMap(note => note.split(/\n\s*\n/u)))].join("\n\n");
    return {
    methodId, headline, summary, evidence, caveat, scope,
    findings: [{ title: "データから見えたこと", body: summary }, ...(detail ? [detail] : []), { title: "どこまで言えるか", body: caveat }],
    };
  };
  if (result.kind === "not-applicable" || !stats) return make(
    "今のデータでは、この問いへの答えは出せません。",
    result.insight?.interpretation || result.insight?.meaning || "比較に必要な観測値が足りません。",
    [["対象", rows.length, "行"]], null, "条件を満たさない計算から、差や傾向を断定しません。分析の補足で不足条件を確認できます。",
  );
  const change = timeChange(dataset, rows, unit, label);
  const spread = () => {
    if (stats.range === 0) return make(`${label}は、対象内ですべて${number(stats.mean)}${unit}です。`, "今回の収録値には差がありません。他の時期や対象でも同じとは限りません。", [["観測数", stats.n, "件"], ["共通の値", stats.mean, unit]]);
    const headline = stats.skewness > 0.5 && stats.mean > stats.median
      ? `${label}は、高い値の観測が平均を押し上げています。`
      : stats.skewness < -0.5 && stats.mean < stats.median
        ? `${label}は、低い値の観測が平均を押し下げています。`
        : `${label}は${number(stats.minimum)}〜${number(stats.maximum)}${unit}に広がっています。`;
    return make(headline, `中央の50%の範囲は${number(stats.q1)}〜${number(stats.q3)}${unit}。平均${number(stats.mean)}${unit}だけでは、観測ごとの違いを表し切れません。`,
      [["平均", stats.mean, unit], ["中央値", stats.median, unit], ["最大−最小", stats.range, deltaUnit(unit)]],
      { title: "平均と典型的な値の違い", body: `小さい順で中央にある値は${number(stats.median)}${unit}です。分布の端にある値も、誤りとは限りません。観測データから地点や時点を確認できます。` });
  };
  // Category dataset values are row indices, not meaningful measurements.
  if (["culture", "pollination"].includes(dataset.id) && !["categorical", "fisher", "exercise"].includes(methodId)) {
    return make(`収録された${rows.length}件のカテゴリ記録を見ています。`, "このデータの数値は記録の整理用です。平均の大小を文化や生態系の優劣としては読めません。", [["収録記録", rows.length, "件"]], null, "カテゴリごとの内訳と、比較対象の有無を観測データで確認してください。");
  }
  if (["summary", "exercise"].includes(methodId) && result.kind === "summary") {
    return change ? make(change.headline, change.summary, change.evidence, change.detail) : spread();
  }
  if (methodId === "moments" || methodId === "continuous") {
    if (result.family === "exponential") return make(`収録された地震の発生間隔は、中央値${number(stats.median)}日です。`, `平均は${number(stats.mean)}日、最短${number(stats.minimum)}日〜最長${number(stats.maximum)}日。間隔には幅があり、次の発生日を示す値ではありません。`, [["間隔の中央値", stats.median, "日"], ["平均間隔", stats.mean, "日"], ["対象の間隔", stats.n, "件"]], null, "発生日時から計算した派生値です。独立・一定発生率の仮定は地震予知の根拠にはなりません。");
    return spread();
  }
  if (methodId === "discrete") return make(`収録された大地震の件数は、年${number(stats.minimum)}〜${number(stats.maximum)}件です。`, `年平均は${number(stats.mean)}件。年ごとの件数には差があり、平均の回数で毎年発生するわけではありません。`, [["年平均", stats.mean, "件/年"], ["最少", stats.minimum, "件/年"], ["最多", stats.maximum, "件/年"]], { title: "対象期間", body: `${rows[0]?.label}〜${rows.at(-1)?.label}のうち、選択中の${stats.n}年を比較しています。収録基準の範囲内の件数で、すべての地震の件数ではありません。` }, "年ごとの集計を、将来の発生回数や発生時期の予測としては使えません。");
  if (methodId === "sampling") return make(`${metric(result, "標本サイズ")}件だけで見ると、${label}の平均にも揺れが出ます。`, `保存データから取り直した平均は${number(metric(result, "標本平均の平均"))}${unit}。標本平均のばらつきは${number(metric(result, "標本平均の標準偏差"))}${unit}（標準偏差）です。`, [["全体平均", stats.mean, unit], ["標本平均のSD", metric(result, "標本平均の標準偏差"), unit], ["取り直した回数", metric(result, "反復"), "回"]], null, "元データ内の再抽出シミュレーションです。実際に新しい観測を行った結果ではなく、元データの偏りも残ります。");
  if (methodId === "unbiased") return make(`${label}の観測間のばらつきは、標準偏差で${number(stats.sampleSd)}${unit}です。`, `平均${number(stats.mean)}${unit}に対し、値は${number(stats.minimum)}〜${number(stats.maximum)}${unit}に分布。対象数の少なさを補正しても、観測ごとの差そのものは残ります。`, [["標本標準偏差", stats.sampleSd, unit], ["平均", stats.mean, unit], ["対象", stats.n, "件"]], null, "標準偏差は平均からの典型的なばらつきの尺度で、全件が平均±標準偏差に入る意味ではありません。");
  if (methodId === "interval") {
    const { lower, upper, estimate } = result.interval;
    return make(`${label}の平均は、${number(lower)}〜${number(upper)}${unit}を見込む推定です。`, `今回の平均は${number(estimate)}${unit}。標本から平均を推定する幅（95%信頼区間）を合わせて見ると、一点だけで言い切れないことが分かります。`, [["標本平均", estimate, unit], ["95%下限", lower, unit], ["95%上限", upper, unit]], null, "独立な無作為標本などの仮定に基づく平均の区間です。個々の観測の95%が入る範囲でも、将来予測でもありません。");
  }
  if (["difference-ci", "hypothesis", "welch", "paired"].includes(methodId)) {
    const left = descriptive(chart.left), right = descriptive(chart.right);
    if (!left || !right) return spread();
    const difference = left.mean - right.mean;
    const leftLabel = named(chart.leftLabel), rightLabel = named(chart.rightLabel);
    const measurement = label.startsWith(`${leftLabel}の`) ? label.slice(leftLabel.length + 1) : label;
    const halves = /前半|後半/.test(leftLabel + rightLabel);
    const qualification = methodId === "paired" ? "同じ年で比べると、" : halves && !temporal(dataset) ? "保存順で二分すると、" : "";
    const headline = difference === 0 ? `${qualification}${leftLabel}と${rightLabel}の平均は同じです。`
      : `${qualification}${leftLabel}の${measurement}は${rightLabel}より平均${number(Math.abs(difference))}${deltaUnit(unit)}${difference > 0 ? "高い" : "低い"}値です。`;
    const interval = chart.interval;
    const uncertain = interval?.[0] <= 0 && interval?.[1] >= 0;
    return make(headline, `${leftLabel}は平均${number(left.mean)}${unit}、${rightLabel}は平均${number(right.mean)}${unit}。${uncertain ? "差の95%区間は0を含み、母集団でも差があるとは言い切れません。" : "この差は選択中の標本で観測された差です。"}`, [[`${leftLabel}の平均`, left.mean, unit], [`${rightLabel}の平均`, right.mean, unit], ["平均差", difference, deltaUnit(unit)]],
      { title: "比較の条件", body: methodId === "hypothesis" ? `${Number.isFinite(dataset.reference) ? "データに設定された比較値" : "同じ標本の中央値から作った比較値"}との比較です。対照実験の結果ではありません。` : halves ? `${temporal(dataset) ? "時系列の保存順" : "地域や値の大小ではなく、データの保存順"}で群分けした探索的比較です。区切り方を変えると結果も変わります。` : `${leftLabel}と${rightLabel}を比較しています。${methodId === "paired" ? "一対一に対応した同年の観測です。" : "観測・補完などの作り方の違いも差に影響します。"}` }, "標本の平均差は因果効果ではありません。検定の前提と不確実性は「分析の補足」で確認できます。");
  }
  if (methodId === "anova") {
    const means = chart.groups.map((group, index) => ({ label: named(chart.labels[index]), mean: descriptive(group)?.mean })).filter(row => Number.isFinite(row.mean)).sort((a, b) => a.mean - b.mean);
    if (!means.length) return spread();
    const low = means[0], high = means.at(-1);
    return make(`${high.label}と${low.label}で、${label}の平均に${number(high.mean - low.mean)}${deltaUnit(unit)}の開きがあります。`, `最も高い群は${high.label}（${number(high.mean)}${unit}）、最も低い群は${low.label}（${number(low.mean)}${unit}）です。`, [["最大の群平均", high.mean, unit], ["最小の群平均", low.mean, unit], ["群平均の開き", high.mean - low.mean, deltaUnit(unit)]], { title: "群分けの意味", body: dataset.id === "renewables" ? "日射と風速をそれぞれ標本の中央値で高・低に分けた4群です。自然条件が発電割合の原因だと示すものではありません。" : `${temporal(dataset) ? "時系列の保存順" : "データの保存順（時間の前後ではありません）"}を三分割した探索的な群です。` }, "群平均の大小は記述的な比較です。全体の検定だけで、この2群の差が統計的に明瞭だとは断定しません。");
  }
  if (methodId === "binomial" || methodId === "bayes" || methodId === "mcmc") {
    const successes = rows.filter(row => row.value > stats.median).length;
    const threshold = `今回の中央値${number(stats.median)}${dataset.unit || ""}`;
    if (methodId === "mcmc" && !(metric(result, "R-hat") <= 1.05)) return make("推定がまだ安定せず、割合の結論は保留です。", `${threshold}を超える記録は${successes}/${stats.n}件ですが、MCMCの収束条件を満たしません。`, [["中央値超", successes, "件"], ["対象", stats.n, "件"]], null, "未収束の事後平均や区間を結論として使いません。");
    const summary = `${threshold}を超える記録は${successes}/${stats.n}件。中央値を境にした区分なので、およそ半数になる構造です。`;
    if (methodId === "binomial") return make(`${label}が中央値を超えるのは${number(successes / stats.n * 100)}%。増加の証拠ではありません。`, summary, [["中央値超", successes, "件"], ["対象", stats.n, "件"], ["区切り値", stats.median, dataset.unit]], null, "標本自身で決めた境界の上側割合です。外部の達成基準や、時間的な増加率とは異なります。");
    return make(`${label}が中央値を超える割合は、更新後の推定で${number(result.model.posteriorMean * 100)}%です。`, summary, [["観測割合", successes / stats.n * 100, "%"], ["更新後の推定", result.model.posteriorMean * 100, "%"], ["対象", stats.n, "件"]], { title: "推定に残る幅", body: `事前分布と観測を合わせた95% HDIは${number(result.model.hdi[0] * 100)}〜${number(result.model.hdi[1] * 100)}%。事前分布や境界の定義を変えると推定も変わります。` }, "中央値による教材用の二値化です。将来の増加確率や、基準達成の確率ではありません。");
  }
  if (methodId === "bh") {
    const adjusted = chart.table[1];
    const selected = adjusted.map((value, index) => value < 0.05 ? chart.categoryLevels[index] : null).filter(Boolean);
    return make(selected.length ? `複数比較の補正後も、${adjusted.length}組中${selected.length}組に平均差の手がかりが残ります。` : "複数比較を考慮すると、平均差を支持する組は残りません。", selected.length ? `${selected.join("、")}がBH補正後の5%基準を下回ります。どれだけ違うかは各群の平均と併せて確認します。` : "BH補正後に5%基準を下回る組はありません。差がないと証明されたわけではありません。", [["比較した組", adjusted.length, "組"], ["補正後の基準未満", selected.length, "組"]], { title: "比較対象", body: `${temporal(dataset) ? "時系列" : "時間の前後ではなくデータ"}の保存順を三分割した群同士を比べています。実質的な地域区分ではありません。` }, "探索的な群分けです。補正は、標本の偏りや観測の依存を解消しません。");
  }
  if (methodId === "categorical" || methodId === "fisher" || (methodId === "exercise" && chart.type === "categorical")) {
    const { table, categoryLevels, groupLevels } = chart;
    let best = null;
    categoryLevels.forEach((category, col) => {
      const rates = table.map((row, index) => ({ rate: row[col] / row.reduce((a, b) => a + b, 0), count: row[col], total: row.reduce((a, b) => a + b, 0), group: groupLevels[index] })).filter(row => Number.isFinite(row.rate)).sort((a, b) => a.rate - b.rate);
      if (rates.length < 2) return;
      const gap = rates.at(-1).rate - rates[0].rate;
      if (!best || gap > best.gap) best = { category, low: rates[0], high: rates.at(-1), gap };
    });
    if (!best) return make("比較できるカテゴリの広がりがありません。", "記録の内訳は観測データで確認できますが、この条件では群の違いを読み取れません。", [["対象", rows.length, "件"]]);
    const numericSplit = !["culture", "pollination"].includes(dataset.id);
    const group = value => numericSplit ? `${xLabel}「${value}」群` : `「${value}」群`;
    const category = numericSplit ? `${yLabel}「${best.category}」` : `「${best.category}」`;
    return make(`${category}の割合は、${group(best.high.group)}と${group(best.low.group)}で${number(best.gap * 100)}ポイント違います。`, `${group(best.high.group)}では${best.high.count}/${best.high.total}件（${number(best.high.rate * 100)}%）、${group(best.low.group)}では${best.low.count}/${best.low.total}件（${number(best.low.rate * 100)}%）。群の大きさを揃えるため、件数ではなく割合で比べています。`, [[`${best.high.group}群の割合`, best.high.rate * 100, "%"], [`${best.low.group}群の割合`, best.low.rate * 100, "%"], ["割合の差", best.gap * 100, "ポイント"]], { title: "内訳を読む条件", body: numericSplit ? "高・低は、それぞれの変数の標本中央値を超えるかどうかで区分しています。" : "保存されたカテゴリ記録内の構成比です。地域全体での普及率や自然界の頻度ではありません。" }, "これは観測された割合の差です。小さい度数や多くのカテゴリから選んだ最大差について、統計的な確かさを断定しません。");
  }
  if (methodId === "logistic") {
    if (!result.model?.converged) return make("このデータから、安定した確率の傾向はまだ読めません。", `${xLabel}と「${named(chart.outcomeLabel)}」の関係を推定しましたが、計算が収束していません。`, [["対象", result.model?.pairs?.length || rows.length, "件"]], null, "未収束の係数や予測確率をインサイトの根拠にしません。");
    const xs = descriptive(result.model.pairs.map(row => Array.isArray(row) ? row[0] : row.x));
    const probability = x => 1 / (1 + Math.exp(-(result.model.intercept + result.model.slope * x)));
    const low = probability(xs.q1) * 100, high = probability(xs.q3) * 100;
    const headline = Math.abs(high - low) < 1
      ? `${xLabel}の高低を変えても、${yLabel}が中央値を超える推定確率の差は1ポイント未満です。`
      : `${xLabel}が高い条件ほど、${yLabel}が中央値を超え${high > low ? "やすい" : "にくい"}推定です。`;
    return make(headline, `${xLabel}が${number(xs.q1)}の条件で${number(low)}%、${number(xs.q3)}の条件で${number(high)}%。収録範囲の下位25%点と上位25%点でモデルを比較した推定確率で、実際の観測割合そのものではありません。`, [["低い条件での推定", low, "%"], ["高い条件での推定", high, "%"]], null, "目的変数は中央値で二値化した教材用の区分です。原因や将来確率を断定せず、標本範囲外へ外挿しません。");
  }
  if (methodId === "multiple") {
    const r2 = metric(result, "R²");
    return make(r2 < 0.5 ? "国ごとの再生可能エネルギー発電割合の違いは、自然条件だけでは捉え切れません。" : "日射・風速・降水を合わせると、国ごとの再生可能エネルギー発電割合の違いの一部が見えてきます。", `3つの自然条件を使ったモデルで表せる標本内の変動は約${number(r2 * 100)}%。残る約${number((1 - r2) * 100)}%は、このモデルでは説明できません。`, [["モデルで表せる変動", r2 * 100, "%"], ["モデルに残る変動", (1 - r2) * 100, "%"], ["対象", metric(result, "n"), "か国"]], { title: "次に確かめたいこと", body: "政策、電源構成、設備や送電網など、未収録の条件と照らし合わせる余地があります。これらが原因だと、この分析だけで特定したわけではありません。" }, "標本内の当てはまりであり、未知の国の予測精度や、自然条件の因果効果ではありません。");
  }
  if (methodId === "prediction") {
    const prediction = metric(result, "平均xでの予測") ?? metric(result, "平均条件での予測"), lower = metric(result, "95%予測下限"), upper = metric(result, "95%予測上限");
    const conditions = dataset.id === "renewables" ? "日射・風速・降水" : xLabel;
    if (Number.isFinite(prediction)) return make(`平均的な${conditions}の条件でも、${yLabel}の推定には${number(lower)}〜${number(upper)}${unit}の幅があります。`, `モデルの中心値は${number(prediction)}${unit}。新しい1観測の95%予測区間は幅${number(upper - lower)}${deltaUnit(unit)}あり、一点の予測だけでは不確実性を隠してしまいます。`, [["予測の中心", prediction, unit], ["95%予測下限", lower, unit], ["95%予測上限", upper, unit]], { title: "予測した条件", body: `${conditions}を、収録した値の平均に置いた推定です。次の年・次の月を予測した結果ではありません。` }, "線形性、独立性、等分散性などを仮定したモデル内の区間です。現実の値域を外れる場合もあり、標本外への外挿には使いません。");
  }
  if (["scatter", "regression", "diagnostics", "exercise"].includes(methodId)) {
    const residual = metric(result, "残差SD");
    if (change) return make(change.headline, change.summary, change.evidence, methodId === "diagnostics" && Number.isFinite(residual) ? { title: "増減の一本線では残る違い", body: `観測値と直線モデルのずれは、標準偏差で${number(residual)}${unit}。期間全体の変化と、途中の上下は分けて読みます。` } : change.detail);
    const r = result.model?.correlation;
    if (Number.isFinite(r)) {
      const headline = Math.abs(r) < 0.3 ? `${xLabel}の高低だけでは、${yLabel}の高低は読み取りにくいです。` : `${xLabel}が高い観測ほど、${yLabel}も${r > 0 ? "高い" : "低い"}傾向があります。`;
      const ys = descriptive(chart.pairs.map(row => Array.isArray(row) ? row[1] : row.y));
      return make(headline, `${chart.pairs.length}組の観測を比較。${yLabel}は${number(ys.minimum)}〜${number(ys.maximum)}${unit}に分布しています。${Math.abs(r) < 0.3 ? "一方の値だけで、もう一方を判断するのは難しい関係です。" : "これは同じ対象で2つの値が結び付く傾向で、時間的な増減ではありません。"}`, [["観測の組数", chart.pairs.length, "組"], [`${yLabel}の最小`, ys.minimum, unit], [`${yLabel}の最大`, ys.maximum, unit]], { title: "この関係の使いどころ", body: methodId === "diagnostics" && Number.isFinite(residual) ? `モデルとのずれは標準偏差で${number(residual)}${unit}。個別の観測が直線から離れる理由も別途調べる必要があります。` : "同時に見るべき条件を見つける手がかりです。同じ傾向が別の期間や対象でも続くかは、追加の観測で確かめます。" }, "相関は原因を示しません。地点や時点の偏り、未収録の条件も関係に影響します。");
    }
  }
  return spread();
}
