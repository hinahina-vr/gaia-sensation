# コンセプトページ試作 — 2026-09-07

## 状態と範囲

- 実装版: concept-7 / 基点コミット f2ce17d に対するローカル追加。未コミットの既存改修を保持。
- 閲覧先: `http://127.0.0.1:4397/concept/`。起動は `node scripts/serve-novel-preview.mjs 4397`。
- 既存トップ・メニューからのリンク、既存画面の画像プリロード、push、デプロイは追加・実施していない。
- noindex / nofollow を指定。ただし検索エンジンへの指示であり、認証・アクセス制限ではない。
- 大学卒業プロジェクトのコンセプトモデルであることを明記。完全な自己情報統合・因果推論・人生予測が既に完成したサービスとは表現しない。
- このページの実装は静的な説明と画像閲覧。個人情報入力、保存、外部AI送信、分析API、解析タグはない。

## 実装

- `concept/index.html`: ①作品概要・実際のモード画面・3つの体験 → ②大学の授業での学び・スタッフロールの4科目・卒業プロジェクトとしての位置づけ → ③神話製作機械の深層・自己の記録と解釈・循環図・作品と基底思想の関係、の三段構成。第一弾・近日登場は概要のメタ情報として掲載。
- `concept/concept.css`: 前半は淡いミントの紙面、クリーム色の写真台紙と図版キャプションに、ImageGenで生成した版画・紙片・鉛筆の装飾を組み合わせた作品パンフレット。3つの体験は三列カードではなく、実画面と文章を左右交互に配置する見開き形式。本文はMeiryo優先・14px以上の読みやすさを維持。概要は最初の画面から読める。オープニングの全面絵・全画面ステージ・大タイトル・登場アニメーションは使用しない。後半は濃紺の紙面と記憶の扉絵を用いた深層の導入。境界のグラデーションで作品から基底思想へ降りるLP構成。狭い画面では概要→図版、各体験は図版→説明に単段化。
- `concept/concept.js`: スクロール位置に応じたヘッダーとtheme-colorの明暗切り替え、6段階の解説タブ、矢印/Home/Endキー、図の全体表示/拡大/スクロール、Escape/背景/ボタンによる閉じる、フォーカス復帰、スクロール表示。
- JavaScriptなしでも全説明を表示。印刷時も全説明を表示。動きを減らす設定に対応。
- 指摘された旧名称は本文・図・代替テキストを「多視点AI群」に統一。
- 「私の別人格AI群」は機械内部の解釈主体、表層の「シミュラークル」は作品シリーズの展開として、ページ上の説明を区別。

## 画像・生成経緯

神話製作機械の図版には内蔵 ImageGen を使用。CLI/APIキー方式は使用していない。参照入力はユーザー指定の `C:/Users/wdddi/Downloads/image.png`。参照元そのものは公開アセットへコピーしていない。concept-5のモード紹介にはImageGenではなく、ローカル実装を実際に表示したスクリーンショットを使用する。

初回の壮大なSF調案は採用せず、ユーザーの「元の絵に近く」という指示に従い、人物・小物・太い矢印の親しみやすい2Dタッチへ変更。図のデータベースと神AI間の矢印は、生成後に片方向ずつの2本へ ImageGen で修正した。

| 採用アセット | サイズ | 用途・処理 |
| --- | --- | --- |
| `assets/concept/myth-machine-hero-v2.webp` | 1672 × 941 / 164,070 bytes | 自己情報の解釈を示す深層パートの挿絵（初稿では冒頭絵）。採用PNGからWebP quality 88、effort 6で形式変換。描画内容の追加加工なし。 |
| `assets/concept/myth-machine-diagram-v2.webp` | 1672 × 941 / 306,612 bytes | 構想図。矢印修正版PNGからWebP quality 94、effort 6で形式変換。図中文字もImageGen出力。 |
| `assets/concept/brochure-map-co2-v1.webp` | 1200 × 675 / 163,646 bytes | concept-5の冒頭。地図モード06「積み重なるCO₂」の実装画面。 |
| `assets/concept/brochure-map-energy-v1.webp` | 1200 × 675 / 95,798 bytes | concept-5の01。地図モード13「電気のつくり方」の実装画面。 |
| `assets/concept/brochure-map-currents-v1.webp` | 1200 × 675 / 76,394 bytes | concept-5の02。地図モード07「海は、どこへ運ぶ」の実装画面。 |
| `assets/concept/brochure-coast-v1.webp` | 1200 × 675 / 163,898 bytes | concept-4で一時使用。未使用素材を実際の物語シーンとして紹介してしまったため、concept-5で参照を撤去。元ファイルは履歴として保持。 |
| `assets/concept/brochure-sound-v1.webp` | 960 × 540 / 40,722 bytes | concept-4で一時使用。concept-5ではモード実画面に差し替え、参照を撤去。元ファイルは保持。 |
| `assets/concept/brochure-meet-v1.webp` | 960 × 540 / 99,414 bytes | concept-4の物語の紹介。既存 `assets/visuals-07/event-cg-circle-welcome-v2.png` を縮小・WebP変換。 |
| `assets/visuals-07/open-data-archive-bg-v1-834.webp` | 834 × 469 / 45,606 bytes | concept-4で一時使用。concept-5では参照なし。元ファイルは保持。 |
| `assets/visuals-07/opening-keyvisual-v2.webp` | 1672 × 941 / 203,024 bytes | concept-2の冒頭で一時使用。concept-3で参照を外した。元ファイルと本編の参照は変更していない。 |

