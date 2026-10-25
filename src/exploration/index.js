/** 概要: データ探索機能の入口。各展示・背景演出・自動表示を読み込み、共通の探索機能を公開する。 */
import governor from "./lod-governor.js?v=gaia-budget-devices-1";
import { mount } from "./live-data.js?v=gaia-national-analysis-1-hourly-20260912";
import "./live-exhibits.js?v=live-reading-20261020-quality-20261022";
import "./estat-exhibits.js?v=intro-fade-gate-20261022-quality-20261022";
import "./firms-exhibit.js?v=intro-fade-gate-20261022";
import "./planet-signals-exhibit.js?v=intro-fade-gate-20261022";
import "./marine-cod-exhibit.js?v=records-reading-20261022";
import "./food-exhibits.js?v=food70-earth-20261025";
import "./map-theme-background.js?v=intro-fade-gate-20261022";
import "./map-demo.js?v=intro-fade-gate-20261022";

import "./climate-history-exhibits.js?v=through75-20261025";

globalThis.GaiaExploration = Object.freeze({ governor, live: globalThis.GaiaLiveData });
void mount().catch((error) => console.error(error));
