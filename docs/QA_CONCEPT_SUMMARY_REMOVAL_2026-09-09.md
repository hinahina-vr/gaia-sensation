# 作品概要の一文削除：検証記録

- 対象：2026-09-09の画像指定。「地球の感覚器をつくる、私たちの放課後。」を `concept/index.html` の表示段落と同文のmeta descriptionから削除。他の文章・画像・CSS・JavaScriptは変更していない。
- ローカル作業のみ。push・デプロイは未実施。変更前HTMLは `artifacts/concept-summary-removal-2026-09-09/before/index.html` に保存しており、削除文を復元できる。
- 変更前：ローカルChromeの1440／390px幅で対象の表示を実確認し、スクリーンショットを保存。
- 変更後：`GAIA_CONCEPT_COPY_OUTPUT=artifacts/concept-summary-removal-2026-09-09/after` を指定した `node scripts/check-concept-copy-trim-browser.mjs` が6条件（1440、1280、1024、768、390、320px幅）で合格。
- 削除要素のDOM不在・本文／メタ情報からの文言消失、残す概要3段落・体験6文の一致、他セクション保持、横はみ出しなし、画像デコード、構想図の拡大・Escape・フォーカス復帰、先頭へのリンク、CSP違反・ブラウザー例外0を確認。PC／スマホ幅の実出力を目視確認。
- `npm run check:concept`、更新したテストの構文、`git diff --check` に合格。再混入防止の検査を既存の静的・ブラウザーテストへ追加。
- 証跡：`artifacts/concept-summary-removal-2026-09-09/after/report.json`。記録されたHTML/CSS/JSのSHA-256を現ファイルと照合し、全件一致。
- 最終HTML SHA-256：`cd820d31f098762d89321da651fdf2f197365753097ca9ea02b9146f21612c6f`。識別名：`concept-16-summary-removed`。
- 未確認：物理スマートフォン、別ブラウザー、本番配信。本変更に配布ZIPや保存機能の変更はない。
