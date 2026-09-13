(() => {
  'use strict';
  const i18n = window.GaiaI18n;
  if (!i18n) return;
  // Whole logical passages, never reordered Japanese phrase fragments.
  // The original nodes (including editorial breaks and emphasis) return in Japanese.
  const groups = [
  [
    "#page-title",
    "『惑星の放課後』とは",
    "About Planet After School",
    "关于《行星的放学时光》"
  ],
  [
    "#overview-story",
    "オンライン大学の学生たちが、サークル「惑星の放課後」に集い、地球の観測と展示に取り組む物語。",
    "A story about online university students who come together in the Planet After School club to observe the Earth and create an exhibition.",
    "这是一段关于在线大学的学生们相聚于“行星的放学时光”社团，共同开展地球观测与展览的故事。"
  ],
  [
    "#overview-system",
    "地球環境のオープンデータを可視化する観測システムと、海辺の展示ブースから始まる出会いを描いた展示参加型ビジュアルノベルです。",
    "An exhibition-based visual novel combining a system that visualizes open environmental data with the story of an encounter at a seaside exhibition booth.",
    "这是一部可参与展览的视觉小说，将地球环境开放数据可视化的观测系统，与海边展位上邂逅的故事相结合。"
  ],
  [
    "#learning-title",
    "ZEN大学の講義から、惑星の放課後へ。",
    "From ZEN University lectures\nto Planet After School.",
    "从ZEN大学的课堂，\n走向行星的放学时光。"
  ],
  [
    ".university-story h3",
    "惑星の片隅、私たちが立っているここから。",
    "From where we stand,\nin one small corner of this planet.",
    "从行星的一角，\n从我们此刻站立的地方出发。"
  ],
  [
    ".project-note strong",
    "この作品の位置づけ",
    "Where this project stands",
    "本作品的定位"
  ],
  [
    ".project-note-copy p",
    "『惑星の放課後』は、ZEN大学の卒業プロジェクトを見据えて制作するコンセプトモデルです。講義で受け取った問いを、地球の観測、データを扱う技術、世界を語る物語として、ひとつの作品へ結びつけています。",
    "Planet After School is a concept model being developed with a ZEN University graduation project in mind. It brings questions raised in lectures together in one work: observing Earth, working with data, and telling stories about the world.",
    "《行星的放学时光》是以ZEN大学毕业项目为目标制作的概念模型。作品将课堂上提出的问题，以地球观测、数据技术和讲述世界的故事，融汇为一个整体。"
  ],
  [
    "#surface-title",
    "世界を知り、どんな未来をつくるのか。",
    "Knowing the world,\nwhat future will we create?",
    "了解世界之后，\n我们要创造怎样的未来？"
  ],
  [
    ".depth-question",
    "提示されるのは選択肢。決めるのは、私自身。",
    "What it offers are possibilities.\nThe decision is mine.",
    "它提供的是选择。\n决定的人，是我自己。"
  ],
  [
    ".depth-description:nth-of-type(4)",
    "すべてがデータ化され、過去から割り出された「最適解」が未来を先回りしていく時代。",
    "In an age when everything becomes data, “optimal answers” derived from the past arrive ahead of the future.",
    "在万物被数据化的时代，从过去推算出的“最优解”正抢先为未来作出安排。"
  ],
  [
    ".depth-description:nth-of-type(5)",
    "神話製作機械は、決定論的で予定調和なデータの輪廻の環から抜け出し、主体性を取り戻すための試みです。",
    "The Myth-Making Machine is an attempt to escape the predetermined cycle of data and reclaim our own agency.",
    "神话制造机器试图跳出数据那决定论式、预定和谐的轮回，让人重新取回主体性。"
  ],
  [
    ".depth-description:nth-of-type(6)",
    "確実な未来を消費するのではなく、不確実な世界を自らの物語へ書き換えるために。",
    "Not to consume a certain future, but to rewrite an uncertain world as a story of our own.",
    "不是消费已被确定的未来，而是将不确定的世界，改写成自己的故事。"
  ],
  [
    ".depth-manifesto",
    "その応答を、ここでは「神託」と呼びます。従う必要はない。選ぶのは本人です。",
    "Here, we call its response an “oracle.”\nThere is no obligation to follow it. The choice remains with the person.",
    "在这里，我们将它的回应称为“神谕”。\n不必服从。选择权始终属于本人。"
  ],
  [
    "#mechanism-title",
    "神話製作機械の原風景（初期ノート）",
    "The origins of the Myth-Making Machine\n(Early notes)",
    "神话制造机器的原初构想\n（早期笔记）"
  ],
  [
    ".vision-step:nth-child(1) p",
    "プロフィールや日々の行動、生体データ、会話、さらには思考の断片まで、あらゆる「自分の痕跡」と「システムとの対話ログ」を記録する場所です。",
    "A place to record every trace of yourself and every exchange with the system: your profile, daily actions, biological data, conversations, and even fragments of thought.",
    "记录所有“自我的痕迹”和“与系统的对话日志”的地方，包括个人资料、日常行为、生物数据、对话，甚至思想的片段。"
  ],
  [
    ".vision-step:nth-child(2) p",
    "完全自己情報をもとに、さまざまな角度から深い洞察を引き出します。その分析結果もふたたび記録し、私（原型）の観察と更新を続けます。",
    "Drawing on the complete self-record, these intelligences develop insights from many angles. Their analyses are recorded in turn, continuing to observe and update their understanding of me—the original self.",
    "深层智能群以完整自我信息为基础，从不同角度提炼洞见。分析结果也会被再次记录，持续观察并更新对我（原型）的理解。"
  ],
  [
    ".vision-step:nth-child(3) p",
    "深層知性群が出した分析を、「もし別の自分ならどう捉えるか？」という複数の視点から読み直します。ひとつの人格に縛られず、いくつもの「自分自身の視座」から状況を見つめ直します。",
    "These selves revisit the analyses by asking, “How would another version of me see this?” Rather than being bound to a single personality, they reconsider the situation through many perspectives of the self.",
    "多元自我从“如果是另一个我，会怎样理解？”的不同角度，重新阅读深层智能群的分析。不局限于一种人格，而是通过多种自我视角重新审视状况。"
  ],
  [
    ".vision-step:nth-child(4) p",
    "「多元我」が考え出した様々な解釈や仮説をまとめたレポートです。世界の見方を広げるための検討資料であり、「こう行動しなさい」と指示を出すためのものではありません。",
    "Reports bringing together the interpretations and hypotheses of the plural selves. They are material for considering a wider view of the world, not instructions telling a person how to act.",
    "汇总“多元自我”提出的各种解释和假设的报告。它们是拓宽世界观的参考材料，而不是命令人“应该这样行动”的指令。"
  ],
  [
    ".vision-step:nth-child(5) p",
    "世界と因果のレポートを徹底的に読み解き、「こんな未来の分岐がありうる」という選択肢（神託）を本人へ投げ返します。考えうる可能性の極限までシミュレーションします。",
    "This architecture reads the reports on the world and causality in depth, then returns possible branches of the future to the person as options—oracles. It simulates possibilities to the furthest conceivable extent.",
    "神格架构深入解读世界与因果报告，将“未来可能出现这样的分支”作为选项（神谕）交还给本人，并将模拟推至可设想的可能性的极限。"
  ],
  [
    ".vision-step:nth-child(6) p",
    "「従うべき命令」ではなく、「自分自身で意味を考え直すための問いかけ」です。 データや正論で人を従わせず、行動を強制せず、自己決定権を留保します。",
    "Not a command to obey, but a question that invites you to reconsider meaning for yourself. It does not use data or supposedly correct answers to demand obedience or compel action. Self-determination remains yours.",
    "它不是“必须服从的命令”，而是“让自己重新思考意义的提问”。不以数据或道理迫使人服从，不强制行动，保留个人的自我决定权。"
  ],
  [
    ".agency-sting",
    "人生さえも最適解で舗装され、疑うことすら忘れた意志が、静かに消費されていく時代で。",
    "In an age when even life is paved with optimal solutions,\nand a will that has forgotten even to question is quietly consumed.",
    "在连人生都由最优解铺就、\n连质疑都已忘却的意志被悄然消耗的时代。"
  ],
  [
    ".agency-resolution",
    "人知が真に目指すべきは、人間を予測し、飼い慣らす檻の完成ではない。計算された予定調和の地平を越え、人が自らの意志をふたたび獲得するための、新たな知の循環だ。",
    "Human knowledge should not aspire to perfect a cage that predicts and tames us.\nBeyond the horizon of calculated, predetermined harmony,\nit should create a new cycle of knowledge through which people reclaim their own will.",
    "人类智慧真正应追求的，不是完成预测并驯服人类的牢笼。\n而是越过计算好的预定和谐的地平线，\n创造让人重新获得自身意志的、新的知识循环。"
  ],
  [
    ".author-colophon p:first-child",
    "作者：ひなひな｜ZEN大学 知能情報社会学部1期生。",
    "Created by Hinahina | First cohort, ZEN University Faculty of Intelligence and Informatics.",
    "作者：Hinahina｜ZEN大学智能信息社会学部首届学生。"
  ],
  [
    "[data-concept-biography]",
    "映像制作と個人サイトづくりを原点に、数理とAIを学び直しながら本作を制作。",
    "With roots in video production and personal websites, the creator is making this work while returning to the study of mathematics and AI. ",
    "作者以影像制作与个人网站创作为起点，一边重新学习数学与AI，一边制作本作品。"
  ],
  [
    ".disclaimer-sentence:nth-child(1)",
    "本作は個人による非公式作品であり、ZEN大学による制作・監修・公認を示すものではありません。",
    "This is an independent, unofficial work. It is not produced, supervised, or endorsed by ZEN University.",
    "本作品是个人制作的非官方作品，并非由ZEN大学制作、监修或认可。"
  ],
  [
    ".disclaimer-sentence:nth-child(2)",
    "大学の制度・教育方針の紹介と、本作の解釈・創作は区別しています。",
    "Descriptions of the university’s systems and educational policies are distinct from the interpretations and creative content of this work.",
    "有关大学制度和教育方针的介绍，与本作品的解读和创作内容相区分。"
  ],
  [
    ".disclaimer-sentence:nth-child(3)",
    "物語はフィクションであり、本編の登場人物・出来事は、実在の人物・団体・大学祭を描写・再現したものではありません。",
    "This story is fiction. Its characters and events do not depict or recreate real people, organizations, or university festivals.",
    "故事为虚构作品，其中的人物和事件并非对真实人物、团体或大学祭的描写或再现。"
  ]
];
  const entries = [
  [
    "『惑星の放課後』とは｜GAIA SENSATION CONCEPT BOOK",
    "About Planet After School | GAIA SENSATION CONCEPT BOOK",
    "关于《行星的放学时光》｜GAIA SENSATION CONCEPT BOOK"
  ],
  [
    "本文へ移動",
    "Skip to content",
    "跳转到正文"
  ],
  [
    "放課後のある風景",
    "Scenes from After School",
    "放学后的风景"
  ],
  [
    "作品",
    "Experience",
    "作品"
  ],
  [
    "学び",
    "Learning",
    "学习"
  ],
  [
    "深層",
    "Depth",
    "深层"
  ],
  [
    "原風景",
    "Origins",
    "原初构想"
  ],
  [
    "作品案内",
    "Project guide",
    "作品介绍"
  ],
  [
    "作品概要",
    "About the project",
    "作品概要"
  ],
  [
    "宇宙から見下ろす衛星データと、街角の日陰や部屋の机の上で測られた、ちっぽけな一点のセンサー値。冷徹な数値の集積に「人がそこにいた理由」という文脈を重ね合わせたとき、無機質なデータはこの星の確かな鼓動へと変わっていきます。",
    "Satellite data looking down from space, and one tiny sensor reading taken in a patch of shade on a street or on a desk in a room. When these cold accumulations of numbers are layered with the context of why someone was there, impersonal data begins to become the tangible heartbeat of this planet.",
    "从太空俯瞰地球的卫星数据，与街角阴影下、房间书桌上测得的一个微小传感器数值。当冰冷的数字叠加上“人为何身处那里”的背景，原本无机质的数据便逐渐化为这颗星球真切的脉搏。"
  ],
  [
    "大気や海洋の循環をその手で巡らせ、居合わせた仲間と言葉を交わす。",
    "Explore the circulation of the atmosphere and oceans with your own hands, and exchange words with the companions you meet there.",
    "亲手探索大气与海洋的循环，与恰好相遇的伙伴交谈。"
  ],
  [
    "この惑星の途方もない時間の中で、いま私たちがどこに立ち、どこへ歩き出すのかを問い直す物語です。",
    "A story that asks where we stand now, within the immense span of this planet’s time, and where we will go from here.",
    "在这颗行星漫长得难以想象的时间里，我们此刻站在哪里，又将走向何方？这是一段重新追问这些问题的故事。"
  ],
  [
    "観測の根拠を確かめ、地球の変化を読む。",
    "Check the evidence behind observations. Read the changes in our planet.",
    "核实观测的依据，读懂地球的变化。"
  ],
  [
    "地図モード「積み重なるCO₂」",
    "Map mode: Accumulating CO₂",
    "地图模式：不断累积的CO₂"
  ],
  [
    "本作の3つの体験",
    "Three ways to experience this work",
    "本作品的三种体验"
  ],
  [
    "地図・公開データの可視化",
    "Maps and open-data visualization",
    "地图与开放数据可视化"
  ],
  [
    "世界を、直視する",
    "Look directly at the world",
    "直面世界"
  ],
  [
    "CO₂濃度や気温偏差などの公開データを、地図と時間軸の上でインタラクティブに可視化。",
    "Explore public data such as CO₂ concentrations and temperature anomalies interactively on a map and timeline.",
    "在地图与时间轴上，以交互方式查看CO₂浓度、气温距平等公开数据。"
  ],
  [
    "出典や観測単位を確かめながら、季節の呼吸と半世紀に及ぶ構造的変化を読み解く。",
    "Check sources and observation units as you trace seasonal rhythms and structural changes spanning half a century.",
    "核对数据来源与观测单位，解读季节的呼吸，以及跨越半个世纪的结构性变化。"
  ],
  [
    "海流の速さと向きを感じる",
    "Feel the speed and direction of ocean currents",
    "感受海流的速度与方向"
  ],
  [
    "地球の動きを、感じる",
    "Feel the planet in motion",
    "感受地球的运动"
  ],
  [
    "大気の流れや海流の速さ・向きを動的なグラフィックとして描画。",
    "Atmospheric flows and the speed and direction of ocean currents appear as dynamic graphics.",
    "将大气流动、海流的速度与方向呈现为动态画面。"
  ],
  [
    "地域や国境を越えてすべてが連環する、地球規模の巨大な循環を感覚的に捉える。",
    "Sense the vast planetary cycles that connect everything across regions and borders.",
    "直观感受超越地域与国界、将万物相连的地球大循环。"
  ],
  [
    "ゲームで物語をたどる",
    "Follow a story through the game",
    "在游戏中走进故事"
  ],
  [
    "出会い、変わる",
    "Meet, and be changed",
    "相遇，然后改变"
  ],
  [
    "観測ツールを操作しながら読み進める、選択肢のない一本道のビジュアルノベル。",
    "A linear visual novel with no branching choices, read while interacting with observation tools.",
    "一部没有分支选项的线性视觉小说，让你在阅读时操作观测工具。"
  ],
  [
    "ただ日常を消費するのではなく、「何を調べ、どう生きるか」を思考していく。",
    "Rather than simply passing through daily life, consider what to investigate and how to live.",
    "不只是消磨日常，而是思考“要探究什么，又要怎样生活”。"
  ],
  [
    "画面の向こうで受講した講義の中で、私たちは地球の循環、冷徹なデータ、そして人間が紡いできた物語の意味に出会いました。 宇宙から見下ろす地球システムという巨大な知見を、単なる学問や知識で終わらせないこと。街角のセンサーが拾う微かな数値や、放課後のたわいもない会話といった、手の届く「個人の日常」へと接続し直す試み――それが『惑星の放課後』です。",
    "In lectures attended through a screen, we encountered Earth’s cycles, cold numerical data, and the meaning of the stories people have woven. The vast knowledge of Earth systems seen from space need not remain abstract study. Planet After School is an attempt to reconnect it with everyday life within reach: a faint reading from a street-corner sensor, or an inconsequential conversation after class.",
    "在屏幕另一端的课堂上，我们接触到了地球的循环、冰冷的数据，以及人类编织的故事的意义。从太空俯瞰地球系统的宏大知识，不应止步于学问本身。将其重新连接到触手可及的个人日常——街角传感器捕捉到的细微数值，或放学后无关紧要的闲聊——这便是《行星的放学时光》的尝试。"
  ],
  [
    "5つの講義と、物語への接続",
    "Five courses, connected to a story",
    "五门课程与故事的连接"
  ],
  [
    "本編のスタッフロールに刻んだ、5つの科目。 単なる知識の引用ではなく、何を思考の足場とし、どのような問いを物語へ持ち込んだのか。 作品の骨格を形づくった5つの視座をここに記します。",
    "Five courses are named in the story’s credits. They are more than references: they offered foundations for thought and questions to bring into the narrative. Here are the five perspectives that helped shape the work.",
    "本篇片尾记录了五门课程。它们不只是知识的引用，更构成了思考的基础，并将问题带入故事。以下是塑造本作品骨架的五种视角。"
  ],
  [
    "01 / 地球と生命",
    "01 / Earth and life",
    "01 / 地球与生命"
  ],
  [
    "共創地球論",
    "Co-creating Earth",
    "共创地球论"
  ],
  [
    "生命が環境に適応するだけでなく、生命の営みも海や大気を変えてきた。講義で扱う共進化の視点は、地球を人間の活動の「背景」として眺める見方を揺さぶります。",
    "Life does not merely adapt to its environment; living things have also changed the oceans and atmosphere. The course’s perspective of coevolution challenges the idea of Earth as a mere backdrop to human activity.",
    "生命不仅适应环境，生命的活动也改变着海洋和大气。课程中共同演化的视角，动摇了将地球仅仅视为人类活动“背景”的看法。"
  ],
  [
    "本作でCO₂や海流を動きとして描くのは、惑星を固定された舞台にしないためです。生命が海と大気を変え、新しい環境が次の生命を呼び寄せるという本編の会話を、地図上の循環と時間の変化に結びつけています。",
    "CO₂ and ocean currents are shown in motion so that the planet never becomes a fixed stage. The story’s conversation about life changing sea and sky, and new environments inviting new life, connects to circulation on the map and change over time.",
    "本作品将CO₂和海流表现为运动，是为了不把行星当成固定的舞台。本篇关于“生命改变海洋与大气，新环境又孕育下一种生命”的对话，与地图上的循环和时间变化相呼应。"
  ],
  [
    "講義のシラバス（2026年度）",
    "Course syllabus (academic year 2026)",
    "课程大纲（2026学年）"
  ],
  [
    "02 / 人間と文明",
    "02 / Humanity and civilization",
    "02 / 人类与文明"
  ],
  [
    "人新世の人類学",
    "Anthropology of the Anthropocene",
    "人类世的人类学"
  ],
  [
    "言語や数、身体、技術との関係を通じて、人間のあり方は変わってきた。講義にあるAIとの共進化やデータ至上主義への問いを、「人を何によって捉えるのか」という問題として受け取りました。",
    "What it means to be human has changed through our relationships with language, numbers, bodies, and technology. We read the course’s questions about coevolution with AI and the supremacy of data as a broader question: how do we understand a person?",
    "人类的存在方式，随着与语言、数字、身体和技术的关系而不断改变。课程关于与AI共同演化、数据至上主义的提问，被我们理解为一个问题：我们究竟凭什么来认识一个人？"
  ],
  [
    "ここから、AIが人を過去の行動や属性だけで定義してよいのか、という後半の問いにつながります。人間を予測の対象として理解することと、その人がどう生きるかを決めることは違う。技術が進むほど、選ぶ主体の置き場所を問い直したいのです。",
    "This leads to the question in the latter half of the story: may AI define a person solely by their past actions and attributes? Understanding people as subjects of prediction is different from deciding how they should live. As technology advances, we want to reconsider where the agency to choose belongs.",
    "这引出了故事后半段的问题：AI是否可以仅凭过去的行为和属性定义一个人？将人理解为预测对象，与替人决定如何生活，是两回事。技术越进步，我们越想重新追问：作出选择的主体究竟在哪里？"
  ],
  [
    "03 / 物語と批評",
    "03 / Narrative and criticism",
    "03 / 叙事与批评"
  ],
  [
    "リテラシーと応用のための物語理論",
    "Narrative Theory for Literacy and Application",
    "面向素养与应用的叙事理论"
  ],
  [
    "本作は、文章だけでなく、人物の表情、背景、音楽、台詞のあいだの「間」で物語を伝えるヴィジュアルノベルです。同じ言葉でも、誰が、どんな顔で、どの景色を前に口にするかで響きは変わる。物語理論から受け取った視点を、説明を増やすためではなく、読者が登場人物と同じ時間を過ごせるように、場面の順序や見せ方を考える手がかりにしています。",
    "This work is a visual novel told through expressions, backgrounds, music, and the pauses between lines—not words alone. The same line feels different depending on who says it, their expression, and the scene around them. Narrative theory offers a way to think about the order and presentation of scenes, not to add more explanation, but to let readers spend time alongside the characters.",
    "本作是一部视觉小说，不只用文字，也用人物的表情、背景、音乐与台词之间的停顿来讲述故事。同一句话，由谁说出、带着怎样的表情、面对怎样的风景，都会产生不同的回响。叙事理论带来的视角，不是为了增加说明，而是帮助我们安排场景的顺序与呈现方式，让读者与角色共度一段时间。"
  ],
  [
    "放課後の何気ない会話から、地球のデータに触れ、もう一度、目の前の相手との会話へ戻る。本編と展示を行き来する構成にしたのは、大きなテーマを知識として読むだけでなく、登場人物と一緒に見つける体験にしたかったからです。一本道の物語でも、読み終えたあとに気になる場所や、確かめたくなる問いは人によって違う。その続きを、自由に歩ける展示の世界へ託しています。",
    "An ordinary after-school conversation leads to Earth's data, then returns to the person in front of us. Moving between story and exhibits lets readers discover a larger theme alongside the characters instead of only reading about it. Even with a linear story, each reader may leave with a different place to explore or question to investigate. The freely explorable exhibits are where that experience can continue.",
    "从放学后的日常对话出发，接触地球的数据，再回到与眼前之人的交谈。让故事与展览相互衔接，是希望读者不只是把宏大的主题当作知识来读，而是与角色一起发现它。即使故事只有一条路线，读完后想探索的地点、想确认的问题也因人而异。这段体验的后续，就交给可以自由探索的展览世界。"
  ],
  [
    "04 / データと判断",
    "04 / Data and judgment",
    "04 / 数据与判断"
  ],
  [
    "統計学入門",
    "Introduction to Statistics",
    "统计学入门"
  ],
  [
    "確率分布、推定、検定、回帰分析。講義で扱うのは、限られた観測から何が言え、どこからは言い切れないかを考える方法です。平均やグラフの形だけで、対象全体を分かったことにはできません。",
    "Probability distributions, estimation, hypothesis tests, and regression. The course offers ways to ask what limited observations can tell us—and where certainty ends. An average or the shape of a graph alone cannot give us an understanding of the whole.",
    "概率分布、估计、检验与回归分析。课程探讨的是如何判断有限的观测能说明什么，又从哪里开始无法断言。仅凭平均值或图表的形状，并不能说我们已经理解了对象的整体。"
  ],
  [
    "数値は、何が起きたかを考える足場にはなる。でも、どう生きるべきかまでは決めてくれない。観測の根拠は確かめられるようにし、そのうえで何を大事にするかは人に残す。この区別が、作品のデータ表現と、後半のAI構想をつなぐ境目です。",
    "Numbers can offer a basis for considering what happened, but cannot decide how we ought to live. Make the evidence behind observations open to checking, then leave people to decide what matters. This distinction connects the work’s data presentation with its later vision of AI.",
    "数值可以成为思考发生了什么的基础，却不能替人决定该怎样生活。让观测的依据能够被核实，再把珍视什么的决定留给人。这一区分，连接着作品的数据表达与后半段的AI构想。"
  ],
  [
    "05 / データをつなぐ技術",
    "05 / Connecting data",
    "05 / 连接数据的技术"
  ],
  [
    "ビッグデータ分析概論",
    "Introduction to Big Data Analysis",
    "大数据分析概论"
  ],
  [
    "地球の観測データは、集めるだけではひとつの景色になりません。出典ごとに異なる形式や、地点・時刻・単位を整理し、比較できる形へつなぐ必要があります。データ基盤、モデリング、加工・集計、ガバナンスという講義の視点を、展示の裏側を支える設計に結びつけています。",
    "Earth observation data does not become a coherent picture simply by being collected. Different formats, locations, times, and units need to be organized before comparisons become meaningful. The course's perspectives on data infrastructure, modeling, processing, aggregation, and governance inform the design behind the exhibits.",
    "地球观测数据并不会仅因被收集就自动成为一幅完整的图景。不同来源的格式、地点、时间和单位，需要经过整理，才能进行有意义的比较。课程中关于数据基础设施、建模、加工、汇总与治理的视角，与展览背后的设计相连接。"
  ],
  [
    "画面に現れる光やグラフの手前には、記録を選び、整え、届ける過程があります。本作では出典や観測条件、ライブ値と保存値の違いを確認できるようにし、印象的な演出から元のデータへ戻れる入口を設けています。データの量を見せるだけでなく、その成り立ちをたどれることも、観測の体験に含めたいと考えています。",
    "Before a light or graph appears on screen, records must be selected, prepared, and delivered. The work provides ways to check sources, observation conditions, and the distinction between live and saved values, leading from the visual presentation back to its data. Observation should mean more than seeing a large quantity of data; it should also let us trace where that data came from.",
    "屏幕上的光与图表背后，有着选择、整理和传递记录的过程。本作提供了查看来源、观测条件以及实时值与保存值区别的入口，让人能够从视觉演出回到原始数据。我们希望观测体验不只是展示数据的数量，也包括追溯数据如何形成。"
  ],
  [
    "構想へ",
    "Explore the concept",
    "走进构想"
  ],
  [
    "神話製作機械",
    "The Myth-Making Machine",
    "神话制造机器"
  ],
  [
    "神託が守る3つの原則",
    "Three principles of the oracle",
    "神谕遵循的三项原则"
  ],
  [
    "根拠は見せない",
    "Do not reveal the rationale",
    "不展示依据"
  ],
  [
    "因果関係を説明しすぎると、人は自分の人生を最適化アルゴリズムに預けてしまう。神託の根拠は見せない。選択の理由を、機械の計算結果だけで埋め尽くさないためです。",
    "Explain causal connections too exhaustively, and people may entrust their lives to an optimization algorithm. The oracle does not reveal its rationale, so that the reasons for a choice are not filled entirely by a machine’s calculations.",
    "如果把因果关系解释得过于详尽，人可能会将自己的人生交给优化算法。神谕不展示依据，是为了不让机器的计算结果填满作出选择的全部理由。"
  ],
  [
    "因果的介入をしない",
    "Do not intervene causally",
    "不进行因果干预"
  ],
  [
    "因果的介入はしない。システムが本人に代わって決定を実行したり、報酬や不利益で行動を誘導したりしない。神託を受け入れることも、退けることもでき、その先へ踏み出すかは本人が決めます。",
    "The system does not carry out decisions on a person’s behalf or steer behavior through rewards and penalties. A person may accept or reject the oracle, and decide for themselves whether to take the next step.",
    "系统不替本人执行决定，也不通过奖励或不利后果引导行为。本人可以接受或拒绝神谕，是否继续迈出下一步，由本人决定。"
  ],
  [
    "最後の意味づけは本人に委ねる",
    "Leave the final meaning to the person",
    "将最终的意义解释交给本人"
  ],
  [
    "正解を渡して思考を終わらせるのではなく、自分は何を望み、何を引き受けるのかを問い返す。同じ神託から違う意味を受け取ってよい。選ぶ主体としての人間を、判断の中心に戻すためです。",
    "Rather than ending thought with a correct answer, the oracle asks what you want and what you are willing to take on. Different people may find different meanings in the same response. Its purpose is to return the human being, as the one who chooses, to the center of judgment.",
    "不是用正确答案终结思考，而是反问自己想要什么、愿意承担什么。同一个神谕可以被赋予不同的意义。这是为了让作为选择主体的人，重新回到判断的中心。"
  ],
  [
    "図を大きく見る",
    "View a larger diagram",
    "查看大图"
  ],
  [
    "金色：因果の流れ",
    "Gold: causal flow",
    "金色：因果流"
  ],
  [
    "青紫：情報の流れ",
    "Blue-violet: information flow",
    "蓝紫色：信息流"
  ],
  [
    "完全自己情報",
    "Complete self-record",
    "完整自我信息"
  ],
  [
    "深層知性群",
    "Deep intelligences",
    "深层智能群"
  ],
  [
    "多元我（別人格群）",
    "Plural selves (alternative personalities)",
    "多元自我（不同人格群）"
  ],
  [
    "世界・因果報告書群",
    "Reports on the world and causality",
    "世界与因果报告群"
  ],
  [
    "神格アーキテクチャ",
    "Divine architecture",
    "神格架构"
  ],
  [
    "神託",
    "Oracle",
    "神谕"
  ],
  [
    "note：二度目の大学生活のこと",
    "note: Going to university a second time",
    "note：第二次大学生活"
  ],
  [
    "ページの先頭へ",
    "Back to top",
    "回到顶部"
  ],
  [
    "構想図",
    "Concept diagram",
    "构想图"
  ],
  [
    "拡大して読む",
    "Zoom in to read",
    "放大阅读"
  ],
  [
    "閉じる",
    "Close",
    "关闭"
  ],
  [
    "金色：因果の流れ ／ 青紫：情報の流れ。拡大時は上下・左右にスクロールできます。",
    "Gold: causal flow / Blue-violet: information flow. When zoomed in, scroll vertically or horizontally.",
    "金色：因果流／蓝紫色：信息流。放大后可上下、左右滚动。"
  ],
  [
    "サイトのトップページへ",
    "Go to the site home page",
    "返回网站首页"
  ],
  [
    "ページ内ナビゲーション",
    "On this page",
    "页内导航"
  ],
  [
    "この作品で出会う体験",
    "Experiences in this work",
    "本作品的体验"
  ],
  [
    "神話製作機械を構成する要素",
    "Elements of the Myth-Making Machine",
    "神话制造机器的组成部分"
  ],
  [
    "作者の奥付",
    "About the creator",
    "作者信息"
  ],
  [
    "構想図を閉じる",
    "Close the concept diagram",
    "关闭构想图"
  ],
  [
    "構想図。上下にスクロールし、拡大時は左右にも移動できます。",
    "Concept diagram. Scroll vertically; when zoomed in, you can also scroll horizontally.",
    "构想图。可上下滚动，放大后也可左右移动。"
  ],
  [
    "通常表示に戻す",
    "Return to fit view",
    "恢复适配显示"
  ]
];
  const biography = document.createElement('span');
  biography.dataset.conceptBiography = '';
  const biographyParagraph = document.querySelector('.author-colophon p:nth-child(2)');
  const phrases = [...biographyParagraph.querySelectorAll(':scope > .copy-phrase')];
  biographyParagraph.prepend(biography);
  biography.append(...phrases);
  const normalize = text => text.replace(/\s+/gu, ' ').trim();
  const passages = groups.flatMap(([selector,source]) => {
    const element = document.querySelector(selector);
    if (!element || normalize(element.textContent) !== normalize(source)) {
      console.error('Concept translation source changed:', selector);
      return [];
    }
    element.setAttribute('translate', 'no');
    element.dataset.conceptPassage = '';
    return [{element, source, original: [...element.childNodes]}];
  });
  i18n.register(entries);
  i18n.register([["作品を支える、3つのレイヤー","Three layers behind the work","支撑作品的三个层次"],["情報工学の授業を制作の土台に、それ以外も含め、特に参考にした5つの講義を紹介します。世界観・語り方・データを扱う技術の3層が、本作を支えています。","Information engineering courses underpin the production. These five especially influential courses, including other disciplines, support three layers: worldview, storytelling, and data science.","信息工程课程是制作的基础。这里简要介绍包括其他领域在内、尤其具有启发的五门课程，呈现世界观、叙事技巧与数据科学三个层次。"],["世界観・ナラティブ","Worldview / narrative","世界观与叙事"],["ストーリーテリング","Storytelling","叙事技巧"],["データサイエンス","Data science","数据科学"],["本作の世界観の出発点。講義に登場するインタラクティブ地球儀「Sphere」に着想を得て、地球の変化に触れる観測体験をつくりました。","The starting point for the work’s worldview. The interactive globe Sphere, introduced in the lectures, inspired an observation experience that lets visitors explore a changing Earth.","本作世界观的起点。受讲义中介绍的交互式地球仪Sphere启发，我们打造了亲手探索地球变化的观测体验。"],["本作のシナリオのコアとなった講義。人間とAIの関係や、人が自ら選んで生きることへの問いに着想を得ています。","The inspiration for the core of the scenario: the relationship between humans and AI, and the question of choosing how to live.","本作剧本核心的灵感来源：人与AI的关系，以及人如何自主选择生活的追问。"],["ストーリー構成の参考にした講義。今回は予定調和的な構成ですが、完全版では講義のエッセンスをさらに取り入れ、没入感を深めたいと考えています。","A reference for the story’s structure. This version follows a deliberately harmonious arc; a full version would draw more deeply on the lectures to strengthen immersion.","本作故事结构的参考。当前版本采用预定的和谐走向，完全版希望进一步融入课程精髓，增强沉浸感。"],["統計と地球のデータを掛け合わせる発想の土台。観測値の比較や傾向を読み解く、統計分析の体験につなげています。","A foundation for combining statistics with Earth data, translated into an experience of comparing observations and exploring trends.","将统计与地球数据结合的基础，并将其转化为比较观测值、探索趋势的统计分析体验。"],["統計と多様なデータを掛け合わせる着想を得た講義。公開データを整理・統合し、可視化と分析につなぐ設計に生かしています。","The inspiration for combining statistics with diverse datasets, informing how public data is organized and integrated for visualization and analysis.","启发了将统计与多样数据相结合的想法，用于组织、整合公开数据并连接可视化与分析。"],["Sphere 公式サイト","Sphere official website","Sphere官方网站"]]);
  i18n.register(groups.map(([,source,en,zh]) => [source,en,zh]));
  const render = () => {
    for (const {element,source,original} of passages) {
      if (i18n.get() === 'ja') element.replaceChildren(...original);
      else element.replaceChildren(...i18n.t(source).split('\n').flatMap((line,index) =>
        index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
    }
  };
  for (const [selector,en,zh] of [
  [
    ".brochure-picture img",
    "Map mode: Accumulating CO₂. A world map with concentration colors, a timeline slider, data sources, and statistics controls.",
    "地图模式“不断累积的CO₂”的实际画面：世界地图、浓度分色、年份滑块、数据来源与统计分析操作区。"
  ],
  [
    ".experience-explore img",
    "Map mode comparing renewable electricity shares by country using map colors.",
    "地图模式的实际画面：通过地图颜色比较各国可再生能源发电占比。"
  ],
  [
    ".experience-feel img",
    "Map mode showing ocean-current speed and direction with colored arrows and lines.",
    "地图模式的实际画面：通过彩色箭头和线条表现海流的速度与方向。"
  ],
  [
    ".experience-meet img",
    "An illustration used in the story, where two characters welcome you to their exhibition booth.",
    "本篇使用的插画：两位登场人物邀请你走进展位。"
  ],
  [
    "#machine-diagram",
    "The Myth-Making Machine cycle. The original self contributes to the complete self-record; deep AIs generate insights; alternative-self AIs produce reports on the world and causality; a divine AI returns an oracle using the self-record. Gold marks causal flow and blue-violet information flow. Its rationale is not shown, it makes no causal intervention, and the final meaning belongs to the person.",
    "神话制造机器的循环：我（原型）写入完整自我信息，深层AI群生成洞见，不同人格AI群制作世界与因果报告，神AI依据完整自我信息将神谕交还本人。金色表示因果流，蓝紫色表示信息流。不展示神谕依据，不作因果干预，将最终意义的解释交给本人。"
  ]
]) {
    const element = document.querySelector(selector);
    const source = element.getAttribute('alt');
    i18n.register([[source,en,zh]]);
    i18n.bind(element,source,{},'alt');
  }
  const description = document.querySelector('meta[name="description"]');
  const source = description.content;
  i18n.register([[source,
    'Discover Planet After School, an exhibition-based visual novel combining an open environmental-data observation system with a story that begins at a seaside exhibition booth.',
    '了解《行星的放学时光》：将地球环境开放数据可视化的观测系统，与海边展位上邂逅的故事相结合的展览参与型视觉小说。']]);
  i18n.bind(description,source,{},'content');
  render();
  addEventListener('gaia:language-change', render);
})();
