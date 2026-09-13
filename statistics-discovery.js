import { analyzeSummary, descriptive, simpleRegression } from "./statistics-lab-core.js";
import { buildSocialInsight } from "./statistics-social-insights.js";
import { buildDecisionInsight } from "./statistics-decision-insights.js";

// Exploratory findings are selected from the records, not from a catalogue of
// statistic-to-sentence templates. Scores order questions, never confidence.
const fmt = value => Number.isFinite(value) ? new Intl.NumberFormat("ja-JP", { maximumFractionDigits: Math.abs(value) < .01 && value !== 0 ? 4 : 2 }).format(value) : "—";
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const sum = values => values.reduce((total, value) => total + value, 0);
const numeric = value => typeof value === "number" && Number.isFinite(value);
const name = row => String(row.countryJa || row.label || row.name || row.id || "対象").replace(/^\d{2} /u, "");
const ids = rows => rows.map(row => String(row.id));
const pp = unit => unit === "%" ? "ポイント" : unit;
const almost = (a, b, scale = 1) => Math.abs(a - b) <= Math.max(1, scale) * 1e-9;

const DOMAIN_BY_ID = {
  "co2-trend": "co2", "jma-co2": "co2-paired", "ocean-currents": "ocean", "wind-climate": "wind",
  rainfall: "water", waste: "recycling", "emissions-urban": "emissions", earthquakes: "earthquakes",
  "forest-urban": "ecologies", renewables: "renewables", population: "population", culture: "culture", pollination: "pollination",
  "nasa-firms-active-fire-24h": "fire",
  "planet-global-wind-pressure": "wind", "planet-global-aerosol-light": "aerosol",
  "planet-usgs-earthquake-ripples": "quake-events", "planet-global-cloud-radiance": "cloud",
  "live-wind-field": "wind", "live-carbon-pulse": "city-co2", "live-rain-chorus": "city-rain",
  "live-temperature-field": "city-temperature", "live-cloud-drift": "city-cloud", "live-pm25-haze": "city-aerosol",
  "estat-prefecture-migration": "migration", "estat-prefecture-lodging": "lodging", "estat-prefecture-housing": "housing",
  "estat-prefecture-averageTemperature": "temperature", "estat-prefecture-summerHigh": "temperature-high",
  "estat-prefecture-winterLow": "temperature-low", "estat-prefecture-relativeHumidity": "humidity",
  "estat-prefecture-sunshineHours": "sunshine", "estat-prefecture-precipitation": "water", "estat-prefecture-rainyDays": "rain-days",
};

const CONTEXT = {
  fire: { object: "検知点", issue: "光点の数だけで追うと、少数の強い熱放射を見落としかねません。", question: "熱の集中は同じ場所で続くのか、それとも観測機会が重なっただけか？", need: "同じ領域の複数日の検知、衛星の通過・雲による欠測、土地被覆を照合する。", limit: "FRPは検知時の放射パワーです。異なる観測時刻の合計は同時の出力や放出エネルギーではなく、焼失面積・被害・出火原因も表しません。" },
  population: { object: "国・地域", issue: "国の数で均等に見ることと、人の数に応じて暮らしの基盤を考えることは、違う優先順位になります。", question: "人口が集まる国の中で、住まい・交通・教育を必要とする人はどこにいるのか？", need: "都市・地方別、年齢別の人口と、各サービスへの到達性を加える。総人口から需要の場所や種類は決めない。", limit: "収録された国・地域の総人口です。人口密度・年齢構成・豊かさ・環境負荷の比較ではありません。" },
  emissions: { object: "国・地域", issue: "国を一つずつ同じ重さで扱うと、排出総量に大きく関わる対象が見えにくくなります。", question: "排出の大きい対象の、どの部門・用途から違いが生まれているのか？", need: "産業・電力・輸送別の排出、人口当たりと消費ベースの排出を分けて比較する。", limit: "この年の国別化石燃料由来CO₂です。個人の責任、消費先、歴史的累積、排出削減の容易さは分かりません。" },
  lodging: { object: "都道府県", issue: "宿泊の受け入れが偏るなら、人手や交通を全国一律の規模で考えるだけでは地域の条件を捉えられません。", question: "宿泊が集中する土地で、受け入れ能力と日々の暮らしは釣り合っているか？", need: "客室数・稼働率・宿泊業の就業者数と、複数月の推移を照合する。集中だけで混雑や人手不足と決めない。", limit: "年間の延べ宿泊者数です。旅行者の実人数、観光収入、日帰り客、混雑の程度ではありません。" },
  housing: { object: "都道府県", issue: "建設の動きが集まる場所と、住まいに困る人がいる場所は同じとは限りません。", question: "新しく建てている場所は、必要な住まいを必要な人に増やせているか？", need: "空き家率、家賃・住宅価格、世帯数、完成戸数を同じ地域・時期で重ねる。着工戸数を需要の代わりにしない。", limit: "年間の新設住宅着工戸数で、完成戸数・空き家・不足戸数ではありません。人口規模の違いも未調整です。" },
  recycling: { object: "国・地域", issue: "再資源化率の高低だけを目標にすると、そもそもごみを出さない工夫や、回収後の使い道が抜け落ちます。", question: "高い率を支えているのは、回収・分別・再生材の需要のどの違いか？", need: "同年・同じごみ定義で、一人当たり発生量、回収方式、再生材の利用先を比較する。", limit: "都市ごみ再資源化率の公表値で、総量や処理先は不明です。報告年・集計定義が異なり、補完値で国を評価しません。" },
  renewables: { object: "国・地域", issue: "自然条件の良さだけで電気のつくり方が決まる、と考えるには説明しきれない違いがあります。", question: "似た自然条件で発電割合が違うのは、どの電源・設備・制度の違いか？", need: "水力を含む電源別発電量、設備容量、需要、送電・制度の情報を加え、まず同年の二国を比較する。", limit: "発電割合には水力なども含みます。日射・風は国全域ではなく代表地点。公表年が異なり、政策効果や導入可能量は推定していません。" },
  ecologies: { object: "国", issue: "都市に住む人の多さだけで、森を残せるかどうかを説明するのは難しそうです。", question: "都市居住の割合が近い国で、森林を残す条件は何が違うのか？", need: "気候、国土の広さ、土地利用・森林定義、森林の増減を同じ年で比較する。都市人口率は都市の面積率ではない。", limit: "森林率は陸地、都市人口率は人口が分母です。基準年も異なり、この二国の違いを都市化の因果効果とはみなしません。" },
  wind: { object: "地点", issue: "風を地域全体の一つの条件として扱うと、静かな場所と強い場所の違いを取り逃がします。", question: "この風の差は地形に沿って続くのか、それともこの時刻に限られるか？", need: "同じ地点の時間変化と、地形・風向・地表条件を照合する。代表地点の値を街路や屋内へそのまま当てはめない。", limit: "代表地点のモデル値または保存期間の平均です。実際の移動経路、風力発電量、局所の安全性を判定しません。" },
  water: { object: "地点", issue: "雨が多い・少ないという一つの平均だけでは、水を使える時期や雨に左右される仕事は見えてきません。", question: "同じくらいの水が降る土地でも、雨が降る日や季節はどう違うのか？", need: "月別・日別の降水、雨日数、貯留・利用量を照合する。年合計や平均から豪雨・渇水の被害を推定しない。", limit: "代表地点の収録期間の降水量です。県全域の水量、短時間の降雨強度、利用可能な水資源を直接示しません。" },
  humidity: { object: "地点", issue: "同じ湿度対策をどの土地にも当てはめる前に、空気の湿り方の違いを確かめる必要があります。", question: "湿度の違いは、気温を揃えても残るか？", need: "同地点・同時刻の気温と露点または絶対湿度を加え、季節別に比較する。年平均だけで室内環境を判断しない。", limit: "年平均相対湿度は気温に依存する割合です。水蒸気量そのものや今日の蒸し暑さではありません。" },
  sunshine: { object: "地点", issue: "日照時間の違いは、作物や屋外活動を同じ暦で考えてよいかを問い直す入口になります。", question: "日が差す時間の差は、必要な季節にも同じように残るか？", need: "月別の日照と作付け・活動時期を重ねる。発電を考える場合は日照時間ではなく日射量・設備条件を追加する。", limit: "代表地点の年間日照時間です。日射エネルギー、発電量、昼の長さではありません。" },
  "rain-days": { object: "地点", issue: "年間の雨量が同じでも、雨で予定を組み替える日の多さは同じとは限りません。", question: "雨の量よりも、雨の日の多さが仕事や移動の制約になっている土地はどこか？", need: "同年の年間降水量と日別の降り方、仕事・交通の記録を照合する。雨日数だけで損失を決めない。", limit: "年ごとの雨日数です。雨の強さや降水量ではなく、雨日以外をすべて晴天ともみなしません。" },
  aerosol: { object: "地点", issue: "空の霞を見ていることと、人が吸う高さの空気を把握することは同じではありません。", question: "目立つ霞と地表付近の微粒子は、同じ場所に重なっているか？", need: "同時刻の地上観測、風向・降水、鉛直分布を照合する。発生源や個人の曝露量は別の情報で確かめる。", limit: "PM2.5とエアロゾル光学的厚さは異なる量のモデル値です。汚染源、個人の曝露量、健康被害は判定しません。" },
  cloud: { object: "地点", issue: "雲の多さだけで、地上に届く光を見積もる見方には抜けがあります。", question: "雲量が近いのに光が違う地点で、時刻・緯度・雲の厚さはどう違うのか？", need: "現地の太陽高度と時刻、雲の鉛直構造を追加して比べる。夜の低い日射を雲の影響と解釈しない。", limit: "雲量と短波放射は全球のモデル値です。昼夜・緯度も異なるため、雲による減光の因果効果や発電量を示しません。" },
};

