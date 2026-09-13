# 公開候補の検証と未完了事項（2026-09-08）

## 対象

製作者の「コミット・プッシュ・デプロイ」の指示に基づき、`63ec6ffdb495256fde6ad1e58c7c963954c741c3` を基点とする、この文書と同じコミットの変更をまとめる。対象は直前までに依頼・検証した画面、ナビゲーション、センサー導入、キャラクター、権利判断の記録と回帰試験。再資源化率の対応国を広げる案は調査のみで、実装には含めない。

公開先は既存の Cloudflare Pages `gaia-senseware`。公開用Workerを固定版Wrangler 4.121.0で再生成し、更新済みHTMLのインラインスクリプトに対応するCSPを反映した。Workerの差分はこのCSPハッシュの更新のみ。DBスキーマ、本番設定、シークレットは変更していない。

## 今回実行した検証

- `npm run check`：precheck・postcheckを含めて合格。構文、物語、統計、データ、CSP、出典メタデータ、権利台帳の形式・回帰試験、既知形式の秘密情報検査を含む。公開権利の承認完了を意味する検査ではない。
- `npm --prefix sensor-platform run typecheck`：合格。
- `npm --prefix sensor-platform run build:pages-worker`：991,209バイトの `_worker.js` を生成。
- `npm --prefix sensor-platform run check:pages-worker`：再生成結果と配布用Workerが一致し、古いビルドでないことを確認。
- `npm --prefix sensor-platform run test:pages`：22項目合格。ローカルPages/workerdへの実HTTPでAPIヘルス、静的配信、音声MP3/WAVのRange応答とCSP、公開禁止パス、ローカル試用セッション等を検査。外部ライブ提供元は無効化し、D1は試験専用のローカル保存先を使用。本番APIへの保存ではない。
- 直前のブラウザー証跡 `artifacts/feature-intro-final/manifest.json` に記録した16ファイルと7レポートのSHA-256を再照合し、同一性を確認。既存の実クリック、タップ、スクロール、PC・モバイル相当の描画試験は [機能紹介の検証記録](FEATURE_INTRO_2026-09-08.md) と [UI修正の検証記録](UI_POLISH_2026-09-08.md) を参照。
- `git diff --check`：合格。

WorkerビルドとPages試験の初回は、制限された環境からWranglerの設定・ログディレクトリへアクセスできず失敗した。権限付きのローカル再実行で上記の合格を確認した。アプリの試験失敗として隠したり、本番確認済みと扱ったりしない。

## 公開チェックの停止理由

`npm run check:release-rights` は終了コード1、`release-blocked`。素材293件、GBIF 62記録・2データセット、依存193件の台帳整合性検査は合格したが、次の公開判断は未完了のまま保持している。

1. `gbif`：レコード別CC BY／CC BY-NC条件、非営利範囲、帰属表示の公開時再確認。
2. `remaining-data-and-software`：データ別の帰属・加工表示とソフトウェアライセンス本文の確認。

対象範囲のSHA-256は `a712bb90f55ccbb91ab9462c69336a8e5a2ccf9bf78877692ba96fe4f7256c16`。一般的なデプロイ指示を、個別の未確認権利について製作者がリスクを了承した証拠へ置き換えない。既存のGOSAT、UNESCO、生成素材についての製作者判断と未使用画像の除外は維持する。

この候補は作業ブランチに保存する対象であり、公開チェックの解除、mainの更新、Pagesへのデプロイ、本番スモークの完了を示すものではない。Safari・iOS実機、物理ESP32への導入、実センサーの保存、外部提供元への実接続は今回の検証対象外。配布ZIPは作成していない。
