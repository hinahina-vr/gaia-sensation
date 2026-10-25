// Interpret the existing first/last-period comparison. This adapter neither
// fetches data nor adds a regression, forecast, exposure or safety assessment.
const modes=new Set(['japan-marine-cod','japan-marine-ph','japan-marine-do','japan-river-ph','japan-river-do','japan-lake-ph','japan-lake-do','japan-weather-temperature','japan-weather-humidity','japan-weather-pressure']);
export function stationEarthInsight(dataset,measured){
 if(!modes.has(dataset.modeId))return null;
 const metric=dataset.modeId==='japan-marine-cod'?'cod':dataset.insightContext?.sensorMetric;
 const base={...measured,audience:'earth-context',takeawayLabel:'同じ地点の年次比較',takeawayCaveat:dataset.comparisonNote||''};
 if(measured.status==='insufficient'||!Number.isFinite(measured.details?.change)||measured.details.window<3)return{...base,status:'insufficient',headline:'複数年どうしを比べる記録が足りない',fact:'現在の選択では、前後の複数年をそろえた比較が成立していません。',summary:'比較できる期間がそろったところで、この土地の変化と暮らしの関係を考えられます。'};
 const {change,window,beyond,range}=measured.details,a=measured.metrics[0][1],b=measured.metrics[1][1];
 const tolerance={ph:.1,dissolved_oxygen:.1,cod:.1,temperature:.2,humidity:1,pressure:.1}[metric]||0;
 const direction=Math.abs(change)<tolerance||change===0?0:Math.sign(change),up=direction>0;
 const separated=direction&&beyond>=window*.6;
 const shared=direction?'初期より直近の複数年平均が'+(up?'上がっています。':'下がっています。')+(separated?'直近の多くの年が、初期期間の'+(up?'最高値を上回っています。':'最低値を下回っています。'):'前後の値の範囲には重なりがあります。'):'初期と直近の複数年では近い水準です。'+(range>Math.abs(change)*2?'平均の移動より、年ごとの高低が目立ちます。':range===0?'対象の記録は同じ値で続いています。':'');
 let headline,fact,summary;
 if(metric==='cod'){
  headline=up?'沿岸のCODは、以前より高い側へ移っている':direction<0?'沿岸のCODは、以前より低い側へ移っている':'沿岸のCODは、前後で近い水準にある';
  fact='COD年度平均は、'+shared;
  summary=up?'有機物などの酸化に消費される酸素の目安が、大きい側へ移っています。海へ戻す水まで暮らしの一部と考えると、陸で水を使うことと、沿岸の生きものが暮らす環境を守ることがつながります。':direction<0?'有機物などの酸化に消費される酸素の目安が、小さい側へ移っています。水を使った後に海へ戻すところまで考える暮らしが、沿岸の環境と人の生活を一続きに捉える出発点になります。':'CODの前後の水準が近い中でも、この海は陸で使った水の行き先とつながっています。水を使い、処理して戻すまでを暮らしとして考えることで、沿岸の生きものと共有する環境へ関心を広げられます。';
 }else if(metric==='ph'){
  const water=dataset.modeId.includes('marine')?'海':dataset.modeId.includes('river')?'川':'湖';
  headline=direction?water+'のpH最小値は、直近の平均が'+(up?'上昇':'低下'):water+'のpH最小値は、前後の平均がほぼ同じ';
  fact='各年度のpH最小値を並べると、'+shared;
  summary=direction?'水の性質の変化が、その年に最も低かったpHにも現れています。水を使う側の都合に加えて、戻した先で生きものが暮らす水の性質まで考えることが、人と水辺の関係をつくり直す視点になります。':'pHの低い側が近い水準で続くこの地点では、水の性質を保ちながら使うという視点が持てます。取水する場所と排水する場所を一続きに考えることが、人の利用と水辺の環境を結びます。';
 }else if(metric==='dissolved_oxygen'){
  const water=dataset.modeId.includes('marine')?'海':dataset.modeId.includes('river')?'川':'湖';
  headline=direction?water+'で測った酸素は、年平均で'+(up?'高い':'低い')+'側へ':water+'で測った酸素は、前後で近い水準にある';
  fact='、水に溶ける酸素の年度平均は、'+shared;
  summary=up?'水中の生きものが使う酸素は、年平均で高い側へ移っています。人が水を取り、使い、戻す仕組みを、生きものの呼吸が続く環境と一緒に考えることが、水を分け合う暮らしにつながります。':direction<0?'水中の生きものが使う酸素は、年平均で低い側へ移っています。暮らしや産業で水を使うことを、受け取る水辺の側からも考えると、人だけでなく生きものの呼吸も支える水の使い方が問いになります。':'酸素の年平均が近い水準で続くことは、この地点の水を知る基準になります。暮らしで水を使う量だけでなく、戻した先で生きものの呼吸が続くかまで考えると、水を共有する相手が見えてきます。';
 }else if(metric==='temperature'){
  headline=up&&beyond===window?'直近の年平均気温は、初期の最高値をすべて上回る':up?'年平均の暖かさは、高い側へ移っている':direction<0?'この期間の年平均気温は、低い側へ':'年平均気温は、前後で近い水準にある';
  fact='年平均気温は、'+shared;
  summary=up?'かつての暖かい年を基準にしても、今の暮らしの条件を低く見積もりかねません。住まいや働く時間、街の緑や日陰を、暖かくなった土地に合わせて考えることが、人と周囲の生きものが過ごせる場所を広げます。':direction<0?'選んだ期間では、その土地の暖かさが低い側へ移っています。地球全体の話に加え、実際の土地で記録された変化に合わせて住まいやエネルギーの使い方を考えることが、地域の暮らしを支えます。':'前後の気温が近い土地でも、年ごとの暖かさは変わります。ひとつの年を標準に固定せず、暖かい年も冷たい年も過ごせる住まいを考えることが、土地と長く付き合う工夫になります。';
 }else if(metric==='humidity'){
  headline=direction?'相対湿度の年平均は、以前より'+(up?'高い':'低い')+'側へ':'湿度の平均は近く、年ごとの高低が続く';
  fact='年平均相対湿度は、'+shared;
  summary=direction?'湿り方の変化は、住まいを乾かす、風を通すといった日々の工夫にも関わります。土地の空気に合わせた建物の使い方が、快適さと空調に使うエネルギーとの関係を変える手がかりになります。':'湿度が増え続けるという前提より、毎年の湿り方の違いが目立つ記録です。換気や建物の使い方をその年の空気に合わせる暮らしが、湿度を固定した条件として扱う考え方を補います。';
 }else if(metric==='pressure'){
  headline=direction?'現地気圧は、直近の年平均が'+(up?'高い':'低い')+'側へ':'現地気圧の年平均は、近い水準で続く';
  fact='年平均現地気圧は、'+shared;
  summary='現地気圧の変化には、観測する高さや場所の条件も関わります。土地の条件を含めて記録を共有することが、数値の変化を暮らしの環境へ結びつける土台になります。';
 }else return null;
 return{...base,headline,fact,summary,factEvidence:{kind:'existing-annual-period-comparison',recordIds:measured.recordIds,calculation:measured.calculation,values:{baseline:a,recent:b,change,window,beyond,range},presentationTolerance:tolerance},logic:{evidence:measured.calculation,inference:fact,implication:summary,limits:dataset.comparisonNote||''},futurePerspective:{focus:'human-earth-co-creation-and-future',basis:'既存の同一地点・前後期間の比較',evidenceRecordIds:measured.recordIds}};
}
