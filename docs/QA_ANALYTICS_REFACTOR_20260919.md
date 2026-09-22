# Analytics・入口カードのリファクタリング

## 依頼と対象

- 原文: 「リファクタリングして コミット・プッシュ」。直近のAnalytics同意処理と入口カード文字調整を対象に、見た目・計測仕様を変えずに整理する方針を作業開始時に提示。
- 基準コミット: `3249b24`。検証対象はその後続の2026-09-19作業ツリー。
- Analyticsの定数、保存状態、開始・停止、同意UI、地域解決、画面遷移・操作イベントを名前付き関数に分離。未使用の日本語分岐を削除し、UI要素の重複検索も削減。
- カードの文字サイズ計算をCSS変数にまとめ、後段で上書きされていた古いサイズ指定を削除。最終的な文字サイズ・nowrap・列数・アイコン配置は維持。
- テストのプレビューURLと証跡先を環境変数で指定可能にした。未同意の地域判定待ち、別タブからの選択変更、GA Cookieのみの削除を回帰テストに追加。
- 元からあるREADME・他の検証スクリプト・制作素材の未コミット変更は対象外として保持。

## 検証結果

- 最初はローカルプレビューが停止しており接続エラー。`node scripts/serve-novel-preview.mjs 4492`で起動後、変更前のAnalytics15ケースとカード5画面幅が合格。
- 変更後: `node scripts/check-gaia-analytics.mjs`の16ケース合格。別タブの同意・撤回・対象Cookie削除も合格。
  - 日本ではUI非表示、海外・不明・通信失敗・タイムアウトでは同意までタグなし。
  - 同意・拒否の保存と再読込、期限、GPC/DNT、Escapeで拒否、URL秘匿・重複抑止を確認。
  - 地域の応答が来る前はGoogleタグも同意UIもなし。
  - 別タブでの許可・拒否が反映され、拒否後は遷移イベントなし。`_ga`関連Cookieを削除し、無関係なCookieは残る。
- `node scripts/check-intro-card-text.mjs`: 360 / 390 / 412 / 768 / 1440px、全カードの1行表示・枠内収まりが合格。変更前後の計算済みフォントサイズも一致。390pxの実画面を目視確認。
- 同意画面の390px / 1440pxスクリーンショットをraw画像で比較し、両方とも差分0。Googleタグと地域応答を差し替えたChrome試験であり、実際の海外回線・Google SDK・GA4受信の試験ではない。
- `node scripts/check-mode-loader-prefetch.mjs`: 遅延読込、CSS/スクリプト順序、重複抑止など合格。
- `node scripts/build-browser-security.mjs --check`: 合格、6インラインスクリプトハッシュ。
- `node --check gaia-analytics.js`、`node --check gaia-mode-loader.js`、`git diff --check`: 合格。

## 証跡と残件

- `artifacts/refactor-20260919/before/`: 変更前の画面。
- `artifacts/refactor-20260919/after/analytics/`、`after/cards/`: 最終テストの画面。
- 実Android端末・GA4管理画面の拡張計測設定・Google側受信・本番反映は未確認。既存の計測範囲（章別進捗等は未対応）は拡張しない。
- 今回の公開権限は開発ブランチへのコミット・プッシュまで。デプロイ操作は行わない。
