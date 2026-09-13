# 非営利作品としての権利・保守性・性能・セキュリティ改善

## 対象と保存点

- 依頼: 現在の変更をコミットしてから、2026-09-07に提案した4領域の計画を実行する。
- 保存コミット: `43daee7`。既存のコンセプトページ・装飾・MAPモーション・評価レポートを含む。
- 実装先: 同じローカル作業ツリー。push・本番公開・外部への許諾申請は行わない。
- 目的: 表現・数値・保存互換性を保ち、公開根拠と検証可能性を整える。収益性は判断軸にしない。

## 実行チェックリスト

- [x] 既存変更を保存コミットに分離。
- [x] 基準の `npm run check` 合格を確認。
- [x] `check:statistics-lab` の `237 !== 31` を実際に再現。
- [x] 固定数値テストと更新データの契約テストを分離。
- [x] 権利台帳・個別レコード出典・未解決項目・公開前チェックを整備。
- [x] データ読み込みとライフサイクルを段階的に整理。
- [x] 同一Chrome・同一条件で性能を比較し、重複取得削減を実装。
- [x] AIキーの送信先確認・共有端末の終了処理を実装・検証。
- [x] アカウント削除・公開情報の説明・緊急停止経路を実装・検証。
- [x] ブラウザ防御ヘッダーと既存認証・権限検証を整備。
- [x] ローカル実ブラウザで画面・関連機能・保存・書き出し・連続利用を回帰検証。
- [x] 対象版・合格項目・未確認範囲を記録。
- [x] GOSATは非営利・公益目的での製作者判断により利用継続。生成素材は制作元の記録に整理し、未使用JAXA PNGを削除。
- [ ] その他の公開判断は `docs/rights-review.json` を参照。
- [ ] 非公開脆弱性窓口の実運用確認。窓口設定・連絡先の決定待ち。
- [ ] 実スマートフォン・本番Google認証・ESP32実機・本番停止復旧。今回のローカル検証対象外。

## 実装内容と版

ローカル候補の識別子は `gaia-hardening-1`。この記録を含むコミットが対象。保存点 `43daee7` の上へ統合し、別ブランチ・別タスクへ実装を分散していない。本番・既存配布ZIP・過去の公開物は変更していない。

最終ローカルビルド `_worker.js`: 991,209 byte、SHA-256 `54790e054583b826eed2578468c05e5c02b3b3ad1c9296957418f81ed53daf72`。配信manifestのSHA-256: `7f7837f259610ccadc9b295141fac3e5150676d193f49ec08eaa540b236cafe2`。ソース・検証スクリプト・本記録を同じ保存コミットに含める。

| 領域 | 主な変更 |
|---|---|
| 権利 | GBIF既存62記録・2データセットの公式APIからレコードURL、ライセンス、権利者、引用を補完。元の数値・位置・記録は保持。292メディア台帳（未使用PNG1枚の除外後）と193依存エントリ、データ出典を整理 |
| 公開前ゲート | `npm run build:release` は未解決レビューがあれば停止。条件確認と製作者判断（`owner-accepted`）を区別し、決定記録と対象hashを検査。削除済みの公開ファイルは実体と素材台帳からの除外を検査 |
| データ・統計 | `src/data/snapshot-store.js` に同時要求の共有・timeout・再試行・破棄を集約。`statistics-datasets.js` へ純粋な加工を分離。計算fixtureと更新データ契約を分離 |
| 性能 | 同じ約19.6MB JSONの二重取得を解消。10チャンク＋manifestを無損失で生成し、hash付きファイルを再利用。全チャンクは最初の利用時に取得する設計で、完全なモード別オンデマンド化ではない |
| AI | キーと送信先originを結び付けた再確認、拒否時の送信抑止、redirect拒否、Cookie/referrerなし、45秒timeout・2MB応答上限、終了時の通信中止とキー・質問・回答消去 |
| センサー | 明示確認・CSRF・Origin・本人Sessionを要求するアカウント一括削除。FK cascadeと全Session/Device Token失効。画像no-storeと新URL。公開位置・保存期間・削除範囲を説明 |
| 防御・運用 | hashベースCSPを生成し静的配信とPages Workerへ適用。APIのより厳しいno-referrerを維持。運営者用normal/read-only/offline設定とローカル停止復帰試験 |

