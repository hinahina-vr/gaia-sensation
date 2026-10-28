/** 概要: データ探索機能の入口。各展示・背景演出・自動表示を読み込み、共通の探索機能を公開する。 */
import governor from "./lod-governor.js?v=gaia-budget-devices-1";
import { mount } from "./live-data.js?v=gaia-national-analysis-1-hourly-20260912";
import "./live-exhibits.js?v=whole-trends20-20261025";
import "./estat-exhibits.js?v=whole-trends20-20261025";
import "./firms-exhibit.js?v=earth01-05-20261025";
import "./planet-signals-exhibit.js?v=sharp-map-text-20261026";
import "./marine-cod-exhibit.js?v=whole-trends20-20261025";
import "./food-exhibits.js?v=whole-trends20-20261025";
import "./map-theme-background.js?v=intro-fade-gate-20261022";
import "./map-demo.js?v=intro-fade-gate-20261022";

import "./climate-history-exhibits.js?v=surface-release-2e596f2-20261028";

globalThis.GaiaExploration = Object.freeze({ governor, live: globalThis.GaiaLiveData });
void mount().catch((error) => console.error(error));