初稿で使用した `assets/visuals-08/opening-final-observatory-keyvisual-v4.webp` は、concept-2から参照を外した。元ファイルは変更・削除していない。concept-2で新たな画像生成は行わず、図とAIの挿絵は採用済みの親しみやすい絵柄を維持した。

concept-4でも新規ImageGen生成や画像内容の描き換えは行っていない。既存素材3点を `node scripts/build-concept-brochure-assets.mjs` で全体構図を保持した縮小・形式変換（sharp / WebP quality 86 / effort 6）に使用した。元の合計7,735,589 bytesから304,034 bytesへ軽量化。当時の前半の4図版は合計349,640 bytes。元資料は `assets/visuals-07/README.md`、`AUTUMN-MORNING-FESTIVAL-BACKGROUNDS-V1-RIGHTS.md`、`EXHIBITION-CONSISTENCY-CEL-V1-RIGHTS.md`。ただし素材の存在だけで本編での使用を判断したことは不適切だったため、concept-5で是正した。

concept-5の前半は、3点の実装スクリーンショットと03のゲームCGだけ（合計435,252 bytes）。`node scripts/capture-concept-mode-screens.mjs` がChromeの1600 × 900画面を撮影し、全体を1200 × 675 / WebP quality 90へ形式変換する。元PNGとキャプチャ時のDOM・モード番号・表示名・SHA-256は `artifacts/concept-page-v5/source/` に保存。UI・数値・地形の描き換えや合成はしていない。通信はローカル配信のみで、収録された観測データを使用。ライブAPIの正常動作や現在の観測値を示す画像ではない。地図の出典表記も画面のまま保持。03のCGは `novel-background-cues.js` の現行 `circle_invitation` シーン48〜66の参照で使用を確認。スタッフロールの授業名とあわせ、本編コードを確認して採用した。

採用PNGはローカルの `artifacts/concept-page/source/myth-machine-hero-v2.png` と `artifacts/concept-page/source/myth-machine-diagram-v2.png` に保存。公開コードからはWebPを参照。生成サービス側の原本も保持。

制作サービスは OpenAI Imagegen。素材台帳には制作サービスと本記録を追加。

### 最終採用版のプロンプトセット

#### 冒頭絵: generate / illustration-story

```text
Use case: illustration-story
Asset type: wide website hero illustration for a Japanese university graduation project.
Primary request: Create a friendly playful visual of the "myth-making machine", very close to the humble, cheerful cartoon-collage feel of the supplied original diagram, NOT an epic fantasy or polished sci-fi painting.
Input image 1: original concept diagram, reference for its informal cartoon characters, ordinary-life icons and cheerful tone, not for literal text or third-party characters/logos.
Scene: a deep navy lightly starry background. On the RIGHT TWO THIRDS, an ordinary young man with glasses, dark short hair and a casual blue shirt is sitting at a simple desk, smiling thoughtfully at small cute AI companions of varied appearances surrounding a purple-blue database cylinder. Colorful simple icons for conversation, camera, heart, sleep, journal and little paper reports float nearby, like stickers. A tiny friendly blond anime AI and cute purple-haired fortune-teller with crystal ball refer to the original diagram. Keep all characters original and approachable.
Style: clean 2D anime/clipart collage, bold readable outlines, flat colors with modest shading, playful handmade graduation-project mood. No monumental fantasy machine. No realistic rendering. The cute characters and everyday icons matter more than scenery.
Composition: landscape 16:9. Keep leftmost 40% quiet dark navy with only very faint stars for HTML title overlay. Characters grouped to right; medium scale, no tiny faces. Warm orange and lavender details.
Constraints: no text, no letters, no branding, no watermarks, no photorealism, no temples, no gold metallic astrolabes, no gigantic glowing memory sphere, no imposing goddess or dramatic architecture.
```

