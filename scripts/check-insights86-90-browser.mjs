process.env.GAIA_INSIGHT_OUT='artifacts/insights86-90-20261027';
process.env.GAIA_INSIGHT_TARGETS=JSON.stringify([[86,'urban'],[87,'ageing'],[88,'childsurvival'],[89,'seaice'],[90,'snowcover']]);
await import('./check-insights75-80-browser.mjs');
