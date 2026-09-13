export const FIRE_REVEAL_EDGE = .018;
export const FIRE_COLUMN_LIFETIME = 1.7;
export const FIRE_COLUMN_LIMIT = 64;
export const FIRE_COLUMN_MOBILE_LIMIT = 24;

// Leave room for the final observation's reveal envelope to finish at 100%.
export const fireSequence = (index, count) => count > 1 ? index / (count - 1) * (1 - FIRE_REVEAL_EDGE) : 0;
export const inverseFireEase = (value) => {
  const target = Math.max(0, Math.min(1, value));
  let low = 0, high = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (mid * mid * (3 - 2 * mid) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
};

export const FIRE_COLUMN_VERTEX = `
  attribute vec4 a_positionData;
  attribute vec3 a_meta;
  uniform vec2 u_cssSize;
  uniform vec2 u_origin;
  uniform float u_scale;
  uniform float u_renderScale;
  uniform float u_markerScale;
  uniform float u_clock;
  varying float v_age;
  varying float v_heat;
  varying vec3 v_meta;
  void main() {
    float side = (76.0 + a_positionData.z * 70.0) * u_markerScale;
    float x = u_origin.x + a_positionData.x * u_scale;
    // The foot at sprite y=.85 stays on the exact geographic observation.
    float y = u_origin.y + (90.0 - a_positionData.y) * u_scale - side * .35;
    gl_Position = vec4(x / u_cssSize.x * 2.0 - 1.0, 1.0 - y / u_cssSize.y * 2.0, 0.0, 1.0);
    gl_PointSize = side * u_renderScale;
    v_age = u_clock - a_positionData.w;
    v_heat = a_positionData.z;
    v_meta = a_meta;
  }
`;

export const FIRE_COLUMN_FRAGMENT = `
  precision mediump float;
  varying float v_age;
  varying float v_heat;
  varying vec3 v_meta;
  void main() {
    vec2 uv = gl_PointCoord;
    float age = v_age;
    float seed = v_meta.z * 31.0;
    float rise = smoothstep(0.0, .2, age);
    float fade = 1.0 - smoothstep(.65, 1.7, age);
    float height = .85 - uv.y;
    float flameHeight = .7 * rise * (.5 + .5 * fade);
    float t = max(0.0, height) / max(.005, flameHeight);
    float sway = sin(t * 9.0 - age * 7.0 + seed) * .019 * t
      + sin(t * 19.0 - age * 11.0 + seed * 2.0) * .007 * t;
    float x = uv.x - .5 - sway;
    float width = (.078 + v_heat * .038) * pow(max(.015, 1.0 - t), .8)
      * (.84 + .16 * sin(t * 13.0 - age * 9.0 + seed));
    float cap = (1.0 - smoothstep(.76, 1.0, t)) * smoothstep(-.025, .035, height);
    float body = exp(-pow(abs(x) / width, 1.65) * 1.5) * cap;
    float halo = exp(-pow(abs(x) / (width * 2.4), 1.5) * 1.5) * cap;
    float core = exp(-pow(abs(x) / (width * .38), 1.6)) * cap * (1.0 - smoothstep(.15, .68, t));
    float envelope = rise * fade;
    vec3 red = mix(vec3(1.0, .13, .025), vec3(1.0, .065, .025), v_meta.y);
    vec3 color = mix(red, vec3(1.0, .54, .075), body);
    color = mix(color, vec3(1.0, .95, .64), core);
    float glow = exp(-dot((uv - vec2(.5, .85)) * vec2(9.0, 27.0),
      (uv - vec2(.5, .85)) * vec2(9.0, 27.0))) * rise * (1.0 - smoothstep(1.05, 1.7, age));
    float sparks = 0.0;
    for (int i = 0; i < 3; i++) {
      float n = float(i);
      float travel = (age - .12 - n * .11) * (.54 + n * .055);
      float sparkX = .5 + sin(seed + n * 2.7) * (.025 + max(travel, 0.0) * .13);
      vec2 delta = (uv - vec2(sparkX, .85 - travel)) * vec2(210.0, 92.0);
      sparks += exp(-dot(delta, delta)) * step(.025, travel) * (1.0 - smoothstep(.67, .92, travel));
    }
    float alpha = ((body * .86 + halo * .12) * envelope + glow * .25 + sparks * .8)
      * (.65 + v_meta.x * .35);
    color = mix(color, vec3(1.0, .82, .36), min(1.0, sparks));
    if (alpha < .003) discard;
    gl_FragColor = vec4(color, min(.96, alpha));
  }
`;
