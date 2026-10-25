import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SEA_ARRIVAL_MS,seaArrival,seaSigned,seaStem,spacedSeaStations,seaCallout} from '../src/exploration/sea-level-marks.js';
import {decodeTides} from '../src/exploration/sea-level-stations.js';

test('Sea marks preserve all signed source values and genuine missing observations',()=>{
  const data=decodeTides(JSON.parse(fs.readFileSync('data/atlas-history/sealevel-stations.json'))),before=JSON.stringify(data);
  for(const p of data.regions)for(const row of p.years){
    if(row.value===null){assert.equal(seaSigned(row.value),'欠測');assert.equal(seaStem(row.value),0);}
    else{assert.equal(seaSigned(row.value),`${row.value.toLocaleString('ja-JP',{maximumFractionDigits:1,signDisplay:'exceptZero'})} mm`);assert.equal(seaStem(row.value),Math.max(-20,Math.min(20,row.value/15)));}
  }
  assert.equal(JSON.stringify(data),before);assert.equal(seaSigned(0),'0 mm');assert.equal(seaSigned(-.01),'0 mm');assert.equal(seaSigned(420),'+420 mm');assert.equal(seaStem(420),20);assert.equal(seaStem(-420),-20);
});
test('Neighbouring-bin collisions are removed, selection wins, and values cannot reshuffle points',()=>{
  const p=(id,x,y,value)=>({r:{id:`tide-${id}`,stationId:id},x,y,value});
  const input=[p(1,9.9,10,10),p(2,10.1,10,20),p(3,31,10,null),p(4,32,9,-300),p(5,52,20,0)];
  const pick=rows=>spacedSeaStations(rows,'tide-2',10);
  const result=pick(input);assert.deepEqual(result.map(p=>p.r.id),['tide-3','tide-5','tide-2']);
  assert.deepEqual(pick([...input].reverse().map(p=>({...p,value:null}))).map(p=>p.r.id),result.map(p=>p.r.id));
  for(const a of result)for(const b of result)if(a!==b)assert(Math.hypot(a.x-b.x,a.y-b.y)>=10);
});
test('Arrival is monotonic, settles in 950ms, and reduced motion is immediate',()=>{
  for(const lon of [-180,-90,0,135,180]){let previous=0;for(let ms=0;ms<=SEA_ARRIVAL_MS;ms+=10){const next=seaArrival(ms,lon,false);assert(next>=previous);previous=next;}assert.equal(previous,1);assert.equal(seaArrival(60000,lon,false),1);assert.equal(seaArrival(0,lon,true),1);}
});
test('A selected coastal reading stays within narrow and wide map edges',()=>{
  for(const width of [320,390,1440])for(const x of [18,width/2,width-18]){
    const label=seaCallout(x,400,width);assert(label.left>=16);assert(label.right<=width-16);assert(label.maxWidth>=40);assert.equal(label.nameY,371);assert.equal(label.valueY,393);
  }
});
