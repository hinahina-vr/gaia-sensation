# 後半全面改稿 handoff / step ID移行表

## 対象と不変条件

- 基準親: `bf349318a08190ccd3ad26d3d8e3894632edd248`
- 対象: `festival_build` から `return_to_start` までの12scene
- scene IDは全件維持する。
- 旧471stepを新297stepへ再採番する。
- interaction kindは `gx` / `map03` / `abstract07` / `map08` / `space10` のまま維持する。
- `editorial_choice` の値は `SOURCE_RECORD` / `DISCLOSE_DERIVATION` のまま維持する。
- `reflection_choice` はR01〜R36、最大3件、未選択可を維持する。
- 正式な出典・クレジットと `ARCHIVES` は変更しない。

この表の「移行先」が範囲の場合、現在stepは範囲の先頭へ移す。`readStepIds` は番号の一致だけで流用せず、旧scene到達済みを保持したうえで、新scene内の現在位置より前を既読として再構成する。削除した説明stepをバックログへ復活させない。

## scene別step数

| scene | 旧 | 新 | 差分 |
|---|---:|---:|---:|
| festival_build | 32 | 18 | -14 |
| gx_deep_time | 58 | 26 | -32 |
| mode03_map | 33 | 20 | -13 |
| mode07_abstract | 124 | 54 | -70 |
| interlude_sea | 76 | 67 | -9 |
| mode08_map_layers | 34 | 19 | -15 |
| mode10_space | 38 | 18 | -20 |
| choice_editorial | 15 | 7 | -8 |
| epilogue_reflection_field | 6 | 2 | -4 |
| choice_reflection | 4 | 3 | -1 |
| final_record | 50 | 27 | -23 |
| return_to_start | 1 | 36 | +35 |
| 合計 | 471 | 297 | -174 |

## 完全範囲移行表

全旧stepは、次の重複しない範囲のいずれかに含まれる。

| scene | 旧step範囲 | 新step範囲／移行先 | 意味 |
|---|---|---|---|
| festival_build | 001–015 | 001–008 | 現在の展示ブース、二人の姿、三人の作者名 |
| festival_build | 016–022 | 009–011 | 三人が確認した版と二人の会場変更 |
| festival_build | 023–026 | 012–015 | 年越し十一秒と二人の反応 |
| festival_build | 027–032 | 016–018 | 青りんご、太古の海、GX開始 |
| gx_deep_time | 001–011 | 001–002 | 1文の操作説明とGX interaction |
| gx_deep_time | 012–024 | 003–005 | 太古の海と長い時間軸を開く |
| gx_deep_time | 025–043 | 006–015 | 水面、生命活動、海と大気の変化 |
| gx_deep_time | 044–053 | 016–021 | 三人の制作録音と「点、増やしすぎないで」 |
| gx_deep_time | 054–058 | 022–026 | 現在へ戻り、結果から意図を決めない |
| mode03_map | 001–014 | 001–002 | 1文の操作説明とMODE03 interaction |
| mode03_map | 015–017 | 003–006 | 森と雨の重なりと断定の制限 |
| mode03_map | 018–023 | 007–011 | 削除文、三人の修正文、修正者 |
| mode03_map | 024–029 | 012–017 | 02:13完成作業と02:14未完文の分離 |
| mode03_map | 030–033 | 018–020 | 現在の展示端末前と時刻確認への接続 |
| mode07_abstract | 001–010 | 001–002 | 1文の操作説明とMODE07 interaction |
| mode07_abstract | 011–023 | 003–008 | 発生・到着・開封、02:14と10:27 |
| mode07_abstract | 024–032 | 009–016 | 公開前夜18:00、22:00、23:00 |
| mode07_abstract | 033–059 | 017–027 | 本人文、生成文、生成・選定責任 |
| mode07_abstract | 060–065 | 028–030 | 離れて読むと一続きに見える問題 |
| mode07_abstract | 066–081 | 031–038 | 作者境界をめぐる最初の衝突 |
| mode07_abstract | 082–115 | 039–050 | 待つ恐れ、本人境界、二人の責任 |
| mode07_abstract | 116–124 | 051–054 | 作業停止と海へ出る判断 |
| interlude_sea | 001–014 | 001–012 | 23:20退出から23:31の海まで |
| interlude_sea | 015–030 | 013–027 | 十二分の休憩、青りんご、沈黙 |
| interlude_sea | 031–053 | 028–044 | 謝罪、本人文を完成させない決定、面談希望 |
| interlude_sea | 054–058 | 045–048 | 海の写真、23:58共同作業室へ戻る |
| interlude_sea | 059–070 | 049–066 | 生成文を移し、既存案件へ面談希望、00:26受付控え |
| interlude_sea | 071–076 | 066–067 | 受付番号を保存し公開前夜を閉じる |
| mode08_map_layers | 001–013 | 001–002 | 1文の操作説明とMODE08 interaction |
| mode08_map_layers | 014–020 | 003–008 | 現在復帰、三層と空欄 |
| mode08_map_layers | 021–031 | 009–017 | 未選択でも進む試作と前夜受付控え |
| mode08_map_layers | 032–034 | 018–019 | 地球表示へ接続し、行動と返答を分離 |
| mode10_space | 001–008 | 001–002 | 1文の操作説明とMODE10 interaction |
| mode10_space | 009–019 | 003–004 | 四地点を開き、一つの点数へまとめない |
| mode10_space | 020–027 | 005–008 | 年越し十一秒と現在の会場音 |
| mode10_space | 028–035 | 009–014 | 02:14本人文とミズハ生成文 |
| mode10_space | 036–038 | 015–018 | 公開版を変えず表示方法だけ選ぶ |
| choice_editorial | 001–003 | 001–002 | 1文の説明と `editorial_choice` |
| choice_editorial | 004–006 | 003–004 | 本人から届いた文だけを表示 |
| choice_editorial | 007–010 | 005–006 | 本人文と生成文を作者別に表示 |
| choice_editorial | 011–015 | 007 | セッション表示だけを変える |
| epilogue_reflection_field | 001–006 | 001–002 | 最大3件／未選択可、現在事実は変えない |
| choice_reflection | 001 | 001 | 短い選択説明 |
| choice_reflection | 002–003 | 002 | `reflection_choice` とR01〜R36 |
| choice_reflection | 004 | 003 | 選択／未選択から最終表示へ進む |
| final_record | 001–007 | 001–003 | 選択結果の短い実演 |
| final_record | 008–016 | 002–003 | 旧4分類の逐語説明を廃止し、実際の光だけ表示 |
| final_record | 017–022 | 004–007 | 現在の展示ホールへ音と二人を戻す |
| final_record | 023–041 | 008 | 旧退席導線を廃止し15:52公式連絡へ進む |
| final_record | 042–049 | return_to_start_001 | 旧次来場者START循環を廃止し15:55展示休止へ進む |
| final_record | 050 | final_record_001 | 結果stepは新しい結果stepへ移す |
| return_to_start | 001 | return_to_start_001 | 旧START ENDを展示休止sceneの先頭へ移す |