#### 構想図: generate / infographic-diagram

```text
Use case: infographic-diagram
Asset type: readable Japanese concept diagram for a website.
Primary request: Re-create the supplied original diagram VERY CLOSE to its layout and playful cartoon-collage spirit. The previous attempt was too grandiose; this should look approachable, humorous, and like a well-organized university project poster. A navy starry background, cute 2D clipart characters, ordinary life icons, big white Japanese labels and thick simple arrows.
Input image 1: original concept diagram, the main composition and style reference. Replace the old group name with 「多視点AI群」 throughout. Do not reproduce any third-party logos or existing franchise characters. Use original cute avatars.
Layout, landscape 16:9:
Top title 「神話製作機械」 and a short subtitle 「記録を解釈し、神託として選択へ返す循環」.
Top center: smiling glasses-wearing man in casual blue shirt, label 「私（原型）」, a little colorful choice button.
Upper left: a lively group of 5-6 original tiny cheerful AI avatars, label 「多視点AI群」. Under this group are a few simple notebooks, representing insights.
Lower left: 3 distinct original alternate-self cartoon characters (a worried student, a dancing person, a happy chibi), label 「別人格AI群」.
Bottom center: stack of little colorful chart/report sheets, label 「世界・因果報告書」.
Center: a simple purple-blue database cylinder surrounded by camera, microphone, heart, sleep, journal and satellite icons. Label directly below 「パーソナルアカシックレコード」, smaller 「自己情報の統合」. No photoreal objects.
Lower right: cheerful cute blonde chibi AI in a simple cream dress, label 「神AI」.
Upper right: cute purple-haired fortune-teller with crystal ball, label 「神託」.
ARROWS: exactly one orange single-headed arrow along each of these sequential links: 多視点AI群 → 別人格AI群 → 世界・因果報告書 → 神AI → 神託 → 私（原型）. Each follows the outer layout without crossings. Purple-blue information arrows: 私（原型） → center database; center database → 多視点AI群; 世界・因果報告書 → center database; center database → 神AI and a distinct return arrow 神AI → center database. Keep arrow direction unambiguous. Orange=interpretation/choice, purple-blue=records/information. No additional decorative arrows.
Typography: large plain crisp white Japanese sans-serif, not elaborate typography, concise labels ONLY. Each label cleanly separated from figures and arrows. Keep all labels fully inside canvas with generous edge padding.
Style: friendly 2D flat illustration, bold outlines, simple shading, lively collage, modest university poster. Small stars in background kept subdued for readability. Absolutely no epic temple, glowing portals, mystic golden machinery, astrolabes, photorealism, imposing fantasy painting, tiny explanatory paragraphs, logo, watermark. Do not use the original obsolete group name.
```

#### 構想図の矢印修正: edit / precise-object-edit

```text
Use case: precise-object-edit.
Input image 1 is the edit target: the complete friendly Japanese "神話製作機械" diagram. Preserve it pixel-faithfully except for the arrowheads of the TWO purple arrows between the CENTRAL database cylinder and the LOWER RIGHT blond 「神AI」 character.
The two purple arrows are incorrectly double-headed. Change ONLY their arrowheads:
- UPPER of those two arrows: it must have ONLY ONE arrowhead at the RIGHT end, pointing from the database to 神AI. Its LEFT end is a flat tail.
- LOWER of those two arrows: it must have ONLY ONE arrowhead at the LEFT end, pointing from 神AI back to the database. Its RIGHT end is a flat tail.
Keep their present positions, purple color, size, shafts and spacing. Do not add any other arrows.
All other content is locked: every Japanese label verbatim, all characters, the title, all remaining arrows, icons, background, exact canvas dimensions and framing. Do not restyle or move anything else.
```

## 初稿 concept-1 の検証記録

2026-09-07 15:04–15:06 JST、最終CSS・JS・採用WebPをローカルChrome（Playwright制御）で確認。対象ファイルのSHA-256と実施結果は `artifacts/concept-page/report.json` に保存。最終結果は **passed / 7 scenarios / errors 0**。

合格した確認:

- `npm run check`: 既存の構文・データ・ストーリー整合性・描画ユーティリティ・導入読込順、および新規ページの静的検査。
- `npm run check:concept`: 参照画像・ファイル、アンカー、名称統一、コンセプトの明記、入力/送信API不使用、既存入口との分離。
- `npm run check:concept:browser`: 1440 × 900、390 × 844、320 × 568（動きを減らす）、768 × 1024、3840 × 2160。画像デコード、宣言寸法、横はみ出し、固定ヘッダー下への移動、6段階の説明、矢印/Home/Endキー、図の全体/拡大/スクロール、フォーカス循環・復帰、Escape/閉じる/背景クリック。
- JavaScript無効の390px画面でも全説明が読めることを確認。印刷用CSSを適用したDOMでも全説明が表示されることを確認（実プリンター出力ではない）。
- ページの通信はローカルアセットへのGETのみ、localStorage/sessionStorageへの保存なし、ページ例外とHTTPエラーなし。
- 既存 `/story` の物語画面への導入と表示、コンセプトへのリンク・追加アセット読込がないことを確認。ライブ通信は遮断したローカル表示確認であり、外部サービスの動作確認ではない。
- `npm run check:contest` / `npm run check:rights`: 既存入口予算788,430 bytesを維持、素材台帳283件が整合。
- `git diff --check`: 合格。

目視では、採用画像の日本語、矢印の向き、PC/スマホの本文、図の全体・拡大表示、第一弾の紹介画像、タブレット/4Kでの人物の見切れを確認。途中で見つかったスマホの本文と挿絵の重なり、4Kの過剰な人物トリミング、図の全体表示で下端ラベルが切れる問題を修正し、同条件で再確認した。全体表示の画像境界とスクロール不要を回帰テストに追加。モーダルのTab/Shift+Tab循環も回帰テストを残した。

未確認: iOS Safari/Android実機、他ブラウザー、スクリーンリーダー実機、実プリンター、公開配信先での挙動。新しい保存・書き出し機能や配布ZIPは作成していない。公開・push・デプロイは未実施。

## concept-2 — 作品から深層へ入るLPへの改訂・検証

2026-09-07の追加指示「最初に惑星の放課後の説明、その後に神話製作機械の深淵」「前半は明るく爽やか、後半は深淵なLP」に対応。

- 改訂ファイル: `concept/index.html`、`concept/concept.css`、`concept/concept.js`、`scripts/check-concept-page.mjs`、`scripts/check-concept-page-browser.mjs`、本記録。
- 冒頭のh1とページタイトルを「惑星の放課後」へ変更。作品の説明、体験の3つの入口、大学卒業プロジェクトとしての位置づけを先に提示。
- 白・空色・ミントの前半から、境界のグラデーションを経て、濃紺の「神話製作機械」へ入る。深層導入は大きな文字・静かな軌道線・余白で構成。作品と基底思想の関係を読む順序も、表層から基底へ揃えた。
- 図・多視点AI群の名称・個人情報を入力/送信しない仕様は維持。画像の追加生成・元画像の加工なし。
- 回帰テストを先に追加し、旧ページが「作品を先に紹介する」条件で失敗することを再現。その後に構成を変更し、静的DOM順序と実ブラウザー上の縦位置の両方で順序を確認した。

最終版の実ブラウザー検証は2026-09-07 15:22–15:24 JST。`artifacts/concept-page-v2/report.json` は **passed / 7 scenarios / errors 0**。初稿の `artifacts/concept-page/` の証拠は保持。

- Chromeの1440 × 900、390 × 844、320 × 568（reduced motion）、768 × 1024、3840 × 2160で確認。
- 明るい入口 → 作品説明 → 境界 → 暗い深層 → 問い → 循環図の順序、画像表示、横はみ出しなし、ページ内移動を確認。
- ヘッダー・theme-colorが明 → 暗 → 明へ戻ること、6タブ、キーボード操作、図の全体/拡大/スクロール/開閉/フォーカス復帰の回帰テストが合格。
- JavaScriptなしでも全説明を表示。印刷CSS時に全説明を表示。既存 `/story` の表示と新規LPとの分離を再確認（外部通信を遮断したローカル試験）。
- `npm run check`、`npm run check:concept`、`npm run check:concept:browser`、`npm run check:contest`、`git diff --check` が合格。既存入口788,430 bytes・素材台帳283件を維持。
- 最終スクリーンショットでPC・スマホ・4Kの明るい冒頭、作品説明、境界、深層導入、ページ全体を目視。最終調整後のファイルとQAレポートのハッシュを照合。

未確認範囲は初稿と同じ。実機Safari/Android・実プリンター・公開配信は確認していない。既存ページからのリンク追加、push、デプロイは今回も行っていない。

