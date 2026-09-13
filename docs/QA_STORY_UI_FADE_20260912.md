# オープニング後のUIフェード

ローカル版、未公開。novel-mode.js / novel-mode.css。
オープニングから本編への引き渡しでUIを1800msかけて表示し、完了後にstartNewSessionを実行。フェード中はレイヤーをinertにし、本文進行を開始しない。動きを減らす設定では待ち時間0。

Chrome1440×900、390×900でGaiaNovel.openのprologueReveal経路を直接実行。途中のopacity増加、途中の本文空文字、完了後の本文開始を確認して合格。node --check合格。
動画オープニングそのものはこの試験では再生せず、コールバックを代替。実オープニング全長、保存読込の通し試験は未実施。証跡artifacts/story-ui-fade-*.png。
