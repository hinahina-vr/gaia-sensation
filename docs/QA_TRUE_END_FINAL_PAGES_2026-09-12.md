# トゥルーエンド終幕・観測データ追加

- ローカル作業版。beyond_03_053 の問いかけと beyond_03_add_049 の最後の一文を、それぞれ単独ページ化。本文・ID・承認原稿を維持する可逆のページ指定。
- 終幕の上記2ステップ、およびその後の終了画面からLOGボタンを除去。途中の読書用LOGは維持。
- Chrome headless、1440 / 390px: 全164メッセージのページ送り、本文保持、はみ出し、単独ページ、終幕LOG除去を check-story-reading-breaks-browser.mjs で検証。スマホはエミュレーション。
- 静的検証: check-story-reading-breaks.mjs、check-story-log-followup.mjs、build-true-end-story.mjs --check 合格。
- 観測データ: 気象庁 / 総務省 ほか。台本書き出しにも反映。check-ending-data-skip-browser.mjs が2画面幅で合格。
- 全スタッフロール演出試験は初回noise burst、再試行thank-you holdのタイミング検査で失敗。総務省の追加表示・スキップ経路は上記の焦点を絞った試験で合格したが、全演出タイミング試験の合格は主張しない。
- 証跡: artifacts/true-end-final-pages-20260912、artifacts/credits-mic-focused-20260912。
- 未公開。本番反映・実機スマホは未確認。
