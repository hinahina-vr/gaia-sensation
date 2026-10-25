const numeric = value => typeof value === 'number' && Number.isFinite(value);
const mean = rows => rows.reduce((total,row) => total+row.value,0)/rows.length;
const sourceKey = row => row.sourceSeries || row.sourceName || '';
const yearOf = row => numeric(row.year) ? row.year : row.x;
const period = row => String(yearOf(row))+(row.periodUnit || '年');
const span = rows => rows.length===1 ? period(rows[0]) : String(yearOf(rows[0]))+'–'+period(rows.at(-1));

// Keep the most recent continuous annual run from a single source. A source
// appearing once in 1960 and again in 2014 must not become a "1960–2015 period".
export function foodBalanceComparison(rows) {
  const ordered=rows.filter(row=>numeric(row.value)&&row.value>=0&&numeric(yearOf(row))&&row.provenance!=='IMPUTED'&&row.valueStatus!=='IMPUTED').sort((a,b)=>yearOf(a)-yearOf(b));
  if(!ordered.length)return null;
  const latest=ordered.at(-1),source=sourceKey(latest),run=[latest];
  if(source)for(let i=ordered.length-2;i>=0;i--){
    const row=ordered[i],next=run[0];
    if(sourceKey(row)!==source || yearOf(next)-yearOf(row)!==1)break;
    run.unshift(row);
  }
  const duplicateYears=new Set(ordered.map(yearOf)).size!==ordered.length;
  if(run.length<2 || duplicateYears)return {latest,run,comparison:null};
  const window=Math.max(1,Math.min(10,Math.floor(run.length/3)));
  const early=run.slice(0,window),recent=run.slice(-window);
  const baseline=mean(early),current=mean(recent);
  return {latest,run,comparison:{window,early,recent,baseline,current,change:current-baseline}};
}

export function foodBalanceEarthInsight(dataset, rows) {
  const reading=foodBalanceComparison(rows);
  if(!reading)return null;
  const {latest,run,comparison}=reading;
  const country=dataset.insightContext?.countryName || dataset.title?.split(' / ')[0] || '選択国';
  const commodity=dataset.insightContext?.seriesLabel || dataset.title?.split(' / ')[1]?.replace('・品目別自給率（重量）','') || '選択品目';
  const subject=country+'の'+commodity,value=latest.value,netImport=100-value;
  const balanced=Math.abs(netImport)<1e-8;
  let headline,meaning,structure,secondMetric;
  if(netImport>1e-8){
    headline=subject+(value<50?'は、海外からの供給に大きく支えられている':'は、国内の生産と海外からの供給が支えている');
    structure=value<50?'選択した記録では、国内で生産する量よりも、輸入から輸出を差し引いた量が大きいことが読み取れます。':'選択した記録では、国内で育てる分に海外からの供給が加わり、この品目の供給を支えていることが読み取れます。';
    meaning='ふだんの食卓は、国境の向こうの農地や水、人々の仕事ともつながっています。食べ物の産地をたどり、その土地でどう育てられているかまで目を向けてみよう。';
    secondMetric=['純輸入／供給量',netImport,'%'];
  }else if(!balanced){
    headline=subject+'は、国境を越えた食料供給を支える側にある';
    structure='選択した記録では、生産量が輸出入を差し引いた供給量を上回り、輸出が輸入より多いことが読み取れます。';
    meaning='食料を送り出す地域と、受け取る地域の食卓はつながっています。送り出す側の農地や水がどう使われているのか。その生産と、食べる側の暮らしを結びつけて考えてみよう。';
    secondMetric=['生産量／供給量',value/100,'倍'];
  }else{
    headline=subject+'は、生産と供給がつり合っている';
    structure='選択した記録では、国内で生産する量と、輸出入を差し引いた供給量が同じ水準にあることが読み取れます。';
    meaning='食料がどこで育ち、どこへ届くのかをたどってみよう。生産量、食料の出入り、生産地での土地や水の使われ方を合わせて見ると、食卓を支える仕組みが見えてきます。';
    secondMetric=['純輸入／供給量',0,'%'];
  }
  let trendMetric=['同出典の連続記録',run.length,'年'];
  if(comparison){
    trendMetric=['比較期間の平均差',comparison.change,'ポイント'];
  }
  const records=[...new Map([latest,...(comparison?.early||[]),...(comparison?.recent||[])].map(row=>[String(row.id),row])).values()];
  return {
    audience:'earth-context',headline,summary:meaning,fact:structure,
    takeawayCaveat:'国全体の生産と食料の出入りを比べています。生産地ごとの環境や暮らしは、現地の資料と合わせてたどります。',
    metrics:[[period(latest)+'の自給率',value,'%'],secondMetric,trendMetric],
    recordIds:records.map(row=>String(row.id)),status:'computed',
    calculation:'自給率＝生産÷（生産＋輸入−輸出）×100。純輸入割合＝100−自給率。比較は選択範囲で最終年へ連続する同一出典内に限定し、最初と最後の各 min(10,floor(n/3)) 年（最低1年）の自給率を単純平均。方式の境界・欠測をまたがず、出典からの比率を保持。原因・将来の供給量は計算していない。',
    details:{latestYear:yearOf(latest),latestValue:value,netImportShare:netImport,source:sourceKey(latest),comparableYears:run.map(yearOf),window:comparison?.window??null,baseline:comparison?span(comparison.early):null,recent:comparison?span(comparison.recent):null,change:comparison?.change??null},
  };
}
