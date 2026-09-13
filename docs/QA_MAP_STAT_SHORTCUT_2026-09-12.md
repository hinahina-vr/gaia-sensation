# MAP の旧 STAT ショートカット削除 — 2026-09-12

## 依頼と変更

- ユーザー原文: 「これいらん」。添付は灰色の「STAT 統計解析」ボタン。
- 対応解釈: 画像の旧ショートカットだけを削除する。統計分析機能そのものや下部ドック／モバイル操作シートの「統計分析」は残す。
- `index.html` の `#gaia-statistics-button-mobile` を DOM から削除。統計機能・保存データ・読込形式には変更なし。
- `scripts/check-map-stat-shortcut-browser.mjs` に再現／回帰試験を追加。`package.json` に `check:map-stat-shortcut:browser` を登録。
- 既存の未コミット作業を保持。コミット・push・公開は未実施。

## 対象版

- 基点 HEAD: `9fbd901b68faebaf6148db6e18cdbcb50fa1c778` ＋現在のローカル変更。
- 検証済み `index.html` SHA-256: `cec21a70a7178b8b8f0311956b8812449e35ca331165a935a5cd951a2cf86841`。
- 関連する統計 JS・モードローダー・モバイルシェルの SHA-256 は `artifacts/map-stat-shortcut-20260912/after/report.json` に記録。試験開始／終了時に同一性を確認。

## 実ブラウザー検証

- Windows にインストールされた Chrome、ローカル `http://127.0.0.1:4492`、本番相当 CSP を適用。
- 修正前: 幅 1440／901px の MAP に画像と同じ灰色の STAT ボタンが表示されることを再現。統計用 CSS が遅延読込される前にも DOM に旧ボタンが残っていた。390px では既存 CSS により非表示だったが DOM は存在した。
- 修正後: 1440×900、901×768、390×844 の各幅で旧ボタンの DOM が 0 件。スクリーンショットで除去後のヘッダー／モバイル画面を確認。
- 各幅で展示 06 と 21 の「データの出典」を開閉。「統計分析」は PC で Enter、モバイルでは操作シートからタップして開き、実データのグラフ（06: 120 点、21: 72 点）を描画して閉じた。合計 6 経路合格。
- 統計の遅延読込後にも旧ボタンが復活しないこと、閉じた後の展示が変わらないこと、横スクロールがないことを確認。
- ページ例外・404・CSP 違反: 0 件。
- `node --check scripts/check-map-stat-shortcut-browser.mjs`、`git diff --check` 合格（既存の改行変換警告のみ）。

## 証跡と限界

- 修正前: `artifacts/map-stat-shortcut-20260912/before/report.json` と各幅の `*-map.png`。
- 修正後: `artifacts/map-stat-shortcut-20260912/after/report.json`、`*-map.png`、`*-analysis.png`、`*-after-analysis.png`。
- 外部 HTTPS API は遮断、FIRMS はリポジトリのスナップショットを使用。実モバイル端末や本番公開の検証ではない。
- 今回は HTML の旧入口削除のみ。保存・書き出し形式、配布 ZIP、外部アプリ連携は変更しておらず、これらの再検証は実施していない。
- 依頼された削除とローカル回帰確認は完了。公開は別途明示指示が必要。
