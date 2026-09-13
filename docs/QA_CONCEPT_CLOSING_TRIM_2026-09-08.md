# 末尾の説明文・フッター注記の削除

2026-09-08、ローカル候補 `concept-14-closing-trim`。

画像で指定された、作品名の右側の説明2段落、図と現行実装の違いについての補足、「このページについて」のフッター注記を削除しました。作品名・図・締めの見出し・戻るリンクは維持。フッター注記がなくなった際の余分な上マージンだけをCSSで0にし、CSSキャッシュキーを `concept-14` に変更しました。JavaScript・素材・本編は今回変更していません。既存のローカル変更を保持。push・デプロイなし。

## 検証

- `node scripts/check-concept-trim-browser.mjs --closing --before`：1440×900・390×844で指定された3要素（画像は2領域）を再現し、表示を撮影。
- `node scripts/check-concept-trim-browser.mjs --closing`：1440×900・390×844・320×568・768×1024で対象の削除を確認。変更前DOMから対象だけを削除した期待値と比較し、ほかの本文・図・見出し・リンク・フッター文言の一致に合格。フッターの余分な上マージン0、横溢れなし、残る大学リンク9件、図の拡大とEscape／フォーカス復帰、締めの1行見出し、フッターから先頭への移動を確認。`artifacts/concept-closing-trim-v14/`。
- `node scripts/check-concept-trim-browser.mjs`：前回の10箇所と今回の3要素、合計13要素の削除をPC／スマホ幅で再確認。ほかの内容の一致に合格。`artifacts/concept-trim-v14/`。
- `node scripts/check-concept-plain-copy-browser.mjs`：1440×900・595×1040・390×844・320×568で残る説明、作品名、フッターの描画・クリップなし、図への移動・拡大・閉じる・先頭へ戻る動作に合格。`artifacts/concept-plain-copy-v14/`。
- PCの末尾セクション全体と、スマホのフッターを実際のスクリーンショットで目視確認。
- `npm run check:concept`、`git diff --check`：合格。既存の改行コード警告のみ。

各現行レポートのHTML/CSS/JSハッシュと、最終ファイルの一致を確認しました。ページエラー・CSP違反なし。

末尾と関連操作に絞ったローカルChromeのエミュレーション試験です。総合7ケースのブラウザー試験は今回再実行していません。実機・本番配信・本編全編・保存／書き出し・外部API連携は対象外。配布ZIPなし。変更前HTML/CSSは `artifacts/concept-closing-trim-before/` に保存し、復元可能です。

## 最終SHA-256

- `concept/index.html`：`c58f76ad263be4cbeb39059477164c82c44b0bf7728026878aeaae68153507dd`
- `concept/concept.css`：`37579dbfc9858c479515937ad3840592aeebe6cf77ae978b9baf57955cb6e351`
- `concept/concept.js`（今回不変）：`4696cfa83134cef43cce1dcf47feb3eec05aeb00316d0927aae1bbc9c9eac78a`