const fallbackContext = { object: "対象", issue: "全体を一つの代表値で捉える前に、対象によって違う条件がないかを確かめたいところです。", question: "違いが残る対象には、何の条件が共通しているか？", need: "対象の属性、観測時期と集計方法を揃え、別の期間でも比較する。", limit: "選択中の記録に限った探索です。原因、標本外の対象、将来まで断定しません。" };
const domainFor = dataset => DOMAIN_BY_ID[dataset.id] || dataset.insightContext?.domain || "generic";
const contextFor = domain => CONTEXT[domain] || fallbackContext;
const timeRows = (dataset, rows) => {
  if (!(dataset.xKind === "year" || dataset.xKind === "month" || dataset.insightContext?.axis === "time-series" || /^(観測)?(年|月|年月)$/u.test(dataset.xLabel || ""))) return [];
  const result = rows.filter(row => numeric(row.x) && numeric(row.value)).sort((a, b) => a.x - b.x || String(a.id).localeCompare(String(b.id)));
  return new Set(result.map(row => row.x)).size === result.length ? result : [];
};
const periodLabel = value => /^\d{4}$/.test(String(value)) ? `${value}年` : String(value);
const rangeLabel = rows => `${periodLabel(rows[0].label)}〜${periodLabel(rows.at(-1).label)}`;
export const annualAxisTicks = rows => rows.filter((_, i) => i === rows.length - 1 || i % Math.max(1, Math.ceil((rows.length - 1) / 7)) === 0).map(row => row.x);
const pointChart = (rows, { x = "x", y = "value", xLabel, yLabel, unit, highlight = [], line = false } = {}) => {
  const selected = rows.filter(row => numeric(row[x]) && numeric(row[y]));
  return { type: "scatter", pairs: selected.map(row => ({ x: row[x], y: row[y] })), rows: selected,
    xLabel, yLabel, unit, yUnit: unit, highlightIds: ids(highlight),
    ...(line && selected.length >= 3 ? { line: simpleRegression(selected.map(row => row[x]), selected.map(row => row[y]))?.coefficients } : {}) };
};
const rankedChart = (rows, label, unit, highlight = []) => {
  const ranked = [...rows].sort((a, b) => b.value - a.value || String(a.id).localeCompare(String(b.id))).map((row, index) => ({ ...row, discoveryRank: index + 1 }));
  return pointChart(ranked, { x: "discoveryRank", xLabel: "値の順位（高い順）", yLabel: label, unit, highlight });
};

function addCandidate(candidates, candidate) {
  // Feature extractors must supply an observation, a consequence and a test.
  if (!candidate.signal || !candidate.meaning || !candidate.question || !candidate.test) return;
  if (!candidate.evidence?.every(([, value]) => typeof value === "string" || numeric(value))) return;
  candidates.push({ status: "exploratory", recordIds: [], ...candidate });
}

function temporalCandidates(candidates, dataset, rows, domain) {
  const ordered = timeRows(dataset, rows);
  if (ordered.length < 6) return;
  const label = dataset.valueLabel || dataset.yLabel || "観測値", unit = dataset.unit || "";
  const stats = descriptive(ordered.map(row => row.value));
  if (!stats || stats.range === 0) return;
  const windowSize = Math.max(3, Math.min(dataset.xKind === "month" ? 24 : 10, Math.floor(ordered.length / 4)));
  const early = ordered.slice(0, windowSize), late = ordered.slice(-windowSize);
  const before = mean(early.map(row => row.value)), after = mean(late.map(row => row.value)), change = after - before;
  const rising = change > 0, magnitude = Math.abs(change);
  const isTemperature = domain.startsWith("temperature"), isCo2 = domain === "co2";
  const lateAbove = late.filter(row => row.value > Math.max(...early.map(row => row.value))).length;
  const lateBelow = late.filter(row => row.value < Math.min(...early.map(row => row.value))).length;
  const separated = Math.max(lateAbove, lateBelow) / late.length;
  const subject = isTemperature ? "気温" : isCo2 ? "CO₂" : label;
  const social = {
    migration: { practical: "過去の人口移動を前提にした住まい・交通・教育の配置", need: "同じ県の年齢別人口移動、世帯数、雇用や就学の記録を照合する。転入超過と出生・死亡を含む人口増減を区別する。" },
    housing: { practical: "過去の着工規模を前提にした住まいの供給計画", need: "同じ県の世帯数、空き家、完成戸数や家賃を年ごとに比較する。着工の増減だけで住宅不足や余剰を判断しない。" },
    lodging: { practical: "過去の宿泊規模を前提にした施設や人員の配置", need: "同じ従業者規模の施設で、客室数・稼働率・就業者数と月別の宿泊を比較する。年計から繁忙期の混雑や人手不足を断定しない。" },
  }[domain];
  const practical = social?.practical || (isTemperature ? (domain === "temperature-low" ? "寒さを前提にした暖房や生態系の暦" : domain === "temperature-high" ? "日中の高温を前提にした仕事や作物の管理" : "過去の気温を前提にした住まい・仕事・生きものの暦") : "過去の値を基準にした見方");
  const interpretation = isCo2
    ? rising ? "一時的に増え方が弱まっても、空気中に残るCO₂の水準は別の問題です。『増加を遅らせる』と『濃度を下げる』を分けて考える必要があります。" : "この選択期間では水準が下がっています。ただし排出の減少、吸収の変化、観測の影響のどれかをこの系列だけで特定できません。"
    : `${practical}を、そのまま今の条件として使ってよいかが問いになります。一年だけの記録より、複数年の水準の違いに注目します。`;
  const specificLimit = isTemperature ? `${domain === "temperature-high" ? "毎日の日最高気温の年平均で、夏の最高記録や猛暑日数ではありません。" : domain === "temperature-low" ? "毎日の日最低気温の年平均で、冬の最低記録や冬日数ではありません。" : "代表観測地点の年平均気温で、県全域の平均ではありません。"} 都市化・観測環境などの要因は切り分けていません。` : "選択された期間の比較で、将来予測や原因の特定ではありません。時系列の依存や欠測にも注意が必要です。";
  if (magnitude >= stats.range * .12) addCandidate(candidates, {
    id: "baseline-shift", lens: "昔の基準が今も通じるか", method: "複数時点の水準比較", score: 68 + separated * 20,
    title: separated >= .6 ? `${subject}は、一度の突出より「平常の水準」の変化が気になります。` : `${subject}の${rising ? "上昇" : "低下"}を、始点と終点だけで片づけない。`,
    signal: `${rangeLabel(early)}の平均${fmt(before)}${unit}に対し、${rangeLabel(late)}は${fmt(after)}${unit}。${fmt(magnitude)}${pp(unit)}${rising ? "高く" : "低く"}、後の${late.length}時点中${rising ? lateAbove : lateBelow}時点が、前の期間の${rising ? "最高値を上回りました" : "最低値を下回りました"}。`,
    meaning: interpretation,
    question: isCo2 ? "濃度の増加が鈍る時期と、濃度そのものが下がる時期は、どこで違うのか？" : `${name(ordered[0]).match(/^\d/u) ? dataset.title.split(" — ").at(-1).split("（")[0] : "この地点"}で、過去の${isTemperature ? "気温" : label}を前提にしている活動は何か？`,
    test: isCo2 ? "季節調整済み濃度の年ごとの増分を並べ、排出量・陸海の吸収量の別データと照合する。濃度と排出量を同じ量として比較しない。" : social?.need || "同じ観測地点の日別・季節別データで変化を分け、活動時期や必要な設備条件とのずれを確かめる。期間を5年・10年などに変えて結論が残るかも確認する。",
    caveat: specificLimit, evidence: [["前の期間の平均", before, unit], ["後の期間の平均", after, unit], ["水準の差", change, pp(unit)]],
    recordIds: ids([...early.slice(0, 1), ...late.slice(-2)]),
    calculation: `時間順に最初と最後の各${windowSize}時点を比較。窓は探索用で有意差検定・変化点の確定ではない。`,
    chart: pointChart(ordered, { xLabel: dataset.xLabel, yLabel: label, unit, line: true, highlight: [...early.slice(0, 1), ...late.slice(-2)] }),
  });
  if (dataset.xKind === "year") {
    const ranked = [...ordered].sort((a, b) => a.value - b.value), low = ranked[0], high = ranked.at(-1);
    addCandidate(candidates, {
      id: "yearly-variability", lens: "一年の値で長い時間を代表できるか", method: "年ごとの幅と中央層の比較", score: 48,
      title: `${subject}は、平均の一年だけでは捉えきれない。`,
      signal: `${low.label}年の${fmt(low.value)}${unit}から${high.label}年の${fmt(high.value)}${unit}まで幅があります。有効な${ordered.length}年の中央の半数は${fmt(stats.q1)}〜${fmt(stats.q3)}${unit}です。`,
      meaning: `${practical}を考えるとき、典型的な年だけでなく、値が離れた年にどんな条件があったかを確かめる必要があります。`,
      question: `${low.label}年と${high.label}年の違いは、継続する変化なのか、一時的な条件や集計方法によるものか？`,
      test: social?.need || "元の月別・日別データと観測地点・測器の履歴を照合する。多い年・少ない年だけで気候の変化や被害を断定しない。",
      caveat: specificLimit, evidence: [[`${low.label}年`, low.value, unit], [`${high.label}年`, high.value, unit], ["有効な年", ordered.length, "年"]],
      recordIds: ids([low, high]), calculation: "同じ対象の年別値から最小・最大と四分位を計算。欠測は除外し、年を地域として数えない。",
      chart: pointChart(ordered, { xLabel: "年", yLabel: label, unit, highlight: [low, high] }),
    });
  }
  // Separate rates from levels; never infer acceleration from a larger endpoint.
  if (ordered.length >= 16) {
    const middle = Math.floor(ordered.length / 2), first = ordered.slice(0, middle), last = ordered.slice(middle);
    const a = simpleRegression(first.map(row => row.x), first.map(row => row.value));
    const b = simpleRegression(last.map(row => row.x), last.map(row => row.value));
    const slopeA = a?.slope ?? a?.coefficients?.[1], slopeB = b?.slope ?? b?.coefficients?.[1];
    const span = ordered.at(-1).x - ordered[0].x;
    if (numeric(slopeA) && numeric(slopeB) && span > 0 && Math.abs(slopeB - slopeA) * span > stats.range * .3) {
      const accelerating = slopeA > 0 && slopeB > slopeA * 1.25;
      const slowing = slopeA > 0 && slopeB > 0 && slopeB < slopeA * .75;
      const reversal = slopeA * slopeB < 0;
      if (accelerating || slowing || reversal) addCandidate(candidates, {
        id: "pace-change", lens: "水準と変わる速さを分ける", method: "前後の傾きの比較", score: accelerating ? 91 : reversal ? 86 : 78,
        title: accelerating ? `${subject}は、増えているだけでなく、後半ほど増えるペースが速い。` : slowing ? `${subject}の増え方は鈍っても、まだ下がってはいません。` : `${subject}を一本の傾きで見ると、途中の方向転換を消してしまう。`,
        signal: `${rangeLabel(first)}では年あたり${fmt(slopeA)}${pp(unit)}、${rangeLabel(last)}では${fmt(slopeB)}${pp(unit)}の直線傾向です。前後で同じ変化率とは読めません。`,
        meaning: `${rangeLabel(first)}の年あたり${fmt(slopeA)}${pp(unit)}に対し、${rangeLabel(last)}は${fmt(slopeB)}${pp(unit)}。年あたりの増減幅が${fmt(Math.abs(slopeB - slopeA))}${pp(unit)}${slopeB > slopeA ? "上がっています" : "下がっています"}。${reversal ? "増減の向きが変わっています。" : accelerating ? "後の期間で増加ペースが速くなっています。" : "後の期間でも増加していますが、そのペースは緩やかになっています。"}次は${last[0].label}年前後の記録を見比べ、特定の年だけの変化か、数年続く変化かを確認できます。`,
        question: "区切りを前後に動かしても、このペースの違いは残るか？",
        test: "前後の区切りを数年動かし、異常な単年を除いた比較や連続する期間の傾きでも確かめる。どの年が転機だったかをこの二分だけで確定しない。",
        caveat: specificLimit, evidence: [[`${rangeLabel(first)}の年あたり変化`, slopeA, `${pp(unit)}/年`], [`${rangeLabel(last)}の年あたり変化`, slopeB, `${pp(unit)}/年`]],
        recordIds: ids([first[0], last[0], last.at(-1)]), calculation: "記録を年代順に前半と後半へ分け、それぞれの値に最もよく合う直線から、1年あたりの変化を計算しています。期間は比較のために便宜上分けたものです。この結果だけでは、変化の原因や、今後も同じペースで変化するかは分かりません。",
        chart: pointChart(ordered, { xLabel: dataset.xLabel, yLabel: label, unit, highlight: [last[0], last.at(-1)] }),
      });
    }
  }
}