## concept-3 — オープニングが再び始まるように見える導入の是正

2026-09-07の指摘「惑星の放課後、なんかオープニングがもう一回はじまった感じに見える」に対応。本編ランタイムが再生されたのではなく、同じキービジュアル・全画面の大タイトル・登場アニメーション・開始風のボタンが、作品解説をもう一度タイトル画面のように見せていた。

- 改訂ファイル: `concept/index.html`、`concept/concept.css`、`scripts/check-concept-page.mjs`、`scripts/check-concept-page-browser.mjs`、本記録。JSの閲覧機能と本編のオープニングは変更していない。
- 冒頭を「惑星の放課後について」というコンパクトな作品概要へ置換。「公開データを可視化・音・物語で体験する作品」という具体的な説明を最初の画面から提示。
- オープニング絵の参照、画面いっぱいのステージ、ヒーロー用アニメーション、「この作品について」ボタン、スクロール開始の煽りを撤去。画像ファイル自体は削除していない。
- 卒業プロジェクト・第一弾・近日登場は横のプロジェクト情報へ。次の見出しを「この作品でできること」とし、重複した作品紹介を統合。
- 白・ミントの爽やかな作品解説から、濃紺の神話製作機械へ降りる流れ、採用済みの親しみやすい挿絵と循環図を維持。新規画像生成・画像加工・素材追加はなし。
- 変更前のChromeで新しい回帰条件が失敗することを確認し、`artifacts/concept-page-v3-before/failure.png` と `report.json` に保存。画像も目視で確認。既存のconcept-1/2の証拠は保持。
- 回帰条件は、概要である見出し、最初の画面で具体的な説明が見えること、全画面の最小高さなし、登場アニメーションなし、オープニング画像・JS・音声スクリプトの読込なし。従来の明暗切替・タブ・拡大図・既存storyとの分離も継続確認する。

最終版のローカルChrome検証は **passed / 7 scenarios / errors 0**。対象のSHA-256・実施時刻・各画面での概要の高さと説明位置は `artifacts/concept-page-v3/report.json` に保存し、最終ファイルと照合済み。

- 1440 × 900、390 × 844、320 × 568（reduced motion）、768 × 1024、3840 × 2160で上記の回帰条件が合格。画面上の見た目を変更前後のスクリーンショットで確認。スマホのメタ情報に不自然な改行が出た箇所も調整して再試験した。
- 作品説明 → 境界 → 深層の読順、明/暗/明のヘッダーとtheme-color、アンカー位置、横はみ出しなし、画像デコード、6タブ・キー操作、図の全体/拡大/スクロール・開閉・フォーカス循環/復帰が合格。
- JavaScript無効での全説明、印刷CSSでの全説明、ローカルGETのみ・保存/API通信なし、既存 `/story` の表示とLP資産を読み込まないことが合格。本編の外部通信は遮断したローカル試験。
- `npm run check`、`npm run check:concept`、`npm run check:contest`（素材台帳チェックを含む）、`git diff --check` が合格。既存入口788,430 bytes・台帳283件を維持。
- JSと採用済みの2枚のWebPはconcept-2の証拠ハッシュとも照合し、変更なしを確認。

未確認: iOS Safari/Android実機、他ブラウザー、スクリーンリーダー実機、実プリンター、公開配信先。保存・書き出し機能と配布ZIPは今回も対象なし。既存ページへのリンク追加・push・デプロイは未実施。

## concept-4 — 絵付きの作品パンフレットへ

2026-09-07の指示「殺風景なんでもっとパンフレットっぽくして」に対応。

- 前半を作品概要と海辺の挿絵を並べた見開き風に構成。紙面の細かな模様、クリーム色の台紙、キャプション、見出し帯、欄外のページ番号を追加。
- 「眺める・感じる・出会う」の3つの紹介に、それぞれデータ展示室・音を聴く人物・物語の登場人物の図版を追加。ミント・ベージュ・ラベンダーの帯で区別し、短い説明とキーワードを添えた。
- 第一弾・位置づけ・テーマ・近日登場を横帯へ整理。制作意図を淡い黄緑のコラムにした。
- スマホは説明→図版の順。概要を最初の画面から読めること、オープニングの全面絵・開始操作・登場アニメーションを戻さないことを維持。
- 後半の神話製作機械・多視点AI群・既存の親しみやすい構想図・閲覧JSは変更なし。明るい作品紹介から深淵へ移る境界も維持。
- 改訂: `concept/index.html` / `concept/concept.css` / ページ静的・ブラウザーテスト / 本記録。追加: `scripts/build-concept-brochure-assets.mjs` / `assets/concept/brochure-*.webp` 3点。素材台帳生成スクリプトと生成MD/JSONに3点の再利用素材を登録。画像の元ファイルは保持し、本編の参照は変更なし。

