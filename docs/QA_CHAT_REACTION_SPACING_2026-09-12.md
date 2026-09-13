# チャットのリアクション段階表示

- ローカル作業ツリー、基点 bd6c1c3。対象 welcome_chat_011。
- 原因: 末尾のリアクション行が半角空白 1 個で区切られると従来の分割条件（2 個以上）に一致せず、通常本文として一括表示されていた。
- 修正: 次の絵文字直前の空白で分割。既存の 1200 ms 待機 + 320 ms ごとの段階表示を適用。本文・最終件数は変更なし。
- 修正前: 同じ対象で staging に到達せず既存ブラウザ試験が失敗。証跡 artifacts/chat-reactions-20260912/before。
- 修正後: インストール済み Chrome headless、1440×900 / 390×844 で合格。最初の反応は投稿から約 1201 / 1204 ms、8 状態を記録し、最終 🎉3・🌍2・🫶2 を確認。
- 既読復元・注入済み保存スロットの LOAD・早送り・章スキップ時のタイマー中断も合格。新規 SAVE 操作の試験ではない。
- 初期・途中・完了スクリーンショットを保存、PC 途中とスマホ完了を目視確認。
- 実行: scripts/check-chat-reaction-sequence-browser.mjs。証跡 artifacts/chat-reactions-20260912/final/report.json と PNG。
- node --check novel-mode.js、git diff --check 合格。未コミット・未公開。
