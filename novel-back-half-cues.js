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

  const sceneIds = Object.freeze(Object.keys(expectedSceneCounts));
  const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze(row)));
  const stepIds = (sceneId, from, to) => Object.freeze(Array.from(
    { length: to - from + 1 },
    (_, index) => `${sceneId}_${String(from + index).padStart(3, "0")}`,
  ));

  // The playback duration remains separate from the owner-authored in-world festival clock.
  const temporal = freezeRows([
    { id: "festival-concept-current", sceneId: "festival_concept", from: 1, to: 76, context: "CURRENT", precision: "MINUTE", date: "10月3日（土）", time: "13:00–13:40", duration: "0:00–1:45", dayPeriod: "PM", location: "オンライン大学・年次対面イベント／海側広場・学生作品展示" },
    { id: "map01-current", sceneId: "map_mode01", from: 1, to: 43, context: "CURRENT", precision: "MINUTE", date: "10月3日（土）", time: "13:40–14:20", duration: "1:45–3:25", dayPeriod: "PM", location: "展示端末・地図MODE 01" },
    { id: "gx-current", sceneId: "gx_experience", from: 1, to: 58, context: "CURRENT", precision: "MINUTE", date: "10月3日（土）", time: "14:20–15:00", duration: "3:25–5:35", dayPeriod: "PM", location: "展示端末・GX／太古の海" },
    { id: "esp32-current", sceneId: "esp32_pitch", from: 1, to: 43, context: "CURRENT", precision: "MINUTE", date: "10月3日（土）", time: "15:00–15:30", duration: "5:35–7:15", dayPeriod: "PM", location: "年次対面イベント・GAIA SENSEWARE展示ブース" },
    { id: "circle-invitation-current", sceneId: "circle_invitation", from: 1, to: 81, context: "CURRENT", precision: "MINUTE", date: "10月3日（土）", time: "15:30–15:40", duration: "7:15–9:05", dayPeriod: "PM", location: "年次対面イベント・GAIA SENSEWARE展示ブース" },
    { id: "welcome-current", sceneId: "welcome_chat", from: 1, to: 73, context: "CURRENT", precision: "MINUTE", date: "10月3日（土）", time: "15:40–17:10", duration: "9:05–11:30", dayPeriod: "PM", location: "学内チャット『惑星の放課後』／展示ブース・撤収作業" },
    { id: "welcome-sunset-walk", sceneId: "welcome_chat", from: 74, to: 95, context: "CURRENT", precision: "MINUTE", date: "10月3日（土）", time: "17:10–17:45", duration: "9:05–11:30", dayPeriod: "PM", location: "海沿いの帰り道／夕暮れの遊歩道" },
  ]);

  const interactions = freezeRows([
    {
      sceneId: "map_mode01",
      prepStepIds: stepIds("map_mode01", 1, 3),
      stepId: "map_mode01_004",
      kind: "map01",
      modeIndex: 0,
      modeId: "breathing-earth",
      target: "#japan-layer",
      returnStepId: "map_mode01_005",
      postStepIds: stepIds("map_mode01", 5, 22),
    },
    {
      sceneId: "map_mode01",
      prepStepIds: stepIds("map_mode01", 15, 22),
      stepId: "map_mode01_023",
      kind: "map01",
      modeIndex: 0,
      modeId: "breathing-earth",
      phase: "temperature-anomaly",
      target: "#japan-layer",
      returnStepId: "map_mode01_024",
      postStepIds: stepIds("map_mode01", 24, 43),
    },
    {
      sceneId: "gx_experience",
      prepStepIds: stepIds("gx_experience", 1, 16),
      stepId: "gx_experience_017",
      kind: "gx",
      target: "#gx-layer",
      returnStepId: "gx_experience_018",
      postStepIds: Object.freeze([
        ...stepIds("gx_experience", 18, 44),
        ...stepIds("gx_experience", 55, 58),
      ]),
    },
  ]);

  const choices = Object.freeze([]);

  const devices = freezeRows([
    { id: "map01-native-overlay", sceneId: "map_mode01", from: 4, to: 4, device: "native-mode-overlay", phase: "open" },
    { id: "map01-temperature-overlay", sceneId: "map_mode01", from: 23, to: 23, device: "native-mode-overlay", phase: "temperature-anomaly" },
    { id: "gx-native-overlay", sceneId: "gx_experience", from: 17, to: 17, device: "native-mode-overlay", phase: "open" },
    { id: "welcome-wide-chat", sceneId: "welcome_chat", from: 1, to: 54, device: "wide-campus-chat", phase: "wide" },
    { id: "welcome-physical", sceneId: "welcome_chat", from: 55, to: 77, device: "none", phase: "physical" },
    { id: "welcome-mobile-chat", sceneId: "welcome_chat", from: 78, to: 95, device: "mobile-campus-chat", phase: "mobile" },
  ]);

  const characters = freezeRows([
    { id: "welcome-wide-text-only", sceneId: "welcome_chat", from: 1, to: 54, cast: "none", portrait: "none", avatar: "none", voice: "none" },
    { id: "welcome-physical-mizuha-amane", sceneId: "welcome_chat", from: 55, to: 77, cast: "mizuha-amane", portrait: "normal", avatar: "none", voice: "none" },
    { id: "welcome-mobile-text-only", sceneId: "welcome_chat", from: 78, to: 95, cast: "none", portrait: "none", avatar: "none", voice: "none" },
  ]);

  // The short script contains no character voice or archive-recording cue.
  const audio = Object.freeze([]);

  const stepNumber = (step) => {
    const match = new RegExp(`^${step?.sceneId}_(\\d{3})(?:[a-z])?$`).exec(String(step?.cueFromStepId || step?.id || ""));
    return match ? Number(match[1]) : null;
  };
  const ranged = (rows, step) => {
    const number = stepNumber(step);
    return rows.find((row) => row.sceneId === step.sceneId && number >= row.from && number <= row.to) || null;
  };

  const forStep = (step) => {
    if (!sceneIds.includes(step?.sceneId)) {
      throw new Error(`[GAIA novel] Unknown contest-v10 staging scene for ${step?.id || "unknown step"}`);
    }
    const temporalCue = ranged(temporal, step);
    if (!temporalCue) throw new Error(`[GAIA novel] Missing contest-v10 temporal cue for ${step?.id || "unknown step"}`);
    const deviceCue = ranged(devices, step);
    const characterCue = ranged(characters, step);
    const number = stepNumber(step);
    const isInteraction = interactions.some((entry) => entry.stepId === step.id);
    let castMode = "normal";
    if (isInteraction) castMode = "interaction-no-cast";
    if (step.sceneId === "welcome_chat" && number <= 54) castMode = "chat-text-only-no-cast";
    if (step.sceneId === "welcome_chat" && number >= 78) castMode = "chat-text-only-no-cast";

    return Object.freeze({
      temporal: temporalCue,
      device: deviceCue?.device || "none",
      devicePhase: deviceCue?.phase || "none",
      viewpoint: "visitor",
      castMode,
      character: characterCue || Object.freeze({ cast: "normal", portrait: "normal", avatar: "normal", voice: "none" }),
      audio: "none",
      phone: null,
    });
  };

  globalThis.GAIA_NOVEL_BACK_HALF_CUES = Object.freeze({
    expectedSceneCounts,
    sceneIds,
    // Compatibility name retained until the runtime registry is renamed.
    backHalfSceneIds: sceneIds,
    temporal,
    interactions,
    choices,
    devices,
    characters,
    audio,
    operationsPhone: null,
    forStep,
  });
})();
