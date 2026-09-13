# 学内チャット表示変更（ローカル）

- 対象: bd6c1c3 を基点とするローカル作業ツリー、2026-09-12。
- 学内チャット内のみ Noto Sans JP / Yu Gothic 等のゴシック体に戻した。一般の物語 UI の明朝体は維持。
- general の装飾チャンネルを削除し、センサーチャンネルの表示名を「惑星の放課後_センサー」に統一。内部 ID は変更せず。
- Chrome headless 1440×900 / 390×844 で表示、計算済みフォント、general 不在、横溢れなしを検証。両スクリーンショットを目視確認。
- PC の鍵付きチャンネル選択・センサーチャンネル復帰で本文とステップ位置が維持されることを確認。テストは保存データを注入して起動する方式で、ユーザー操作による新規保存の試験ではない。
- 実行: `node scripts/check-campus-chat-channels-browser.mjs node_modules/playwright-core "C:/Program Files/Google/Chrome/Application/chrome.exe" artifacts/chat-gothic-20260912 http://127.0.0.1:4492`
- 結果: 2 viewport passed、console/page error と 404 は 0。証跡は上記 artifacts 配下。
- `node --check novel-mode.js` と `git diff --check` 合格。
- コミット・公開は未実施。セパレータ名の入れ替えは名称の確認待ちで未変更。
