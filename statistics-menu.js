// Small, deterministic SVG concept diagrams. These illustrate a method, not the
// current dataset; method IDs and the statistical calculation catalogue stay intact.
export const ANALYSIS_PURPOSES = {
  descriptive: { title: "特徴を探す", icon: "discovery", tone: "mint" },
  probability: { title: "分布を調べる", icon: "continuous", tone: "blue" },
  estimation: { title: "推定の幅を見る", icon: "interval", tone: "violet" },
  testing: { title: "差を確かめる", icon: "welch", tone: "gold" },
  regression: { title: "関係をモデル化", icon: "regression", tone: "blue" },
  bayesian: { title: "観測で更新する", icon: "bayes", tone: "violet" },
  workflow: { title: "分析の流れを確認", icon: "exercise", tone: "mint" },
};

export const ANALYSIS_CARDS = {
  discovery: ["特徴から課題を探す", "集中・変化・違いから、次の問いへ。"],
  summary: ["値の集まりを見る", "中心・ばらつき・外れた値をつかむ。"],
  scatter: ["2つの値の関係を見る", "一緒に増える？ 逆に動く？"],
  moments: ["分布の形を数値にする", "平均・分散・ゆがみ・累積を読む。"],
  discrete: ["発生件数を調べる", "何回起きるかを確率モデルで見る。"],
  continuous: ["理論分布と比べる", "正規分布などと比べ、値を標準化。"],
  sampling: ["標本平均の安定を見る", "標本数で、平均の散らばりはどう変わる？"],
  unbiased: ["ばらつきを推定する", "標本から母集団の分散を推定。"],
  interval: ["推定の幅を見る", "平均・分散・比率を区間で捉える。"],
  "difference-ci": ["2群の差を区間で見る", "差の大きさと、その不確かさを比べる。"],
  hypothesis: ["仮説とデータを比べる", "p値と効果量を一緒に確認する。"],
  welch: ["2群の平均を比べる", "ばらつきが違う2群も比較する。"],
  paired: ["同じ対象の前後を比べる", "一対一に対応した値の差を調べる。"],
  anova: ["複数の群を比べる", "群の間と群の中のばらつきを見る。"],
  binomial: ["起きた割合を確かめる", "成功回数が仮説の割合に合うか。"],
  categorical: ["分類の偏りを調べる", "クロス集計から、分類同士の関係へ。"],
  fisher: ["少数の分類データを比べる", "小さな2×2表を正確に検定する。"],
  bh: ["検定のしすぎを補正する", "複数の比較による偽発見を抑える。"],
  regression: ["変化の傾きを捉える", "2つの値の関係を線で表す。"],
  multiple: ["複数の条件を一緒に見る", "条件を同時に入れて係数を比べる。"],
  logistic: ["起きる確率をモデル化", "二択の結果を確率で表す。"],
  diagnostics: ["モデルのずれを調べる", "当てはまり・係数・残差を確認。"],
  prediction: ["予測の幅を見る", "予測区間と変数同士の重なりを読む。"],
  bayes: ["観測から確率を更新する", "事前分布から事後分布への変化。"],
  mcmc: ["推論の安定を確かめる", "チェーンの収束と有効標本を調べる。"],
  exercise: ["分析の流れを確認する", "問いから次の分析まで、6項目を確認。"],
};

