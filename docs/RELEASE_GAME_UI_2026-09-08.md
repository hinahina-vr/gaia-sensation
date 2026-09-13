# 世界観・ゲーム風UIの公開候補（2026-09-08）

## 対象と指示

製作者の改めての「コミット・プッシュ・デプロイ」指示に対応する公開候補。基点は `3a14ec587a8fb7203b37674c12d95a77c1cf4a78`。直前までに依頼・実装・ローカル検証した世界観ページ、スマホの展示カードと操作UI、みず・あめによる初回紹介、グラフから発見へ進む明るい分析画面を対象にする。データセット拡張、DBマイグレーション、シークレット・本番設定変更は含めない。

既存の検証記録：

- [世界観ページ](CONCEPT_WORLD_BUILDING_2026-09-08.md)
- [スマホUI](MOBILE_GAME_UI_2026-09-08.md)
- [ImageGenの案内画像・初回紹介](MAP_GUIDE_IMAGEGEN_2026-09-08.md)
- [分析画面](STATISTICS_GAME_UI_2026-09-08.md)

## 素材台帳の対象範囲保守

新規画像4点を先に `130cd25` へコミットし、画像の実際の初回コミット日時で台帳を再生成した。これにより、コミット直後に未確定の日時から変わって台帳が古くなる状態を避ける。

基点コミットの6ファイルから旧scopeを再計算し、`a712bb90f55ccbb91ab9462c69336a8e5a2ccf9bf78877692ba96fe4f7256c16` と一致を確認。現在のscopeは `815177c138e583d4a92155178cb6035a6efd836755d5e5c120c80ac77f976654`。

- `data/gaia-signals.json`、`data/gbif-rights.json`、`docs/THIRD_PARTY_INVENTORY.json`、ルートとセンサー側の `package-lock.json` は、改行正規化後の全文が基点と一致。
- 台帳の既存293素材は、初回コミット日時を除く全フィールドが基点と一致。既存の日付更新は青猫v4の1件のみ。ファイル内容・出典・制作元・加工説明に変更はない。
- 追加は `assets/modes/` の `analysis-mizu-ame-companions-v1.webp` と `guide-map-{discovery,live,time}-mizu-ame-v1.webp` の4件に限定。製作者が既存キャラクターを使ってImageGenで作り、画面に採用するよう明示依頼した素材。プロンプト・参照・採用版・加工手順は上記の個別記録に保存。
- 台帳の対象ハッシュのみを更新し、既存の製作者判断と未解決2項目を維持。提供元の個別許諾を取得済みとしたり、一般的な公開指示を未確認権利の了承へ置き換えたりしない。

## 今回の検証・公開状態

- `npm run check`：precheck・postcheckを含め合格。初回は `check-map-exhibits-10.mjs` が古い分析JSのキャッシュ識別子を期待して停止した。現行の `gaia-mizu-ame-discovery-1` を検査するよう1行を修正し、全体を再実行して合格。ランタイムを旧版へ戻したり、検査を削除したりしていない。
- `npm --prefix sensor-platform run check:pages-worker`：合格。固定版Wranglerのローカル再生成比較で `_worker.js` 991,209バイトが現ソースと一致。Workerの変更は不要だった。
- `node scripts/check-statistics-game-browser.mjs http://127.0.0.1:4447 artifacts/release-game-ui/browser 1440,390`：PC 1440×900、スマホ相当390×844の2ケースが合格。グラフ初期表示・再表示、画像読み込み・表示領域、発見への導線、元データ選択、ポインター・キーボード操作、分析メニュー、AI質問画面、設定保存→実ページ再読込→適用→試験データ削除を再確認。`artifacts/release-game-ui/browser/report.json` に対象6ファイルのSHA-256を記録。
- 先行作業の7レポートを照合：`concept-page-v8-final`、`concept-worldbuilding-after`、`mobile-game-ui`、`mobile-game-ui-landscape-final`、`feature-bright`、`feature-bright-lifecycle`、`statistics-game/verified`。いずれも `passed`・記録エラー0。各ソースについて最新の対応レポートを採用し、計27ファイルのSHA-256が現物と一致することを確認。共通ローダーとHTMLは最後の分析画面試験の版に合わせて照合した。
- `npm run check:release-rights`：台帳297素材、GBIF 62記録・2データセット、依存193件の整合性は合格。scope整備後の最終結果は終了コード1、`release-blocked`。既存の `gbif`（条件文書化済み・公開時確認待ち）と `remaining-data-and-software`（帰属・加工表示・ライセンス本文確認待ち）の2項目が未完了。
- `git diff --check`：合格。

今回の追加変更は作業ブランチ `codex/gaia-copy-motion-polish-20260904` へ保存する。権利確認2項目の完了または製作者による明示的な未確認リスクの了承が必要であり、mainとCloudflare Pagesは更新しない。これは公開権利について提供元の許諾取得を保証するものではない。

ブラウザー試験はローカルChromeと保存データ・試験用API応答によるもの。物理スマホ、実AI送信、本番API保存、公開サイトの動作、配布ZIPの新規展開は今回確認していない。デプロイしていないため、本番スモークを完了したとは扱わない。
