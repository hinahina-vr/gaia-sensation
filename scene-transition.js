/**
 * 概要: Canvasによる共通の画面遷移演出。個々の画面から描画処理を分離し、Canvasが使えない環境では開始しない。
 */
(() => {
  "use strict";

  const canvas = document.querySelector("#scene-transition");
  if (!canvas) return;

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const tones = {
    abstract: [104, 235, 211],
    map: [103, 187, 241],
    novel: [188, 174, 232],
    space: [151, 190, 255],
    default: [125, 221, 216],
  };
  let running = false;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const easeInOut = (value) =>
    value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
  const smoothstep = (minimum, maximum, value) => {
    const normalized = clamp((value - minimum) / Math.max(0.0001, maximum - minimum), 0, 1);
    return normalized * normalized * (3 - 2 * normalized);
  };
  const mixColor = (from, to, amount) =>
    from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
  const colorString = (color) => `rgb(${color[0]} ${color[1]} ${color[2]})`;

  const configureCanvas = () => {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = false;
    return { width, height };
  };

  const hash = (column, row) => {
    const value = Math.sin(column * 127.1 + row * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };

  const createGrid = ({ width, height }) => {
    const size = coarsePointer ? 34 : 30;
    const columns = Math.ceil(width / size);
    const rows = Math.ceil(height / size);
    const diagonalMaximum = Math.max(1, columns + rows - 2);
    const cells = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const diagonal = (column + row) / diagonalMaximum;
        const jitter = (hash(column, row) - 0.5) * 0.055;
        cells.push({
          x: column * size,
          y: row * size,
          size,
          order: clamp(diagonal + jitter, 0, 1),
        });
      }
    }

    return cells;
  };

  const drawGrid = (dimensions, cells, accent, elapsed, duration, phase) => {
    const { width, height } = dimensions;
    context.clearRect(0, 0, width, height);

    const progress = easeInOut(clamp(elapsed / duration, 0, 1));
    const deep = mixColor([3, 9, 15], accent, 0.055);
    const low = mixColor([5, 13, 21], accent, 0.16);
    const mid = mixColor([8, 18, 28], accent, 0.34);
    const light = mixColor([16, 29, 41], accent, 0.58);
    const surface = context.createLinearGradient(0, 0, width, height);
    surface.addColorStop(0, colorString(deep));
    surface.addColorStop(0.24, colorString(low));
    surface.addColorStop(0.5, colorString(light));
    surface.addColorStop(0.72, colorString(mid));
    surface.addColorStop(1, colorString(deep));
    context.fillStyle = surface;

    cells.forEach((cell) => {
      const start = cell.order * 0.72;
      const end = Math.min(1, start + 0.28);
      const amount = smoothstep(start, end, progress);
      const visible = phase === "cover" ? amount : 1 - amount;
      if (visible <= 0.001) return;

      const scale = 0.18 + visible * 0.82;
      const tileSize = Math.ceil(cell.size * scale + 0.5);
      const offset = (cell.size - tileSize) * 0.5;

      context.globalAlpha = visible;
      context.fillRect(
        Math.floor(cell.x + offset),
        Math.floor(cell.y + offset),
        tileSize,
        tileSize,
      );
    });
    context.globalAlpha = 1;
  };

  const animateGrid = (dimensions, cells, accent, phase, duration) =>
    new Promise((resolve) => {
      const startedAt = performance.now();
      const frame = (now) => {
        const elapsed = Math.min(duration, now - startedAt);
        drawGrid(dimensions, cells, accent, elapsed, duration, phase);
        if (elapsed < duration) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });

  const run = async (swapScene, options = {}) => {
    if (typeof swapScene !== "function" || running) return false;
    if (reducedMotion) {
      await swapScene();
      return true;
    }

    running = true;
    document.body.classList.add("scene-transitioning");
    const buttonGlint = document.querySelector(".gaia-global-button-glint");
    buttonGlint?.classList.remove("is-active");
    canvas.hidden = false;
    const dimensions = configureCanvas();
    const cells = createGrid(dimensions);
    const accent = tones[options.tone] || tones.default;

    try {
      await animateGrid(dimensions, cells, accent, "cover", 760);
      await swapScene();
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      await animateGrid(dimensions, cells, accent, "reveal", 820);
      return true;
    } catch (error) {
      console.error("Scene transition failed", error);
      return false;
    } finally {
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.hidden = true;
      buttonGlint?.classList.remove("is-active");
      document.body.classList.remove("scene-transitioning");
      running = false;
    }
  };

  window.GaiaSceneTransition = {
    run,
    get running() {
      return running;
    },
  };
})();
