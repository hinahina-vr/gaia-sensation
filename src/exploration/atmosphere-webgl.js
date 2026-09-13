import { EARTH_CENTER_LONGITUDE } from "./world-projection.js?v=gaia-japan-center-1";

const VERTEX = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }`;
const FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform vec2 resolution;
uniform vec3 geoView;
uniform float time;
uniform int mode;
uniform float ready;
uniform sampler2D scalarField;
uniform sampler2D vectorField;
uniform sampler3D grainMap;
uniform sampler2D cloudReference;
uniform float cloudReady;
out vec4 color;
float grain(vec3 p) { return texture(grainMap, p / 32.).r; }
float clouds(vec3 p) {
  return grain(p) * .53 + grain(p * 2.03 + 13.7) * .27
    + grain(p * 4.11 - 8.3) * .13 + grain(p * 8.17 + 4.9) * .07;
}
// Smooth the voxel interpolation for a diffuse veil without gritty edges.
float cloudNoise(vec3 p) {
  vec3 cell = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return texture(grainMap, (cell + f + .5) / 32.).r;
}
float cloudMass(vec3 p) {
  return cloudNoise(p) * .64 + cloudNoise(p * 2.01 + 13.7) * .28
    + cloudNoise(p * 3.97 - 8.3) * .08;
}
void main() {
  vec2 p = (gl_FragCoord.xy * 2. - resolution) / resolution.y;
  vec2 geo = geoView.xy + p * geoView.z;
  if (abs(geo.y) > 90.) { color = vec4(0.); return; }
  vec2 uv = (geo + vec2(180., 90.)) / vec2(360., 180.);
  vec4 value = texture(scalarField, uv);
  vec4 wind = texture(vectorField, uv);
  // Spherical coordinates make the texture continuous at the date-line.
  vec2 angle = radians(geo);
  vec3 sphere = vec3(cos(angle.y) * cos(angle.x), sin(angle.y), cos(angle.y) * sin(angle.x));
  vec3 q = sphere * 12.;
  vec3 drift = vec3(time * .018, time * -.007, time * .004);
  if (mode == 0) {
    float speed = clamp(length(wind.xy) / 18., 0., 1.);
    vec3 east = vec3(-sin(angle.x), 0., cos(angle.x));
    vec3 north = vec3(-sin(angle.y) * cos(angle.x), cos(angle.y), -sin(angle.y) * sin(angle.x));
    vec3 flow = (east * wind.x + north * wind.y) / max(18., length(wind.xy));
    // Sparse elongated streaks follow the interpolated wind, not cloud masses.
    // Two advected phases crossfade to avoid a jump when particles wrap.
    vec3 direction = normalize(flow + east * .0001);
    vec3 base = sphere * 110. + vec3(3.7, 8.2, 1.4);
    float phase = fract(time * .16);
    float streakA = 0., streakB = 0.;
    for (int i = 0; i < 12; i++) {
      float tail = float(i) * .28;
      float weight = 1. - float(i) / 12.;
      vec3 offset = direction * tail;
      float a = cloudNoise(base - direction * phase * (5. + speed * 8.) + offset);
      float b = cloudNoise(base - direction * fract(phase + .5) * (5. + speed * 8.) + offset);
      streakA = max(streakA, smoothstep(.76, .92, a) * weight);
      streakB = max(streakB, smoothstep(.76, .92, b) * weight);
    }
    float streak = mix(streakA, streakB, abs(phase * 2. - 1.));
    // Atmospheric color, not a classified scale: teal -> soft gold -> coral.
    // The interpolated scalar speed survives opposing wind vectors cancelling;
    // keep the existing directional motion and opacity independent of this tint.
    float tintSpeed = max(0., wind.w);
    vec3 ink = mix(vec3(.36,.72,.78), vec3(.91,.80,.47), smoothstep(1., 8., tintSpeed));
    ink = mix(ink, vec3(.96,.46,.38), smoothstep(8., 18., tintSpeed));
    color = vec4(ink, min(.7, streak * (.42 + speed * .35)) * ready);
  } else if (mode == 1) {
    float haze = max(0., value.a), pm = clamp(value.b, 0., 2.);
    float rolling = clouds(q * .57 + drift);
    float wisps = clouds(q * 1.7 + drift * 1.25 + rolling * 2.);
    float extinction = 1. - exp(-haze * (1.3 + rolling * 3.5));
    float opacity = extinction * (.37 + wisps * .54);
    vec3 ink = mix(vec3(.38,.47,.61), vec3(.72,.58,.53), clamp(pm * .52, 0., 1.));
    ink += pow(wisps, 3.) * vec3(.21,.17,.24);
    color = vec4(ink, min(.72, opacity) * ready);
  } else {
    float cover = clamp(value.r, 0., 1.);
    float sun = clamp(value.g, 0., 1.);
    // NASA Blue Marble's archived composite supplies cloud SHAPE only.
    // Model cloud cover / radiation modulate its opacity / light, not its
    // geography. The exhibit labels this as reference, not live imagery.
    // Keep the feathery edges and clear ocean intact; no noise threshold,
    // swollen banks, rim lighting, or warping into artificial clumps.
    vec2 referenceUv = vec2(uv.x + sin(time * .035) * .0015, 1. - uv.y);
    float luminance = texture(cloudReference, referenceUv).r;
    float veil = pow(smoothstep(.025, .96, luminance), 1.15);
    float alpha = .46 * sqrt(cover) * veil;
    vec3 shade = mix(vec3(.64,.74,.82), vec3(.89,.94,.96), luminance);
    shade += sun * vec3(.035,.024,.008);
    color = vec4(shade, alpha * ready * cloudReady);
  }
}`;

