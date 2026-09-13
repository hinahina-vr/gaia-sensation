// Persistent three-layer ambience: stars / light motes / flowing traces.
(() => {
  const CANVAS_ID = "gs-particle-canvas-v8";
  const OLD_CANVAS_ID = "gs-particle-canvas-v7";
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  let canvas;
  let context;
  let cssWidth = 1;
  let cssHeight = 1;
  let pixelRatio = 1;
  let observer;

  const fract = (value) => value - Math.floor(value);
  const noise = (index, salt = 0) => fract(Math.sin(index * 91.713 + salt * 47.137) * 43758.5453);

  const stars = Array.from({ length: 132 }, (_, index) => ({
    x: noise(index, 1),
    y: noise(index, 2),
    radius: 0.8 + noise(index, 3) * 2.15,
    phase: noise(index, 4) * Math.PI * 2,
    speed: 0.35 + noise(index, 5) * 0.8,
    tone: index % 3,
  }));

  const motes = Array.from({ length: 20 }, (_, index) => ({
    x: noise(index, 11),
    y: noise(index, 12),
    radius: 22 + noise(index, 13) * 54,
    phase: noise(index, 14) * Math.PI * 2,
    driftX: 7 + noise(index, 15) * 18,
    driftY: 6 + noise(index, 16) * 14,
    speed: 0.12 + noise(index, 17) * 0.22,
    tone: index % 2,
  }));

  const flows = [
    { y: 0.24, bend: -0.18, color: "116, 238, 224", phase: 0.08 },
    { y: 0.51, bend: 0.16, color: "126, 196, 255", phase: 0.42 },
    { y: 0.78, bend: -0.12, color: "190, 158, 255", phase: 0.76 },
  ];

  const enforceCanvas = () => {
    document.getElementById(OLD_CANVAS_ID)?.remove();

    canvas = document.getElementById(CANVAS_ID) || document.createElement("canvas");
    canvas.id = CANVAS_ID;
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.layer = "light-stars-flow";

    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100vw",
      height: "100vh",
      display: "block",
      visibility: "visible",
      opacity: "0.92",
      pointerEvents: "none",
      zIndex: "2147482000",
      mixBlendMode: "screen",
      transform: "translateZ(0)",
    });

    if (document.body && canvas.parentElement !== document.body) {
      document.body.appendChild(canvas);
    }

    context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    resize();
  };

  const resize = () => {
    if (!canvas || !context) return;
    cssWidth = Math.max(1, window.innerWidth);
    cssHeight = Math.max(1, window.innerHeight);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const nextWidth = Math.round(cssWidth * pixelRatio);
    const nextHeight = Math.round(cssHeight * pixelRatio);

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
  };

  const cubicPoint = (a, b, c, d, progress) => {
    const remaining = 1 - progress;
    return remaining ** 3 * a
      + 3 * remaining ** 2 * progress * b
      + 3 * remaining * progress ** 2 * c
      + progress ** 3 * d;
  };

  const drawStars = (time) => {
    context.save();
    context.globalCompositeOperation = "screen";

    for (const star of stars) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.001 * star.speed + star.phase);
      const x = star.x * cssWidth;
      const y = star.y * cssHeight;
      const radius = star.radius * (0.8 + pulse * 0.42);
      const colors = ["126, 244, 226", "165, 213, 255", "210, 187, 255"];

      context.beginPath();
      context.fillStyle = `rgba(${colors[star.tone]}, ${0.32 + pulse * 0.5})`;
      context.shadowColor = `rgba(${colors[star.tone]}, 0.9)`;
      context.shadowBlur = 7 + radius * 3;
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  };

  const drawMotes = (time) => {
    context.save();
    context.globalCompositeOperation = "screen";

    for (const mote of motes) {
      const movement = reducedMotion ? 0 : time * 0.00015 * mote.speed;
      const x = mote.x * cssWidth + Math.sin(movement + mote.phase) * mote.driftX;
      const y = mote.y * cssHeight + Math.cos(movement * 0.8 + mote.phase) * mote.driftY;
      const glow = context.createRadialGradient(x, y, 0, x, y, mote.radius);
      const core = mote.tone === 0 ? "137, 247, 225" : "152, 203, 255";

      glow.addColorStop(0, `rgba(${core}, 0.35)`);
      glow.addColorStop(0.18, `rgba(${core}, 0.15)`);
      glow.addColorStop(1, `rgba(${core}, 0)`);
      context.fillStyle = glow;
      context.fillRect(x - mote.radius, y - mote.radius, mote.radius * 2, mote.radius * 2);
    }

    context.restore();
  };

  const drawFlows = (time) => {
    context.save();
    context.globalCompositeOperation = "screen";

    flows.forEach((flow, index) => {
      const y = cssHeight * flow.y;
      const bend = cssHeight * flow.bend;
      const p0x = -cssWidth * 0.08;
      const p0y = y;
      const p1x = cssWidth * 0.28;
      const p1y = y + bend;
      const p2x = cssWidth * 0.7;
      const p2y = y - bend;
      const p3x = cssWidth * 1.08;
      const p3y = y;

      context.beginPath();
      context.moveTo(p0x, p0y);
      context.bezierCurveTo(p1x, p1y, p2x, p2y, p3x, p3y);
      context.strokeStyle = `rgba(${flow.color}, 0.28)`;
      context.lineWidth = 1.15;
      context.setLineDash([2, 12]);
      context.lineDashOffset = reducedMotion ? 0 : -time * (0.009 + index * 0.002);
      context.shadowColor = `rgba(${flow.color}, 0.6)`;
      context.shadowBlur = 6;
      context.stroke();

      const progress = reducedMotion
        ? flow.phase
        : fract(time * (0.000045 + index * 0.000008) + flow.phase);
      const headX = cubicPoint(p0x, p1x, p2x, p3x, progress);
      const headY = cubicPoint(p0y, p1y, p2y, p3y, progress);
      const headGlow = context.createRadialGradient(headX, headY, 0, headX, headY, 24);
      headGlow.addColorStop(0, `rgba(${flow.color}, 0.95)`);
      headGlow.addColorStop(0.18, `rgba(${flow.color}, 0.55)`);
      headGlow.addColorStop(1, `rgba(${flow.color}, 0)`);
      context.fillStyle = headGlow;
      context.fillRect(headX - 24, headY - 24, 48, 48);
    });

    context.restore();
  };

  const draw = (time) => {
    if (!canvas?.isConnected || !context) enforceCanvas();
    if (!context) return requestAnimationFrame(draw);

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    drawMotes(time);
    drawFlows(time);
    drawStars(time);
    requestAnimationFrame(draw);
  };

  const start = () => {
    enforceCanvas();
    window.addEventListener("resize", resize, { passive: true });

    observer = new MutationObserver(() => {
      if (!document.getElementById(CANVAS_ID)?.isConnected) enforceCanvas();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    requestAnimationFrame(draw);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
