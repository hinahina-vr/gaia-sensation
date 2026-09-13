# Sensor Platform 運用・D1容量計画

最終確認日: 2026-09-04

この文書は、GAIA SENSEWAREの参加型センサー機能（`/sensors/`、`/api/web/v1/*`、`/api/device/v1/*`、`/api/public/v1/*`）を運用するための正本です。実装の構成は[ARCHITECTURE.md](ARCHITECTURE.md)、公開手順は[../sensor-platform/docs/PRODUCTION-SETUP.md](../sensor-platform/docs/PRODUCTION-SETUP.md)、API契約は[../smartcity-sensor-starter-kit/openapi.yaml](../smartcity-sensor-starter-kit/openapi.yaml)を参照してください。

## 1. 先に読む要点

- サーバーは、Deviceごとに新規テレメトリを**60秒に1件まで**受け付けます。この下限は維持します。
- ESP32 Starter Kitの既定送信間隔は**5分**です。60秒は許容上限であり、推奨送信間隔ではありません。
- 公開地図は、画面が見えている間だけ60秒ごとに更新します。
- 所有者詳細は、画面が見えている間だけ最新値を30秒ごとに取得します。最大48件の履歴は初回表示と手動更新時だけ取得します。
- 公開地図APIは、全履歴を走査せず、migration `0011_read_optimized_rollups.sql` の集計表を読みます。
- D1 Freeの現行上限は1日あたり500万rows read、10万rows written、合計5 GBです。Freeで日次上限を超えると、UTC 0時のリセットまでD1クエリが失敗します。上限は変更される可能性があるため、運用前に[Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)と[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)を再確認してください。

運用上の内部警戒線は、公式上限の80%である**400万rows read/日、8万rows written/日**とします。これはCloudflareの仕様ではなく、本プロジェクトの余裕枠です。

## 2. 既知障害と原因

### 2026年9月以前のD1 Read枯渇

旧実装では、公開地図を開いたクライアントが短い間隔で次の3種類の重いクエリを繰り返していました。

1. 全テレメトリからDeviceごとの直近値を順位付けするCTE
2. 全テレメトリからDeviceごとの件数・期間を再集計するクエリ
3. 公開Device全体のテレメトリ件数・payload量を再集計するクエリ

運用時にはD1 Freeの500万rows read/日を約5分で消費しました。2026-09-04に確認した直近7日間のD1 Insightsにも、旧クエリ群について次の記録が残っていました。

| 旧クエリ | 1実行あたり平均rows read | 期間内合計rows read | 実行回数 |
|---|---:|---:|---:|
| Deviceごとの直近値・履歴順位付け | 6,368 | 12,157,127 | 1,909 |
| Deviceごとの統計再集計 | 3,174 | 6,254,652 | 1,970 |
| ネットワーク全体の統計再集計 | 1,587 | 3,272,002 | 2,061 |
| 合計 | 約11,129 / 公開地図更新 | 21,683,781 | — |

上表は障害当日の5分間だけを切り出した値ではなく、D1 Insightsの直近7日集計です。したがって、障害報告の「約5分」と表の合計値を同じ期間の数字として扱いません。

### 実施済みの対策

- `device_telemetry_rollups` に観測件数、最初・最後の受信時刻、payload量、直近12件を保持
- `device_social_rollups` に応援数を保持
- テレメトリ登録と応援操作をtriggerで集計表へ同期
- 公開地図APIをDevice、User、上記2集計表の結合へ変更し、全履歴走査を廃止
- 公開Deviceの検索条件に合わせたindexを追加
- 公開地図を60秒ポーリングへ変更し、非表示タブでは停止
- 所有者詳細を「最新値30秒」「履歴は初回・手動のみ」へ分離し、非表示タブでは停止
- 同じ画面から重複した更新要求を出さないよう、進行中Promiseを共有
- 新規テレメトリ受付をDeviceごとに60秒に1件へ制限。完全一致の再送だけは新規行を書かず冪等に応答

