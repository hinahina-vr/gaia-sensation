// RFC 4180 quoted fields, including NSIDC's comma-separated source_dataset.
export function csvRows(text) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&(c===','||c==='\n')){row.push(cell.trim());cell='';if(c==='\n'){if(row.some(Boolean))rows.push(row);row=[];}}
    else if(c!=='\r')cell+=c;
  }
  if(quoted)throw Error('Unclosed CSV quote');
  if(cell||row.length){row.push(cell.trim());rows.push(row);}return rows;
}
export function iceRecords(text) {
  const [headers,...rows]=csvRows(text),index=headers.indexOf('extent');
  if(index<0||headers[0]!=='year'||headers[1]!=='mo')throw Error('NSIDC schema changed');
  return rows.map(r=>({year:Number(r[0]),month:Number(r[1]),value:r[index]!==''&&Number(r[index])>=0?Number(r[index]):null}));
}
export function snowRecords(text) {
  return text.trim().split(/\r?\n/).map(line=>{
    const [year,month,km2,...extra]=line.trim().split(/\s+/).map(Number);
    if(extra.length||!Number.isInteger(year)||!Number.isInteger(month)||month<1||month>12||!Number.isFinite(km2))throw Error('Rutgers schema changed');
    return {year,month,value:km2<0?null:km2/1e6};
  });
}
export function monthlyYears(records,start,end) {
  const byMonth=new Map();for(const r of records){const key=`${r.year}/${r.month}`;if(byMonth.has(key))throw Error(`Duplicate month ${key}`);byMonth.set(key,r.value);}
  return Array.from({length:end-start+1},(_,i)=>({year:start+i,monthValues:Array.from({length:12},(_,m)=>byMonth.get(`${start+i}/${m+1}`)??null)}));
}
