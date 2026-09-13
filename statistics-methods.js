// Group by statistical purpose, independently of the former lecture numbering.
// Method IDs remain stable so saved views and dataset defaults keep working.
export const METHOD_GROUPS = [
  { id: "descriptive", name: "記述・探索", methods: [
    ["discovery", "特徴から課題を探す", "集中・変化・似た条件での違いを探索し、確かめるべき問いを選びます。"],
    ["summary", "値の分布を見る", "値がどこに集まり、どこから外れているかを見る。"],
    ["scatter", "散布図・共分散・Pearson相関", "2変数の方向と強さを、点の配置から確認します。"],
  ] },
  { id: "probability", name: "確率分布", methods: [
    ["moments", "PMF・PDF・CDF・モーメント", "分布の形を期待値、分散、歪度、尖度で要約します。"],
    ["discrete", "二項・ポアソン・幾何分布", "件数と発生間隔を離散確率モデルと照合します。"],
    ["continuous", "一様・指数・正規・標準化", "観測値をz得点と理論確率面積へ変換します。"],
  ] },
  { id: "estimation", name: "標本・推定", methods: [
    ["sampling", "チェビチェフ・大数・CLT", "標本平均が安定していく過程と境界を可視化します。"],
    ["unbiased", "不偏分散", "nではなくn−1で割る意味を標本から確認します。"],
    ["interval", "平均・分散・比率の信頼区間", "点推定だけでなく推定の幅を表示します。"],
    ["difference-ci", "2群差・分散比の区間", "前半と後半など、2群の差と不確実性を比較します。"],
  ] },
  { id: "testing", name: "仮説検定", methods: [
    ["hypothesis", "p値・片側/両側・検出力", "帰無仮説と効果量を並べ、p値だけで判断しません。"],
    ["welch", "z/t/χ²・等分散t・Welch", "2群平均を分散が異なる可能性も含めて比較します。"],
    ["paired", "対応ありt検定", "同じ対象を対応させ、対象内の差を検定します。"],
    ["anova", "1元・2元配置ANOVA", "群間・群内のばらつきと交互作用の可否を確認します。"],
    ["binomial", "正確二項検定", "成功数を二項分布の仮説と比較します。"],
    ["categorical", "クロス集計・χ²独立性", "カテゴリの組み合わせに偏りがあるか確認します。"],
    ["fisher", "Fisher正確検定", "小標本の2×2表を近似なしで評価します。"],
    ["bh", "BH多重比較補正", "複数のp値を同時に扱うときの偽発見を抑えます。"],
  ] },
  { id: "regression", name: "回帰分析", methods: [
    ["regression", "単回帰・多項式・最小二乗", "説明変数1単位あたりの変化を直線として推定します。"],
    ["multiple", "重回帰", "複数の自然条件を同時に入れ、係数を比較します。"],
    ["logistic", "ロジスティック回帰・最尤推定", "二値結果の確率をオッズ比で説明します。"],
    ["diagnostics", "R²・係数t・モデルF・残差", "当てはまりと残差を分けてモデルを診断します。"],
    ["prediction", "予測区間・多重共線性", "予測の幅と説明変数同士の重なりを表示します。"],
  ] },
  { id: "bayesian", name: "ベイズ推論", methods: [
    ["bayes", "Beta–Binomial・HDI", "事前分布が観測によってどう更新されたか示します。"],
    ["mcmc", "MCMC診断", "決定的なチェーンで収束指標と有効標本を確認します。"],
  ] },
  { id: "workflow", name: "分析の進め方", methods: [
    ["exercise", "分析の流れを確認する", "データに合う分析結果を表示し、問い・出典・図・推定・限界・次の分析の6項目を確認します。"],
  ] },
];

export const METHOD_LOOKUP = new Map(METHOD_GROUPS.flatMap(group => group.methods.map(method => [
  method[0], { group, id: method[0], label: method[1], copy: method[2] },
])));

// Existing result generators still emit lecture-prefixed next actions. Resolve
// them to their original method, then select that method in the new category.
const LEGACY_ACTION_METHODS = {
  "01": "summary", "02": "moments", "03": "discrete", "04": "continuous",
  "05": "sampling", "06": "interval", "07": "hypothesis", "08": "welch",
  "09": "categorical", "10": "anova", "11": "regression", "12": "diagnostics",
  "13": "logistic", "14": "bayes", "15": "exercise",
};
export const resolveLegacyAction = action => METHOD_LOOKUP.get(LEGACY_ACTION_METHODS[String(action).match(/^(\d{2})\s/u)?.[1]]) || null;
export const actionLabel = action => String(action).replace(/^\d{2}\s+/u, "");