## 3. 現在の本番状態

2026-09-04に、本番D1へread-onlyの確認を行いました。

| 項目 | 確認値 |
|---|---:|
| users | 6 |
| active devices | 5 |
| telemetry rows | 1,681 |
| telemetry rollup rows | 1 |
| social rollup rows | 5 |
| 最終テレメトリ受信 | 2026-09-01T10:38:51.428Z |
| DBサイズ | 1,085,440 bytes（約1.04 MiB） |
| remote migration | 未適用なし（`0001`〜`0011`適用済み） |

直近24時間のD1 Insightsでは、現在の公開センサー一覧クエリは16 rows read、ネットワーク集計は6 rows readで、公開地図1更新あたり約22 rows readでした。旧クエリ群の約11,129 rows read/更新との比較では**約99.8%削減**です。

ただし、直近24時間の実行回数は各1回で、現在の公開Deviceも5件だけです。この値は少量データ時の実測サンプルであり、将来の保証値ではありません。確認用に実行した集計クエリ自体も3,379 rowsを読み込んだため、日常監視では全テレメトリの`COUNT(*)`を繰り返さないでください。

## 4. Read容量シミュレーション

以下は2026-09-04の実測から作った**計画用モデル**です。D1の内部実行計画、index、データ分布、他API利用により実績は変わります。

### 4.1 公開地図

公開Device数を `D`、24時間開いたままの公開地図タブ数を `T` とすると、現在の少量データ時の近似は次です。

```text
1更新のrows read ≒ 4D + 2
1日のrows read ≒ T × 1,440 × (4D + 2)
```

| 公開Device数 | 常時表示タブ数 | 推定rows read/日 | 判定 |
|---:|---:|---:|---|
| 5 | 1 | 31,680 | 余裕あり |
| 5 | 50 | 1,584,000 | 余裕あり |
| 5 | 100 | 3,168,000 | 警戒線未満 |
| 5 | 125 | 3,960,000 | 80%警戒線付近 |
| 5 | 157 | 4,973,760 | Free上限付近 |
| 50 | 1 | 290,880 | 余裕あり |
| 50 | 13 | 3,781,440 | 80%警戒線付近 |
| 50 | 17 | 4,944,960 | Free上限付近 |
| 100 | 1 | 578,880 | 余裕あり |
| 100 | 6 | 3,473,280 | 警戒線未満 |
| 100 | 8 | 4,631,040 | Free上限に近い |
| 500 | 1 | 2,882,880 | 1タブでも高負荷 |
| 500 | 2 | 5,765,760 | Free上限超過 |

「常時表示タブ」は厳しい上限モデルです。10分だけ閲覧する訪問では初回を含めて約11更新とし、Device 5件なら1訪問あたり約242 rows read、100訪問/日で約24,200、1,000訪問/日で約242,000です。

### 4.2 所有者詳細

直近のD1 Insightsでは、認証確認、所有Device確認、最新値の取得を合わせた計画値を約6 rows read/更新と置けます。

| 利用 | 推定rows read |
|---|---:|
| 1タブを1時間表示 | 約720 |
| 1タブを24時間表示 | 約17,280 |
| 初回の履歴48件取得 | 約100 |
| 10タブを24時間表示 + 各1回履歴取得 | 約173,800/日 |

旧実装は2秒ごとに「最新値 + 最大48件の履歴」を取得し、1タブで約19万rows read/時、約462万rows read/日という最悪ケースでした。現在の24時間モデルは履歴初回分を含め約17,380 rows readで、旧概算から**約99.6%削減**です。

## 5. Write容量シミュレーション

現在のテレメトリ1件は、Device更新、telemetry追加、集計triggerなどを含みます。D1 Insightsの実績を踏まえ、計画上は**受理1件あたり5 rows written**として余裕を持たせます。アカウント、Session、Pairing、応援操作などの書込みは別に発生します。

