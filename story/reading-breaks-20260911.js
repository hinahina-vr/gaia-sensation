// 2026-09-11: 「変な改行なおして」. Change page boundaries only;
// preserve the approved manuscript, characters, speaker, IDs and staging.
export const readingBreakRevisionId = "reading-breaks-20260911";
export const readingBreakRevisions = [
  {
    id: "beyond_03_add_049",
    before: ["遠い宇宙の星々から、光の明滅が応えた。", "その向こうでも、一つ、また一つと光が灯る。\n放課後は、どこまでも終わらない。"],
    after: ["遠い宇宙の星々から、光の明滅が応えた。", "その向こうでも、一つ、また一つと光が灯る。\n", "放課後は、どこまでも終わらない。"]
  },
  {
    id: "beyond_03_053",
    after: ["ルウの楽しさが、問いかけと一緒に広がった。\n", "『次は、どこを測ってみようか？』"]
  },
  {
    "id": "beyond_02_009",
    "before": [
      "それでも、各地のちっぽけな測定を持ち寄って、1台では見",
      "えない地球のうねりを捉えようと足掻いていたのですわ。"
    ],
    "after": [
      "それでも、各地のちっぽけな測定を持ち寄って、",
      "1台では見えない地球のうねりを捉えようと足掻いていたのですわ。"
    ]
  },
  {
    "id": "beyond_02_020",
    "before": [
      "原子の配置も傷も完全にスキャンできるなら、地層から発掘",
      "なんてしないで、新品を生成すればよかったんじゃない？"
    ],
    "after": [
      "原子の配置も傷も完全にスキャンできるなら、",
      "地層から発掘なんてしないで、新品を生成すればよかったんじゃない？"
    ]
  },
  {
    "id": "beyond_03_002",
    "before": [
      "恒星の大気圏を遊泳する知性はフレアの乱れを色彩として知覚し、厚い氷殻",
      "の下に眠る暗黒の海は、潮汐のリズムをひとつの鼓動として響かせている。"
    ],
    "after": [
      "恒星の大気圏を遊泳する知性はフレアの乱れを色彩として知覚し、",
      "厚い氷殻の下に眠る暗黒の海は、潮汐のリズムをひとつの鼓動として響かせている。"
    ]
  },
  {
    "id": "beyond_03_003",
    "before": [
      "宇宙船の構造体は恒星風を孕むセイルの歪みで重力を読み取り、星間ガスに根",
      "を張る森は、数十万年の開花サイクルをひとつの交響詩として奏でていた。"
    ],
    "after": [
      "宇宙船の構造体は恒星風を孕むセイルの歪みで重力を読み取り、",
      "星間ガスに根を張る森は、数十万年の開花サイクルをひとつの交響詩として奏でていた。"
    ]
  },
  {
    "id": "beyond_03_009",
    "before": [
      "ここでは、人間も、海も、恒星も、機械も、お互いの揺らぎ",
      "を自分のことのように感じ合って、応答を返しているんだ。"
    ],
    "after": [
      "ここでは、人間も、海も、恒星も、機械も、",
      "お互いの揺らぎを自分のことのように感じ合って、応答を返しているんだ。"
    ]
  },
  {
    "id": "beyond_03_040",
    "before": [
      "けれど、そこに刻まれたループ――感じ取り、記録し、境界を越えて手渡すという営",
      "みは、二百七十万年後の星間ネットワークにも、まったく同じ温度で脈打っていた。"
    ],
    "after": [
      "けれど、そこに刻まれたループ――感じ取り、記録し、境界を越えて手渡すという営みは、",
      "二百七十万年後の星間ネットワークにも、まったく同じ温度で脈打っていた。"
    ]
  },
  {
    "id": "beyond_03_048",
    "before": [
      "恒星は秒刻みでスペクトルを変え、凍てつく星の氷原は千年単位の波紋を描",
      "き、星間分子雲の森では幾千世代の記憶がひとつの煌めきとなって瞬く。"
    ],
    "after": [
      "恒星は秒刻みでスペクトルを変え、凍てつく星の氷原は千年単位の波紋を描き、",
      "星間分子雲の森では幾千世代の記憶がひとつの煌めきとなって瞬く。"
    ]
  }
];

export function applyReadingBreaks(scenes, {reverse = false} = {}) {
  const result = structuredClone(scenes);
  const steps = new Map(result.flatMap(scene => scene.steps.map(step => [step.id, step])));
  for (const revision of readingBreakRevisions) {
    const step = steps.get(revision.id);
    const before = reverse ? revision.after : revision.before;
    const after = reverse ? revision.before : revision.after;
    if (!step || JSON.stringify(step.pages) !== JSON.stringify(before)
      || (before && before.join("") !== step.text) || (after && after.join("") !== step.text)) {
      throw new Error(revision.id + ": reading-break revision differs from source");
    }
    if (after) step.pages = [...after];
    else delete step.pages;
  }
  return result;
}
