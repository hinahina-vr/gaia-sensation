# コンセプトのロゴからトップページへ戻る

2026-09-08。ユーザーが指定した左上の「GAIA SENSEWARE / THE CONCEPT BOOK」のリンクを、`#top` から `../` に変更。読み上げラベルも「サイトのトップページへ」に変更しました。`concept/index.html` の差分がこの2属性だけであることを変更直前のローカルHTMLと比較して確認。CSS・JavaScript・本文は今回変更していません。既存の未コミット変更を保持。push・デプロイなし。

## 回帰テスト

`node scripts/check-concept-home-link-browser.mjs --before`：1440×900・390×844で、`/concept/#learning` のロゴを押すと `/concept/#top` に留まる従来動作を再現。

`node scripts/check-concept-home-link-browser.mjs`：同じ画面サイズで以下に合格。

- PCではキーボードのEnter、スマホ幅ではタップにより、ロゴからサイトルート `/` へ遷移。
- コンセプトページに直接入った初回は、トップページの通常の音声設定画面を表示。
- 実際にトップ→「このサイトについて」→コンセプト→ロゴと往復した場合は、既存の復帰処理によりタイトルメニューへ戻る。音声設定やオープニングを再表示しない。
- 上部の「学び」リンク、ページ内の「作品概要に戻る」は従来どおりコンセプトページ内の移動を維持。
- ロゴのポインターヒット、画面内表示、横溢れなし、ページエラー・CSP違反なし。
- PCとスマホの実際の遷移先スクリーンショットを目視確認。

`npm run check:concept`、`node --check scripts/check-concept-home-link-browser.mjs`、`git diff --check`にも合格。静的チェックにロゴのリンク先・読み上げラベルの回帰条件を追加。

ローカルChromeのPC／モバイル画面エミュレーションです。外部APIを隔離しており、実機・実配信ではありません。リンク変更のため、本編全編・保存・書き出し・外部サービス連携の再検証は対象外。配布ZIPなし。

証跡：`artifacts/concept-home-link-before/`、`artifacts/concept-home-link-after/`。

最終 `concept/index.html` SHA-256：`5563dd1bbdd771297f4d85a8d09969f3cf8fa633f91fb7ec8c0daa71a91a1831`。
