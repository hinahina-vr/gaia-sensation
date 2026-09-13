# 権利確認対象の照合 — 2026-09-13

依頼：「1はいいとして 2は直したら」。初期読込量は変更せず、確認対象の不一致を修正する。公開・新たな提供元許諾を意味しない。

## 差分

- 基準コミット：cb5e44320392d76fc81b08c3e0c7f81f0f89765a。6対象ファイルから再計算したハッシュは既存6判断行の対象と一致。
- 旧対象：867809b6d92cb31e9742b4a51c99cc0c5d050ab366105d3c5fbd464b6bde0984
- 現対象：4f80b7f23b4afeaa7aad4e0a0a628d0d7a36fa5581fe7bd913e45e7d56f16bcd
- data/gaia-signals.json、data/gbif-rights.json、docs/THIRD_PARTY_INVENTORY.json、package-lock.json、sensor-platform/package-lock.json は改行正規化後に基準と同一。
- docs/media-rights-ledger.json のみ変更。素材は338点のまま追加・削除なし。334点は全項目同一。assets/guide-previews/ 配下の character.jpg、map.jpg、sensor.jpg、sound.jpg は、コミット済み紹介スクショへの更新を古い台帳が反映していなかった。今回の差分はその4点のSHA-256のみで、制作元・条件欄は不変。ユーザーの紹介スクショ最新化依頼に対応する既存画面の紹介画像であり、新規外部素材の取得ではない。
- 出典は6件から116件へ補完。scripts/media-data-sources.mjs が既存展示カタログ・保存データ・実装から収集する索引であり、データを追加取得する処理ではない。sourceIndexNote を追加。未確認の条件を確認済みには変更しない。

## 更新の境界

各判断の対象ハッシュだけを照合後の対象に更新し、今回の保守根拠を追加した。既存の判断日・判断者・根拠・owner-accepted状態・providerPermissionVerified:false は維持。検査スクリプトや上限は緩和しない。以前の保守記録は履歴として残す。この記録は権利の全面保証や公開済みの証明ではない。

## 検証

対象は上記現ハッシュのローカル作業ツリー。アプリ全体の動作・本番公開は今回の検証対象ではない。

- npm run check:release-rights：合格。338素材・116出典・GBIF 62記録・193依存。対象ハッシュ一致、未解決行0。
- node scripts/check-release-rights-gate.mjs：合格、合成フィクスチャ21試験。対象変更時に旧判断が失効すること、証跡欠落・除外素材の復活を拒否することを確認。実提供元許諾の試験ではない。
- node scripts/check-public-docs.mjs：合格、11公開文書・169リンク。今回の内部記録はREADME導線に追加していない。
