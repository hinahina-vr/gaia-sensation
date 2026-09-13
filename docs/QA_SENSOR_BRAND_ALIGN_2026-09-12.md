# センサーヘッダー縦中央揃え

- 対象: 6635fae を基点とするローカル作業版。sensor-header.css のブランド名を高さ44pxの中央揃えに変更。
- 実行: `node scripts/check-sensor-brand-align-browser.mjs`
- ローカル Chrome (headless)、1920px / 1440px: 初回案内を閉じ、戻るボタンとブランド名の矩形中心の縦差が0pxであることを確認。スクリーンショット保存、1920pxの表示を目視確認。
- 390pxエミュレーション: 従来どおりブランド名非表示を確認。
- 証跡: `artifacts/sensor-brand-align-20260912/`
- 本番公開・実機モバイルは未確認。この変更は未公開。