function concentrationCandidates(candidates, dataset, rows, domain) {
  if (!["fire", "population", "emissions", "lodging", "housing"].includes(domain) || rows.length < 5 || rows.some(row => row.value < 0)) return;
  const ordered = [...rows].sort((a, b) => b.value - a.value || String(a.id).localeCompare(String(b.id)));
  const total = sum(ordered.map(row => row.value));
  if (!(total > 0)) return;
  const count = Math.max(1, Math.ceil(rows.length * .1)), top = ordered.slice(0, count), share = sum(top.map(row => row.value)) / total;
  const ctx = contextFor(domain), label = dataset.yLabel || dataset.valueLabel || "値", unit = dataset.unit || "";
  if (share < .3) return;
  const namedTop = domain === "fire" ? `上位${count}検知` : top.slice(0, 3).map(name).join("・") + (top.length > 3 ? "など" : "");
  addCandidate(candidates, {
    id: "concentration", lens: domain === "fire" ? "点の数と熱の強さのずれ" : "全体を動かす少数の対象", method: "上位層の構成比", score: 80 + Math.min(share, .9) * 12,
    title: domain === "fire" ? "火の光点を、全部同じ一つとして数えてよいか。" : domain === "housing" ? "建設が多い場所と、住まいを必要とする場所は同じか。" : domain === "lodging" ? "宿泊が集まる土地は、受け入れる余裕もあるのか。" : domain === "emissions" ? "排出を減らす問いは、国の数だけでは配分できない。" : "国の数を平等に数えると、人の集まり方が見えなくなる。",
    signal: `${rows.length}${ctx.object}のうち、値が高い${count}${ctx.object}（${fmt(count / rows.length * 100)}%）が、収録値の合計の${fmt(share * 100)}%を占めます。${namedTop}に大きな値が集まっています。`,
    meaning: ctx.issue, question: ctx.question, test: ctx.need, caveat: ctx.limit,
    evidence: [[`上位${count}${ctx.object}の構成比`, share * 100, "%"], ["対象数の割合", count / rows.length * 100, "%"], [`最大の${ctx.object}の値`, ordered[0].value, unit]],
    recordIds: ids(top.slice(0, 3)), calculation: `非負の収録値を降順に並べ、上位ceil(n×0.1)件の合計÷全件の合計。割合や濃度にはこの合計を適用しない。`,
    chart: rankedChart(rows, label, unit, top.slice(0, 3)),
  });
}

function migrationCandidates(candidates, dataset, rows) {
  const positive = rows.filter(row => row.value > 0).sort((a, b) => b.value - a.value), negative = rows.filter(row => row.value < 0).sort((a, b) => a.value - b.value);
  if (!positive.length || !negative.length) return;
  const gains = sum(positive.map(row => row.value)), losses = -sum(negative.map(row => row.value));
  const top = positive[0], low = negative[0], share = top.value / gains;
  addCandidate(candidates, {
    id: "two-sided-migration", lens: "受け入れる側と離れる側", method: "正負を分けた集中比較", score: 95,
    title: `${name(top)}への集中と、${negative.length}地域の流出超過は、別々の課題になる。`,
    signal: `転入超過は${positive.length}都道府県、転出超過は${negative.length}都道府県。${name(top)}の転入超過${fmt(top.value)}人は、転入超過地域の合計の${fmt(share * 100)}%。${name(low)}は${fmt(Math.abs(low.value))}人の転出超過です。`,
    meaning: "受け入れる地域では住まい・交通の容量、離れる地域ではサービスを維持する条件が問いになります。全国の差し引きや一つの平均では、両側の課題を打ち消してしまいます。",
    question: `${name(top)}に集まる人と、${name(low)}などを離れる人は、同じ世代・同じ理由なのか？`,
    test: "移動元・移動先の組、年齢層、進学・就職の時期を追加して確かめる。この二地域の値から直接の移動経路を作らない。",
    caveat: "月次の転入−転出です。転入・転出の総数や移動理由、出生・死亡を含む人口増減ではありません。プラスの地域からマイナスの地域への対応も分かりません。",
    evidence: [["転入超過の地域", positive.length, "都道府県"], ["転出超過の地域", negative.length, "都道府県"], ["差し引き前の増減幅の合計", gains + losses, "人"]],
    recordIds: ids([top, low]), calculation: "正の転入超過と負の転入超過を別々に集計。絶対値合計は延べ移動人数ではない。",
    chart: rankedChart(rows, "転入超過", "人", [top, low]),
  });
}

