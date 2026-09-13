(() => {
  "use strict";

  const CONTEXTS = new Set(["CURRENT", "RECORD"]);
  const PRECISIONS = new Set(["MINUTE", "DAY", "PART_OF_DAY", "APPROXIMATE"]);

  const fail = (message) => {
    throw new Error(`[GAIA temporal metadata] ${message}`);
  };

  const requireObject = (value, label) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} is required`);
    return value;
  };

  const requireText = (value, label) => {
    if (typeof value !== "string" || !value.trim()) fail(`${label} is required`);
    return value;
  };

  const validatePresentation = (presentation, label, { allowContextTransition = false, allowSameContextTransition = false } = {}) => {
    requireObject(presentation, label);
    requireText(presentation.displayTitle, `${label}.displayTitle`);
    if (!PRECISIONS.has(presentation.timePrecision)) fail(`${label}.timePrecision is invalid`);
    if (presentation.temporalContext && !CONTEXTS.has(presentation.temporalContext)) {
      fail(`${label}.temporalContext is invalid`);
    }
    const hasContextTransition = presentation.fromTemporalContext || presentation.toTemporalContext;
    if (hasContextTransition) {
      if (!allowContextTransition) fail(`${label} cannot change temporal context`);
      if (!CONTEXTS.has(presentation.fromTemporalContext) || !CONTEXTS.has(presentation.toTemporalContext)) {
        fail(`${label} requires valid fromTemporalContext and toTemporalContext`);
      }
      const isApprovedRecordToRecord = allowSameContextTransition
        && presentation.fromTemporalContext === "RECORD"
        && presentation.toTemporalContext === "RECORD";
      if (!isApprovedRecordToRecord && presentation.fromTemporalContext === presentation.toTemporalContext) {
        fail(`${label} must change temporal context`);
      }
    }
  };

  const create = (story) => {
    requireObject(story, "story");
    const policy = requireObject(story.temporal, "story.temporal");
    if (policy.clockPolicy !== "AUTHOR_FIXED") fail("clockPolicy must be AUTHOR_FIXED");
    if (policy.missingMetadataPolicy !== "ERROR") fail("missingMetadataPolicy must be ERROR");
    if (!Array.isArray(policy.sceneOrder)) fail("story.temporal.sceneOrder is required");
    const scenes = Array.isArray(story.scenes) ? story.scenes : fail("story.scenes is required");
    const actualOrder = scenes.map((scene) => scene.id);
    if (JSON.stringify(policy.sceneOrder) !== JSON.stringify(actualOrder)) {
      fail("story.temporal.sceneOrder does not match generated scene order");
    }

    const sceneRuntime = new Map();
    for (const scene of scenes) {
      const label = `scene ${scene.id}`;
      const temporal = requireObject(scene.temporal, `${label}.temporal`);
      validatePresentation(temporal, `${label}.temporal`);
      if (!CONTEXTS.has(temporal.temporalContext)) fail(`${label}.temporal.temporalContext is invalid`);
      const steps = Array.isArray(scene.steps) ? scene.steps : fail(`${label}.steps is required`);
      const stepIndices = new Map(steps.map((step, index) => [step.id, index]));
      const entryTransition = temporal.entryTransition || null;
      if (entryTransition) {
        validatePresentation(entryTransition, `${label}.temporal.entryTransition`, { allowContextTransition: true, allowSameContextTransition: true });
        if (!stepIndices.has(entryTransition.stepId)) fail(`${label}.temporal.entryTransition.stepId does not exist in the scene`);
      }

      const transitions = Array.isArray(temporal.transitions) ? temporal.transitions : [];
      transitions.forEach((transition, index) => {
        const transitionLabel = `${label}.temporal.transitions[${index}]`;
        validatePresentation(transition, transitionLabel, { allowContextTransition: true });
        if (!stepIndices.has(transition.stepId)) fail(`${transitionLabel}.stepId does not exist in the scene`);
      });

      const headingTransitions = transitions
        .filter((transition) => transition.displayMode !== "ARCHIVE_REFERENCE")
        .map((transition, sourceIndex) => ({ transition, sourceIndex, stepIndex: stepIndices.get(transition.stepId) }))
        .sort((left, right) => left.stepIndex - right.stepIndex || left.sourceIndex - right.sourceIndex);
      const contextTransitions = new Map();
      if (entryTransition) contextTransitions.set(entryTransition.stepId, entryTransition);
      transitions.forEach((transition) => {
        if (transition.fromTemporalContext && transition.toTemporalContext) {
          contextTransitions.set(transition.stepId, transition);
        }
      });
      sceneRuntime.set(scene.id, { temporal, stepIndices, headingTransitions, contextTransitions });
    }

    const presentationForStep = (step) => {
      const runtime = sceneRuntime.get(step?.sceneId);
      if (!runtime) fail(`step ${step?.id || "unknown"} has no scene temporal metadata`);
      const stepIndex = runtime.stepIndices.get(step.id);
      if (!Number.isInteger(stepIndex)) fail(`step ${step.id} is not part of scene ${step.sceneId}`);
      let presentation = runtime.temporal;
      for (const candidate of runtime.headingTransitions) {
        if (candidate.stepIndex > stepIndex) break;
        presentation = candidate.transition;
      }
      const temporalContext = presentation.temporalContext
        || presentation.toTemporalContext
        || runtime.temporal.temporalContext;
      return Object.freeze({
        displayTitle: presentation.displayTitle,
        temporalContext,
        timePrecision: presentation.timePrecision,
        isPeriod: Boolean(presentation.endAt),
        displayMode: presentation.displayMode || "",
        source: presentation === runtime.temporal ? "SCENE" : "TRANSITION",
      });
    };

    const contextTransitionForStep = (step) => {
      const runtime = sceneRuntime.get(step?.sceneId);
      return runtime?.contextTransitions.get(step?.id) || null;
    };

    return Object.freeze({ policy, presentationForStep, contextTransitionForStep });
  };

  globalThis.GaiaNovelTemporal = Object.freeze({ create });
})();
