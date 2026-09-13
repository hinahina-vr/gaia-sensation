GaiaI18n.register([
  ["接続を確認", "Check connection", "检查连接"],
  ["読み取り完了", "Analysis complete", "解读完成"],
  [
    "このデータの主な特徴を、計算済みの統計量と観測値を根拠に説明してください。読み取れることと、まだ言えないことを分けてください。",
    "Explain this dataset’s main features using the calculated statistics and observations. Distinguish what the data supports from what cannot yet be said.",
    "请根据已计算的统计量和观测值，说明这组数据的主要特征。区分可以解读的内容与目前尚不能下结论的内容。"
  ],
  [
    "地域やグループ間で、どのような違いが見られますか。比較できる区分と件数を確かめ、数値的な根拠と比較の限界を示してください。比較用の区分がなければ、その不足を説明してください。",
    "What differences appear between regions or groups? Check the available categories and sample counts, and explain the numerical evidence and limits of comparison. If comparison categories are missing, explain that limitation.",
    "地区或群体之间有哪些差异？请确认可比较的分类与记录数量，说明数值依据及比较的局限。如果缺少比较所需的分类，请说明这一不足。"
  ],
  [
    "時間に沿った変化や傾向を読み取れますか。まず時点・期間・観測間隔が確認できるかを確かめ、確認できる範囲の変化を説明してください。時系列データでなければ、変化を推測せず不足を示してください。",
    "Can changes or trends over time be identified? First check whether dates, periods, and observation intervals are available, then explain only the changes they support. If these are not time-series data, explain what is missing without inferring change.",
    "能否看出随时间发生的变化或趋势？请先确认时点、期间与观测间隔，再说明能够确认的变化。如果并非时间序列数据，请指出不足，不要推测变化。"
  ],
  [
    "このデータの変数間に、どのような関係が見られますか。提示された変数と計算済みの統計量だけを根拠に、関係の強さ・限界を説明してください。関係を調べる変数が足りなければその旨を示し、相関から因果を断定しないでください。",
    "What relationships appear between the variables? Use only the provided variables and calculated statistics to explain the strength and limits of any relationship. State if necessary variables are missing, and do not infer causation from correlation.",
    "数据中的变量之间存在哪些关系？请仅依据提供的变量和已计算的统计量，说明关系的强度与局限。如果缺少分析关系所需的变量，请明确指出，不要由相关性断定因果关系。"
  ],
  [
    "極端な値、偏り、欠測など、読み取る前に注意すべき点はありますか。観測値と計算結果を根拠に、確認すべき点を整理してください。外れ値を誤測定と決めつけず、実測・補完・派生を区別してください。",
    "Are there extreme values, bias, missing data, or other cautions to consider before interpreting these results? Use the observations and calculations to identify what needs checking. Do not assume outliers are measurement errors; distinguish observed, imputed, and derived values.",
    "解读前是否需要注意极端值、偏差、缺失值等问题？请依据观测值和计算结果整理应核查的事项。不要把异常值直接认定为测量错误，并区分实测、补全与派生数值。"
  ],
  [
    "この分析から次に確かめたい問いを3つ挙げてください。それぞれ、現時点の根拠、まだ確かめられていない点、追加で必要な観測や比較を示してください。仮説と確認済みの事実を分けてください。",
    "Suggest three questions to investigate next. For each, give the current evidence, what remains unverified, and the additional observations or comparisons needed. Distinguish hypotheses from established facts.",
    "请提出这次分析之后值得进一步确认的三个问题。分别说明当前依据、尚未确认的事项，以及所需的补充观测或比较。请区分假设与已经确认的事实。"
  ],
  [
    "エンドポイントを入力してください。",
    "Enter an endpoint.",
    "请输入端点。"
  ],
  [
    "エンドポイントURLが正しくありません。",
    "The endpoint URL is invalid.",
    "端点 URL 无效。"
  ],
  [
    "APIキーを保護するため、HTTPSエンドポイントだけを使用できます。",
    "Only HTTPS endpoints are allowed, to protect your API key.",
    "为保护 API 密钥，仅允许使用 HTTPS 端点。"
  ],
  [
    "認証情報をURLへ埋め込まないでください。",
    "Do not embed credentials in the URL.",
    "请勿在 URL 中嵌入认证信息。"
  ],
  [
    "APIキーをGAIAへ誤送信しないよう、GAIA自身のURLは指定できません。",
    "You cannot use GAIA’s own URL, to avoid sending your API key to GAIA by mistake.",
    "为防止误将 API 密钥发送给 GAIA，不能指定 GAIA 自身的 URL。"
  ],
  [
    "API応答が上限（2MB）を超えました。",
    "The API response exceeded the 2 MB limit.",
    "API 响应超过了 2 MB 上限。"
  ],
  [
    "APIが{status}を返しました。",
    "The API returned status {status}.",
    "API 返回状态码 {status}。"
  ],
  [
    "APIが{status}を返しました：{detail}",
    "The API returned status {status}: {detail}",
    "API 返回状态码 {status}：{detail}"
  ],
  [
    "APIの応答から回答文を読み取れませんでした。モデルまたは互換形式を確認してください。",
    "No answer text could be read from the API response. Check the model and compatible response format.",
    "无法从 API 响应中读取回答文本。请检查模型及兼容格式。"
  ],
  [
    "API応答が45秒以内に返りませんでした。",
    "The API did not respond within 45 seconds.",
    "API 未在 45 秒内响应。"
  ],
  [
    "APIへ接続できません。URL、CORS許可、ブラウザ拡張の遮断を確認してください。",
    "Cannot connect to the API. Check the URL, CORS permissions, and whether browser extensions are blocking access.",
    "无法连接 API。请检查 URL、CORS 权限，以及浏览器扩展是否拦截了访问。"
  ],
  [
    "APIキー・モデル名・質問を入力してください。",
    "Enter an API key, model name, and question.",
    "请输入 API 密钥、模型名称与问题。"
  ],
  [
    "{provider}へ分析を依頼しています…",
    "Requesting analysis from {provider}…",
    "正在请求 {provider} 进行分析…"
  ],
  [
    "AI分析に失敗しました。",
    "AI analysis failed.",
    "AI 分析失败。"
  ],
  [
    "{count}件 + 集計結果",
    "{count} records + calculated results",
    "{count} 条记录 + 汇总结果"
  ],
  [
    "{dataset} ／ {method} ／ 対象{count}件",
    "{dataset} / {method} / {count} selected records",
    "{dataset} / {method} / {count} 条所选记录"
  ],
  [
    "{dataset} ／ {method} ／ 対象{count}件（送信は先頭{sent}件と集計結果）",
    "{dataset} / {method} / {count} selected records (sending the first {sent} and calculated results)",
    "{dataset} / {method} / {count} 条所选记录（发送前 {sent} 条及汇总结果）"
  ],
  [
    "センサー分析と共通の保存済みAPIキーを削除しました。",
    "Deleted the saved API key shared with sensor analysis.",
    "已删除与传感器分析共用的已保存 API 密钥。"
  ],
  [
    "APIキーと、この画面の回答を消去しました。",
    "Cleared the API key and the answer on this screen.",
    "已清除 API 密钥和此画面中的回答。"
  ],
  [
    "送信を中止しました。すでに送信先が受理した処理や料金は取り消せない場合があります。",
    "Request cancelled. Work or charges already accepted by the destination may not be reversible.",
    "已取消发送。目标服务已受理的处理或产生的费用可能无法撤销。"
  ]
]);