// Compare near peers, rather than arbitrary halves of the storage order.
function peerCandidate(candidates, dataset, rows, domain) {
  const specs = {
    wind: { keys: ["pressure"], target: "value", labels: ["地表気圧"], units: ["hPa"], tolerance: .025, minGap: 5, score: 96 },
    renewables: { keys: ["solarKwhM2Day", "windSpeedMs"], target: "value", labels: ["日射", "風速"], units: ["kWh/㎡/日", "m/s"], tolerance: .18, minGap: 15, score: 96 },
    ecologies: { keys: ["urbanPercent"], target: "forestPercent", labels: ["都市人口率"], units: ["%"], tolerance: .06, minGap: 15, score: 96 },
    cloud: { keys: ["cloudCover"], target: "value", labels: ["雲量"], units: ["%"], tolerance: .07, minGap: 120, score: 96 },
    water: { keys: ["rainyDays"], target: "value", labels: ["雨日数"], units: ["日"], tolerance: .08, minGap: 800, score: 94 },
    "rain-days": { keys: ["precipitation"], target: "value", labels: ["年間降水量"], units: ["mm"], tolerance: .08, minGap: 25, score: 94 },
  };
  const spec = specs[domain];
  if (!spec) return;
  const usable = rows.filter(row => [...spec.keys, spec.target].every(key => numeric(row[key]))).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (usable.length < 5 || usable.length > 1000) return;
  const ranges = spec.keys.map(key => descriptive(usable.map(row => row[key])).range);
  let best = null;
  for (let i = 0; i < usable.length; i++) for (let j = i + 1; j < usable.length; j++) {
    const a = usable[i], b = usable[j];
    if (domain === "renewables" && numeric(a.year) && numeric(b.year) && a.year !== b.year) continue;
    const normalized = spec.keys.map((key, index) => ranges[index] ? Math.abs(a[key] - b[key]) / ranges[index] : 0);
    if (normalized.some(distance => distance > spec.tolerance)) continue;
    const gap = Math.abs(a[spec.target] - b[spec.target]);
    const score = gap * (1 - mean(normalized));
    if (gap >= spec.minGap && (!best || score > best.score)) best = { a, b, gap, score };
  }
  if (!best) return;
  const { a, b, gap } = best, ctx = contextFor(domain);
  const outputLabel = domain === "ecologies" ? "森林率" : domain === "water" ? "年間降水量" : domain === "rain-days" ? "雨日数" : dataset.valueLabel || dataset.yLabel || "観測値";
  const outputUnit = domain === "water" ? "mm" : domain === "rain-days" ? "日" : domain === "ecologies" ? "%" : dataset.unit;
  const conditions = spec.keys.map((key, index) => `${spec.labels[index]}は${fmt(a[key])} / ${fmt(b[key])}${spec.units[index]}`).join("、");
  const matchedLabels = spec.labels.join("・");
  const pairLabel = ["国・地域", "国"].includes(ctx.object) ? "2か国" : "2地点";
  const comparison = {
    caption: `${matchedLabels}が近い${pairLabel}`,
    intro: `${usable.length}件の中から、${matchedLabels}の値が近く、${outputLabel}の差が大きい${pairLabel}を選びました。場所や他の条件まで同じという意味ではありません。`,
    points: [a, b].map((row, index) => ({ id: String(row.id), label: `${ctx.object === "国・地域" || ctx.object === "国" ? "国" : "地点"}${index ? "B" : "A"}`, name: name(row) })),
    metrics: [
      ...spec.keys.map((key, index) => ({ label: spec.labels[index], unit: spec.units[index], values: [a[key], b[key]] })),
      { label: outputLabel, unit: outputUnit, values: [a[spec.target], b[spec.target]], highlight: true },
    ],
  };
  addCandidate(candidates, {
    id: "near-peers", lens: `${matchedLabels}と${outputLabel}を比べる`, method: `${matchedLabels}の値が近い2件の比較`, score: spec.score,
    title: `${matchedLabels}が近い${pairLabel}でも、${outputLabel}に${fmt(gap)}${pp(outputUnit)}の差。`,
    signal: `${name(a)}と${name(b)}では、${conditions}。それでも${outputLabel}は${fmt(a[spec.target])}${outputUnit}と${fmt(b[spec.target])}${outputUnit}で、${fmt(gap)}${pp(outputUnit)}離れています。比較できる${usable.length}対象の中から、条件が近く差の大きい組を探索しました。`,
    meaning: domain === "wind" ? "気圧が同じでも、周りの気圧や地形が違えば、風の強さは変わります。この2地点の違いが何によるものかは、まだ分かりません。" : `この${pairLabel}では、${matchedLabels}が近くても${outputLabel}は違います。${matchedLabels}だけでは、この差は説明できません。原因を特定した結果ではありません。`,
    question: domain === "wind" ? "この二地点では、周囲との気圧差・地形・標高がどう違うか？" : domain === "water" ? `${name(a)}と${name(b)}の水量の差は、一部の季節や数日に集中しているか？` : domain === "rain-days" ? `${name(a)}と${name(b)}では、雨の日の配置が屋外の仕事や移動にどう関わるか？` : ctx.question,
    test: domain === "wind" ? "隣接格子の同時刻の気圧と風向、標高を照合する。地表気圧には標高差も含まれるので、同じ値を同じ気象条件とは扱わない。" : ctx.need, caveat: ctx.limit,
    evidence: [[`${name(a)}の${outputLabel}`, a[spec.target], outputUnit], [`${name(b)}の${outputLabel}`, b[spec.target], outputUnit], ["条件を比較できた対象", usable.length, "件"]],
    comparison, recordIds: ids([a, b]), calculation: `各条件の差が標本内レンジの${fmt(spec.tolerance * 100)}%以下の組から、目的値の差が大きい組を選択。対照実験・有意差検定ではない。`,
    chart: pointChart(usable, { x: spec.keys[0], y: spec.target, xLabel: `${spec.labels[0]}（${spec.units[0]}）`, yLabel: `${outputLabel}（${outputUnit}）`, unit: outputUnit, highlight: [a, b] }),
  });
}

function sparseCandidate(candidates, dataset, rows, domain) {
  if (rows.length !== 1) return;
  const row = rows[0], unit = dataset.unit || "", label = dataset.valueLabel || dataset.yLabel || "観測値";
  const prompts = {
    wind: ["一つの風速では、街の風の通り道は分からない。", "代表地点の風速だけでは、建物で遮られる場所や風が抜ける場所の違いが抜け落ちます。屋外の活動を考えるなら、地域の代表値と人がいる場所を分けて確かめる必要があります。", "同時刻の周辺地点と風向を加えると、この場所だけに残る差はあるか？", "周辺の同時刻の風速・風向、建物や地形を照合する。代表地点のモデル値から、個別の街路の風や移動経路を断定しない。"],
    "city-co2": ["この街のCO₂濃度を、この街の排出量と取り違えない。", "大気は場所を越えて移動します。いまの一つの濃度から、街の活動がどれだけ上乗せしたかは切り分けられません。", "同時刻の周辺格子と風向を揃えたとき、この街にだけ残る差があるか？", "周辺格子・風上側の濃度と同一モデル時刻で比較し、差が継続するかを追う。室内換気の判定には使わない。"],
    "city-rain": [row.value === 0 ? "雨がない瞬間と、水が足りる土地は別の話。" : "いま降っている量だけでは、水の余裕も不足も読めない。", "一時点の降水では、直前までの蓄積やこれから使う水が抜け落ちます。水を届ける働きと、予定を変える降り方を分けて調べたいところです。", "この雨は直前までの乾燥を補う雨か、それとも降り続いた後の追加か？", "同地点の24時間・数日間の積算、土壌水分・貯留量を加える。0という値を欠測や将来も降らない意味にしない。"],
    "city-temperature": ["同じ気温でも、一日の過ごしにくさまで同じとは限らない。", "地上2mの気温ひとつでは、日なた・日陰、風、湿りの条件が抜け落ちます。数字の高低だけで暮らしの負担を決めず、何が足りないかを絞り込みます。", "気温が同じ時間帯でも、日射・風・湿度の違いは残るか？", "同時刻の湿度・風・日射と、一日の最高・最低の変化を加える。個人の危険度や室内環境はこの値で判断しない。"],
    "city-cloud": ["雲の多さは、そのまま雨や暗さの量ではない。", "空を覆う面積の割合だけでは、雲の厚さや雨を降らせる条件は分かりません。『曇っているから』で予定を判断する前に、どの条件が違うかを確かめたいところです。", "雲量が近い別の時刻で、日射と降水はどれだけ違うか？", "同地点の日射・降水と太陽高度を揃えて比較する。現在の1点を一日の空模様や将来の雨の予測へ広げない。"],
    "city-aerosol": ["吸う空気の違いを知るには、霞の見た目でも一つの濃度でも足りない。", "モデルの格子値と、人がいる場所・時間帯の空気には距離があります。いまの値から被害を想像するより、誰のどの時間を観測で捉えられていないかが問いになります。", "同地点の時間変化と近くの地上観測は、同じ動きをしているか？", "地上測定局、時刻、風向・降水を照合する。モデル値から発生源・個人の曝露量や健康被害を推定しない。"],
  };
  const [title, meaning, question, test] = prompts[domain] || ["一つの値を、地域の特徴にしてしまわない。", "比較相手がないため、高低・変化・例外はまだ判定できません。まず比較の設計が必要です。", "同じ対象の別の時点と、同じ時点の別の対象のどちらを確かめるべきか？", "同じ単位・集計方法の観測を追加する。"];
  addCandidate(candidates, { id: "comparison-needed", lens: "欠けている比較を特定する", method: "測定量と比較条件の点検", score: 100, status: "needs-comparison",
    title, signal: `${name(row)}の${label}は${fmt(row.value)}${unit}。いま分析できるのは1地点・1時点だけで、平常との差や増減は未判定です。`, meaning, question, test,
    caveat: "データ固有の差はまだ発見できていません。ここに示すのは、測定量から絞った次の問いであり、新たな傾向や被害の発見ではありません。",
    evidence: [[label, row.value, unit], ["比較できる観測", 1, "件"]], recordIds: ids(rows), calculation: "1点のため分散・傾向・有意差・原因は推定しない。", chart: rankedChart(rows, label, unit, rows),
  });
}

