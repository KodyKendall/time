// Post-processing: bloom, tone shoulder, grading, paper texture, vignette, grain, dithering.
import { compile, createTarget } from './gl.js';

const FS_VS = `#version 300 es
out vec2 v_uv;
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// 13-tap downsample (Jimenez 2014) with optional soft-threshold prefilter.
const DOWN_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform int u_prefilter;
uniform vec4 u_thresh; // threshold, knee, clampMax, 0
out vec4 o;
vec3 pre(vec3 c){
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - u_thresh.x + u_thresh.y, 0.0, 2.0 * u_thresh.y);
  soft = soft * soft / (4.0 * u_thresh.y + 1e-4);
  float contrib = max(soft, br - u_thresh.x) / max(br, 1e-4);
  return min(c * contrib, vec3(u_thresh.z));
}
void main(){
  vec2 t = u_texel;
  vec3 a = texture(u_src, v_uv + t*vec2(-2,-2)).rgb;
  vec3 b = texture(u_src, v_uv + t*vec2( 0,-2)).rgb;
  vec3 c = texture(u_src, v_uv + t*vec2( 2,-2)).rgb;
  vec3 d = texture(u_src, v_uv + t*vec2(-2, 0)).rgb;
  vec3 e = texture(u_src, v_uv).rgb;
  vec3 f = texture(u_src, v_uv + t*vec2( 2, 0)).rgb;
  vec3 g = texture(u_src, v_uv + t*vec2(-2, 2)).rgb;
  vec3 h = texture(u_src, v_uv + t*vec2( 0, 2)).rgb;
  vec3 i = texture(u_src, v_uv + t*vec2( 2, 2)).rgb;
  vec3 j = texture(u_src, v_uv + t*vec2(-1,-1)).rgb;
  vec3 k = texture(u_src, v_uv + t*vec2( 1,-1)).rgb;
  vec3 l = texture(u_src, v_uv + t*vec2(-1, 1)).rgb;
  vec3 m = texture(u_src, v_uv + t*vec2( 1, 1)).rgb;
  vec3 r = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  if (u_prefilter == 1) r = pre(r);
  o = vec4(r, 1.0);
}`;

const UP_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform float u_radius;
out vec4 o;
void main(){
  vec2 t = u_texel * u_radius;
  vec3 s = texture(u_src, v_uv + vec2(-t.x, -t.y)).rgb
         + texture(u_src, v_uv + vec2(0.0, -t.y)).rgb * 2.0
         + texture(u_src, v_uv + vec2(t.x, -t.y)).rgb
         + texture(u_src, v_uv + vec2(-t.x, 0.0)).rgb * 2.0
         + texture(u_src, v_uv).rgb * 4.0
         + texture(u_src, v_uv + vec2(t.x, 0.0)).rgb * 2.0
         + texture(u_src, v_uv + vec2(-t.x, t.y)).rgb
         + texture(u_src, v_uv + vec2(0.0, t.y)).rgb * 2.0
         + texture(u_src, v_uv + vec2(t.x, t.y)).rgb;
  o = vec4(s / 16.0, 1.0);
}`;

// Procedural paper: soft blotches, fibres and tooth. Generated once.
const PAPER_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_res;
out vec4 o;
float hash(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<6;i++){ s+=a*vnoise(p); p=p*2.03+17.1; a*=0.5;} return s; }
void main(){
  vec2 px = v_uv * u_res;
  vec2 d = px / 1080.0; // resolution independent (in frame-heights)
  float blot = fbm(d * 3.0) - 0.5;
  float tooth = fbm(d * 180.0) - 0.5;
  // fibres: stretched noise in two directions
  float f1 = fbm(vec2(d.x * 40.0, d.y * 400.0) + 3.1) - 0.5;
  float f2 = fbm(vec2(d.x * 380.0 + d.y*120.0, d.y * 36.0) + 9.7) - 0.5;
  float fib = smoothstep(0.18, 0.32, abs(f1)) * 0.5 + smoothstep(0.2, 0.34, abs(f2)) * 0.5;
  float v = 1.0 + blot * 0.07 + tooth * 0.11 - fib * 0.05;
  o = vec4(v, blot, tooth, 1.0);
}`;

