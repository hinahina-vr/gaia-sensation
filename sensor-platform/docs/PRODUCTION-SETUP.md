# Production setup

production originは `https://gaia-senseware.pages.dev`、Google callbackは `https://gaia-senseware.pages.dev/api/auth/google/callback` です。

## 1. Pages Functions / D1

repository rootの構成をproductionのsource of truthとします。

- `wrangler.jsonc`: Pages project `gaia-senseware`、build output `.`、D1 binding `DB`、production vars
- `sensor-platform/src/pages-entry.ts`: advanced-mode entrypointのsource。`/api/*` をSensor Platform handlerへ渡し、それ以外は `env.ASSETS.fetch(request)` へ渡す
- `_worker.js`: `scripts/build-sensor-pages-worker.mjs` がWrangler 4.121.0のlocal dry-run bundlerで生成する、単一self-contained JavaScript upload artifact。手編集しない
- `_routes.json`: Function invocationを `/api/*` のみに限定。story、sensor SPA、主要assetは静的配信
- health check: `GET /api/health`（legacy health endpointは使用しない）

production D1:

1. `gaia-senseware-sensors` を作成済み
2. UUID `6a386d6a-2858-4673-b396-6c340f9ea6d7` をroot `wrangler.jsonc` のD1 bindingへ設定済み
3. 2026-09-04時点でremote migration `0001_initial.sql` から `0011_read_optimized_rollups.sql` まで適用済み。未適用migrationなしを確認済み
4. `0006_privacy_first_accounts.sql` はGoogle由来の保存済みname/emailを匿名名/NULLへ移行し、匿名おためしアカウント種別を追加した
5. `0011_read_optimized_rollups.sql` は公開地図APIがtelemetry全履歴を走査しないよう、telemetry・socialのtrigger同期集計表とindexを追加した。障害記録と容量計画は[../../docs/SENSOR_OPERATIONS.md](../../docs/SENSOR_OPERATIONS.md)を参照

以後のschema変更は追加migrationとして適用し、既存migrationを書き換えません。

`node scripts/build-sensor-pages-worker.mjs --check` はsourceから一時bundleを再生成し、tracked `_worker.js`とのbyte一致、TypeScript import残存0、source map参照0、secret埋込0、ASSETS fallbackを検査します。source変更後にartifactがstaleなら失敗します。

## 2. Google OIDC / secrets

Google Cloud ConsoleでWeb application OAuth clientを作成し、次のAuthorized redirect URIを完全一致で登録します。

`https://gaia-senseware.pages.dev/api/auth/google/callback`

Google authorization scopeは`openid`だけを要求し、ID tokenからは`sub`だけを利用します。Googleのname/email claimは要求・保存しません。

Pages projectへ登録するsecret（全て別値）:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`（32 random bytes以上）
- `DEVICE_TOKEN_PEPPER`（32 random bytes以上）
- `PAIRING_CODE_PEPPER`（32 random bytes以上）

`wrangler pages secret put <NAME> --project-name gaia-senseware` のinteractive promptを使い、値をcommand line・source・logへ出しません。上記5secretはproductionへ登録済みで、`wrangler pages secret list --project-name gaia-senseware` により名前の存在だけを確認済みです。値は取得・表示していません。authorization code、state、nonce、PKCE S256、JWKS/iss/aud/exp/iat/nonce/sub検証はlocal API test済みです。

## 3. Release実行順

1. local checker / API / browser focused QA
2. 公開対象に内部handoff文書が含まれないことを確認し、push・remote migration・deployの承認を確認
3. `wrangler d1 migrations list DB --remote --config wrangler.jsonc` で未適用migrationをread-only確認
4. 未適用の追加migrationをproduction D1へ適用
5. Google callback URIと必要secret名の存在を確認（secret値は表示しない）
6. candidateを通常FF pushし、同一tracked snapshotをPages Productionへdeploy
7. `GET /api/health`、`/story`、`/sensors/`、主要assetを最小smoke
8. production TLS chainを再確認し、Starter KitのRoot CAと一致を確認
9. Google login導線と匿名おためし開始 → 再読込 → logout削除の最小smoke
10. login → device追加 → pairing → telemetry → latestの最小smoke

## 4. Rollback

Pagesを直前公開SHAへ通常revert deployし、Google callback/clientを無効化、Pages secretsを削除します。D1は即削除せず、書込みを停止してexportを保持します。D1削除は別途明示承認を要します。