データ分割と数値計算の変更を混同しないよう、構造整理では数値・欠測の扱いを維持した。その後の画面確認で発見した「31地点／31か国」という古い4つの統計タイトルだけを、現在の行数から生成する形に修正した。降水と風は237地点、再資源化率は91の国・地域。数値の間引き・補間・丸めはしていない。

詳細: [責務とライフサイクル](HARDENING_ARCHITECTURE.md)、[セキュリティ対応表](HARDENING_SECURITY_COVERAGE.md)、[権利確認依頼の未送信原稿](RIGHTS_CONFIRMATION_REQUEST_DRAFT.md)。

## 実行して合格した検証

Windows / Chrome `152.0.7977.76` / Node `22.17.0`。物理PC上の専用headless Chrome。幅320/390等はデスクトップChromeの表示領域変更であり、実スマートフォンではない。

| 対象 | 結果と証拠 |
|---|---|
| 全体・公開条件の構造 | `npm run check`、`npm run check:contest`、`check:hardening`、`git diff --check`。計算・出典・生成データ・CSPの整合性を含む |
| 許諾未確認の混入防止 | 実台帳で `check:release-rights` は意図どおり終了コード1。別の合成fixtureで7検査: 未承認拒否、構造検査、証跡/hash一致、データ変更拒否、見かけの除外拒否、必須レビュー/証跡不足拒否 |
| 数値・描画の同等性 | `artifacts/hardening/equivalence-final/report.json`。1440/390幅で11統計要約、10 e-Stat展示の数値・位置・ラベル・2D canvasピクセル一致。上記4つの件数タイトルに由来する2文章フィールドだけを明示的な差分として許可 |
| 統計操作 | `artifacts/hardening/statistics-lab-final/report.json`。1440/390/320幅、フィルター・手法・グラフから記録への移動・視点保存/適用/削除・フォーカス復帰・MAP状態維持。統計データの外部書き出しは既存仕様どおり提供しない |
| AI・削除UI・悪性入力 | `artifacts/hardening/browser`、`statistics-ai-csp`、`sensor-social-ai`、`sensor-privacy`。実Chrome＋モックAPI。送信先変更の拒否、キー伏字、キャンセル、遅延回答無視、保存方式、削除確認、CSPによるinline JS拒否、外部URL/回答の非HTML表示 |
| 認証・認可・削除 | `sensor-platform/test/run-api-tests.mjs`、35検査合格。実ローカルworkerd/D1＋合成アカウント。別所有者の拒否、確認不足拒否、実DBの一括削除、削除後の旧Token/Session拒否、他利用者の維持、画像404 |
| 配信先Worker | `build:pages-worker`、`typecheck`、`test:pages`（22検査）。生成した `_worker.js` をローカルPages/workerdで動かし、実HTTPのCSP・API no-store/no-referrer、静的画面・公開禁止パスを確認。MP3/WAVのRange要求も実HTTPの206・Content-Range・受信64byteと元ファイルの一致で確認 |
| 停止・復帰 | `artifacts/hardening/operation-mode`。独立した4つのローカルWorker構成、20 HTTP検査。normal/read-only/offline/不正設定、受付拒否、許可された削除/ログアウト経路 |
| STORY・保存・書き出し | `story-clean-csp` と `story-storage`。1440/390幅の入口演出、手動SAVE→進行→再読込→LOAD、実ダウンロードの全台本（85,884文字、全380本編stepを包含）を確認。CSP違反0 |
| SOUND・SPACE・コンセプト | `sound-csp`（12曲の再生/切替、PC/mobile）、`space-csp`（1440/390/320幅の配置・クリック）、`concept-csp`（5幅・7検査）。生成CSP適用下で実ブラウザ確認、スクリーンショットを目視 |
| 秘密・依存 | 現行treeの既知Token形式を検査し検出0。npm auditは2026-09-07時点の2ロックファイルとも公表済み脆弱性0。全履歴secret scan・第三者侵入試験・無脆弱性保証ではない |

旧テストの「31件」「以前のタイトル画面で開始」「旧台本文言」等の前提は現在のUIと照合して更新した。機能を古いテストに合わせて戻していない。途中の通信拒否やテスト側のabout:blankへのStorage注入失敗は合格として扱わず、診断・修正後の結果と区別する。

## 性能と連続利用