const FINAL_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform sampler2D u_paper;
uniform float u_bloomAmt;
uniform float u_exposure;
uniform float u_sat;
uniform float u_contrast;
uniform vec3 u_lift;
uniform vec3 u_gain;
uniform float u_vignette;
uniform float u_paperAmt;
uniform float u_grain;
uniform float u_grainSeed;
uniform float u_flip;
uniform vec2 u_res;
uniform float u_fade;       // global fade to black (0..1)
uniform vec3 u_fadeColor;
out vec4 o;
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 shoulder(vec3 c){
  // linear to 0.8, then smooth roll-off to 1.0
  vec3 k = vec3(0.8);
  vec3 over = max(c - k, 0.0);
  return min(c, k) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
void main(){
  vec2 uv = v_uv;
  if (u_flip > 0.5) uv.y = 1.0 - uv.y;
  vec3 c = texture(u_scene, uv).rgb;
  vec3 b = texture(u_bloom, uv).rgb;
  c += b * u_bloomAmt;
  c *= u_exposure;
  // grading (in display space)
  c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, u_sat);
  c = (c - 0.45) * u_contrast + 0.45;
  c = c * u_gain + u_lift * (1.0 - c);
  c = shoulder(max(c, 0.0));
  // paper
  vec4 pp = texture(u_paper, uv);
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  float paper = mix(1.0, pp.r, u_paperAmt * mix(0.55, 1.0, smoothstep(0.0, 0.6, lum)));
  c *= paper;
  // vignette
  vec2 q = uv - 0.5;
  q.x *= u_res.x / u_res.y;
  float vig = 1.0 - u_vignette * smoothstep(0.35, 1.05, length(q));
  c *= vig;
  // grain (luma), changes with u_grainSeed
  vec2 px = uv * u_res;
  float g = hash(floor(px) + u_grainSeed * 37.0) + hash(floor(px * 0.5) + u_grainSeed * 91.0) - 1.0;
  c += g * u_grain * (0.35 + 0.65 * (1.0 - lum));
  c = mix(c, u_fadeColor, u_fade);
  // dither
  c += (hash(px + 0.123 + u_grainSeed) - 0.5) / 255.0;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class Post {
  constructor(gl, W, H) {
    this.gl = gl;
    this.W = W;
    this.H = H;
    this.down = compile(gl, FS_VS, DOWN_FS, 'bloom-down');
    this.up = compile(gl, FS_VS, UP_FS, 'bloom-up');
    this.final = compile(gl, FS_VS, FINAL_FS, 'final');
    const paperProg = compile(gl, FS_VS, PAPER_FS, 'paper');
    this.vao = gl.createVertexArray();
    // bloom chain
    this.levels = [];
    let w = W, h = H;
    for (let i = 0; i < 7; i++) {
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
      this.levels.push(createTarget(gl, w, h, { float: true }));
    }
    this.out = createTarget(gl, W, H, { float: false });
    // paper texture (generated once, at output resolution)
    this.paper = createTarget(gl, W, H, { float: false });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.paper.fbo);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    gl.useProgram(paperProg.prog);
    gl.uniform2f(paperProg.u.u_res, W, H);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    this.settings = {
      bloom: 0.9, threshold: 1.0, knee: 0.25, exposure: 1.0, sat: 1.0, contrast: 1.0,
      lift: [0, 0, 0], gain: [1, 1, 1], vignette: 0.32, paper: 0.55, grain: 0.022,
      fade: 0, fadeColor: [0, 0, 0],
    };
  }

  _pass(pr, target) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : gl.drawingBufferWidth, target ? target.h : gl.drawingBufferHeight);
    gl.useProgram(pr.prog);
    gl.bindVertexArray(this.vao);
  }

  // scene: HDR target. Writes into this.out (flipped for top-down readback) or the canvas.
  run(scene, { toCanvas = false, grainSeed = 0, settings = {} } = {}) {
    const gl = this.gl;
    const s = { ...this.settings, ...settings };
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    // --- bloom down
    let src = scene;
    for (let i = 0; i < this.levels.length; i++) {
      const dst = this.levels[i];
      this._pass(this.down, dst);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(this.down.u.u_src, 0);
      gl.uniform2f(this.down.u.u_texel, 1 / src.w, 1 / src.h);
      gl.uniform1i(this.down.u.u_prefilter, i === 0 ? 1 : 0);
      gl.uniform4f(this.down.u.u_thresh, s.threshold, s.knee, 12.0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
    }
    // --- bloom up (additive into the larger level)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.levels.length - 1; i > 0; i--) {
      const from = this.levels[i], to = this.levels[i - 1];
      this._pass(this.up, to);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, from.tex);
      gl.uniform1i(this.up.u.u_src, 0);
      gl.uniform2f(this.up.u.u_texel, 1 / from.w, 1 / from.h);
      gl.uniform1f(this.up.u.u_radius, 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
    // --- final
    const F = this.final;
    this._pass(F, toCanvas ? null : this.out);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(F.u.u_scene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.levels[0].tex);
    gl.uniform1i(F.u.u_bloom, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.paper.tex);
    gl.uniform1i(F.u.u_paper, 2);
    gl.uniform1f(F.u.u_bloomAmt, s.bloom);
    gl.uniform1f(F.u.u_exposure, s.exposure);
    gl.uniform1f(F.u.u_sat, s.sat);
    gl.uniform1f(F.u.u_contrast, s.contrast);
    gl.uniform3f(F.u.u_lift, ...s.lift);
    gl.uniform3f(F.u.u_gain, ...s.gain);
    gl.uniform1f(F.u.u_vignette, s.vignette);
    gl.uniform1f(F.u.u_paperAmt, s.paper);
    gl.uniform1f(F.u.u_grain, s.grain);
    gl.uniform1f(F.u.u_grainSeed, grainSeed);
    gl.uniform1f(F.u.u_flip, toCanvas ? 0 : 1);
    gl.uniform2f(F.u.u_res, this.W, this.H);
    gl.uniform1f(F.u.u_fade, s.fade);
    gl.uniform3f(F.u.u_fadeColor, ...s.fadeColor);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
  }

  read(into) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.out.fbo);
    const buf = into || new Uint8Array(this.W * this.H * 4);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  }
}