function oceanCandidate(candidates, dataset, rows) {
  const usable = rows.filter(row => numeric(row.uMs) && numeric(row.vMs));
  if (usable.length < 3) return;
  const speed = mean(usable.map(row => Math.hypot(row.uMs, row.vMs)));
  if (!(speed > 0)) return;
  const vector = Math.hypot(mean(usable.map(row => row.uMs)), mean(usable.map(row => row.vMs)));
  const cancellation = 1 - vector / speed;
  if (cancellation < .3) return;
  addCandidate(candidates, { id: "opposing-currents", lens: "逆向きの動きが消しているもの", method: "速度の大きさと合成ベクトルの比較", score: 98,
    title: "平均すると弱い流れでも、海が静かとは限らない。",
    signal: `地点ごとの速さを平均すると${fmt(speed)}m/sですが、東西・南北の向きを含めて平均した流れは${fmt(vector)}m/s。逆向きの成分が打ち消し合い、${fmt(cancellation * 100)}%小さく見えます。`,
    meaning: "漂うものの行き先を考えるとき、海全体の平均方向だけでは、運ぶ流れや留める流れを落としてしまいます。『よく混ざる海』と一括りにせず、どこで進路が分かれるかが問いになります。",
    question: "近い地点の流れが違う場所で、漂うものの行き先は分かれるか？",
    test: "隣接する格子と複数時刻の流れを追加し、沿岸・地形と照合する。固定した流れを延長した軌跡は説明用に留め、漂流予測とは呼ばない。",
    caveat: "収録された疎な格子の比較で、面積加重した全球平均ではありません。流速は出典の東西・南北成分から計算した派生量です。水温、塩分、鉛直方向の輸送は含みません。",
    evidence: [["速さの平均", speed, "m/s"], ["向き込みの平均の大きさ", vector, "m/s"], ["対象格子", usable.length, "地点"]], recordIds: ids([...usable].sort((a, b) => b.value - a.value).slice(0, 2)),
    calculation: "mean(hypot(u,v))とhypot(mean(u),mean(v))を比較。割合は打ち消しの指標で停滞面積ではない。",
    chart: pointChart(usable, { x: "uMs", y: "vMs", xLabel: "東西成分（m/s）", yLabel: "南北成分", unit: "m/s" }),
  });
}

function aerosolCandidate(candidates, dataset, rows) {
  const usable = rows.filter(row => numeric(row.aerosol));
  if (usable.length < 5) return;
  const byAod = [...usable].sort((a, b) => b.aerosol - a.aerosol || String(a.id).localeCompare(String(b.id)));
  const byPm = [...usable].sort((a, b) => b.value - a.value || String(a.id).localeCompare(String(b.id)));
  const topAir = byAod[0], topGround = byPm[0];
  const groundRank = byPm.findIndex(row => row.id === topAir.id) + 1;
  if (topAir.id === topGround.id || groundRank <= Math.ceil(usable.length * .25) || topGround.value <= topAir.value * 1.5) return;
  addCandidate(candidates, { id: "haze-ground-mismatch", lens: "空全体の霞と地表の空気の食い違い", method: "同時に収録された二つの指標の順位照合", score: 98,
    title: "最も霞の大きい地点が、地表の微粒子も最多とは限らない。",
    signal: `光学的厚さが最大の${name(topAir)}（${fmt(topAir.aerosol)}）は、PM2.5では${usable.length}地点中${groundRank}位・${fmt(topAir.value)}µg/m³。PM2.5が最大の${name(topGround)}は${fmt(topGround.value)}µg/m³です。`,
    meaning: "空全体を通る光の変化と、人がいる高さの微粒子は別の量です。見た目の目立つ場所だけを追うと、地表の空気について確かめる場所を取り違える可能性があります。",
    question: "霞が目立つ場所と地表濃度が高い場所のずれは、微粒子の高度分布で説明できるか？",
    test: "同時刻の鉛直分布、地上観測、風向と照合する。雲・湿度・粒子の種類の影響も切り分ける。", caveat: CONTEXT.aerosol.limit,
    evidence: [[`${name(topAir)}のPM2.5`, topAir.value, "µg/m³"], [`${name(topGround)}のPM2.5`, topGround.value, "µg/m³"], ["光学的厚さ最大地点のPM順位", groundRank, "位"]],
    recordIds: ids([topAir, topGround]), calculation: "同じ収録地点のAODとPM2.5を別々に順位付け。単位の違う値を足したり比率にしたりしない。",
    chart: pointChart(usable, { x: "aerosol", xLabel: "エアロゾル光学的厚さ（無次元）", yLabel: "PM2.5", unit: "µg/m³", highlight: [topAir, topGround] }),
  });
}

function pairedCo2Candidate(candidates, dataset, rows) {
  const ordered = rows.filter(row => numeric(row.x) && numeric(row.y) && numeric(row.paired) && /^\d{4}$/u.test(row.label)).sort((a, b) => Number(a.label) - Number(b.label));
  if (ordered.length < 8) return;
  const size = Math.min(5, Math.floor(ordered.length / 3));
  const early = ordered.slice(0, size), late = ordered.slice(-size);
  const keys = ["x", "y", "paired"], changes = keys.map(key => mean(late.map(row => row[key])) - mean(early.map(row => row[key])));
  const siteGap = mean(ordered.map(row => Math.max(...keys.map(key => row[key])) - Math.min(...keys.map(key => row[key]))));
  if (!changes.every(value => value > 0) || Math.min(...changes) < siteGap * 2) return;
  const plotted = ordered.map(row => ({ ...row, observationYear: Number(row.label) }));
  addCandidate(candidates, { id: "shared-rise", lens: "場所の差より共通する変化", method: "同年3観測所の差と期間変化の比較", score: 98,
    title: "観測所の小さな差を追う間にも、三つの空気は共に変わっている。",
    signal: `${rangeLabel(early)}と${rangeLabel(late)}の各${size}年平均を比べると、綾里は${fmt(changes[0])}ppm、南鳥島は${fmt(changes[1])}ppm、与那国島は${fmt(changes[2])}ppm上昇。同じ年の3地点の最大−最小は平均${fmt(siteGap)}ppmです。`,
    meaning: "地点間のわずかな高低だけに注目すると、どの地点にも共通して積み上がる変化を小さく扱ってしまいます。局所の差を説明する問いと、共通する水準を変える問いを分ける必要があります。",
    question: "三地点に共通する上昇と、季節・風向で変わる地点差をどう切り分けるか？",
    test: "共通期間の月別値、風向、大気輸送の情報を追加する。濃度差を各地域の排出量に読み替えない。",
    caveat: "3地点すべてに値がある共通年だけを比較しています。最新年が全地点で揃うとは限らず、排出源・原因の寄与はこの系列だけでは特定しません。",
    evidence: [["綾里の期間差", changes[0], "ppm"], ["南鳥島の期間差", changes[1], "ppm"], ["与那国島の期間差", changes[2], "ppm"]], recordIds: ids([early[0], late.at(-1)]),
    calculation: `同じ${ordered.length}年で各地点の最初・最後${size}年平均の差と、同年の地点間レンジを比較。`,
    chart: pointChart(plotted, { x: "observationYear", xLabel: "共通観測年", yLabel: "綾里のCO₂", unit: "ppm" }),
  });
}

function categoryCandidate(candidates, dataset, rows, domain) {
  if (!rows.length) return;
  const categories = [...new Set(rows.map(row => row.category).filter(Boolean))].sort();
  const groups = [...new Set(rows.map(row => row.group).filter(Boolean))].sort();
  const ordered = categories.map(category => ({ category, rows: rows.filter(row => row.category === category) })).sort((a, b) => b.rows.length - a.rows.length || a.category.localeCompare(b.category));
  if (!ordered.length) return;
  const top = ordered[0], last = ordered.at(-1);
  addCandidate(candidates, { id: "recording-coverage", lens: "現象の偏りと記録の偏りを分ける", method: "カテゴリと記録方式の内訳", score: 100,
    title: domain === "culture" ? "多く記録された文化と、多く受け継がれる文化は同じか。" : "記録が多い生きものを、関係の中心と決めてよいか。",
    signal: `収録${rows.length}件は${categories.length}カテゴリ・${groups.length}群に分かれ、最多は「${top.category}」${top.rows.length}件、最少は「${last.category}」${last.rows.length}件です。これは現象そのものの頻度ではなく、選ばれた記録の内訳です。`,
    meaning: domain === "culture" ? "見えやすく登録されやすい営みが中心になると、名づけられない日常の文化を取り落とす可能性があります。地図の空白を『文化がない』と読まないために、収録の仕組み自体を問い直します。" : "観察しやすさや標本の残し方が、関係の見え方を変えます。相互作用の記録と出現記録を混ぜて多い順にしても、生態系での重要性は分かりません。",
    question: domain === "culture" ? "少ないカテゴリ・地域は、営みが少ないのか、記録する仕組みが届いていないのか？" : "記録の少ない相手は、関係が弱いのか、同じ方法で調べられていないのか？",
    test: "収録基準・観測努力・調査範囲を確認し、同じ方式と期間の記録同士を比較する。空白をゼロで補わない。",
    caveat: "選定されたカテゴリ記録の点検です。地域全体での普及率・自然界の個体数・因果関係・価値の順位を示しません。整理用の行番号を測定値として平均しません。",
    evidence: [["収録記録", rows.length, "件"], ["カテゴリ", categories.length, "種類"], ["最多カテゴリの記録", top.rows.length, "件"]], recordIds: ids([top.rows[0], last.rows[0]]),
    calculation: "元のcategory/groupラベルの件数を数える。並び番号valueは計算に使わない。",
    chart: { type: "categorical", table: [categories.map(category => rows.filter(row => row.category === category).length)], categoryLevels: categories, groupLevels: ["収録記録"], xLabel: "収録カテゴリ", yLabel: "記録数（件）", unit: "件" },
  });
}

