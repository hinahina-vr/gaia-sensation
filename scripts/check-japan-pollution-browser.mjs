process.env.JAPAN_POLLUTION_QA = "1";
process.env.GAIA_OUTPUT_DIR ||= "artifacts/japan-pollution-2026-09-09/browser";
await import("./check-japan-sensor-open-browser.mjs");
