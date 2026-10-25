// Realtime analyses save the observations they actually used, rather than
// silently reusing a later response with the same dataset ID.
const MODES=Object.freeze({
  'planet-global-wind-pressure':'global-wind-pressure',
  'planet-usgs-earthquake-ripples':'usgs-earthquake-ripples',
  'planet-global-aerosol-light':'global-aerosol-light',
  'planet-global-cloud-radiance':'global-cloud-radiance',
  'nasa-firms-active-fire-24h':'nasa-firms',
  'live-wind-field':'wind-field',
  'live-carbon-pulse':'carbon-pulse',
  'live-rain-chorus':'rain-chorus',
  'live-temperature-field':'temperature-field',
  'live-cloud-drift':'cloud-drift',
  'live-pm25-haze':'pm25-haze',

});
const valid=dataset=>dataset && MODES[dataset.id]===dataset.modeId && dataset.insightContext?.snapshotAnalysis===true
  && Array.isArray(dataset.rows) && dataset.rows.length>0 && dataset.rows.length<=5000
  && dataset.rows.every(r=>r&&typeof r.id==='string'&&typeof r.value==='number'&&Number.isFinite(r.value)&&r.provenance==='SOURCE');
const clone=dataset=>JSON.parse(JSON.stringify(dataset));
export function snapshotObservationDataset(dataset) {
  if(!valid(dataset))return null;
  const body=JSON.stringify(dataset);if(new TextEncoder().encode(body).length>1_000_000)return null;
  return {schemaVersion:1,dataset:JSON.parse(body)};
}
export function restoreObservationSnapshot(snapshot,datasetId) {
  if(snapshot?.schemaVersion!==1||snapshot.dataset?.id!==datasetId||!valid(snapshot.dataset))return null;
  if(new TextEncoder().encode(JSON.stringify(snapshot.dataset)).length>1_000_000)return null;
  return clone(snapshot.dataset);
}
