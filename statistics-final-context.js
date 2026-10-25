// Interpret existing comparisons for map 61–75. Source rows and numerical
// results are retained. Event counts, survey findings and material composition
// have separate meanings; none is converted into risk or a causal estimate.
const topics={
 'japan-water-hex':['使う油と戻す水','n-ヘキサン抽出物質の年度平均濃度','油分の目安は、直近の平均が',d=>d>0?'油分の目安となる物質が、高い濃度へ移っています。油を使う便利さと、使った後に水へ何を戻すかを一緒に考えることが、製品の利用と川の環境をつなぎます。':'油分の目安となる物質の記録から、使ったものの行き先まで暮らしに含められます。回収や処理を、水を使う場所と戻す場所の両方から考えることが、人と水辺の関係を変える工夫になります。'],
 'japan-water-zinc':['金属を使った後の水辺','全亜鉛の年度平均濃度','水中の亜鉛は、直近の平均が',d=>d<0?'水中の亜鉛は、低い濃度へ移っています。金属を使うことを製品の中だけで完結させず、使った後の回収や水辺への行き先まで考えると、資源の利用と水の環境がつながります。':'水中の亜鉛の濃さも、人が金属を利用する暮らしを考える手がかりになります。使う前の便利さに、使った後の回収や行き先を重ねることで、水辺と共有する環境へ目を向けられます。'],
 'japan-water-las':['洗う暮らしの、その先の水','LASの年度平均濃度','LASは、直近の平均が',d=>d>0?'界面活性剤の一群が、水中で高い濃度へ移っています。洗うときの働きだけでなく、使った後に処理され、水辺へ戻るところまで考えることが、清潔な暮らしと川の環境を結びます。':'洗うときに使う物質を、その後の水辺まで含めて考えられます。必要な働きと使う量、使った後の処理を合わせることが、人の暮らしを支える製品と川の環境をつなぎます。'],
 'japan-water-nonylphenol':['使った物質が変わった後も考える','ノニルフェノールの年度平均濃度','ノニルフェノールは、直近の平均が',()=> '物質を使うときだけでなく、使った後に分解されて生じるものも水辺に関わります。製品の働きから、その後の変化や処理までつなげて考えることが、暮らしと水の環境を一続きに捉える視点になります。'],
 'japan-river-benthos':['川底も、暮らしを分け合う場所','底生生物の確認分類群数','調査で確認された分類群は、後半の記録で',d=>d>0?'後の調査では、川底の生きものをより多くの分類群として確認しています。人が使う水や川の形を考えるときに、川底で暮らせる場所も含めることで、川を人と生きものが共有する場として捉えられます。':'川底の生きものを確認した記録を、数だけでなく暮らせる場所へ結びつけて考えられます。水を使うことと、川底に残す環境を一緒に扱うことが、小さな生きものも含めて川を守る視点になります。'],
 'japan-river-fish':['水を使う人と、川を泳ぐ生きもの','魚類の確認分類群数','調査で確認された魚の分類群は、後半の記録で',()=> '確認された魚の記録は、川を人だけの水路として扱わない視点につながります。水の利用や河岸の使い方を、魚が暮らし、移動できる場所と合わせて考えることが、川の未来を分け合う発想になります。'],
 cyclones:['嵐の記録を、暮らす場所につなぐ','主要経路の記録件数','主要経路の記録件数は、前後で',()=> '嵐の記録を、どこで人が暮らし、何を残したいかと重ねて考えられます。海辺の利用と備えを別々にせず、避難する場所や日々の移動まで含めることが、海とともに暮らし続ける工夫になります。'],
 coral:['サンゴと、熱を抱える海','サンゴの熱ストレスの年内最大値','サンゴの熱ストレスは、直近の平均が',d=>d>0?'高い水温が続いた影響が、より大きく積み重なる側へ移っています。サンゴ礁を使い、支えられる暮らしを、海に熱が蓄積する変化と合わせて考えることが、人と海の関係を長い時間で見直す視点になります。':'海の暑さを、その日の水温だけでなく、熱が続いた時間として考えられます。サンゴ礁を利用する暮らしを、その海の変化と一緒に捉えることが、海の生きものと共に続く利用につながります。'],
 lakes:['使う水と、水辺に残す水','固定範囲で確認された年次水面積','確認された水面の広がりは、直近の平均が',d=>d<0?'水面が小さい側へ移ることは、人が使う水と、水辺に残る水を一緒に考えるきっかけになります。水を取り出す場所だけでなく、生きものや周囲の暮らしが支えられる水の広がりまで含めて考えられます。':'水面の広がりが変わる土地では、水を利用する場所と、水辺に残す場所の関係も問われます。人が使う水だけで完結させず、湖の周りの生きものや暮らしを含めて、水を分け合う姿を考えられます。'],
 waterstore:['見えない蓄えと、水を使う暮らし','地表・土壌・地下などを合わせた陸水量の偏差','陸に蓄えられた水は、比較期間の後半で',d=>d<0?'水の蓄えが少ない側へ移ると、その時に川を流れる水だけでは捉えきれない変化が見えてきます。使う量と、土や地下に蓄えられる過程を合わせて考えることが、目に見える水だけに頼らない暮らしにつながります。':'陸の水は、その時に川を流れるものだけでなく、土や地下などにも蓄えられています。蓄えの変化を水の使い方と一緒に考えることが、雨が届く土地と人が暮らす場所をつなぐ視点になります。'],
};
const prtrModes=new Set(['japan-prtr-air','japan-prtr-water','japan-prtr-transfer']);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const finish=(base,dataset,headline,fact,summary,values,extra={})=>({...base,headline,fact,summary,...extra,logic:{evidence:base.calculation||'有効な記録の比較',inference:fact,implication:summary,limits:dataset.comparisonNote||''},factEvidence:{kind:'existing-analysis-reading',recordIds:base.recordIds,calculation:base.calculation,values},futurePerspective:{focus:'human-earth-co-creation-and-future',basis:'表示中の分析結果と対象指標の意味',evidenceRecordIds:base.recordIds}});
export function finalEarthInsight(dataset,rows,measured){
 const mode=dataset.modeId;if(!topics[mode]&&!prtrModes.has(mode)&&mode!=='food-security')return null;
 const base={...measured,audience:'earth-context',takeawayLabel:topics[mode]?.[0]||'使う物質と、環境への行き先',takeawayCaveat:dataset.comparisonNote||''};
 if(prtrModes.has(mode)){
  const share=measured.metrics?.[0]?.[1],count80=measured.metrics?.[1]?.[1],total=measured.metrics?.[2]?.[1];
  if(!finite(share)||!finite(total)||rows.length<3)return finish(base,dataset,'物質の量の偏りを比べる記録が少ない','数値のある物質が少なく、届出量の構成を比べられる範囲が限られています。','どの物質を使い、どの経路へ出すかを暮らしや産業の一部として考えられます。',{supportedComparison:false});
  const concentrated=share>=80,spread=share<50;
  const subject=mode==='japan-prtr-transfer'?'届出移動量':'届出排出量';
  const headline=concentrated?subject+'の大半が、上位の物質に集まる':spread?subject+'は、多くの物質に分かれている':subject+'は、上位の物質だけでは捉えきれない';
  const fact=concentrated?'上位の三物質で、'+subject+'の大半を占めています。':spread?'上位の三物質を合わせても、'+subject+'の半分に届いていません。量はさらに多くの物質に分かれています。':'上位の三物質が'+subject+'の半分以上を占め、そのほかの物質にも量が分かれています。';
  const summary=mode==='japan-prtr-air'?'量の偏りを、どの物質を何のために使うかという選択へつなげられます。製品やエネルギーの便利さだけでなく、使う過程で共有する大気まで含めることが、産業と暮らしの関係を変える視点になります。':mode==='japan-prtr-water'?'水域へ出すものを、合計量だけでなく物質ごとの行き先として考えられます。事業所の中で使う水と、外で人や生きものが共有する水を一続きに捉えることで、使った後まで含めた暮らしや産業を考えられます。':'事業所の外へ移した物質も、その先で処理される場所や環境とつながっています。手元を離れた後の行き先まで使う側の選択に含めることが、廃棄や処理を別の場所へ任せて終わらない循環の視点になります。';
  return finish(base,dataset,headline,fact,summary,{topThreeShare:share,count80,total,rows:rows.length});
 }
 const details=measured.details,change=details?.change,a=measured.metrics?.[0]?.[1],b=measured.metrics?.[1]?.[1];
 if(!finite(change)||!finite(a)||!finite(b)||!details?.window)return finish(base,dataset,'変化を比べる記録がそろっていない','有効な記録が少なく、対象期間の前後を比較できません。','確認できた値を、物質や環境が暮らしに関わる手がかりとして残せます。変化を断定する代わりに、比較できる記録が続くことを、その土地と付き合う土台にできます。',{supportedComparison:false});
 let [label,metric,stem,interpret]=topics[mode]||['食卓を支える土地とのつながり','穀物輸入依存度','穀物輸入依存度は、',()=> '国境を越えて食料を得る仕組みを、食べものを育てる土地や水とつなげて考えられます。自分の食卓を支える環境を国内だけに閉じず、取引先の土地や暮らしも含めて捉える視点が持てます。'];
 const tolerance=(dataset.unit==='%'||dataset.unit==='ポイント') ? .25 : dataset.unit==='年' ? .1 : Math.max(1e-12,Math.abs(a)*.05),d=Math.abs(change)<=tolerance?0:Math.sign(change),up=d>0;
 const events=['cyclones'].includes(mode),survey=mode==='japan-river-benthos'||mode==='japan-river-fish',area=['lakes'].includes(mode);
 const adjective=events||survey||['waterstore'].includes(mode)?(up?'多く':'少なく'):area?(up?'大きく':'小さく'):(up?'高く':'低く');
 let headline=stem+(d?adjective+'なっている':'近い水準にある');
 let fact=metric+'は、'+(survey?(details.window>1?'初期と後期の確認記録の平均を比べると、':'最初と最後の確認記録を比べると、')+(d?adjective+'なっています。':'近い数となっています。'):(d?(details.window>1?'初期より直近の複数記録の平均が':'初期より最後の記録が')+adjective+'なっています。':'前後の比較値が近い水準です。'));
 if(!survey&&d&&details.window>=3){if(details.beyond===details.window)fact+='直近の各記録が、初期期間の'+(up?'最高値を上回っています。':'最低値を下回っています。');else if(details.beyond>=details.window*.6)fact+='直近の多くの記録が、初期期間の'+(up?'最高値を上回っています。':'最低値を下回っています。');else if(details.range>Math.abs(change)*3)fact+='平均差よりも、記録ごとの高低の幅が大きい結果です。';}
 if(events)headline='記録された'+'主要経路'+'の件数は、前後で'+(d?adjective+'なっている':'近い水準にある');
 let summary=interpret(d);
 if(mode==='food-security'){const energy=dataset.insightContext?.seriesId==='21010';label='食卓を支える土地とのつながり';metric=energy?'平均食事エネルギー供給充足率':'穀物輸入依存度';headline=metric+'は、比較期間の後半で'+(d?adjective+'なっている':'近い水準');fact=metric+'の同じ出典の系列を比べると、後期の平均が'+(d?adjective+'なっています。':'初期と近い水準です。');if(!energy&&b>50)fact+='後期の平均では、供給の過半を純輸入が占めています。';summary=energy?'国全体で供給される量を、個々の人の食卓まで届く条件と合わせて考えられます。食料を得る土地や水の環境を守ることと、必要な人へ届ける仕組みをつなげる視点が持てます。':'国境を越えて食料を得る割合の変化は、食卓を支える土地との関係の変化でもあります。自分の食べものを国内だけで完結させず、育てる土地の水や、その地域の暮らしまで含めて考えられます。';}
 return finish({...base,takeawayLabel:label},dataset,headline,fact,summary,{baseline:a,recent:b,change,window:details.window,beyond:details.beyond,range:details.range,presentationTolerance:tolerance});
}
