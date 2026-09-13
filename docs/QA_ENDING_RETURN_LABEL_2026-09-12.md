# エンディングのスキップ後の表示・クレジット更新

- 対象はローカル作業ツリー（基点 bd6c1c3）、未公開。
- app.js: 解放済み導線の名称と行き先を、可視性に依存する演出タイマーより先に更新。進行保存や未クリアの解放条件は変更なし。
- index.html: タイトルの可視文字と aria-label を「物語をはじめる」に統一。
- novel-mode.js: 学術的着想に ZEN大学『ビッグデータ分析概論』を追加。先行依頼の6役割すべて「ひなひな」、アシスタント表記も検証。
- Chrome headless 1440×900 / 390×844: check-ending-data-skip-browser.mjs 合格。エンディング位置の保存データを注入後、スキップを実クリックし、星々の放課後の表示・行き先・保存済みclear/pendingを確認。PC/スマホの結果画像を目視確認。
- 同テストの古い起動方法（版番号取得・保存注入）を現行版13に更新。変更前表示バグのブラウザ再現記録は未取得。
- check-story-unlock-lifecycle-browser.mjs --only=matrix: 8条件合格。未クリア・古い版・壊れた保存は解放されない。
- 証跡: artifacts/ending-skip-label-20260912/final、artifacts/story-unlock-state-2026-09-10/lifecycle。
- 既知の残件: 全スタッフロール試験の後続APEIRONCENE遷移時間チェックは以前の実行で失敗。今回のスキップ経路試験と別に、原因確認が必要。自然再生の全行程は今回未再試験。
