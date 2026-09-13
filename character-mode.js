/** 概要: 人物紹介画面。キャラクター・表情の切替と、プロフィール・イラストの表示を管理する。 */
(() => {
  "use strict";

  const layer = document.querySelector("#character-book-layer");
  if (!(layer instanceof HTMLElement)) return;
  const translate = text => window.GaiaI18n?.t(text) ?? text;
  const displayLanguage = () => window.GaiaI18n?.get() || "ja";

  const quoteRevealDelay = 620;
  const assetVersion = "gaia-aoneko-natural-posture-1";
  const portrait = (filename) => "/assets/characters/" + filename + "?v=" + assetVersion;
  const expression = (id, label, filename, alt) => Object.freeze({ id, label, src: portrait(filename), alt });
  const expressionSets = Object.freeze({
    amane: Object.freeze([
      expression("calm", "通常", "amane-calm-07-v2.png", "落ち着いた表情の雨宮 周"),
      expression("soft", "微笑み", "amane-soft-07-v2.png", "やわらかく微笑む雨宮 周"),
      expression("startled", "驚き", "amane-startled-07-v2.png", "驚いた表情の雨宮 周"),
      expression("exasperated", "呆れ", "amane-exasperated-07-v2.png", "少し呆れた表情の雨宮 周"),
    ]),
    mizuha: Object.freeze([
      expression("calm", "通常", "mizuha-calm-07-v2.png", "穏やかな表情の青野 瑞葉"),
      expression("sad", "悲しみ", "mizuha-sad-07-v2.png", "悲しげな表情の青野 瑞葉"),
      expression("teasing", "からかい", "mizuha-teasing-07-v2.png", "いたずらっぽくからかう青野 瑞葉"),
      expression("worried", "心配", "mizuha-worried-07-v2.png", "心配そうな表情の青野 瑞葉"),
    ]),
    sakuya: Object.freeze([
      expression("calm", "通常", "sakuya-calm-07-v1.png", "落ち着いた表情の木下 咲弥"),
      expression("sad", "悲しみ", "sakuya-sad-07-v1.png", "悲しげな表情の木下 咲弥"),
      expression("teasing", "からかい", "sakuya-teasing-07-v1.png", "挑発的にからかう木下 咲弥"),
      expression("worried", "心配", "sakuya-worried-07-v1.png", "心配そうな表情の木下 咲弥"),
    ]),
    aoneko: Object.freeze([
      expression("calm", "シルエット", "aoneko-silhouette-imagegen-v4.png", "首を自然に起こし、鞄の紐とスマートフォンを手にして立つ、低めの頭身の青猫の中性的なシルエット"),
    ]),
  });
  const characters = Object.freeze([
    {
      id: "amane",
      native: "あめ",
      fullName: "雨宮 周",
      reading: "あめみや あまね",
      tagline: "20,000ルーメンを背負う電工少女",
      copy: "現場の物理的な信号を捉え、回路とセンサーで確実に具現化する。",
      quote: "「信号線とは違うの。一本飛んだら、本当に終わるよ」",
      profile: [
        ["水色のショートボブと", "眠そうな目元が特徴の", "大学2年生。"],
        ["普段は無口で", "省エネ運転だが、", "電気やエネルギーの話になると", "途端にスイッチが入る。"],
        ["電気工事士・電気主任技術者の", "資格を持ち、", "現場の機材設営から", "安全管理までを", "一手に担う実践派。"],
      ],
      domain: "電力工学・施設設備",
      role: "実装・検証（PoC）",
      tool: "テスター・計測機器・配線工具",
      tone: "107, 168, 221",
      expressions: expressionSets.amane,
      src: expressionSets.amane[0].src,
      alt: expressionSets.amane[0].alt,
    },
    {
      id: "mizuha",
      native: "みず",
      fullName: "青野 瑞葉",
      reading: "あおの みずは",
      tagline: "星の呼吸を言葉にする語り部",
      copy: "生命と地球の共進化をたどり、観測された変化を言葉にする。",
      quote: "「46億年、ずっと変わり続けている星ですから」",
      profile: [
        ["海色の長い髪と", "おっとりした丁寧語が", "印象的な大学2年生。"],
        ["大気と水系の循環に関心を持ち、", "観測データの科学考証と、"],
        ["地球の動態を読み解く", "ストーリーテリングを担当する。"],
        ["物腰は穏やかだが、", "データの出典や数字の正確さ、"],
        ["観測条件の厳密さには", "決して妥協しない。"],
      ],
      domain: "地球科学・生命史",
      role: "概念設計・ナラティブ",
      tool: "フィールドノート・観測記録",
      tone: "61, 153, 186",
      expressions: expressionSets.mizuha,
      src: expressionSets.mizuha[0].src,
      alt: expressionSets.mizuha[0].alt,
    },
    {
      id: "sakuya",
      native: "saku",
      fullName: "木下 咲弥",
      reading: "きのした さくや",
      tagline: "海を隔てて世界を繋ぐアーキテクト",
      copy: "遠隔から全体を俯瞰し、無数の観測データを束ねる構造を組む。",
      quote: "「まだ気づいてないだけでしょ。世界は満ちてるよ」",
      profile: [
        ["海外からオンラインで参加する", "サークルのプロデューサー。"],
        ["普段のチャットでは", "無駄口を叩かないが、", "作品の構想や"],
        ["システムデザインの議論では、", "圧倒的な解像度を発揮する。"],
        ["『GAIA SENSEWARE』の", "名付け親であり、"],
        ["プロジェクトの骨格を支える", "システムアーキテクト。"],
      ],
      domain: "情報工学・統計学",
      role: "プロデュース・全体統括",
      tool: "チャットツール・仕様設計書",
      tone: "184, 129, 117",
      expressions: expressionSets.sakuya,
      src: expressionSets.sakuya[0].src,
      alt: expressionSets.sakuya[0].alt,
    },
    {
      id: "aoneko",
      native: "青猫",
      tagline: "手元の観測を、世界につなぐ新しい仲間",
      copy: "身近な環境を測り、小さなセンサーから地球との接点を探していく。",
      quote: "「この小さなセンサーから、つなげてみたいです」",
      profile: [
        ["展示ブースを訪れたことをきっかけに、"],
        ["「惑星の放課後」に加わった", "新しい仲間。"],
        ["電子工作とプログラミングが好きで、"],
        ["ESP32を使った試作や", "データ連携を手伝う。"],
        ["身近な環境の小さな変化から、", "地球の見方を探している。"],
      ],
      domain: "電子工作・エッジ処理",
      role: "試作・センサーデータ連携",
      tool: "ESP32・温湿度センサー",
      tone: "78, 161, 190",
      expressions: expressionSets.aoneko,
      src: expressionSets.aoneko[0].src,
      alt: expressionSets.aoneko[0].alt,
    },
  ]);

  const storyCgs = Object.freeze([
    {
      id: "first-encounter",
      title: "はじめまして",
      chapter: "01｜海辺の屋外展示",
      assetPath: "assets/visuals-07/event-cg-first-encounter-five-plane-v3.png",
      mobileAssetPath: "assets/visuals-07/event-cg-first-encounter-five-plane-mobile-v2.png",
      alt: "海辺の展示ブースで、ミズハとアマネに初めて出会う",
      poem: [
        "海風の抜ける通りで、ふたりと出会った。",
        "柔らかな秋の光のなか、物語が静かに動き出す。",
      ],
    },
    {
      id: "amane-closeup",
      title: "手元のあかり",
      chapter: "01｜海辺の屋外展示",
      assetPath: "assets/visuals-07/event-cg-amane-closeup-five-plane-v4.png",
      alt: "展示機材へ手を添え、穏やかに振り向くアマネ",
      poem: [
        "暗幕のなか、そっと機器のスイッチを入れる。",
        "小さなランプの灯りが、ふたりの手元を照らしだす。",
      ],
    },
    {
      id: "mizuha-closeup",
      title: "澄んだまなざし",
      chapter: "01｜海辺の屋外展示",
      assetPath: "assets/visuals-07/event-cg-mizuha-closeup-five-plane-v3.png",
      alt: "タブレット越しにこちらを見つめるミズハ",
      poem: [
        "海の青を映したような瞳で、静かにこちらを見つめている。",
        "言葉を交わす前の、少しだけ照れくさい一瞬。",
      ],
    },
    {
      id: "esp32-collaboration",
      title: "小さな設計図",
      chapter: "04｜ESP32プロトタイプ",
      assetPath: "assets/visuals-07/event-cg-esp32-collaboration-v2.png",
      mobileAssetPath: "assets/visuals-07/event-cg-esp32-collaboration-mobile-v1.png",
      alt: "ESP32とセンサーを囲み、ミズハとアマネが試作を考える",
      poem: [
        "机の上に広げた小さな基板と、画面を覗き込む横顔。",
        "並んで試行錯誤した時間が、ふたりの距離を縮めていく。",
      ],
    },
    {
      id: "circle-welcome",
      title: "輪のなかへ",
      chapter: "05｜サークルへの招待",
      assetPath: "assets/visuals-07/event-cg-circle-welcome-v2.png",
      mobileAssetPath: "assets/visuals-07/event-cg-circle-welcome-mobile-v1.png",
      alt: "秋晴れの展示ブースで、サークル加入を迎えるミズハとアマネ",
      poem: [
        "「おいでよ」と招くように、差し出された手。",
        "気付けば、同じ景色を一緒に眺める仲間になっていた。",
      ],
    },
    {
      id: "exhibition-finale",
      title: "夕暮れの帰り道",
      chapter: "06｜はじめまして",
      assetPath: "assets/ending-candidates-20260909/01-turning-in-the-sunset.webp",
      mobileAssetPath: "assets/ending-candidates-20260909/01-turning-in-the-sunset.webp",
      alt: "夕日の海沿いを歩きながら、ミズハとアマネがこちらを振り返る",
      poem: [
        "展示を終えて、夕焼けに染まる海沿いを歩く。",
        "今日の終わりは、新しい始まり。",
      ],
    },
  ].map((entry) => Object.freeze({ ...entry, poem: Object.freeze(entry.poem) })));

  const createAtmosphere = (canvas) => {
    const fallback = () => {
      if (canvas instanceof HTMLCanvasElement) canvas.dataset.webglState = "fallback";
      return Object.freeze({ start() {}, stop() {}, setAccent() {}, setPointer() {}, setDepth() {} });
    };
    if (!(canvas instanceof HTMLCanvasElement)) return fallback();

    try {
      const gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      });
      if (!gl) return fallback();

      const vertexSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
          v_uv = a_position * 0.5 + 0.5;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;
      const fragmentSource = `
        precision highp float;
        varying vec2 v_uv;
        uniform vec2 u_resolution;
        uniform vec2 u_pointer;
        uniform float u_time;
        uniform float u_depth;
        uniform vec3 u_accent;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 345.45));
          p += dot(p, p + 34.345);
          return fract(p.x * p.y);
        }
        float noise21(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x),
            f.y
          );
        }
        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.55;
          for (int i = 0; i < 4; i++) {
            value += noise21(p) * amplitude;
            p = mat2(1.64, -1.11, 1.11, 1.64) * p + 7.13;
            amplitude *= 0.48;
          }
          return value;
        }
        float dust(vec2 uv, float scale, float seed) {
          vec2 cell = fract(uv * scale) - 0.5;
          vec2 id = floor(uv * scale);
          float random = hash21(id + seed);
          vec2 offset = vec2(hash21(id + seed + 7.1), hash21(id + seed + 19.7)) - 0.5;
          float point = 1.0 - smoothstep(0.018, 0.095, length(cell - offset * 0.62));
          return point * step(0.955, random) * (0.65 + 0.35 * sin(u_time * 0.55 + random * 25.0));
        }
        void main() {
          vec2 uv = v_uv;
          float aspect = u_resolution.x / max(u_resolution.y, 1.0);
          vec2 pointer = (u_pointer - 0.5) * vec2(0.025, -0.018);
          vec2 p = uv - 0.5 + pointer;
          p.x *= aspect;
          float t = u_time * 0.035;
          vec3 accent = clamp(u_accent, 0.0, 1.0);
          vec3 pearl = vec3(0.91, 0.96, 0.96);
          vec3 celadon = vec3(0.48, 0.74, 0.76);
          vec3 skyBlue = vec3(0.19, 0.49, 0.68);
          vec3 indigo = vec3(0.035, 0.12, 0.25);
          float horizon = 0.36;

          float skyMix = smoothstep(horizon, 1.0, uv.y);
          vec3 color = mix(pearl, mix(skyBlue, indigo, skyMix), pow(skyMix, 0.72));
          color = mix(color, accent, 0.05 + 0.05 * (1.0 - skyMix));
          float cloudField = fbm(vec2(uv.x * 3.0 - t, uv.y * 8.0 + t * 0.4));
          float cloudBand = exp(-pow((uv.y - 0.53) / 0.13, 2.0));
          color += pearl * smoothstep(0.58, 0.82, cloudField) * cloudBand * 0.16;
          vec2 sunSpace = (uv - vec2(0.14, 0.48)) * vec2(aspect, 1.0);
          float sun = exp(-dot(sunSpace, sunSpace) * 22.0);
          color += vec3(1.0, 0.83, 0.56) * sun * 0.2;

          float waterMask = 1.0 - smoothstep(horizon - 0.01, horizon + 0.025, uv.y);
          float waveField = fbm(vec2(uv.x * 7.0 + t * 1.4, uv.y * 31.0 - t));
          float ripple = 0.5 + 0.5 * sin(uv.x * 54.0 + waveField * 7.0 - t * 18.0);
          vec3 water = mix(indigo * 0.7, mix(celadon, accent, 0.28), uv.y / max(horizon, 0.01));
          water += pearl * pow(ripple, 14.0) * 0.13;
          float reflection = exp(-pow((uv.x - 0.14) / (0.035 + uv.y * 0.35), 2.0));
          water += vec3(1.0, 0.78, 0.45) * reflection * (0.04 + ripple * 0.1);
          color = mix(color, water, waterMask * 0.88);
          float shore = exp(-520.0 * abs(uv.y - horizon - (waveField - 0.5) * 0.003));
          color += pearl * shore * 0.22;

          float ribbonNoise = fbm(vec2(p.x * 0.75 + t, p.y * 1.7 - t * 0.7));
          float ribbonA = exp(-pow(abs(p.y - 0.23 - 0.11 * sin(p.x * 1.35 + t * 4.0) - (ribbonNoise - 0.5) * 0.12) / 0.055, 2.0));
          float ribbonB = exp(-pow(abs(p.y - 0.36 - 0.08 * cos(p.x * 1.1 - t * 3.2) + (ribbonNoise - 0.5) * 0.08) / 0.08, 2.0));
          float ribbonFade = smoothstep(-0.55, 0.42, p.x) * (1.0 - smoothstep(0.36, 0.92, uv.y));
          color += mix(pearl, accent, 0.35) * (ribbonA * 0.05 + ribbonB * 0.035) * ribbonFade;
          float motes = dust(uv + vec2(t * 0.07, t * 0.03), 34.0, 3.2)
            + dust(uv - vec2(t * 0.04, t * 0.06), 57.0, 17.8) * 0.62;
          color += mix(pearl, vec3(1.0, 0.82, 0.55), hash21(floor(uv * 29.0))) * motes * 0.34;
          float vignette = smoothstep(1.1, 0.18, length((uv - 0.5) * vec2(0.78, 1.05)));
          color *= 0.77 + vignette * 0.3;
          color = mix(color, pearl, clamp(u_depth, 0.0, 1.0) * 0.12);
          gl_FragColor = vec4(pow(max(color, 0.0), vec3(0.96)), 0.94);
        }
      `;

      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const reason = gl.getShaderInfoLog(shader) || "shader compilation failed";
          gl.deleteShader(shader);
          throw new Error(reason);
        }
        return shader;
      };

      const program = gl.createProgram();
      const vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "program link failed");

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const uniforms = {
        resolution: gl.getUniformLocation(program, "u_resolution"),
        pointer: gl.getUniformLocation(program, "u_pointer"),
        time: gl.getUniformLocation(program, "u_time"),
        depth: gl.getUniformLocation(program, "u_depth"),
        accent: gl.getUniformLocation(program, "u_accent"),
      };
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let frameId = 0;
      let running = false;
      let startedAt = performance.now();
      let lastFrame = 0;
      let pointer = [0.5, 0.5];
      let pointerTarget = [0.5, 0.5];
      let accent = [61 / 255, 153 / 255, 186 / 255];
      let accentTarget = [...accent];
      let depth = 0;
      let depthTarget = 0;

      const resize = () => {
        const cssWidth = Math.max(1, canvas.clientWidth);
        const cssHeight = Math.max(1, canvas.clientHeight);
        const cap = Math.sqrt(2350000 / (cssWidth * cssHeight));
        const ratio = Math.min(window.devicePixelRatio || 1, 1.35, cap);
        const width = Math.max(1, Math.round(cssWidth * ratio));
        const height = Math.max(1, Math.round(cssHeight * ratio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
        }
      };

      const draw = (timestamp) => {
        resize();
        for (let i = 0; i < 3; i += 1) accent[i] += (accentTarget[i] - accent[i]) * 0.04;
        pointer[0] += (pointerTarget[0] - pointer[0]) * 0.035;
        pointer[1] += (pointerTarget[1] - pointer[1]) * 0.035;
        depth += (depthTarget - depth) * 0.06;
        gl.useProgram(program);
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.pointer, pointer[0], pointer[1]);
        gl.uniform1f(uniforms.time, (timestamp - startedAt) / 1000);
        gl.uniform1f(uniforms.depth, depth);
        gl.uniform3f(uniforms.accent, accent[0], accent[1], accent[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        canvas.dataset.webglRendered = "true";
      };
      const loop = (timestamp) => {
        if (!running) return;
        if (timestamp - lastFrame >= 1000 / 30) {
          lastFrame = timestamp;
          draw(timestamp);
        }
        frameId = requestAnimationFrame(loop);
      };
      const start = () => {
        if (running) return;
        running = true;
        startedAt = performance.now();
        if (reducedMotion.matches) {
          draw(startedAt + 1);
          running = false;
        } else {
          frameId = requestAnimationFrame(loop);
        }
      };
      const stop = () => {
        running = false;
        cancelAnimationFrame(frameId);
      };
      const setAccent = (tone) => {
        const channels = String(tone).split(",").map((value) => Math.max(0, Math.min(255, Number(value.trim()) || 0)) / 255);
        if (channels.length === 3) accentTarget = channels;
        if (reducedMotion.matches) draw(performance.now());
      };
      const setPointer = (event) => {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        pointerTarget = [
          Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
          Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)),
        ];
      };
      const setDepth = (value) => { depthTarget = Math.max(0, Math.min(1, Number(value) || 0)); };

      canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        stop();
        canvas.dataset.webglState = "fallback";
      });
      window.addEventListener("resize", resize, { passive: true });
      canvas.dataset.webglState = "ready";
      draw(performance.now());
      return Object.freeze({ start, stop, setAccent, setPointer, setDepth });
    } catch (_error) {
      return fallback();
    }
  };

  const canvas = layer.querySelector("#character-book-webgl");
  const scroller = layer.querySelector("#character-book-scroll");
  const closeButton = layer.querySelector("#character-book-close");
  const closeButtons = Array.from(layer.querySelectorAll("[data-character-close]"));
  const selectors = Array.from(layer.querySelectorAll("[data-character-select]"));
  const heroImage = layer.querySelector("#character-book-image");
  const heroDetail = layer.querySelector(".character-book-hero-detail");
  const native = layer.querySelector("#character-book-native");
  const fullName = layer.querySelector("#character-book-full-name");
  const reading = layer.querySelector("#character-book-reading");
  const tagline = layer.querySelector("#character-book-tagline");
  const profile = layer.querySelector("#character-book-profile");
  const expressionList = layer.querySelector("#character-book-expression-list");
  const expressionName = layer.querySelector("#character-book-expression-name");
  const quote = layer.querySelector("#character-book-quote");
  const current = layer.querySelector("#character-book-current");
  const cgGrid = layer.querySelector("#character-book-cg-grid");
  const cgViewer = layer.querySelector("#character-book-cg-viewer");
  const cgViewerSheet = layer.querySelector(".character-book-cg-viewer-sheet");
  const cgViewerFigure = layer.querySelector(".character-book-cg-viewer-figure");
  const cgViewerImage = layer.querySelector("#character-book-cg-viewer-image");
  const cgViewerChapter = layer.querySelector("#character-book-cg-viewer-chapter");
  const cgViewerTitle = layer.querySelector("#character-book-cg-viewer-title");
  const cgViewerPoem = layer.querySelector("#character-book-cg-viewer-poem");
  const cgViewerCount = layer.querySelector("#character-book-cg-viewer-count");
  const cgViewerPrevious = layer.querySelector("#character-book-cg-viewer-previous");
  const cgViewerNext = layer.querySelector("#character-book-cg-viewer-next");
  const cgViewerCloseButtons = Array.from(layer.querySelectorAll("[data-character-cg-close]"));
  const atmosphere = createAtmosphere(canvas);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compactCg = window.matchMedia("(max-width: 720px)");

  let currentIndex = 0;
  let openState = false;
  let lastFocused = null;
  let backgroundStates = [];
  let switchTimer = 0;
  let switchGeneration = 0;
  let displayedCharacterId = null;
  let displayedExpressionId = null;
  let expressionHoverReady = true;
  let cgViewerOpen = false;
  let currentCgIndex = 0;
  let cgViewerPreviousFocus = null;
  let cgViewerCloseTimer = 0;

  const imagePreloads = new Map();
  const ensureImagePreload = (src) => {
    if (imagePreloads.has(src)) return imagePreloads.get(src);
    const preload = new Image();
    preload.decoding = "async";
    preload.src = src;
    imagePreloads.set(src, preload);
    return preload;
  };
  characters.forEach(({ src }) => ensureImagePreload(src));
  const preloadCharacterExpressions = (character) => {
    character.expressions.forEach(({ src }) => ensureImagePreload(src));
  };

  const cgAsset = (entry, compact = compactCg.matches) => (
    "/" + (compact && entry.mobileAssetPath ? entry.mobileAssetPath : entry.assetPath) + "?v=gaia-character-cg-1"
  );

  const renderStoryCgs = () => {
    if (!(cgGrid instanceof HTMLElement)) return;
    const cards = storyCgs.map((entry, index) => {
      const card = document.createElement("button");
      const picture = document.createElement("picture");
      const image = document.createElement("img");
      const copy = document.createElement("span");
      const meta = document.createElement("span");
      const number = document.createElement("small");
      const chapter = document.createElement("small");
      const title = document.createElement("strong");
      const poem = document.createElement("span");
      card.type = "button";
      card.className = "character-book-cg-card";
      card.dataset.characterCgId = entry.id;
      card.style.setProperty("--character-cg-order", String(index));
      card.setAttribute("aria-label", `${entry.title}を大きく見る`);
      picture.className = "character-book-cg-card-visual";
      image.src = cgAsset(entry, false);
      image.alt = entry.alt;
      image.width = 1792;
      image.height = 1008;
      image.loading = index === 0 ? "eager" : "lazy";
      image.decoding = "async";
      picture.append(image);
      copy.className = "character-book-cg-card-copy";
      meta.className = "character-book-cg-card-meta";
      number.textContent = `CG ${String(index + 1).padStart(2, "0")}`;
      chapter.textContent = entry.chapter;
      meta.append(number, chapter);
      title.textContent = entry.title;
      poem.className = "character-book-cg-card-poem";
      entry.poem.forEach((line) => {
        const poemLine = document.createElement("span");
        poemLine.textContent = line;
        poem.append(poemLine);
      });
      copy.append(meta, title, poem);
      card.append(picture, copy);
      card.addEventListener("click", () => openCgViewer(index, card));
      return card;
    });
    cgGrid.replaceChildren(...cards);
  };

  const renderCgViewer = (index, { animate = false, direction = 1 } = {}) => {
    const normalizedIndex = (index + storyCgs.length) % storyCgs.length;
    const entry = storyCgs[normalizedIndex];
    currentCgIndex = normalizedIndex;
    if (cgViewer instanceof HTMLElement) cgViewer.dataset.characterCgId = entry.id;
    if (cgViewerImage instanceof HTMLImageElement) {
      cgViewerImage.src = cgAsset(entry);
      cgViewerImage.alt = entry.alt;
    }
    if (cgViewerChapter) cgViewerChapter.textContent = entry.chapter;
    if (cgViewerTitle) cgViewerTitle.textContent = entry.title;
    if (cgViewerPoem) {
      const lines = entry.poem.map((line) => {
        const span = document.createElement("span");
        span.textContent = line;
        return span;
      });
      cgViewerPoem.replaceChildren(...lines);
    }
    if (cgViewerCount) {
      cgViewerCount.textContent = `${String(normalizedIndex + 1).padStart(2, "0")} / ${String(storyCgs.length).padStart(2, "0")}`;
    }
    if (animate && !reducedMotion.matches && cgViewerSheet instanceof HTMLElement) {
      cgViewerSheet.dataset.turnDirection = direction > 0 ? "next" : "previous";
      cgViewerSheet.classList.remove("is-turning");
      void cgViewerSheet.offsetWidth;
      cgViewerSheet.classList.add("is-turning");
      window.setTimeout(() => cgViewerSheet.classList.remove("is-turning"), 520);
    }
  };

  const openCgViewer = (index, trigger = null) => {
    if (!(cgViewer instanceof HTMLElement)) return;
    window.clearTimeout(cgViewerCloseTimer);
    cgViewerPreviousFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
    renderCgViewer(index);
    cgViewerOpen = true;
    cgViewer.hidden = false;
    cgViewer.inert = false;
    cgViewer.setAttribute("aria-hidden", "false");
    layer.classList.add("is-cg-viewing");
    layer.querySelector(".character-book-cg-viewer-close")?.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      cgViewer.classList.add("is-open");
    });
  };

  const closeCgViewer = ({ restoreFocus = true, immediate = false } = {}) => {
    if (!(cgViewer instanceof HTMLElement) || (!cgViewerOpen && cgViewer.hidden)) return;
    window.clearTimeout(cgViewerCloseTimer);
    cgViewerOpen = false;
    cgViewer.classList.remove("is-open");
    cgViewer.setAttribute("aria-hidden", "true");
    layer.classList.remove("is-cg-viewing");
    const finish = () => {
      const focusTarget = restoreFocus && cgViewerPreviousFocus instanceof HTMLElement
        ? cgViewerPreviousFocus
        : null;
      cgViewer.hidden = true;
      cgViewer.inert = true;
      if (cgViewerImage instanceof HTMLImageElement) {
        cgViewerImage.removeAttribute("src");
        cgViewerImage.alt = "";
      }
      cgViewerPreviousFocus = null;
      if (focusTarget?.isConnected) requestAnimationFrame(() => {
        if (!cgViewerOpen && focusTarget.isConnected) focusTarget.focus({ preventScroll: true });
      });
    };
    if (immediate || reducedMotion.matches) finish();
    else cgViewerCloseTimer = window.setTimeout(finish, 320);
  };

  const turnCgViewer = (offset) => {
    if (!cgViewerOpen) return;
    renderCgViewer(currentCgIndex + offset, { animate: true, direction: offset });
  };

  renderStoryCgs();

  const suspendBackground = () => {
    backgroundStates = [];
    const parent = layer.parentElement;
    if (!parent) return;
    Array.from(parent.children).forEach((element) => {
      if (!(element instanceof HTMLElement) || element === layer) return;
      backgroundStates.push({ element, inert: element.inert });
      element.inert = true;
    });
  };
  const restoreBackground = () => {
    backgroundStates.forEach(({ element, inert }) => {
      // A hash route may already have opened a previously hidden sibling.
      // Do not overwrite that route's active state with our old inert snapshot.
      if (element.isConnected) element.inert = !element.hidden && element.getAttribute('aria-hidden') === 'false' ? false : inert;
    });
    backgroundStates = [];
  };

  const makeLetter = (letter, index, delayBase = 0, delayStep = 17) => {
    const glyph = document.createElement("span");
    const seed = letter.codePointAt(0) || index;
    glyph.className = `character-book-letter${/\s/u.test(letter) ? " is-space" : ""}`;
    glyph.textContent = /\s/u.test(letter) ? "\u00a0" : letter;
    glyph.setAttribute("aria-hidden", "true");
    glyph.style.setProperty("--character-letter-delay", `${delayBase + index * delayStep}ms`);
    glyph.style.setProperty("--character-letter-x", `${((seed + index * 5) % 13) - 6}px`);
    glyph.style.setProperty("--character-letter-y", `${5 + ((seed + index * 3) % 9)}px`);
    glyph.style.setProperty("--character-letter-r", `${((seed + index * 7) % 9) - 4}deg`);
    return glyph;
  };

  const setLetterText = (element, text, delayBase = 0) => {
    if (!(element instanceof HTMLElement)) return;
    text = translate(text);
    // Translate the sentence before splitting its entrance animation into glyphs.
    element.setAttribute("translate", "no");
    element.setAttribute("aria-label", text);
    if (displayLanguage() === "en") {
      let offset = 0;
      element.replaceChildren(...(text.match(/\S+\s*|\s+/gu) || []).map(word => {
        const span = document.createElement("span");
        span.className = "character-book-localized-word";
        span.append(...Array.from(word, (letter, index) => makeLetter(letter, offset + index, delayBase)));
        offset += Array.from(word).length;
        return span;
      }));
    } else element.replaceChildren(...Array.from(text, (letter, index) => makeLetter(letter, index, delayBase)));
  };

  const setProfileText = (sentences) => {
    if (!(profile instanceof HTMLElement)) return;
    const text = translate(sentences.flat().join(""));
    profile.setAttribute("translate", "no");
    if (displayLanguage() !== "ja") {
      const segmenter = new Intl.Segmenter(displayLanguage(), { granularity: "word" });
      sentences = text.split("\n").map(line => displayLanguage() === "en"
        ? (line.match(/\S+\s*|\s+/gu) || [])
        : [...segmenter.segment(line)].map(item => item.segment));
    }
    let letterOffset = 0;
    profile.setAttribute("aria-label", text);
    profile.replaceChildren(...sentences.map((sentence) => {
      const line = document.createElement("span");
      line.setAttribute("aria-hidden", "true");
      sentence.forEach((phrase) => {
        // Keep the letter entrance while allowing wrapping only between phrases.
        // Each phrase includes its punctuation so closing marks never start a line.
        const chunk = document.createElement("span");
        chunk.className = "character-book-profile-phrase";
        chunk.append(...Array.from(phrase, (letter, index) => makeLetter(letter, letterOffset + index, 140, 9)));
        letterOffset += Array.from(phrase).length;
        line.append(chunk);
      });
      return line;
    }));
  };

  const clearCharacterMotion = () => {
    window.clearTimeout(switchTimer);
    heroImage?.classList.remove("is-switching");
    layer.querySelectorAll(".character-book-hero-ghost").forEach((ghost) => ghost.remove());
  };

  const syncExpressionState = (expression) => {
    displayedExpressionId = expression.id;
    layer.dataset.expressionId = expression.id;
    if (expressionName) expressionName.textContent = expression.label;
    expressionList?.querySelectorAll("[data-character-expression]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.characterExpression === expression.id));
    });
  };

  const commitHeroImage = (expression, generation) => {
    if (generation !== switchGeneration || !(heroImage instanceof HTMLImageElement)) return;
    const targetSource = new URL(expression.src, document.baseURI).href;
    if (heroImage.currentSrc === targetSource || heroImage.src === targetSource) {
      heroImage.alt = expression.alt;
      syncExpressionState(expression);
      layer.dataset.imageState = "ready";
      return;
    }

    const shouldAnimate = !reducedMotion.matches && Boolean(heroImage.currentSrc);
    clearCharacterMotion();
    if (shouldAnimate) {
      const ghost = heroImage.cloneNode(false);
      ghost.removeAttribute("id");
      ghost.removeAttribute("aria-label");
      ghost.setAttribute("aria-hidden", "true");
      ghost.className = "character-book-hero-ghost";
      heroImage.before(ghost);
    }

    heroImage.src = expression.src;
    heroImage.alt = expression.alt;
    syncExpressionState(expression);
    layer.dataset.imageState = "ready";
    if (shouldAnimate) {
      void heroImage.offsetWidth;
      requestAnimationFrame(() => {
        if (generation === switchGeneration) heroImage.classList.add("is-switching");
      });
    }
    switchTimer = window.setTimeout(() => {
      if (generation !== switchGeneration) return;
      heroImage.classList.remove("is-switching");
      layer.querySelectorAll(".character-book-hero-ghost").forEach((oldImage) => oldImage.remove());
    }, 620);
  };

  const selectExpression = (id) => {
    const character = characters[currentIndex];
    if (!character || displayedCharacterId !== character.id) return;
    const nextExpression = character.expressions.find((item) => item.id === id);
    if (!nextExpression) return;
    if (displayedExpressionId === nextExpression.id) {
      syncExpressionState(nextExpression);
      return;
    }

    const generation = ++switchGeneration;
    syncExpressionState(nextExpression);
    const commit = () => commitHeroImage(nextExpression, generation);
    const preload = ensureImagePreload(nextExpression.src);
    if (preload instanceof HTMLImageElement && !preload.complete) {
      preload.addEventListener("load", commit, { once: true });
      preload.addEventListener("error", commit, { once: true });
    } else commit();
  };

  const renderExpressions = (character) => {
    if (!(expressionList instanceof HTMLElement)) return;
    expressionList.closest(".character-book-expressions").hidden = character.expressions.length < 2;
    const activeId = character.expressions[0].id;
    expressionHoverReady = false;
    const buttons = character.expressions.map((item) => {
      const button = document.createElement("button");
      const frame = document.createElement("span");
      const image = document.createElement("img");
      button.type = "button";
      button.dataset.characterId = character.id;
      button.dataset.characterExpression = item.id;
      button.setAttribute("aria-label", `${character.native}の表情：${item.label}`);
      button.setAttribute("aria-pressed", String(item.id === activeId));
      button.title = item.label;
      image.src = item.src;
      image.alt = "";
      image.width = 920;
      image.height = 1840;
      image.decoding = "async";
      image.setAttribute("aria-hidden", "true");
      frame.append(image);
      button.append(frame);
      button.addEventListener("pointerenter", () => {
        if (expressionHoverReady) selectExpression(item.id);
      });
      button.addEventListener("focus", () => selectExpression(item.id));
      button.addEventListener("click", () => selectExpression(item.id));
      return button;
    });
    expressionList.setAttribute("aria-label", `${character.native}の表情を選ぶ`);
    expressionList.replaceChildren(...buttons);
    if (expressionName) expressionName.textContent = character.expressions[0].label;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (displayedCharacterId === character.id) expressionHoverReady = true;
    }));
  };

  const selectCharacter = (id, { moveFocus = false } = {}) => {
    const nextIndex = characters.findIndex((character) => character.id === id);
    if (nextIndex < 0) return;
    if (displayedCharacterId === id) {
      selectExpression(characters[nextIndex].expressions[0].id);
      if (moveFocus) selectors[nextIndex]?.focus({ preventScroll: true });
      return;
    }
    const character = characters[nextIndex];
    const generation = ++switchGeneration;
    currentIndex = nextIndex;
    layer.dataset.characterId = character.id;
    layer.style.setProperty("--character-accent-rgb", character.tone);
    atmosphere.setAccent(character.tone);
    selectors.forEach((button) => button.setAttribute("aria-current", String(button.dataset.characterSelect === character.id)));

    const commit = () => {
      if (generation !== switchGeneration) return;
      setLetterText(native, character.native, 50);
      fullName.hidden = !character.fullName;
      reading.hidden = !character.reading;
      layer.querySelector("#character-book-page-title > i").hidden = !character.fullName;
      setLetterText(fullName, character.fullName || "", 90);
      setLetterText(reading, character.reading || "", 150);
      setLetterText(tagline, character.tagline, 0);
      setProfileText(character.profile);
      setLetterText(quote, character.quote, quoteRevealDelay);
      if (current) current.textContent = String(nextIndex + 1).padStart(2, "0");
      displayedCharacterId = character.id;
      renderExpressions(character);
      commitHeroImage(character.expressions[0], generation);
      window.setTimeout(() => preloadCharacterExpressions(character), 80);
    };
    const preload = ensureImagePreload(character.src);
    if (preload instanceof HTMLImageElement && !preload.complete) {
      preload.addEventListener("load", commit, { once: true });
      preload.addEventListener("error", commit, { once: true });
    } else commit();
    if (moveFocus) selectors[nextIndex]?.focus({ preventScroll: true });
  };

  window.addEventListener("gaia:language-change", () => {
    const character = characters[currentIndex];
    if (!character || !displayedCharacterId) return;
    setLetterText(native, character.native, 50);
    setLetterText(fullName, character.fullName || "", 90);
    setLetterText(reading, character.reading || "", 150);
    setLetterText(tagline, character.tagline, 0);
    setProfileText(character.profile);
    setLetterText(quote, character.quote, quoteRevealDelay);
  });

  const open = (trigger = null) => {
    if (openState) return;
    if (window.location.hash !== "#character") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search + "#character");
    }
    openState = true;
    lastFocused = trigger instanceof HTMLElement ? trigger : document.activeElement;
    suspendBackground();
    layer.hidden = false;
    layer.inert = false;
    layer.setAttribute("aria-hidden", "false");
    document.body.classList.add("character-mode-open");
    if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
    selectCharacter(characters[currentIndex].id);
    atmosphere.start();
    requestAnimationFrame(() => {
      layer.classList.add("is-open");
      closeButton?.focus({ preventScroll: true });
    });
  };
  const close = ({ updateHash = true, restoreFocus = true } = {}) => {
    if (!openState) return;
    closeCgViewer({ restoreFocus: false, immediate: true });
    openState = false;
    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("character-mode-open");
    atmosphere.stop();
    restoreBackground();
    clearCharacterMotion();
    window.setTimeout(() => {
      if (!openState) {
        layer.hidden = true;
        layer.inert = true;
      }
    }, 280);
    if (updateHash && window.location.hash === "#character") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search + "#top");
    }
    if (restoreFocus && lastFocused instanceof HTMLElement && lastFocused.isConnected) lastFocused.focus({ preventScroll: true });
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest("[data-character-gallery-open]") : null;
    if (trigger) open(trigger);
  });
  closeButton?.addEventListener("click", close);
  closeButtons.forEach((button) => button.addEventListener("click", close));
  cgViewerCloseButtons.forEach((button) => button.addEventListener("click", () => closeCgViewer()));
  cgViewerPrevious?.addEventListener("click", () => turnCgViewer(-1));
  cgViewerNext?.addEventListener("click", () => turnCgViewer(1));
  compactCg.addEventListener("change", () => {
    if (cgViewerOpen) renderCgViewer(currentCgIndex);
  });
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#character") open(null);
    else if (openState) close({ updateHash: false, restoreFocus: false });
  });
  selectors.forEach((button) => {
    button.addEventListener("click", () => selectCharacter(button.dataset.characterSelect));
  });
  layer.addEventListener("pointermove", (event) => atmosphere.setPointer(event), { passive: true });
  scroller?.addEventListener("scroll", () => {
    if (!(scroller instanceof HTMLElement)) return;
    const heroHeight = Math.max(1, layer.querySelector("#character-book-hero")?.clientHeight || window.innerHeight);
    atmosphere.setDepth(scroller.scrollTop / heroHeight);
    layer.classList.toggle("has-scrolled", scroller.scrollTop > 30);
  }, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (!openState) return;
    if (cgViewerOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCgViewer();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        turnCgViewer(event.key === "ArrowRight" ? 1 : -1);
        return;
      }
      if (event.key !== "Tab" || !(cgViewer instanceof HTMLElement)) return;
      const viewerFocusable = Array.from(cgViewer.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
      if (!viewerFocusable.length) return;
      const viewerFirst = viewerFocusable[0];
      const viewerLast = viewerFocusable[viewerFocusable.length - 1];
      if (event.shiftKey && document.activeElement === viewerFirst) {
        event.preventDefault();
        viewerLast.focus();
      } else if (!event.shiftKey && document.activeElement === viewerLast) {
        event.preventDefault();
        viewerFirst.focus();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + delta + characters.length) % characters.length;
      selectCharacter(characters[nextIndex].id, { moveFocus: true });
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(layer.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (heroImage instanceof HTMLImageElement) {
    const markReady = () => { layer.dataset.imageState = "ready"; };
    heroImage.addEventListener("load", markReady);
    heroImage.addEventListener("error", () => { layer.dataset.imageState = "error"; });
    if (heroImage.complete && heroImage.naturalWidth > 0) markReady();
  }
  if (window.location.hash === "#character") window.setTimeout(() => open(null), 0);
})();