```text
1日のrows written ≒ Device数 × (1,440 ÷ 送信間隔[分]) × 5
```

| 送信間隔 | Device数 | 推定rows written/日 | 判定 |
|---:|---:|---:|---|
| 1分（サーバー許容上限） | 5 | 36,000 | 余裕あり |
| 1分 | 10 | 72,000 | 警戒線未満 |
| 1分 | 11 | 79,200 | 80%警戒線付近 |
| 1分 | 14 | 100,800 | Free上限超過 |
| 5分（Starter Kit既定） | 5 | 7,200 | 余裕あり |
| 5分 | 20 | 28,800 | 余裕あり |
| 5分 | 50 | 72,000 | 警戒線未満 |
| 5分 | 55 | 79,200 | 80%警戒線付近 |
| 5分 | 70 | 100,800 | Free上限超過 |
| 15分 | 166 | 79,680 | 80%警戒線付近 |
| 60分 | 666 | 79,920 | 80%警戒線付近 |

現状の5 Deviceとコンテスト規模では、サーバー制限を60秒より厳しくする必要はありません。Starter Kitの5分間隔を維持し、継続稼働Deviceが50台に近づいた時点で、次のいずれかを先に実施します。

1. 標準送信間隔を10〜15分へ延長
2. D1 Paidへ移行
3. 集計方法とtriggerのwrite増幅を再計測・削減

公開Deviceや同時閲覧者が増える場合は、writeより先に公開地図readが制約になる可能性があります。100〜500 Deviceを公開する前に、レスポンスのedge cache、差分取得、ページ分割または地域集計を実装してください。

## 6. 監視方法と警戒ライン

Cloudflare DashboardのD1 Metricsでは、query count、rows read、rows written、query latencyを確認できます。D1 Metricsの保持期間は31日です。D1 Insights CLIは実験的機能なので、Dashboardと併用します。詳細は[D1 metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)を参照してください。

日次確認:

```powershell
npx wrangler d1 insights DB --config wrangler.jsonc --time-period=1d --sort-type=sum --sort-by=reads --limit=10
npx wrangler d1 insights DB --config wrangler.jsonc --time-period=1d --sort-type=sum --sort-by=writes --limit=10
npx wrangler d1 migrations list DB --remote --config wrangler.jsonc
```

週次確認:

