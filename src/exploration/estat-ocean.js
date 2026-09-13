// Decorative currents for the statistical exhibits, not measured ocean vectors.
export const ESTAT_OCEAN_GLSL = `
  uniform sampler2D u_ocean_land;
  uniform vec4 u_geo_view;
  uniform float u_ocean_ready;

  vec3 ocean_silk(vec2 uv, float time) {
    vec2 geo = vec2(u_geo_view.x + uv.x * u_geo_view.z,
      u_geo_view.y - (1.0 - uv.y) * u_geo_view.w);
    vec2 land_uv = vec2(fract((geo.x + 180.0) / 360.0), clamp((90.0 - geo.y) / 180.0, 0.0, 1.0));
    float ocean = (1.0 - smoothstep(0.05, 0.45, texture(u_ocean_land, land_uv).r)) * u_ocean_ready;
    vec2 p = vec2((geo.x - 138.0) * 0.82, geo.y - 34.0) * 0.07;
    // Soft counter-currents bend the field into large, open eddies. They remain
    // geographically anchored under zoom/pan; the light travels along the folds.
    vec2 d = p - vec2(1.35, -0.45);
    float turn = 1.8 * exp(-dot(d, d) * 0.34);
    p += vec2(-d.y, d.x) * turn;
    vec2 q = p + 0.38 * vec2(sin(p.y * 1.8 + time * 0.10), cos(p.x * 1.3 - time * 0.08));
    q += 0.19 * vec2(sin(q.y * 3.1 + q.x), sin(q.x * 2.0 - q.y));
    float theme = float(u_theme);
    float flow = q.y * 1.55 + q.x * 0.48 + sin(q.x * 1.8 - q.y * 0.6) * 0.28;
    float travel = q.x * 4.4 - time * 0.95 + flow * 1.9;
    if (u_theme == 2 || u_theme == 3 || u_theme == 4) {
      flow = q.x * 1.35 + sin(q.y * 1.8 + time * 0.10) * 0.38;
      travel = q.y * 5.1 - time * 1.0 + flow * 2.5;
    }
    float wave = flow * 6.2831853 - time * 0.13;
    float broad = pow(0.5 + 0.5 * cos(wave), 3.0);
    float ridge = pow(0.5 + 0.5 * cos(wave), 24.0);
    float threads = pow(0.5 + 0.5 * cos(wave * 3.0 + q.x * 0.65), 32.0) * broad;
    float traveller = pow(0.5 + 0.5 * cos(travel), 14.0);
    float depth = 0.55 + 0.45 * sin(q.x * 0.72 + q.y * 0.3 + theme * 0.4);
    vec3 deep = mix(vec3(0.022, 0.18, 0.34), u_accent * 0.25, 0.26);
    vec3 crest = mix(u_accent, vec3(0.65, 0.96, 1.0), 0.26);
    vec3 second = mix(u_secondary, vec3(0.30, 0.65, 0.85), 0.38);
    if (u_theme == 1 || u_theme == 7) {
      deep = vec3(0.11, 0.08, 0.16);
      crest = mix(u_accent, vec3(1.0, 0.92, 0.71), 0.42);
    } else if (u_theme == 3 || u_theme == 4) {
      deep = vec3(0.21, 0.055, 0.08);
    } else if (u_theme == 5) {
      deep = vec3(0.06, 0.12, 0.27);
      crest = vec3(0.63, 0.83, 1.0);
    }
    float softness = u_theme == 6 ? 1.45 : 1.0;
    vec3 color = deep * broad * 0.40 * softness;
    color += mix(second, crest, depth) * ridge * (0.17 + traveller * 0.38);
    color += crest * threads * (0.08 + traveller * 0.19);
    color += crest * broad * traveller * 0.052;
    // Keep the frame stable: spatial advection, never a synchronized flash.
    float edge = smoothstep(0.0, 0.09, uv.y) * (1.0 - smoothstep(0.90, 1.0, uv.y));
    return color * ocean * edge;
  }
`;

let landPromise;
const getLand = () => landPromise ||= fetch(new URL("../../data/natural-earth-50m-land.geojson", import.meta.url), { cache: "force-cache" })
  .then(response => {
    if (!response.ok) throw new Error(`Ocean land mask HTTP ${response.status}`);
    return response.json();
  });

export const createOceanMask = (gl) => {
  const texture = gl.createTexture();
  let disposed = false;
  const mask = { texture, ready: false, state: "loading", error: "", dispose: () => {
    disposed = true;
    if (!gl.isContextLost()) gl.deleteTexture(texture);
  } };
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Fail closed: without land geometry no decorative current covers data areas.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  void getLand().then(geojson => {
    if (disposed) return;
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1.1;
    const features = geojson.type === "FeatureCollection" ? geojson.features : [geojson];
    let count = 0;
    for (const feature of features) {
      const geometry = feature.geometry || feature;
      const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
      for (const polygon of polygons) {
        ctx.beginPath();
        for (const ring of polygon) {
          ring.forEach(([lon, lat], i) => {
            const x = (lon + 180) / 360 * canvas.width;
            const y = (90 - lat) / 180 * canvas.height;
            if (!i) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
        ctx.fill("evenodd");
        ctx.stroke();
        count++;
      }
    }
    if (!count) throw new Error("Ocean land mask has no polygons");
    if (disposed || gl.isContextLost()) { mask.state = "context-lost"; return; }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    mask.ready = true;
    mask.state = "ready";
  }).catch(error => { mask.state = "unavailable"; mask.error = String(error.message || error); });
  return mask;
};
