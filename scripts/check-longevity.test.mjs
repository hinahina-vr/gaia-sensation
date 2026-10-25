import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {longevityReading,longevityHistory,longevityDomain,longevityFormat,longevitySourceId,longevityData,longevityChartYear,longevityArrival} from '../src/exploration/longevity-comparison.js';
import {atlasDefinition,atlasStatistics} from '../src/exploration/atlas-history-model.js';
const bytes=fs.readFileSync('data/atlas-history/longevity.json'),data=JSON.parse(bytes),country=id=>data.regions.find(r=>r.id===id);
test('85 retains all 5425 source values including values below the map color range',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'24e77dfee230d0d447aff6f4543fc35cc30d3c64d705be70ac92cf076809e38c');assert.equal(data.regions.length,217);
 let count=0,low=0;for(const r of data.regions){const domain=longevityDomain(r,country('USA'));for(const row of r.years){count++;assert.equal(longevityReading(r,row.year).value,row.value);assert(row.value>=domain[0]&&row.value<=domain[1]);if(row.value<40)low++;}}
 assert.equal(count,5425);assert.equal(low,7);assert.equal(longevityReading(country('CAF'),2009).value,14.665);assert.equal(longevityFormat(14.665),'14.7');
});
test('shared full-period domain and change preserve numerical meaning',()=>{
 assert.deepEqual(longevityReading(country('JPN'),2016),{value:83.9849,base:81.0761,change:2.9088});
 assert.deepEqual(longevityDomain(country('JPN'),country('USA')),[70,90]);assert.deepEqual(longevityDomain(country('JPN'),country('IND')),[60,90]);
 assert.equal(longevityFormat(null),'欠測');assert.equal(longevityFormat(0),'0.0');
 const missing={years:[{year:2000,value:null},{year:2001,value:55},{year:2002,value:null},{year:2003,value:56},{year:2004,value:57}]};
 assert.equal(longevityReading(missing,2001).change,null);assert.equal(longevityHistory(missing).segments.length,1);assert.equal(longevityHistory(missing).points.length,3);assert.deepEqual(longevityDomain({years:[]}),[0,100]);
});
test('display names and source country aliases preserve the original source object',()=>{
 const copy=longevityData(data);assert.equal(longevityData(data),copy);assert.equal(country('CHI').name,'JG');assert.equal(copy.regions.find(r=>r.id==='CHI').name,'チャネル諸島');
 for(const [geometry,source] of [['KOS','XKX'],['JEY','CHI'],['GGY','CHI'],['PSX','PSE'],['SDS','SSD']])assert.equal(longevitySourceId(geometry),source);
 const definition=atlasDefinition('longevity');assert.equal(definition.countryGlyphs,false);assert.equal(definition.code,'SP.DYN.LE00.IN');
 const stats=atlasStatistics(definition,data,country('JPN'));assert.deepEqual(stats.provenance,['SOURCE']);assert.equal(stats.rows.find(r=>r.year===2016).y,83.9849);assert.equal(stats.rows.length,25);
});
test('year hit areas and arrival support tap, edges and full monotonic fade',()=>{
 for(let year=2000;year<=2024;year++)assert.equal(longevityChartYear((54+(year-2000)/24*526)/600),year);
 assert.equal(longevityChartYear(-1),2000);assert.equal(longevityChartYear(3),2024);assert.equal(longevityArrival(0,217,-1,true),0);assert.equal(longevityArrival(216,217,0,true),1);assert.equal(longevityArrival(216,217,1100),1);
 let previous=0;for(let t=0;t<=1100;t+=10){const alpha=longevityArrival(100,217,t);assert(alpha>=previous);previous=alpha;}
});
