(() => {
  "use strict";

  const SCENES = Object.freeze({
    awakening: Object.freeze({ index: 0, colors: ["#020611", "#0b5b73", "#9af7e4"] }),
    "many-senses": Object.freeze({ index: 1, colors: ["#030817", "#236b68", "#f0bd75"] }),
    excavation: Object.freeze({ index: 2, colors: ["#080814", "#75432f", "#65d6c8"] }),
    loom: Object.freeze({ index: 3, colors: ["#020515", "#4c2f87", "#7be8ff"] }),
    reconstruction: Object.freeze({ index: 4, colors: ["#020913", "#167d83", "#d4fff2"] }),
    galaxy: Object.freeze({ index: 5, colors: ["#01030d", "#3548a3", "#e6b8ff"] }),
    lineage: Object.freeze({ index: 6, colors: ["#020810", "#177064", "#9fffd0"] }),
    fossil: Object.freeze({ index: 7, colors: ["#08070c", "#725438", "#7ad6c4"] }),
    shore: Object.freeze({ index: 8, colors: ["#010713", "#0d6680", "#ffd09c"] }),
  });
  const DEFAULT_SCENE = SCENES.awakening;
  const PRESENCES = Object.freeze({
    narrator: Object.freeze({ index: 0, manifestation: "central-breath" }),
    system: Object.freeze({ index: 1, manifestation: "signal-matrix" }),
    lou: Object.freeze({ index: 2, manifestation: "living-loom" }),
    mizuha: Object.freeze({ index: 3, manifestation: "water-ripples" }),
    amane: Object.freeze({ index: 4, manifestation: "sky-veil" }),
    sakuya: Object.freeze({ index: 5, manifestation: "bloom-resonance" }),
    visitor: Object.freeze({ index: 6, manifestation: "choice-paths" }),
  });
  const DEFAULT_PRESENCE = PRESENCES.narrator;
  const VERTEX_SOURCE = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const FRAGMENT_BODY = `
    varying vec2 v_uv;
    uniform vec2 u_resolution;
    uniform vec2 u_pointer;
    uniform float u_time;
    uniform float u_scene;
    uniform float u_speaker_from;
    uniform float u_speaker_from_gain;
    uniform float u_speaker_to;
    uniform float u_speaker_mix;
    uniform float u_signal;
    uniform float u_emphasis;
    uniform vec3 u_color_a;
    uniform vec3 u_color_b;
    uniform vec3 u_color_c;

    const float AIVA_FIELD_DRIFT_SPEED = 0.18;
    const float AMBIENT_FLOW_SPEED = 0.055;
    const float AMBIENT_BREATH_SPEED = 0.17;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
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

    mat2 rotate2d(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat2(c, -s, s, c);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.52;
      mat2 turn = rotate2d(0.53);
      for (int octave = 0; octave < 4; octave += 1) {
        value += amplitude * noise21(p);
        p = turn * p * 2.04 + vec2(7.1, 3.7);
        amplitude *= 0.49;
      }
      return value;
    }

    float starLayer(vec2 p, float scale, float seed, float threshold) {
      vec2 grid = p * scale;
      vec2 id = floor(grid);
      vec2 cell = fract(grid) - 0.5;
      float random = hash21(id + seed);
      vec2 offset = vec2(hash21(id + seed + 13.7), hash21(id + seed + 31.9)) - 0.5;
      float radius = mix(0.018, 0.075, pow(random, 18.0));
      float core = 1.0 - smoothstep(0.0, radius, length(cell - offset * 0.58));
      float twinkle = 0.72 + 0.28 * sin(u_time * (0.45 + random * 1.6) + random * 41.0);
      return core * step(threshold, random) * twinkle;
    }

    float softLine(float distanceToLine, float width) {
      return 1.0 - smoothstep(width, width * 2.6, distanceToLine);
    }

    vec3 centralBreath(vec2 p) {
      vec2 g = p;
      float phase = u_time * 0.34 + u_signal * 6.2831;
      float fogA = fbm(g * 1.18 + vec2(phase * 0.08, -phase * 0.05));
      float fogB = fbm(g * 2.05 - vec2(phase * 0.05, phase * 0.08));
      float fog = smoothstep(0.3, 0.78, fogA * 0.7 + fogB * 0.42);
      float center = exp(-2.4 * dot(g, g)) * (0.72 + 0.28 * sin(phase));
      return mix(u_color_b, u_color_c, 0.44) * (fog * 0.11 + center * 0.14);
    }

    vec3 signalSurge(vec2 p) {
      vec2 g = p;
      float phase = u_time * 1.18 + u_signal * 8.0;
      vec2 fieldDrift = vec2(
        u_time * AIVA_FIELD_DRIFT_SPEED,
        -u_time * AIVA_FIELD_DRIFT_SPEED * 0.72
      );
      float signalNoiseA = fbm(g * vec2(1.3, 1.76) + fieldDrift);
      float signalNoiseB = fbm(
        rotate2d(0.64) * g * vec2(2.16, 1.22) - fieldDrift * 0.78 + vec2(5.7, 11.3)
      );
      vec2 signalSpace = g + vec2(signalNoiseA - 0.5, signalNoiseB - 0.5) * 0.28;
      float carrierA = 0.5 + 0.5 * sin(
        signalSpace.x * 5.4 + signalSpace.y * 1.7 + signalNoiseB * 3.2 - phase * 0.62
      );
      float carrierB = 0.5 + 0.5 * sin(
        signalSpace.y * 4.8 - signalSpace.x * 1.35 + signalNoiseA * 3.6 + phase * 0.48
      );
      float signalVeil = smoothstep(0.34, 0.82, signalNoiseA * 0.62 + signalNoiseB * 0.48);
      float carrierGlow = smoothstep(0.7, 0.96, carrierA) * 0.5
        + smoothstep(0.74, 0.98, carrierB) * 0.42;
      float measureTrace = softLine(
        abs(signalSpace.y + 0.18 * sin(signalSpace.x * 2.4 + phase * 0.34) - 0.08),
        0.052
      );
      float responseTrace = softLine(
        abs(signalSpace.x - 0.34 * sin(signalSpace.y * 2.1 - phase * 0.28) + 0.14),
        0.042
      );
      float scanWave = smoothstep(
        0.76,
        0.98,
        0.5 + 0.5 * sin((signalSpace.y + signalNoiseA * 0.22) * 3.1 - phase * 0.44)
      );
      float center = exp(-2.1 * dot(g, g));
      vec3 electric = mix(vec3(0.18, 0.9, 1.0), vec3(0.92, 1.0, 1.0), center);
      return electric * (
        signalVeil * 0.54 + carrierGlow * 0.46 + measureTrace * 0.28
          + responseTrace * 0.18 + scanWave * signalVeil * 0.2 + center * 0.3
      );
    }

    vec3 weaveStorm(vec2 p) {
      vec2 g = p;
      float phase = u_time * 0.72 + u_signal * 5.2;
      float warp = fbm(g * 1.32 + vec2(phase * 0.12, -phase * 0.08));
      float warpThreads = smoothstep(0.66, 0.94, 0.5 + 0.5 * cos((g.x + 0.08 * sin(g.y * 2.0 + phase)) * 18.0));
      float weftThreads = smoothstep(0.66, 0.94, 0.5 + 0.5 * cos((g.y + 0.09 * sin(g.x * 1.8 - phase * 0.82)) * 15.0));
      float diagonalThread = smoothstep(0.72, 0.96, 0.5 + 0.5 * cos((g.x - g.y + warp * 0.18) * 13.0 + phase));
      float crossings = warpThreads * weftThreads;
      float center = exp(-2.0 * dot(g, g)) * (0.82 + 0.18 * sin(phase * 1.8));
      vec3 cyan = vec3(0.24, 1.0, 0.94);
      vec3 violet = vec3(0.55, 0.44, 1.0);
      return mix(cyan, violet, smoothstep(-0.9, 0.9, g.y + warp - 0.5))
        * ((warpThreads + weftThreads) * 0.38 + diagonalThread * 0.22 + crossings * 0.72 + center * 0.48);
    }

    vec3 tidalSurge(vec2 p) {
      vec2 g = rotate2d(-0.18) * p;
      float phase = u_time * 1.05 + u_signal * 7.0;
      float currentA = fbm(g * vec2(1.38, 1.92) + vec2(-phase * 0.055, phase * 0.032));
      float currentB = fbm(rotate2d(0.72) * g * vec2(2.18, 1.16) + vec2(phase * 0.04, -phase * 0.065));
      vec2 waterSpace = g + vec2(currentA - 0.5, currentB - 0.5) * 0.3;
      waterSpace.x += sin(waterSpace.y * 2.55 + phase * 0.34) * 0.12;
      waterSpace.y += sin(waterSpace.x * 2.1 - phase * 0.27) * 0.075;

      vec2 sourceA = waterSpace - vec2(-0.46, 0.16);
      vec2 sourceB = rotate2d(0.43) * (waterSpace - vec2(0.52, -0.3));
      float tideA = length(sourceA * vec2(0.58, 1.32));
      float tideB = length(sourceB * vec2(1.16, 0.64));
      float arcMaskA = fbm(vec2(atan(sourceA.y, sourceA.x) * 1.2, tideA * 2.45) + vec2(phase * 0.035, 7.3));
      float arcMaskB = fbm(vec2(atan(sourceB.y, sourceB.x) * 1.05, tideB * 2.8) + vec2(-phase * 0.028, 13.1));
      float brokenWaveA = smoothstep(0.77, 0.96, 0.5 + 0.5 * cos(tideA * 10.6 - phase * 1.62 + currentB * 2.7));
      float brokenWaveB = smoothstep(0.8, 0.97, 0.5 + 0.5 * cos(tideB * 13.4 - phase * 1.94 - currentA * 2.3));
      brokenWaveA *= smoothstep(0.4, 0.68, arcMaskA) * exp(-0.24 * tideA);
      brokenWaveB *= smoothstep(0.44, 0.73, 1.0 - arcMaskB) * exp(-0.28 * tideB);

      float interferenceVein = smoothstep(
        0.75,
        0.97,
        0.5 + 0.5 * sin(waterSpace.x * 4.4 - waterSpace.y * 2.8 + (currentA - currentB) * 5.4 - phase * 0.78)
      );
      interferenceVein *= smoothstep(0.38, 0.76, currentA);
      float causticFray = smoothstep(0.1, 0.38, abs(currentA - currentB))
        * smoothstep(0.32, 0.78, fbm(waterSpace * 3.1 + vec2(phase * 0.06, -phase * 0.04)));
      float confluence = brokenWaveA * brokenWaveB;
      float undertow = smoothstep(0.34, 0.8, fbm(waterSpace * vec2(1.05, 2.6) - vec2(phase * 0.03, phase * 0.08)));

      vec3 abyss = vec3(0.015, 0.2, 0.5);
      vec3 mineral = vec3(0.08, 0.58, 0.78);
      vec3 pearl = vec3(0.56, 1.0, 0.88);
      vec3 waterColor = mix(abyss, mineral, clamp(currentA * 0.58 + currentB * 0.34, 0.0, 1.0));
      return waterColor * (0.08 + undertow * 0.2 + brokenWaveA * 0.62 + brokenWaveB * 0.46 + causticFray * 0.2)
        + pearl * (confluence * 0.72 + interferenceVein * 0.24);
    }

    vec3 skyCurrent(vec2 p) {
      vec2 g = p;
      float phase = u_time * 0.82 + u_signal * 5.8;
      float skyPressure = fbm(vec2(g.x * 1.18 + phase * 0.06, g.y * 0.42 + phase * 0.21));
      float fallingMemory = fbm(vec2(g.x * 2.1 - skyPressure * 0.28, g.y * 0.34 + phase * 0.34));
      float descendingVeil = smoothstep(0.38, 0.78, fallingMemory)
        * (0.52 + 0.48 * smoothstep(0.24, 0.86, skyPressure));
      float pressureFront = softLine(
        abs(g.y + 0.2 * sin(g.x * 1.65 + phase * 0.42) + skyPressure * 0.34 - 0.2),
        0.18
      );
      float downwardPulse = 0.5 + 0.5 * sin((g.y + fallingMemory * 0.42) * 5.2 + phase * 2.3);
      downwardPulse = smoothstep(0.24, 0.84, downwardPulse) * descendingVeil;
      float rainAfterimage = smoothstep(0.52, 0.82, fbm(vec2(g.x * 3.0 + g.y * 0.12, phase * 0.18 - g.y * 0.6)));
      float horizonVapor = exp(-3.8 * abs(g.y + 0.72 + skyPressure * 0.08));
      vec3 stormBlue = vec3(0.18, 0.54, 0.98);
      vec3 vaporWhite = vec3(0.78, 0.94, 1.0);
      return mix(stormBlue, vaporWhite, clamp(skyPressure + downwardPulse * 0.4, 0.0, 1.0))
        * (descendingVeil * 0.62 + pressureFront * 0.58 + downwardPulse * 0.72
          + rainAfterimage * 0.18 + horizonVapor * 0.28);
    }

    vec3 memoryBranches(vec2 p) {
      vec2 g = p;
      float phase = u_time * 0.48 + u_signal * 6.4;
      float growthNoise = fbm(g * 1.7 + vec2(phase * 0.09, -phase * 0.06));
      vec2 bloomSpace = rotate2d(growthNoise * 0.28 - 0.14) * g;
      float bloomRadius = length(bloomSpace * vec2(0.9, 1.04));
      float bloomAngle = atan(bloomSpace.y, bloomSpace.x);
      float fiveFoldMemory = 0.5 + 0.5 * cos(
        bloomAngle * 5.0 + sin(bloomAngle * 3.0 - phase * 0.16) * 1.35
          + growthNoise * 3.2 - phase * 0.22
      );
      float expandingField = fbm(
        bloomSpace * vec2(1.42, 1.08)
          + vec2(growthNoise * 0.38 + phase * 0.04, -phase * 0.14)
      );
      float openingWave = 0.5 + 0.5 * sin(
        (bloomSpace.y * 0.7 + growthNoise * 0.58) * 5.4
          - phase * 1.08 + fiveFoldMemory * 0.52
      );
      float petalResonance = smoothstep(0.46, 0.82, expandingField)
        * (0.42 + fiveFoldMemory * 0.34)
        * exp(-0.3 * bloomRadius);
      float bloomPulse = smoothstep(0.38, 0.84, openingWave)
        * (0.4 + expandingField * 0.6);
      float memoryPollen = starLayer(
        rotate2d(-0.18) * g - vec2(phase * 0.018, -phase * 0.012),
        24.0,
        173.0 + u_signal,
        0.975
      ) * smoothstep(0.18, 1.35, bloomRadius);
      float germinationLight = exp(-3.2 * dot(g * vec2(0.86, 1.0), g * vec2(0.86, 1.0)))
        * (0.72 + 0.28 * sin(phase * 1.4));
      vec3 roseMemory = vec3(1.0, 0.24, 0.62);
      vec3 pollenGold = vec3(1.0, 0.78, 0.34);
      vec3 ultraviolet = vec3(0.62, 0.34, 1.0);
      vec3 bloomColor = mix(roseMemory, ultraviolet, smoothstep(0.0, 1.35, bloomRadius));
      return bloomColor * (bloomPulse * 0.58 + petalResonance * 0.76 + germinationLight * 0.34)
        + pollenGold * memoryPollen * 0.74;
    }

    vec3 witnessConvergence(vec2 p) {
      vec2 g = p;
      float phase = u_time * 0.9 + u_signal * 6.0;
      float decisionNoise = fbm(g * 2.2 + vec2(phase * 0.08, -phase * 0.05));
      float trunk = softLine(abs(g.x + 0.04 * sin(g.y * 4.0 - phase)), 0.035)
        * smoothstep(-1.05, -0.08, g.y);
      float leftChoice = softLine(
        abs(g.y - 0.58 * abs(g.x) + 0.12 + 0.1 * sin(g.x * 4.2 + phase)),
        0.046
      ) * smoothstep(-0.02, 0.95, -g.x);
      float rightChoice = softLine(
        abs(g.y - 0.46 * abs(g.x) + 0.1 + 0.11 * sin(g.x * 3.8 - phase * 0.82)),
        0.046
      ) * smoothstep(-0.02, 0.95, g.x);
      float secondDecision = softLine(
        abs(g.y + 0.34 * abs(g.x) - 0.48 + decisionNoise * 0.14),
        0.04
      ) * smoothstep(0.18, 1.0, abs(g.x));
      float branchingPaths = trunk + leftChoice + rightChoice + secondDecision;
      float intervention = exp(-9.0 * (abs(g.x) + abs(g.y) * 0.72))
        * (0.74 + 0.26 * sin(phase * 2.2));
      float consequenceGlow = smoothstep(0.42, 0.8, decisionNoise)
        * smoothstep(0.08, 0.92, abs(g.x)) * 0.28;
      float choiceDust = starLayer(g + vec2(phase * 0.024, 0.0), 15.0, 117.0 + u_signal, 0.95);
      vec3 choiceCyan = vec3(0.38, 0.94, 1.0);
      vec3 choiceGold = vec3(1.0, 0.76, 0.34);
      return mix(choiceCyan, choiceGold, smoothstep(-0.9, 0.9, g.x))
        * (branchingPaths * 0.94 + intervention * 0.9 + consequenceGlow + choiceDust * 0.8);
    }

    vec3 presenceField(vec2 p, float speaker) {
      if (speaker < -0.5) return vec3(0.0);
      if (speaker < 0.5) return centralBreath(p);
      if (speaker < 1.5) return signalSurge(p);
      if (speaker < 2.5) return weaveStorm(p);
      if (speaker < 3.5) return tidalSurge(p);
      if (speaker < 4.5) return skyCurrent(p);
      if (speaker < 5.5) return memoryBranches(p);
      return witnessConvergence(p);
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / max(1.0, min(u_resolution.x, u_resolution.y));
      float aspect = u_resolution.x / max(1.0, u_resolution.y);
      p.x *= mix(1.0, 0.82, smoothstep(1.2, 2.2, aspect));
      p += u_pointer * vec2(0.035, 0.024);

      float scenePhase = u_scene * 0.71;
      float flowTime = u_time * AMBIENT_FLOW_SPEED;
      float breath = sin(u_time * AMBIENT_BREATH_SPEED + scenePhase * 0.73);
      float counterBreath = cos(u_time * AMBIENT_BREATH_SPEED * 0.71 - scenePhase * 0.38);
      vec2 breathingPoint = rotate2d(counterBreath * 0.014) * p * (1.0 + breath * 0.028);
      vec2 orbitalDrift = vec2(
        cos(scenePhase + flowTime * 0.72),
        sin(scenePhase * 1.37 - flowTime * 0.58)
      ) * 0.28;
      vec2 advection = vec2(
        flowTime * 0.72 + sin(flowTime * 0.64 + scenePhase) * 0.08,
        -flowTime * 0.46 + cos(flowTime * 0.53 - scenePhase) * 0.07
      );
      vec2 q = rotate2d(0.18 * sin(scenePhase) + breath * 0.02) * (breathingPoint + orbitalDrift);
      float cloud = fbm(q * 1.16 + advection);
      float detail = fbm(rotate2d(breath * 0.06) * q * 2.65 - advection * 1.18 + vec2(0.0, -scenePhase));
      float ridge = pow(max(0.0, 1.0 - abs(detail * 2.0 - 1.0)), 3.4);
      float veil = smoothstep(0.28, 0.9, cloud) * (0.52 + ridge * 0.62) * (0.96 + breath * 0.08);

      float edgeDistance = dot(q * vec2(0.72, 0.9), q * vec2(0.72, 0.9));
      float filamentNoise = fbm(q * 3.8 + advection * 0.52 + vec2(scenePhase, -flowTime * 0.22));
      float filament = softLine(
        abs(q.y * 0.58 + 0.22 * sin(q.x * 2.0 + filamentNoise * 3.8 + scenePhase + breath * 0.42)),
        0.055
      );

      vec3 color = u_color_a * (0.72 + 0.16 * (1.0 - min(1.0, edgeDistance)));
      color += u_color_b * veil * 0.72;
      color += mix(u_color_b, u_color_c, 0.62) * ridge * 0.38;
      color += mix(u_color_b, u_color_c, 0.4) * filament * (0.025 + 0.055 * detail);

      vec2 starDriftA = vec2(flowTime * 0.055, breath * 0.012);
      vec2 starDriftB = vec2(flowTime * 0.038, counterBreath * 0.01);
      vec2 starDriftC = vec2(breath * 0.006, -flowTime * 0.018);
      float stars = starLayer(p + starDriftA, 17.0, 7.0 + u_scene, 0.972);
      stars += starLayer(rotate2d(0.24) * p - starDriftB, 29.0, 19.0 + u_scene * 2.0, 0.982) * 0.72;
      stars += starLayer(rotate2d(-0.17) * p + starDriftC, 46.0, 41.0 + u_scene * 3.0, 0.988) * 0.5;
      color += mix(vec3(0.72, 0.88, 1.0), u_color_c, 0.32) * stars * 1.7;

      float presenceFadeOut = 1.0 - smoothstep(0.0, 0.58, u_speaker_mix);
      float presenceFadeIn = smoothstep(0.42, 1.0, u_speaker_mix);
      vec3 presence = presenceField(p, u_speaker_from) * u_speaker_from_gain * presenceFadeOut
        + presenceField(p, u_speaker_to) * presenceFadeIn;
      float presenceStrength = 1.34 + u_emphasis * 0.48;
      color += presence * presenceStrength;

      float dust = hash21(gl_FragCoord.xy + floor(u_time * 0.12)) - 0.5;
      color += dust * 0.012;
      float vignette = 1.0 - smoothstep(0.28, 1.62, length(p * vec2(0.68, 0.86)));
      color *= 0.68 + vignette * 0.58;
      color = vec3(1.0) - exp(-color * 1.42);
      color = pow(max(color, 0.0), vec3(0.84));
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const colorToRgb = (hex) => {
    const value = Number.parseInt(String(hex).replace("#", ""), 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
  };

  const paletteFor = (name) => {
    const scene = SCENES[name] || DEFAULT_SCENE;
    return {
      index: scene.index,
      colors: scene.colors.map(colorToRgb),
    };
  };

  const presenceFor = (name) => PRESENCES[name] || DEFAULT_PRESENCE;

  const signalFor = (value) => {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  };

  const createFallback = (canvas) => {
    canvas.classList.add("is-fallback");
    canvas.dataset.webglState = "fallback";
    return Object.freeze({
      active: false,
      setScene(name) {
        canvas.dataset.webglScene = name || "awakening";
        return Promise.resolve({ cancelled: false });
      },
      setPresence(name, { emphasis = false, signal = "" } = {}) {
        const presence = presenceFor(name);
        canvas.dataset.webglSpeaker = PRESENCES[name] ? name : "narrator";
        canvas.dataset.webglManifestation = presence.manifestation;
        canvas.dataset.webglSignal = signalFor(signal).toFixed(6);
        canvas.dataset.webglEmphasis = emphasis ? "true" : "false";
        canvas.dataset.webglPresenceMix = "1.0000";
        canvas.dataset.webglPresenceState = "steady";
        canvas.dataset.webglPresenceDuration = "0";
        canvas.dataset.webglPresenceCompletedAt = performance.now().toFixed(3);
        return Promise.resolve({ changed: false, cancelled: false });
      },
      destroy() {},
    });
  };

  const create = ({ canvas, shell, onRestore } = {}) => {
    if (!(canvas instanceof HTMLCanvasElement) || !(shell instanceof HTMLElement)) return null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let gl;
    try {
      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      });
    } catch {
      gl = null;
    }
    if (!gl) return createFallback(canvas);

    const highPrecision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision > 0;
    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
      gl.deleteShader(shader);
      return null;
    };
    const vertex = compileShader(gl.VERTEX_SHADER, VERTEX_SOURCE);
    const fragment = compileShader(gl.FRAGMENT_SHADER, `precision ${highPrecision ? "highp" : "mediump"} float;\n${FRAGMENT_BODY}`);
    if (!vertex || !fragment) return createFallback(canvas);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return createFallback(canvas);
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries([
      "u_resolution", "u_pointer", "u_time", "u_scene", "u_speaker_from", "u_speaker_from_gain", "u_speaker_to",
      "u_speaker_mix", "u_signal", "u_emphasis", "u_color_a", "u_color_b", "u_color_c",
    ].map((name) => [name, gl.getUniformLocation(program, name)]));

    let destroyed = false;
    let frame = 0;
    let raf = 0;
    let lastRenderedAt = 0;
    let pointer = [0, 0];
    let pointerTarget = [0, 0];
    let current = paletteFor("awakening");
    let fromColors = current.colors.map((color) => [...color]);
    let target = current;
    let transitionStartedAt = performance.now();
    const transitionDuration = 1200;
    let presenceFrom = -1;
    let presenceTarget = -1;
    let presenceFromGain = 1;
    const defaultPresenceTransitionDuration = 380;
    const aivaFadeOutDuration = 760;
    let presenceTransitionDuration = defaultPresenceTransitionDuration;
    // Count only rendered time. A stalled frame must not consume the whole
    // fade while the outgoing character is still the last image on screen.
    const maxPresenceFrameDelta = 50;
    let presenceTransitionElapsed = 0;
    let presenceLastRenderedAt = null;
    let presenceSignalFrom = 0;
    let presenceSignalTarget = 0;
    let presenceEmphasisFrom = 0;
    let presenceEmphasisTarget = 0;
    let presenceSignalStartedAt = performance.now();
    const presenceSignalDuration = 520;
    let presenceCompletionResolve = null;
    let presenceCompletionPromise = null;
    let sceneCompletionResolve = null;
    const constrainedByDevice = (Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 4)
      || (Number(navigator.hardwareConcurrency) > 0 && Number(navigator.hardwareConcurrency) <= 4);
    let qualityTier = constrainedByDevice ? "low" : "normal";
    let qualityChangedAt = performance.now();
    let frameDeltas = [];

    const qualityProfile = () => {
      const mobile = innerWidth <= 720;
      if (qualityTier === "low") {
        return { quality: mobile ? 0.48 : 0.52, dprCap: mobile ? 1 : 1.25, fps: mobile ? 15 : 18 };
      }
      return { quality: mobile ? 0.68 : 0.72, dprCap: mobile ? 1.25 : 1.6, fps: mobile ? 20 : 24 };
    };

    const setQualityTier = (nextTier, reason) => {
      if (qualityTier === nextTier) return;
      qualityTier = nextTier;
      qualityChangedAt = performance.now();
      frameDeltas = [];
      canvas.dataset.webglQuality = qualityTier;
      canvas.dataset.webglQualityReason = reason;
      resize();
    };

    const adaptQuality = (now) => {
      if (reducedMotion.matches) return;
      if (frameDeltas.length < 45) return;
      const sorted = frameDeltas.slice().sort((left, right) => left - right);
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || 0;
      canvas.dataset.webglFrameP95 = p95.toFixed(2);
      if (qualityTier === "normal" && p95 > 78) {
        setQualityTier("low", "runtime-frame-p95");
      } else if (
        qualityTier === "low"
        && !constrainedByDevice
        && now - qualityChangedAt >= 15000
        && p95 < 86
      ) {
        setQualityTier("normal", "runtime-recovered");
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const profile = qualityProfile();
      const ratio = Math.min(devicePixelRatio || 1, profile.dprCap, globalThis.GaiaFrameBudgetGovernor?.getDprCap?.() || Infinity) * profile.quality;
      const targetWidth = Math.max(2, rect.width * ratio);
      const targetHeight = Math.max(2, rect.height * ratio);
      const renderScale = Math.min(1, 1440 / targetWidth, 900 / targetHeight);
      const width = Math.max(2, Math.round(targetWidth * renderScale));
      const height = Math.max(2, Math.round(targetHeight * renderScale));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };

    const paletteAt = (now) => {
      const progress = reducedMotion.matches ? 1 : Math.min(1, (now - transitionStartedAt) / transitionDuration);
      const eased = progress * progress * (3 - 2 * progress);
      const colors = fromColors.map((color, colorIndex) => color.map((channel, channelIndex) => (
        channel + (target.colors[colorIndex][channelIndex] - channel) * eased
      )));
      if (progress >= 1) {
        current = target;
        fromColors = target.colors.map((color) => [...color]);
      }
      return colors;
    };

    const smoothProgress = (now, startedAt, duration) => {
      const progress = reducedMotion.matches ? 1 : Math.min(1, Math.max(0, (now - startedAt) / duration));
      return progress * progress * (3 - 2 * progress);
    };

    const presenceStateAt = () => {
      const mix = smoothProgress(presenceTransitionElapsed, 0, presenceTransitionDuration);
      return {
        mix,
        fromGain: presenceFromGain * (1 - smoothProgress(mix, 0, 0.58)),
        targetGain: smoothProgress(mix, 0.42, 0.58),
      };
    };

    const advancePresenceFrame = (now) => {
      if (reducedMotion.matches) presenceTransitionElapsed = presenceTransitionDuration;
      else if (presenceLastRenderedAt !== null) {
        const delta = Math.min(maxPresenceFrameDelta, Math.max(0, now - presenceLastRenderedAt));
        presenceTransitionElapsed = Math.min(presenceTransitionDuration, presenceTransitionElapsed + delta);
      }
      presenceLastRenderedAt = now;
    };

    const signalStateAt = (now) => {
      const mix = smoothProgress(now, presenceSignalStartedAt, presenceSignalDuration);
      return {
        signal: presenceSignalFrom + (presenceSignalTarget - presenceSignalFrom) * mix,
        emphasis: presenceEmphasisFrom + (presenceEmphasisTarget - presenceEmphasisFrom) * mix,
      };
    };

    const settlePresenceTransition = (cancelled = false) => {
      const resolve = presenceCompletionResolve;
      presenceCompletionResolve = null;
      presenceCompletionPromise = null;
      resolve?.({ changed: true, cancelled });
    };

    const settleSceneDraw = (cancelled = false) => {
      const resolve = sceneCompletionResolve;
      sceneCompletionResolve = null;
      resolve?.({ cancelled });
    };

    const syncPresenceStatus = ({ drawn = false } = {}) => {
      const state = presenceStateAt();
      canvas.dataset.webglPresenceMix = state.mix.toFixed(4);
      canvas.dataset.webglPresenceState = state.mix < 0.9999 ? "fading" : "steady";
      if (drawn && state.mix >= 0.9999 && presenceCompletionResolve) {
        canvas.dataset.webglPresenceCompletedAt = performance.now().toFixed(3);
        settlePresenceTransition(false);
      }
      return state;
    };

    const draw = (now = performance.now()) => {
      if (destroyed || gl.isContextLost()) return;
      const frameInterval = 1000 / qualityProfile().fps;
      if (!reducedMotion.matches && lastRenderedAt > 0 && now - lastRenderedAt < frameInterval) {
        raf = requestAnimationFrame(draw);
        return;
      }
      if (!reducedMotion.matches && lastRenderedAt > 0) {
        frameDeltas.push(now - lastRenderedAt);
        if (frameDeltas.length > 90) frameDeltas.shift();
      }
      lastRenderedAt = now;
      advancePresenceFrame(now);
      resize();
      pointer[0] += (pointerTarget[0] - pointer[0]) * 0.035;
      pointer[1] += (pointerTarget[1] - pointer[1]) * 0.035;
      const colors = paletteAt(now);
      gl.useProgram(program);
      gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.u_pointer, pointer[0], pointer[1]);
      gl.uniform1f(uniforms.u_time, reducedMotion.matches ? 24 + target.index * 3.7 : now * 0.001);
      gl.uniform1f(uniforms.u_scene, target.index);
      const presenceState = presenceStateAt();
      const signalState = signalStateAt(now);
      gl.uniform1f(uniforms.u_speaker_from, presenceFrom);
      gl.uniform1f(uniforms.u_speaker_from_gain, presenceFromGain);
      gl.uniform1f(uniforms.u_speaker_to, presenceTarget);
      gl.uniform1f(uniforms.u_speaker_mix, presenceState.mix);
      gl.uniform1f(uniforms.u_signal, signalState.signal);
      gl.uniform1f(uniforms.u_emphasis, signalState.emphasis);
      gl.uniform3fv(uniforms.u_color_a, colors[0]);
      gl.uniform3fv(uniforms.u_color_b, colors[1]);
      gl.uniform3fv(uniforms.u_color_c, colors[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frame += 1;
      if (frame % 30 === 0) adaptQuality(now);
      canvas.dataset.webglFrame = String(frame);
      if (sceneCompletionResolve) settleSceneDraw(false);
      syncPresenceStatus({ drawn: true });
      if (!reducedMotion.matches && !document.hidden) raf = requestAnimationFrame(draw);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (!document.hidden) draw();
    };
    const scheduleStaticDraw = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (!document.hidden) raf = requestAnimationFrame((now) => {
        raf = 0;
        draw(now);
      });
    };
    const onPointerMove = (event) => {
      pointerTarget = [event.clientX / Math.max(1, innerWidth) - 0.5, 0.5 - event.clientY / Math.max(1, innerHeight)];
    };
    const onVisibilityChange = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      presenceLastRenderedAt = null;
      if (!document.hidden) {
        draw();
      }
    };
    const onMotionChange = () => start();
    const onContextLost = (event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      raf = 0;
      canvas.dataset.webglState = "lost";
      canvas.classList.add("is-fallback");
      settlePresenceTransition(true);
      settleSceneDraw(true);
      globalThis.GaiaFrameBudgetGovernor?.reportFailure?.("context-lost");
    };
    const onContextRestored = () => {
      canvas.dataset.webglState = "restoring";
      if (typeof onRestore === "function") onRestore();
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => start()) : null;
    observer?.observe(canvas);
    if (!observer) window.addEventListener("resize", start, { passive: true });
    shell.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.addEventListener?.("change", onMotionChange);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    canvas.dataset.webglState = "active";
    canvas.dataset.webglScene = "awakening";
    canvas.dataset.webglSpeaker = "narrator";
    canvas.dataset.webglManifestation = DEFAULT_PRESENCE.manifestation;
    canvas.dataset.webglSignal = "0.000000";
    canvas.dataset.webglEmphasis = "false";
    canvas.dataset.webglPresenceMix = "0.0000";
    canvas.dataset.webglPresenceState = "hidden";
    canvas.dataset.webglPresenceDuration = String(presenceTransitionDuration);
    canvas.dataset.webglAmbientMotion = "drift-breathe-parallax";
    canvas.dataset.webglQuality = qualityTier;
    canvas.dataset.webglQualityReason = constrainedByDevice ? "device-capability" : "default";
    start();

    return Object.freeze({
      active: true,
      setScene(name, { immediate = false } = {}) {
        if (destroyed || gl.isContextLost()) return Promise.resolve({ cancelled: true });
        settleSceneDraw(true);
        const next = paletteFor(name);
        const now = performance.now();
        fromColors = immediate ? next.colors.map((color) => [...color]) : paletteAt(now).map((color) => [...color]);
        target = next;
        if (immediate) current = next;
        transitionStartedAt = immediate ? now - transitionDuration : now;
        canvas.dataset.webglScene = SCENES[name] ? name : "awakening";
        canvas.dataset.webglSceneIndex = String(next.index);
        const completion = new Promise((resolve) => { sceneCompletionResolve = resolve; });
        if (reducedMotion.matches) scheduleStaticDraw();
        else start();
        return completion;
      },
      setPresence(name, { emphasis = false, signal = "", immediate = false } = {}) {
        if (destroyed || gl.isContextLost()) return Promise.resolve({ changed: false, cancelled: true });
        const next = presenceFor(name);
        const now = performance.now();
        const shouldJump = immediate || reducedMotion.matches;
        const currentPresence = presenceStateAt();
        const currentSignal = signalStateAt(now);
        const isSamePresence = presenceTarget === next.index;
        if (shouldJump || !isSamePresence) settlePresenceTransition(true);
        if (shouldJump) {
          presenceTransitionDuration = defaultPresenceTransitionDuration;
          presenceFrom = next.index;
          presenceTarget = next.index;
          presenceFromGain = 1;
          presenceTransitionElapsed = presenceTransitionDuration;
          presenceLastRenderedAt = null;
        } else if (!isSamePresence) {
          const sourceIsTarget = currentPresence.targetGain >= currentPresence.fromGain;
          const sourcePresence = sourceIsTarget ? presenceTarget : presenceFrom;
          presenceTransitionDuration = sourcePresence === PRESENCES.system.index
            ? aivaFadeOutDuration
            : defaultPresenceTransitionDuration;
          presenceFrom = sourcePresence;
          presenceFromGain = Math.max(currentPresence.targetGain, currentPresence.fromGain);
          presenceTarget = next.index;
          presenceTransitionElapsed = 0;
          presenceLastRenderedAt = null;
        }
        presenceSignalFrom = shouldJump ? signalFor(signal) : currentSignal.signal;
        presenceSignalTarget = signalFor(signal);
        presenceEmphasisFrom = shouldJump ? (emphasis ? 1 : 0) : currentSignal.emphasis;
        presenceEmphasisTarget = emphasis ? 1 : 0;
        presenceSignalStartedAt = shouldJump ? now - presenceSignalDuration : now;
        canvas.dataset.webglSpeaker = PRESENCES[name] ? name : "narrator";
        canvas.dataset.webglManifestation = next.manifestation;
        canvas.dataset.webglSignal = presenceSignalTarget.toFixed(6);
        canvas.dataset.webglEmphasis = emphasis ? "true" : "false";
        canvas.dataset.webglPresenceDuration = String(presenceTransitionDuration);
        if (shouldJump || !isSamePresence) {
          delete canvas.dataset.webglPresenceCompletedAt;
          presenceCompletionPromise = new Promise((resolve) => {
            presenceCompletionResolve = ({ cancelled }) => resolve({ changed: !shouldJump && !isSamePresence, cancelled });
          });
        }
        // A repeated request for an in-flight speaker shares its draw completion;
        // it must not cancel the fade or let the next dialogue commit early.
        const completion = presenceCompletionPromise || Promise.resolve({ changed: false, cancelled: false });
        syncPresenceStatus();
        if (reducedMotion.matches) scheduleStaticDraw();
        else start();
        return completion;
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        cancelAnimationFrame(raf);
        settlePresenceTransition(true);
        settleSceneDraw(true);
        observer?.disconnect();
        if (!observer) window.removeEventListener("resize", start);
        shell.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        reducedMotion.removeEventListener?.("change", onMotionChange);
        canvas.removeEventListener("webglcontextlost", onContextLost);
        canvas.removeEventListener("webglcontextrestored", onContextRestored);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
      },
    });
  };

  globalThis.GaiaTrueEndWebGL = Object.freeze({ create });
})();
