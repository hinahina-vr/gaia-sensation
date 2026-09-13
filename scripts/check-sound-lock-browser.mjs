// Compatibility entry for the former listening-gated catalog test.
// The owner now requires all 12 tracks to be available from the first visit.
if (process.argv[2]) process.env.GAIA_BASE_URL = process.argv[2];
if (process.argv[3]) process.env.GAIA_OUTPUT_DIR = process.argv[3];
await import('./check-sound-slim-unlocked-browser.mjs');
