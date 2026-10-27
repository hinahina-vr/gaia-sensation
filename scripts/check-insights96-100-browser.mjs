process.env.GAIA_INSIGHT_OUT='artifacts/insights96-100-20261027';
process.env.GAIA_INSIGHT_TARGETS=JSON.stringify([[96,'wateruse'],[97,'hunger'],[98,'fisheries'],[99,'internet'],[100,'refugees']]);
await import('./check-insights75-80-browser.mjs');
