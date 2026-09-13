# 大学紹介文2段落・リンクの削除：検証記録

- 対象：2026-09-09の画像指定。`concept/index.html` の `.learning-copy` 全体（大学の紹介文2段落と「ZEN大学の教育理念・教育目的」リンク）を削除。
- 「ZEN大学という、学びの舞台。」の見出し、続く3項目・物語との関係・講義・作品の位置づけ・ほかのリンクは保持。CSS・JavaScript・画像は変更していない。
- ローカルのみ。push・デプロイ未実施。変更前HTMLとPC／スマホ幅の対象画像を `artifacts/concept-learning-copy-removal-2026-09-09/before/` に保存。削除内容は復元可能。
- 変更前：ローカルChromeの1440／390px幅で、2段落と1リンクの表示を再現。
- 変更後：`GAIA_CONCEPT_ZEN_OUTPUT=artifacts/concept-learning-copy-removal-2026-09-09/learning-after` を設定し、`node scripts/check-concept-zen-browser.mjs` が1440／390／320／768px幅の4条件で合格。
- 削除対象のDOM不在、文言・リンクの消失、残す見出しと後続の順序、空行を残さない配置、出典リンク8件の保持・44px操作領域、文字の非クリップ、構想図の表示・Escape・フォーカス復帰を確認。
- `GAIA_CONCEPT_COPY_OUTPUT=artifacts/concept-learning-copy-removal-2026-09-09/page-after` を設定した `node scripts/check-concept-copy-trim-browser.mjs` が6条件（1440／1280／1024／768／390／320px幅）で合格。削除対象だけを除いた学びセクションの一致、概要・体験の文章、ほかのセクション保持、画像・図の操作・先頭リンクを確認。旧HTMLとの比較は削除行に付随する改行も除いて比較する。
- 合計10条件でブラウザー例外・CSP違反0。PC／スマホ幅の「学び」冒頭スクリーンショットを目視確認。見出しから残す説明へ続き、削除跡の空行はない。
- `npm run check:concept`、更新したテストの構文、`git diff --check` に合格。静的検査・大学説明・コピー保持・ページ全体テストの該当条件を更新。ページ全体ブラウザースイートの再実行ではなく、上記の対象別10条件で検証した。
- 証跡：上記2ディレクトリの `report.json`。HTML/CSS/JSの記録SHA-256と現ファイルが全件一致。
- 最終HTML SHA-256：`e5e10169470f34f64275edcfeb513a78b2e787092b0a48de96be356a110fb3a7`。
- 未確認：物理スマートフォン、別ブラウザー、外部大学サイトの再検証、本番配信。本変更に配布ZIP・保存機能の変更はない。
