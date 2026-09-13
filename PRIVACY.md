# プライバシーに関する説明

最終更新日: 2026-09-04

この文書は、GAIA SENSEWAREの参加型センサー機能（`/sensors/`）が取得・保存・公開する情報を説明します。MAP、STORY、CHARACTER、SOUND、GX、ORBITAL、TOURは、センサー登録やGoogleログインなしで利用できます。

## 1. 取得・保存する情報

### Google連携

- Google OAuth/OIDCで要求するscopeは`openid`だけです。
- ID tokenから利用・保存するGoogle由来の識別子は、アカウントを区別するための安定した`sub`だけです。
- Googleの氏名、メールアドレス、プロフィール画像、連絡先は要求・保存しません。
- D1には内部User ID、公開用のランダムID、アカウント種別、作成・更新時刻を保存します。

Googleとの認証処理では、認可code、state、nonce、PKCE verifierなどを短時間利用します。Sessionは既定8時間で、ブラウザにはSecure Cookieを設定します。D1へ保存するSession TokenとCSRF Tokenは生値ではなくハッシュです。

### 任意プロフィール

参加者が自分で入力・アップロードした次の情報を保存します。

- 公開表示名
- 任意のX、GitHub、InstagramプロフィールURL
- 任意のプロフィール画像

画像は1 MiB以下、最大512×512 pxの非インターレースRGB/RGBA PNGだけを受け付け、表示に不要なPNG ancillary metadataを除去して保存します。

### Deviceと観測データ

- 内部・公開Device ID、Device名、状態、作成・更新時刻
- 国、都道府県・州、市区町村など参加者が選んだ地域コード
- 参加者が地図上で選んだ公開POIの緯度・経度
- 計測項目、連番、任意の観測時刻、サーバー受信時刻、数値の観測値
- 受信payloadのhash、直近値、観測件数・期間・payload量の集計
- Pairing Codeのhash、Device TokenのHMAC hash
- センサーへの「応援」状態

GPS、端末の自動位置情報、実際の設置住所、Wi-Fi SSID・passwordは取得しません。ただし、公開POIは小数5桁へ丸めた座標として保存・公開されます。参加者が自宅や実機と同じ場所を選べば、その位置を推測される可能性があります。位置を公開したくない場合は、離れた公共施設などを選んでください。

### ブラウザ内だけに保存する情報

- 物語の進行・設定は`localStorage`へ保存し、GAIAのサーバーへ送信しません。
- センサー分析・観測データ分析で共通のAI provider、endpoint、model設定はブラウザへ保存します。
- BYOKのAPI keyは、お使いのブラウザ内だけに保存され、GAIAのサーバーでは保管・中継しません。標準ではこのタブ内の`sessionStorage`を使い、「次回も使えるよう、このブラウザに保存する」を選択した場合だけ`localStorage`へ継続保存します。いずれも暗号化保存ではないため、共有PCでは継続保存を選ばないでください。保存は分析の送信時に行い、保存済みのキーは画面から削除できます。分析時はキーと対象データを、ブラウザから選択したAI providerまたは任意endpointへ直接送ります。
- AIへ質問すると、画面上のセンサー名、地域、実測／模擬区分、集計、最大48件の観測値、質問文が選択した送信先へ渡ります。送信先のプライバシーポリシーと保存設定は利用者が確認してください。
- 観測データ画面の「AIで分析する」では、利用者が送信ボタンを押すと、選択中のデータ名・単位・分析手法・絞り込み条件・計算結果・注意事項・先頭最大120件の対象観測値・質問文を指定先へ送ります。送信前に内容を確認できます。120件を超える場合、先頭部分は全体の無作為標本ではないことを明示します。設定画面を開く、質問例ボタンを選ぶ、質問文を書き換えるだけでは送信しません。

## 2. 公開される情報

すべての登録センサーは公開観測点です。非公開登録はありません。公開地図APIと画面には次を表示します。

- センサー名、公開用Sensor ID
- 選択した国・地域・市区町村と公開POI座標
- ONLINE/OFFLINE状態、計測項目
- 直近最大12件の数値、観測件数、観測期間
- 応援数
- 所有者が設定した表示名、プロフィール画像、SNS URL

公開しない情報:

- Googleの`sub`、内部User ID・Device ID
- Session Token、CSRF Token、Device Token、Pairing Codeの生値と保存hash
- Wi-Fi情報
- Googleの氏名・メールアドレス（取得しません）
- 公開APIに含めない過去のtelemetry全文

## 3. 利用目的

保存情報は次の目的に限って利用します。

- Google連携または匿名おためしSessionの識別
- Deviceのpairing、認証、Token失効
- 観測値の受信、履歴表示、公開地図での共有と集計
- 公開プロフィールと応援機能の提供
- rate limit、不正利用対策、障害調査、容量監視
- コンテスト作品の動作確認と運用