最終実ブラウザー検証: `artifacts/concept-page-v4/report.json`、2026-09-07 16:10 JST開始、**passed / 7 scenarios / errors 0**。HTML・CSS・JS・使用する6枚の画像のSHA-256を記録し、現在ファイルとの一致を確認。旧版の証拠は保持。

- Chrome 1440 × 900、390 × 844、320 × 568（reduced motion）、768 × 1024、3840 × 2160。冒頭の説明の初期表示、PCの図版と本文の左右分離、スマホの順序と非重複、3点の体験図版とキャプション、画像デコードと宣言寸法、横はみ出しなしが合格。
- PC・スマホ・タブレットで、冒頭、絵付きパネル、制作意図、明暗の境界をスクリーンショットで目視確認。
- 従来の明/暗/明切り替え、アンカー、6タブ、矢印/Home/End、拡大図の全体/拡大/スクロール・開閉・フォーカス制御、JavaScriptなし、印刷CSSの全説明、保存/外部API通信なし、既存storyとの分離が合格。
- `npm run check`、`npm run check:concept`、`npm run check:contest`（権利台帳チェック含む）、`git diff --check` が合格。既存入口788,430 bytesは不変。素材台帳は286件。

未確認範囲はconcept-3と同じ。スマホサイズはChromeのエミュレーションであり実機試験ではない。実プリンター・公開配信・外部ライブAPIは未確認。今回はWebページのパンフレット風デザインであり、PDFや配布ZIPは作成していない。公開ページからのリンク追加、push、デプロイは未実施。

## concept-5 — 実際のモード画面と、授業を踏まえた三段構成

2026-09-07の指示「そんなシーンはない」「01・02は地図モードなど、ゲームは03だけ」「授業を踏まえた卒業プロジェクトのコンセプトモデルと明記」「作品→授業の背景→神話製作機械」「参照授業はスタッフロールを確認」に対応。

- concept-4の冒頭背景を本編シーンとして紹介した誤りを是正。冒頭は地図06「積み重なるCO₂」、01は地図13「電気のつくり方」、02は地図07「海は、どこへ運ぶ」の実装スクリーンショットに置換。ゲームイラストは03だけ。旧素材の元ファイルは保持し、LPからの参照を外した。
- ゲーム本編のCGは現行の `novel-background-cues.js` で使用を確認したものに限定。画像の種類・ローカル実装の撮影・収録データの使用をキャプションに明記。
- 作品紹介の後に `#learning` を新設。ZEN大学の授業を踏まえて制作した「卒業プロジェクトのコンセプトモデル」と冒頭・学びの本文で説明し、最後に神話製作機械へ進む。
- 現行の `novel-mode.js`、スタッフロールの `ACADEMIC INSPIRATION` ブロックを確認。掲載順を含めて「共創地球論」「人新世の人類学」「リテラシーと応用のための物語理論」「統計学入門」に一致させた。授業のシラバスを調査したとは表現していない。
- 紙面風の意匠、明るい前半から深淵への転換、閲覧用JS、神話製作機械の2枚の図版、個人情報を入力/送信しない仕様は維持。
- 新規 `scripts/capture-concept-mode-screens.mjs` でローカルChromeを操作し、3モードの表示・キャンバス・表示名・番号を確認して撮影。`artifacts/concept-page-v5/source/capture-report.json` は **passed / 3 captures / errors 0**、2026-09-07 16:23 JST開始。選定途中の未採用「雲と光の分け前」画像は公開assetsではなく同sourceフォルダーに保持。

最終ブラウザー試験: `artifacts/concept-page-v5/report.json`、2026-09-07 16:25 JST開始、**passed / 7 scenarios / errors 0**。対象HTML・CSS・JSと使用画像6点のSHA-256を現行ファイルと照合済み。

