# 大学の使命と作品の物語 — concept-12

2026-09-08のフィードバックに対応したローカル編集。push・デプロイはしていません。

## 編集方針

「個人の実感」を中心とした紹介を改め、地球の観測、分野を越える学び、離れた学生の共同制作、生命・環境・技術と文明の未来を軸にしました。

大学の使命 → リベラルアーツ／オンライン大学と学園祭／卒業プロジェクトの制度 → 本編の物語 → 参照授業 → 作者の制作上の位置づけ、という順序で説明します。大学の制度と作者の解釈、実在の大学祭とフィクションを分けています。将来のAI構想はその後に置き、本編に選択肢・ルート分岐・生成AIによる物語生成が実装されているとは説明しません。

本文の「お前」「大奥」を削除し、「あなた」「複数のAI」に変更。画像内のラベルも編集しました。過去の素材・制作記録は履歴として保持しています。

## シナリオとの照合

`story/README.md` と `scripts/export-current-story-script.mjs` を確認し、実装と同期した `story/現行統合台本.md` の本編6シーン380ステップ、スタッフロール、後日譚3シーン164メッセージを通読しました。旧版の長い統合台本は現行の根拠にしていません。

- `festival_concept_new_001`：オンライン大学の学園祭が学生の発表と交流の場になる。
- `map_mode01_025`〜`031`：出典・単位・基準期間や、観測と予測を区別する。
- `esp32_pitch_016b`〜`016h`：個人センサーと公的観測を区別し、精度や場所・時刻・校正を検討する。
- `circle_invitation_030`・`031`、`068`・`069`・`072`：得意分野や居場所の違う学生が協働する。
- `welcome_chat_new_014`・`015`と結末：数字の把握だけで終わらず、他者とつくる活動へ進む。
- 後日譚：生命と地球の相互作用、複数の歴史的経路、人間・環境・技術の関係へ視野が広がる。

現行本編の `choice`／`choices`／`options` は0件。地図・可視化を操作するステップを、物語の選択分岐と混同しないよう静的回帰テストも追加しました。シナリオ本体は変更していません。

## 公式の参照先

以下を2026-09-08に調べ、ページ内の該当説明の近くにリンクしました。概要は短く言い換えています。

- [教育理念・教育目的](https://sites.google.com/zen.ac.jp/zen-gakuseibinran/about/education_mission?authuser=0)：幅広い学習者への高等教育の機会、学ぶ条件への配慮、情報社会における実践。
- [3つのポリシー](https://sites.google.com/zen.ac.jp/zen-gakuseibinran/about/3policies?authuser=0)：情報技術、世界を理解し自ら考える力、学際的な課題解決、必修の卒業プロジェクト。
- [知能情報社会学部](https://zen.ac.jp/faculty)：6分野を横断する学び。リベラルアーツとの結びつけは本作の解釈として記述。
- [展軸祭](https://zen.ac.jp/university_festival/)：2026年の学生主体の大学祭、リアル会場とオンライン。作中の会場や人物と同一視しない。
- [プロジェクト実践・2028年度](https://syllabus.zen.ac.jp/subjects/2028/PRJ-4-A3-1234-001)：4年次必修。学んだ知を統合し、実社会の課題に対話と検証を通して取り組む。リンクに年度を明記。
- [共創地球論・2026年度](https://syllabus.zen.ac.jp/subjects/2026/SOC-1-C1-0204-004)
- [人新世の人類学・2026年度](https://syllabus.zen.ac.jp/subjects/2026/HUM-2-C1-1030-003)
- [リテラシーと応用のための物語理論・2026年度](https://syllabus.zen.ac.jp/subjects/2026/HUM-1-C1-1030-002)
- [統計学入門・2026年度](https://syllabus.zen.ac.jp/subjects/2026/INF-1-C1-1030-007)

最後の4科目名は本編スタッフロールと一致させています。

## 画像編集と最終プロンプト

- 使用：組み込みImageGenの編集。CLI/APIフォールバックは未使用。
- 編集対象：`assets/concept/myth-agency-loop-v1.png`。事前に画像を目視。
- 採用先：`assets/concept/myth-agency-loop-v2.png`（1086 × 1448 PNG）。生成結果をそのままコピーし、旧画像を残しました。
- 生成元：`E:/CodexData/home/generated_images/01a067a6-1244-7f52-9325-1463844bcacb/exec-a3d84bd0-ebe8-4ed6-9f78-b538879e11d0.png`。
- 確認：「記録」「いくつもの私」「神託」「選ぶのはあなた」が読めること、構図・人物・循環の矢印が保たれていること、全体をクロップせず本文・拡大ビューに表示すること。厳密なピクセル不変編集を保証するものではありません。

最終プロンプト：

```text
Use case: text-localization
Asset type: existing Japanese concept-page infographic, portrait raster illustration
Input image 1 is the edit target.
Primary request: Change only the bottom gold Japanese label from "選ぶのはお前" to exactly "選ぶのはあなた". Preserve the other labels exactly: "記録", "いくつもの私", "神託".
Constraints: Keep the existing portrait composition, all characters and poses, archive imagery, multiple open doors, purple return-loop arrows, colors, starfield, gold lighting, line quality and illustration style unchanged. Match the current gold Mincho-style label typography, making a small size adjustment only if necessary to fit the longer replacement in the same bottom-right text area. Do not add any new text or any reference to 大奥. The viewer should see a respectful invitation, not a command. Do not crop or reframe. Return one edited image.
```

検証記録は `docs/QA_CONCEPT_ZEN_BACKGROUND_2026-09-08.md` を参照。
