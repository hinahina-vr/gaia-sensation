# オープニングの場所・時代表記の削除

2026-09-08。ユーザーの画像で指定された「逗子 / 近未来」のみ、`index.html` の `.gaia-vn-season` 要素ごと削除しました。「序章 / 逗子海岸」やプロローグ本文、CSS、JavaScriptは今回変更していません。既存のローカル変更を保持。push・デプロイなし。

## 検証

- 変更直前のHTMLを `artifacts/opening-location-before/index.html` に保存。
- `node scripts/check-opening-location-browser.mjs --before`：1440×900・390×844で、音なし開始→実際のオープニング再生後に対象表記を再現。スクリーンショットを保存。
- `node scripts/check-opening-location-browser.mjs`：同じ2画面サイズ・開始操作で対象要素と文字列がなくなること、他の見出しと序章ラベルの維持、横溢れなしを確認。スキップ→タイトル→本編入口まで操作し、表示を確認。ページエラー・CSP違反なし。
- PCの変更前後とスマホの変更後の画面を目視し、該当表記の削除を確認。
- `node --check scripts/check-opening-location-browser.mjs` と `git diff --check` に合格。既存の改行コード警告のみ。

ローカルChromeのPC／モバイル画面エミュレーションです。外部APIを隔離した試験であり、実機・実配信ではありません。文字要素1件の削除のため、保存・書き出し、全編再生、外部サービス連携は対象外。配布ZIPは作成していません。

変更前HTML SHA-256：`565bf624248b592651bf1b2d690168cd38b8c303df34c05bbfe5b6c1c4fcfd44`

最終HTML SHA-256：`f1174eb536b2e7a2ba63c32db3ccca4114550ee56b63939f22fb97f6e7d582fd`

証跡：`artifacts/opening-location-before/`、`artifacts/opening-location-after/`。以前の表記は保存した変更前HTMLから復元できます。
