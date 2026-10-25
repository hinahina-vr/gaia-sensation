import {prefectureCoCreationReading} from './statistics-prefecture-co-creation.js?v=insights01-40-20261026';
// Earth-facing interpretations of actual selected annual records (map 21–30).
// The comparison and its record IDs travel with the copy; causes and impacts
// requiring other data are deliberately outside these calculations.
const KEYS=new Set(['migration','lodging','housing','averageTemperature','summerHigh','winterLow','relativeHumidity','sunshineHours','precipitation','rainyDays']);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const year=r=>finite(r.year)?r.year:r.x;
const avg=rs=>rs.reduce((s,r)=>s+r.value,0)/rs.length;
const ids=rs=>rs.map(r=>String(r.id));
const labels={migration:'人の移動と土地',lodging:'旅がつなぐ暮らし',housing:'住まいと土地',averageTemperature:'土地の暖かさの変化',summerHigh:'日中の暖かさの変化',winterLow:'一日の冷え込みの変化',relativeHumidity:'暮らす空気の変化',sunshineHours:'土地が受け取る光',precipitation:'水が届く量と頻度',rainyDays:'水が届く量と頻度'};
const metricNames={migration:'転入超過',lodging:'延べ宿泊者数',housing:'住宅着工戸数',averageTemperature:'年平均気温',summerHigh:'日最高気温の年平均',winterLow:'日最低気温の年平均',relativeHumidity:'年平均相対湿度',sunshineHours:'年間日照時間',precipitation:'年間降水量',rainyDays:'年間降水日数'};
function windows(rows){
 if(rows.length<6)return null;
 const n=Math.max(3,Math.min(10,Math.floor(rows.length/3))),early=rows.slice(0,n),late=rows.slice(-n);
 const consecutive=rs=>rs.every((r,i)=>!i||year(r)-year(rs[i-1])===1);
 if(!consecutive(early)||!consecutive(late)||year(late[0])<=year(early.at(-1)))return null;
 const a=avg(early),b=avg(late);return{early,late,n,a,b,delta:b-a};
}
const direction=(c,key)=>{const tolerance=['averageTemperature','summerHigh','winterLow'].includes(key)?.2:key==='relativeHumidity'?2:Math.max(1,Math.abs(c.a))*.05;return Math.abs(c.delta)<=tolerance?0:Math.sign(c.delta);};
export function prefectureEarthInsight(dataset,input){
 const key=dataset.id?.replace(/^estat-prefecture-/,'');if(!KEYS.has(key)||dataset.xKind!=='year')return null;
 const rows=input.filter(r=>finite(r.value)&&finite(year(r))&&r.provenance!=='IMPUTED'&&r.valueStatus!=='IMPUTED').toSorted((a,b)=>year(a)-year(b));
 const place=dataset.insightContext?.placeName||rows[0]?.prefecture||'この土地';
 const title=(headline,fact,summary,details={},evidenceRows=rows,metrics=[])=>({audience:'earth-context',takeawayLabel:labels[key],headline,fact,summary,status:details.insufficient?'insufficient':'computed',metrics,recordIds:ids(evidenceRows),
  takeawayCaveat:key==='migration'?'日本人の県境を越える転入・転出の差を比べています。出生・死亡は別の記録で確認できます。':key==='lodging'?'全期間で従業者十人以上の施設にそろえ、泊数を含む延べ人数を比べています。':key==='housing'?'一年に工事を始めた住宅の戸数です。住宅の利用状況は別の記録で確認できます。':key==='sunshineHours'?'日照計変更期を避けた同じ側の期間で比較しています。地点の移転や観測方法の影響にも注意が必要です。':['precipitation','rainyDays'].includes(key)?'代表地点の年次記録です。降水量は雨雪の水換算量、降水日数は一日に一ミリ以上となった日を数えています。':'代表観測地点の年次記録です。地点の移転・観測方法の変更・都市化の影響も含みます。',
  calculation:'欠測・補完値を除外し、同一年の重複を許さず、選択範囲の最初と最後の連続した各 min(10,floor(n/3)) 年（最低3年）の平均を比較。5%（気温0.2℃・相対湿度2ポイント）以内は近い水準と記述する探索用ルールで、有意差・安全・因果の判定ではない。'+(details.calculation||''),
  interpretationBasis:{kind:'prefecture-annual-earth-reading',key,place,...details}});
 if(rows.length<6||new Set(rows.map(year)).size!==rows.length)return title('比較できる年をそろえよう','選択範囲では、複数年どうしを比べる記録が足りません。','年ごとの揺れと続く変化を分けて読むため、期間を広げて確かめられます。',{insufficient:true},rows,[]);
 let comparable=rows;
 if(key==='sunshineHours'){
  const after=rows.filter(r=>year(r)>=1991),before=rows.filter(r=>year(r)<=1985);
  comparable=after.length>=6?after:before.length>=6?before:[];
 }
 const c=windows(comparable);
 if(!c)return title('続けて比べられる期間を選ぼう','記録の欠けや観測方法の境目があり、前後の水準をそろえて比べられません。','比較できる連続年をそろえると、この土地で続いている変化を確かめられます。',{insufficient:true},comparable,[]);
 const d=direction(c,key),span=year(c.late.at(-1))-year(c.early[0]),long=span>=20;
 let headline,fact,summary,details={earlyYears:c.early.map(year),recentYears:c.late.map(year),baseline:c.a,recent:c.b,change:c.delta,direction:d,longPeriod:long};
 let evidenceRows=[...c.early,...c.late],metrics=[['初期期間の平均',c.a,dataset.unit],['直近期間の平均',c.b,dataset.unit],['平均差',c.delta,dataset.unit==='%'?'ポイント':dataset.unit]];
 const sameYears=other=>{
  const rs=rows.flatMap(r=>finite(r.related?.[other])?[{...r,value:r.related[other]}]:[]);
  const byYear=new Map(rs.map(r=>[year(r),r]));
  if(![...c.early,...c.late].every(r=>byYear.has(year(r))))return null;
  const a=avg(c.early.map(r=>byYear.get(year(r)))),b=avg(c.late.map(r=>byYear.get(year(r))));return{a,b,delta:b-a,direction:direction({a,b,delta:b-a},other)};
 };
 if(key==='migration'){
  const sign=c.b>0?1:c.b<0?-1:0,opposite=c.a*c.b<0;
  headline=opposite?(sign>0?'人を送り出す土地から、迎える土地へ変わっている':'人を迎えた土地が、送り出す側へ変わっている'):sign>0?'直近では、人を迎える側にある':sign<0?'直近では、人を送り出す側にある':'人の出入りは、近い規模でつり合っている';
  fact=place+'では、'+(opposite?'初期と直近の複数年を比べると、転入超過と転出超過が入れ替わっています。':sign>0?'直近の複数年を平均すると、転入が転出を上回っています。':sign<0?'直近の複数年を平均すると、転出が転入を上回っています。':'直近の複数年を平均すると、転入と転出の差がほぼなくなっています。');
  summary=sign>0?'この土地は、県境を越えて暮らしの場を移す人を迎える側にあります。住まい、通学、日々の買い物を支える場所に、人の移動が新しいつながりを重ねています。':sign<0?'この土地から県境の外へ暮らしの場を移す動きが、入ってくる動きを上回っています。人が住む場所の移動は、暮らしを支える住まいや交通を、どこに残し、どうつなぐかという問いにもつながります。':'人の出入りが近い規模にあることから、流入だけ・流出だけでは捉えにくい土地のつながりが読み取れます。暮らしの場を移す人の行き来に目を向けると、県境をまたぐ生活の関係をたどれます。';
  details.netDirection=sign;
 }
 if(key==='lodging'){
  // Find the largest year-on-year contraction with three prior years available.
  let drop=null;for(let i=3;i<rows.length-2;i++){if(year(rows[i])-year(rows[i-1])!==1||rows[i-1].value<=0)continue;const ratio=rows[i].value/rows[i-1].value;if(!drop||ratio<drop.ratio)drop={i,ratio};}
  const recent=rows.slice(-3),before=drop?rows.slice(drop.i-3,drop.i):[],reference=before.length?avg(before):null,current=avg(recent);
  if(drop&&drop.ratio<.7&&reference>0&&year(rows[drop.i])<year(recent[0])){
   const recovery=current/reference;details={...details,dropYear:year(rows[drop.i]),preDropMean:reference,recentThreeYearMean:current,recovery,calculation:' 宿泊は、前年からの最大減少率が3割超の年を探し、その前3年と直近3年の平均を比較。原因や旅行者の実人数を推定しない。'};
   headline=recovery>1.05?'旅を迎える動きは、落ち込み前より広がっている':recovery>=.95?'旅を迎える動きは、落ち込み前の水準に戻っている':'旅を迎える動きは、落ち込み前の水準に届いていない';
   fact=place+'の延べ宿泊は、大きく落ち込んだ時期を経て、直近の複数年では'+(recovery>1.05?'落ち込み前の水準を上回っています。':recovery>=.95?'落ち込み前に近い水準となっています。':'落ち込み前より少ない水準となっています。');
   summary=recovery>=.95?'人がこの土地で夜を過ごす動きが、縮小した時期から再び戻っています。旅先の宿泊は、その土地で水や電気を使い、食べ、移動する時間でもあります。旅の広がりを、迎える土地の暮らしとのつながりとして考えられます。':'この土地で人が夜を過ごす規模には、大きく縮んだ時期の前後で差が残っています。旅の変化は、宿だけでなく、食事や移動を支える土地との関係にも目を向ける入口になります。';
   evidenceRows=[...before,rows[drop.i],...recent];metrics=[['落ち込み前の平均',reference,dataset.unit],['直近の平均',current,dataset.unit]];
  }else{
   headline=d>0?'この土地で夜を過ごす旅が広がっている':d<0?'この土地で夜を過ごす旅が縮んでいる':'宿泊の規模は、年ごとの振れを伴って続いている';fact=place+'の延べ宿泊は、初期より直近の複数年で'+(d>0?'多くなっています。':d<0?'少なくなっています。':'近い水準となっています。');summary=d>0?'この土地で滞在する人の時間が増えています。旅を迎える広がりは、宿泊の先にある食事や移動、その土地で使う水や電気とのつながりも広げています。':'この土地に滞在する規模の変化が、記録に現れています。旅が支える仕事と、旅先で使う水や電気を合わせて考えると、訪れる側と迎える側の暮らしを結びつけて捉えられます。';
  }
 }
 if(key==='housing'){
  const groups=rows.slice(2).map((r,i)=>({rs:rows.slice(i,i+3),mean:avg(rows.slice(i,i+3))})).filter(g=>g.rs.every((r,i)=>!i||year(r)-year(g.rs[i-1])===1));
  const peak=groups.toSorted((a,b)=>b.mean-a.mean)[0],recent=rows.slice(-3),current=avg(recent),pastPeak=peak&&year(recent.at(-1))-year(peak.rs.at(-1))>=10&&current<peak.mean*.7;
  if(pastPeak){headline='住まいを新しくつくる勢いは、過去の拡大期から落ち着いている';fact=place+'では、住宅着工が多かった時期に比べ、直近の複数年の着工は少なくなっています。';summary='新しく住まいを増やす動きが、かつての拡大期から変わっています。新築で街を広げることに加え、すでにある住まいや土地をどう使い続けるかも、この土地の暮らしを考えるテーマになります。';details={...details,peakYears:peak.rs.map(year),peakMean:peak.mean,recentThreeYearMean:current,peakRatio:current/peak.mean,calculation:' 住宅は連続3年の移動平均が最大の期間と直近3年を比較。最大期から10年以上経過し、直近が最大期の7割未満の場合だけ拡大期からの縮小を記述。住宅需要・空き家は推定しない。'};evidenceRows=[...peak.rs,...recent];metrics=[['最多期の平均',peak.mean,'戸'],['直近の平均',current,'戸']];}
  else{headline=d>0?'新しい住まいをつくる動きが広がっている':d<0?'新しい住まいをつくる動きが小さくなっている':'新しい住まいの着工は、近い規模で続いている';fact=place+'の住宅着工は、初期より直近の複数年で'+(d>0?'多くなっています。':d<0?'少なくなっています。':'近い水準にあります。');summary=d>0?'住まいを新しくつくる動きが、この土地で広がっています。どこに建て、どの土地を暮らしの場にするかという選択が、街と周囲の環境の関係を少しずつ変えていきます。':'住まいを新しくつくる規模の変化が、記録に現れています。新築の動きと、すでにある住まいの使い方を合わせて考えると、土地と暮らしの関係を長い時間で捉えられます。';}
 }
 if(['averageTemperature','summerHigh','winterLow'].includes(key)){
  const subject=metricNames[key],high=sameYears('summerHigh'),low=sameYears('winterLow');
  const separated=d>0?c.late.filter(r=>r.value>Math.max(...c.early.map(r=>r.value))).length:d<0?c.late.filter(r=>r.value<Math.min(...c.early.map(r=>r.value))).length:0;
  details={...details,separatedYears:separated,companionHigh:high,companionLow:low};
  headline=d>0?key==='averageTemperature'?(long&&separated/c.n>=.6?'暖かい年が、例外からふだんの側へ移っている':'一年の暖かさが、以前より高い水準へ移っている'):key==='summerHigh'?'毎日の日中の暖かさが、底上げされている':'一日の低い気温も、高い側へ移っている':d<0?'この期間の気温は、以前より低い水準へ移っている':'この期間の気温は、年ごとの違いを伴いながら推移している';
  fact=place+'の'+subject+'は、初期より直近の複数年で'+(d>0?'高くなっています。':d<0?'低くなっています。':'近い水準となっています。');
  if(d>0&&high?.direction>0&&low?.direction>0){fact+='一日の高い気温と低い気温は、年平均でそろって上がっています。';summary='一年の暖かさの変化が、一日の高い気温だけでなく、低い気温にも現れています。この土地では、日々の気温の幅の両側が、以前より高いほうへ動いています。';}
  else summary=d>0?'暖かさが、一年だけの突出にとどまらず、複数年の水準の違いとして現れています。過去の気温に合わせてきた暮らしや生きものの営みが、今の土地の暖かさとどう関わるかを考える手がかりになります。':d<0?'この選択期間では、複数年を平均した気温が低い側へ動いています。この土地で実際に記録された変化をたどると、地球全体の話と、その場所で経験する年ごとの条件を行き来して考えられます。':'前後の平均は近い一方で、暖かい年と冷たい年の違いがあります。この期間の土地の条件は、一定方向の変化だけでなく、年ごとの揺れを含めて捉えられます。';
 }
 if(key==='relativeHumidity'){
  const temperature=sameYears('averageTemperature');details.companionTemperature=temperature;
  headline=d<0?'空気の湿り具合は、以前より低い割合へ移っている':d>0?'空気の湿り具合は、以前より高い割合へ移っている':'空気の湿り具合は、前後で近い水準にある';
  fact=place+'の年平均相対湿度は、初期より直近の複数年で'+(d<0?'低くなっています。':d>0?'高くなっています。':'近い水準となっています。');
  if(temperature?.direction>0&&d<=0){headline=d<0?'暖かくなる一方、相対湿度は下がっている':'暖かさが増しても、相対湿度は同じようには増えていない';fact+='同じ年の平均気温は上がっています。';summary='この土地では、気温と相対湿度が同じ方向・同じ幅で変わっていません。暮らす空気の条件が、暖かさと湿り具合の組合せとして変わっていることが読み取れます。';}
  else summary=d<0?'一年を通した相対湿度が、以前より低い側へ動いています。この土地で暮らす空気の湿り具合には、年ごとの天気に加えて、複数年の水準の違いが現れています。':d>0?'一年を通した相対湿度が、以前より高い側へ動いています。この土地で暮らす空気の湿り具合には、年ごとの天気に加えて、複数年の水準の違いが現れています。':'前後の平均は近い一方で、湿り具合には年ごとの違いがあります。ひとつの方向へ変わる姿より、毎年の条件の振れとして、この期間の空気の違いが現れています。';
 }
 if(key==='sunshineHours'){
  headline=d>0?'日が差す時間は、以前より長い水準にある':d<0?'日が差す時間は、以前より短い水準にある':'日照は、一方向の変化より年ごとの違いが目立つ';
  fact=place+'では、日照計変更期を避けた期間で比べると、直近の複数年の日照時間は'+(d>0?'初期より長くなっています。':d<0?'初期より短くなっています。':'初期と近い水準にあります。');
  summary=d?'同じ土地でも、一年のうち日が差す時間の長さが変わっています。土地が経験する明るい時間の配分には、年ごとの違いに加えて、複数年の水準の違いが現れています。':'年ごとの長短がある一方、前後の複数年平均には大きな隔たりがありません。この土地が経験する明るい時間は、一定方向の増減より、年ごとの振れとして現れています。';
  details.sunshineRegime=year(comparable[0])>=1991?'post-1990':'pre-1986';
 }
 if(['precipitation','rainyDays'].includes(key)){
  const otherKey=key==='precipitation'?'rainyDays':'precipitation',other=sameYears(otherKey),rain=key==='precipitation'?d:other?.direction,days=key==='rainyDays'?d:other?.direction;
  details.companion={key:otherKey,...other};
  if(other&&rain>0&&days<=0){headline='降水の量が増えても、降る日数は同じようには増えていない';fact=place+'では、前後の複数年を比べると、年間降水量は増える一方、降水日数は'+(days<0?'少なくなっています。':'近い水準にあります。');summary='一年に届く水の量と、雨や雪に出会う日数が、同じ動きをしていません。この土地では、水の恵みを受け取る量と、その機会の数の間にずれが生まれています。';}
  else if(other&&rain<0&&days>=0){headline='降水の日数が保たれても、届く水の量は少なくなっている';fact=place+'では、年間降水量が減る一方、降水日数は'+(days>0?'増えています。':'近い水準にあります。');summary='雨や雪に出会う日数と、一年に届く水の量が、同じ動きをしていません。降る機会の多さだけでは見えない水の減り方が、この土地の記録に現れています。';}
  else if(other&&rain>0&&days>0){headline='水が届く量も、降水の日数も増えている';fact=place+'では、年間降水量と降水日数が、初期より直近の複数年でともに増えています。';summary='この土地では、雨や雪に出会う機会と、一年に届く水の量がそろって増えています。水と関わる日々の条件が、量と頻度の両面で変わっていることが読み取れます。';}
  else if(other&&rain<0&&days<0){headline='水が届く量も、降水の日数も減っている';fact=place+'では、年間降水量と降水日数が、初期より直近の複数年でともに減っています。';summary='この土地では、雨や雪に出会う機会と、一年に届く水の量がそろって減っています。水と関わる日々の条件が、量と頻度の両面で変わっていることが読み取れます。';}
  else{headline=d?(key==='precipitation'?'この土地に届く水の量が変わっている':'雨や雪に出会う日数が変わっている'):'水の届き方は、年ごとの違いを伴って続いている';fact=place+'の'+metricNames[key]+'は、初期より直近の複数年で'+(d>0?'多くなっています。':d<0?'少なくなっています。':'近い水準となっています。');summary=d?'年ごとの多い少ないに加えて、複数年の水準にも違いが現れています。この土地の水を考えるとき、届く量と降る機会を合わせてたどることで、暮らしと水の関係を捉えられます。':'水の届き方には多い年・少ない年の違いがありますが、前後の複数年平均は近い水準にあります。この期間は、一方向の増減より、毎年異なる水の条件が記録に現れています。';}
 }
 const revised=prefectureCoCreationReading(key,details,place);
 const result=title(revised.headline||headline,revised.fact||fact,revised.summary||summary,details,evidenceRows,metrics);
 return {...result,logic:{evidence:result.calculation,inference:result.fact,implication:result.summary,limits:result.takeawayCaveat},futurePerspective:{focus:'human-earth-co-creation-and-future',basis:'既存の同一地域・前後期間と関連系列の比較',evidenceRecordIds:result.recordIds}};
}