- 1440 × 900、390 × 844、320 × 568（reduced motion）、768 × 1024、3840 × 2160。冒頭・01・02の実画面参照、03のみゲーム絵、4科目の正式名、卒業プロジェクトの表記、作品→学び→深層のDOM順・実際の縦位置、追加ナビの移動と明るいヘッダー維持が合格。
- 全画像の表示と寸法、図版と本文の非重複、横はみ出しなし、明/暗/明の転換、6解説タブとキーボード、図の全体/拡大/スクロール/開閉/フォーカスが合格。
- JavaScript無効・印刷CSSでの全説明、保存/API送信なし、既存storyのローカル表示とLPの資産を読み込まないことが合格。静的回帰テストはスタッフロールの実装から4科目を抽出してLPと照合し、誤った背景参照の再混入も禁止する。
- PC・スマホの冒頭、実画面を使った紹介、学びの見出しと4科目を目視確認。スクリーンショットの元になった地図3画面も実出力を目視した。
- `npm run check`、`npm run check:concept`、`npm run check:contest`、`git diff --check` が合格。素材台帳は289件、既存入口の予算788,430 bytesは不変。

未確認: iOS/Android実機、他ブラウザー、スクリーンリーダー実機、実プリンター、公開配信、外部ライブAPI。本編のスタッフロールや既存ページへのリンク追加は変更していない。保存・書き出し機能や配布ZIPは今回も対象なし。push・デプロイ未実施。

## concept-6 — かすれて読みにくい本文の是正

2026-09-07の添付画像付き指摘「文字かすれてて読みにくい」に対応。

- 変更前のローカルChromeで同じ3カードを表示し、スクリーンショットと実際の描画フォントを調査。補足はYu Gothic Regular / 11px / `#7a8a81`、背景 `#fffefa` に対する色コントラストは3.60:1だった。表示が落ち着いた状態で祖先を含むopacityは1なので、フェードの途中ではなく書体・小ささ・淡い配色の組み合わせを是正した。
- 本文のシステムフォントをMeiryo優先へ変更。外部フォント通信は追加せず、見出しの明朝体は保持。本文とカードの補足を画面幅によらず14〜15px、画像説明などの小文字を11px以上に設定。概要の要約と学びのリードは太字にした。
- カード本文・補足、大学の学び、作品情報、図版キャプションの色を濃くし、ミント・クリーム・ラベンダーの紙面は維持。深層の説明本文にも同じサイズ下限を適用した。
- 変更: `concept/index.html`（キャッシュキーconcept-6）、`concept/concept.css`、`scripts/check-concept-page-browser.mjs`、本記録。本文の内容、閲覧JS、画像、スタッフロール、本編の画面は変更なし。
- 回帰テストを先に追加し、旧版が実ブラウザーで失敗することを確認。変更前の画面と数値は `artifacts/concept-page-v6-before/` に保存。変更後も同じカードを同じ幅で撮影し、目視で比較した。

最終ブラウザー試験: `artifacts/concept-page-v6/report.json`、2026-09-07 16:36 JST開始、**passed / 7 scenarios / errors 0**。対象HTML・CSS・JSと画像6点のハッシュを現行ファイルと照合済み。

- 1440 × 900、390 × 844、320 × 568（reduced motion）、768 × 1024、3840 × 2160。本文サイズ、文字色と不透明な背景色の比率、祖先を含むopacity、実際に日本語を描画したフォントを記録。全5サイズでMeiryoの実使用、検査対象の本文14px以上、小文字11px以上、色コントラスト4.68:1以上を確認。
- 指摘されたカード補足は11→14px、コントラスト3.60→7.32:1。色の数値検査だけでなく、変更前後のカード、PC/スマホの冒頭と学び、タブレットの3カード、暗い説明欄の実出力を目視した。数値はCSSの文字色と背景色からの計算で、全ページのアクセシビリティ認証や実ディスプレイの測色を意味しない。
- 文字の変更後も冒頭の具体的な説明が最初の画面内にあり、画像/説明の非重複、横はみ出しなし、作品→大学の学び→神話製作機械、地図画像と03のみゲーム絵、4科目の名称を維持。
- 明暗切り替え、アンカー、6タブ/キー操作、図の全体/拡大/スクロール/開閉/フォーカス、JavaScriptなし、印刷CSSの全説明、保存/APIなし、既存storyとの分離が合格。
- `npm run check`、`npm run check:concept`、`npm run check:contest`（権利台帳チェック含む）、`git diff --check` が合格。素材289件、既存入口788,430 bytesは不変。

未確認: iOS/Android実機、他OSでの代替書体、他ブラウザー、スクリーンリーダー実機、実プリンター、公開配信先。スマホ画面サイズはChromeのエミュレーションで検証。保存・書き出し機能や配布ZIPは対象なし。公開へのリンク追加・push・デプロイは未実施。

## concept-7 — ImageGenによる図版中心のパンフレットへ

2026-09-07の指示「デザイン、生成AI臭いので、もっとふんだんにimage genで装飾して」に対応。

