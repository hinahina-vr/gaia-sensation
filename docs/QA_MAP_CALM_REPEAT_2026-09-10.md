# 観測マップの落ち着いたタイトル・毎回案内・余白解消

## 依頼と対応

原文: 「http://127.0.0.1:4492/#world の一番最初にでてくるスプラッシュっぽいタイトル、ダサいのでもっと落ち着いた感じにして　あと初回だけじゃなくて毎回出して　添付のやつも毎回出して余白があるんでちゃんとImagegenで余白でないようにして」。添付は「みずとあめがご案内！ / 3つの楽しみ方」のヘッダー。

実装上の解釈: 「毎回」は観測マップへの入場・再読み込み・いったん出て戻る操作。マップ内で展示を切り替えるたびに遮る動作にはしない。センサーの初回案内、物語中のマップ、出典・統計の直接表示条件は維持。

- 最初のタイトルから光る円、斜めの光線、きらめき、文字の発光、移動・拡大を除去。暗い無地に控えめな文字、900msの不透明度フェード。自動遷移は2.4秒後、退出フェード340ms。スキップ・キーボード・動きを減らす設定を維持。
- マップ登録に `repeatEveryEntry: true` を設定。現行v5の既読フラグが保存されていてもタイトル→案内を表示。重複表示防止、終了タイマーの無効化、デモの一時停止を維持。「初回のご案内です」はマップのみ毎回案内の文面へ変更。
- 組み込みImagegenで既存の3枚をそれぞれ再構成。2:1、1774×887、人物と地球・時間・観察のモチーフを近い構図で四辺まで描画。新しいv2 WebPを参照し、画像枠も2:1にして `object-fit: cover`。元画像は保持。固定高さの画像枠と `contain` の比率不一致による上下の帯も解消。
- 小画面・低いウィンドウは本文内部をスクロールでき、閉じる・操作ガイド・開始ボタンは固定。ローダー、CSS、JSのキャッシュ識別子を更新。

## 対象版

ローカル作業ツリー（既存の未公開変更を保持）、基準HEAD `cdc82c8ffd4fee607bd2d838ec3157b7095952d3`、キャッシュ識別子 `calm-repeat-20260910`。

対象: `app.js`、`mode-entry-guide.js`、`mode-feature-intro.css`、`gaia-mode-loader.js`、`index.html`、`sensors/index.html`、新規 `assets/modes/guide-map-{live,time,discovery}-mizu-ame-v2.webp`。回帰スクリプト・npmコマンド・画像来歴・素材権利台帳も更新。素材の保存先と最終プロンプト全文は [Imagegen制作記録](MAP_GUIDE_IMAGEGEN_2026-09-10.md)。

## 再現と最終試験

実際のローカルChromeでDOM・画像デコード・画面・クリック・キー操作を検証。1440×900、3840×2160、1024×768、390×844、320×568（動きを減らす）、844×390を使用。スマホはタッチ・画面サイズのエミュレーション。

| 試験 | 結果 | 証跡（artifacts/map-calm-repeat-2026-09-10 内） |
|---|---|---|
| 修正前再現 | 2件合格: 旧タイトル、画像上下の帯、再読込で案内が出ない症状を記録 | before/report.json、1440-first-features.png、second-visit-missing.png |
| 毎回表示・新画像・配置 | 16件合格: 6画面の初回と再読込、PC/スマホのトップ→再入場と展示66の直接URL。展示66は案内中も維持 | after/report.json、各タイトル・案内・小画面の3画像スクロール画面 |
| 遷移・操作 | 5画面合格: タイトル→案内が重ならずフェード、Tabループ、スキップ、実UIから再表示、途中Escape、リサイズ、操作ガイド、二重close、タイマーで復活しない | lifecycle/report.json |
| デモとの関係 | PC/スマホ2画面合格: 現行既読フラグでも自動表示、7ステップ・戻る・次へ、80秒進めても案内中は展示固定、終了後に次の展示へ、内部切替で案内は出ない、手動停止を維持、再入場で再案内 | demo-regression/report.json |
| センサー影響 | 4件合格: PC/スマホのトップからセンサーへ入場・画像表示・ガイド・閉じる・再読込で初回限定を維持、ログイン/機器画面への入場先を維持 | sensor-regression/report.json |
| 静的・素材検査 | JS構文、25秒デモ単体試験、素材台帳317件、標準Git改行設定でdiff --check合格 | source/conversion-report.json、docs/media-rights-ledger.json |

最終ブラウザ試験後に主要ランタイム5ファイル、およびsensor-regression記録内の全ランタイム・画像のSHA-256が現物と一致することを再確認。新規画像3枚は変換記録のSHA-256と現物が一致。1440、4K、390、320、横画面の実スクリーンショットを目視確認し、画像内の帯がないこと、本文と固定ボタンの配置を確認。

最初の修正後試験では再入場時に残ったマウスポインターで画像のホバー拡大が発生し、画像と枠の視覚矩形の「完全一致」を要求した測定が失敗した。意図したホバーは維持し、画像のレイアウト寸法=枠の寸法、2:1比率、表示画像が枠を覆う条件で再検証して16件合格。旧失敗記録は after/attempt1-hover-measurement.json に保持。

古い回帰試験にあったマップの「同一セッションで一度だけ」という期待値も更新。センサーだけ初回限定を検証し続ける。

## 再実行

```powershell
npm run check:map-calm-repeat:browser
node scripts/check-map-entry-title-browser.mjs http://127.0.0.1:4492 artifacts/map-calm-repeat-2026-09-10/lifecycle after
$env:GAIA_DEMO_WIDTHS = '1440,390'
node scripts/check-map-guide-demo-browser.mjs http://127.0.0.1:4492 artifacts/map-calm-repeat-2026-09-10/demo-regression
$env:GAIA_FEATURE_MODES = 'sensor'
$env:GAIA_FEATURE_SIZES = '1440x900,390x844'
$env:GAIA_FEATURE_OUTPUT = 'artifacts/map-calm-repeat-2026-09-10/sensor-regression'
node scripts/check-feature-intro-browser.mjs http://127.0.0.1:4492
node scripts/check-map-demo.mjs
npm run check:rights
```

## 確認範囲・残件

今回の3要件はローカル実装・検証完了。push・デプロイ・公開は未実施（今回の公開指示なし）。ZIP等の配布物は今回作成していない。案内は既読状態の保存と再読込を検証し、データ保存・書出し処理そのものは変更していない。

マップ試験はNOAA/FIRMS保存データと空のUSGS応答、センサー試験はローカルAPI応答を使用。実配信・実センサー・ログインアカウントの検証ではない。新規表示試験には本番CSPを適用し違反なし。実機スマホ、Safari/Firefox、スクリーンリーダー、本番反映は未確認。既存の物語プロローグ・展示66–71・記録ドック等のローカル成果は維持し、これら全機能の再試験を行ったとは扱わない。