export function createAtmosphereRenderer(canvas) {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, depth: false,
    premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) return null;
  const shader = (type, source) => {
    const result = gl.createShader(type);
    gl.shaderSource(result, source); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
    return result;
  };
  const vertex = shader(gl.VERTEX_SHADER, VERTEX), fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  const attribute = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(["resolution", "geoView", "time", "mode", "ready",
    "scalarField", "vectorField", "grainMap", "cloudReference", "cloudReady"].map(key => [key, gl.getUniformLocation(program, key)]));
  const textures = Array.from({ length: 4 }, (_, unit) => {
    const target = unit === 2 ? gl.TEXTURE_3D : gl.TEXTURE_2D;
    const texture = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target, texture);
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, unit === 2 ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    if (unit === 2) gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.REPEAT);
    else gl.texImage2D(target, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    return texture;
  });
  const upload = (unit, data, width, height, floating = false) => {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, textures[unit]);
    gl.texImage2D(gl.TEXTURE_2D, 0, floating ? gl.RGBA16F : gl.RGBA, width, height, 0,
      gl.RGBA, floating ? gl.FLOAT : gl.UNSIGNED_BYTE, data);
  };
  const noise = new Uint8Array(32 * 32 * 32);
  let seed = 8173;
  for (let i = 0; i < noise.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    noise[i] = seed >>> 24;
  }
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_3D, textures[2]);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, 32, 32, 32, 0, gl.RED, gl.UNSIGNED_BYTE, noise);
  const cache = new Map();
  let activeKey = null, worker = null, readyAt = Infinity, selectedMode = 0;
  let lastStaticView = "";
  let cloudReadyAt = Infinity, cloudRequested = false, contextLost = false;
  const loadCloudReference = () => {
    if (cloudRequested) return;
    cloudRequested = true;
    canvas.dataset.cloudTextureState = "loading";
    const image = new Image();
    image.onload = () => {
      // A restored context gets a new renderer; never upload into the old one.
      if (contextLost || gl.isContextLost()) return;
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, textures[3]);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      cloudReadyAt = performance.now();
      canvas.dataset.cloudTextureState = "ready";
      canvas.dataset.cloudTextureSize = `${image.naturalWidth}x${image.naturalHeight}`;
      canvas.dispatchEvent(new CustomEvent("gaia:cloud-reference-state"));
    };
    image.onerror = () => {
      if (contextLost) return;
      // The transparent initial texture leaves the map and measured POIs usable.
      canvas.dataset.cloudTextureState = "unavailable";
      canvas.dispatchEvent(new CustomEvent("gaia:cloud-reference-state"));
    };
    image.src = new URL("../../assets/maps/nasa-blue-marble-clouds-2048.jpg", import.meta.url).href;
  };
  const install = (entry) => {
    upload(0, entry.field.scalar, entry.field.width, entry.field.height, true);
    upload(1, entry.field.vector, entry.field.width, entry.field.height, true);
    readyAt = performance.now();
    canvas.dataset.fieldState = "ready";
    canvas.dataset.sourceCount = String(entry.field.sourceCount);
    canvas.dataset.fieldBuildMs = entry.buildMs.toFixed(1);
  };
  const setData = (kind, data) => {
    selectedMode = kind === "wind" ? 0 : kind === "air" ? 1 : 2;
    const key = `${kind === "air" ? "air" : "atmosphere"}:${data.sourceState === "SAVED VALUES"}:${data.observedAt}`;
    canvas.dataset.atmosphereMode = kind;
    canvas.dataset.cloudStyle = "satellite-reference-clouds";
    canvas.dataset.windStyle = "directional-wind-streaks";
    if (kind === "cloud") loadCloudReference();
    if (key === activeKey) return;
    activeKey = key; readyAt = Infinity;
    worker?.terminate(); worker = null;
    if (cache.has(key)) {
      install(cache.get(key));
      return;
    }
    canvas.dataset.fieldState = "building";
    try {
      worker = new Worker(new URL("./atmosphere-field-worker.js?v=gaia-luminous-veil-1", import.meta.url), { type: "module" });
    } catch { canvas.dataset.fieldState = "unavailable"; return; }
    const currentWorker = worker;
    currentWorker.onmessage = ({ data: result }) => {
      if (result.key !== activeKey) return;
      if (cache.size >= 3) cache.delete(cache.keys().next().value);
      cache.set(key, result); install(result);
      canvas.dataset.fieldBuilds = String((Number(canvas.dataset.fieldBuilds) || 0) + 1);
      currentWorker.terminate();
      if (worker === currentWorker) worker = null;
    };
    currentWorker.onerror = () => { canvas.dataset.fieldState = "unavailable"; currentWorker.terminate(); worker = null; };
    currentWorker.postMessage({ points: data.points, kind, key });
  };
  const render = (timestamp, view, reducedMotion) => {
    if (contextLost || gl.isContextLost()) return false;
    const maxPixels = view.rect.width < 720 ? 300000 : 760000;
    const scale = Math.min(1, Math.sqrt(maxPixels / (view.rect.width * view.rect.height)));
    const width = Math.max(1, Math.round(view.rect.width * scale)), height = Math.max(1, Math.round(view.rect.height * scale));
    // Reduced-motion mode needs no identical GPU work once the reveal settles.
    const revealAt = selectedMode === 2 && Number.isFinite(cloudReadyAt) ? Math.max(readyAt, cloudReadyAt) : readyAt;
    const staticView = [width, height, view.originX, view.originY, view.scale, selectedMode, revealAt].join(":");
    const settled = timestamp > revealAt + 700;
    if (reducedMotion && settled && staticView === lastStaticView) return true;
    lastStaticView = reducedMotion && settled ? staticView : "";
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height); gl.useProgram(program);
    for (let i = 0; i < textures.length; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(i === 2 ? gl.TEXTURE_3D : gl.TEXTURE_2D, textures[i]); }
    ["scalarField", "vectorField", "grainMap", "cloudReference"].forEach((name, i) => gl.uniform1i(uniforms[name], i));
    gl.uniform2f(uniforms.resolution, width, height);
    gl.uniform3f(uniforms.geoView, (view.rect.width / 2 - view.originX) / view.scale + EARTH_CENTER_LONGITUDE - 180,
      90 - (view.rect.height / 2 - view.originY) / view.scale, view.rect.height / (2 * view.scale));
    gl.uniform1f(uniforms.time, reducedMotion ? 0 : timestamp / 1000);
    gl.uniform1i(uniforms.mode, selectedMode);
    gl.uniform1f(uniforms.ready, Math.max(0, Math.min(1, (timestamp - readyAt) / 700)));
    gl.uniform1f(uniforms.cloudReady, Math.max(0, Math.min(1, (timestamp - cloudReadyAt) / 700)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.dataset.draws = String((Number(canvas.dataset.draws) || 0) + 1);
    return true;
  };
  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    contextLost = true;
    worker?.terminate(); worker = null; activeKey = null;
    canvas.dataset.fieldState = "context-lost";
  });
  return { setData, render, suspend() { worker?.terminate(); worker = null; activeKey = null; } };
}
