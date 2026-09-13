# 学内チャットの接続図差し替え

- ローカル作業ツリー（基点 bd6c1c3）。みずの添付画像を採用済みの gaia-field-sensor-whiteboard-20260912.png に変更。旧画像は削除せず保持。
- novel-mode.js の添付アセット参照とキャッシュキーのみ変更。投稿本文・添付表示名・進行順は維持。
- Chrome headless 1440×900 / 390×844 で check-campus-chat-channels-browser.mjs 合格。画像参照・デコード、チャンネル切り替えと復帰、横溢れなしを検証。双方のスクリーンショットを目視確認。
- 証跡: artifacts/chat-memo-20260912。node --check novel-mode.js と git diff --check 合格。
- 未コミット・未公開。
