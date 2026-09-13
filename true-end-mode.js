(() => {
  "use strict";

  const story = globalThis.GaiaI18n?.view(globalThis.GAIA_TRUE_END_STORY) || globalThis.GAIA_TRUE_END_STORY;
  if (!story) return;
  const translate = (text, values) => globalThis.GaiaI18n?.t(text, values) ?? text;
  const displayLanguage = () => globalThis.GaiaI18n?.get() || "ja";
  const SYSTEM_LANGUAGE = story.language?.htmlLang || "art-x-saeliva";

  const SPEAKERS = Object.freeze({
    narrator: Object.freeze({ name: "", code: "MIR", language: SYSTEM_LANGUAGE }),
    system: Object.freeze({ name: "AIVA", code: "KAR·MIR", language: SYSTEM_LANGUAGE }),
    lou: Object.freeze({ name: "ルウ", code: "K 2.7 / TIR·DÆM", language: SYSTEM_LANGUAGE }),
    mizuha: Object.freeze({ name: "みず", code: "MIZUHA" }),
    amane: Object.freeze({ name: "あめ", code: "AMANE" }),
    sakuya: Object.freeze({ name: "saku", code: "SAKUYA" }),
    visitor: Object.freeze({ name: "あなた", code: "AL MIR", language: SYSTEM_LANGUAGE }),
  });
  const STORAGE_KEY = "gaiaSensewareTrueEnd:complete:v1";
  const REACHED_STORAGE_KEY = "gaiaSensewareTrueEnd:reached:v1";
  const PENDING_STORAGE_KEY = "gaiaSensewareTrueEnd:pending:v1";
  const CHARACTER_DELAY_MS = 29;
  const FUTURE_SHORE_SCENE_ID = "after-school-stars";
  const FUTURE_SHORE_START_STEP_ID = "beyond_03_032";
  const SCENE_BLACKOUT_MS = 720;
  const SCENE_TITLE_FADE_MS = 440;
  const SCENE_TITLE_HOLD_MS = 1664;
  const SCENE_TITLE_OUT_MS = 360;
  const SCENE_REVEAL_MS = 920;
  const SCENE_INTERFACE_FADE_MS = 1100;
  const FINALE_EXIT_COVER_MS = 2_400;
  const FINALE_EXIT_WHITE_HOLD_MS = 600;
  const FINALE_EXIT_REVEAL_MS = 1_850;
  const FINALE_EXIT_DESTINATION_WAIT_MS = 8_000;
  const segmenter = typeof Intl?.Segmenter === "function"
    ? new Intl.Segmenter("ja", { granularity: "grapheme" })
    : null;

  const splitText = (value) => {
    const text = String(value || "");
    return segmenter ? [...segmenter.segment(text)].map(({ segment }) => segment) : Array.from(text);
  };

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const createElement = (tag, className = "", text = "") => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const speakerForStep = (step) => {
    const canonical = SPEAKERS[step?.speaker || "narrator"] || SPEAKERS.narrator;
    return { ...canonical, name: translate(step?.speakerLabel || canonical.name) };
  };

  const createRuntime = ({ host, layer, onComplete, onExit, onStepRead, onLogOpen, onReady, deferInterfaceReveal = false, persistProgress = true }) => {
    if (!(host instanceof HTMLElement) || !(layer instanceof HTMLElement)) return null;

    let sceneIndex = 0;
    let stepIndex = 0;
    let messagePageIndex = 0;
    let revealFrame = 0;
    let revealStartedAt = 0;
    let revealTokens = [];
    let revealGlyphs = [];
    let revealedGlyphCount = 0;
    let measuredPages = [];
    let reflowTimer = 0;
    let reflowPending = false;
    let observedMessageWidth = 0;
    let revealing = false;
    let transitioning = false;
    let complete = false;
    let universeRuntime = null;
    let restoringUniverseRuntime = false;
    let sceneCardTimer = 0;
    let sceneCardTimerResolve = null;
    let sceneCardFadeTimer = 0;
    let sceneCardFadeResolve = null;
    let renderRevision = 0;
    let deferredInitialStep = null;
    let finaleExiting = false;

    const shell = createElement("section", "true-end-shell");
    shell.tabIndex = 0;
    shell.setAttribute("role", "region");
    shell.setAttribute("aria-label", "惑星の放課後 GAIA SENSATION APEIRONCENE。画面をクリックまたはタップするか、Enterキーまたはスペースキーで進みます");
    if (deferInterfaceReveal) shell.dataset.entryPhase = "background";

    const universe = createElement("canvas", "true-end-universe");
    universe.setAttribute("aria-hidden", "true");
    const header = createElement("header", "true-end-header");
    const brand = createElement("div", "true-end-brand");
    brand.append(
      createElement("span", "", story.subtitle),
      createElement("strong", "", story.title),
    );
    const sceneHeading = createElement("div", "true-end-scene-heading");
    const sceneNumber = createElement("span");
    const sceneTitle = createElement("strong");
    sceneHeading.append(sceneNumber, sceneTitle);
    header.append(brand, sceneHeading);

    const progress = createElement("div", "true-end-progress");
    const progressFill = createElement("i");
    progress.append(progressFill);

    const dialogue = createElement("button", "true-end-dialogue");
    dialogue.type = "button";
    dialogue.setAttribute("aria-label", "次へ進む");
    const speaker = createElement("span", "true-end-speaker");
    const speakerCode = createElement("small", "true-end-speaker-code");
    const message = createElement("span", "true-end-message");
    const nextMark = createElement("i", "true-end-next", "▽");
    dialogue.append(speaker, speakerCode, message, nextMark);

    const footer = createElement("footer", "true-end-footer");
    const counter = createElement("span");
    footer.append(counter);

    const logButton = createElement("button", "true-end-log-button", "LOG");
    logButton.type = "button";
    logButton.setAttribute("aria-label", "APEIRONCENEの会話履歴を開く");

    const skipButton = createElement("button", "true-end-skip-button");
    skipButton.type = "button";
    skipButton.append(createElement("span", "", "スキップ▶"));

    const sceneCard = createElement("div", "true-end-scene-card");
    sceneCard.setAttribute("aria-hidden", "true");
    sceneCard.dataset.phase = "idle";
    const sceneCardContent = createElement("div", "true-end-scene-card-content");
    const sceneCardNumber = createElement("span");
    const sceneCardTitle = createElement("strong");
    sceneCardContent.append(sceneCardNumber, sceneCardTitle);
    sceneCard.append(sceneCardContent);

    const interfaceLayer = createElement("div", "true-end-interface");
    interfaceLayer.append(header, progress, dialogue, footer);
    if (deferInterfaceReveal) {
      interfaceLayer.setAttribute("aria-hidden", "true");
      dialogue.disabled = true;
      logButton.disabled = true;
      skipButton.disabled = true;
    }

    const finale = createElement("section", "true-end-finale");
    finale.hidden = true;
    const finaleLabel = createElement("span", "", story.finale.label);
    const finaleTitle = createElement("h2", "", story.finale.title);
    const finaleReadout = createElement("div");
    finaleReadout.lang = SYSTEM_LANGUAGE;
    story.finale.readout.forEach((line) => finaleReadout.append(createElement("code", "", line)));
    const finaleNote = createElement("p", "", "世界は、まだひらかれている。");
    const finaleExit = createElement("button", "", "世界とつながる");
    finaleExit.type = "button";
    finale.append(finaleLabel, finaleTitle, finaleReadout, finaleNote, finaleExit);

    shell.append(
      universe,
      interfaceLayer,
      skipButton,
      logButton,
      sceneCard,
      finale,
    );
    host.replaceChildren(shell);
    const createUniverseRuntime = () => globalThis.GaiaTrueEndWebGL?.create?.({
      canvas: universe,
      shell,
      onRestore: () => {
        if (restoringUniverseRuntime) return;
        restoringUniverseRuntime = true;
        requestAnimationFrame(() => {
          universeRuntime?.destroy?.();
          universe.classList.remove("is-fallback");
          universeRuntime = createUniverseRuntime();
          const activeScene = story.scenes[sceneIndex];
          const activeStep = activeScene?.steps?.[stepIndex];
          universeRuntime?.setScene?.(activeScene?.backdrop || "awakening", { immediate: true });
          universeRuntime?.setPresence?.(activeStep?.speaker || "narrator", {
            emphasis: activeStep?.emphasis === true,
            signal: activeStep?.id || "",
            immediate: true,
          });
          restoringUniverseRuntime = false;
        });
      },
    }) || null;
    universeRuntime = createUniverseRuntime();
    if (!universeRuntime) {
      universe.classList.add("is-fallback");
      universe.dataset.webglState = "fallback";
    }

    const scene = () => story.scenes[sceneIndex];
    const step = () => scene()?.steps?.[stepIndex];
    const typography = globalThis.GaiaDialogueTypography;
    const messagePages = () => measuredPages;
    const layoutMessage = (text) => {
      const layout = typography.createLayout(text);
      typography.wrapLayout(message, layout);
      // Retain literal newlines for copying/accessibility. Only the authored
      // breaks become text; automatically chosen line breaks remain <br>.
      layout.querySelectorAll("[data-source-break]").forEach(node => {
        node.replaceWith(document.createTextNode(node.dataset.sourceBreak));
      });
      return layout;
    };
    const messageFits = (text) => {
      layoutMessage(text);
      const style = getComputedStyle(message);
      const capacity = Math.min(
        Number.parseFloat(style.maxHeight),
        dialogue.clientHeight - Number.parseFloat(style.top) - 24,
      );
      return message.scrollHeight <= capacity + 1 && message.scrollWidth <= message.clientWidth + 1;
    };
    const paginateMessage = (current) => {
      const pages = [];
      // Authored pauses remain pauses. Only subdivide them if the current
      // viewport cannot fit a page; never truncate or merge distinct beats.
      for (const authored of current.pages || [current.text || ""]) {
        let remainder = authored;
        while (remainder) {
          if (messageFits(remainder)) { pages.push(remainder); break; }
          const tokens = typography.segment(remainder);
          let prefix = "", longest = "", punctuation = "";
          for (const token of tokens) {
            prefix += token;
            if (!messageFits(prefix)) break;
            longest = prefix;
            if (/[、。！？!?…][」』）]*\s*$/u.test(prefix)) punctuation = prefix;
          }
          let selected = punctuation || longest;
          if (!selected) {
            // A fallback token can exceed an entire page (no Intl.Segmenter).
            // Split only that oversized token at grapheme boundaries.
            prefix = "";
            for (const glyph of splitText(tokens[0] || remainder)) {
              if (!messageFits(prefix + glyph)) break;
              prefix += glyph;
            }
            selected = prefix;
          }
          if (!selected) throw new Error("APEIRONCENE glyph does not fit the dialogue");
          pages.push(selected);
          remainder = remainder.slice(selected.length);
        }
      }
      return pages.length ? pages : [""];
    };
    const totalSteps = story.scenes.reduce((sum, item) => sum + item.steps.length, 0);
    const absoluteStep = () => story.scenes
      .slice(0, sceneIndex)
      .reduce((sum, item) => sum + item.steps.length, 0) + stepIndex + 1;

    const stopReveal = () => {
      if (revealFrame) cancelAnimationFrame(revealFrame);
      revealFrame = 0;
      revealing = false;
      shell.classList.remove("is-revealing");
    };

    const finishReveal = () => {
      if (!revealing) return false;
      stopReveal();
      revealGlyphs.forEach(glyph => glyph.classList.add("is-visible"));
      revealedGlyphCount = revealGlyphs.length;
      nextMark.hidden = false;
      if (reflowPending) scheduleMessageReflow();
      return true;
    };

    const animateReveal = (now) => {
      if (!revealing) return;
      const visibleCount = Math.min(
        revealTokens.length,
        Math.floor((now - revealStartedAt) / CHARACTER_DELAY_MS) + 1,
      );
      while (revealedGlyphCount < visibleCount) {
        revealGlyphs[revealedGlyphCount]?.classList.add("is-visible");
        revealedGlyphCount += 1;
      }
      if (visibleCount < revealTokens.length) {
        revealFrame = requestAnimationFrame(animateReveal);
        return;
      }
      stopReveal();
      nextMark.hidden = false;
      if (reflowPending) scheduleMessageReflow();
    };

    const startReveal = (text) => {
      stopReveal();
      revealTokens = splitText(text);
      const layout = layoutMessage(text);
      revealGlyphs = [];
      revealedGlyphCount = 0;
      message.setAttribute("aria-label", text);
      nextMark.hidden = true;
      if (reducedMotion() || revealTokens.length < 2) {
        nextMark.hidden = false;
        return;
      }
      layout.querySelectorAll(".novel-phrase-token, .novel-space-token").forEach(token => {
        const fragment = document.createDocumentFragment();
        splitText(token.textContent).forEach(glyph => {
          const span = createElement("span", "true-end-reveal-glyph", glyph);
          span.setAttribute("aria-hidden", "true");
          revealGlyphs.push(span);
          fragment.append(span);
        });
        token.replaceChildren(fragment);
      });
      revealTokens = revealGlyphs;
      revealing = true;
      shell.classList.add("is-revealing");
      revealStartedAt = performance.now();
      revealFrame = requestAnimationFrame(animateReveal);
    };

    const renderMessagePage = (current, currentSpeaker) => {
      const pages = messagePages(current);
      const pageText = pages[Math.min(messagePageIndex, pages.length - 1)];
      shell.dataset.messagePage = `${messagePageIndex + 1}/${pages.length}`;
      startReveal(pageText);
      dialogue.setAttribute("aria-label", `${currentSpeaker.name ? `${currentSpeaker.name}: ` : ""}${pageText} — ${translate("次へ進む")}`);
    };

    function scheduleMessageReflow() {
      if (revealing) { reflowPending = true; return; }
      window.clearTimeout(reflowTimer);
      reflowTimer = window.setTimeout(() => {
        reflowPending = false;
        if (!shell.isConnected || complete || transitioning || !measuredPages.length) return;
        const anchor = measuredPages.slice(0, messagePageIndex).join("").length;
        measuredPages = paginateMessage(step());
        messagePageIndex = 0;
        let offset = 0;
        while (messagePageIndex + 1 < measuredPages.length && offset + measuredPages[messagePageIndex].length <= anchor) {
          offset += measuredPages[messagePageIndex++].length;
        }
        renderMessagePage(step(), speakerForStep(step()));
        if (revealing) finishReveal();
        observedMessageWidth = message.getBoundingClientRect().width;
      }, 120);
    }
    const messageObserver = new ResizeObserver(() => {
      const width = message.getBoundingClientRect().width;
      if (Math.abs(width - observedMessageWidth) < .5) return;
      observedMessageWidth = width;
      scheduleMessageReflow();
    });
    messageObserver.observe(message);
    window.addEventListener("resize", scheduleMessageReflow, {passive:true});
    document.fonts?.addEventListener?.("loadingdone", scheduleMessageReflow);

    const setBackdrop = (name, immediate = false) => {
      shell.dataset.backdrop = name;
      return universeRuntime?.setScene?.(name, { immediate }) || Promise.resolve();
    };

    const setSceneTransitionPhase = (phase) => {
      sceneCard.dataset.phase = phase;
      shell.dataset.sectionTransitionPhase = phase;
      document.body.classList.toggle("true-end-section-transition", phase !== "idle");
      const sharedAudioDock = document.querySelector(".gaia-audio-dock");
      if (phase === "idle" || phase === "interface") sharedAudioDock?.style.removeProperty("opacity");
      else sharedAudioDock?.style.setProperty("opacity", "0", "important");
    };

    const stopSceneCardDelay = () => {
      window.clearTimeout(sceneCardTimer);
      sceneCardTimer = 0;
      const resolve = sceneCardTimerResolve;
      sceneCardTimerResolve = null;
      resolve?.();
    };

    const waitForSceneCard = (duration) => {
      stopSceneCardDelay();
      if (reducedMotion() || duration <= 0) return Promise.resolve();
      return new Promise((resolve) => {
        sceneCardTimerResolve = resolve;
        sceneCardTimer = window.setTimeout(() => {
          sceneCardTimer = 0;
          sceneCardTimerResolve = null;
          resolve();
        }, duration);
      });
    };

    const stopSceneCardFade = () => {
      window.clearTimeout(sceneCardFadeTimer);
      sceneCardFadeTimer = 0;
      const resolve = sceneCardFadeResolve;
      sceneCardFadeResolve = null;
      resolve?.();
    };

    const animateSceneOpacity = (target, from, to, duration) => {
      stopSceneCardFade();
      target.style.opacity = String(from);
      if (reducedMotion() || duration <= 0) {
        target.style.opacity = String(to);
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        sceneCardFadeResolve = resolve;
        const startedAt = performance.now();
        const drawSceneOpacity = (now) => {
          const progress = Math.min(1, (now - startedAt) / duration);
          const eased = progress * progress * (3 - 2 * progress);
          target.style.opacity = String(from + (to - from) * eased);
          if (progress < 1) {
            sceneCardFadeTimer = window.setTimeout(() => drawSceneOpacity(performance.now()), 16);
            return;
          }
          sceneCardFadeTimer = 0;
          sceneCardFadeResolve = null;
          resolve();
        };
        drawSceneOpacity(startedAt);
      });
    };

    const showSceneSeparator = async ({ prepareScene, switchScene } = {}) => {
      delete shell.dataset.sectionTransitionCompletedAt;
      sceneCard.classList.add("is-active");
      sceneCardContent.style.opacity = "0";
      setSceneTransitionPhase("blackout");
      await animateSceneOpacity(sceneCard, 0, 1, SCENE_BLACKOUT_MS);
      if (!shell.isConnected || complete) return null;

      setSceneTransitionPhase("black");
      prepareScene?.();
      setSceneTransitionPhase("title");
      await animateSceneOpacity(sceneCardContent, 0, 1, SCENE_TITLE_FADE_MS);
      if (!shell.isConnected || complete) return null;

      setSceneTransitionPhase("switching");
      let preparedStep = null;
      await Promise.all([
        Promise.resolve().then(async () => {
          preparedStep = await switchScene?.();
        }),
        waitForSceneCard(SCENE_TITLE_HOLD_MS),
      ]);
      if (!shell.isConnected || complete) return null;

      setSceneTransitionPhase("ready");
      await animateSceneOpacity(sceneCardContent, 1, 0, SCENE_TITLE_OUT_MS);
      if (!shell.isConnected || complete) return null;

      setSceneTransitionPhase("reveal");
      await animateSceneOpacity(sceneCard, 1, 0, SCENE_REVEAL_MS);
      sceneCard.classList.remove("is-active");
      sceneCard.style.removeProperty("opacity");
      sceneCardContent.style.removeProperty("opacity");
      shell.dataset.sectionTransitionCompletedAt = performance.now().toFixed(3);
      return { preparedStep };
    };

    const syncSceneMetadata = () => {
      const current = scene();
      if (!current) return;
      sceneNumber.textContent = `VENA ${current.number}`;
      sceneNumber.lang = SYSTEM_LANGUAGE;
      sceneTitle.textContent = current.title;
      sceneCardNumber.textContent = `VENA ${current.number}`;
      sceneCardNumber.lang = SYSTEM_LANGUAGE;
      sceneCardTitle.textContent = current.title;
      shell.dataset.scene = current.id;
      const nextScene = story.scenes[sceneIndex + 1];
      const skipDescription = nextScene
        ? translate("現在のセクションをスキップして「{title}」へ進む", { title: nextScene.title })
        : translate("現在のセクションをスキップしてフィナーレへ進む");
      skipButton.setAttribute("aria-label", skipDescription);
      skipButton.title = skipDescription;
    };

    const syncSceneBackdrop = ({ immediate = false } = {}) => {
      const current = scene();
      if (!current) return Promise.resolve();
      return setBackdrop(current.backdrop, immediate);
    };

    const syncStepVisuals = (current) => {
      shell.dataset.step = current.id;
      if (["beyond_03_053", "beyond_03_add_049"].includes(current.id)) logButton.remove();
      const currentScene = scene();
      const shoreStartIndex = currentScene?.steps?.findIndex(({ id }) => id === FUTURE_SHORE_START_STEP_ID) ?? -1;
      const shoreVisible = currentScene?.id === FUTURE_SHORE_SCENE_ID
        && shoreStartIndex >= 0
        && stepIndex >= shoreStartIndex;
      shell.dataset.shoreImage = shoreVisible ? "visible" : "hidden";
    };

    const revealSceneAfterSeparator = async ({ onSceneReady, ...options } = {}) => {
      const result = await showSceneSeparator(options);
      if (!result || !shell.isConnected || complete) return;
      commitPreparedStep(result.preparedStep);
      if (!shell.isConnected || complete) return;
      shell.classList.remove("is-scene-separating");
      setSceneTransitionPhase("interface");
      await waitForSceneCard(layer.classList.contains("is-motion-reduced") ? 0 : SCENE_INTERFACE_FADE_MS);
      if (!shell.isConnected || complete) return;
      transitioning = false;
      setSceneTransitionPhase("idle");
      onSceneReady?.({ shell });
    };

    const prepareStep = async () => {
      const current = step();
      if (!current) return null;
      const revision = ++renderRevision;
      const currentSpeaker = speakerForStep(current);
      await (universeRuntime?.setPresence?.(current.speaker || "narrator", {
        emphasis: current.emphasis === true,
        signal: current.id,
      }) || Promise.resolve());
      if (revision !== renderRevision || !shell.isConnected || complete) return null;
      return { current, currentSpeaker, revision };
    };

    const commitPreparedStep = (prepared) => {
      if (!prepared || prepared.revision !== renderRevision || !shell.isConnected || complete) return false;
      const { current, currentSpeaker } = prepared;
      syncStepVisuals(current);
      shell.dataset.speaker = current.speaker || "narrator";
      shell.classList.toggle("is-emphasis", current.emphasis === true);
      speaker.textContent = currentSpeaker.name;
      speaker.lang = displayLanguage();
      speaker.hidden = !currentSpeaker.name;
      speakerCode.textContent = currentSpeaker.code;
      speakerCode.lang = currentSpeaker.language || "ja";
      message.lang = current.speaker === "system" ? SYSTEM_LANGUAGE : displayLanguage();
      onStepRead?.(current);
      messagePageIndex = 0;
      reflowPending = false;
      measuredPages = paginateMessage(current);
      renderMessagePage(current, currentSpeaker);
      observedMessageWidth = message.getBoundingClientRect().width;
      shell.dataset.messageCommittedAt = performance.now().toFixed(3);
      counter.textContent = `${String(absoluteStep()).padStart(3, "0")} / ${String(totalSteps).padStart(3, "0")}`;
      progressFill.style.width = `${(absoluteStep() / totalSteps) * 100}%`;
      return true;
    };

    const renderStep = async () => commitPreparedStep(await prepareStep());
    const refreshLanguage = () => {
      syncSceneMetadata();
      brand.querySelector("span").textContent = story.subtitle;
      brand.querySelector("strong").textContent = story.title;
      finaleTitle.textContent = story.finale.title;
      if (!shell.isConnected || complete || transitioning) return;
      stopReveal();
      void renderStep();
    };
    window.addEventListener("gaia:language-change", refreshLanguage);

    const revealEntry = () => {
      if (!deferredInitialStep || shell.dataset.entryPhase !== "background") return false;
      const prepared = deferredInitialStep;
      deferredInitialStep = null;
      shell.dataset.entryPhase = "interface";
      interfaceLayer.removeAttribute("aria-hidden");
      dialogue.disabled = false;
      logButton.disabled = false;
      skipButton.disabled = false;
      const committed = commitPreparedStep(prepared);
      transitioning = false;
      requestAnimationFrame(() => {
        if (shell.isConnected && shell.dataset.entryPhase === "interface") shell.dataset.entryPhase = "ready";
      });
      return committed;
    };

    const showFinale = () => {
      stopReveal();
      complete = true;
      logButton.remove();
      shell.classList.add("is-finale");
      shell.dataset.shoreImage = "hidden";
      universeRuntime?.setScene?.("galaxy");
      universeRuntime?.setPresence?.("system", { emphasis: true, signal: "beyond-finale" });
      dialogue.hidden = true;
      footer.hidden = true;
      header.hidden = true;
      progress.hidden = true;
      skipButton.hidden = true;
      // The shared button glint lives outside the fading finale. Keep both
      // pointer entry and automatic focus from lighting it before its button.
      finale.inert = true;
      finale.hidden = false;
      try {
        if (persistProgress) {
          window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
          window.localStorage.removeItem(PENDING_STORAGE_KEY);
        }
      } catch {
        // The ending remains available when storage is disabled.
      }
      onComplete?.();
      if (persistProgress) window.dispatchEvent(new CustomEvent("gaia:true-end-complete"));
      const entryAnimations = finale.getAnimations();
      void Promise.allSettled(entryAnimations.map((animation) => animation.finished)).then(() => {
        requestAnimationFrame(() => {
          if (!shell.isConnected || finale.hidden || finaleExiting) return;
          finale.inert = false;
          finaleExit.focus({ preventScroll: true });
        });
      });
    };

    const moveToNextScene = () => {
      if (complete || transitioning) return false;
      if (sceneIndex >= story.scenes.length - 1) {
        showFinale();
        return true;
      }

      transitioning = true;
      stopReveal();
      shell.classList.add("is-scene-separating");
      void revealSceneAfterSeparator({
        prepareScene: () => {
          sceneIndex += 1;
          stepIndex = 0;
          syncSceneMetadata();
        },
        switchScene: async () => {
          await syncSceneBackdrop({ immediate: true });
          return prepareStep();
        },
      });
      return true;
    };

    const advance = () => {
      if (complete || transitioning) return;
      if (finishReveal()) return;
      const currentScene = scene();
      const current = step();
      const pages = messagePages(current);
      if (messagePageIndex < pages.length - 1) {
        messagePageIndex += 1;
        const currentSpeaker = speakerForStep(current);
        renderMessagePage(current, currentSpeaker);
        return;
      }
      if (stepIndex < currentScene.steps.length - 1) {
        transitioning = true;
        stepIndex += 1;
        renderStep().finally(() => {
          if (!shell.isConnected || complete) return;
          transitioning = false;
        });
        return;
      }
      moveToNextScene();
    };

    let dialoguePointerOrigin = null;
    let suppressDialogueClick = false;
    dialogue.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      dialoguePointerOrigin = { id: event.pointerId, x: event.clientX, y: event.clientY };
      suppressDialogueClick = false;
    });
    dialogue.addEventListener("pointermove", (event) => {
      if (!dialoguePointerOrigin || event.pointerId !== dialoguePointerOrigin.id) return;
      if (Math.hypot(event.clientX - dialoguePointerOrigin.x, event.clientY - dialoguePointerOrigin.y) > 6) {
        suppressDialogueClick = true;
      }
    });
    dialogue.addEventListener("pointerup", (event) => {
      if (!dialoguePointerOrigin || event.pointerId !== dialoguePointerOrigin.id) return;
      dialoguePointerOrigin = null;
      window.setTimeout(() => { suppressDialogueClick = false; }, 0);
    });
    dialogue.addEventListener("pointercancel", () => {
      dialoguePointerOrigin = null;
      suppressDialogueClick = false;
    });
    dialogue.addEventListener("click", (event) => {
      event.stopPropagation();
      if (suppressDialogueClick) {
        event.preventDefault();
        suppressDialogueClick = false;
        return;
      }
      advance();
    });
    logButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onLogOpen?.();
    });
    skipButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveToNextScene();
    });
    shell.addEventListener("click", (event) => {
      event.stopPropagation();
      const interactiveTarget = event.target instanceof Element
        ? event.target.closest(".true-end-dialogue, .true-end-skip-button, .true-end-log-button, .true-end-finale")
        : null;
      if (interactiveTarget) return;
      advance();
    });
    shell.addEventListener("keydown", (event) => {
      if (!(["Enter", " "].includes(event.key)) || event.repeat || event.isComposing || event.target.closest("button")) return;
      event.preventDefault();
      advance();
    });
    finaleExit.addEventListener("click", () => {
      if (finaleExiting) return;
      finaleExiting = true;
      finaleExit.disabled = true;
      const exitVeil = createElement("div", "true-end-exit-veil");
      exitVeil.setAttribute("aria-hidden", "true");
      const reduced = reducedMotion();
      exitVeil.style.setProperty("--true-end-exit-cover-duration", `${reduced ? 400 : FINALE_EXIT_COVER_MS}ms`);
      exitVeil.style.setProperty("--true-end-exit-reveal-duration", `${reduced ? 400 : FINALE_EXIT_REVEAL_MS}ms`);
      // Wait for the actual fade to finish before changing screens. There is
      // one continuous rise to white, no noise, flashing or black interlude.
      exitVeil.addEventListener("animationend", (event) => {
        if (event.target !== exitVeil) return;
        if (event.animationName === "true-end-exit-reveal") {
          exitVeil.remove();
          return;
        }
        if (event.animationName !== "true-end-exit-cover") return;
        exitVeil.dataset.phase = "white";
        window.setTimeout(() => {
          if (!exitVeil.isConnected) return;
          onExit?.();
          const destinationWaitStartedAt = performance.now();
          const revealDestination = () => {
            if (!exitVeil.isConnected) return;
            const intro = document.querySelector("#intro-layer");
            const destinationReady = intro instanceof HTMLElement
              && !intro.hidden
              && intro.getAttribute("aria-hidden") === "false";
            if (!destinationReady && performance.now() - destinationWaitStartedAt < FINALE_EXIT_DESTINATION_WAIT_MS) {
              requestAnimationFrame(revealDestination);
              return;
            }
            exitVeil.dataset.phase = "revealing";
          };
          requestAnimationFrame(revealDestination);
        }, reduced ? 0 : FINALE_EXIT_WHITE_HOLD_MS);
      });
      exitVeil.dataset.phase = "covering";
      document.body.append(exitVeil);
    });

    transitioning = true;
    syncSceneMetadata();
    if (deferInterfaceReveal) {
      void (async () => {
        await syncSceneBackdrop({ immediate: true });
        const prepared = await prepareStep();
        if (!prepared || !shell.isConnected || complete) return;
        deferredInitialStep = prepared;
        setSceneTransitionPhase("idle");
        onReady?.({ shell });
      })();
    } else {
      shell.classList.add("is-scene-separating");
      void revealSceneAfterSeparator({
        switchScene: async () => {
          await syncSceneBackdrop({ immediate: true });
          return prepareStep();
        },
        onSceneReady: onReady,
      });
    }
    requestAnimationFrame(() => shell.focus({ preventScroll: true }));

    return Object.freeze({
      shell,
      revealEntry,
      destroy() {
        renderRevision += 1;
        window.clearTimeout(reflowTimer);
        messageObserver.disconnect();
        window.removeEventListener("resize", scheduleMessageReflow);
        window.removeEventListener("gaia:language-change", refreshLanguage);
        document.fonts?.removeEventListener?.("loadingdone", scheduleMessageReflow);
        document.body.classList.remove("true-end-section-transition");
        document.querySelector(".gaia-audio-dock")?.style.removeProperty("opacity");
        stopReveal();
        stopSceneCardDelay();
        stopSceneCardFade();
        universeRuntime?.destroy?.();
        universeRuntime = null;
        shell.remove();
      },
    });
  };

  globalThis.GaiaTrueEnd = Object.freeze({
    start(options) {
      return createRuntime(options || {});
    },
    markReached() {
      try {
        window.localStorage.setItem(REACHED_STORAGE_KEY, new Date().toISOString());
        return true;
      } catch {
        return false;
      }
    },
    isReached() {
      try {
        return Boolean(
          window.localStorage.getItem(REACHED_STORAGE_KEY)
          || window.localStorage.getItem(STORAGE_KEY),
        );
      } catch {
        return false;
      }
    },
    isComplete() {
      try {
        return Boolean(window.localStorage.getItem(STORAGE_KEY));
      } catch {
        return false;
      }
    },
    reachedStorageKey: REACHED_STORAGE_KEY,
  });
})();
