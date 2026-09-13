# GAIA SENSEWARE ドキュメント索引

このディレクトリには、応募・実装・権利・物語制作の資料が混在しています。2026-09-13時点の現行資料と、制作途中の引継ぎ記録を次のように区別します。

## 最初に読む資料

| 資料 | 役割 |
|---|---|
| [../README.md](../README.md) | 作品全体、71地図展示、各モード、起動・検査方法 |
| [CONTEST_2026_SUBMISSION.md](CONTEST_2026_SUBMISSION.md) | コンテスト審査用のURL、確認順、技術・データ・権利の要約 |
| [SUBMISSION_STATUS.md](SUBMISSION_STATUS.md) | 文書更新時に確認した起動・チェック結果と、提出前の残件 |
| [thumbnails/20260913/README.md](thumbnails/20260913/README.md) | README用7枚・応募用2枚の紹介画像、原寸PNG、生成プロンプト・書き出し記録 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 遅延読込、データ経路、アダプター、イベント、フォールバック |
| [DATA_SOURCES.md](DATA_SOURCES.md) | データ取得元、使用値、取得・加工方法、ライセンス、帰属表示、利用判定の一覧 |
| [EXTERNAL_DATA_USAGE_AUDIT.md](EXTERNAL_DATA_USAGE_AUDIT.md) | 外部データの利用条件、加工、再配布、未解決事項 |
| [MEDIA_RIGHTS_LEDGER.md](MEDIA_RIGHTS_LEDGER.md) | 画像・音声・フォント等の人間向け権利台帳 |
| [media-rights-ledger.json](media-rights-ledger.json) | CIが検査する機械可読の権利台帳 |

## 実装・運用資料

| 資料 | 役割 |
|---|---|
| [SENSOR_OPERATIONS.md](SENSOR_OPERATIONS.md) | D1障害記録、現在のポーリング、容量試算、監視・停止・復旧 |
| [../PRIVACY.md](../PRIVACY.md) | センサー参加で保存・公開する情報、外部送信、保存期間、削除方法 |
| [../SECURITY.md](../SECURITY.md) | 脆弱性の非公開報告、安全対策、Secret失効、安全用途への注意 |
| [SENSOR-MEASUREMENT-CATALOG.md](SENSOR-MEASUREMENT-CATALOG.md) | 参加型センサーの測定項目、単位、検証規則 |
| [REGION-CODE-SOURCES.md](REGION-CODE-SOURCES.md) | 国・地域・自治体コードの出典とライセンス |
| [NOVEL_MODE_IMPLEMENTATION_GUIDE.md](NOVEL_MODE_IMPLEMENTATION_GUIDE.md) | ノベルUIの実装上の補足。台本文言の正本ではない |
| [../story/README.md](../story/README.md) | 台本の正本、生成物、統合台本、更新手順 |

## 世界観の正本

| 資料 | 役割 |
|---|---|
| [GAIA_SENSEWARE_GX_OFFICIAL_SETTING.md](GAIA_SENSEWARE_GX_OFFICIAL_SETTING.md) | 現代編、キャラクター、GXの公式設定 |
| [GAIA_SENSEWARE_BEYOND_SAELIVA_CANON.md](GAIA_SENSEWARE_BEYOND_SAELIVA_CANON.md) | APEIRONCENEとSÆLIVAの設定 |
| [../story/現行統合台本.md](../story/現行統合台本.md) | 現在画面に出る本編・スタッフロール・APEIRONCENEの確認用正本 |

## 制作記録・過去仕様

次のファイルは、制作過程の判断や特定改修の引継ぎを残す資料です。現行UIや台本の正本ではありません。内容が競合するときは、実装、ルートREADME、アーキテクチャ、台本管理資料を優先します。

- `SCENARIO_HANDOFF_*.md`
- `SCENE_SPEC_*.md`
- `UI_BACK_HALF_SURFACE_HANDOFF.md`
- `EVES_COPY_SPEC.md`
- `GAIA_SENSEWARE_META_WORLD_TRUE_END_DESIGN.txt`
- `GAIA_SENSEWARE_STORY_SCRIPT.txt`

旧番号を含む制作記録は当時の履歴として保持しています。現在の展示番号はルートREADME・ARCHITECTURE.md・実装を参照してください。ローカルの `artifacts/` は原則Git管理外で、証跡が必要な提出には別添が必要です。

## 更新ルール

1. 展示数、モード名、直接URL、API経路を変えたら、ルートREADME、応募ガイド、アーキテクチャを同じ変更で更新します。
2. 台詞を変えるときは[story/README.md](../story/README.md)の生成手順に従い、生成済みJavaScriptを直接編集しません。
3. データセット、取得方法、加工、配信範囲を変えたら、データ出典・ライセンス一覧と外部データ監査を同時に更新します。
4. 画像・音声・フォントを追加または差し替えたら機械可読台帳を更新し、`npm run check:rights` を実行します。
5. 応募前は `npm run check:contest` と `npm run check` を実行し、提出コミットと検証結果を記録します。公開サイトも提出する場合は配布物との一致、非公開リポジトリでは審査者の閲覧権限を確認します。
6. センサーの保存項目、公開範囲、ポーリング、rate limit、D1 schemaを変えたら、運用資料、プライバシー説明、Security Policy、画面内説明を同じ変更で更新します。
