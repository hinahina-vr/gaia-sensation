(() => {
  "use strict";

  const expectedSceneCounts = Object.freeze({
    festival_concept: 72,
    map_mode01: 43,
    gx_experience: 47,
    esp32_pitch: 52,
    circle_invitation: 80,
    welcome_chat: 86,
  });

  const gallery = Object.freeze([
    {
      id: "first-encounter",
      title: "はじめまして",
      chapter: "01｜海辺の屋外展示",
      unlockStepId: "festival_concept_015",
      assetPath: "assets/visuals-07/event-cg-first-encounter-five-plane-v3.png",
      mobileAssetPath: "assets/visuals-07/event-cg-first-encounter-five-plane-mobile-v2.png",
      alt: "海辺の展示ブースで、ミズハとアマネに初めて出会う",
    },
    {
      id: "amane-closeup",
      title: "振り向いた光",
      chapter: "01｜海辺の屋外展示",
      unlockStepId: "festival_concept_021",
      assetPath: "assets/visuals-07/event-cg-amane-closeup-five-plane-v4.png",
      alt: "展示機材へ手を添え、穏やかに振り向くアマネ",
    },
    {
      id: "mizuha-closeup",
      title: "海色のまなざし",
      chapter: "01｜海辺の屋外展示",
      unlockStepId: "festival_concept_023",
      assetPath: "assets/visuals-07/event-cg-mizuha-closeup-five-plane-v3.png",
      alt: "タブレット越しにこちらを見つめるミズハ",
    },
    {
      id: "esp32-collaboration",
      title: "手のひらから始まる地球",
      chapter: "04｜ESP32プロトタイプ",
      unlockStepId: "esp32_pitch_008",
      assetPath: "assets/visuals-07/event-cg-esp32-collaboration-v2.png",
      mobileAssetPath: "assets/visuals-07/event-cg-esp32-collaboration-mobile-v1.png",
      alt: "ESP32とセンサーを囲み、ミズハとアマネが試作を考える",
    },
    {
      id: "circle-welcome",
      title: "ようこそ、同じ円へ",
      chapter: "05｜サークルへの招待",
      unlockStepId: "circle_invitation_048",
      assetPath: "assets/visuals-07/event-cg-circle-welcome-v2.png",
      mobileAssetPath: "assets/visuals-07/event-cg-circle-welcome-mobile-v1.png",
      alt: "秋晴れの展示ブースで、サークル加入を迎えるミズハとアマネ",
    },
    {
      id: "exhibition-finale",
      title: "展示会の、その先へ",
      chapter: "06｜はじめまして",
      unlockStepId: "welcome_chat_094",
      assetPath: "assets/ending-candidates-20260909/01-turning-in-the-sunset.webp",
      mobileAssetPath: "assets/ending-candidates-20260909/01-turning-in-the-sunset.webp",
      alt: "夕日の海沿いを歩きながら、ミズハとアマネがこちらを振り返る",
    },
  ].map((entry) => Object.freeze(entry)));

  const limitedStory = Object.freeze([
    { id: "festival-convention-hall-entrance", sceneId: "festival_concept", from: 1, to: 7, assetPath: "assets/visuals-07/novel-bg-convention-hall-entrance-autumn-morning-v2.png", motion: "push-in" },
    { id: "festival-b-hall-overview", sceneId: "festival_concept", from: 8, to: 9, assetPath: "assets/visuals-07/novel-bg-festival-b-hall-autumn-morning-v1.png", motion: "push-in" },
    { id: "festival-gaia-five-plane-projection", sceneId: "festival_concept", from: 10, to: 12, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "push-in" },
    { id: "festival-gaia-booth-approach", sceneId: "festival_concept", from: 13, to: 14, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-left" },
    { id: "festival-first-encounter-cg", sceneId: "festival_concept", from: 15, to: 20, assetPath: "assets/visuals-07/event-cg-first-encounter-five-plane-v3.png", motion: "event-focus", presentation: "event-cg", galleryId: "first-encounter" },
    { id: "festival-amane-closeup-cg", sceneId: "festival_concept", from: 21, to: 22, assetPath: "assets/visuals-07/event-cg-amane-closeup-five-plane-v4.png", motion: "event-focus", presentation: "event-cg", galleryId: "amane-closeup" },
    { id: "festival-mizuha-closeup-cg", sceneId: "festival_concept", from: 23, to: 27, assetPath: "assets/visuals-07/event-cg-mizuha-closeup-five-plane-v3.png", motion: "event-focus", presentation: "event-cg", galleryId: "mizuha-closeup" },
    { id: "festival-gaia-booth-conversation", sceneId: "festival_concept", from: 28, to: 75, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-left" },
    { id: "festival-map-transition", sceneId: "festival_concept", from: 76, to: 76, assetPath: "assets/visuals-07/event-cg-festival-map-transition-five-plane-v3.png", motion: "event-focus", presentation: "event-cg" },
    { id: "map01-co2-observation", sceneId: "map_mode01", from: 1, to: 14, assetPath: "assets/visuals-07/event-cg-festival-map-transition-five-plane-v3.png", motion: "drift-right", presentation: "event-cg" },
    { id: "map01-temperature-observation", sceneId: "map_mode01", from: 15, to: 28, assetPath: "assets/visuals-07/novel-bg-gx-temperature-anomaly-autumn-morning-v3.png", motion: "push-in" },
    { id: "map01-data-provenance", sceneId: "map_mode01", from: 29, to: 40, assetPath: "assets/visuals-07/novel-bg-map01-data-provenance-autumn-morning-v3.png", motion: "drift-left" },
    { id: "map01-exhibition-return", sceneId: "map_mode01", from: 41, to: 43, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-right" },
    { id: "gx-ocean-entry", sceneId: "gx_experience", from: 1, to: 16, assetPath: "assets/visuals-07/novel-bg-gx-ancient-ocean-autumn-morning-v3.png", motion: "push-in", transition: "crossfade" },
    { id: "gx-native-deep-time", sceneId: "gx_experience", from: 17, to: 17, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-right" },
    { id: "gx-exhibition-return", sceneId: "gx_experience", from: 18, to: 18, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "push-in" },
    { id: "gx-ancient-ocean", sceneId: "gx_experience", from: 19, to: 29, assetPath: "assets/visuals-07/mode-abstract-v1.webp", motion: "drift-right" },
    { id: "gx-coevolution", sceneId: "gx_experience", from: 30, to: 41, assetPath: "assets/visuals-07/novel-bg-gx-breathing-points-autumn-morning-v3.png", motion: "drift-left" },
    { id: "gx-present-return", sceneId: "gx_experience", from: 42, to: 44, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "push-in" },
    { id: "gx-ten-mode-gateway", sceneId: "gx_experience", from: 55, to: 58, assetPath: "assets/visuals-07/novel-bg-gx-mode-gateway-autumn-morning-v4.png", motion: "push-in" },
    { id: "esp32-exhibition-opening", sceneId: "esp32_pitch", from: 1, to: 7, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-left" },
    { id: "esp32-exhibition-proposal", sceneId: "esp32_pitch", from: 8, to: 18, assetPath: "assets/visuals-07/event-cg-esp32-collaboration-v2.png", motion: "event-focus", presentation: "event-cg", galleryId: "esp32-collaboration" },
    { id: "esp32-system-design", sceneId: "esp32_pitch", from: 19, to: 26, assetPath: "assets/architecture/gaia-field-sensor-whiteboard-20260912.png", mobileAssetPath: "assets/architecture/gaia-field-sensor-whiteboard-20260912.png", motion: "drift-left" },
    { id: "esp32-co-created-prototype", sceneId: "esp32_pitch", from: 27, to: 38, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-right" },
    { id: "esp32-exhibition-return", sceneId: "esp32_pitch", from: 39, to: 43, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "push-in" },
    { id: "circle-closing-exhibition", sceneId: "circle_invitation", from: 1, to: 10, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "push-in" },
    { id: "circle-private-invitation", sceneId: "circle_invitation", from: 11, to: 28, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-left" },
    { id: "circle-invitation-card-cg", sceneId: "circle_invitation", from: 29, to: 47, assetPath: "assets/visuals-07/event-cg-circle-invitation-card-v3.png", motion: "event-focus", presentation: "event-cg" },
    { id: "circle-welcome-cg", sceneId: "circle_invitation", from: 48, to: 66, assetPath: "assets/visuals-07/event-cg-circle-welcome-v2.png", motion: "event-focus", presentation: "event-cg", galleryId: "circle-welcome" },
    { id: "circle-after-welcome", sceneId: "circle_invitation", from: 67, to: 81, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-right" },
    { id: "welcome-online-arrival", sceneId: "welcome_chat", from: 1, to: 20, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-left" },
    { id: "welcome-online-esp32-thread", sceneId: "welcome_chat", from: 21, to: 40, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-right" },
    { id: "welcome-co-created-future", sceneId: "welcome_chat", from: 41, to: 54, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "push-in" },
    { id: "welcome-physical-booth", sceneId: "welcome_chat", from: 55, to: 68, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-left" },
    { id: "welcome-booth-packdown", sceneId: "welcome_chat", from: 69, to: 73, assetPath: "assets/visuals-07/novel-bg-festival-five-plane-projection-autumn-morning-v2.png", motion: "drift-right" },
    { id: "welcome-night-exit-mobile", sceneId: "welcome_chat", from: 74, to: 83, assetPath: "assets/ending-candidates-20260909/01-turning-in-the-sunset.webp", motion: "drift-left", presentation: "event-cg" },
    { id: "welcome-earth-partner-reflection", sceneId: "welcome_chat", from: 84, to: 91, assetPath: "assets/ending-candidates-20260909/01-turning-in-the-sunset.webp", motion: "push-in", presentation: "event-cg" },
    { id: "welcome-exhibition-finale-cg", sceneId: "welcome_chat", from: 92, to: 95, assetPath: "assets/ending-candidates-20260909/01-turning-in-the-sunset.webp", motion: "event-focus", presentation: "event-cg", galleryId: "exhibition-finale" },
  ].map((cue) => Object.freeze(cue)));

  const sceneIds = Object.freeze(Object.keys(expectedSceneCounts));
  const numberedStep = (step) => {
    const match = new RegExp(`^${step?.sceneId}_(\\d{3})(?:[a-z])?$`).exec(String(step?.id || ""));
    return match ? Number(match[1]) : null;
  };

  const forStep = (step) => {
    if (!sceneIds.includes(step?.sceneId)) {
      throw new Error(`[GAIA novel] Unknown contest-v10 background scene for ${step?.id || "unknown step"}`);
    }
    const cueStep = step?.cueFromStepId ? { ...step, id: step.cueFromStepId } : step;
    const number = numberedStep(cueStep);
    const cue = number === null ? null : limitedStory.find((candidate) => (
      candidate.sceneId === step.sceneId && number >= candidate.from && number <= candidate.to
    ));
    if (!cue) throw new Error(`[GAIA novel] Missing contest-v10 background cue for ${step?.id || "unknown step"}`);
    if (!cue.assetPath) throw new Error(`[GAIA novel] Missing approved contest-v10 background asset for ${step.id} (${cue.id})`);
    if (!cue.motion) throw new Error(`[GAIA novel] Missing contest-v10 background motion for ${step.id} (${cue.id})`);
    return cue;
  };

  globalThis.GAIA_NOVEL_BACKGROUND_CUES = Object.freeze({
    expectedSceneCounts,
    sceneIds,
    limitedStory,
    gallery,
    // Compatibility aliases retained for the current runtime while the route is v10-only.
    productionYear: Object.freeze([]),
    backHalf: limitedStory,
    backHalfSceneIds: sceneIds,
    forStep,
  });
})();