- 内蔵ImageGenを使い、地球の欄外カット、地図と海流の横長コラージュ、大学の学びを象徴するノート、記憶と解釈の深層を表す扉絵の4点を新規生成。青い版画・紙の切れ端・鉛筆線の共通した画材感で統一。入力参照画像なし、CLI/APIキー方式は使用していない。
- 4点の採用ファイル、原本コピー、生成時の保存先、最終プロンプト全文、寸法、ハッシュは [CONCEPT_IMAGEGEN_DECOR_2026-09-07.md](CONCEPT_IMAGEGEN_DECOR_2026-09-07.md) に記録。
- 素材は `assets/concept/brochure-ornament-{earth,ribbon,learning,archive}-v1.webp`。PNG原本を保持した縮小・WebP変換のみで、地球とコラージュの生成アルファを保存。4点の合計889,222 bytes。下部の大きな挿絵は遅延読み込み。
- 冒頭の作品概要に地球カットを添え、章間に横長のコラージュを追加。3つの体験は三列カードをやめて実画面と説明の左右交互の見開きへ。スマホでは各図版→説明の順に積む。
- 大学の4科目はカードではなく罫線付きの科目一覧にし、その横にノートの図版を配置。深層の導入には記憶庫の扉絵を追加。CSS製のテープ、ドット模様、一部の飾り星、抽象的な大円を外し、実際の挿絵を中心にした。
- 前回の本文の書体・大きさ・濃さは保持。本文に画像を重ねず、重要な説明を画像内に描かない。新しい装飾画像は空のaltとaria-hidden、pointer-events:noneにして、読み上げ・操作を妨げない。
- 実モード画面と生成装飾を明確に分離。地図の冒頭・01・02、03だけゲーム本編の絵、スタッフロールの4科目、作品→学び→神話製作機械の構成、従来の親しみやすい構想図は維持。生成したノートを実際の授業資料や本編のシーンとして紹介しない。
- 改訂: `concept/index.html` / `concept/concept.css` / 静的・ブラウザーテスト / 素材台帳生成スクリプトと生成台帳 / 本記録。追加: 装飾WebP4点、`scripts/build-concept-editorial-assets.mjs`、生成プロンプト記録。閲覧JSと以前から使用する6点の画像はconcept-6のハッシュと比較して変更なし。

最終ローカルChrome試験: `artifacts/concept-page-v7/report.json`、2026-09-07 16:49 JST開始、**passed / 7 scenarios / errors 0**。HTML・CSS・JSと採用画像10点、計13ファイルのSHA-256を現行ファイルと照合済み。

- 変更前のページで、新しい装飾4点の回帰条件が失敗することを確認し `artifacts/concept-page-v7-before/` に記録。
- 1440 × 900、390 × 844、320 × 568（reduced motion）、768 × 1024、3840 × 2160。4点の存在・別ファイル・装飾としての扱い・全画像のデコードと宣言寸法、画像と説明の分離、左右交互/スマホ縦積み、横はみ出しなしが合格。
- 概要は全5サイズで最初の画面に具体的な説明を表示。オープニングの画像・登場演出・全画面ステージは復活していない。作品→授業→深層の読順、4科目、実画面とゲーム03の区別が合格。
- 全5サイズで本文下限14px、検査対象の文字色/背景色コントラスト下限5.08:1、Windowsで実際に描画したMeiryoを確認。色比率はCSSの数値であり、全ページのアクセシビリティ認証を意味しない。
- 明暗のヘッダー、アンカー、6タブとキー操作、図の全体/拡大/スクロール/開閉/フォーカス、JavaScriptなし、印刷CSSでの全説明、保存/API送信なし、既存storyとの分離が合格。
- 生成原本4点、PC/スマホの概要、章間の透明コラージュ、科目とノート、深層の扉絵、PCとスマホの見開きの実出力を目視。長い要素全体の撮影では固定ヘッダーが途中に写り込むため、追加で各見開きを普通のビューポートで撮影した `1440-experience-*-viewport.png` / `390-experience-*-viewport.png` でも、ヘッダーを消さずに表示を確認した。
- `npm run check`、`npm run check:concept`、`npm run check:contest`（素材台帳チェック含む）が合格。素材台帳293件、既存本編入口788,430 bytesは不変。

未確認: iOS/Android実機、他OSの代替書体、他ブラウザー、スクリーンリーダー実機、実プリンター、公開配信先、外部ライブAPI。スマホ画面サイズはChromeエミュレーションで検証。保存・書き出し機能や配布ZIPは今回も対象なし。既存ページのリンク追加・push・デプロイは未実施。
