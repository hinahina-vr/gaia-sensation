# セキュリティ検証対応表（2026-09-07）

参照基準は [OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/)。以下は今回の変更に関係する領域への対応づけであり、全要件監査・ASVS認証・無脆弱性の保証ではない。版を固定し、未確認の要件番号や適合レベルは付与しない。

| ASVSの関連領域 | 実装・実行した検証 | 証拠 |
|---|---|---|
| 認証・Session管理 | Session必須、旧Session失効、Google callbackのブラウザ束縛、削除後の全Session拒否 | `sensor-platform/test/run-api-tests.mjs` |
| 認可・アクセス制御 | 別所有者の更新/削除を拒否、本人IDをサーバーで確定、削除後に別所有者データが残る | 同上 |
| API・入力検証 | 正確な確認本文、Origin・CSRF、本文上限、有限な観測値、重複seq・競合ペアリング | 同上 |
| データ保護 | アカウントのFK一括削除、画像no-storeと新しいURL、削除操作説明、公開位置の説明 | 同上、`PRIVACY.md`、ブラウザ削除UI試験 |
| エンコード・サニタイズ | 外部データの表示はtextContent、javascript/dataリンク拒否、AI回答はHTML化しない、PNGのみ | `scripts/check-hardening-browser.mjs`、統計/センサーAIブラウザ試験 |
| Webフロントエンドの防御 | 6個のinline scriptをハッシュで許可、未許可inline実行を実ブラウザで拒否、ヘッダーを実workerd HTTPで確認 | `scripts/build-browser-security.mjs`、`sensor-platform/test/run-pages-functions-tests.mjs` |
| 外部通信・秘密情報保護 | AI送信先origin再確認、拒否時に送信なし、同一originへのキー誤送信拒否、redirect拒否、cookie/referrerなし、キー伏字、2MB応答上限、キャンセル | `scripts/check-hardening-browser.mjs`、`scripts/check-statistics-ai.mjs` |
| 構成・依存管理 | ロックファイルに対するnpm audit、独立したローカルWorkerの受付停止/通常復帰 | `scripts/audit-hardening-dependencies.mjs`、`scripts/check-sensor-operation-mode.mjs` |

## 証拠の境界

- API試験は、新規のローカルD1と合成アカウント/トークンによる実workerd HTTP試験。実Googleログインを済ませたものではない。
- 削除UIと外部AIのブラウザ試験はモックAPIを使用。削除の実DB動作は別のAPI試験で確認する。課金されるAI providerへは送信していない。
- CSPのUI試験は生成ポリシーをローカル応答へ付けてChromeで強制する。Pages試験は実workerd/静的配信の応答ヘッダーを確認する。本番の確認ではない。
- npm auditの「検出0」は2026-09-07に当該ロックファイルで公表済み情報と照合した結果。コード監査や将来の脆弱性まで含めない。
- 所有者によるアカウント削除、受付停止は稼働中D1を対象とする。Time Travel・第三者が保存した公開コピーの即時消去は保証できない。
- 非公開の脆弱性窓口は、既存のGitHub Private vulnerability reporting経路を案内しているが、リポジトリ設定の有効化や専用メールアドレスの新設は今回行っていない。運営者の窓口決定と有効化確認が必要。
- 未確認: 実スマートフォン・Safari/Firefox・ESP32実機書込・本番Google認証・本番停止演習・外部侵入試験・ログ保管期間/バックアップ実復旧。
