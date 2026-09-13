(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
  const lerp = (start, end, amount) => start + (end - start) * amount;
  const smooth = (value) => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };
  const rgba = (color, alpha) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  const mix = (first, second, amount) => first.map((value, index) => Math.round(lerp(value, second[index], amount)));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const format = (value, digits = 1) => value != null && value !== "" && Number.isFinite(Number(value))
    ? new Intl.NumberFormat("ja-JP", { maximumFractionDigits: digits }).format(Number(value))
    : "—";
  const hash = (text) => {
    let value = 2166136261;
    String(text).split("").forEach((character) => {
      value ^= character.charCodeAt(0);
      value = Math.imul(value, 16777619);
    });
    return (value >>> 0) / 4294967295;
  };
  const currentRecord = (state, mode) => {
    const records = mode?.records || [];
    return records.length ? records[state.recordIndex % records.length] : null;
  };
  const pulseAge = (pulse, now) => clamp((now - pulse.born) / Math.max(1, pulse.duration));

  const INTERACTIONS = {
    "coronal-mass-ejection": {
      button: "CMEを放つ",
      prompt: "ドラッグで観測方向を変える。速度が波面の移動、半角幅が扇の広がりになります。",
    },
    "geomagnetic-storm": {
      button: "磁気嵐を再生",
      prompt: "地球の周囲を押して磁力線をたわませる。Kpが高いほどオーロラ帯が太く揺れます。",
    },
    "energetic-particles": {
      button: "粒子雨を再生",
      prompt: "画面へ線を引くと仮想シールドになります。観測機器ごとの粒子列がその線を避けます。",
    },
    "close-approach": {
      button: "最接近を再生",
      prompt: "左右へなぞって時間を動かす。月軌道と比較しながら最接近距離を読みます。",
    },
    fireball: {
      button: "火球を降らせる",
      prompt: "ドラッグ方向が仮想の進入角になります。実測エネルギーと発光高度は変えません。",
    },
    "nearby-worlds": {
      button: "惑星系を選ぶ",
      prompt: "星図を動かして近傍惑星を選ぶ。中心からの距離はパーセクの対数です。",
    },
    "earth-scale-worlds": {
      button: "惑星を比べる",
      prompt: "惑星へ触れて、地球半径と平衡温度を見比べる。生命の有無は判定しません。",
    },
    "ryugu-lidar": {
      button: "LIDARを照射",
      prompt: "リュウグウへ触れて測距点を選ぶ。距離と三次元座標から輪郭が立ち上がります。",
    },
    "cosmic-senseware": {
      button: "信号網を点灯",
      prompt: "データ源の節点を順に触れて結ぶ。線は観客が作るSCENARIOです。",
    },
  };

  const ensureScene = (state) => {
    if (!state.scene) {
      state.scene = {
        enteredAt: performance.now(),
        scrub: 0.5,
        entryAngle: -0.7,
        selectedNode: 0,
        pendingNode: null,
        cosmosLinks: [],
      };
    }
    return state.scene;
  };

  const resetMode = (state) => {
    const previousLinks = state.scene?.cosmosLinks || [];
    state.scene = {
      enteredAt: performance.now(),
      scrub: 0.5,
      entryAngle: -0.7,
      selectedNode: 0,
      pendingNode: null,
      cosmosLinks: previousLinks,
    };
  };

  const drawBackdrop = (ctx, state, accent, warmth = 0) => {
    const warm = mix([6, 12, 23], [28, 13, 6], warmth);
    const gradient = ctx.createRadialGradient(
      state.width * (0.5 + state.pointer.x * 0.08),
      state.height * (0.45 + state.pointer.y * 0.05),
      0,
      state.width * 0.5,
      state.height * 0.5,
      Math.max(state.width, state.height) * 0.78,
    );
    gradient.addColorStop(0, rgba(mix(warm, accent, 0.16), 1));
    gradient.addColorStop(0.52, rgba(mix(warm, accent, 0.035), 1));
    gradient.addColorStop(1, "#02050c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.width, state.height);

    state.dust.forEach((star, index) => {
      const parallax = (star.size - 0.5) * 8;
      const x = (star.x * state.width + (state.pointer.x - 0.5) * parallax + state.width) % state.width;
      const y = (star.y * state.height + (state.pointer.y - 0.5) * parallax + state.height) % state.height;
      ctx.fillStyle = rgba(index % 9 ? [218, 235, 250] : accent, star.alpha * (0.68 + Math.sin(star.phase + performance.now() * 0.0004) * 0.2));
      ctx.fillRect(x, y, Math.max(0.5, star.size), Math.max(0.5, star.size));
    });
  };

  const drawLabel = (ctx, text, x, y, color, align = "left") => {
    ctx.save();
    ctx.textAlign = align;
    ctx.fillStyle = rgba(color, 0.78);
    ctx.font = '600 13px "Yu Mincho", "Hiragino Mincho ProN", "HGS明朝E", serif';
    ctx.fillText(String(text), x, y);
    ctx.restore();
  };

  const drawEarth = (ctx, x, y, radius, accent, phase = 0) => {
    ctx.save();
    const aura = ctx.createRadialGradient(x, y, radius * 0.7, x, y, radius * 1.8);
    aura.addColorStop(0, rgba(accent, 0.22));
    aura.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.8, 0, TAU);
    ctx.fill();

    const body = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.3, radius * 0.08, x, y, radius);
    body.addColorStop(0, "#d7fbff");
    body.addColorStop(0.18, rgba(mix(accent, [180, 235, 255], 0.5), 1));
    body.addColorStop(0.62, rgba(mix(accent, [12, 55, 91], 0.62), 1));
    body.addColorStop(1, "#020711");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = "rgba(219,250,255,0.13)";
    ctx.lineWidth = Math.max(0.6, radius * 0.01);
    for (let band = -2; band <= 2; band += 1) {
      ctx.beginPath();
      ctx.ellipse(x, y + band * radius * 0.23, radius, radius * (0.18 + Math.abs(band) * 0.035), phase, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawSunLimb = (ctx, state, activity = 0.7) => {
    const radius = Math.max(state.height * 0.8, state.width * 0.42);
    const x = -radius * 0.7;
    const y = state.height * 0.5;
    const corona = ctx.createRadialGradient(x, y, radius * 0.78, x, y, radius * 1.35);
    corona.addColorStop(0, `rgba(255,183,56,${0.22 + activity * 0.13})`);
    corona.addColorStop(0.34, `rgba(255,102,30,${0.08 + activity * 0.06})`);
    corona.addColorStop(1, "rgba(255,72,18,0)");
    ctx.fillStyle = corona;
    ctx.fillRect(0, 0, state.width * 0.34, state.height);
    const sun = ctx.createRadialGradient(x - radius * 0.15, y - radius * 0.2, radius * 0.05, x, y, radius);
    sun.addColorStop(0, "#fff8b0");
    sun.addColorStop(0.58, "#ffc13d");
    sun.addColorStop(0.86, "#f16b24");
    sun.addColorStop(1, "#7c1f18");
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,245,201,0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, -1.05, 1.05);
    ctx.stroke();
    return { x, y, radius, limbX: x + radius };
  };

  const drawCme = ({ ctx, state, now, time, accent, mode, record }) => {
    drawBackdrop(ctx, state, accent, 0.18);
    const speed = number(record?.speedKmS, 600);
    const spread = clamp(number(record?.halfAngleDeg, 30) / 90, 0.16, 1);
    const sun = drawSunLimb(ctx, state, clamp(speed / 1400, 0.25, 1));
    const earthX = state.width * 0.8;
    const earthY = state.height * 0.52;
    const earthR = Math.max(25, Math.min(state.width, state.height) * 0.043);
    drawEarth(ctx, earthX, earthY, earthR, accent, time * 0.04);

    const baseProgress = (time * lerp(0.035, 0.09, clamp((speed - 250) / 1250))) % 1;
    const fronts = [{ progress: baseProgress, strength: 0.55, kind: "SOURCE" }];
    state.pulses.forEach((pulse) => fronts.push({
      progress: pulseAge(pulse, now),
      strength: pulse.strength,
      kind: pulse.kind,
    }));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    fronts.forEach((front, index) => {
      const progress = smooth(front.progress);
      const x = lerp(Math.max(0, sun.limbX), earthX - earthR * 1.2, progress);
      const height = lerp(state.height * 0.08, state.height * (0.22 + spread * 0.42), progress);
      const dragY = (state.pointer.y - 0.5) * state.height * 0.2 * (state.pointer.down ? 1 : 0.25);
      for (let echo = 0; echo < 7; echo += 1) {
        const echoX = x - echo * (7 + speed / 180);
        ctx.strokeStyle = rgba(front.kind === "SCENARIO" ? [245, 252, 255] : accent, (0.36 - echo * 0.043) * front.strength);
        ctx.lineWidth = echo === 0 ? 2 : 0.75;
        ctx.beginPath();
        ctx.ellipse(echoX, earthY + dragY, 10 + echo * 2.5, height * (1 - echo * 0.045), 0, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }
      const glow = ctx.createRadialGradient(x, earthY + dragY, 0, x, earthY + dragY, height);
      glow.addColorStop(0, rgba(accent, 0.2 * front.strength));
      glow.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, earthY + dragY, height, 0, TAU);
      ctx.fill();
      if (!index) drawLabel(ctx, `${format(speed, 0)} KM/S · ±${format(record?.halfAngleDeg, 0)}°`, x + 18, earthY - height - 18, accent);
    });
    ctx.restore();

    ctx.strokeStyle = rgba(accent, 0.1);
    ctx.setLineDash([3, 12]);
    ctx.beginPath();
    ctx.moveTo(Math.max(0, sun.limbX), earthY);
    ctx.lineTo(earthX, earthY);
    ctx.stroke();
    ctx.setLineDash([]);
    drawLabel(ctx, "CME CONE / NOT TO SCALE", state.width * 0.48, state.height * 0.16, accent, "center");
  };

  const drawGeomagneticStorm = ({ ctx, state, time, accent, record, parameters }) => {
    drawBackdrop(ctx, state, accent);
    const kp = clamp(number(record?.kp, 5) / 9, 0.15, 1);
    const x = state.width * 0.54;
    const y = state.height * 0.5;
    const r = Math.max(60, Math.min(state.width, state.height) * 0.105);
    const pressure = (0.25 + kp * 0.72) * (1 + state.response * 0.25);
    const pointerDent = state.pointer.visible ? (0.5 - state.pointer.x) * r * 0.8 : 0;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let line = -12; line <= 12; line += 1) {
      const lane = line / 12;
      const side = Math.sign(lane || 1);
      const shell = 1 - Math.abs(lane) * 0.35;
      const startX = x - r * (2.6 - pressure * 0.8) + pointerDent;
      const tailX = x + r * (4.2 + pressure * 1.5);
      const startY = y + lane * r * 3.2;
      const vibration = Math.sin(time * (1.2 + kp * 2.4) + line * 0.7) * r * 0.09 * kp;
      ctx.strokeStyle = rgba(line % 4 ? accent : [210, 250, 255], 0.045 + (1 - Math.abs(lane)) * 0.09 * pressure);
      ctx.lineWidth = line % 4 ? 0.7 : 1.2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(
        x - r * 0.9,
        y + side * r * (2.1 + shell) + vibration,
        x + r * 0.7,
        y + side * r * (2.5 + shell * 0.6),
        tailX,
        y + lane * r * 1.2 + vibration,
      );
      ctx.stroke();
    }

    const aurora = mix(accent, [118, 255, 186], 0.55);
    for (let band = 0; band < 9; band += 1) {
      const wobble = Math.sin(time * 1.6 + band * 0.61) * 0.07 * kp;
      ctx.strokeStyle = rgba(band % 2 ? aurora : accent, 0.045 + kp * 0.048);
      ctx.lineWidth = 1 + kp * 2.2;
      ctx.beginPath();
      ctx.arc(x, y, r * (1.12 + band * 0.025), -Math.PI * 0.92 + wobble, -Math.PI * 0.18 + wobble);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * (1.12 + band * 0.025), Math.PI * 0.08 + wobble, Math.PI * 0.82 + wobble);
      ctx.stroke();
    }
    ctx.restore();
    drawEarth(ctx, x, y, r, accent, time * 0.03);

    for (let wind = 0; wind < 46; wind += 1) {
      const progress = (hash(`wind-${wind}`) + time * (0.08 + kp * 0.06)) % 1;
      const wx = lerp(0, x - r * 1.6, progress);
      const wy = ((hash(`wind-y-${wind}`) * 1.2 - 0.1) * state.height + Math.sin(time + wind) * 5);
      ctx.strokeStyle = rgba(accent, 0.06 + kp * 0.08);
      ctx.beginPath();
      ctx.moveTo(wx - 20 - kp * 25, wy);
      ctx.lineTo(wx, wy);
      ctx.stroke();
    }
    drawLabel(ctx, `KP ${format(record?.kp, 2)} · MAGNETOPAUSE COMPRESSION`, x, y - r * 3.35, accent, "center");
    parameters.response = pressure;
  };

  const nearestGestureDistance = (state, x, y) => {
    let closest = Infinity;
    const gestures = state.draftGesture ? [...state.gestures, state.draftGesture] : state.gestures;
    gestures.forEach((gesture) => {
      if (gesture.modeIndex !== state.modeIndex) return;
      gesture.points.forEach((point) => {
        closest = Math.min(closest, Math.hypot(x - point.x * state.width, y - point.y * state.height));
      });
    });
    return closest;
  };

  const drawEnergeticParticles = ({ ctx, state, time, accent, record }) => {
    drawBackdrop(ctx, state, accent);
    const instruments = record?.instruments || [];
    const lanes = Math.max(3, Math.min(7, instruments.length || 3));
    const direction = -0.45;
    const dx = Math.cos(direction);
    const dy = Math.sin(direction);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let lane = 0; lane < lanes; lane += 1) {
      const laneY = state.height * (0.22 + lane * 0.56 / Math.max(1, lanes - 1));
      const stationX = state.width * (0.62 + lane * 0.035);
      ctx.strokeStyle = rgba(accent, 0.08);
      ctx.setLineDash([4, 11]);
      ctx.beginPath();
      ctx.moveTo(0, laneY);
      ctx.lineTo(state.width, laneY + direction * state.width * 0.16);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = rgba([225, 248, 255], 0.22);
      ctx.beginPath();
      ctx.arc(stationX, laneY + direction * stationX * 0.16, 16 + lane * 2, 0, TAU);
      ctx.stroke();
      drawLabel(ctx, instruments[lane]?.split(":")[0] || `DETECTOR ${lane + 1}`, stationX + 25, laneY + direction * stationX * 0.16 + 4, accent);
    }

    const count = Math.min(state.particles.length, 760);
    for (let index = 0; index < count; index += 1) {
      const particle = state.particles[index];
      const progress = (particle.x + time * 0.13 * particle.speed) % 1.16;
      let x = lerp(-80, state.width + 80, progress);
      let y = particle.y * state.height + x * direction * 0.18 + Math.sin(time * 1.1 + particle.phase) * 4;
      const shieldDistance = nearestGestureDistance(state, x, y);
      if (shieldDistance < 95) {
        const deflect = (1 - shieldDistance / 95) ** 2;
        y += (particle.lane || 1) * deflect * 120;
        x -= deflect * 35;
      }
      ctx.strokeStyle = rgba(index % 13 === 0 ? [255, 251, 224] : accent, 0.08 + particle.depth * 0.19);
      ctx.lineWidth = Math.max(0.5, particle.size * 0.55);
      ctx.beginPath();
      ctx.moveTo(x - dx * (12 + particle.speed * 24), y - dy * (12 + particle.speed * 24));
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();
    drawLabel(ctx, `${instruments.length || 0} INSTRUMENT LINKS · EVENT NOT PARTICLE COUNT`, state.width * 0.5, state.height * 0.11, accent, "center");
  };

  const drawCloseApproach = ({ ctx, state, time, accent, record }) => {
    drawBackdrop(ctx, state, accent);
    const scene = ensureScene(state);
    const earthX = state.width * 0.43;
    const earthY = state.height * 0.51;
    const earthR = Math.max(58, Math.min(state.width, state.height) * 0.105);
    const lunarOrbit = earthR * 3.1;
    const distanceLd = Math.max(0.004, number(record?.distanceLunar, 1));
    const visualDistance = earthR * lerp(1.25, 4.8, clamp(Math.log10(distanceLd + 1) / Math.log10(21)));
    const velocity = number(record?.velocityKmS, 12);
    if (state.pointer.down) scene.scrub = state.pointer.x;
    const t = state.pointer.visible ? scene.scrub : (time * clamp(velocity / 140, 0.035, 0.16)) % 1;
    const pathAngle = -0.28 + (hash(record?.designation || "asteroid") - 0.5) * 1.15;
    const pathLength = state.width * 0.78;
    const centerX = earthX;
    const centerY = earthY + visualDistance;
    const startX = centerX - pathLength * 0.5;
    const startY = centerY - Math.sin(pathAngle) * pathLength * 0.5;
    const endX = centerX + pathLength * 0.5;
    const endY = centerY + Math.sin(pathAngle) * pathLength * 0.5;

    ctx.strokeStyle = rgba(accent, 0.14);
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    ctx.arc(earthX, earthY, lunarOrbit, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    const moonAngle = time * 0.08;
    const moonX = earthX + Math.cos(moonAngle) * lunarOrbit;
    const moonY = earthY + Math.sin(moonAngle) * lunarOrbit;
    ctx.fillStyle = "rgba(220,230,238,0.45)";
    ctx.beginPath();
    ctx.arc(moonX, moonY, earthR * 0.16, 0, TAU);
    ctx.fill();
    drawLabel(ctx, "月 / 1月距離", moonX + 18, moonY - 12, accent);

    ctx.strokeStyle = rgba([228, 245, 255], 0.22);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    const asteroidX = lerp(startX, endX, smooth(t));
    const asteroidY = lerp(startY, endY, smooth(t));
    const magnitude = number(record?.absoluteMagnitude, 25);
    const asteroidR = clamp(12 - (magnitude - 18) * 0.32, 3, 14);
    const asteroidGlow = ctx.createRadialGradient(asteroidX, asteroidY, 0, asteroidX, asteroidY, asteroidR * 5);
    asteroidGlow.addColorStop(0, "rgba(255,255,247,0.85)");
    asteroidGlow.addColorStop(0.18, rgba(accent, 0.34));
    asteroidGlow.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = asteroidGlow;
    ctx.beginPath();
    ctx.arc(asteroidX, asteroidY, asteroidR * 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#f5fbff";
    ctx.beginPath();
    ctx.arc(asteroidX, asteroidY, asteroidR, 0, TAU);
    ctx.fill();
    drawEarth(ctx, earthX, earthY, earthR, accent, time * 0.02);
    drawLabel(ctx, "地球", earthX, earthY + earthR + 25, accent, "center");
    drawLabel(ctx, `小惑星 ${record?.designation || "名称不明"}`, asteroidX + 18, asteroidY - 16, accent);
    drawLabel(ctx, "記録された通過経路（距離と時間を圧縮）", startX + 30, startY - 20, accent);

    ctx.strokeStyle = rgba(accent, 0.34);
    ctx.beginPath();
    ctx.moveTo(earthX, earthY + earthR);
    ctx.lineTo(earthX, centerY);
    ctx.stroke();
    const distanceKm = distanceLd * 384400;
    drawLabel(ctx, `最接近 ${format(distanceLd, 3)}月距離（約${format(distanceKm, 0)}km） / 速度 ${format(velocity, 1)}km/s`, state.width * 0.52, state.height * 0.15, accent, "center");
  };

  const drawFireball = ({ ctx, state, now, time, accent, record }) => {
    drawBackdrop(ctx, state, accent, 0.12);
    const scene = ensureScene(state);
    const energy = Math.max(0.01, number(record?.impactKilotons, 0.1));
    const altitude = number(record?.altitudeKm, 31);
    const velocity = number(record?.velocityKmS, 18);
    const horizonY = state.height * 0.78;
    const earthRadius = state.width * 0.88;
    const earthX = state.width * 0.5;
    const earthY = horizonY + earthRadius;
    const atmosphere = mix(accent, [116, 210, 255], 0.6);
    for (let layerIndex = 0; layerIndex < 7; layerIndex += 1) {
      ctx.strokeStyle = rgba(atmosphere, 0.025 + layerIndex * 0.008);
      ctx.lineWidth = 1 + layerIndex * 1.5;
      ctx.beginPath();
      ctx.arc(earthX, earthY, earthRadius + layerIndex * 9, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    }
    const ground = ctx.createRadialGradient(earthX, earthY, earthRadius * 0.8, earthX, earthY, earthRadius * 1.02);
    ground.addColorStop(0, "#03101c");
    ground.addColorStop(0.96, "#071a29");
    ground.addColorStop(1, rgba(atmosphere, 0.38));
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius, Math.PI, TAU);
    ctx.fill();

    if (state.pointer.down) scene.entryAngle = lerp(-1.18, -0.25, state.pointer.x);
    const progressBase = (time * clamp(velocity / 120, 0.045, 0.16)) % 1;
    const activePulses = state.pulses.length ? state.pulses : [{ born: now - progressBase * 5200, duration: 5200, kind: "SOURCE" }];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    activePulses.forEach((pulse, index) => {
      const progress = pulseAge(pulse, now);
      const startX = state.width * (0.12 + hash(record?.date || "fireball") * 0.68);
      const startY = state.height * 0.06;
      const length = state.height * 1.08;
      const x = startX + Math.cos(scene.entryAngle) * length * progress;
      const y = startY - Math.sin(scene.entryAngle) * length * progress;
      const peakY = horizonY - clamp(altitude / 90, 0.16, 0.8) * state.height * 0.52;
      const peak = Math.exp(-(((y - peakY) / (state.height * 0.08)) ** 2));
      const intensity = clamp(Math.log10(energy + 1) / 1.8 + 0.25, 0.25, 1);
      const glowR = 28 + peak * (70 + intensity * 120);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      glow.addColorStop(0, `rgba(255,255,233,${0.78 * intensity})`);
      glow.addColorStop(0.18, `rgba(255,175,78,${0.42 * intensity})`);
      glow.addColorStop(1, "rgba(255,72,25,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, TAU);
      ctx.fill();
      const tail = 80 + velocity * 5;
      const tailGradient = ctx.createLinearGradient(x - Math.cos(scene.entryAngle) * tail, y + Math.sin(scene.entryAngle) * tail, x, y);
      tailGradient.addColorStop(0, "rgba(255,90,35,0)");
      tailGradient.addColorStop(1, `rgba(255,245,214,${0.72 * intensity})`);
      ctx.strokeStyle = tailGradient;
      ctx.lineWidth = 1.5 + intensity * 3;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(scene.entryAngle) * tail, y + Math.sin(scene.entryAngle) * tail);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (!index) drawLabel(ctx, `${format(energy, 2)} KT · PEAK ${format(altitude, 1)} KM`, x + 20, y - 20, accent);
    });
    ctx.restore();
    drawLabel(ctx, "ATMOSPHERIC ENTRY / LAT-LON POSITION IS RECORDED", state.width * 0.5, state.height * 0.12, accent, "center");
  };

  const nearbyNodes = (state, mode) => {
    const records = (mode?.records || []).slice(0, 28);
    const maxDistance = Math.max(1, ...records.map((record) => number(record.distancePc, 1)));
    return records.map((record, index) => {
      const key = `${record.star}-${record.planet}`;
      const angle = hash(key) * TAU + index * 0.37;
      const radius = clamp(Math.log10(number(record.distancePc, 1) + 1) / Math.log10(maxDistance + 1), 0.08, 1);
      return { record, index, angle, radius };
    });
  };

  const drawNearbyWorlds = ({ ctx, state, time, accent, mode }) => {
    drawBackdrop(ctx, state, accent);
    const nodes = nearbyNodes(state, mode);
    const cx = state.width * 0.53;
    const cy = state.height * 0.5;
    const maxR = Math.min(state.width, state.height) * 0.42;
    const parallaxX = (state.pointer.x - 0.5) * 45;
    const parallaxY = (state.pointer.y - 0.5) * 34;
    [2, 5, 10, 20].forEach((pc, index) => {
      const radius = maxR * (0.18 + index * 0.22);
      ctx.strokeStyle = rgba(accent, 0.07 + index * 0.012);
      ctx.setLineDash([2, 12]);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      drawLabel(ctx, `${pc} PC`, cx + radius + 8, cy + 3, accent);
    });
    const sunGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 48);
    sunGlow.addColorStop(0, "rgba(255,249,205,0.95)");
    sunGlow.addColorStop(0.15, "rgba(255,199,84,0.5)");
    sunGlow.addColorStop(1, "rgba(255,150,45,0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, TAU);
    ctx.fill();

    nodes.forEach((node) => {
      const depth = 0.4 + node.radius * 0.6;
      const x = cx + Math.cos(node.angle + time * 0.003) * node.radius * maxR + parallaxX * depth;
      const y = cy + Math.sin(node.angle + time * 0.003) * node.radius * maxR * 0.72 + parallaxY * depth;
      const selected = node.index === state.recordIndex % Math.max(1, mode.records.length);
      const size = selected ? 7 : 2.2 + clamp(number(node.record.radiusEarth, 1) / 2, 0, 2);
      ctx.fillStyle = selected ? "#fff" : rgba(accent, 0.5);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TAU);
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = rgba(accent, 0.5);
        ctx.beginPath();
        ctx.arc(x, y, 18 + Math.sin(time * 2) * 3, 0, TAU);
        ctx.stroke();
        drawLabel(ctx, `${node.record.planet} · ${format(node.record.distancePc, 2)} PC`, x + 26, y - 12, accent);
      }
    });
    drawLabel(ctx, "LOCAL EXOPLANET NEIGHBOURHOOD · LOG DISTANCE", cx, state.height * 0.1, accent, "center");
  };

  const temperatureColor = (kelvin) => {
    const normalized = clamp((number(kelvin, 255) - 180) / 150);
    if (normalized < 0.5) return mix([103, 180, 255], [142, 244, 203], normalized * 2);
    return mix([142, 244, 203], [255, 146, 92], (normalized - 0.5) * 2);
  };

  const drawEarthScaleWorlds = ({ ctx, state, time, accent, mode }) => {
    drawBackdrop(ctx, state, accent);
    const records = (mode.records || []).slice(0, 16);
    const left = state.width * 0.25;
    const right = state.width * 0.82;
    const zoneTop = state.height * 0.25;
    const zoneBottom = state.height * 0.76;
    const zoneGradient = ctx.createLinearGradient(0, zoneTop, 0, zoneBottom);
    zoneGradient.addColorStop(0, "rgba(255,128,75,0.04)");
    zoneGradient.addColorStop(0.45, "rgba(125,245,195,0.08)");
    zoneGradient.addColorStop(1, "rgba(96,156,255,0.04)");
    ctx.fillStyle = zoneGradient;
    ctx.fillRect(left - 60, zoneTop, right - left + 120, zoneBottom - zoneTop);
    [330, 255, 180].forEach((temperature) => {
      const y = lerp(zoneTop, zoneBottom, 1 - (temperature - 180) / 150);
      ctx.strokeStyle = rgba(temperatureColor(temperature), 0.12);
      ctx.beginPath();
      ctx.moveTo(left - 60, y);
      ctx.lineTo(right + 60, y);
      ctx.stroke();
      drawLabel(ctx, `${temperature} K`, left - 72, y + 4, temperatureColor(temperature), "right");
    });

    records.forEach((record, index) => {
      const column = index % 8;
      const row = Math.floor(index / 8);
      const x = lerp(left, right, column / 7) + row * 22;
      const yBase = lerp(zoneBottom, zoneTop, clamp((number(record.equilibriumK, 255) - 180) / 150));
      const y = yBase + (row ? 28 : -20);
      const radiusEarth = number(record.radiusEarth, 1);
      const radius = 10 + radiusEarth * 17;
      const color = temperatureColor(record.equilibriumK);
      const selected = index === state.recordIndex % Math.max(1, mode.records.length);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * (selected ? 2.1 : 1.35));
      glow.addColorStop(0, rgba(mix(color, [255, 255, 255], 0.32), selected ? 0.95 : 0.72));
      glow.addColorStop(0.58, rgba(color, selected ? 0.5 : 0.32));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * (selected ? 2.1 : 1.35), 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(color, 0.78);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = selected ? "rgba(255,255,255,0.75)" : rgba(accent, 0.13);
      ctx.beginPath();
      ctx.arc(x, y, radius + (selected ? 8 + Math.sin(time * 2) * 2 : 3), 0, TAU);
      ctx.stroke();
      if (selected) drawLabel(ctx, `${record.planet} · ${format(radiusEarth, 2)} R⊕ · ${format(record.equilibriumK, 0)} K`, x, y - radius - 18, accent, "center");
    });
    drawLabel(ctx, "RADIUS CONTROLS SIZE · EQUILIBRIUM TEMPERATURE CONTROLS HEIGHT AND COLOR", state.width * 0.53, state.height * 0.11, accent, "center");
  };

  const ryuguPoints = (mode) => {
    const records = mode?.records || [];
    if (!records.length) return [];
    return records.map((record, index) => {
      const longitude = number(record.topoLongitudeDeg, index / records.length * 360) * Math.PI / 180;
      const latitude = number(record.topoLatitudeDeg, 0) * Math.PI / 180;
      const height = number(record.topoHeightM, 500);
      return { record, index, longitude, latitude, height };
    });
  };

  const drawRyugu = ({ ctx, state, now, time, accent, mode, record }) => {
    drawBackdrop(ctx, state, accent);
    const points = ryuguPoints(mode);
    const cx = state.width * 0.56;
    const cy = state.height * 0.51;
    const baseR = Math.min(state.width, state.height) * 0.27;
    const halo = ctx.createRadialGradient(cx, cy, baseR * 0.35, cx, cy, baseR * 2.2);
    halo.addColorStop(0, rgba(accent, 0.18));
    halo.addColorStop(0.46, rgba(accent, 0.07));
    halo.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(cx - baseR * 2.2, cy - baseR * 2.2, baseR * 4.4, baseR * 4.4);
    const profile = Array.from({ length: 180 }, (_, index) => {
      const angle = index / 180 * TAU;
      const nearest = points.reduce((best, point) => {
        const delta = Math.abs(Math.atan2(Math.sin(point.longitude - angle), Math.cos(point.longitude - angle)));
        return delta < best.delta ? { point, delta } : best;
      }, { point: null, delta: Infinity }).point;
      const measured = nearest ? clamp((nearest.height - 430) / 160, -0.35, 0.45) : 0;
      const ridge = Math.sin(angle * 2) * 0.07 + Math.sin(angle * 7 + 0.8) * 0.025;
      return { angle, radius: baseR * (1 + ridge + measured * 0.12) };
    });

    const fill = ctx.createRadialGradient(cx - baseR * 0.28, cy - baseR * 0.22, baseR * 0.05, cx, cy, baseR * 1.2);
    fill.addColorStop(0, "#9aa6b0");
    fill.addColorStop(0.46, "#45525d");
    fill.addColorStop(1, "#111820");
    ctx.fillStyle = fill;
    ctx.strokeStyle = rgba(accent, 0.62);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    profile.forEach((point, index) => {
      const x = cx + Math.cos(point.angle) * point.radius;
      const y = cy + Math.sin(point.angle) * point.radius * 0.76;
      if (!index) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    points.forEach((point) => {
      const radius = baseR * (1 + clamp((point.height - 430) / 160, -0.35, 0.45) * 0.12);
      const x = cx + Math.cos(point.longitude + time * 0.01) * radius;
      const y = cy + Math.sin(point.longitude + time * 0.01) * radius * 0.76;
      ctx.fillStyle = rgba(point.index === state.recordIndex ? [255, 255, 255] : accent, point.index === state.recordIndex ? 1 : 0.5);
      ctx.beginPath();
      ctx.arc(x, y, point.index === state.recordIndex ? 3.8 : 1.1, 0, TAU);
      ctx.fill();
    });

    const selectedAngle = number(record?.topoLongitudeDeg, 0) * Math.PI / 180 + time * 0.01;
    const targetX = cx + Math.cos(selectedAngle) * baseR;
    const targetY = cy + Math.sin(selectedAngle) * baseR * 0.76;
    const craftX = state.width * (state.pointer.visible ? state.pointer.x : 0.86);
    const craftY = state.height * (state.pointer.visible ? state.pointer.y : 0.2);
    ctx.strokeStyle = rgba([224, 250, 255], 0.56);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.moveTo(craftX, craftY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
    const pulse = (time * 0.7) % 1;
    const pulseX = lerp(craftX, targetX, pulse);
    const pulseY = lerp(craftY, targetY, pulse);
    ctx.fillStyle = "rgba(236,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(pulseX, pulseY, 2.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(accent, 0.5 * (1 - pulseAge({ born: now - (time % 1) * 1000, duration: 1000 }, now)));
    ctx.beginPath();
    ctx.arc(targetX, targetY, 12 + (time % 1) * 36, 0, TAU);
    ctx.stroke();
    const labelOnRight = targetX > state.width * 0.66;
    drawLabel(
      ctx,
      `${format(record?.rangeM, 1)} M · H ${format(record?.topoHeightM, 2)} M`,
      targetX + (labelOnRight ? -16 : 16),
      targetY - 14,
      accent,
      labelOnRight ? "right" : "left",
    );
    drawLabel(ctx, "HAYABUSA2 LIDAR · SAVED RANGE ROWS", cx, state.height * 0.1, accent, "center");
  };

  const cosmosNodes = (state) => {
    const sources = state.snapshot?.sources || [];
    const cx = state.width * 0.55;
    const cy = state.height * 0.5;
    const radius = Math.min(state.width, state.height) * 0.34;
    return sources.map((source, index) => {
      const angle = -Math.PI / 2 + index / Math.max(1, sources.length) * TAU;
      return {
        source,
        index,
        x: cx + Math.cos(angle) * radius * (0.78 + (index % 2) * 0.18),
        y: cy + Math.sin(angle) * radius * 0.72,
      };
    });
  };

  const drawCosmos = ({ ctx, state, time, accent }) => {
    drawBackdrop(ctx, state, accent);
    const scene = ensureScene(state);
    const nodes = cosmosNodes(state);
    const compact = state.width <= 600;
    const cx = state.width * 0.55;
    const cy = state.height * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    nodes.forEach((node, index) => {
      const next = nodes[(index + 3) % nodes.length];
      const pulse = 0.03 + (Math.sin(time * 0.65 + index) + 1) * 0.018;
      ctx.strokeStyle = rgba(accent, pulse);
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.quadraticCurveTo(cx, cy, next.x, next.y);
      ctx.stroke();
    });
    scene.cosmosLinks.forEach((link, index) => {
      const from = nodes[link.from];
      const to = nodes[link.to];
      if (!from || !to) return;
      const glow = 0.32 + Math.sin(time * 1.8 + index) * 0.1;
      ctx.strokeStyle = rgba([236, 255, 249], glow);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(cx + Math.sin(index) * 80, cy + Math.cos(index) * 60, to.x, to.y);
      ctx.stroke();
    });
    nodes.forEach((node) => {
      const selected = node.index === scene.pendingNode;
      const radius = selected ? 12 : 6;
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 4);
      glow.addColorStop(0, rgba([245, 255, 250], selected ? 0.95 : 0.6));
      glow.addColorStop(0.18, rgba(accent, selected ? 0.48 : 0.24));
      glow.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = selected ? "#fff" : rgba(accent, 0.74);
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, TAU);
      ctx.fill();
      if (!compact) {
        drawLabel(ctx, node.source.organisation, node.x + (node.x < cx ? -14 : 14), node.y - 16, accent, node.x < cx ? "right" : "left");
      }
    });
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 100);
    core.addColorStop(0, "rgba(241,255,249,0.76)");
    core.addColorStop(0.12, rgba(accent, 0.36));
    core.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, 100, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (!compact) {
      drawLabel(ctx, `${nodes.length} SOURCES · ${scene.cosmosLinks.length} SCENARIO LINKS · NO COMPOSITE SCORE`, cx, state.height * 0.1, accent, "center");
    }
  };

  const render = (payload) => {
    const { mode } = payload;
    if (!mode || mode.id === "solar-flare") return false;
    ensureScene(payload.state);
    switch (mode.id) {
      case "coronal-mass-ejection": drawCme(payload); break;
      case "geomagnetic-storm": drawGeomagneticStorm(payload); break;
      case "energetic-particles": drawEnergeticParticles(payload); break;
      case "close-approach": drawCloseApproach(payload); break;
      case "fireball": drawFireball(payload); break;
      case "nearby-worlds": drawNearbyWorlds(payload); break;
      case "earth-scale-worlds": drawEarthScaleWorlds(payload); break;
      case "ryugu-lidar": drawRyugu(payload); break;
      case "cosmic-senseware": drawCosmos(payload); break;
      default: return false;
    }
    return true;
  };

  const nearestNodeIndex = (nodes, point, state) => {
    if (!nodes.length) return -1;
    let best = { index: 0, distance: Infinity };
    nodes.forEach((node, index) => {
      const distance = Math.hypot(node.x / state.width - point.x, node.y / state.height - point.y);
      if (distance < best.distance) best = { index, distance };
    });
    return best.index;
  };

  const pointerDown = ({ state, mode, point }) => {
    const scene = ensureScene(state);
    const records = mode?.records || [];
    let changedRecord = false;
    switch (mode?.id) {
      case "close-approach":
        scene.scrub = point.x;
        break;
      case "fireball":
        scene.entryAngle = lerp(-1.18, -0.25, point.x);
        break;
      case "nearby-worlds": {
        const nodes = nearbyNodes(state, mode).map((node) => {
          const cx = state.width * 0.53;
          const cy = state.height * 0.5;
          const maxR = Math.min(state.width, state.height) * 0.42;
          return {
            x: cx + Math.cos(node.angle) * node.radius * maxR,
            y: cy + Math.sin(node.angle) * node.radius * maxR * 0.72,
          };
        });
        const index = nearestNodeIndex(nodes, point, state);
        if (index >= 0) {
          state.recordIndex = index;
          changedRecord = true;
        }
        break;
      }
      case "earth-scale-worlds": {
        const column = clamp(Math.round(((point.x - 0.25) / 0.57) * 7), 0, 7);
        const row = point.y > 0.52 ? 1 : 0;
        const index = clamp(row * 8 + column, 0, Math.max(0, records.length - 1));
        state.recordIndex = index;
        changedRecord = true;
        break;
      }
      case "ryugu-lidar": {
        const angle = (Math.atan2(point.y - 0.51, point.x - 0.56) + TAU) % TAU;
        let best = { index: 0, distance: Infinity };
        records.forEach((record, index) => {
          const longitude = number(record.topoLongitudeDeg, 0) * Math.PI / 180;
          const distance = Math.abs(Math.atan2(Math.sin(longitude - angle), Math.cos(longitude - angle)));
          if (distance < best.distance) best = { index, distance };
        });
        state.recordIndex = best.index;
        changedRecord = true;
        break;
      }
      case "cosmic-senseware": {
        const nodes = cosmosNodes(state);
        const index = nearestNodeIndex(nodes, point, state);
        if (index >= 0) {
          if (scene.pendingNode !== null && scene.pendingNode !== index) {
            const key = [scene.pendingNode, index].sort((a, b) => a - b).join("-");
            if (!scene.cosmosLinks.some((link) => link.key === key)) {
              scene.cosmosLinks.push({ from: scene.pendingNode, to: index, key });
            }
          }
          scene.pendingNode = index;
        }
        break;
      }
      default:
        break;
    }
    return { changedRecord };
  };

  const activate = ({ state, mode }) => {
    const scene = ensureScene(state);
    const records = mode?.records || [];
    let changedRecord = false;
    switch (mode?.id) {
      case "geomagnetic-storm":
        state.response = 1.2;
        break;
      case "energetic-particles":
        scene.enteredAt = performance.now();
        break;
      case "close-approach":
        scene.scrub = 0;
        break;
      case "nearby-worlds":
        state.recordIndex = (state.recordIndex + 1) % Math.max(1, Math.min(records.length, 28));
        changedRecord = true;
        break;
      case "earth-scale-worlds":
      case "ryugu-lidar":
        state.recordIndex = (state.recordIndex + 1) % Math.max(1, records.length);
        changedRecord = true;
        break;
      case "cosmic-senseware":
        scene.pendingNode = scene.pendingNode === null ? 0 : scene.pendingNode;
        break;
      default:
        break;
    }
    return { changedRecord };
  };

  const encoding = (mode, record) => {
    switch (mode?.id) {
      case "coronal-mass-ejection": return [
        ["速度 → 波面の移動", `${format(record?.speedKmS, 0)} km/sを画面時間へ圧縮`],
        ["半角幅 → 円弧の高さ", `${format(record?.halfAngleDeg, 0)}°を扇状の広がりへ変換`],
        ["ドラッグ", "観測方向を変えるSCENARIO。SOURCEの速度・幅は変更しません"],
      ];
      case "geomagnetic-storm": return [
        ["Kp → 磁力線の圧縮", `Kp ${format(record?.kp, 2)}で昼側磁気圏を縮める`],
        ["Kp → オーロラ帯", "指数が高いほど帯を太く速く揺らす"],
        ["タッチ", "局所的なたわみを加えるSCENARIO"],
      ];
      case "energetic-particles": return [
        ["観測機器 → 粒子列", `${record?.instruments?.length || 0}件の機器リンクを検出レーンとして表示`],
        ["イベント時刻", `${record?.eventTime || record?.startTime || "—"}の通知を再生`],
        ["指の線", "粒子を曲げる仮想シールド。実在の磁場ではありません"],
      ];
      case "close-approach": return [
        ["最接近距離 → 軌道の間隔", `${format(record?.distanceLunar, 3)} LDを対数圧縮して月軌道と比較`],
        ["相対速度 → 通過速度", `${format(record?.velocityKmS, 2)} km/sをアニメーション時間へ圧縮`],
        ["左右ドラッグ", "観測時刻を往復するSCENARIO"],
      ];
      case "fireball": return [
        ["衝撃エネルギー → 発光", `${format(record?.impactKilotons, 2)} ktで光球の大きさと明るさを決定`],
        ["高度 → 発光位置", `${format(record?.altitudeKm, 1)} kmを大気層内の高さへ変換`],
        ["ドラッグ方向", "進入角だけを変えるSCENARIO"],
      ];
      case "nearby-worlds": return [
        ["距離 → 中心からの半径", `${format(record?.distancePc, 2)} pcを対数半径へ変換`],
        ["名称・発見方法", `${record?.planet || "—"} / ${record?.method || "—"}`],
        ["タッチ", "星図上の記録を選択。天体位置の実座標ではありません"],
      ];
      case "earth-scale-worlds": return [
        ["惑星半径 → 円の大きさ", `${format(record?.radiusEarth, 2)} R⊕を表示半径へ変換`],
        ["平衡温度 → 高さと色", `${format(record?.equilibriumK, 0)} Kを青・緑・橙の連続色へ変換`],
        ["抽出条件", "0.5〜2.0 R⊕、180〜330 K。生命の有無を示しません"],
      ];
      case "ryugu-lidar": return [
        ["測距値 → 光路", `${format(record?.rangeM, 1)} mを探査機から表面までの点線として表示`],
        ["地形座標 → 輪郭", `経度 ${format(record?.topoLongitudeDeg, 2)}°・高さ ${format(record?.topoHeightM, 2)} mを輪郭点へ変換`],
        ["タッチ", "保存行から測距点を選び直す操作"],
      ];
      case "cosmic-senseware": return [
        ["8データ源 → 8節点", "異なる単位を統合点へ換算せず、別々の節点として保持"],
        ["節点の線", "観客が順に触れて作るSCENARIO。物理的因果を意味しません"],
        ["総合点", "作りません。矛盾する信号を一つの評価へ潰さないためです"],
      ];
      default: return [
        ["フレア等級 → 光の大きさ", `${record?.classType || "—"}をX線強度の段階として表示`],
        ["位置・時刻", `${record?.sourceLocation || "位置不明"} / ${record?.peakTime || record?.beginTime || "—"}`],
      ];
    }
  };

  window.GaiaSpaceScenes = {
    activate,
    encoding,
    interaction: (mode) => INTERACTIONS[mode?.id] || null,
    pointerDown,
    render,
    resetMode,
  };
})();
