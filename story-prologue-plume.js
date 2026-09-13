(() => {
  'use strict';
  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * .5 + .5;
      gl_Position = vec4(a_position, 0., 1.);
    }
  `;
  const fragmentSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform vec2 u_resolution;
    uniform float u_time;
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
        mix(hash(i + vec2(0., 1.)), hash(i + vec2(1.)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float value = 0., gain = .5;
      for (int i = 0; i < 4; i++) {
        value += gain * noise(p);
        p = mat2(.8, -.6, .6, .8) * p * 2.03 + 7.1;
        gain *= .5;
      }
      return value;
    }
    void main() {
      float aspect = min(u_resolution.x / u_resolution.y, 1.9);
      vec2 p = vec2((v_uv.x - .5) * aspect, v_uv.y);
      float t = u_time * .085;
      vec2 drift = vec2(fbm(p * 3.2 + vec2(t, -t * .65)),
        fbm(p * 3.2 + vec2(4.7 - t * .5, 8.3 - t)));
      vec2 q = p + (drift - .47) * .24;
      float left = -.39 * aspect + .09 * sin(q.y * 7. - t);
      float right = .42 * aspect + .1 * sin(q.y * 6. + t + 2.);
      float width = .075 + (1. - q.y) * .12;
      float plumes = exp(-pow((q.x - left) / width, 2.))
        + .82 * exp(-pow((q.x - right) / (width * 1.2), 2.));
      float wisps = fbm(q * vec2(6., 5.) + vec2(t * .3, -t));
      float folds = 1. - smoothstep(.04, .23, abs(wisps - .48));
      float shore = exp(-pow((q.y - .1 - .025 * sin(q.x * 8. + t)) / .13, 2.));
      float mist = plumes * (.27 + .63 * folds) * (1. - smoothstep(.62, 1.15, q.y));
      mist += shore * (.18 + .24 * wisps);
      // Leave the middle of the white page quiet enough for long lines.
      float readingSpace = exp(-pow((v_uv.x - .5) / .4, 4.) - pow((v_uv.y - .54) / .39, 4.));
      mist *= 1. - .95 * readingSpace;
      vec3 seaGlass = mix(vec3(.48, .70, .77), vec3(.62, .79, .72), drift.x);
      vec3 color = mix(vec3(1.), seaGlass, clamp(mist * .95, 0., .85));
      gl_FragColor = vec4(color, 1.);
    }
  `;

  function create(host) {
    const canvas = document.createElement('canvas');
    canvas.className = 'gaia-story-prologue-plume';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.renderer = 'pending';
    host.prepend(canvas);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let gl = null, program = null, buffer = null, frame = 0;
    let disposed = false, ready = false, lastFrame = 0, elapsed = 0, frames = 0;
    let resolution, time;
    const shaders = [];
    const fallback = () => {
      cancelAnimationFrame(frame); frame = 0; ready = false;
      canvas.dataset.renderer = 'fallback';
      canvas.dataset.motion = 'static';
    };
    const draw = () => {
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, motion.matches ? 7 : elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frames++;
    };
    const resize = () => {
      if (!ready || disposed) return;
      const {width, height} = host.getBoundingClientRect();
      // One small render target even on 4K/retina; no depth, textures or FBOs.
      const scale = Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(360000 / Math.max(1, width * height)));
      canvas.width = Math.max(1, Math.floor(width * scale));
      canvas.height = Math.max(1, Math.floor(height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw();
    };
    const tick = now => {
      frame = 0;
      if (disposed || !ready || document.hidden || motion.matches) return;
      if (!lastFrame || now - lastFrame >= 1000 / 30 - 1) {
        elapsed += lastFrame ? Math.min(.1, (now - lastFrame) / 1000) : 0;
        lastFrame = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (!ready || disposed) return;
      cancelAnimationFrame(frame); frame = 0; lastFrame = 0;
      canvas.dataset.motion = document.hidden ? 'paused' : motion.matches ? 'static' : 'running';
      if (!document.hidden) {
        if (motion.matches) draw();
        else frame = requestAnimationFrame(tick);
      }
    };
    const lost = event => { event.preventDefault(); fallback(); };
    const init = () => {
      frame = 0;
      if (disposed) return;
      try {
        gl = canvas.getContext('webgl', {alpha:true, antialias:false, depth:false, stencil:false, powerPreference:'low-power'});
        if (!gl) { fallback(); return; }
        for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
          const shader = gl.createShader(type);
          if (!shader) throw new Error('Plume shader unavailable');
          const shaderSource = type === gl.FRAGMENT_SHADER && !gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision
            ? source.replace('precision highp float;', 'precision mediump float;') : source;
          shaders.push(shader); gl.shaderSource(shader, shaderSource); gl.compileShader(shader);
        }
        program = gl.createProgram();
        if (!program) throw new Error('Plume program unavailable');
        shaders.forEach(shader => gl.attachShader(program, shader));
        gl.bindAttribLocation(program, 0, 'a_position');
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Plume shader link failed');
        gl.useProgram(program);
        buffer = gl.createBuffer();
        if (!buffer) throw new Error('Plume buffer unavailable');
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        resolution = gl.getUniformLocation(program, 'u_resolution');
        time = gl.getUniformLocation(program, 'u_time');
        ready = true; canvas.dataset.renderer = 'webgl';
        resize(); sync();
      } catch { fallback(); }
    };
    canvas.addEventListener('webglcontextlost', lost);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    // Show the white fade first; do not compile a shader in the title click task.
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(init); });
    return Object.freeze({
      getState: () => ({renderer:canvas.dataset.renderer, motion:canvas.dataset.motion, frames, width:canvas.width, height:canvas.height, elapsed}),
      dispose() {
        if (disposed) return;
        disposed = true; cancelAnimationFrame(frame); frame = 0;
        canvas.removeEventListener('webglcontextlost', lost);
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', sync);
        motion.removeEventListener('change', sync);
        if (gl) {
          if (buffer) gl.deleteBuffer(buffer);
          if (program) gl.deleteProgram(program);
          shaders.forEach(shader => gl.deleteShader(shader));
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
        canvas.remove();
      },
    });
  }
  window.GaiaStoryPlume = Object.freeze({create});
})();
