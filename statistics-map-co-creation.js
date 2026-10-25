import {mapMeasuredFact} from './statistics-map-facts.js?v=whole-trends20-20261025';
// Interpret the existing measured result. No impact, attribution or forecast is
// inferred from a cross-section; changing/filtering records changes the reading.
const topics = Object.freeze({
 'co2-trend':'carbon','jma-co2':'carbon-paired','ocean-currents':'ocean',rainfall:'rain',waste:'waste',
 'emissions-urban':'emissions',earthquakes:'quake-history','forest-urban':'forest',culture:'culture',renewables:'energy',population:'population',
 'live-wind-field':'wind','live-carbon-pulse':'city-carbon','live-rain-chorus':'city-rain','live-temperature-field':'temperature','live-cloud-drift':'cloud','live-pm25-haze':'air',
});
const labels = {carbon:'大気に残る炭素と未来','carbon-paired':'離れた土地で共有する大気',ocean:'海の流れと、海を使う暮らし',rain:'土地ごとの水との付き合い方',waste:'使い終えた資源の行き先',emissions:'排出の偏りと社会の転換','quake-history':'大地の活動と、備えを続ける暮らし',forest:'森と都市が共にある土地',culture:'自然と文化を受け継ぐ未来',energy:'自然の力を暮らしの電気へ',population:'多くの暮らしを支える資源',wind:'街の風を暮らしに生かす','city-carbon':'街から、共有する大気へ','city-rain':'地域ごとに届く雨と暮らし',temperature:'土地の気温に合う暮らし',cloud:'空模様とエネルギーの使い方',air:'住む場所と、吸い込む空気'};
const sources={carbon:['https://www.ipcc.ch/report/ar6/wg1/chapter/summary-for-policymakers/'],waste:['https://www.unep.org/beatpollution/waste'],energy:['https://www.iea.org/reports/integrating-solar-and-wind/executive-summary'],weather:['https://open-meteo.com/en/docs'],air:['https://atmosphere.copernicus.eu/guide-cams-visual-products-our-atmosphere-your-fingertips'],quake:['https://www.jma.go.jp/jma/kishou/know/faq/faq27.html']};
const name=r=>String(r?.countryJa||r?.label||r?.name||'選択地点');
const numeric=n=>typeof n==='number'&&Number.isFinite(n);
const ids=rows=>rows.map(r=>String(r.id));

