(() => {
  "use strict";
  if (globalThis.GaiaGuidedTour || typeof document === "undefined") return;

  const steps = Object.freeze([
    {
      id: "map", duration: 10, kicker: "地球の記録をひらく", title: "地図を動かし、観測点を選ぶ。", gesture: "↔",
      copy: "地図上の明るい点は、地球を観測している地点です。",
      instruction: "地図をドラッグし、観測点を選ぶ",
      hint: "ドラッグで移動　／　ホイール・ピンチで拡大",
      result: "地点名と最新の観測値が表示されます。",
      actions: [["動かす", "地図をドラッグ"], ["近づく", "ホイール／ピンチ"], ["選ぶ", "明るい観測点"]],
      cues: ["地図をゆっくりドラッグ", "見たい地域へ近づく", "明るい観測点を選ぶ"],
    },
    {
      id: "time", duration: 10, kicker: "時間の流れに触れる", title: "年代を動かし、変化をたどる。", gesture: "⇆",
      copy: "同じ地点を、過去から未来へ見比べられます。",
      instruction: "青い年代スライダーをゆっくり動かす",
      hint: "左は過去　／　右は現在・未来",
      result: "年代に合わせて、地図の色と観測値が変わります。",
      actions: [["触れる", "年代スライダー"], ["たどる", "過去から未来へ"], ["見比べる", "色と観測値"]],
      cues: ["年代スライダーに触れる", "過去から未来へたどる", "地図の色と数値を見比べる"],
    },
    {
      id: "transform", duration: 10, kicker: "記録が光景になるまで", title: "観測値が光景になるまでをたどる。", gesture: "1→2→3",
      copy: "ひとつの観測値が、計算を経て作品の光へ変わります。",
      instruction: "「元データ → 変換 → 映像」を順に選ぶ",
      hint: "観測から表現まで、順番に切り替わります",
      result: "記録と演出のつながりを、段階ごとに確かめられます。",
      actions: [["記録", "元データ"], ["変換", "計算の過程"], ["表現", "映像コード"]],
      cues: ["「元データ」を選ぶ", "「変換」を選ぶ", "「映像コード」を選ぶ"],
    },
  ]);
  const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);
  const arrivalPhaseSeconds = 2.35;
  const departurePhaseSeconds = 1.08;
  const cueFadeMilliseconds = 300;
  const cueRevealMilliseconds = 620;
  const layer = document.createElement("section");
  layer.className = "gaia-tour";
  layer.id = "gaia-guided-tour";
  layer.hidden = true;
  layer.inert = true;
  layer.setAttribute("role", "dialog");
  layer.setAttribute("aria-modal", "false");
  layer.setAttribute("aria-labelledby", "gaia-tour-title");
  layer.innerHTML = `
    <div class="gaia-tour-vignette" aria-hidden="true"></div>
    <div class="gaia-tour-target-spotlight" data-tour-target-spotlight hidden aria-hidden="true"></div>
    <article class="gaia-tour-card" aria-live="polite">
      <div class="gaia-tour-card-index"><span><small>STEP</small><b data-tour-step>1</b></span><i></i><span data-tour-step-total>${steps.length}</span></div>
      <p class="gaia-tour-kicker" data-tour-kicker></p>
      <h2 id="gaia-tour-title" data-tour-title></h2>
      <p class="gaia-tour-copy" data-tour-copy></p>
      <section class="gaia-tour-instruction" aria-label="この画面の操作方法">
        <span class="gaia-tour-gesture" data-tour-gesture aria-hidden="true">◎</span>
        <div><b>ここに触れる</b><strong data-tour-instruction></strong><small data-tour-hint></small></div>
      </section>
      <ol class="gaia-tour-operation-path" data-tour-operation-path aria-label="操作の順序"></ol>
      <p class="gaia-tour-result"><b data-tour-result-label>こう変わる</b><span data-tour-result></span></p>
      <details class="gaia-tour-receipt" data-tour-receipt hidden aria-label="データから表現への変換レシート">
        <summary>出典と変換を見る</summary>
        <p><span>○ SOURCE / 公開記録</span><strong data-tour-receipt-source></strong><small data-tour-receipt-provider></small></p>
        <p><span>△ DERIVED / 計算・補間</span><strong data-tour-receipt-transform></strong></p>
        <p><span>◇ SCENARIO / 仮定・操作</span><strong data-tour-receipt-visual></strong></p>
      </details>
      <p class="gaia-tour-fallback" data-tour-fallback hidden>表示を準備しています。ガイドはこのまま続けられます。</p>
      <div class="gaia-tour-step-rail" data-tour-step-rail aria-label="ガイドの進行"></div>
    </article>
    <div class="gaia-tour-target-cue" data-tour-target-cue hidden aria-hidden="true"><i data-tour-target-action>1</i><span></span></div>
    <section class="gaia-tour-finish" data-tour-finish hidden aria-labelledby="gaia-tour-finish-title">
      <p>30秒ガイド 完了</p><h2 id="gaia-tour-finish-title">基本操作はここまで。好きな展示へ。</h2>
      <p class="gaia-tour-finish-recommend"><span>おすすめ</span><strong>まずは、気になった光をひとつ押してみてください。</strong></p>
      <div><button class="is-primary" type="button" data-tour-destination="explore">展示を見に行く</button><button type="button" data-tour-destination="story">物語から見る</button><a href="./sensors/">センサーを見る</a><button type="button" data-tour-destination="source">データの出典</button></div>
    </section>
    <nav class="gaia-tour-controls" aria-label="30秒ガイドの操作">
      <button type="button" data-tour-action="exit">閉じる</button><button type="button" data-tour-action="previous">戻る</button>
      <button type="button" data-tour-action="toggle" aria-pressed="true"><span data-tour-toggle-label>止める</span></button>
      <button type="button" data-tour-action="next"><span data-tour-next-label>次へ</span></button><div class="gaia-tour-time"><small>あと</small><span data-tour-time>${totalDuration}</span><small>秒</small></div>
      <div class="gaia-tour-progress" aria-hidden="true"><i data-tour-progress></i></div>
    </nav>`;
  document.body.append(layer);

  const find = (selector) => layer.querySelector(selector);
  const card = find(".gaia-tour-card");
  const controls = find(".gaia-tour-controls");
  const finishPanel = find("[data-tour-finish]");
  const fallback = find("[data-tour-fallback]");
  const receipt = find("[data-tour-receipt]");
  const toggle = find("[data-tour-action='toggle']");
  const previous = find("[data-tour-action='previous']");
  const next = find("[data-tour-action='next']");
  const targetCue = find("[data-tour-target-cue]");
  const targetAction = find("[data-tour-target-action]");
  const targetSpotlight = find("[data-tour-target-spotlight]");
  const operationPath = find("[data-tour-operation-path]");
  const stepRail = find("[data-tour-step-rail]");
  stepRail.replaceChildren(...steps.map((step, stepIndex) => {
    const marker = document.createElement("i");
    marker.title = `${stepIndex + 1}. ${step.title}`;
    return marker;
  }));
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let active = false;
  let running = false;
  let index = 0;
  let elapsed = 0;
  let lastFrame = 0;
  let frame = 0;
  let generation = 0;
  let returnFocus = null;
  let returnScroll = { x: 0, y: 0 };
  let runningBeforeHidden = false;
  let targetCueFrame = 0;
  let viewportLayoutTimer = 0;
  let lastTargetLayoutAt = 0;
  let activeCueIndex = 0;
  let initialFocusPending = false;
  const stepTimers = new Set();

  const staticReceipts = Object.freeze({
    map: {
      source: "CO₂濃度 315.7 ppm（1958年基準） / 気温偏差 ℃", provider: "NOAA GML / GOSAT・NIES / NASA GISTEMP",
      transform: "保存済みの観測値を年代へ補間し、SOURCE・DERIVED・SCENARIOを分離", visual: "CO₂→明るさと呼吸速度 / 気温偏差→青から赤の色",
    },
    time: {
      source: "年代・CO₂濃度・気温偏差", provider: "NOAA GML / GOSAT・NIES / NASA GISTEMP",
      transform: "1958–2009は再構成、観測期間はSOURCE、2026年以降は試算", visual: "年代スライダー→同じ地球上の色・光・速度",
    },
    transform: {
      source: "同梱JSONの先頭10件と単位・取得日", provider: "公式公開データのローカルスナップショット",
      transform: "正規化・補間・固定尺度をVanilla JavaScriptで計算", visual: "GLSLの色・光・動きへ入力。観客操作はSCENARIOとして分離",
    },
  });

  const waitForMapAdapter = () => globalThis.GaiaMapObservationAdapter
    ? Promise.resolve(globalThis.GaiaMapObservationAdapter)
    : new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("map adapter timeout")), 12000);
        addEventListener("gaia:map-adapter-ready", () => { clearTimeout(timer); resolve(globalThis.GaiaMapObservationAdapter); }, { once: true });
      });
  const scheduleStepTask = (callback, delay, currentGeneration) => {
    const timer = setTimeout(() => {
      stepTimers.delete(timer);
      if (active && generation === currentGeneration) callback();
    }, delay);
    stepTimers.add(timer);
  };
  const clearStepTasks = () => {
    stepTimers.forEach(clearTimeout);
    stepTimers.clear();
  };
  const closeSpace = () => {
    globalThis.GaiaSpaceTourAdapter?.close?.();
    const spaceLayer = document.querySelector("#space-layer");
    if (spaceLayer instanceof HTMLElement && !spaceLayer.hidden) {
      dispatchEvent(new CustomEvent("gaia:space-close", { detail: { returnToTop: false, source: "tour" } }));
    }
  };
  const clearTargets = () => {
    globalThis.GaiaMapObservationAdapter?.clearFocus?.();
    globalThis.GaiaSpaceTourAdapter?.clearFocus?.();
    cancelAnimationFrame(targetCueFrame);
    targetCueFrame = 0;
    targetCue.classList.remove("is-switching", "is-entering");
    targetSpotlight.classList.remove("is-switching", "is-entering");
    targetCue.hidden = true;
    targetSpotlight.hidden = true;
    delete layer.dataset.cuePhase;
  };
  const clamp = (minimum, maximum, value) => Math.max(minimum, Math.min(maximum, value));
  const overlapArea = (first, second) => Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
    * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  const edgeDistance = (first, second) => {
    const horizontal = Math.max(first.left - second.right, second.left - first.right, 0);
    const vertical = Math.max(first.top - second.bottom, second.top - first.bottom, 0);
    return Math.hypot(horizontal, vertical);
  };
  const positionCardNearTarget = (targetBounds = null) => {
    if (card.hidden || !active || !finishPanel.hidden) return;
    const viewportInset = innerWidth <= 760 ? 10 : 14;
    const gap = innerWidth <= 760 ? 12 : 16;
    const controlsBounds = controls.getBoundingClientRect();
    const safeTop = viewportInset;
    const viewportBottom = innerHeight - viewportInset;
    const controlsClearance = 8;
    const reserveCompactControls = innerWidth <= 760 || innerHeight <= 430;
    const safeBottom = reserveCompactControls && controlsBounds.height > 1 && controlsBounds.top > safeTop
      ? Math.max(safeTop, Math.min(viewportBottom, controlsBounds.top - controlsClearance))
      : viewportBottom;
    const measured = card.getBoundingClientRect();
    const width = Math.min(measured.width, innerWidth - viewportInset * 2);
    const height = Math.min(measured.height, safeBottom - safeTop);
    const maximumLeft = Math.max(viewportInset, innerWidth - viewportInset - width);
    const maximumTop = Math.max(safeTop, safeBottom - height);

    if (!targetBounds) {
      const left = clamp(viewportInset, maximumLeft, (innerWidth - width) / 2);
      const top = clamp(safeTop, maximumTop, safeTop + (safeBottom - safeTop - height) / 2);
      card.style.left = `${Math.round(left)}px`;
      card.style.top = `${Math.round(top)}px`;
      card.dataset.placement = "standalone";
      card.dataset.positioned = "true";
      return;
    }

    const target = {
      left: clamp(0, innerWidth, targetBounds.left),
      top: clamp(0, innerHeight, targetBounds.top),
      right: clamp(0, innerWidth, targetBounds.right),
      bottom: clamp(0, innerHeight, targetBounds.bottom),
    };
    const centerX = (target.left + target.right) / 2;
    const centerY = (target.top + target.bottom) / 2;
    const candidates = [
      { placement: "below", left: centerX - width / 2, top: target.bottom + gap, priority: 0 },
      { placement: "above", left: centerX - width / 2, top: target.top - height - gap, priority: 6 },
      { placement: "right", left: target.right + gap, top: centerY - height / 2, priority: 12 },
      { placement: "left", left: target.left - width - gap, top: centerY - height / 2, priority: 18 },
      { placement: "inside-top", left: centerX - width / 2, top: target.top + gap, priority: 42 },
      { placement: "inside-bottom", left: centerX - width / 2, top: target.bottom - height - gap, priority: 48 },
    ].map((candidate) => {
      const left = clamp(viewportInset, maximumLeft, candidate.left);
      const top = clamp(safeTop, maximumTop, candidate.top);
      const rect = { left, top, right: left + width, bottom: top + height };
      const overlapRatio = overlapArea(rect, target) / Math.max(1, width * height);
      const controlsOverlapRatio = controlsBounds.height > 1
        ? overlapArea(rect, controlsBounds) / Math.max(1, width * height)
        : 0;
      const clampedDistance = Math.hypot(left - candidate.left, top - candidate.top);
      return {
        ...candidate,
        left,
        top,
        rect,
        score: overlapRatio * 10000 + controlsOverlapRatio * 12000
          + edgeDistance(rect, target) + clampedDistance * .7 + candidate.priority,
      };
    });
    const placement = candidates.sort((first, second) => first.score - second.score)[0];
    const arrowX = clamp(24, Math.max(24, width - 24), centerX - placement.left);
    const arrowY = clamp(24, Math.max(24, height - 24), centerY - placement.top);
    card.style.left = `${Math.round(placement.left)}px`;
    card.style.top = `${Math.round(placement.top)}px`;
    card.style.setProperty("--tour-card-arrow-x", `${Math.round(arrowX)}px`);
    card.style.setProperty("--tour-card-arrow-y", `${Math.round(arrowY)}px`);
    card.dataset.placement = placement.placement;
    card.dataset.positioned = "true";
  };
  const positionTargetCue = () => {
    targetCueFrame = 0;
    if (!active || !finishPanel.hidden) { targetCue.hidden = true; targetSpotlight.hidden = true; return; }
    const target = document.querySelector(".gaia-tour-highlight-target");
    const step = steps[index];
    const cue = step?.cues?.[activeCueIndex];
    if (!(target instanceof Element) || !cue || target.getClientRects().length === 0) {
      targetCue.hidden = true;
      targetSpotlight.hidden = true;
      positionCardNearTarget();
      return;
    }
    const bounds = target.getBoundingClientRect();
    positionCardNearTarget(bounds);
    const viewportInset = 6;
    const spotlightLeft = Math.max(viewportInset, bounds.left - 6);
    const spotlightTop = Math.max(viewportInset, bounds.top - 6);
    const spotlightRight = Math.min(innerWidth - viewportInset, bounds.right + 6);
    const spotlightBottom = Math.min(innerHeight - viewportInset, bounds.bottom + 6);
    targetSpotlight.hidden = false;
    targetSpotlight.style.left = `${Math.round(spotlightLeft)}px`;
    targetSpotlight.style.top = `${Math.round(spotlightTop)}px`;
    targetSpotlight.style.width = `${Math.round(Math.max(0, spotlightRight - spotlightLeft))}px`;
    targetSpotlight.style.height = `${Math.round(Math.max(0, spotlightBottom - spotlightTop))}px`;
    targetSpotlight.style.borderRadius = getComputedStyle(target).borderRadius || "12px";
    targetAction.textContent = String(activeCueIndex + 1);
    targetCue.querySelector("span").textContent = cue;
    targetCue.hidden = false;
    const cueBounds = targetCue.getBoundingClientRect();
    const wideTarget = bounds.width > innerWidth * 0.55 || bounds.height > innerHeight * 0.45;
    const preferredLeft = wideTarget ? bounds.left + 16 : bounds.left;
    let left = Math.max(10, Math.min(innerWidth - cueBounds.width - 10, preferredLeft));
    const above = bounds.top - cueBounds.height - 13;
    const below = bounds.bottom + 13;
    let top = wideTarget
      ? Math.max(10, Math.min(innerHeight - cueBounds.height - 10, bounds.top + 16))
      : above >= 10 ? above : Math.min(innerHeight - cueBounds.height - 10, below);
    const cardBounds = card.getBoundingClientRect();
    const overlapsCard = () => left < cardBounds.right + 8
      && left + cueBounds.width > cardBounds.left - 8
      && top < cardBounds.bottom + 8
      && top + cueBounds.height > cardBounds.top - 8;
    if (overlapsCard()) {
      const candidates = [
        { left, top: cardBounds.bottom + 12 },
        { left, top: cardBounds.top - cueBounds.height - 12 },
        { left: cardBounds.left - cueBounds.width - 12, top },
      ];
      const safe = candidates.find((candidate) => candidate.left >= 10
        && candidate.top >= 10
        && candidate.left + cueBounds.width <= innerWidth - 10
        && candidate.top + cueBounds.height <= innerHeight - 76);
      if (safe) ({ left, top } = safe);
    }
    targetCue.style.left = `${Math.round(left)}px`;
    targetCue.style.top = `${Math.round(top)}px`;
    targetCue.classList.toggle("is-inside", wideTarget);
  };
  const scheduleTargetCue = () => {
    cancelAnimationFrame(targetCueFrame);
    targetCueFrame = requestAnimationFrame(() => {
      targetCueFrame = requestAnimationFrame(positionTargetCue);
    });
  };
  const resetTargetLayout = () => {
    if (!active) return;
    layer.classList.add("is-layout-resetting");
    clearTimeout(viewportLayoutTimer);
    scheduleTargetCue();
    viewportLayoutTimer = setTimeout(() => {
      viewportLayoutTimer = 0;
      scheduleTargetCue();
      requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.remove("is-layout-resetting")));
    }, 120);
  };
  const revealTargetCueStage = (nextCueIndex, currentGeneration) => {
    const cues = steps[index]?.cues || [];
    activeCueIndex = Math.max(0, Math.min(cues.length - 1, nextCueIndex));
    layer.dataset.action = String(activeCueIndex + 1);
    layer.dataset.cuePhase = "arriving";
    targetCue.classList.remove("is-switching", "is-entering");
    targetSpotlight.classList.remove("is-switching", "is-entering");
    void targetCue.offsetWidth;
    targetCue.classList.add("is-entering");
    targetSpotlight.classList.add("is-entering");
    scheduleTargetCue();
    scheduleStepTask(() => {
      targetCue.classList.remove("is-entering");
      targetSpotlight.classList.remove("is-entering");
      if (layer.dataset.cuePhase === "arriving") layer.dataset.cuePhase = "focused";
    }, cueRevealMilliseconds, currentGeneration);
  };
  const setTargetCueStage = (nextCueIndex, currentGeneration = generation, { transition = true } = {}) => {
    const hasVisibleCue = !targetCue.hidden || !targetSpotlight.hidden;
    if (reducedMotion || !transition || !hasVisibleCue) {
      revealTargetCueStage(nextCueIndex, currentGeneration);
      return;
    }
    layer.dataset.cuePhase = "leaving";
    targetCue.classList.add("is-switching");
    targetSpotlight.classList.add("is-switching");
    scheduleStepTask(() => revealTargetCueStage(nextCueIndex, currentGeneration), cueFadeMilliseconds, currentGeneration);
  };
  const playCueSequence = (step, currentGeneration) => {
    const cues = step.cues || [];
    setTargetCueStage(0, currentGeneration, { transition: false });
    if (!running || cues.length < 2) return;
    const interval = (step.duration * 1000) / cues.length;
    cues.slice(1).forEach((_, cueIndex) => {
      scheduleStepTask(() => setTargetCueStage(cueIndex + 1, currentGeneration), Math.round(interval * (cueIndex + 1)), currentGeneration);
    });
  };
  const settleInitialFocus = (currentGeneration) => {
    if (!initialFocusPending) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!active || currentGeneration !== generation || !initialFocusPending) return;
      initialFocusPending = false;
      toggle.focus({ preventScroll: true });
    }));
  };
  const renderReceipt = (value) => {
    if (!value) { receipt.hidden = true; return; }
    find("[data-tour-receipt-source]").textContent = [value.source, value.at].filter(Boolean).join(" / ");
    find("[data-tour-receipt-provider]").textContent = value.provider || "保存済み公開データ";
    find("[data-tour-receipt-transform]").textContent = value.transform || "表示用の尺度へ変換";
    find("[data-tour-receipt-visual]").textContent = value.visual || "色・光・動きへ反映";
    receipt.open = false;
    receipt.hidden = false;
  };
  const useStaticFallback = (step) => {
    fallback.hidden = false;
    renderReceipt(staticReceipts[step.id] || null);
    layer.dataset.fallback = "true";
  };
  const applyStep = async (step, currentGeneration) => {
    clearStepTasks();
    clearTargets();
    clearTimeout(viewportLayoutTimer);
    viewportLayoutTimer = 0;
    layer.classList.remove("is-layout-resetting");
    fallback.hidden = true;
    receipt.hidden = true;
    delete layer.dataset.fallback;
    layer.dataset.step = step.id;
    try {
      const mapAdapter = await waitForMapAdapter();
      if (!active || currentGeneration !== generation) return;
      mapAdapter.closeSource?.();
      if (step.id === "map") {
        closeSpace();
        mapAdapter.selectMode(0);
        mapAdapter.openMap();
        mapAdapter.setSignalTime(42);
        await Promise.race([mapAdapter.waitSignalsReady(), new Promise((_, reject) => setTimeout(() => reject(new Error("signals timeout")), 9000))]);
        if (!active || currentGeneration !== generation) return;
        mapAdapter.focusControl?.("map");
        renderReceipt(mapAdapter.getTourReceipt?.() || staticReceipts.map);
        playCueSequence(step, currentGeneration);
      } else if (step.id === "time") {
        closeSpace();
        mapAdapter.selectMode(0);
        mapAdapter.openMap();
        mapAdapter.setSignalTime(22);
        await Promise.race([mapAdapter.waitSignalsReady(), new Promise((_, reject) => setTimeout(() => reject(new Error("signals timeout")), 9000))]);
        if (!active || currentGeneration !== generation) return;
        mapAdapter.focusControl?.("timeline");
        renderReceipt(mapAdapter.getTourReceipt?.() || staticReceipts.time);
        playCueSequence(step, currentGeneration);
        if (running) {
          scheduleStepTask(() => mapAdapter.setSignalTime(58), 2300, currentGeneration);
          scheduleStepTask(() => mapAdapter.setSignalTime(88), 4600, currentGeneration);
        }
      } else if (step.id === "transform") {
        closeSpace();
        mapAdapter.selectMode(0);
        await Promise.race([mapAdapter.waitSignalsReady(), new Promise((_, reject) => setTimeout(() => reject(new Error("signals timeout")), 9000))]);
        if (!active || currentGeneration !== generation) return;
        mapAdapter.openSourceTab?.("raw");
        renderReceipt(mapAdapter.getTourReceipt?.() || staticReceipts.transform);
        playCueSequence(step, currentGeneration);
        if (running) {
          scheduleStepTask(() => { mapAdapter.openSourceTab?.("transform"); scheduleTargetCue(); }, 2300, currentGeneration);
          scheduleStepTask(() => { mapAdapter.openSourceTab?.("visual"); scheduleTargetCue(); }, 4600, currentGeneration);
        }
      } else if (step.id === "story") {
        closeSpace();
        mapAdapter.showIntro();
        mapAdapter.focusControl?.("story");
      } else if (step.id === "proof") {
        closeSpace();
        mapAdapter.showIntro();
        mapAdapter.focusControl?.("credits");
      }
      scheduleTargetCue();
      settleInitialFocus(currentGeneration);
    } catch {
      if (active && currentGeneration === generation) {
        useStaticFallback(step);
        scheduleTargetCue();
        settleInitialFocus(currentGeneration);
      }
    }
  };

  const completedBefore = () => steps.slice(0, index).reduce((sum, step) => sum + step.duration, 0);
  const syncVisualPhase = () => {
    if (!active || !finishPanel.hidden) return;
    const step = steps[index];
    const remaining = Math.max(0, step.duration - elapsed);
    const arrivalWindow = Math.min(arrivalPhaseSeconds, step.duration * 0.32);
    const phase = !running
      ? "focused"
      : elapsed < arrivalWindow
        ? "arriving"
        : remaining <= departurePhaseSeconds
          ? "leaving"
          : "focused";
    layer.dataset.phase = phase;
  };
  const updateClock = () => {
    const totalElapsed = Math.min(totalDuration, completedBefore() + elapsed);
    find("[data-tour-time]").textContent = String(Math.max(0, Math.ceil(totalDuration - totalElapsed)));
    find("[data-tour-progress]").style.transform = `scaleX(${totalElapsed / totalDuration})`;
    syncVisualPhase();
  };
  const syncToggle = () => {
    toggle.setAttribute("aria-pressed", String(running));
    find("[data-tour-toggle-label]").textContent = running ? "止める" : "続ける";
    toggle.setAttribute("aria-label", running ? "自動案内を止める" : "自動案内を続ける");
    layer.dataset.running = String(running);
    syncVisualPhase();
  };
  const renderStep = () => {
    const step = steps[index];
    generation += 1;
    delete layer.dataset.finished;
    delete card.dataset.interacted;
    delete card.dataset.positioned;
    delete card.dataset.placement;
    card.hidden = false;
    finishPanel.hidden = true;
    find("[data-tour-step]").textContent = String(index + 1);
    find("[data-tour-kicker]").textContent = step.kicker;
    find("[data-tour-title]").textContent = step.title;
    find("[data-tour-copy]").textContent = step.copy;
    find("[data-tour-instruction]").textContent = step.instruction;
    find("[data-tour-hint]").textContent = step.hint;
    find("[data-tour-result]").textContent = step.result;
    find("[data-tour-result-label]").textContent = "現れる変化";
    find("[data-tour-gesture]").textContent = step.gesture;
    operationPath.replaceChildren(...step.actions.map(([label, action]) => {
      const item = document.createElement("li");
      const name = document.createElement("b");
      const value = document.createElement("span");
      name.textContent = label;
      value.textContent = action;
      item.append(name, value);
      return item;
    }));
    activeCueIndex = 0;
    layer.dataset.action = "1";
    previous.disabled = index === 0;
    find("[data-tour-next-label]").textContent = index === steps.length - 1 ? "完了" : "次へ";
    Array.from(stepRail.children).forEach((marker, markerIndex) => {
      marker.dataset.state = markerIndex < index ? "complete" : markerIndex === index ? "current" : "pending";
    });
    card.classList.remove("is-entering");
    void card.offsetWidth;
    card.classList.add("is-entering");
    updateClock();
    void applyStep(step, generation);
  };
  const showFinish = () => {
    running = false;
    elapsed = steps.at(-1).duration;
    clearStepTasks();
    clearTargets();
    syncToggle();
    updateClock();
    card.hidden = true;
    finishPanel.hidden = false;
    layer.dataset.finished = "true";
    layer.dataset.phase = "finish";
    finishPanel.classList.remove("is-entering");
    void finishPanel.offsetWidth;
    finishPanel.classList.add("is-entering");
    finishPanel.querySelector("button")?.focus({ preventScroll: true });
  };
  const setStep = (nextIndex, { pause = false } = {}) => {
    if (nextIndex >= steps.length) { showFinish(); return; }
    index = Math.max(0, nextIndex);
    elapsed = 0;
    if (pause) running = false;
    syncToggle();
    renderStep();
  };
  const tick = (now) => {
    if (!active) return;
    if (!lastFrame) lastFrame = now;
    const delta = Math.max(0, (now - lastFrame) / 1000);
    lastFrame = now;
    if (running && !document.hidden && finishPanel.hidden) {
      let remaining = delta;
      while (remaining > 0 && running && finishPanel.hidden) {
        const stepRemaining = Math.max(0, steps[index].duration - elapsed);
        if (remaining < stepRemaining) {
          elapsed += remaining;
          remaining = 0;
        } else {
          remaining -= stepRemaining;
          setStep(index + 1);
        }
      }
      if (finishPanel.hidden) updateClock();
    }
    if (!document.hidden && finishPanel.hidden && now - lastTargetLayoutAt >= 140) {
      lastTargetLayoutAt = now;
      scheduleTargetCue();
    }
    frame = requestAnimationFrame(tick);
  };
  const start = ({ source = "direct" } = {}) => {
    if (active) return;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    returnScroll = { x: window.scrollX, y: window.scrollY };
    active = true;
    running = true;
    index = 0;
    elapsed = 0;
    lastFrame = 0;
    lastTargetLayoutAt = 0;
    initialFocusPending = true;
    layer.hidden = false;
    layer.inert = false;
    layer.dataset.source = source;
    layer.classList.toggle("is-reduced-motion", reducedMotion);
    document.body.classList.add("gaia-tour-open");
    document.body.classList.remove("gaia-route-handoff");
    history.replaceState(null, "", `${location.pathname}${location.search}#tour`);
    syncToggle();
    renderStep();
    frame = requestAnimationFrame(tick);
    requestAnimationFrame(() => toggle.focus({ preventScroll: true }));
  };
  const exit = ({ keepView = false } = {}) => {
    if (!active) return;
    active = false;
    running = false;
    generation += 1;
    clearStepTasks();
    clearTargets();
    clearTimeout(viewportLayoutTimer);
    viewportLayoutTimer = 0;
    layer.classList.remove("is-layout-resetting");
    cancelAnimationFrame(frame);
    closeSpace();
    globalThis.GaiaMapObservationAdapter?.closeSource?.();
    layer.hidden = true;
    layer.inert = true;
    delete layer.dataset.phase;
    delete layer.dataset.cuePhase;
    delete layer.dataset.running;
    document.body.classList.remove("gaia-tour-open");
    if (location.hash === "#tour") history.replaceState(null, "", `${location.pathname}${location.search}`);
    if (!keepView) globalThis.GaiaMapObservationAdapter?.showIntro?.();
    requestAnimationFrame(() => window.scrollTo({ left: returnScroll.x, top: returnScroll.y, behavior: "auto" }));
    returnFocus?.focus?.({ preventScroll: true });
    dispatchEvent(new CustomEvent("gaia:tour-exit"));
  };

  find("[data-tour-action='exit']").addEventListener("click", () => exit());
  previous.addEventListener("click", () => setStep(index - 1));
  next.addEventListener("click", () => setStep(index + 1));
  toggle.addEventListener("click", () => {
    running = !running;
    lastFrame = performance.now();
    generation += 1;
    clearStepTasks();
    if (running) {
      setTargetCueStage(0, generation, { transition: false });
      void applyStep(steps[index], generation);
    } else if (!document.querySelector(".gaia-tour-highlight-target")) {
      // Pausing invalidates the old async preparation. Finish the current
      // target under the new generation without restarting time or cues.
      void applyStep(steps[index], generation);
    }
    syncToggle();
  });
  const confirmTargetInteraction = (event) => {
    if (!active || !(event.target instanceof Element) || !event.target.closest(".gaia-tour-highlight-target")) return;
    find("[data-tour-result-label]").textContent = "観測できました";
    card.dataset.interacted = "true";
  };
  document.addEventListener("click", confirmTargetInteraction, true);
  document.addEventListener("input", confirmTargetInteraction, true);
  layer.querySelectorAll("[data-tour-destination]").forEach((button) => button.addEventListener("click", async () => {
    const destination = button.dataset.tourDestination;
    if (destination === "explore") { exit({ keepView: true }); (await waitForMapAdapter()).openMap(); }
    else if (destination === "story") { exit({ keepView: true }); await globalThis.GaiaModeLoader?.load?.("story"); history.replaceState(null, "", `${location.pathname}${location.search}#story`); dispatchEvent(new CustomEvent("gaia:novel-open-at-mode", { detail: { index: 0, source: "tour" } })); }
    else if (destination === "source") { exit({ keepView: true }); document.querySelector("#source-button")?.click(); }
  }));
  document.addEventListener("visibilitychange", () => {
    if (!active) return;
    if (document.hidden) {
      runningBeforeHidden = running;
      running = false;
      generation += 1;
      clearStepTasks();
    } else if (runningBeforeHidden) {
      running = true;
      lastFrame = performance.now();
      runningBeforeHidden = false;
      generation += 1;
      void applyStep(steps[index], generation);
    }
    syncToggle();
  });
  const layoutResizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => {
      if (active) scheduleTargetCue();
    })
    : null;
  layoutResizeObserver?.observe(card);
  layoutResizeObserver?.observe(controls);
  window.addEventListener("resize", resetTargetLayout, { passive: true });
  window.addEventListener("scroll", scheduleTargetCue, { passive: true, capture: true });
  document.addEventListener("keydown", (event) => {
    if (!active) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); exit(); return; }
    if (event.key !== "Tab") return;
    const targets = Array.from(document.querySelectorAll(".gaia-tour-highlight-target, .gaia-tour-highlight-target button, .gaia-tour-highlight-target input, .gaia-tour-highlight-target[tabindex]"));
    const controls = Array.from(layer.querySelectorAll('button:not([disabled]), a[href]'));
    const focusable = [...targets, ...controls].filter((element, position, list) => element instanceof HTMLElement && element.offsetParent !== null && list.indexOf(element) === position);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }, true);

  globalThis.GaiaGuidedTour = Object.freeze({
    start,
    exit,
    getState: () => ({ active, running, index, stepId: steps[index]?.id || "finish", elapsed, totalDuration }),
  });
  dispatchEvent(new CustomEvent("gaia:guided-tour-ready"));
  if (location.hash === "#tour") {
    const opening = document.querySelector("#gaia-opening");
    if (opening instanceof HTMLElement && !opening.hidden) {
      window.addEventListener("gaia:opening-complete", (event) => {
        if (event.detail?.destination === "tour") requestAnimationFrame(() => start());
      }, { once: true });
    } else {
      start();
    }
  }
})();
