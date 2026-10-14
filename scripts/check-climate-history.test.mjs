import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { csvFields, measurement, cycloneColumns, cycloneRecord, parseCoral, summarizeCyclones } from './lib/climate-history-data.mjs';
import { windMS, colorFor, daysInYear, statisticsFor, coralInsight } from '../src/exploration/climate-history-model.js';
const read=file=>JSON.parse(fs.readFileSync(`data/climate-history/${file}.json`));
test('Missing values, quoted CSV and one-minute wind conversion',()=>{
  assert.deepEqual(csvFields('a,"b,c","d""e", '),['a','b,c','d"e','']);
  assert.equal(measurement(''),null);assert.equal(measurement('-999'),null);assert.equal(measurement('0'),0);
  assert.equal(windMS(null),null);assert.equal(windMS(100),1852/36);assert.equal(colorFor('coral',null),'#81979e');
  assert.notEqual(colorFor('coral',null),colorFor('coral',0));
  const columns=cycloneColumns('SID,SEASON,NAME,BASIN,ISO_TIME,LAT,LON,USA_WIND,WMO_PRES,TRACK_TYPE,USA_AGENCY');
  assert.equal(cycloneRecord('x,2016,X,SP,2016-01-01 00:00:00,-10,181,50,990,main,jtwc',columns).point[2],-179);
  assert.equal(cycloneRecord('x,2016,X,SP,2016-01-01 00:00:00,-10,181,50,990,spur,jtwc',columns),null);
  assert.throws(()=>cycloneColumns('SID,SEASON'),/Missing/);
});
test('NOAA region aggregation does not mistake a truncated row for zero DHW',()=>{
  const text='Name:\nTest\nPolygon Middle Longitude:\n140\nPolygon Middle Latitude:\n25\nYYYY MM DD SST_MIN SST_MAX SST@90th_HS SSTA@90th_HS 90th_HS>0 DHW_from_90th_HS>1 BAA_7day_max\n2016 01 01 20 25 23 2 1 8 4\n2016 01 02 20 25 23\n2016 01 03 20 25 23 2 1 0 0';
  const r=parseCoral(text,'test').years[0];assert.equal(r.validDays,2);assert.equal(r.max,8);assert.equal(r.days8,1);assert.equal(r.days4,1);assert.equal(r.monthly[1],null);
  assert.throws(()=>parseCoral(text+'\n2016 01 03 20 25 23 2 1 0 0','test'),/Duplicate/);
});
test('Every generated cyclone season matches its hash and summary, no duplicate times or unwrapped longitude',()=>{
  const manifest=read('cyclones');assert.equal(manifest.years.length,45);
  for(const item of manifest.years){
    const raw=fs.readFileSync(`data/climate-history/cyclones/${item.year}.json`),data=JSON.parse(raw);
    assert.equal(createHash('sha256').update(raw).digest('hex'),item.sha256);
    assert.deepEqual(summarizeCyclones(data.storms),Object.fromEntries(['count','measured','maximum','strongest'].map(k=>[k,item[k]])));
    for(const storm of data.storms){assert.equal(new Set(storm.points.map(p=>p[0])).size,storm.points.length);assert(storm.points.every(p=>Math.abs(p[1])<=90&&Math.abs(p[2])<=180&&(p[3]===null||p[3]>=0)));}
  }
});
test('214 coral regions, exact raw-data recalculation and complete-year statistics',()=>{
  const data=read('coral');assert.equal(data.regions.length,214);assert.equal(new Set(data.regions.map(r=>r.id)).size,214);
  for(const region of data.regions)for(const row of region.years){assert(row.validDays<=daysInYear(row.year));assert(row.days8<=row.days4&&row.days4<=row.validDays);assert.equal(row.max,Math.max(...row.monthly.filter(Number.isFinite)));}
  const region=data.regions.find(r=>r.id==='southern_ryukyu_islands');
  const rawPath='artifacts/climate-source-cache/southern_ryukyu_islands.txt';
  if(fs.existsSync(rawPath)) assert.deepEqual(parseCoral(fs.readFileSync(rawPath,'utf8'),region.id),region);
  const row=region.years.find(y=>y.year===2016);assert.equal(row.max,11.4271);assert.equal(row.days8,64);assert.equal(row.validDays,366);
  assert(coralInsight(region,row).includes('64日'));
  const dataset=statisticsFor({kind:'coral',data,region});assert(dataset.rows.length>=35);assert(dataset.rows.every(r=>region.years.find(y=>y.year===r.year).validDays===daysInYear(r.year)));
});