function reading(topic,dataset,candidate,rows,measured){
 const order=[...rows].sort((a,b)=>b.value-a.value||String(a.id).localeCompare(String(b.id))),high=order[0],low=order.at(-1),same=high.value===low.value;
 const tail=measured.details?.upperTailCount>0;
 const peer=candidate.id==='near-peers'&&candidate.comparison;
 const temporal=measured.details&&numeric(measured.details.change);
 const delta=temporal?measured.details.change:null;
 const r=(headline,fact,summary,basis,limits,refs=[])=>({headline,fact,summary,logic:{evidence:basis,inference:fact,implication:summary,limits,sources:refs}});
 if(same&&!['carbon','carbon-paired','ocean','quake-history','culture','city-rain'].includes(topic))return r('選んだ記録では、値の違いが表れていない','選択した地域の値は、同じ水準として記録されています。','今回の値だけでは、地域ごとの暮らしと環境の違いを結びつけられません。ほかの時点や、暮らしに関わる記録を併せた比較から考えられます。','有効な記録値が同一。','地域差・因果・改善効果は未成立。');
 if(topic==='carbon'){
  if(!temporal)return r('選んだ期間では、濃度の変化を比較できない','同じ系列の前後を比べる条件がそろっていません。','この選択からは、大気中の炭素が蓄積しているかを読み取れません。','同一系列の前後比較が未成立。','濃度の増減を断定しない。');
  return delta>1e-9?r('大気中の炭素は、以前より高い水準に積み重なっている','対象期間の初めと終わりを比べると、最近の二酸化炭素濃度は以前より高くなっています。','濃度が高まるほど、これからの暮らしは、すでに大気に加わった炭素の影響も引き受けます。排出を減らす暮らしや産業への転換は、未来へ積み増す温暖化を抑えることにつながります。','同一系列の初期・直近期間の平均差が正。','温度上昇量・原因別寄与・施策効果は未計算。',sources.carbon)
  :delta< -1e-9?r('選んだ期間では、大気中の炭素濃度が下がっている','同じ系列で比べると、最近の濃度は初めの期間より低くなっています。','この期間の低下は、大気に残る炭素が変化しうることを示しています。排出と自然の吸収がどう釣り合っていたかを重ねると、人と地球の間で炭素を増やし続けない暮らしを考えられます。','同一系列の平均差が負。','低下の原因・持続性・排出削減効果は未計算。',sources.carbon)
  :r('比較した期間の炭素濃度は、同じ水準にある','初めと終わりの期間を平均すると、濃度の差は見られません。','濃度が同じ水準でも、その間には排出と吸収があります。その収支を併せて見ることが、大気に炭素を積み増さない暮らしを考える出発点になります。','同一系列の平均差がゼロ。','排出・吸収の収支は未計算。',sources.carbon);
 }
 if(topic==='carbon-paired')return candidate.id==='shared-rise'?r('離れた観測所でも、炭素濃度の上昇が共通している','離れた観測所で共通して濃度が上昇し、その期間差は同じ年の地点差を上回っています。','各地で出した炭素は、広く共有する大気に加わります。離れた土地に共通する上昇は、一つの地域の努力を、地域や国を越えた排出削減へつなげる意味を示しています。','各観測所の前後差と同年地点差の比較。','排出源別の寄与は未計算。',sources.carbon):r('選択した観測所の濃度を比べる','今回の選択からは、観測所に共通する上昇を確認できていません。','同じ時点の地点差と、同じ地点の長期変化を分けることで、共有する大気に各地域の暮らしがどう関わるかを考えられます。','共通上昇の比較条件が未成立。','共通上昇・地域施策の効果は断定しない。',sources.carbon);
 if(topic==='ocean')return candidate.id==='opposing-currents'?r('海の流れは、逆向きの流れと同時に存在している','対象地点には向きの異なる海流があり、方向を含めて平均すると、地点ごとの流れの強さが小さく見えます。','海へ出したものの行き先は、場所ごとの流れで変わります。流れが分かれる海を共有していることは、沿岸での排出や海の利用を、隣り合う地域と一緒に考える理由になります。','流速の平均と平均ベクトルの大きさに差。','物質の移動経路・到達時間・汚染量は未計算。')
 :r(same?'海流は、同じ速さとして記録されている':'海の流れる速さは、場所によって違う',same?'選んだ地点では流速の差がありません。':name(high)+'の流れは、'+name(low)+'より速くなっています。','海流の向きと速さを、海へ出すものや沿岸の暮らしと重ねれば、海を通じてつながる土地どうしの関係を考えられます。','地点別流速の分布。','輸送量・被害・将来の流れは未計算。');
 if(topic==='rain')return r(same?'平均降水量は、同じ水準にある':tail?'雨の多さは、少数の参照地点に偏っている':'雨から受け取る水の量は、土地によって違う',same?'対象地点の平均降水量には差がありません。':name(high)+'と'+name(low)+'では、参照地点の平均降水量に大きな違いがあります。','雨の多い土地と少ない土地では、水を得る条件が違います。水を多く使う作物や製品を選ぶことも、その生産地の雨や水の使われ方とつながっています。','参照地点の平均降水量と四分位の比較。','森林の降雨効果・水不足・生産地の水使用量は未計算。');
 if(topic==='waste')return r(same?'記録された資源回収の割合は、同じ水準にある':tail?'高い資源回収の割合は、対象の記録の一部に限られる':'使い終えたものを回収する割合には、幅がある',same?'選んだ記録の再資源化・回収の割合は同じ水準です。':'出典ごとに対象や年が異なる対象の記録でも、再資源化・回収の割合には幅があります。','高い割合の記録からは、使い終えたものを資源へ戻す選択肢があると分かります。製品のつくり方と回収の仕組みをつなげることが、資源を採り、使い、捨て続ける暮らしを変える手がかりになります。','補完値を除く公表比率の分布。','定義・データ年が異なる国の成績順位や施策効果は推定しない。',sources.waste);
 if(topic==='emissions'||topic==='population'){
  const share=measured.metrics?.find(([label])=>label==='上位3件の構成比')?.[1];
  const concentrated=numeric(share)&&share>=50,substantial=numeric(share)&&share>=30;
  if(topic==='emissions')return r(concentrated?'少数の国に、化石燃料からの排出の過半が集まっている':substantial?'化石燃料からの排出は、一部の国が大きな割合を占める':'化石燃料からの排出は、複数の国に分かれている',same?'選択した国の排出量は同じ水準です。':name(high)+'をはじめ、排出量の大きい国が、記録された合計の大きさを左右しています。','排出量の大きい国で暮らしや産業を変えることは、世界全体の排出にも大きく関わります。技術や資金を国境を越えて共有することは、その転換を支え、共有する大気への排出を減らす道の一つです。','選択年の排出量合計に対する上位国の構成比。','消費由来排出・歴史的責任・国際協力の効果は未計算。',sources.carbon);
  return r(substantial?'多くの人の暮らしが、一部の国に集まっている':'人の暮らしは、さまざまな国に広がっている',same?'選択した国の人口は同じ水準です。':name(high)+'など人口の多い国には、記録された人口の大きな割合が集まっています。','人が多く暮らす地域で、食料や水、エネルギーを無駄なく届けられれば、その変化は多くの暮らしに届きます。一人ひとりの生活を守ることと、地球の資源を長く使うことを、同じ仕組みの中で考えられます。','選択年の人口構成比。','人口を環境負荷・過剰人口・需要量へ換算しない。');
 }
 if(topic==='quake-history')return candidate.id==='uneven-event-years'?r('大きな地震の記録は、毎年同じようには現れない','記録された大きな地震の件数は、年によって違っています。','静かな年があっても、大地と共に暮らす条件は続きます。揺れに備えた建物や助け合う仕組みを平穏な時期にも受け継ぐことが、大地の活動と暮らしが共に続く未来を支えます。','記録された大規模地震の年別件数差。','次の発生時期・発生確率・被害は推定しない。',sources.quake):r('選んだ年の地震記録を比べる',same?'選んだ年に記録された件数は同じです。':'記録された地震の件数には年ごとの差があります。','大地と共に暮らす未来は、出来事を経験した世代だけでなく、次の世代へ備えを受け継ぐことともつながります。','データ年別件数の比較。','件数から次の地震を予測しない。',sources.quake);
 if(topic==='forest')return peer?r('都市に住む人の割合が近くても、森の残り方は違う',name(rows.find(r=>String(r.id)===candidate.comparison.points[0].id))+'と'+name(rows.find(r=>String(r.id)===candidate.comparison.points[1].id))+'は、都市人口の割合が近くても、森林の割合が大きく異なります。','都市に人が集まることと、国土にどれだけ森が残るかは、一対一には結びついていません。街での暮らしと森を共に残す未来は、どこを街にし、どこに森を残すかという土地の使い方から考えられます。','都市人口率が近い実在二国の森林率差。','都市化の因果効果・都市内緑地・土地利用策の効果は未計算。')
 :r(same?'選んだ国の森林率は、同じ水準にある':'森が占める国土の割合には、国ごとの違いがある',same?'記録された森林率は同じ水準です。':name(high)+'と'+name(low)+'では、国土に占める森林の割合が異なります。','残る森と人の暮らす場所を併せて見ると、土地を使いながら生きもののすみかも残す未来を、その地域の条件から考えられます。','選択国の森林率の分布。','森林率から森林の質や都市化の影響は推定しない。');
 if(topic==='culture'&&!rows.some(r=>r.category==='Mixed'))return r('選んだ記録の自然と文化を比べる','この選択には、自然と文化の複合区分の記録が含まれていません。','それぞれの土地で自然と人の営みがどう受け継がれてきたかは、区分に加えて、その場所の歴史から考えられます。','複合区分の記録は選択範囲に存在しない。','記録区分を現実の自然と文化の分離へ換算しない。');
 if(topic==='culture')return r('自然と文化が、同じ場所で受け継がれている','記録された遺産には、自然と文化の両方の価値を持つ場所があります。','自然を守ることと、その土地の文化を受け継ぐことが重なる場所があります。人の営みを土地から切り離さずに受け継ぐことも、地球との共創の一つの姿です。','自然・文化の複合区分の実在記録。','全世界の構成比・保全効果は未計算。');
 if(topic==='energy')return peer?r('日射と風が似ていても、電気への生かし方は違う',candidate.comparison.points.map(p=>p.name).join('と')+'では、代表地点の日射と風速が近くても、再生可能エネルギーの発電割合に大きな差があります。','太陽や風の条件が似た場所でも、暮らしの電気への使われ方は違います。設備や送電網など、自然の力を暮らしへつなぐ仕組みも、その土地のエネルギーの未来を選ぶ対象になります。','同年の発電割合と代表地点の日射・風速を比較した組。','全土の資源量・電源別内訳・政策や設備の因果効果は未計算。',sources.energy)
 :r(same?'選んだ国の再生可能電力の割合は、同じ水準にある':'自然由来の電気が占める割合は、国によって違う',same?'再生可能エネルギーの発電割合は同じ水準です。':name(high)+'と'+name(low)+'では、再生可能エネルギーが発電に占める割合が異なります。','自然から得た力をどれだけ電気にして暮らしへ届けるかは、各地で異なります。その土地に合った発電と、電気を運び、使う仕組みを一緒に考える余地があります。','国別の再生可能発電割合の分布。','自然条件をそろえた比較・因果効果は未成立。',sources.energy);
 const place= name(high)+'と'+name(low);
 const basis=tail?'四分位基準を超える高い側の代表地点が少数存在。':same?'有効な代表地点の値は同一。':'同じ表示時点の代表地点の最大・最小・中央値を比較。';
 const fact=metric=>same?'選択時点の代表地点では、'+metric+'が同じ水準です。':place+'では、選択時点の'+metric+'に違いがあります。';
 if(topic==='wind')return r(same?'選んだ街の風は、同じ強さとして表れている':tail?'強い風は、一部の街の代表地点に偏っている':'同じ時点でも、街ごとに風の強さが違う',fact('風速'),'風の違いは、街で得られる通風の条件にも関わります。街路や建物の配置に実際の風向や周囲の地形を重ねれば、風を生かして涼しさを得る街づくりを、その土地から考えられます。',basis,'街区の通風・体感・冷房削減量は未計算。',sources.weather);
 if(topic==='city-carbon')return r(same?'各地の予測では、炭素濃度が同じ水準にある':'街の空気の炭素濃度には、地域ごとの違いがある',fact('二酸化炭素濃度の予測'),'地域ごとの濃度差も、広くつながった大気の中にあります。街でエネルギーの使い方を変え、排出を減らす取り組みは、地域の空気を越えて共有する大気の未来につながります。',basis,'モデル格子の予測。地域排出量・原因・対策効果は未計算。',sources.carbon);
 if(topic==='city-rain'){
  const wet=rows.filter(r=>r.value>0),dry=rows.filter(r=>r.value===0);
  return r(wet.length&&dry.length?'雨が届く街と、届いていない街が同時にある':wet.length?'同じ時点でも、街が受け取る雨の量は違う':'選択時点の代表地点には、降水が記録されていない',wet.length&&dry.length?'同じ表示時点に、降水のある代表地点と、降水のない代表地点が分かれています。':fact('降水量'),wet.length?'雨が届く場所は、その時点で均等に分かれていません。降った水を蓄え、川や地下を通じて使う仕組みは、雨の降る場所と、水を使って暮らす場所をつないでいます。':'この時点に雨がなくても、暮らしで使う水は、それまでに降った雨を蓄え、運ぶ仕組みにつながっています。雨の少ない時間を過ごせる街も、水を蓄える土地と共にあります。','正の降水量とゼロの代表地点数を区別。','干ばつ・洪水・水収支・貯水量は未計算。',sources.weather);
 }
 if(topic==='temperature')return r(same?'選んだ街の気温は、同じ水準にある':'同じ時刻でも、街が向き合う気温は違う',fact('地上付近の気温'),'街ごとの気温差は、屋内外で心地よく過ごす条件の違いにもつながります。土地に合った日よけや断熱、緑の配置を考えることは、暮らしを守りながら、冷暖房に使うエネルギーとの付き合い方を変える道になります。',basis,'体感温度・健康被害・省エネ効果・気候変動の寄与は未計算。',sources.weather);
 if(topic==='cloud')return r(same?'選んだ街の空は、同じ雲量として表れている':'同じ時点でも、街を覆う雲の割合は違う',fact('空を雲が覆う割合'),'雲の違いがある空の下で、太陽光を暮らしに使っています。実際に届く日射と電気を使う時間を併せて見ると、空模様に応じて電気を蓄え、地域で融通する暮らしを考えられます。',basis,'日射・発電量・蓄電量は未計算。雲量だけで発電量を決めない。',sources.weather);
 if(topic==='air')return r(same?'選んだ街の微粒子濃度は、同じ水準にある':tail?'微粒子の濃さは、一部の街で高くなっている':'同じ時点でも、街によって吸い込む空気が違う',fact('地表付近の微粒子の濃度'),'地域ごとの濃度差は、人が暮らす場所の空気にも違いがあることを示しています。濃い場所の発生源や風の流れを調べることから、周辺地域も含めて空気をきれいにする協力につなげられます。',basis,'発生源・輸送経路・人口曝露・健康被害は未計算。',sources.air);
}

