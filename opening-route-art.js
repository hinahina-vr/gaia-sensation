(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.gaia-opening-route-grid .gaia-opening-route').forEach((button, index) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'gaia-route-art';
    canvas.setAttribute('aria-hidden', 'true');
    button.prepend(canvas);
    const gl = canvas.getContext('webgl', {alpha:true, antialias:false, depth:false, powerPreference:'low-power'});
    if (!gl) { canvas.remove(); return; }
    const shader = (type, source) => {
      const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error('Route shader compilation');
      return s;
    };
    let program;
    try {
      program = gl.createProgram();
      const vs = shader(gl.VERTEX_SHADER, 'attribute vec2 p; varying vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}');
      const fs = shader(gl.FRAGMENT_SHADER, `precision mediump float;
        varying vec2 uv; uniform float t, kind, active; uniform vec2 size;
        void main(){
          vec2 p=vec2((uv.x-.77)*size.x/size.y,uv.y-.5);
          float light=0.;
          if(kind<.5){
            for(int i=0;i<7;i++){
              float f=float(i); float curve=.10+f*.039+sin(p.x*3.+t*.45+f*.4)*(.065+abs(p.x)*.07);
              light+=.006/(abs(p.y-curve)+.013)*exp(-abs(p.x)*2.8)*.17;
            }
          }else{
            float r=length(p); float a=atan(p.y,p.x);
            light=.018/(abs(r-.34)+.014)*.16+.011/(abs(r-.49)+.018)*.09;
            light+=pow(max(0.,cos(a-t*.55)),28.)*exp(-abs(r-.34)*8.)*.22;
            for(int i=0;i<9;i++){
              float f=float(i); vec2 dotp=vec2(cos(f*2.4),sin(f*2.4))*(.16+mod(f,3.)*.10);
              light+=.0018/(length(p-dotp)+.009)*( .6+.4*sin(t+f));
            }
          }
          float mask=smoothstep(.37,.65,uv.x)*(1.-smoothstep(.87,1.,uv.x));
          vec3 color=kind<.5?vec3(.46,.96,.84):vec3(.48,.72,1.);
          float alpha=clamp(light*mask*(.65+active*.65),0.,.65);
          gl_FragColor=vec4(color*alpha,alpha);
        }`);
      gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error('Route shader linking');
      gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    } catch { canvas.remove(); return; }
    const uniforms=Object.fromEntries(['t','kind','active','size'].map(k=>[k,gl.getUniformLocation(program,k)]));
    let frame=0, visible=false, lost=false, hover=0, last=0;
    const draw=(time=0)=>{
      frame=0;if(lost || !visible || document.hidden) return;
      if(time-last>32 || reduced.matches || !last){
        last=time;const r=button.getBoundingClientRect();const d=Math.min(devicePixelRatio,1.5);
        const w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
        if(canvas.width!==w || canvas.height!==h){canvas.width=w;canvas.height=h;}
        gl.viewport(0,0,w,h);gl.uniform2f(uniforms.size,w,h);
        gl.uniform1f(uniforms.t,reduced.matches?0:time*.001);gl.uniform1f(uniforms.kind,index);
        gl.uniform1f(uniforms.active,hover);gl.drawArrays(gl.TRIANGLES,0,6);
      }
      if(!reduced.matches) frame=requestAnimationFrame(draw);
    };
    const sync=()=>{cancelAnimationFrame(frame);frame=0;if(visible && !document.hidden && !lost)frame=requestAnimationFrame(draw);};
    new IntersectionObserver(([e])=>{visible=e.isIntersecting;sync();}).observe(button);
    new MutationObserver(sync).observe(document.querySelector('#gaia-opening'),{attributes:true,attributeFilter:['class','hidden']});
    document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
    for(const event of ['pointerenter','focus'])button.addEventListener(event,()=>{hover=1;sync();});
    for(const event of ['pointerleave','blur'])button.addEventListener(event,()=>{hover=0;sync();});
    canvas.addEventListener('webglcontextlost',()=>{lost=true;cancelAnimationFrame(frame);canvas.style.display='none';});
  });
})();
