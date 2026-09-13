import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const meta=JSON.parse(fs.readFileSync('data/story-temperature-annual.json','utf8'));
const bytes=fs.readFileSync('data/story-temperature-annual.bin');
assert.equal(bytes.length,68*90*180*2);
assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.binarySha256);
assert.equal(meta.baseline,'1951–1980');
assert.deepEqual(meta.frames.map(f=>f.year),Array.from({length:68},(_,i)=>1958+i));
const sourcePath=process.argv[2] || 'artifacts/story-temperature-2026-09-10/gistemp1200_GHCNv4_ERSSTv5.nc.gz';
let rawChecks=0;
if(fs.existsSync(sourcePath)) {
  const gzip=fs.readFileSync(sourcePath);
  assert.equal(createHash('sha256').update(gzip).digest('hex'),meta.sourceSha256);
  const original=gunzipSync(gzip);
  // Independent reads against the recorded source's inspected NetCDF header.
  assert.equal(original.toString('ascii',0,3),'CDF');
  const timeOffset=2180, temperatureOffset=23288, monthCount=1759;
  const dates=Array.from({length:monthCount},(_,i)=>new Date(Date.UTC(1800,0,1)+original.readInt32BE(timeOffset+i*4)*86400000));
  for(let year=1958;year<=2025;year++) {
    const indices=dates.map((d,i)=>d.getUTCFullYear()===year?i:-1).filter(i=>i>=0);
    assert.equal(indices.length,12);
    for(const [r,c] of [[0,0],[0,100],[27,159],[37,59],[60,12],[80,90],[89,179]]) {
      const monthly=indices.map(i=>original.readInt16BE(temperatureOffset+(i*16200+(89-r)*180+c)*2));
      const actual=bytes.readInt16LE(((year-1958)*16200+r*180+c)*2);
      if(monthly.includes(32767)) assert.equal(actual,32767);
      else assert(Math.abs(actual-monthly.reduce((a,b)=>a+b,0)/12)<=.501,`${year} ${r},${c}: source mean vs display`);
      rawChecks++;
    }
  }
}
for(const [i,frame] of meta.frames.entries()) {
  let valid=0;
  for(let cell=0;cell<16200;cell++) {
    const v=bytes.readInt16LE((i*16200+cell)*2);
    if(v!==32767) {valid++;assert(Math.abs(v)<2000);}
  }
  assert.equal(valid,frame.validCells);
}
await import('../novel-story-data.js');
await import('../novel-background-cues.js');
const step=GAIA_NOVEL_STORY.scenes.flatMap(s=>s.steps).find(s=>s.id==='map_mode01_024');
assert(GAIA_NOVEL_BACKGROUND_CUES.forStep(step).assetPath.includes('temperature-anomaly'));
console.log(`PASS 68 years / 1,101,600 grid cells / ${rawChecks} independent raw monthly-average checks / correct story cue`);
