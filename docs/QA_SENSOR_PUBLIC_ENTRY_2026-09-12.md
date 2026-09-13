# みんなのセンサー公開入口

- カードの既存 href は sensors/#map。セッション照会の401以外の失敗時にログインへ強制移動していたため、現在のハッシュに従って公開画面を保持するよう修正。
- 画面上部の「みんなのセンサー」は維持し、下のh1は「みんなでつくる観測地図」に変更。
- check-sensor-public-entry-browser.mjs: Chrome headless PC1440 / mobile390、タイトル→データ探索→センサーカードの実クリック経路を確認。セッション401/503を模擬し、map表示・login非表示を確認。APIの本番試験ではない。
- 証跡 artifacts/sensor-public-entry-20260912。ローカル未コミット・未公開。