ローカルの非圧縮HTTPで、初回snapshotのデコード量は **39,182,938 → 9,061,302 byte（約76.9%削減）**。元は同じ19,591,469 byteを別経路で2回取得していた。新しい配信データはmanifest込み11要求。GBIF帰属追記後の元JSONは19,622,989 byteで、数値等の無損失round-tripを検証済み。

`artifacts/hardening/startup/report.json` は無制限loopback・3回の初期比較。初回MAPデータ準備の中央値はPC 1,118→1,271ms、390幅/CPU4倍 3,586→3,843msで、ここでは高速化していない。一方、同じ計測範囲の50ms超過long task累計中央値はPC 413→246ms、390幅 3,333→1,877ms。これはサイト全体のINP/LCPや実通信時間ではない。「warm」は同一URL再読込でsnapshotの転送が残ったため、キャッシュヒットした再訪問の証拠には使わない。

回線制限と実際の再訪問キャッシュを含む最終比較は `artifacts/hardening/startup-network-final/report.json`（16読込すべて合格、page error 0）。20Mbps下り・5Mbps上り・80ms遅延、各2回。測定中は他のブラウザQAを並走させていない。圧縮/CDNを含む本番性能とは区別する。

| MAPデータ準備まで（2回の中央値） | 保存点 | 改善版 |
|---|---:|---:|
| PC・初回 | 17.96秒 | 11.34秒 |
| PC・再訪問 | 11.05秒 | 1.25秒 |
| 390幅/CPU4倍・初回 | 16.15秒 | 11.69秒 |
| 390幅/CPU4倍・再訪問 | 12.24秒 | 3.34秒 |

この回線条件の旧版では副次的な重複取得がタイムアウトするため、完了したsnapshotのデコード量は19.59MBであり、無制限loopbackの39.18MBとは同じ意味ではない。改善版の再訪問は10チャンクがキャッシュから読み込まれ、snapshot関連のResource Timing転送量はmanifest等の3,065 byte。サーバー圧縮なしの小標本なので、本番やすべての回線で同率の高速化を保証しない。

`artifacts/hardening/soak/report.json`: 30分、1440/390幅で各179回の展示選択・統計開閉。snapshot取得は各11回のまま。4分ウォームアップ後から28分最終サンプルまでの強制GC後heap増加はPC **246,588 byte**、390幅 **259,176 byte**。listener数は各1,276で一定、DOMノード増加なし。最終件数ラベル修正はこの後に実施し、数値・画面回帰を再実行した。通信・ライフサイクルコードは連続試験後に変更していない。

利用中の画質・画像・音楽データは変更していない。未使用JAXA PNGの削除は末尾追補のとおり。描画品質の引き下げ、全面的な画像リサイズ、全音声先読みの組み替え、巨大ファイル全体のリファクタリングは実施していない。今回は根拠が得られた重複取得・解析境界を優先した段階的改善である。

## ローカル導入・再検証

通常のローカル検証は `npm run check`、`npm --prefix sensor-platform run typecheck`。データを更新した場合は `npm run data:runtime`、HTML内scriptを更新した場合は `npm run security:build` の後、各チェックと `npm --prefix sensor-platform run build:pages-worker` を実行する。Worker生成はdry-runビルドで、デプロイではない。

静的UI確認用サーバーは `node scripts/serve-sensor-platform-qa.mjs 4399`（センサーAPIはモック）。実DBの確認には別途 `node sensor-platform/test/run-api-tests.mjs`、配信経路には `npm --prefix sensor-platform run test:pages` を使う。起動先ポート・一時D1はテスト専用で、本番データを使わない。初期化できないWindows環境では `XDG_CONFIG_HOME` と `WRANGLER_LOG_PATH` を作業ツリー内の検証用パスへ向ける。

新しい配布ZIPは作成・変更していないため、既存ESP32 ZIPを今回の版として検証済みと表示しない。

## 検証条件と制限

接続型Chrome DevToolsは既存プロファイル競合のため起動できなかった。利用中のブラウザは停止せず、プロジェクト既存の専用Chrome/Playwright/CDP計測を使う。これはローカルChromeでの実ブラウザ検証であり、物理スマートフォンや本番の確認とは区別する。

提供元の条件確認と、製作者による作品の利用・公開判断は区別して記録する。GOSATは製作者が非営利・公益目的の現行利用に問題ないと判断し、公開保留を解除した。生成素材は制作元・出典の記録に整理し、OpenAI Imagegen / Suno AIと表記する。未使用のJAXA PNGは製作者指示でローカル削除済み。