const dots = (points, radius = 2.5) => points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${radius}" fill="currentColor" stroke="none"/>`).join("");
const axis = '<path class="stat-icon-axis" d="M8 7v43h82"/>';
const bell = '<path d="M9 47C29 47 31 11 49 11S69 47 89 47"/>';
const bars = '<path d="M15 49V38h11v11m5 0V24h11v25m5 0V12h11v37m5 0V29h11v20m5 0V41h10v8"/>';
const points = dots([[16,41],[27,42],[32,31],[42,35],[51,23],[61,29],[70,15],[81,19]]);
const intervals = '<path d="M18 16h49m-49-4v8m49-8v8M34 31h50m-50-4v8m50-8v8M11 45h46m-46-4v8m46-8v8"/>' + dots([[40,16],[61,31],[31,45]], 3.2);
const diagrams = {
  discovery: bars + '<circle cx="68" cy="19" r="12"/><path d="m77 28 12 12"/>',
  summary: axis + bars,
  scatter: axis + points,
  moments: axis + bell + '<path class="stat-icon-secondary" d="M10 45C30 45 32 37 46 29S66 10 88 10"/><path class="stat-icon-guide" d="M49 10v39"/>',
  discrete: axis + '<path d="M18 48V39m15 9V24m15 24V13m15 35V23m15 25V38"/>' + dots([[18,39],[33,24],[48,13],[63,23],[78,38]], 3.5),
  continuous: axis + '<path class="stat-icon-fill" d="M36 49V25C40 16 44 11 49 11s9 5 13 14v24Z"/>' + bell,
  sampling: '<path class="stat-icon-secondary" d="M8 46C18 46 25 17 35 17s17 29 27 29"/><path d="M35 46C47 46 47 9 59 9s12 37 26 37"/><path class="stat-icon-axis" d="M8 50h82"/>',
  unbiased: axis + '<path class="stat-icon-guide" d="M10 29h77"/><path d="M20 40V29m16-9v9m15 15V29m15-14v14m15 8v-8"/>' + dots([[20,40],[36,20],[51,44],[66,15],[81,37]]),
  interval: intervals,
  "difference-ci": intervals + '<path class="stat-icon-guide" d="M47 6v46"/>',
  hypothesis: axis + bell + '<path class="stat-icon-fill" d="M10 48c12 0 16-14 20-25v25Zm59 0V23c4 11 8 25 20 25Z"/><path class="stat-icon-secondary" d="M73 15v35"/>',
  welch: '<path d="M8 47C20 47 20 15 34 15s14 32 27 32"/><path class="stat-icon-secondary" d="M37 47C48 47 48 10 63 10s15 37 28 37"/><path class="stat-icon-guide" d="M34 9v42m29-46v46"/>',
  paired: '<path d="m21 17 53 11m-32 4 53 9m-53 4 53-29m-53 5 53-13"/>' + dots([[21,17],[21,32],[21,45],[21,21],[74,28],[74,41],[74,16],[74,8]], 3),
  anova: '<path d="M21 13v33m-8-25h16m-16 17h16M49 6v40m-8-31h16m-16 17h16M77 20v31m-8-24h16m-16 16h16"/>' + dots([[21,30],[49,24],[77,34]], 4),
  binomial: dots([[19,17],[34,17],[49,17],[64,17],[79,17],[19,36],[34,36]], 5) + '<g class="stat-icon-secondary"><circle cx="49" cy="36" r="5"/><circle cx="64" cy="36" r="5"/><circle cx="79" cy="36" r="5"/></g>',
  categorical: '<path d="M13 9h72v40H13Zm24 0v40m24-40v40M13 29h72"/><path class="stat-icon-fill" d="M13 9h24v20H13Zm48 20h24v20H61Z"/>' + dots([[49,19],[25,39]], 4),
  fisher: '<path d="M22 8h54v42H22Zm27 0v42M22 29h54"/>' + dots([[30,17],[40,21],[61,19],[30,39],[57,36],[66,41]], 2.5),
  bh: axis + '<path class="stat-icon-guide" d="M12 39h75"/><path d="m16 44 14-3 14-5 14-8 14-5 14-14"/><path class="stat-icon-secondary" d="m16 46 14-1 14-3 14-5 14-7 14-13"/>',
  regression: axis + points + '<path class="stat-icon-secondary" d="m12 47 74-34"/>',
  multiple: '<path d="m12 14 37 15-37 15M12 29h37m0 0 35-1m-8-7 8 7-8 7"/><circle cx="12" cy="14" r="5"/><circle cx="12" cy="29" r="5"/><circle cx="12" cy="44" r="5"/><circle cx="49" cy="29" r="5"/><circle cx="85" cy="28" r="6"/>',
  logistic: axis + '<path d="M11 46h14c26 0 15-34 41-34h21"/><path class="stat-icon-guide" d="M11 29h76"/>',
  diagnostics: axis + '<path class="stat-icon-guide" d="M9 28h79"/>' + dots([[17,18],[27,40],[38,24],[49,36],[60,14],[70,32],[81,22]]),
  prediction: axis + '<path class="stat-icon-fill" d="m12 36 32-9 43-22v26L44 35 12 49Z"/><path d="m12 43 75-25"/>' + dots([[20,35],[33,39],[46,25],[58,30],[75,19]]),
  bayes: '<path class="stat-icon-secondary" d="M7 47C17 47 17 13 33 13s16 34 30 34"/><path d="M35 47C47 47 47 8 61 8s14 39 29 39"/><path class="stat-icon-axis" d="M9 51h80"/><path d="M42 7h12m-5-4 5 4-5 4"/>',
  mcmc: axis + '<path d="m12 23 7 7 7-16 7 23 7-6 7 8 7-24 7 11 7-7 7 16 7-12"/><path class="stat-icon-secondary" d="m12 35 7-15 7 9 7-12 7 25 7-14 7 8 7-19 7 13 7-9 7 16"/>',
  exercise: '<path d="M20 14h29v27h28M49 14h28M20 14v27h29"/>' + [[20,14],[49,14],[77,14],[20,41],[49,41],[77,41]].map(([x,y]) => `<rect x="${x-6}" y="${y-6}" width="12" height="12" rx="3" fill="var(--stat-card-bg, #102733)"/>`).join(""),
};

export const analysisIcon = id => `<svg class="gaia-statistics-concept" viewBox="0 0 98 58" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${diagrams[id] || diagrams.summary}</svg>`;
