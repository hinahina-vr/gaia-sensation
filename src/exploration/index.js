/** 概要: データ探索機能の入口。各展示・背景演出・自動表示を読み込み、共通の探索機能を公開する。 */
import governor from "./lod-governor.js?v=gaia-budget-devices-1";
import { mount } from "./live-data.js?v=gaia-national-analysis-1-hourly-20260912";
import "./live-exhibits.js?v=gaia-map-polish-1-live-red-1-footer-credit-1-credit-clearance-1-marine-cod-1-status-place-20260909-fao-food-1-hourly-20260912-prefecture-fill-20260912-unified-playback-20260912-i18n-20260913";
import "./estat-exhibits.js?v=gaia-map-polish-1-marine-cod-1-perf-high-20260909-fao-food-1-unified-playback-20260912-i18n-20260913";
import "./firms-exhibit.js?v=gaia-firms-cruise-animation-20260914-wind-first-tooltip-20260925";
import "./planet-signals-exhibit.js?v=gaia-map-polish-1-live-red-1-footer-credit-1-marine-cod-1-fao-food-1-i18n-20260913-wind-strength-color-20260913-wind-first-tooltip-20260925";
import "./marine-cod-exhibit.js?v=gaia-marine-cod-1-cod-ui-20260909-japan-sensor-open-1-pollution-1-title-poi-20260909-perf-high-20260909-prtr-biology-1-fao-food-1-unified-playback-20260912-exhibit-links-20260912-i18n-20260913-status-right-20260913";
import "./food-exhibits.js?v=fao-food-1-food-country-fill-20260910-unified-playback-20260912-i18n-20260913";
import "./map-theme-background.js?v=theme-background-20260912-wind-first-tooltip-20260925";
import "./map-demo.js?v=gaia-firms-cruise-animation-20260914-wind-first-tooltip-20260925";

globalThis.GaiaExploration = Object.freeze({ governor, live: globalThis.GaiaLiveData });
void mount().catch((error) => console.error(error));
