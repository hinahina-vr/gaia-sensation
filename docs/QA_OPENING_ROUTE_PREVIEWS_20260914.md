# 入口のスクリーンショット付き説明

- 対象: 4b43fed 上のローカル変更（2026-09-14）。既存のREADME・別テスト・未追跡制作物は変更対象外。
- 「物語をはじめる」「データを探索する」の吹き出しに画像を追加。PCはホバー・フォーカス、タッチ端末は既存の入口ガイドで表示。
- 物語: ユーザー指定の `codex-clipboard-7ece7a93-ac8f-493f-b65b-e0651254f5d1.png` をSharpで960×540 JPEGに縮小（110,658 bytes）。画像全体を保持し、生成・描き直し・トリミングはしていない。配置先 `assets/guide-previews/story.jpg`。
- データ: 添付2枚目と同じ既存 `assets/guide-previews/map.jpg` を再利用。
- PCの吹き出し幅480px、モバイル最大360px。画像はcontain表示、高さを画面の27%以内に抑える。既存の上下自動配置を維持。

## 実ブラウザ検証

`GAIA_VIEWPORT=pc1440,mobile390,mobile-landscape node scripts/check-opening-route-hover-browser.mjs http://127.0.0.1:4492 artifacts/opening-route-previews-final-20260914`

- Chrome headless: 1440×900、390×844、844×390。
- ホバー・キーボード・タッチガイド、閉じる・再表示、物語開始・探索への遷移、画面内への収まりを確認。
- 回帰テストに画像の読込完了・対応するファイル・表示寸法の確認を追加。
- 初回検証の各画面は `artifacts/opening-route-previews-20260914`、画像チェック追加後の証跡は `artifacts/opening-route-previews-final-20260914`。
- PCとスマホ縦横の画像を目視確認。構文検査・変更対象のdiffチェック合格。
- 公開・コミット・プッシュは未実施。公開配信での反映や全サイズの網羅確認ではない。