function quakeCandidate(candidates, dataset, rows, domain) {
  if (domain === "earthquakes") {
    if (rows.length < 5) return;
    const sorted = [...rows].sort((a, b) => b.value - a.value), top = sorted[0], low = sorted.at(-1);
    if (top.value === low.value) return;
    const average = mean(rows.map(row => row.value));
    addCandidate(candidates, { id: "uneven-event-years", lens: "一定の備えと揺れる発生件数", method: "年別の集積と少ない年の比較", score: 99,
      title: "少ない年を平常とすると、重なる年への備えが抜け落ちる。",
      signal: `選択中${rows.length}年では${name(top)}年が${top.value}件、${name(low)}年が${low.value}件。年平均${fmt(average)}件の一定のリズムではありません。`,
      meaning: "平均の回数に合わせた見方では、対応が重なる条件を捉えられません。ただし全球で重なった年の件数と、一つの地域で被害が重なることも区別が必要です。",
      question: "件数が多い年の記録は、同じ地域の一連の活動か、離れた地域の別々の活動か？",
      test: "元の発生時刻・震源・深さを戻して時空間のまとまりを調べる。備えの検討には揺れ・建物・人口の情報を加える。",
      caveat: "収録基準に合う大地震の全球件数です。地域の危険度や次の発生日・発生回数を予測しません。件数の少ない年を安全な年と呼びません。",
      evidence: [[`${name(top)}年`, top.value, "件"], [`${name(low)}年`, low.value, "件"], ["対象年", rows.length, "年"]], recordIds: ids([top, low]),
      calculation: "選択年の件数を比較。発生間隔の独立性や一定発生率を仮定した予測ではない。", chart: pointChart([...rows].sort((a, b) => a.x - b.x), { xLabel: "年", yLabel: "収録地震", unit: "件", highlight: [top, low] }),
    });
  } else {
    const usable = rows.filter(row => numeric(row.depth));
    if (usable.length < 3) return;
    let pair = null;
    for (let i = 0; i < usable.length; i++) for (let j = i + 1; j < usable.length; j++) {
      const a = usable[i], b = usable[j], gap = Math.abs(a.depth - b.depth);
      if (Math.abs(a.value - b.value) <= .3 && gap > 40 && (!pair || gap > pair.gap)) pair = { a, b, gap };
    }
    if (!pair) return;
    const { a, b, gap } = pair;
    addCandidate(candidates, { id: "same-magnitude-depth", lens: "同じ規模でも違う震源条件", method: "近いマグニチュードの深さ比較", score: 98,
      title: "地震の規模が近くても、揺れを生む条件は同じではない。",
      signal: `${name(a)}（M${fmt(a.value)}）と${name(b)}（M${fmt(b.value)}）の深さは${fmt(a.depth)}kmと${fmt(b.depth)}km。規模差0.3以内の記録から深さが${fmt(gap)}km違う組を見つけました。`,
      meaning: "大きい地震を一つの数字で並べると、地表への距離や人が暮らす場所の違いが抜けます。規模の順位から、揺れや被害の順位へは進めません。",
      question: "この二つの震源について、人がいる場所までの距離と観測された揺れはどう違うか？",
      test: "震度・地表の揺れ、距離、地盤、建物・人口を加えて比較する。深さだけで被害の大小を決めない。", caveat: "公開カタログの選択期間内の探索です。震源値は改訂される可能性があり、地震予知・津波判定・安全判断には使いません。",
      evidence: [[`${name(a)}の深さ`, a.depth, "km"], [`${name(b)}の深さ`, b.depth, "km"], ["深さの差", gap, "km"]], recordIds: ids([a, b]), calculation: "マグニチュード差0.3以内、深さ差40km超の組を探索。有意差・危険度の基準ではない。",
      chart: pointChart(usable, { x: "depth", xLabel: "震源の深さ（km）", yLabel: "マグニチュード", unit: "M", highlight: [a, b] }),
    });
  }
}

function distributionCandidates(candidates, dataset, rows, domain) {
  if (rows.length < 2 || ["culture", "pollination"].includes(domain) || timeRows(dataset, rows).length) return;
  const stats = descriptive(rows.map(row => row.value)), ctx = contextFor(domain), unit = dataset.unit || "", label = dataset.valueLabel || dataset.yLabel || "観測値";
  if (!stats) return;
  const ordered = [...rows].sort((a, b) => a.value - b.value || String(a.id).localeCompare(String(b.id)));
  if (almost(stats.range, 0, Math.abs(stats.mean))) {
    if (candidates.length) return; // Equal magnitudes can still have different directions or other measured conditions.
    addCandidate(candidates, { id: "flat-data", lens: "差が見えない理由", method: "同値・分解能の点検", score: 100,
      title: `${rows.length}件すべて同じ値。違いを語る前に、観測の解像度を確かめたい。`,
      signal: `${label}はすべて${fmt(stats.mean)}${unit}です。今回の記録には比較できる差がありません。`,
      meaning: "違いがないことと、違いを捉える細かさがないことは別です。丸め、代表値の繰り返し、同一格子の利用を確かめる余地があります。",
      question: "この同値は現象の一致か、記録方法が生んだ一致か？", test: "元データの桁数、時刻、格子・観測地点IDを照合する。確認できない間は順位や異常を作らない。",
      caveat: ctx.limit, evidence: [["共通の値", stats.mean, unit], ["同値の記録", rows.length, "件"]], recordIds: ids(ordered.slice(0, 2)), calculation: "有効値の最大−最小と数値丸めの許容差を比較。", chart: rankedChart(rows, label, unit),
    }); return;
  }
  const iqr = stats.q3 - stats.q1, threshold = stats.q3 + 1.5 * iqr;
  const tail = ordered.filter(row => row.value > threshold), top = ordered.at(-1), low = ordered[0];
  if (tail.length > 0 && tail.length <= rows.length * .2) addCandidate(candidates, {
    id: "isolated-tail", lens: "全体と切り分けて見る対象", method: "中央層と高い側の尾の比較", score: 70,
    title: `${name(top)}など${tail.length}${ctx.object}を、全体と同じ条件で考えてよいか。`,
    signal: `中央の半数は${fmt(stats.q1)}〜${fmt(stats.q3)}${unit}ですが、${name(top)}は${fmt(top.value)}${unit}。高い側の探索基準${fmt(threshold)}${unit}を超える${tail.length}件を切り出しました。`,
    meaning: ctx.issue, question: ctx.question, test: ctx.need, caveat: `${ctx.limit} この探索基準は異常・危険・誤測定の判定線ではありません。`,
    evidence: [[`${name(top)}の値`, top.value, unit], ["中央値", stats.median, unit], ["高い側の候補", tail.length, "件"]],
    recordIds: ids(tail.slice(-3)), calculation: "Q3+1.5×IQRを超える少数の記録を探索。外れ値の除外や被害判定はしない。", chart: rankedChart(rows, label, unit, tail),
  });
  addCandidate(candidates, { id: "different-contexts", lens: "一律に扱えない条件", method: "中央層と両端の対象比較", score: 35,
    title: domain === "recycling" ? "率の高い国をまねる前に、ごみの入口と出口を比べたい。" : domain === "renewables" ? "高い発電割合を、太陽と風の豊かさだけで説明しない。" : domain === "humidity" ? "湿りの違いを、そのまま水蒸気の量の違いにしない。" : domain === "sunshine" ? "日差しの多い土地の条件を、ほかの土地にも使えるか。" : domain === "rain-days" ? "雨の日が多い土地では、同じ一週間の使い方でよいか。" : `${label}の違いは、同じ条件を全体へ当てはめてよいかという問いになる。`,
    signal: `${name(low)}の${fmt(low.value)}${unit}と${name(top)}の${fmt(top.value)}${unit}の間に、中央の半数は${fmt(stats.q1)}〜${fmt(stats.q3)}${unit}で分布しています。`,
    meaning: ctx.issue, question: ctx.question, test: ctx.need, caveat: ctx.limit,
    evidence: [[`${name(low)}の値`, low.value, unit], [`${name(top)}の値`, top.value, unit], ["中央層の幅", iqr, pp(unit)]], recordIds: ids([low, top]),
    calculation: "実際の対象名を伴う両端と四分位を比較。件数順や経度の順を説明変数にしない。", chart: rankedChart(rows, label, unit, [low, top]),
  });
}