export function mapCoCreationInsight(dataset,candidate,rows,measured){
 const topic=topics[dataset.id];if(!topic)return measured;
 if(rows.length>=2&&['ocean-currents','rainfall','waste','earthquakes','live-wind-field','live-carbon-pulse','live-rain-chorus','live-temperature-field','live-cloud-drift','live-pm25-haze'].includes(dataset.id))return {...measured,audience:'earth-context',status:'insufficient',takeawayLabel:'全体の推移を比較',headline:'期間・対象をそろえた比較を確認できません',fact:'同じ対象・条件で全体の変化を比べるデータが不足しています。',summary:'比較可能な時系列や地域全体のデータから、暮らしとの関係を考えます。',futurePerspective:{focus:'human-earth-co-creation-and-future',basis:'比較未成立',evidenceRecordIds:[]},takeawayCaveat:dataset.comparisonNote||''};
 const usable=rows.filter(r=>numeric(r.value));
 const empty=measured.status==='insufficient'||usable.length<2;
 const interpreted=empty?{headline:'比べる記録を選ぼう',fact:usable.length?'現在は、ひとつの地点・時点の記録を見ています。':'この選択には、読み取りに使える記録がありません。',summary:'今ある記録だけでは、地域差や時間の変化と暮らしの関係を説明できません。',logic:{evidence:'比較相手が不足。',inference:'地域差や時間変化は未成立。',implication:'比較可能な記録がある場合に解釈する。',limits:'一般的な共創の結論を代用しない。'}}:reading(topic,dataset,candidate,usable,measured);
 const factReading = empty ? null : mapMeasuredFact(dataset, usable, measured);
 if(factReading){
  if(factReading.headline)interpreted.headline=factReading.headline;
  interpreted.fact=factReading.fact;
  if(factReading.summary)interpreted.summary=factReading.summary;
  interpreted.factEvidence=factReading.factEvidence;
  if(factReading.factMetrics)interpreted.metrics=[...measured.metrics,...factReading.factMetrics];
  interpreted.logic={...interpreted.logic,evidence:factReading.factEvidence.calculation,inference:interpreted.fact,implication:interpreted.summary};
 }
 return {...measured,...interpreted,audience:'earth-context',takeawayLabel:labels[topic],futurePerspective:{focus:'human-earth-co-creation-and-future',basis:interpreted.logic.evidence,evidenceRecordIds:factReading?.factEvidence.recordIds||measured.recordIds,limits:interpreted.logic.limits},takeawayCaveat:dataset.comparisonNote||interpreted.logic.limits};
}
