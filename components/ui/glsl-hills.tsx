'use client';

import { useEffect, useRef } from 'react';

interface GLSLHillsProps {
  width?: string;
  height?: string;
  speed?: number;
}

/**
 * Pure WebGL GLSL hills — no three.js dependency.
 * Renders animated Perlin-noise wireframe hills identical to the original.
 */
const GLSLHills = ({ width = '100%', height = '100%', speed = 0.5 }: GLSLHillsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: true });
    if (!gl) return;

    /* ── shaders ── */
    const VS = `
      attribute vec2 a_uv;
      uniform float u_time;
      varying float v_opacity;

      vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
      vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
      vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
      vec3 fade(vec3 t){return t*t*t*(t*(t*6.-15.)+10.);}

      float cnoise(vec3 P){
        vec3 Pi0=floor(P),Pi1=Pi0+1.;
        Pi0=mod289v3(Pi0);Pi1=mod289v3(Pi1);
        vec3 Pf0=fract(P),Pf1=Pf0-1.;
        vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x);
        vec4 iy=vec4(Pi0.yy,Pi1.yy);
        vec4 iz0=Pi0.zzzz,iz1=Pi1.zzzz;
        vec4 ixy=permute(permute(ix)+iy);
        vec4 ixy0=permute(ixy+iz0),ixy1=permute(ixy+iz1);
        vec4 gx0=ixy0*(1./7.),gy0=fract(floor(gx0)*(1./7.))-.5;
        gx0=fract(gx0);
        vec4 gz0=vec4(.5)-abs(gx0)-abs(gy0);
        vec4 sz0=step(gz0,vec4(0.));
        gx0-=sz0*(step(0.,gx0)-.5);gy0-=sz0*(step(0.,gy0)-.5);
        vec4 gx1=ixy1*(1./7.),gy1=fract(floor(gx1)*(1./7.))-.5;
        gx1=fract(gx1);
        vec4 gz1=vec4(.5)-abs(gx1)-abs(gy1);
        vec4 sz1=step(gz1,vec4(0.));
        gx1-=sz1*(step(0.,gx1)-.5);gy1-=sz1*(step(0.,gy1)-.5);
        vec3 g000=vec3(gx0.x,gy0.x,gz0.x),g100=vec3(gx0.y,gy0.y,gz0.y);
        vec3 g010=vec3(gx0.z,gy0.z,gz0.z),g110=vec3(gx0.w,gy0.w,gz0.w);
        vec3 g001=vec3(gx1.x,gy1.x,gz1.x),g101=vec3(gx1.y,gy1.y,gz1.y);
        vec3 g011=vec3(gx1.z,gy1.z,gz1.z),g111=vec3(gx1.w,gy1.w,gz1.w);
        vec4 norm0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
        g000*=norm0.x;g010*=norm0.y;g100*=norm0.z;g110*=norm0.w;
        vec4 norm1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
        g001*=norm1.x;g011*=norm1.y;g101*=norm1.z;g111*=norm1.w;
        float n000=dot(g000,Pf0),n100=dot(g100,vec3(Pf1.x,Pf0.yz));
        float n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z)),n110=dot(g110,vec3(Pf1.xy,Pf0.z));
        float n001=dot(g001,vec3(Pf0.xy,Pf1.z)),n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z));
        float n011=dot(g011,vec3(Pf0.x,Pf1.yz)),n111=dot(g111,Pf1);
        vec3 fxyz=fade(Pf0);
        vec4 nz=mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fxyz.z);
        vec2 nyz=mix(nz.xy,nz.zw,fxyz.y);
        return 2.2*mix(nyz.x,nyz.y,fxyz.x);
      }

      void main(){
        /* a_uv is in [-1,1] range for both axes */
        float x = a_uv.x * 128.0;   /* world x: -128..128 */
        float z = a_uv.y * 128.0;   /* world z: -128..128 */

        float sinX = sin(radians(x / 128.0 * 90.0));
        vec3 np = vec3(x, z, u_time * -30.0);
        float n1 = cnoise(np * 0.08);
        float n2 = cnoise(np * 0.06);
        float n3 = cnoise(np * 0.4);
        float y = n1*sinX*8.0 + n2*sinX*8.0 + n3*(abs(sinX)*2.0+0.5) + pow(sinX,2.0)*40.0;

        /* simple perspective projection matching original camera */
        float camZ  = 125.0;
        float camY  = 16.0;
        float lookY = 28.0;
        vec3 pos = vec3(x, y, z);
        vec3 cam = vec3(0.0, camY, camZ);
        vec3 dir = normalize(vec3(0.0, lookY, 0.0) - cam);
        vec3 right = normalize(cross(dir, vec3(0.0,1.0,0.0)));
        vec3 up    = cross(right, dir);
        vec3 rel   = pos - cam;
        float fov  = radians(45.0);
        float aspect = 16.0/9.0;
        float fx = dot(rel, right) / (tan(fov*0.5) * aspect * dot(rel, dir));
        float fy = dot(rel, up)    / (tan(fov*0.5)          * dot(rel, dir));

        /* distance-based opacity */
        float dist = length(vec3(x, y, z));
        v_opacity = clamp((96.0 - dist) / 256.0 * 0.6, 0.0, 1.0);

        gl_Position = vec4(fx, fy, 0.0, 1.0);
        gl_PointSize = 1.0;
      }
    `;

    const FS = `
      precision mediump float;
      varying float v_opacity;
      void main(){
        gl_FragColor = vec4(0.6, 0.6, 0.6, v_opacity);
      }
    `;

    /* ── compile shaders ── */
    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    /* ── build grid geometry ── */
    const SEGS = 128;
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let j = 0; j <= SEGS; j++) {
      for (let i = 0; i <= SEGS; i++) {
        uvs.push((i / SEGS) * 2 - 1, (j / SEGS) * 2 - 1);
      }
    }
    // horizontal lines
    for (let j = 0; j <= SEGS; j++) {
      for (let i = 0; i < SEGS; i++) {
        indices.push(j * (SEGS + 1) + i, j * (SEGS + 1) + i + 1);
      }
    }
    // vertical lines
    for (let i = 0; i <= SEGS; i++) {
      for (let j = 0; j < SEGS; j++) {
        indices.push(j * (SEGS + 1) + i, (j + 1) * (SEGS + 1) + i);
      }
    }

    const uvBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

    const idxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

    // need OES_element_index_uint for Uint32Array indices
    gl.getExtension('OES_element_index_uint');

    const aUV = gl.getAttribLocation(prog, 'a_uv');
    gl.enableVertexAttribArray(aUV);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    /* ── resize ── */
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      gl!.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    /* ── render loop ── */
    let t = 0;
    let last = performance.now();
    let animId: number;

    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      t += dt * speed;

      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.uniform1f(uTime, t);
      gl!.bindBuffer(gl!.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl!.drawElements(gl!.LINES, indices.length, gl!.UNSIGNED_INT, 0);

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog);
      gl.deleteBuffer(uvBuf);
      gl.deleteBuffer(idxBuf);
    };
  }, [speed]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block' }}
    />
  );
};

export { GLSLHills };
