process.env.GAIA_INSIGHT_OUT='artifacts/insights91-95-20261027';
process.env.GAIA_INSIGHT_TARGETS=JSON.stringify([[91,'oceanheat'],[92,'ozone'],[93,'glaciers'],[94,'volcanoes'],[95,'tsunamis']]);
await import('./check-insights75-80-browser.mjs');
