(() => {
  "use strict";

  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const create = (canvas, options = {}) => {
    if (!(canvas instanceof HTMLCanvasElement)) return { start() {}, stop() {} };
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return { start() {}, stop() {} };

    const variant = options.variant === "story" ? "story" : "opening";
    const palette = variant === "story"
      ? [188, 205, 224, 264, 286, 320]
      : [186, 202, 222, 270, 296, 332];
    const intensity = Math.max(0.2, Math.min(1.4, Number(options.intensity) || 1));

    let width = 1;
    let height = 1;
    let ratio = 1;
    let frame = 0;
    let running = false;
    let lastTime = 0;
    let motes = [];
    let shootingStars = [];
    let nextShootingStarAt = 0;
    let pointerX = 0.5;
    let pointerY = 0.5;
    const spriteSize = 448;
    const spriteRadius = 100;
    const SHOOTING_STAR_INTERVAL_MS = 10000;

    const random = (min, max) => min + Math.random() * (max - min);
    const pickHue = () => palette[Math.floor(Math.random() * palette.length)];
    const smoothstep = (edge0, edge1, value) => {
      const normalized = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)));
      return normalized * normalized * (3 - 2 * normalized);
    };
    const riseZones = variant === "story"
      ? [
          { x: 0.08, spread: 0.07, hue: 188 },
          { x: 0.26, spread: 0.1, hue: 218 },
          { x: 0.76, spread: 0.11, hue: 286 },
          { x: 0.94, spread: 0.05, hue: 202 },
        ]
      : [
          { x: 0.07, spread: 0.07, hue: 188 },
          { x: 0.24, spread: 0.1, hue: 218 },
          { x: 0.58, spread: 0.12, hue: 286 },
          { x: 0.88, spread: 0.07, hue: 202 },
        ];

    const createMoteSprite = (mote) => {
      const sprite = typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(spriteSize, spriteSize)
        : document.createElement("canvas");
      sprite.width = spriteSize;
      sprite.height = spriteSize;
      const spriteContext = sprite.getContext("2d", { alpha: true });
      if (!spriteContext) return null;
      const center = spriteSize / 2;
      spriteContext.translate(center, center);
      spriteContext.shadowColor = `hsla(${mote.hue}, 98%, 86%, 0.68)`;
      spriteContext.shadowBlur = spriteRadius * 0.58;
      mote.lobes.forEach((lobe, index) => {
        const lobeRadius = spriteRadius * lobe.scale;
        const lobeX = lobe.x * spriteRadius;
        const lobeY = lobe.y * spriteRadius;
        const glow = spriteContext.createRadialGradient(
          lobeX - lobeRadius * 0.14,
          lobeY - lobeRadius * 0.18,
          0,
          lobeX,
          lobeY,
          lobeRadius,
        );
        const lobeAlpha = index === 0 ? 1 : 0.64;
        glow.addColorStop(0, `hsla(${mote.hue}, 100%, 96%, ${lobeAlpha})`);
        glow.addColorStop(0.28, `hsla(${mote.hue}, 98%, 86%, ${lobeAlpha * 0.72})`);
        glow.addColorStop(0.68, `hsla(${mote.hue}, 92%, 72%, ${lobeAlpha * 0.24})`);
        glow.addColorStop(1, `hsla(${mote.hue}, 86%, 62%, 0)`);
        spriteContext.fillStyle = glow;
        spriteContext.beginPath();
        spriteContext.arc(lobeX, lobeY, lobeRadius, 0, Math.PI * 2);
        spriteContext.fill();
      });
      return sprite;
    };

    const makeMote = (entering = false) => {
      const zone = riseZones[Math.floor(Math.random() * riseZones.length)];
      const depth = random(0.18, 1);
      const radius = random(34, variant === "story" ? 108 : 96) * (0.68 + depth * 0.5);
      const mote = {
        baseX: (zone.x + random(-zone.spread, zone.spread)) * width,
        y: entering ? height + random(radius * 0.6, height * 0.18 + radius) : random(height * 0.06, height * 1.12),
        vy: -random(16, variant === "story" ? 38 : 34) * (0.7 + depth * 0.42),
        radius,
        aspect: random(0.78, 1.08),
        sway: random(10, 38) * (0.72 + depth * 0.42),
        curl: random(0.64, 1.28),
        drift: random(0.1, 0.24),
        depth,
        hue: Math.random() < 0.76 ? zone.hue + random(-8, 8) : pickHue(),
        alpha: random(0.15, variant === "story" ? 0.31 : 0.28) * intensity,
        phase: random(0, Math.PI * 2),
        lobes: Array.from({ length: Math.random() < 0.6 ? 4 : 3 }, (_, index) => ({
          x: index === 0 ? 0 : random(-0.48, 0.48),
          y: index === 0 ? 0 : random(-0.34, 0.34),
          scale: index === 0 ? random(0.78, 1) : random(0.42, 0.72),
        })),
      };
      mote.sprite = createMoteSprite(mote);
      return mote;
    };

    const rebuild = () => {
      const compact = width < 720;
      const motionFactor = REDUCED_MOTION ? 0.45 : 1;
      const moteCount = Math.round((compact ? 6 : variant === "story" ? 10 : 8) * intensity * motionFactor);
      motes = Array.from({ length: Math.max(5, moteCount) }, () => makeMote());
    };

    const launchShootingStar = (time) => {
      const angle = random(0.42, 0.56);
      // A small sky detail, not a viewport-wide sweep. Avoid a mobile minimum
      // and cap the travel/trail so large displays cannot magnify the effect.
      const travel = Math.min(320, width * 0.22, height * 0.3);
      const directionX = -Math.cos(angle);
      const directionY = Math.sin(angle);
      const shootingStar = {
        startedAt: time,
        duration: random(1200, 1500),
        startX: random(width * 0.24, width * 0.48),
        startY: random(height * 0.035, height * 0.17),
        dx: directionX * travel,
        dy: directionY * travel,
        directionX,
        directionY,
        travel,
        perspective: random(0.035, 0.065),
        gravity: travel * random(0.022, 0.035),
        crosswind: travel * random(-0.005, 0.007),
        trailFraction: Math.min(random(0.12, 0.16), 42 / travel),
        coreWidth: random(0.38, 0.58),
        peakAlpha: random(0.42, 0.54),
        phase: random(0, Math.PI * 2),
        hue: random(194, 210),
      };
      shootingStars.push(shootingStar);
      canvas.dispatchEvent(new CustomEvent("gaia:shooting-star", {
        detail: {
          startX: shootingStar.startX,
          startY: shootingStar.startY,
          dx: shootingStar.dx,
          dy: shootingStar.dy,
          duration: shootingStar.duration,
          travel: shootingStar.travel,
          perspective: shootingStar.perspective,
          gravity: shootingStar.gravity,
          trailFraction: shootingStar.trailFraction,
          coreWidth: shootingStar.coreWidth,
          peakAlpha: shootingStar.peakAlpha,
        },
      }));
      nextShootingStarAt = time + random(
        SHOOTING_STAR_INTERVAL_MS * 0.9,
        SHOOTING_STAR_INTERVAL_MS * 1.1,
      );
    };

    const positionOnShootingStarTrajectory = (star, rawProgress) => {
      const progress = Math.max(0, Math.min(1, rawProgress));
      const projected = (progress + star.perspective * progress * progress) / (1 + star.perspective);
      const atmosphericBend = progress * progress;
      const crosswind = star.crosswind * Math.sin(Math.PI * progress);
      return {
        x: star.startX
          + star.dx * projected
          + star.directionY * crosswind,
        y: star.startY
          + star.dy * projected
          - star.directionX * crosswind
          + star.gravity * atmosphericBend,
      };
    };

    const drawShootingStars = (time) => {
      if (variant !== "opening" || REDUCED_MOTION) return;
      if (time >= nextShootingStarAt) launchShootingStar(time);

      shootingStars = shootingStars.filter((star) => {
        const progress = (time - star.startedAt) / star.duration;
        if (progress < 0 || progress >= 1) return false;

        const head = positionOnShootingStarTrajectory(star, progress);
        const trailFraction = star.trailFraction * (0.82 + 0.18 * Math.sin(Math.PI * progress));
        const tailProgress = Math.max(0, progress - trailFraction);
        const fadeIn = smoothstep(0, 0.1, progress);
        const fadeOut = 1 - smoothstep(0.6, 1, progress);
        const atmosphericDensity = 0.82 + progress * 0.18;
        const microVariation = 0.95 + Math.sin(progress * 31 + star.phase) * 0.035
          + Math.sin(progress * 73 + star.phase * 0.7) * 0.015;
        const alpha = star.peakAlpha * fadeIn * fadeOut * atmosphericDensity * microVariation;
        const samples = 18;
        const trajectory = Array.from({ length: samples + 1 }, (_, index) => {
          const sampleProgress = tailProgress + (progress - tailProgress) * (index / samples);
          return positionOnShootingStarTrajectory(star, sampleProgress);
        });

        const drawTaperedTrail = ({ widthScale, alphaScale, saturation, lightness }) => {
          for (let index = 1; index < trajectory.length; index += 1) {
            const segmentProgress = index / samples;
            const taper = smoothstep(0, 1, segmentProgress);
            const from = trajectory[index - 1];
            const to = trajectory[index];
            context.beginPath();
            context.moveTo(from.x, from.y);
            context.lineTo(to.x, to.y);
            context.lineWidth = Math.max(0.12, star.coreWidth * widthScale * (0.12 + taper * 0.88));
            context.strokeStyle = `hsla(${star.hue}, ${saturation}%, ${lightness}%, ${alpha * alphaScale * taper * taper})`;
            context.stroke();
          }
        };

        context.save();
        context.lineCap = "round";
        drawTaperedTrail({ widthScale: 2.2, alphaScale: 0.24, saturation: 86, lightness: 87 });
        drawTaperedTrail({ widthScale: 1, alphaScale: 0.88, saturation: 74, lightness: 98 });

        const previous = positionOnShootingStarTrajectory(star, Math.max(0, progress - 0.004));
        const heading = Math.atan2(head.y - previous.y, head.x - previous.x);
        const headRadius = star.coreWidth * 2;
        context.translate(head.x, head.y);
        context.rotate(heading);
        const headGlow = context.createRadialGradient(0, 0, 0, 0, 0, headRadius);
        headGlow.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.82})`);
        headGlow.addColorStop(0.34, `hsla(${star.hue}, 86%, 94%, ${alpha * 0.46})`);
        headGlow.addColorStop(1, `hsla(${star.hue}, 80%, 76%, 0)`);
        context.fillStyle = headGlow;
        context.beginPath();
        context.ellipse(0, 0, headRadius * 1.7, headRadius, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
        return true;
      });
    };

    const onPointerMove = (event) => {
      pointerX = Math.max(0, Math.min(1, event.clientX / Math.max(1, width)));
      pointerY = Math.max(0, Math.min(1, event.clientY / Math.max(1, height)));
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width || window.innerWidth));
      height = Math.max(1, Math.round(bounds.height || window.innerHeight));
      ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      rebuild();
    };

    const draw = (time) => {
      if (!running) return;
      const deltaSeconds = Math.min(0.034, Math.max(0, (time - (lastTime || time)) / 1000));
      lastTime = time;
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "lighter";

      motes.forEach((mote) => {
        mote.y += mote.vy * deltaSeconds;
        mote.phase += mote.drift * deltaSeconds;
        if (mote.y < -mote.radius * 2.4) {
          Object.assign(mote, makeMote(true));
          return;
        }
        const wave = time * 0.00022 * mote.curl + mote.phase;
        const x = mote.baseX
          + Math.sin(wave) * mote.sway
          + Math.sin(wave * 1.73 + mote.depth * 5.3) * mote.sway * 0.22;
        const lowerFade = Math.min(1, Math.max(0, (height + mote.radius - mote.y) / (height * 0.14)));
        const upperFade = Math.min(1, Math.max(0, (mote.y + mote.radius * 1.6) / (height * 0.2)));
        const travel = Math.min(1, Math.max(0, 1 - mote.y / Math.max(1, height)));
        const pulse = 0.8 + Math.sin(time * 0.00058 + mote.phase) * 0.2;
        const alpha = mote.alpha * lowerFade * upperFade * pulse;
        const parallaxX = variant === "story" ? (pointerX - 0.5) * 22 * mote.depth : 0;
        const parallaxY = variant === "story" ? (pointerY - 0.5) * 14 * mote.depth : 0;
        const puffRadius = mote.radius * (0.72 + travel * 0.48) * pulse;

        context.save();
        context.translate(x + parallaxX, mote.y + parallaxY);
        context.rotate(Math.sin(wave * 0.61) * 0.045);
        context.scale(1, mote.aspect);
        if (mote.sprite && alpha > 0.0001) {
          const drawSize = spriteSize * (puffRadius / spriteRadius);
          context.globalAlpha = alpha;
          context.drawImage(mote.sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
          context.globalAlpha = 1;
        }
        context.restore();
      });

      drawShootingStars(time);

      context.restore();
      frame = requestAnimationFrame(draw);
    };

    return {
      start() {
        if (running) return;
        running = true;
        lastTime = 0;
        shootingStars = [];
        nextShootingStarAt = performance.now() + random(2200, 3600);
        resize();
        window.addEventListener("resize", resize, { passive: true });
        if (variant === "story") window.addEventListener("pointermove", onPointerMove, { passive: true });
        frame = requestAnimationFrame(draw);
      },
      stop() {
        running = false;
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointerMove);
        shootingStars = [];
        nextShootingStarAt = 0;
        context.clearRect(0, 0, width, height);
      },
    };
  };

  window.GaiaParticles = Object.freeze({ create });
})();