観測値を広告配信や利用者の行動プロファイリングへ使用しません。

## 4. 外部サービス

| サービス | 用途 | 渡る情報 |
|---|---|---|
| Cloudflare Pages / Functions / D1 | サイト配信、API、データ保存、運用ログ | HTTPリクエスト、上記の登録・観測データ。Cloudflare側の標準ログ等はCloudflareの仕様に従う |
| Google OAuth/OIDC | 任意のGoogle連携 | 認証要求、callback。GAIAは`openid` scopeと`sub`だけを利用 |
| OpenStreetMap Standard tiles | 公開POIを選ぶ地図 | ブラウザからのtile request。登録情報やDevice Tokenをtile URLへ含めない |
| 利用者が選んだAI provider / endpoint | 任意のセンサー分析 | API key、質問文、画面上の分析対象データ。GAIAのサーバーは中継しない |

MAPなど作品本体が利用する外部データAPIは[docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)にまとめています。

## 5. おためし利用

- おためしアカウントは名前・メールなしで作成します。
- 8時間以内にGoogle連携すると、同じセンサー、Device Token、観測履歴をGoogle連携アカウントへ引き継ぎます。
- おためし利用中に明示的にログアウトすると、アカウントと関連するDevice、telemetry、Session等をD1の外部キーcascadeで削除します。
- Session切れだけでは、その瞬間に削除しません。期限切れSessionしかないおためしアカウントは、次のおためしアカウント作成時に清掃します。

## 6. 保存期間と削除

現時点の実装は次のとおりです。

| 情報 | 現在の扱い |
|---|---|
| 有効Session | 既定8時間。ログアウト時にGoogle連携Sessionを失効 |
| OAuth flow / Pairing Code | 利用可能期間は10分。期限後は利用不可 |
| おためしアカウント | 明示ログアウトで関連データを削除。期限切れ孤立アカウントは次回おためし開始時に清掃 |
| Google連携プロフィール・Device・telemetry | 自動保存期限なし。プロフィール画面の「アカウントと観測データの削除」で一括削除可能 |
| Device削除 | DeviceをREVOKEDにし、Tokenを直ちに無効化して公開・所有者一覧から除外。telemetryは直ちに物理削除しない |
| プロフィール画像 | 所有者画面から個別削除可能 |
| AI API key | センサー画面の削除ボタン、ブラウザのサイトデータ削除、またはsession終了で削除可能 |

Google連携アカウントは、プロフィール画面で「削除」と入力し、確認ダイアログを承認すると一括削除できます。GAIAのプロフィール画像・Google連携識別子・全Session・Device・観測値・応援関係と関連集計を削除し、旧Device Tokenは使えなくなります。Googleアカウント自体や作品のSTORY保存データは削除しません。ログインできない場合は、公開Issueへ個人情報・Token・Google識別子を書かず、下記の手順で連絡してください。

公開POIは小数5桁の座標を公開するため、自宅などの位置が推定され得ます。自宅・個人の居場所を避け、公開可能な施設等を指定してください。他者が保存した公開情報や、以前の版で長期間キャッシュされた画像はGAIA側から回収できません。新しいプロフィール画像の応答は `no-store` とします。

AI分析は、初回またはAPIキー・送信先originが変わったとき、ブラウザ上で送信先を確認します。「共有端末でのAI利用を終了」は保存済みキー・AI接続設定・現在の質問と回答を消し、進行中のブラウザ通信を中止します。STORY保存とGoogleログイン状態は消しません。共有端末から離れる前にはセンサー画面のログアウトも行ってください。外部AIが既に受理したデータ・処理・料金の取消しは保証しません。

D1 Time Travelにより、削除後も復旧用履歴へ一定期間残る場合があります。Cloudflareの現行仕様ではFree planは7日、Paid planは30日です。詳細は[Cloudflare D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)を参照してください。

## 7. 問い合わせと削除依頼

1. GitHub repositoryのIssueで、秘密情報を書かずに「データ削除連絡先を希望」とだけ連絡してください。
2. 運営者が公開されない本人確認方法を案内します。
3. Device Token、Session Cookie、Googleの`sub`、正確な住所をIssueへ投稿しないでください。

Repository: <https://github.com/hinahina-vr/gaia-sensation>

法令上必要な本人確認と、削除対象・D1 Time Travelの残存期間を確認して対応します。現時点では自動受付や固定の処理日数を保証する仕組みはありません。

## 8. 変更

保存項目、公開範囲、外部送信、保存期間を変更した場合は、この文書と画面内説明を更新します。安全対策と脆弱性報告は[SECURITY.md](SECURITY.md)を参照してください。
