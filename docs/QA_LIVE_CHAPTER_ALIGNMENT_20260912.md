# 15–20の章見出しを21に揃える

2026-09-12 ローカル作業ツリー、未公開。変更：`map-unified-dock.css`。

- ライブ専用の上余白0・グリッド中央揃え・左右5px・固定高さ44pxがずれの原因。
- 21と同じ上余白14px、番号とタイトルのbaseline揃え、ボタン余白6px 0、高さauto/min-height44pxへ変更。
- Chrome 1440/2560px：15–20すべて、カテゴリ・番号・タイトルの章内相対座標が21と1px未満の差で一致。390pxは既存のモバイル表示を確認（今回のCSS対象外）。
- `node scripts/check-live-chapter-alignment-browser.mjs` 合格。修正前後の座標・画面：`artifacts/live-chapter-alignment`。
- 保存データによるローカル表示試験。公開環境・実端末は未確認。