## 新規CURRENT境界

| scene / step | 時刻 | 場所 | 内容 |
|---|---|---|---|
| final_record_008 | 15:52 | 展示ブース | 前夜の面談希望と当日の本人同意に基づく大学の公式連絡 |
| final_record_017 | 15:54 | 展示ブース | saku既存アカウントからの現在音声 |
| return_to_start_001 | 15:55 | 展示ブース | 展示を一時休止する |
| return_to_start_018 | 16:00 | 中央入口 | サクヤ本人を物理視認する |
| return_to_start_032 | 16:03 | 中央入口 | 数歩の距離で私的な会話を始める |
| return_to_start_036 | 16:03 | 中央入口 | 唯一のEND |

公開前夜は `interlude_sea_059` が00:26の受付控え。`mode08_map_layers_012`〜`014`はその控えを見るだけで、CURRENTから新規送信しない。

## 保存移行の条件（60向け）

- `storyVersion`を更新する実装工程では、本表をcurrent `stepId`のalias入力にする。同名IDでも本文の意味が変わったため、後半sceneでは数値一致を優先しない。
- `reachedSceneIds`、`viewed`、`observationOrder`、`editorialChoice`、`reflectionIds`、`resultTone`、音量、既読sceneは保持する。
- `editorialChoice`、R01〜R36、最大3件、未選択、結果4系統の内部値は変換しない。
- 旧 `final_record_042` 以後、または旧 `return_to_start_001` で保存された進行は、`return_to_start_001` の展示休止へ移す。クリア済みであっても、旧START循環を復元しない。
- 新しい唯一の完了点は `return_to_start_036`。15:55をENDとして扱わない。

## 演出・背景・端末cueへの影響（20 / 35 / 60向け）

- `festival_build_001`〜`final_record_027`は展示ブース／展示端末前を基準にする。ただしMODE07からinterludeは承認済みの公開前夜RECORD背景を使う。
- `final_record_008`〜`027`は展示ブース。15:54は運営用スマートフォンの音声着信だが、学内チャット投稿UIではない。
- `return_to_start_001`〜`017`は展示ブース。主人公の行動と観察はここで終了する。
- `return_to_start_018`表示前に中央入口へ切り替え、`036`まで中央入口を維持する。
- 16:00以後は作品の語り／カメラ視点。主人公の大型立ち絵、追跡、私的会話のLOG化を追加しない。
- サクヤは16:00にカメラを構えず、三人は数歩の距離を残す。即時の抱擁、和解、制作復帰のcueを付けない。