// The first reading is about what the records show. Research prompts and
// selection formulas remain available separately, not as the visitor's task.
function visitorReading(candidate, dataset) {
  const label = dataset.valueLabel || dataset.yLabel || "値";
  const meanLabel = label.includes("平均") ? label : `${label}の平均`;
  const readings = {
    "baseline-shift": [`${meanLabel}を、前と後の期間で比べる`, "一度だけ高かった・低かったという話ではなく、一定期間の平均を比べています。期間の取り方によって差は変わります。"],
    "yearly-variability": [`${label}の低い年と高い年を比べる`, "年平均をひとつ示すだけでは、年ごとの幅は見えません。ここでは、同じ対象の低い年と高い年を確認できます。"],
    "pace-change": [`${label}の増減ペースは、前半と後半で違う`, "期間を前半と後半に分け、それぞれの増減ペースを直線で表した比較です。途中の年も含めて計算しており、最初と最後の値だけを引いたものではありません。"],
    concentration: [`${label}の合計は、一部の対象に集中`, "対象をひとつずつ数えた割合と、値を合計した割合は違います。数が少ない対象でも、合計に占める割合が大きい場合があります。"],
    "two-sided-migration": ["入ってくる人と出ていく人、どちらが多い？", "転入超過は、入ってくる人のほうが多いこと。転出超過は、出ていく人のほうが多いことです。両方を足してしまうと、地域ごとの逆向きの動きが見えなくなります。"],
    "comparison-needed": ["1件の記録だけでは、変化は分かりません", "比べる相手がないので、この値がいつもより高いか低いかは判断できません。同じ場所の別の時刻や、周辺の記録が必要です。"],
    "opposing-currents": ["向きの違う海流は、平均すると打ち消し合う", "反対向きに流れる2つの海流を合わせると、平均は小さくなります。平均が小さくても、各地点で流れが弱いとは限りません。"],
    "haze-ground-mismatch": ["空のかすみと、地上のPM2.5は別の指標", "光学的厚さは空全体で光が通りにくい度合い、PM2.5は地表付近の細かい粒子の濃度です。測っている範囲が違うので、最大になる地点も同じとは限りません。"],
    "shared-rise": ["3つの観測所で、CO₂濃度が上昇", "同じ年の地点間の差より、期間の前後で比べた濃度の上昇が大きくなっています。ある1地点だけの変化ではありません。"],
    "recording-coverage": ["どの種類の記録が多く収録されている？", "ここで数えているのは、このデータに収録された記録です。記録が少ないことは、現実に少ない・存在しないという意味ではありません。"],
    "uneven-event-years": ["地震の記録件数は、年によって違う", "この記録では、毎年同じ回数ではありません。ただし、世界全体の件数から、ある地域の危険度や次の地震は判断できません。"],
    "same-magnitude-depth": ["規模が近い地震でも、震源の深さが違う", "マグニチュードは地震の規模です。同じくらいの規模でも深さは違い、この2つの数値だけでは地表の揺れや被害は分かりません。"],
    "flat-data": ["今回の記録では、値に差がありません", "記録上は同じ値なので、順位は付けられません。丸め方や測定の細かさによって、違いが記録されていない可能性もあります。"],
    "isolated-tail": ["特に大きな値を、全体の分布と比べる", "多くの記録が集まる範囲から離れた値を表示しています。大きな値であることと、異常・危険・誤りであることは別です。"],
    "different-contexts": [`${label}が低い対象と高い対象を比べる`, "対象ごとの値には幅があります。全体の平均だけでなく、どの対象の値なのかを合わせて見る比較です。"],
    "not-enough-comparison": ["比較に必要な記録が足りません", "この範囲では、差や変化を示せるだけの比較ができません。対象を絞り込んでいる場合は、範囲を広げると比べられることがあります。"],
  };
  const [headline, summary] = readings[candidate.id] || [candidate.title, candidate.meaning];
  return { headline, summary };
}

