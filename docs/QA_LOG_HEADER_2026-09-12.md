# ログヘッダーの圧縮

- ローカル作業ツリー（基点 bd6c1c3）、2026-09-12。
- 観測ログ / 全台本タブを見出しの右に配置。上下余白と PC の見出し・ツール幅を縮小。通常モードでのデバッグ UI 非表示を維持。
- インストール済み Chrome headless 1440×900 / 390×844 で `node scripts/check-log-debug-browser.mjs` 合格。
- タイトル右横・同一行を矩形で検証。ヘッダー高は PC 90px 未満 / モバイル 270px 未満。スクリーンショットで PC 約79px、スマホの右横配置を目視確認。
- ruu 切り替え、コメント保持、クリップボード、Markdown ダウンロードを既存試験で再確認。
- 証跡: artifacts/log-debug-20260912。変更ファイル: novel-mode.css、キャッシュ更新 gaia-mode-loader.js / index.html、既存ブラウザ試験。
- 未コミット・未公開。
