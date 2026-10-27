// Compatibility entry for the former 75-exhibit check. Production now has 100.
process.env.GAIA_QA_OUTPUT_DIR||=process.env.GAIA_MAP75_OUT;
await import('./check-map100-boundary-browser.mjs');