export function discoverData({ dataset, rows = [], methodId = "discovery", recordQuery = "" }) {
  // A user can show imputed records, but they must never create a ranked claim
  // about a country. Keep them visible in the ledger and exclude from discovery.
  const excluded = rows.filter(row => row.provenance === "IMPUTED" || row.valueStatus === "IMPUTED").length;
  const valid = rows.filter(row => numeric(row.value) && row.provenance !== "IMPUTED" && row.valueStatus !== "IMPUTED");
  const domain = domainFor(dataset), candidates = [];
  const temporal = dataset.xKind === "year" || dataset.xKind === "month" || dataset.insightContext?.axis === "time-series" || /^(観測)?(年|月|年月)$/u.test(dataset.xLabel || "");
  if (domain === "food" && valid.length) {
    const ordered = timeRows(dataset, valid);
    const mixedSources = new Set(ordered.map(row => row.sourceSeries).filter(Boolean)).size > 1;
    addCandidate(candidates, {
      id: "food-period-records", lens: "同じ国・同じ指標の推移", method: "収録期間を比べる", score: 2, status: "descriptive",
      title: mixedSources ? "食料の率を、出典・方式の境目に注意してたどる" : "食料の率を、同じ定義・期間でたどる",
      signal: mixedSources ? `${rangeLabel(ordered)}の数値${ordered.length}件。複数の方式・出典が含まれるため、両端の差を同一系列の変化として要約しません。` : `${rangeLabel(ordered)}の数値${ordered.length}件。先頭と末尾の差は${fmt(ordered.at(-1).value - ordered[0].value)}ポイントです。`,
      meaning: "国別の食料供給・貿易に関する記録です。割合の違いを食料の実物量や個人の食生活の違いに読み替えません。",
      question: "割合が変わった期間に、生産量と貿易量はどう変わったか？",
      test: "同じ品目と期間の生産・輸入・輸出、在庫変動、推計区分を照合する。3年平均の重なる期間を独立した標本とみなさない。",
      caveat: `将来予測・原因・食料の安全性・飢餓の判定ではありません。${dataset.comparisonNote || ''}`,
      evidence: [[ordered[0].label, ordered[0].value, "%"], [ordered.at(-1).label, ordered.at(-1).value, "%"], ["有効な期間", ordered.length, "期間"]],
      recordIds: ids(ordered), calculation: "公表値または数量から求めた自給率を期間ごとに表示。欠測を補間せず、差はパーセントポイントで表示。",
      chart: { ...pointChart(ordered, { xLabel: dataset.xLabel, yLabel: dataset.valueLabel, unit: "%" }),
        xTicks: ordered.filter((_, index) => index === ordered.length - 1 || index % Math.max(1, Math.ceil((ordered.length - 1) / 3)) === 0).map(row => row.x) },
    });
  }
  if (["prtr", "river-biology"].includes(domain) && valid.length) {
    const biological = domain === "river-biology", ordered = biological ? timeRows(dataset, valid) : valid;
    addCandidate(candidates, {
      id: "public-report-records", lens: biological ? "調査で確認された分類群" : "物質ごとの届出量", method: "公表記録をそのまま並べる", score: 2, status: "descriptive",
      title: biological ? "確認記録と、生きものの不在を区別する" : "物質ごとの届出量を、毒性の順位と区別する",
      signal: `選択対象の${valid.length}件の公表値を表示しています。`,
      meaning: biological ? "調査地区・年度ごとの確認分類群数です。調査方法・季節・同定の細かさが異なり、生物多様性の増減や水質の良し悪しをこの値だけで判断できません。"
        : "kg単位の物質別届出量です。物質によって性質・有害性が異なり、量の順位が危険度の順位になるわけではありません。",
      question: biological ? "調査の季節・方法・分類群の名前は、年度間でどう違うか？" : "同じ物質・排出先・届出算出方法を揃えると、何が比較できるか？",
      test: "原資料の調査・届出条件を確かめ、環境濃度や生息状況の別の資料と区別して照合する。",
      caveat: dataset.comparisonNote, evidence: [["収録記録", valid.length, "件"], [ordered[0].label, ordered[0].value, dataset.unit]],
      recordIds: ids(ordered), calculation: "公表値を保持し、記録なしを0へ変換せず、補間・回帰・予測・危険度判定を加えない。",
      chart: biological ? { ...pointChart(ordered, { xLabel: "調査年度", yLabel: dataset.yLabel, unit: dataset.unit }), xTicks: annualAxisTicks(ordered) }
        : rankedChart(ordered, dataset.yLabel, dataset.unit),
    });
  }
  // A short coastal record can be shown as observations without manufacturing
  // a long-term trend. Keep the actual year/value points, not a sample-count
  // metric plotted against the COD axis by the generic insufficient-data chart.
  if (domain === "marine-cod") {
    const ordered = timeRows(dataset, valid);
    if (ordered.length) addCandidate(candidates, {
      id: "coastal-cod-records", lens: "同じ地点の水質の記録", method: "COD年度平均値を並べる", score: 2, status: "descriptive",
      title: `${ordered.length}年度のCODを、同じ測定地点で見る`,
      signal: `${rangeLabel(ordered)}の${ordered.length}件の年度平均値を表示しています。`,
      meaning: "年度による値の違いを読むための観測記録です。海域全体の平均や、長期傾向を表すものではありません。",
      question: "値が違う年度で、採水条件や周囲の環境はどう違ったのか？",
      test: "元資料で採水回数・季節・地点の移動を確かめ、より長い系列や周辺地点の記録と照合する。",
      caveat: "短い年度系列だけで原因や改善・悪化の長期傾向は断定できません。CODはDOではなく、酸欠や基準達成率を示しません。",
      evidence: [[ordered[0].label, ordered[0].value, dataset.unit], [ordered.at(-1).label, ordered.at(-1).value, dataset.unit], ["有効な年度", ordered.length, "年度"]],
      recordIds: ids(ordered), calculation: "測定地点コードで対応する年度平均値をそのまま表示。欠測を除外し、補間・傾向線・予測は追加しない。",
      chart: { ...pointChart(ordered, { xLabel: "年度", yLabel: "COD 年度平均値", unit: dataset.unit }), xTicks: annualAxisTicks(ordered) },
    });
  }
  if (domain === "japan-sensor-open") {
    const ordered = timeRows(dataset, valid);
    const label = dataset.valueLabel || dataset.yLabel;
    if (ordered.length) addCandidate(candidates, {
      id: "japan-station-records", lens: "同じ地点の公開観測記録", method: `${label}を並べる`, score: 2, status: "descriptive",
      title: `${ordered.length}年分の${label}を、同じ地点で見る`,
      signal: `${rangeLabel(ordered)}の有効な${ordered.length}件を表示しています。`,
      meaning: "地点コードで対応する保存値です。年平均・年合計・年度最小値など、元資料の集計方法を保っています。全国平均や現在の瞬時値ではありません。",
      question: "値が違う年で、観測条件や周囲の環境はどう違ったのか？",
      test: "元資料の集計方法・欠測・機器や地点の変更を確かめ、同じ期間・単位のセンサー記録と比較する。",
      caveat: `観測網・機器・設置場所の変更に注意し、原因、安全性、センサーの校正値を断定しません。${dataset.insightContext?.sensorMetric === "ph" ? "pHの最小値の平均を水素イオン濃度の平均として扱わないでください。" : ""} ${dataset.comparisonNote || ''}`,
      evidence: [[ordered[0].label, ordered[0].value, dataset.unit], [ordered.at(-1).label, ordered.at(-1).value, dataset.unit], ["有効な記録", ordered.length, "件"]],
      recordIds: ids(ordered), calculation: "公開元の期間・値・単位を対応させ、欠測と注記付き値を除外。補間・傾向線・予測は加えない。",
      chart: { ...pointChart(ordered, { xLabel: dataset.xLabel, yLabel: label, unit: dataset.unit }), xTicks: annualAxisTicks(ordered) },
    });
  }
  if (valid.length && !["prtr", "river-biology", "food"].includes(domain)) {
    if (!["earthquakes", "japan-sensor-open"].includes(domain)) temporalCandidates(candidates, dataset, valid, domain);
    if (domain === "ocean") oceanCandidate(candidates, dataset, valid);
    if (domain === "aerosol") aerosolCandidate(candidates, dataset, valid);
    if (domain === "co2-paired") pairedCo2Candidate(candidates, dataset, valid);
    if (["culture", "pollination"].includes(domain)) categoryCandidate(candidates, dataset, valid, domain);
    if (["earthquakes", "quake-events"].includes(domain)) quakeCandidate(candidates, dataset, valid, domain);
    if (!temporal) {
      concentrationCandidates(candidates, dataset, valid, domain);
      if (domain === "migration") migrationCandidates(candidates, dataset, valid);
      peerCandidate(candidates, dataset, valid, domain);
      sparseCandidate(candidates, dataset, valid, domain);
    }
    distributionCandidates(candidates, dataset, valid, domain);
  }
  if (!candidates.length) addCandidate(candidates, {
    id: "not-enough-comparison", lens: "問いを立てるための観測設計", method: "比較可能性の点検", score: 0, status: "needs-comparison",
    title: valid.length ? "この範囲から、無理に特徴や原因を作らない。" : "今の条件では、課題の手がかりを探す観測がありません。",
    signal: `選択範囲の有効な記録は${valid.length}件です。差・集中・時間変化を裏付ける比較が不足しています。`,
    meaning: "特徴が見つからないことも、問いの作り方を変える手がかりです。記録の番号や保存順を意味のある違いに置き換えません。",
    question: "何と何を、同じ条件で比べればこの問いを確かめられるか？", test: "観測時点・対象・測定量を確認し、対応した比較相手を追加する。絞り込みが強すぎる場合は対象範囲を見直す。",
    caveat: "不足する値や傾向を推測で補いません。", evidence: [["有効な記録", valid.length, "件"]], calculation: "利用できる測定値と比較可能な軸を点検。", chart: { type: "summary" },
  });
  const sourceCaveat = [dataset.comparisonNote, dataset.missingCount ? `全収録期間の欠測${dataset.missingCount}${domain === "food" ? "期間" : "年"}は計算から除外し、0や推定値に置き換えていません。` : ""].filter(Boolean).join("\n\n");
  if (sourceCaveat) candidates.forEach(candidate => {
    candidate.caveat = [...new Set([candidate.caveat, sourceCaveat].filter(Boolean).flatMap(note => note.split(/\n\s*\n/u)))].join('\n\n');
  });
  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const primary = candidates[0];
  const nonSource = valid.filter(row => row.provenance && row.provenance !== "SOURCE").length;
  const model = dataset.insightContext?.measurementKind === "MODEL" || /モデル/u.test(dataset.title || "");
  const scope = `${dataset.title} / 現在の対象 ${valid.length}行${recordQuery ? ` / 絞り込み「${recordQuery}」` : ""}。${model ? "モデル値を含む出典由来の記録です。" : "出典由来の収録値についての探索です。"}${nonSource ? `派生値を含みます（${nonSource}行）。` : ""}${excluded ? `補完値${excluded}行は特徴探索から除外しました。` : ""}${methodId !== "discovery" ? "課題探索は選択した統計手法の結論とは別です。その手法の読み取りは下の補足で確認できます。" : ""}`;
  const reading = visitorReading(primary, dataset);
  for (const candidate of candidates) {
    const social = buildSocialInsight(dataset, domain, candidate);
    const computed = buildDecisionInsight(dataset, domain, candidate, valid, social.profileKey);
    candidate.socialInsight = {...social, summary:computed.summary, status:computed.status};
    candidate.computedInsight = computed;
    candidate.title = computed.headline;
    candidate.meaning = computed.summary;
    candidate.statisticalTest = candidate.test;
    candidate.test = [...new Set([candidate.test, social.need].filter(Boolean))].join(' ');
    candidate.caveat = [...new Set([candidate.caveat, social.limit].filter(Boolean))].join('\n\n');
  }
  reading.summary = primary.socialInsight.summary;
  reading.headline = primary.computedInsight.headline;
  return { methodId, domain, primaryId: primary.id, status: primary.status, ...reading, socialInsight: primary.socialInsight,
    comparison: primary.comparison || null,
    scopeLabel: `${model ? "モデル値を含む記録" : "出典に基づく記録"} · ${valid.length}件${recordQuery ? ` · 絞り込み「${recordQuery}」` : ""}${excluded ? ` · 補完値${excluded}件を除外` : ""}`,
    evidence: primary.computedInsight.metrics, computedInsight:primary.computedInsight, caveat: primary.caveat, scope, candidates: candidates.slice(0, 4),
    analysis: { lens: primary.lens, method: primary.method, calculation: `${primary.calculation}\n${primary.computedInsight.calculation||''}`, examined: candidates.map(candidate => candidate.lens) },
    findings: [
      { kind: "observation", title: "ファクト", body: primary.signal, recordIds: primary.recordIds },
      { kind: "meaning", title: primary.computedInsight.status==='insufficient'?'比較結果は未成立':'インサイト', body: reading.summary, recordIds:primary.computedInsight.recordIds },
      { kind: "limit", title: "留意事項", body: primary.caveat },
    ],
  };
}

export function analyzeDiscovery({ dataset, rows, recordQuery = "" }) {
  const dataInsight = discoverData({ dataset, rows, recordQuery });
  const primary = dataInsight.candidates[0];
  const numericRows = rows.filter(row => numeric(row.value));
  const base = ["culture", "pollination"].includes(dataInsight.domain) ? {} : analyzeSummary({ values: numericRows.filter(row => row.provenance !== "IMPUTED" && row.valueStatus !== "IMPUTED").map(row => row.value), label: dataset.valueLabel || dataset.yLabel || dataset.title, unit: dataset.unit, provenance: dataset.provenance });
  return { ...base, kind: numericRows.length ? "discovery" : "not-applicable", dataInsight, metrics: dataInsight.evidence, chart: primary.chart,
    formula: dataInsight.analysis.calculation,
    insight: { headline: dataInsight.headline, meaning: dataInsight.summary, interpretation: primary.signal, evidence: dataInsight.evidence,
      limitations: [primary.caveat, "表示した比較は収録範囲の分析結果です。条件付き試算は施策効果の予測ではありません。"],
      nextActions: ["01 分布で確認する", "観測データの対象を確かめる"], provenance: dataset.provenance },
  };
}
