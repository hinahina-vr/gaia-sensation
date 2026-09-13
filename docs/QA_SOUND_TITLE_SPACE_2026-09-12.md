# 音楽鑑賞の曲名スペース

- ローカル作業版: 曲一覧(index.html)と再生中表示(sound-mode.js)を `AfterSchool, AfterGlow` に統一。カンマの直後に半角スペース1文字を追加。
- Chrome headless: `node scripts/check-sound-descriptions-browser.mjs` 合格。
- 幅1440 / 390 / 320で全12曲の一覧・選択後の曲名、説明文、レイアウト、音声再生時計、一時停止・再開、再読込後の選択を確認。スマホはエミュレーション。
- 証跡: artifacts/sound-descriptions-20260912/after/report.json と各曲スクリーンショット。
- 未公開。本番反映と実機スマホ、主観的な試聴は検証対象外。
