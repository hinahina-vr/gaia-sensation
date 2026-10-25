// Keep the displayed observation set when opening the lazily loaded lab.
// A late module response must not open the previous exhibit's analysis.
export async function openObservationAnalysis(dataset,isCurrent) {
  if(!dataset||!isCurrent())return false;
  globalThis.GaiaMapPlayback?.stop('analysis');
  try {
    if(!globalThis.GaiaStatisticsLab?.open)await globalThis.GaiaModeLoader?.load('statistics');
    if(!isCurrent()||!globalThis.GaiaStatisticsLab?.open)return false;
    await globalThis.GaiaStatisticsLab.open({modeId:dataset.modeId,datasetId:dataset.id,dataset});
    return true;
  }catch(error){console.warn('Observation analysis could not open',error);return false;}
}
