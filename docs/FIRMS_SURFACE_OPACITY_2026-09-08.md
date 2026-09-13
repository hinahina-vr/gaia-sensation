# 火災観測パネルの背景80%統一

## 対象と変更

- 依頼画像の「保存観測を表示・ライブ未接続」「最大 火災放射パワー」「時系列を再生」を含む `.gaia-firms-readout` が対象。
- 元の外側背景は `panel-surfaces.css` により既にアルファ0.8。実ブラウザで、状態欄 `.gaia-realtime-status` に別の半透明グラデーション（最大約0.125）が重なることを確認した。状態欄だけ合成不透明度が最大約82.5%になる。
- `realtime-exhibits.css` で火災観測パネル内の状態欄の背景だけを透明化し、外側の80%背景を一枚で共有する。文字・数値・バッジ・再生ボタンの濃さ、配置、ぼかしは変更しない。他の展示の状態欄にも波及させない。
- `gaia-mode-loader.js` と `index.html` の読み込み版に `firms-surface-80-1` を追加。既存の未公開の顔と文字の重なり修正は保持した。

## 検証対象

- 基点コミット: `fc510bf5a84517788e8227e3757634cab5f9e171` に上記ローカル変更を加えた作業ツリー。
- 実際に読み込んだCSS・HTML・ローダーのSHA-256は `artifacts/firms-surface-opacity/after/report.json` に記録。
- ローカルChrome、PC表示とスマホの画面・タッチエミュレーション。保存データと合成したライブ応答を利用。実機、実プロバイダー、本番サイトでの変更後確認ではない。

## 合格した検証

```powershell
node scripts/check-firms-surface-opacity-browser.mjs http://127.0.0.1:4447 --before
node scripts/check-firms-surface-opacity-browser.mjs http://127.0.0.1:4447
npm run check:realtime-exhibits
$env:REALTIME_SIZES='390x844,1440x900'
node scripts/check-realtime-exhibits-browser.mjs http://127.0.0.1:4447 artifacts/firms-surface-opacity/related-realtime
node --check gaia-mode-loader.js
node --check scripts/check-firms-surface-opacity-browser.mjs
git diff --check
```

- 修正前再現: 628×844の保存表示で追加の状態欄背景を確認。`--before` は今回の一行だけを取り除いたCSSをブラウザへ返す。
- 修正後6条件: 保存表示を628×844、390×844、320×568、844×390、1440×900で確認。ライブ表示を390×844で確認。
- 外側グラデーションの両端が0.8、別の下地色が透明、状態欄の追加背景がないことを実ブラウザの計算済みスタイルで確認。
- パネルと表示中の子要素のopacityは1。パネルが画面内に収まり、ボタンとスライダーの実際のクリック位置が遮られないことを確認。
- 再生停止、キーボードによる時刻送り、再生再開、再停止、別展示への移動と復帰を確認。再生ボタンの表示は次の描画フレームで更新されるため、テストも実際の表示更新を待つ。
- 修正前後のパネル画像、狭いスマホ、横向き、PC、ライブ表示のスクリーンショットを目視確認。実行時JavaScriptエラー0件。
- 関連する既存テストも390×844と1440×900で合格。MAP 01〜05の状態・観測日時・凡例、保存／サンプル／遅延の表示、およびMAP 06がリアルタイム表示にならないことを確認した。証跡は `artifacts/firms-surface-opacity/related-realtime/report.json`。

## 公開状態・対象外

push・デプロイは行っていない。新しい配布ZIPは作成していない。変更後の実機・本番確認は未実施。
