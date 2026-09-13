(() => {
  'use strict';
  const SURF_MIX_GAIN = 0.25;
  const UNVEIL_DURATION_MS = 1400;
  const lines = Object.freeze([
    '白い光の向こうで、海が揺れていた。',
    '潮の匂いを含んだ風と、',
    '遠くの誰かの笑い声。',
    '今日は、見るだけで帰るつもりだった。',
    '人混みも、',
    '知らない誰かと話すのも、得意じゃない。',
    'それでも、ここまで来た。',
    'たぶん、最初の選択は、それだけだった。',
  ]);
  let running = false;
  let ambience = null;
  let plume = null;
  const audioState = () => window.GaiaOpeningAudio?.getState?.();
  const quietUI = active => window.dispatchEvent(new CustomEvent('gaia:story-prologue-audio', { detail: { active } }));

  // Original procedural surf from the opening, plus distant voices only when
  // the exhibition appears. No recordings, microphone, or external assets.
  function prepareAmbience() {
    stopAmbience(0);
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || audioState()?.muted || !audioState()?.volume) return;
    try {
      const context = new AudioContextClass({ latencyHint: 'playback' });
      void context.resume().catch(() => {}); // Called in the title click gesture.
      const master = context.createGain();
      master.gain.value = 0;
      const envelope = context.createGain(); envelope.gain.value = 0;
      master.connect(envelope); envelope.connect(context.destination);
      const voices = context.createGain(); voices.gain.value = 0; voices.connect(master);
      const surf = context.createGain(); surf.gain.value = SURF_MIX_GAIN; surf.connect(master);
      const nodes = [];
      const bed = { context, master, envelope, voices, surf, nodes, audible: true };
      ambience = bed;
      syncAmbience(0);
      envelope.gain.setValueAtTime(0, context.currentTime);
      envelope.gain.linearRampToValueAtTime(1, context.currentTime + 3);
      // Unlock in the click task, but build noise in short batches after the
      // curtain has painted. Sound preparation must not delay the white fade.
      const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
      const build = async () => {
        await nextFrame(); await nextFrame();
        if (ambience !== bed) return;
        const noise = context.createBuffer(2, context.sampleRate * 12, context.sampleRate);
        let seed = 9179;
        const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
        for (let channel = 0; channel < 2; channel++) {
          const data = noise.getChannelData(channel);
          // The swell changes over seconds. Sample its expensive curve sparsely
          // and interpolate, keeping the first white fade responsive.
          const swells = new Float32Array(Math.ceil(data.length / 256) + 1);
          for (let i = 0; i < swells.length; i++) {
            swells[i] = (.5 - .5 * Math.cos(i * 256 / context.sampleRate * Math.PI / 3 + 1.3 + channel * .45)) ** 1.4;
          }
          let air = 0, undertow = 0;
          for (let i = 0; i < data.length; i++) {
            const white = random() * 2 - 1;
            air = .965 * air + .035 * white;
            undertow = .995 * undertow + .005 * white;
            const t = i / context.sampleRate;
            const segment = i >> 8;
            const swell = swells[segment] + (swells[segment + 1] - swells[segment]) * (i % 256) / 256;
            const wash = air * (.8 + 2.4 * swell) + undertow * .8 + white * .07 * swell ** 2;
            data[i] = wash * Math.min(1, t / .35, (12 - t) / .35);
          }
        }
        const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
        const highpass = context.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 65;
        source.connect(highpass); highpass.connect(surf); source.start(); nodes.push(source);
        for (let voice = 0; voice < 6; voice++) {
          await nextFrame();
          if (ambience !== bed) return;
          const murmur = context.createBuffer(1, context.sampleRate * 12, context.sampleRate);
          const data = murmur.getChannelData(0);
          const pace = 2.2 + voice * .31;
          for (let i = 0; i < data.length; i++) {
            const t = i / context.sampleRate;
            const syllable = Math.max(0, Math.sin(t * Math.PI * pace + voice)) ** 2;
            const distance = .13 + .08 * Math.sin(t * Math.PI / 3 + voice);
            data[i] = (random() * 2 - 1) * syllable * distance * Math.min(1, t / .35, (12 - t) / .35);
          }
          const talk = context.createBufferSource(); talk.buffer = murmur; talk.loop = true;
          const band = context.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 320 + voice * 150; band.Q.value = .7;
          const pan = context.createStereoPanner(); pan.pan.value = (voice - 2.5) / 3;
          talk.connect(band); band.connect(pan); pan.connect(voices); talk.start(); nodes.push(talk);
        }
      };
      void build().catch(() => { if (ambience === bed) stopAmbience(0); });
    } catch { stopAmbience(0); }
  }
  function syncAmbience(seconds = .35) {
    if (!ambience) return;
    const { context, master } = ambience;
    const state = audioState();
    const level = !document.hidden && state && !state.muted ? state.volume * state.mixGain * .85 : 0;
    if (ambience.targetLevel === level) return;
    ambience.targetLevel = level;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(level, now + seconds);
  }
  function stopAmbience(seconds = 1.2) {
    if (!ambience) return;
    const previous = ambience; ambience = null;
    const now = previous.context.currentTime;
    previous.master.gain.cancelScheduledValues(now);
    previous.master.gain.setValueAtTime(previous.master.gain.value, now);
    previous.master.gain.linearRampToValueAtTime(0, now + seconds);
    window.setTimeout(() => {
      previous.nodes.forEach(node => { try { node.stop(); } catch { /* already stopped */ } });
      void previous.context.close().catch(() => {});
    }, seconds * 1000 + 40);
  }
  window.addEventListener('gaia:audio-state', () => syncAmbience());
  document.addEventListener('visibilitychange', () => syncAmbience(.15));
  window.addEventListener('gaia:novel-step-rendered', ({ detail }) => {
    if (detail?.stepId !== 'festival_concept_001') stopAmbience(1.6);
  });
  for (const event of ['gaia:return-to-title', 'gaia:return-to-intro', 'pagehide']) {
    window.addEventListener(event, () => stopAmbience(0));
  }

  async function run(ready, enter) {
    if (running) return false;
    running = true;
    const dialog = document.createElement('dialog');
    dialog.id = 'gaia-story-prologue';
    dialog.dataset.phase = 'covering';
    dialog.style.setProperty('--story-prologue-exit-duration', `${UNVEIL_DURATION_MS}ms`);
    dialog.setAttribute('aria-label', '物語のプロローグ');
    dialog.tabIndex = -1;
    const copy = document.createElement('div'); copy.className = 'gaia-story-prologue-copy';
    const paragraphs = lines.map(text => { const p = document.createElement('p'); p.textContent = text; copy.append(p); return p; });
    const controls = document.createElement('div'); controls.className = 'gaia-story-prologue-controls';
    const skip = document.createElement('button'); skip.type = 'button'; skip.textContent = '本編へ'; skip.disabled = true;
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'タイトルへ戻る';
    skip.dataset.uiSound = cancel.dataset.uiSound = 'none';
    const status = document.createElement('p'); status.className = 'gaia-story-prologue-status'; status.setAttribute('role', 'status');
    controls.append(skip, cancel); dialog.append(copy, status, controls); document.body.append(dialog);
    let skipped = false; let cancelled = false; let landed = false;
    skip.addEventListener('click', () => { skipped = true; skip.disabled = true; });
    cancel.addEventListener('click', () => { cancelled = true; });
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancelled = true; });
    // Keep global novel shortcuts out of the modal, including held Enter/Ctrl.
    const guardKeys = event => {
      if (event.key === 'Escape') { event.preventDefault(); cancelled = true; }
      if (event.key === 'Tab') return; // Native modal focus containment.
      event.stopImmediatePropagation();
    };
    document.addEventListener('keydown', guardKeys, true);
    const checkCancelled = () => { if (cancelled) throw new DOMException('Prologue cancelled', 'AbortError'); };
    // Only visible reading time counts; returning to a tab cannot skip the text.
    async function wait(milliseconds, skippable = false) {
      let elapsed = 0; let previous = performance.now();
      while (elapsed < milliseconds && !(skippable && skipped)) {
        await new Promise(resolve => setTimeout(resolve, 30));
        checkCancelled();
        const now = performance.now();
        if (!document.hidden) elapsed += Math.min(100, now - previous);
        previous = now;
      }
      checkCancelled();
    }
    let loaded = false; let loadError = null;
    // Attach the rejection handler immediately while the prologue is reading.
    Promise.resolve(ready).then(() => { loaded = true; }, error => { loadError = error; });
    try {
      document.body.classList.add('gaia-story-prologue-active');
      dialog.showModal(); dialog.focus({ preventScroll: true });
      prepareAmbience();
      quietUI(true);
      window.GaiaOpeningAudio?.setDuckGain?.('story-prologue', 0, 2.1);
      void dialog.offsetWidth;
      dialog.classList.add('is-white');
      plume = window.GaiaStoryPlume?.create?.(dialog) || null;
      await wait(2100);
      dialog.dataset.phase = 'reading'; skip.disabled = false;
      for (const paragraph of paragraphs) {
        paragraph.classList.add('is-visible');
        await wait(1150, true);
      }
      dialog.dataset.phase = 'breathing';
      await wait(2200, true);
      let loadWait = 0;
      while (!loaded && !loadError && loadWait < 20000) {
        status.textContent = '海沿いの展示場を準備しています…';
        await wait(100); loadWait += 100;
      }
      if (loadError || !loaded) throw loadError || new Error('Story entry timed out');
      status.textContent = ''; skip.disabled = true; cancel.disabled = true;
      dialog.dataset.phase = 'preparing';
      await enter(async () => {
        checkCancelled();
        dialog.dataset.phase = 'unveiling';
        if (ambience) {
          const now = ambience.context.currentTime;
          ambience.voices.gain.setValueAtTime(0, now);
          ambience.voices.gain.linearRampToValueAtTime(1, now + 1.8);
          // The surf leaves with the white curtain. Keep distant voices and
          // user volume independent, so muting/unmuting cannot revive it.
          ambience.surf.gain.cancelScheduledValues(now);
          ambience.surf.gain.setValueAtTime(ambience.surf.gain.value, now);
          ambience.surf.gain.linearRampToValueAtTime(0, now + UNVEIL_DURATION_MS / 1000);
        }
        window.GaiaOpeningAudio?.setDuckGain?.('story-prologue', 1, 3.2);
        dialog.classList.add('is-clearing');
        await wait(UNVEIL_DURATION_MS + 50);
      });
      landed = true;
      return true;
    } finally {
      running = false;
      plume?.dispose(); plume = null;
      dialog.close(); dialog.remove();
      document.body.classList.remove('gaia-story-prologue-active');
      document.removeEventListener('keydown', guardKeys, true);
      quietUI(false);
      if (!landed) {
        stopAmbience(0);
        window.GaiaOpeningAudio?.setDuckGain?.('story-prologue', 1, 1.2);
      }
    }
  }
  window.GaiaStoryPrologue = Object.freeze({ run, getState: () => ({ running, plume: plume?.getState() || null, ambience: Boolean(ambience), ambienceGain: ambience ? ambience.master.gain.value * ambience.envelope.gain.value : 0, surfGain: ambience?.surf.gain.value || 0, waveFade: ambience ? ambience.envelope.gain.value * ambience.surf.gain.value / SURF_MIX_GAIN : 0, contextState: ambience?.context.state || 'closed' }) });
})();
