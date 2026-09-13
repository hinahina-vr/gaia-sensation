# データの出典をページ内に表示する

2026-09-07 / ローカル実装。push・デプロイは行っていません。

## 変更

- 全展示の「データの出典」をページ内の既存出典パネルへ統一。外部ページはパネル内の「元データを開く」からのみ開きます。
- 出典カードに選択中の展示のデータ名・提供元・補足を表示。気象庁のリンクは選択中の観測地点と指標に対応します。元データそのものは変更していません。
- スマホの「操作」内の出典ボタンも同じパネルへ接続。出典パネルと背景を観測パネル・操作バーより前面に表示します。
- 出典の提供元と補足を別行に配置。説明文は省略せず折り返します。
- 開くたびにスクロールを先頭へ戻し、Tab移動をパネル内に保ちます。閉じるボタン・Escapeで元の操作位置へフォーカスを戻します。

## 主な変更ファイル

- `src/exploration/map-exhibit-actions.js`: 共通のページ内出典ボタン。
- `src/exploration/{estat-exhibits,firms-exhibit,planet-signals-exhibit,live-exhibits}.js`: ボタン化と展示・観測地点に対応した出典情報。
- `app.js`: 選択中の展示の出典を既存パネルへ渡す処理、フォーカスとスクロール。
- `data-ledger.js` / `data-ledger.css`: 出典カード、補足文、スマホの重なり順。
- `index.html` / `gaia-mode-loader.js` / `src/exploration/index.js`: ダイアログ属性と更新した資産のキャッシュキー。
- `scripts/check-inline-data-sources-browser.mjs`: 全30展示のPC・スマホ回帰検証。旧テストの外部直リンク前提も更新。

## 検証

最終結果：全体チェックPASS、出典パネル120ケースPASS（エラー0）、説明文の回帰検証30ケースPASS（エラー0）。PC・スマホのスクリーンショットを目視確認済みです。

- `npm run check`: 全体の静的・データ整合性・既存ロジック検査。
- `node scripts/check-inline-data-sources-browser.mjs http://127.0.0.1:4397 artifacts/inline-data-sources-verified 390,320,1920,1440`: 4サイズ×全30展示。ページ内表示を先に開くこと、展示と出典の一致、外部リンク、表示範囲、すべての出典リンクのクリック領域、重なり、Tab/Escape、フォーカス復帰、観測地点変更後のリンクを検証。
- 外部サイトへのアクセスはブラウザテスト内でスタブ化し、遷移先URLだけを検証。公開データ・本番環境は変更していません。
- `node scripts/check-estat-copy-layout-browser.mjs http://127.0.0.1:4397 artifacts/inline-sources-copy-regression 1920,1501,390`: 前回修正した日本統計10展示の説明文・操作ボタンを再確認。
- `git diff --check`、変更したJSと追加ブラウザテストの構文検査。

既存のローカルの描画最適化・説明文見切れ修正は維持しています。
