const finite=x=>typeof x==='number'&&Number.isFinite(x);
// Test daylight directly using the provider's is_day, never infer it from zero radiation.
export function cloudDayNightFinding(rows){
 const valid=rows.filter(r=>finite(r.value)&&r.value>=0&&finite(r.cloudCover)&&r.cloudCover>=0&&r.cloudCover<=100&&(r.isDay===0||r.isDay===1));
 const day=valid.filter(r=>r.isDay===1),night=valid.filter(r=>r.isDay===0);
 if(day.length<8||night.length<8)return null;
 let pair=null;
 for(const a of day)for(const b of night){const cloudGap=Math.abs(a.cloudCover-b.cloudCover),lightGap=a.value-b.value;if(cloudGap<=5&&a.value>=200&&b.value<=5&&(!pair||lightGap>pair.lightGap))pair={a,b,cloudGap,lightGap};}
 if(!pair)return null;
 const {a,b,cloudGap,lightGap}=pair;
 return{audience:'earth-context',takeawayLabel:'光を使える場所と時間',headline:'晴れた空があっても、太陽の恵みは同時に得られない',
  fact:'雲量がほぼ同じ地点どうしでも、昼の地点には強い日射が届き、夜の地点にはほとんど届いていません。雲の少なさがそろっても、受け取れる太陽エネルギーは大きく分かれています。',
  summary:'太陽光を暮らしに広く使うほど、光が届く時間と電気を使う時間のずれが重要になります。発電できる場所を増やすことに、エネルギーを蓄える技術や電気を使う時間の調整を組み合わせると、太陽の周期に合わせた暮らしをつくれます。',
  futurePerspective:{focus:'human-earth-co-creation-and-future',basis:'雲量をそろえた昼夜の日射差',evidenceRecordIds:[String(a.id),String(b.id)],limits:'発電・需要・蓄電の規模や最適な構成は未計算。'},
  status:'computed',metrics:[[a.label+'の短波放射',a.value,'W/m²'],[b.label+'の短波放射',b.value,'W/m²'],['雲量の差',cloudGap,'ポイント']],recordIds:[String(a.id),String(b.id)],
  interpretationBasis:{kind:'matched-cloud-day-night',dayId:String(a.id),nightId:String(b.id),dayCount:day.length,nightCount:night.length,dayCloud:a.cloudCover,nightCloud:b.cloudCover,cloudGap,lightGap},
  logic:{evidence:'雲量が近い昼夜の地点間でも日射が大きく異なる。昼夜は提供元のis_dayで確認。',inference:'光を受け取れる条件を、雲量だけでそろえることはできない。',background:'地球の自転によって昼夜が生じる。',implication:'昼夜の日射差を、蓄える技術や電気を使う時間を合わせる暮らしの選択へつなげる。',limits:'発電量・貯蔵量・将来の日射を計算していない。',sources:['https://open-meteo.com/en/docs']},
  calculation:'is_day=1/0を提供元から取得。両群8地点以上、雲量差5ポイント以内、昼200W/m²以上・夜5W/m²以下の組から日射差最大を抽出。探索用の比較条件で、雲の因果効果は推定しない。',
  takeawayCaveat:'同時点の雲量・日射・昼夜のモデル情報を比較しています。昼夜は提供元の情報で確認しています。'};
}