- Cloudflare Dashboardで7日推移と前週比を確認
- rows read/日が250万（50%）を超えたら原因クエリを特定
- 400万（80%）を超えたら公開地図の更新頻度、公開Device数、異常タブを確認し、対策を当日中に判断
- rows written/日が5万（50%）を超えたらDevice別送信頻度を確認
- 8万（80%）を超えたら標準送信間隔の延長またはPaid移行を判断
- Billing NotificationsでRows ReadとRows Writtenの通知を設定。設定方法は[D1 usage and billing notifications](https://developers.cloudflare.com/d1/observability/billing/)を参照

通常の件数確認はrollup表を使い、`telemetry`全体を毎回数えません。

```sql
SELECT COUNT(*) AS active_devices
FROM devices
WHERE status = 'ACTIVE' AND deleted_at IS NULL;

SELECT COALESCE(SUM(observation_count), 0) AS telemetry_rows_estimate
FROM device_telemetry_rollups;
```

## 7. 異常時の停止・復旧

### センサーAPIの受付モード（2026-09-07追加）

運営者が `wrangler.jsonc` の `vars.SENSOR_API_MODE` を設定します。ローカル検証は `sensor-platform/wrangler.jsonc` を使います。

| 値 | 受付範囲 |
|---|---|
| normal | 通常運用 |
| read-only | 公開・所有者の読み取りを継続。新規ログイン・登録・更新・観測送信は503で停止 |
| offline | 読み取りも停止。ヘルスチェック、本人のログアウトとアカウント削除だけは残す |
| 未知の非空値 | offline相当で停止（誤記で受付を再開しない） |

停止応答は `SENSOR_MAINTENANCE`、`Cache-Control: no-store`、`Retry-After: 300` を返します。作品本体のSTORY/MAPと公開環境APIの `LIVE_SENSEWARE_ENABLED` は独立です。停止は全サイト停止ではありません。

1. 異常の時刻・検証済みcommit・現在の設定を記録。
2. 必要なモードをローカルで設定し、`npm run check:sensor-operation-mode` で確認。
3. 製作者から今回の公開許可を得て、同一検証済みcommitを配信。設定変更だけでも配信への反映が必要です。
4. 配信先でhealthと停止対象の503を確認。正規データやsecretを診断ログへ出さない。
5. 原因解消後にnormalへ戻し、本人・他人のアクセス分離、テスト用Deviceの新規観測、公開表示を確認。削除済みデータをバックアップ復旧で再公開しない。

ローカルworkerdで3種類の停止状態とnormal復帰のHTTP試験を残しています。本番での停止演習は未実施です。

### rows readが急増したとき

1. Dashboardと`wrangler d1 insights`で、rows read合計が大きいqueryを特定する。
2. 公開地図、所有者詳細、botアクセスのどこから発生しているかを切り分ける。
3. 増加が続く場合は、該当APIを一時的に`503 Service Unavailable`へする保守用変更、またはクライアントの自動更新を止める変更を通常のレビュー・deploy手順で公開する。現時点で管理画面から切り替えるkill switchは未実装。
4. D1 Free上限へ到達済みの場合、クエリはUTC 0時のリセットまで失敗する。データ消失とは限らないため、DB削除や再作成を行わない。
5. 修正後、local test、remote migration確認、通常deploy、`/api/health`と該当APIのsmoke testを行う。

### rows writtenが急増したとき

1. Device Tokenを公開しない。異常Deviceが特定できる場合は所有者画面でDeviceを削除し、Tokenを失効させる。
2. 同一Deviceの受理が60秒未満で増えているなら、rate limit回避または実装不整合として調査する。
3. 正常Device全体の増加なら、Starter Kitの送信間隔を延長するか、Paid移行を判断する。

## 8. バックアップ、保存期間、削除

- D1 Time Travelは常時有効で、Free planの復元可能期間は7日、Paid planは30日です。仕様は[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)を参照してください。
- schema変更前はTime Travel bookmarkを記録し、必要なら別途exportを保存します。
- restoreは現在のDB状態を変更するため、障害切り分けだけを理由に実行しません。実行には対象bookmark、影響範囲、復旧後の再処理を確認します。
- Google連携アカウントとtelemetryには、現時点で自動削除期限がありません。Device削除はToken失効と非表示化であり、telemetryの物理削除ではありません。
- おためしアカウントは明示ログアウト時に関連データをcascade削除し、期限切れSessionだけが残ったおためしアカウントは次回のおためし開始時に清掃します。
- 個人データの取扱いと削除窓口は[../PRIVACY.md](../PRIVACY.md)を参照してください。

固定保存期間、期限切れSession/OAuth flow/Pairing codeの定期purgeは未実装です。Google連携アカウントのself-service削除はプロフィール画面に実装済みです。D1 Time Travel内の残存期間と第三者の保存済みコピーは即時消去できません。

## 9. Release前チェック

```powershell
npm run check
npm run check:contest
npm run check:release-rights
npm --prefix sensor-platform run typecheck
npm --prefix sensor-platform run check:pages-worker
npm --prefix sensor-platform run test:pages
npx wrangler d1 migrations list DB --remote --config wrangler.jsonc
```

push・migration・本番deployは、[Production setup](../sensor-platform/docs/PRODUCTION-SETUP.md)の順序で、同じ検証済みcommitから行います。
