# POIプレビューの数値強調・横並び / 2026-09-12

## 依頼と対応

ユーザー原文:

> こういうの数値だけバカでかくしてほしいんだけど　可変値だからここが重要であるため

追加原文:

> 縦に複数行にするんじゃなくて　右の空白に持ってこれたりしないの

座標の追加原文:

> 緯度 経度 で改行したほうが見栄え良くね

> 緯度経度って　北緯とか　東経とかのことなんだけど

「北緯12.3°」「東経130.1°」のような方角付き座標を、上段・下段の独立した行にする。北緯/南緯/東経/西経や座標数値は変更せず、数字の途中で折り返さない。地名に含まれるスラッシュなどはこの処理の対象外。

対象は画像の35「酒匂川上流 / 湖流入前（河内川）」を含む地図POIの共通ホバープレビュー。明示的な観測値だけを強調し、年度・地名・指標名・単位は拡大しない。単一値は年度・指標名を左にまとめ、数値＋単位をその右へ横並びに配置。複数指標は最大2列、長い数値は桁を省略せず幅に合わせる。欠測を0に変えない。

元データ・計算・保存形式・書き出し形式の変更なし。既存のクリック詳細とタッチ選択を維持。POIが同一でも内容が変われば表示を更新し、同一POIでは入場アニメーションを再開始しない。

変更ファイルは `app.js`、`map-ui-grid-polish.css`、`src/exploration/poi-preview-readings.js`（追加）、`marine-cod-exhibit.js`、`food-exhibits.js`、`firms-exhibit.js`、`planet-signals-exhibit.js`。後続の明示依頼「じゃ統一しといて」により `src/shared/coordinates.js` を追加し、01も方角表記に統一した。関連しない既存のローカル変更は保持。

## 実ブラウザー検証

対象: HEAD `9fbd901b68faebaf6148db6e18cdbcb50fa1c778` に重なるローカル作業ツリー、`http://127.0.0.1:4492`。インストール済みChromeをPlaywrightで操作。外部サービスを遮断したローカル検証であり、本番配信・実機スマートフォンの試験ではない。

- `node scripts/check-poi-value-emphasis-browser.mjs --before`: 修正前の同地点を実際にホバーして再現。値は本文と同じ11px、地名は18px。
- `node scripts/check-poi-value-emphasis-browser.mjs`: 最終版合格。1440・3840・901px幅で、元の観測地点ID `1401758`、2024年度の `10 mg/L` が64px、地名18px、年度・指標11px。数値がラベルの右、上下中央が一致、横のはみ出し0、カード高さ97.1875px（途中の縦積み版は141px）。クリック後も元の `10 mg/L`。390pxタッチエミュレーションではホバーを残さず、タップ選択で同値を表示。
- `node scripts/check-poi-value-variants-browser.mjs`: 01の方角表記統一まで反映して50項目合格（改行追加時点では46項目）。01の実FIRMS保存観測点で4象限の表示と符号付き元座標・観測値の不変を確認。70のアルゼンチン2023年 `205.3%`、71のアルゼンチン2021–2023年 `-128.2%` は同梱元データを使った品目・期間・国選択→ホバー→クリックの実操作。
- 上記variants内の風速・風向・気圧・雲量4値とPM2.5・光学的厚さ2値は、**合成キャッシュを使った統合試験**。その他901・1440・3840pxの負数・0・`<0.0001`・長桁・欠測・欠測混在・HTML風ラベルは**合成レイアウト試験**。0は64px、PM2.5の2.5や年度・IDは拡大しない。欠測は0に変わらず、長桁も省略・はみ出しなし、HTMLを解釈しない。
- 北緯/南緯×東経/西経の4組、符号付き緯度/経度、震源付き座標、通常の地名を901・1440・3840pxで確認（上記46項目に含む）。座標は必ず2行、各数値の途中の改行・はみ出しなし。通常の地名は元の表記を保持。合成キャッシュを使う実ホバーでも北緯→東経の2行を検証・目視確認。
- `node scripts/check-map-hover-inline-browser.mjs http://127.0.0.1:4492 --widths=901,390`: 横並び版（座標改行追加前）で合格。人口の長いカンマ付き値、背景80%、既存の選択ラベル、ホバー→詳細→閉じる、タッチ経路を回帰確認。1440pxも横並び変更前の数値強調版で合格しているが、最終版1440pxの証跡は上記35/food/fixture試験と区別する。
- 変更した6 JavaScriptファイルの `node --check` および `git -c core.safecrlf=false diff --check`: 合格。

証跡: `artifacts/poi-value-emphasis-20260912/{before,after,variants}/report.json` とPNG、`artifacts/hover-inline-80/after/report.json`。最終表示の `after/1440-35-card.png` と長桁レイアウトを目視確認。beforeは実際の修正前、afterは追加依頼反映後。

## 検証対象ファイルSHA-256

| ファイル | SHA-256 |
| --- | --- |
| app.js | 6f3b621e4ecaf5d066113e70ab23b9fc53e800ab423159ed7e5c74be25bcfc8d |
| map-ui-grid-polish.css | d02455e283e77d5f53f12d198bdbaba707ecc6328f9bd417292f89732b8bd241 |
| src/exploration/poi-preview-readings.js | 3db0ecf9e3e120d7758626fb6db7516298de9cddf4000505e8ca44b66a0f9079 |
| src/shared/coordinates.js | cba79fc864260548ed7de9d4ac92b579d0ed74e77bc4d185e4183799fe66c168 |
| src/exploration/marine-cod-exhibit.js | c0e4242595c81097afa0c8ad3461595f35e597a4cb3aa168b9a830b3f5811c0a |
| src/exploration/food-exhibits.js | 0c22eeb903301e6b3fcf4f758c9dcd15092f11f1a0e832bb207f40fda5692213 |
| src/exploration/firms-exhibit.js | 42a7ce8607d39055744e256e9a55715a61fbaa316df1931eeb29c0f55178585c |
| src/exploration/planet-signals-exhibit.js | 2f877399aff323ef1805b6faa8fb6a23c3552391d9529698935c011654b3a3e1 |

## 状態・未確認範囲

ローカル実装・上記確認まで完了。今回のコミット・push・デプロイは未実施。新しい配布ZIPなし。本番の外部データ取得、全履歴・全保存/書き出し経路の再走査、物理スマホは今回未確認。後続の全71展示名の幅チェックは `QA_MAP_CHAPTER_WIDTH_AND_COORDINATES_2026-09-12.md` に区別して記録。データ/計算/保存形式は変えておらず、既存の履歴・保存検証を今回の実施結果として数え直していない。
