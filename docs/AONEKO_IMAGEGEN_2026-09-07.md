# 青猫：台本に基づくシルエット再制作

2026-09-07 / ローカル差し替え。今回の変更はpush・デプロイしていません。

## 制作方法と採用素材

- 制作サービス: OpenAI ImageGen、Codexの組み込み画像生成ツール。CLI/API fallbackは使用していません。
- 用途: キャラクター紹介の青猫。物語本文・他の3人の画像や人物設定は変更しません。
- 採用先: `assets/characters/aoneko-silhouette-imagegen-v3.png`。
- 生成元ファイル: `exec-7d8e6d08-b11c-48cc-94aa-72d87ceaca6c.png`。寸法887×1774px。
- 生成された透過PNGを無加工でコピーし、生成時のalphaを保持します。輪郭や背景をSVG・CSS・画像処理で後付けしたものではありません。
- 旧 `aoneko-silhouette.svg` は履歴・素材として残し、キャラクター表示からの参照だけを置き換えます。
- 生成前の不採用案（男性的なSVG、立体的な無貌の人物、顔を描いた人物、自信のあるモデルポーズ）は採用しません。
- アカウントの利用プランは確認していません。個別素材のSHA-256は `docs/media-rights-ledger.json` に記録します。

## 台本の根拠と演出上の解釈

正本は `story/現行統合台本.md`（現行の実行データから生成した本編）です。

| 安定ID | 本文の言動 | 立ち絵への解釈 |
|---|---|---|
| `festival_concept_new_002` | 学内チャットでは書きかけた返事を消すことが多く、参加登録も何度か閉じる | 堂々としたモデル立ちではなく、遠慮のある佇まい |
| `festival_concept_001` | 入口で立ち止まり、スマートフォンの参加証をもう一度開き直す | スマートフォンを手元に置く |
| `festival_concept_new_007` | 顔を上げるのを待ってもらい、肩にかけた鞄をようやく持ち直す | 肩鞄を持ち、顎を少し下げる |
| `esp32_pitch_006` | 鞄の紐を握る指に力が入り、話そうとすると言い方が浮かばない | 鞄の紐を握り、肘を体の近くへ収める |
| `welcome_chat_044` | 朝は誰にも見つからないように下を向いて歩いていたと振り返る | 内向きの肩と自然な伏し目の角度 |

服装は本文で特定されていないため、ユーザー指定の「中性的」「スカートではない」「シルエット」を満たすための新規デザインです。性別・性自認の設定を追加するものではありません。

## 最終生成プロンプト

```text
Use case: illustration-story
Asset type: transparent full-body silhouette for the Japanese visual novel character-introduction page, Aoneko (青猫).
Primary request: Draw ONE genuinely androgynous, socially hesitant young adult university student as a TRUE FLAT SILHOUETTE, not a rendered character with the face erased. Entire person, hair, hands, clothing, phone and bag are a single opaque muted dusty blue-gray silhouette, with a very few subtle near-tone contour marks only where the hands and layers overlap. No facial features, no skin, no modeled faceless head. Clean 2D anime-derived contour on genuinely transparent alpha background.
Personality / script basis: This protagonist deletes unsent chat replies, almost cancels attending the campus festival, walks looking down so nobody notices them, grips their bag strap when struggling to speak. They love electronics but feel out of place socially. This is a shy ordinary person trying to make themself small, with gentle curiosity, not a confident model or mysterious supernatural being.
Pose is the most important correction: head gently bowed about 15 degrees, slightly turned toward their hands; softly rounded narrow shoulders held a little forward, elbows kept close to the ribs. One sleeve-covered hand quietly clutches the strap of a small soft shoulder bag low at the sternum; the other holds a small phone near the abdomen. Small naturally hesitant standing stance, feet close and both planted, no crossed runway legs, no hip jut, no hand in pocket, no hand on collar, no chest thrust, no proud chin. Natural 6.5-to-7-head anime proportions, not tall elongated fashion proportions.
Androgynous clothing: contemporary soft gender-blurring layered separates, no skirt. Loose collarless soft cardigan with dropped shoulders and slightly asymmetrical hip-length hem, over a fluid blouse with long softly gathered cuffs covering part of the hands; relaxed high-rise pleated trousers, visibly two separate straight trouser legs, simple round-toe flat ankle shoes. Thoughtfully chosen soft and structured shapes together; not masculine tailoring, not feminine costume. No hoodie, no suit jacket, no necktie or bow, no frills, no heels, no dress. Hair: soft medium-length layered shag/bob to the nape, naturally falling fringe, neither short masculine spikes nor long princess hair. Narrow unaccentuated frame, no broad shoulders, thick neck, muscles, breasts or hourglass shape.
Rendering: the silhouette's outer contour carries the character and the clothing. A friendly anonymous human paper-cut shadow, muted medium blue-gray visible on a dark teal UI. NOT black horror shadow, NOT 3D, NOT an alien, NOT a mannequin, no face-shaped highlights, no eyes, no luminous outline, no auras or effects.
Composition: vertical portrait roughly 1:2, entire body and shoes visible, comfortable transparent margin all around, centered. No background, no floor, no cast shadow, no text, no symbols or watermark.
```

## 検証

- `scripts/check-aoneko-character-browser.mjs`: 透過alpha・画像読込・5画面幅のキャラクター切替・本名非表示・既存3人の表情復元・スマホの紹介文との重なりを検査します。
- 見た目の確認はブラウザのスクリーンショットで別途行います。ポーズや中性的な印象は、自動テストの合格だけで判断しません。

### 実施結果

- `npm run check` / `npm run check:rights` / `git diff --check`: PASS。メディア台帳は281件。
- 3840・1920・1440・390・320pxのキャラクター紹介検証: PASS。ブラウザエラー・404なし。
- 画像外周の四隅alphaはすべて0。完全透過画素67.68%、alpha 240以上の画素29.53%。内部は主にalpha 251〜254のため、完全不透明255のみを要求する初回の検査を、実際のPNGに即した近似不透明領域の検査へ修正。
- 3840・1440pxの全身、390・320pxの紹介文との配置を目視確認。台本由来の伏せた頭・内向きの肩・鞄を握る手を確認。
- 最終レポートと画像: `artifacts/aoneko-imagegen-verified/report.json` および同ディレクトリの画面幅別PNG。

## 後続の姿勢修正

同日の製作者指摘「首を傾けすぎ・頭身をもう少し低く」に対応し、ローカル表示を `aoneko-silhouette-imagegen-v4.png` へ更新した。上記v3の制作・検証記録とファイルは履歴として維持する。現行の修正方法・製作者が承諾した背景のみの透過処理・最終プロンプト・検証は [姿勢修正記録](AONEKO_POSTURE_2026-09-07.md) を参照。
