process.env.GAIA_INSIGHT_OUT='artifacts/insights81-85-20261027';
process.env.GAIA_INSIGHT_TARGETS=JSON.stringify([[81,'waterstress'],[82,'cropland'],[83,'yield'],[84,'fertilizer'],[85,'longevity']]);
await import('./check-insights75-80-browser.mjs');
