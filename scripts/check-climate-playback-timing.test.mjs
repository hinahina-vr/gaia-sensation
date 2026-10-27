import{test}from'node:test';import assert from'node:assert/strict';import{climatePlaybackInterval}from'../src/exploration/climate-playback-timing.js';
test('only forest history advances each 1.8 seconds; all other chapters keep 6.5 seconds',()=>{
 assert.equal(climatePlaybackInterval('foresthistory'),1800);
 for(const id of['cyclones','coral','lakes','waterstore','sealevel','electricity','drinking','sanitation','unknown'])assert.equal(climatePlaybackInterval(id),6500);
});
