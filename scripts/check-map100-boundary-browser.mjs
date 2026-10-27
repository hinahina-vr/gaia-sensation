// Public route and wraparound regression after expanding production to 100.
process.env.GAIA_100_TARGETS='[100]';
await import('./check-map-through100-browser.mjs');
