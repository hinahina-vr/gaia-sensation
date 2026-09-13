# 入口ガイド画像最新化

- 依頼: 添付の登場人物を含む「この辺のスクショ最新化」。
- assets/guide-previews の map/sensor/character/sound.jpg を現在のローカルUIからChromeで再撮影（1440×810）。画像合成・生成なし。
- 地図は展示15と最新の◀▶移動ナビ、人物は4人の選択UI、音楽は星座の曲選択を含む。センサーは現在の公開API応答とローカルUIを使い、画面にはDEMO LIVEのデモ観測点が表示されている。実センサー測定の証明ではない。
- 撮影スクリプトの待機条件を更新。初回撮影で地図とセンサーの案内が写ったため、案内を閉じた本画面で再撮影し目視確認。
- app.js の画像キャッシュ識別子、読み込みチェーンを更新。「三人」を「4人」に修正し英語・中国語も更新。地図の代替テキストを撮影内容に合わせた。
- scripts/refresh-guide-previews-browser.mjs 最終合格、4画像を目視確認。artifacts/guide-preview-refresh/report.json に時刻・サイズ・SHA256を記録。
- 実際のタイトル→その他の入口→入口ガイドを開き、Enterで4枚を順番に表示。すべて新URLとnaturalWidth=1440を確認し、title-*.png、title-report.json を記録。人物のガイド表示を目視確認。
- 構文検査、mode-loader-prefetch合格。ローカル previews-20260913版のみ、公開・プッシュ・本番検証なし。