本番Google認証・有料AIへの実送信・実スマートフォンの発熱・Safari/Firefox・ESP32導入・本番D1停止復旧・バックアップからの実復旧は、今回のローカル検証対象外。これは権利上の公開保留や確認済みの不具合とは別の、未検証範囲の記録である。残る公開判断は `docs/rights-review.json` を参照。確認依頼原稿は未送信。

## 2026-09-07追補: 製作者判断・素材整理の検証

対象は保存コミット `63ec6ff` 上の今回のローカル差分（`media-owner-decision-1`）。素材範囲SHA-256は `aa5443bdc39a770d07a4cf61af5b857ea9be9df4aab85bc1e933494c3fd04f41`。GOSATの製作者判断、生成素材の制作元表記、未使用JAXA PNGの削除と、これらに対応する公開前チェックが対象。画面コード・数値データ・音源・既存ZIP・本番配信は変更していない。

- `npm run check`: 合格。関連する統計・データ読込・素材参照・CSP・台本・保存契約を含む既存チェックを実行。
- `npm run check:hardening`: 合格。
- `node scripts/check-release-rights-gate.mjs`: 合成fixtureで21ケース合格。製作者判断による保留解除、別項目を勝手に解除しないこと、古いhash・判断記録不足の拒否、削除画像の再混入・台帳への残存・範囲外の除外指定の拒否を確認。
- `npm run check:release-rights`: 292メディア・GBIF62記録・193依存エントリの整合性は合格。GOSAT・生成素材・削除済みJAXA PNGは保留対象から外れた。UNESCO・GBIFの最終帰属確認・その他データ/ソフトウェアの3項目は今回一括承認していないため、全体の終了コードは1。
- `node scripts/check-media-publication-browser.mjs`: 合格。`artifacts/media-publication/report.json` に記録。削除画像の実HTTP 404、使用中のMODIS/VIIRS画像とCO₂表示用JSONのHTTP 200を確認。素材台帳の整理、OpenAI Imagegen/Suno AIの表記、NASA画像・ローカル合成音の制作元維持も検査。
- Chrome `152.0.7977.76` の1440×900・390×844で、「積み重なるCO₂」と「森と水のつながり」を切替操作。タイトル演出終了後の4画面を撮影し目視確認。CO₂色分布・格子、森林画像・降水量マーカーが表示され、森林画像の表示完了状態も確認。ページ例外0、ローカル素材404は0、削除画像への画面からの要求0。
- 初回の新規ブラウザ試験は旧展示名を待ってタイムアウトした。現在の表示名に試験を合わせ、再実行して合格。切替演出中の画像は最終表示の証拠にせず、演出終了後に再撮影した。
- `git diff --check`: 合格。

ブラウザ試験はローカル静的配信で、外部ネットワークを遮断した。390幅はデスクトップChromeの表示幅であり、実スマートフォンや本番配信の確認ではない。新しい配布ZIP・push・デプロイは行っていない。削除画像はGit履歴から復元可能。

### 追補: 世界遺産24地点の利用継続

製作者が現行利用の継続を了承したため、`docs/UNESCO_OWNER_DECISION_2026-09-07.md` と権利台帳に記録し、UNESCO項目の公開保留を解除した。画面・データ・テストコードは今回変更していない。対象素材hashは上記と同じ。

- `node scripts/check-release-rights.mjs --validate` と公開ゲートの21ケースは合格。UNESCOも製作者判断として受理され、未解決項目はGBIFの最終帰属確認・その他データ/ソフトウェアの2項目。
- `node scripts/check-ecologies-reading-browser.mjs http://127.0.0.1:4447 artifacts/unesco-owner-decision 1440,390` を実行。1440幅は国の比較、散布図、世界遺産24例のタブ表示・場所選択、再生と展示終了まで合格。`1440-culture.jpg` を目視し、MAP 12「街と森、そのあいだ」の「03 文化・記憶」で紫の菱形と場所カードを確認した。
- 同コマンドの390幅は、文化タブへ進む前の既存の比較棒表示比率チェック（数値と実幅の差0.1未満）で失敗した。全幅の試験を合格とは扱わない。今回の世界遺産利用判断・文書変更に画面コードの変更はなく、この比較棒検査の原因調査・修正は本追補の対象外。失敗を含む結果は `artifacts/unesco-owner-decision/report.json` に保持する。

本番配信、push、デプロイは行っていない。
