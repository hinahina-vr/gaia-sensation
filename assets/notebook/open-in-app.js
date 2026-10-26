// Optional review link: open the same lab button after the map data is ready.
const originalHash = location.hash;
const deadline = performance.now() + 30000;
const openWhenReady = async () => {
  if (location.hash !== originalHash || performance.now() > deadline) return;
  const provider = globalThis.GaiaClimateHistory;
  const button = document.querySelector('[data-climate-analysis]');
  if (provider?.getState().dataState === 'ready' && provider.getStatisticsDataset()?.rows?.length && globalThis.GaiaModeLoader?.isLoaded('exploration') && button && !button.disabled) {
    await globalThis.GaiaModeLoader.load('statistics');
    if (location.hash === originalHash) button.click();
    return;
  }
  window.setTimeout(openWhenReady, 100);
};
openWhenReady();
