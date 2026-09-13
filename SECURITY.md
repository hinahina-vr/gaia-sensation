# Security Policy

公開向け案内の整理日: 2026-09-13。記載はソースの実装方針であり、すべての配信版の監査完了を示すものではありません。

## Supported versions

セキュリティ修正の対象は、GitHub `main`の最新状態と、そこから公開した<https://gaia-senseware.pages.dev/>だけです。過去commit、fork、第三者mirror、利用者が変更したESP32 firmwareは対象外です。

## 脆弱性を報告する

脆弱性、認証回避、Token漏えい、非公開情報の露出を見つけた場合は、公開Issueへ詳細を書かないでください。

1. GitHub repositoryの`Security`タブに`Report a vulnerability`が表示される場合は、Private vulnerability reportingを使用してください。
2. 利用できない場合は、公開Issueへ再現手順や秘密情報を含めず、「security連絡先を希望」とだけ投稿してください。運営者が非公開の連絡方法を案内します。
3. URL、影響する機能、最小限の再現条件、確認日時、想定影響を含めてください。Session Cookie、Device Token、Google token、API key、他人の観測データは添付しないでください。

Repository: <https://github.com/hinahina-vr/gaia-sensation>

自動受付、bug bounty、固定の初動・修正SLAはありません。受領後は影響確認、封じ込め、修正、必要なToken失効、公開の順に対応します。

## 調査時のお願い

- 自分のアカウントとDeviceだけを使用してください。
- 高頻度アクセス、DDoS、D1枯渇、外部APIへの大量requestを行わないでください。
- 他の利用者のデータを閲覧・変更・削除・持ち出さないでください。
- Google、Cloudflare、OpenStreetMap、AI providerなど第三者サービスへ攻撃を行わないでください。
- 可用性やデータ保全に影響する検証が必要な場合は、先に非公開で相談してください。

## 実装済みの防御

### Google OIDCとWeb Session

- OAuth authorization code flow、state、nonce、PKCE S256を使用
- Google JWKS署名、`iss`、`aud`、`exp`、`iat`、nonce、`sub`を検証
- scopeは`openid`だけで、氏名・メールアドレスを要求・保存しない
- Session TokenとCSRF TokenはD1へhashで保存
- Session Cookieは`__Host-`、Secure、HttpOnly、SameSiteを使用。CSRF CookieはJavaScriptからheaderへコピーするdouble-submit方式
- ブラウザSessionを使う状態変更APIでOriginとCSRFを検証。おためし開始はsame-originだけを許可し、Device APIはPairing CodeまたはDevice Tokenで認証
- Session既定TTLは8時間

### Device認証とtelemetry

- Device Tokenはpairing成功時に一度だけ返し、D1へは`DEVICE_TOKEN_PEPPER`を使ったHMAC hashを保存
- Pairing Codeも生値を保存せずhash化し、10分・1回限り
- Device削除で状態をREVOKEDへ変更し、Tokenを直ちに無効化
- `seq`を単調増加させ、同じ`seq`・同じ内容のretryだけを冪等に許可
- 新規telemetryはDeviceごとに60秒に1件まで。超過時は`429`と最大60秒の`Retry-After`を返す
- request bodyは12 KiBまで、保存payloadは8,192文字まで、測定値は1〜16項目。既知の項目名、単位、数値範囲を検証

### 公開範囲と入力

- Googleの`sub`、内部ID、Token/hashを公開APIへ返さない
- 公開地図は公開設定、ACTIVE、未削除、公開座標ありのDeviceだけを最大500件返す
- 公開プロフィールのSNS URLはHTTPSかつ対応hostだけを許可
- avatarは1 MiB、512×512 px以下の非インターレースRGB/RGBA PNGへ限定し、不要metadataを除去
- GPSや実際の設置住所を取得しない。ただし参加者が選んだ公開POI座標は公開されるため、UIで位置を離すよう警告

### Secretとrelease

- `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`SESSION_SECRET`、`DEVICE_TOKEN_PEPPER`、`PAIRING_CODE_PEPPER`はCloudflare Pages secretsで管理し、sourceやlogへ値を出さない
- `_worker.js`はsourceから生成し、検査でstale artifact、TypeScript import、source map、secret文字列の混入を確認
- D1 migrationを追加方式で管理し、適用状況を確認してから同じ検証済みcommitをdeploy
- Pages Functionsのrouteを`/api/*`へ限定

### BYOK AI分析

- API keyは利用者のブラウザだけに保存し、GAIAのAPIで中継しない
- HTTPS endpointだけを許可（localhostでのlocal開発を除く）
- GAIA自身のoriginを送信先に指定できない
- `credentials: omit`、`referrerPolicy: no-referrer`で利用者指定endpointへ送信

## 既知の制約

- Google連携アカウントの本人操作による一括削除を実装しています。固定の自動保存期限とバックアップからの即時消去はありません。詳細は[PRIVACY.md](PRIVACY.md)を参照してください。
- `SENSOR_API_MODE` による受付停止（read-only / offline）を実装しています。運営者の設定反映が必要で、参加者向けの管理画面や配信不要の即時切替ではありません。
- telemetryは参加者が管理するDeviceから届くため、値の真正性・校正・設置状況を保証しません。
- 公開地図の公開POIは実際の設置場所とは限りません。
- BYOK送信先の安全性、データ保持、CORS設定は利用者と送信先providerの責任です。
- AI送信は初回とキー・origin変更時に再確認し、応答は2MBを上限とします。画面を閉じた後の回答差し替えを防ぎ、消去操作では進行中の通信も中止します。
- HTMLの実行可能なインラインscriptはビルド時ハッシュで許可し、任意のインラインイベント・外部script・object・他サイトからのiframe表示をCSPで制限します。BYOKのためHTTPSのconnect-srcは任意hostを許可しています。これは保存キーの暗号化やXSS完全防止を意味しません。
- ブラウザの`localStorage`へAPI keyを保持する設定は、共有端末やXSS発生時のリスクがあります。共有端末では「このタブだけ」を選び、利用後に削除してください。

## 安全用途への利用禁止

GAIA SENSEWAREはコンテスト作品・可視化・学習用のプロトタイプです。観測値、ONLINE表示、AI分析、予測、模擬値を、医療、防災、避難、生命・身体、設備制御、法令遵守、環境基準判定などの安全上重要な判断に使用しないでください。異常を示した場合も、公的機関、校正済み機器、現場確認など独立した情報で確認してください。

## Secret漏えい時の対応

- Google client secret: Google Cloud側でrotateし、Pages secretを更新
- Session secret: rotate後にdeploy。進行中OAuth flow等への影響を確認
- Device token pepper: rotateすると既存Device Tokenを検証できなくなるため、全Deviceの再pairingを前提に告知・移行
- Pairing code pepper: rotateし、発行済みPairing Codeを無効化
- 個別Device Token: 所有者画面でDeviceを削除し、新しいDeviceとして再pairing
- 利用者のAI API key: provider側で直ちにrevoke/rotateし、ブラウザ保存も削除

漏えい値をIssue、commit、CI logへ転載しません。Git履歴に入ったsecretは、履歴から見えなくしても漏えい済みとして必ずrotateします。

情報の保存・公開・削除範囲は[PRIVACY.md](PRIVACY.md)を参照してください。
