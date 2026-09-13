# MAP 01–30 editorial revision

2026-09-07。ローカル実装のみ。push・デプロイは行っていません。

## 編集方針

タイトルは展示への入口、サブタイトルは暮らし・生態系との関係、本文はデータ・根拠・解釈の限界を担います。危機を扱う展示、循環・エネルギー、自然の働きの違いを残しています。

`index.html` が30展示をまとめて読む確認ページ、`copy.json` が実装文言と照合するスナップショットです。都市別展示の本文中の東京は選択都市に置き換わります。

展示ID・番号・分類・観測値・単位・計算方法は変更していません。観測／モデル／補完／試算の区別、出典表示、欠測の扱い、気温指標の正確な名称も保持しています。画面から分からない被害・原因は断定していません。

## 変更箇所

- `app-content.js`：30展示の選択説明・サブタイトル、基本9展示のタイトル・本文・導入。
- `src/exploration/live-exhibit-catalog.js`、`estat-exhibit-catalog.js`、`firms-exhibit.js`、`planet-signals-exhibit.js`：追加21展示のタイトル・本文、都市別6展示の問い。
- `app.js`：展示内の見出し説明と切り替えサブタイトルを同期。
- `map-mobile-shell.js` / `.css`：読点を含むタイトルの欠落を解消。一覧にサブタイトルを追加し、読み方パネルでも表示。風・大気・地震・雲の説明本文を読み方パネル内で可視化。
- `planet-signals-exhibit.js`：通信待ちでも新しい展示の説明を即時反映し、前の展示の説明・取得時刻を残さない。
- `index.html`、`gaia-mode-loader.js`、`src/exploration/index.js`、`live-exhibits.js`、`estat-exhibits.js`：初期見出し・代替見出し・読上げ名とキャッシュ識別子。
- `scripts/check-map-editorial.mjs`：確認文言と全30実装、重要な注記の一致を検査。既存の展示検査・一覧プレビュー検査・タイトル同期検査も更新。

## 確認済み

- `node scripts/check-map-editorial.mjs`：30件のタイトル・サブタイトル・一覧説明・本文、出典と重要な注記。
- `node scripts/check-app-content.mjs`：9基本展示と15コンテンツ群。
- `node scripts/check-map-exhibits-10.mjs`：展示、データ分類・単位・凡例、通信失敗時の代替、デモ再生などの既存回帰検査。30展示の文言検査もここから実行。
- `check-map-preview-copy-browser.mjs`：1440px / 3840px / 390px / 320pxで各30展示。PCの一覧説明、携帯一覧の完全なタイトル・サブタイトル、選択時の見出し同期、追加21展示の本文と出典導線。携帯では全30展示の読み方パネルと横はみ出しも確認。
- `check-all-exhibit-separators-browser.mjs`：1440px / 390pxで全30展示。320px / 3840pxでは長い見出し・読点・長いサブタイトルを含む6展示を追加確認。フェード・表示範囲・連続切り替えも確認。
- `check-map-title-sync-browser.mjs`：3画面幅、75回の展示間切り替え。
- 確認ページ：PC・携帯の30件描画、横はみ出しなし。画面画像でも確認。
- 変更したJavaScriptの構文検査、`git diff --check`。

ブラウザー検査は文言・表示・操作の確認です。外部データはテスト用応答または保存値を使用しており、外部APIの稼働確認や本番スモークではありません。証跡はローカルの `artifacts/map-editorial-20260907/` に保存しています。今回より前のストーリー・GX・ロゴ・データ取得説明の編集はそのまま保持しています。
