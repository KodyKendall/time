// The compositor draws painted layers, glows, particles and flat fills into HDR render targets
// with raw WebGL2. All positions are in "design units" (1920x1080 = one full frame); the
// compositor scales to the output resolution.
import { compile, createTarget, restoreP5 } from './gl.js';
import { M } from './math.js';

export const DW = 1920, DH = 1080;

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 a_corner;
uniform mat3 u_m;        // local -> NDC
uniform mat3 u_toScreen; // local -> screen design units
uniform vec2 u_size;
uniform vec4 u_uv;
out vec2 v_uv;
out vec2 v_screen;
out vec2 v_local;
void main(){
  vec2 local = a_corner * u_size;
  v_local = a_corner;
  v_screen = (u_toScreen * vec3(local, 1.0)).xy;
  v_uv = mix(u_uv.xy, u_uv.zw, a_corner);
  vec3 n = u_m * vec3(local, 1.0);
  gl_Position = vec4(n.xy, 0.0, 1.0);
}`;

// Shared masking + grading code.
const MASK = `
uniform int u_maskMode;     // 0 none, 1 radial, 2 linear, 3 texture threshold, 4 ellipse, 5 rect
uniform vec4 u_mask;        // radial: cx cy r0 r1 | linear: nx ny d0 d1 | tex: threshold softness
uniform vec4 u_mask2;       // ellipse: rx ry rot 0 ; texture: uv transform (screen->mask uv) row 1
uniform vec4 u_mask3;       // texture: uv transform row 2
uniform float u_maskInv;
uniform sampler2D u_maskTex;`;
const GRADE_U = `
uniform vec3 u_grade;       // saturation, brightness, contrast
uniform vec4 u_tint;        // rgb multiply
uniform vec4 u_color;       // rgb overlay, a=amount
uniform vec4 u_hsv;         // hue shift (turns), unused...`;
const MASK_FN = `
float maskValue(vec2 s){
  float m = 1.0;
  if (u_maskMode == 1) {
    float d = distance(s, u_mask.xy);
    m = 1.0 - smoothstep(u_mask.z, u_mask.w, d);
  } else if (u_maskMode == 2) {
    float d = dot(s, u_mask.xy);
    m = smoothstep(u_mask.z, u_mask.w, d);
  } else if (u_maskMode == 3) {
    vec2 muv = vec2(dot(u_mask2.xyz, vec3(s,1.0)), dot(u_mask3.xyz, vec3(s,1.0)));
    float v = texture(u_maskTex, muv).a;
    if (muv.x < 0.0 || muv.y < 0.0 || muv.x > 1.0 || muv.y > 1.0) v = 0.0;
    m = smoothstep(u_mask.x - u_mask.y, u_mask.x + u_mask.y, v);
  } else if (u_maskMode == 5) {
    float sft = max(u_mask2.x, 0.001);
    vec2 a = smoothstep(u_mask.xy - sft, u_mask.xy + sft, s) * (1.0 - smoothstep(u_mask.zw - sft, u_mask.zw + sft, s));
    m = a.x * a.y;
  } else if (u_maskMode == 4) {
    vec2 d = s - u_mask.xy;
    float c = cos(u_mask2.z), sn = sin(u_mask2.z);
    d = vec2(c*d.x + sn*d.y, -sn*d.x + c*d.y) / u_mask2.xy;
    float r = length(d);
    m = 1.0 - smoothstep(u_mask.z, u_mask.w, r);
  }
  return u_maskInv > 0.5 ? 1.0 - m : m;
}`;
const COMMON = MASK + GRADE_U + MASK_FN + `
vec3 grade(vec3 rgb){
  float l = dot(rgb, vec3(0.299, 0.587, 0.114));
  rgb = mix(vec3(l), rgb, u_grade.x);
  rgb = (rgb - 0.5) * u_grade.z + 0.5;
  rgb = max(rgb, 0.0) * u_grade.y;
  rgb *= u_tint.rgb;
  rgb = mix(rgb, u_color.rgb, u_color.a);
  return rgb;
}`;

const LAYER_FS = `#version 300 es
precision highp float;
in vec2 v_uv; in vec2 v_screen; in vec2 v_local;
uniform sampler2D u_tex;
uniform float u_opacity;
uniform float u_add;
uniform float u_lod;
${COMMON}
out vec4 o;
void main(){
  vec4 c = u_lod > 0.0 ? textureLod(u_tex, v_uv, u_lod) : texture(u_tex, v_uv);
  if (c.a < 0.0005) discard;
  vec3 rgb = grade(c.rgb / c.a);
  float a = c.a * u_opacity * maskValue(v_screen);
  o = vec4(rgb * a, a * (1.0 - u_add));
}`;

const GLOW_FS = `#version 300 es
precision highp float;
in vec2 v_uv; in vec2 v_screen; in vec2 v_local;
uniform vec3 u_gcolor;
uniform float u_intensity;
uniform float u_ext;      // quad half-extent in radii
uniform vec3 u_shape;     // core sharpness, halo amount, halo falloff
uniform vec2 u_stretch;   // anisotropic stretch
${COMMON}
out vec4 o;
void main(){
  vec2 p = (v_local * 2.0 - 1.0) * u_ext;  // in radii
  p /= u_stretch;
  float d2 = dot(p, p);
  float core = exp(-d2 * u_shape.x);
  float halo = u_shape.y / (1.0 + d2 * u_shape.z);
  // fade halo tail to zero at quad edge
  float edge = 1.0 - smoothstep(u_ext * 0.6, u_ext, length(v_local * 2.0 - 1.0) * u_ext);
  float v = (core + halo * edge) * u_intensity * maskValue(v_screen);
  o = vec4(u_gcolor * v, 0.0);
}`;

const SOLID_FS = `#version 300 es
precision highp float;
in vec2 v_uv; in vec2 v_screen; in vec2 v_local;
uniform vec4 u_c0;
uniform vec4 u_c1;
uniform int u_grad;  // 0 flat, 1 vertical, 2 radial
uniform float u_opacity;
uniform float u_add;
${COMMON}
out vec4 o;
void main(){
  float t = u_grad == 1 ? v_local.y : (u_grad == 2 ? clamp(length(v_local*2.0-1.0),0.0,1.0) : 0.0);
  vec4 c = mix(u_c0, u_c1, t);
  float a = c.a * u_opacity * maskValue(v_screen);
  o = vec4(c.rgb * a, a * (1.0 - u_add));
}`;


const FULL_VS = `#version 300 es
out vec2 v_uv;
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Warped layer: full-screen pass, inverse-maps each screen point through the warp.
const WARP_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform mat3 u_screenToLocal;
uniform vec2 u_size;
uniform vec4 u_uv;
uniform sampler2D u_tex;
uniform float u_opacity;
uniform float u_add;
uniform int u_warp;       // 1 twirl, 2 noise, 3 bulge, 4 twirl+noise
uniform vec4 u_wp;        // twirl/bulge: cx cy radius angle|strength
uniform vec4 u_wp2;       // noise: amp freq time falloffExp
uniform vec4 u_wp3;       // twirl disk tilt: cos(inclination), tilt axis angle
${COMMON}
out vec4 o;
float hsh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hsh(i), hsh(i+vec2(1,0)), u.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
vec2 twirlInv(vec2 s){
  vec2 d = s - u_wp.xy;
  if (u_wp3.x > 0.0 && u_wp3.x < 0.9999) {
    // un-tilt from the inclined disk into the disk plane
    float cp = cos(u_wp3.y), sp = sin(u_wp3.y);
    vec2 e = vec2(cp*d.x + sp*d.y, -sp*d.x + cp*d.y);
    e.y /= u_wp3.x;
    d = vec2(cp*e.x - sp*e.y, sp*e.x + cp*e.y);
  }
  float r = length(d);
  float k = pow(max(0.0, 1.0 - r / u_wp.z), u_wp2.w > 0.0 ? u_wp2.w : 2.0);
  float th = -u_wp.w * k;
  float c = cos(th), sn = sin(th);
  return u_wp.xy + vec2(c*d.x - sn*d.y, sn*d.x + c*d.y);
}
void main(){
  vec2 s = vec2(v_uv.x * 1920.0, (1.0 - v_uv.y) * 1080.0);
  vec2 q = s;
  if (u_warp == 1 || u_warp == 4) q = twirlInv(q);
  if (u_warp == 2 || u_warp == 4) {
    vec2 np = q * u_wp2.y;
    q += u_wp2.x * vec2(fbm(np + vec2(u_wp2.z, 0.0)) - 0.5, fbm(np + vec2(0.0, u_wp2.z) + 13.7) - 0.5);
  }
  if (u_warp == 3) {
    vec2 d = q - u_wp.xy; float r = length(d);
    if (r < u_wp.z) q = u_wp.xy + d * pow(r / u_wp.z, u_wp.w);
  }
  vec2 local = (u_screenToLocal * vec3(q, 1.0)).xy / u_size;
  if (local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0) discard;
  vec2 uv = mix(u_uv.xy, u_uv.zw, local);
  vec4 c = texture(u_tex, uv);
  if (c.a < 0.0005) discard;
  vec3 rgb = grade(c.rgb / c.a);
  float a = c.a * u_opacity * maskValue(s);
  o = vec4(rgb * a, a * (1.0 - u_add));
}`;

// Instanced particles: per-instance x, y, size, rot, r, g, b, a (8 floats, screen design units)
const PART_VS = `#version 300 es
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_p0; // x y size rot
layout(location=2) in vec4 a_p1; // r g b a
uniform mat3 u_ndc;      // screen design -> ndc
out vec2 v_local;
out vec4 v_col;
out vec2 v_uv;
out vec2 v_screen;
void main(){
  vec2 c = a_corner * 2.0 - 1.0;
  float cr = cos(a_p0.w), sr = sin(a_p0.w);
  vec2 off = vec2(cr*c.x - sr*c.y, sr*c.x + cr*c.y) * a_p0.z;
  vec3 n = u_ndc * vec3(a_p0.xy + off, 1.0);
  v_screen = a_p0.xy + off;
  v_local = c;
  v_uv = vec2(a_corner.x, 1.0 - a_corner.y);
  v_col = a_p1;
  gl_Position = vec4(n.xy, 0.0, 1.0);
}`;
const PART_FS = `#version 300 es
precision highp float;
in vec2 v_local; in vec4 v_col; in vec2 v_uv; in vec2 v_screen;
${MASK}
${MASK_FN}
uniform int u_kind;   // 0 soft dot, 1 glow dot, 2 textured, 3 hard dot
uniform sampler2D u_tex;
uniform float u_add;
out vec4 o;
void main(){
  float d2 = dot(v_local, v_local);
  float a;
  if (u_kind == 0) a = smoothstep(1.0, 0.35, sqrt(d2));
  else if (u_kind == 1) a = exp(-d2 * 5.0) + 0.12 / (1.0 + d2 * 40.0) * smoothstep(1.0, 0.6, sqrt(d2));
  else if (u_kind == 3) { float d = sqrt(d2); a = 1.0 - smoothstep(0.82, 1.0, d); }
  else a = texture(u_tex, v_uv).a;
  a *= v_col.a * maskValue(v_screen);
  if (a < 0.001) discard;
  o = vec4(v_col.rgb * a, a * (1.0 - u_add));
}`;

export class Compositor {
  constructor(p, W, H) {
    this.p = p;
    this.gl = p.drawingContext;
    this.W = W;
    this.H = H;
    this.S = W / DW;
    const gl = this.gl;
    this.progLayer = compile(gl, QUAD_VS, LAYER_FS, 'layer');
    this.progGlow = compile(gl, QUAD_VS, GLOW_FS, 'glow');
    this.progSolid = compile(gl, QUAD_VS, SOLID_FS, 'solid');
    this.progPart = compile(gl, PART_VS, PART_FS, 'particles');
    this.progWarp = compile(gl, FULL_VS, WARP_FS, 'warp');
    this.emptyVao = gl.createVertexArray();

    // Unit quad VAO (for QUAD_VS programs). All quad programs bind a_corner at location 0.
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Particle VAO
    this.partCap = 4096;
    this.partData = new Float32Array(this.partCap * 8);
    this.pvao = gl.createVertexArray();
    gl.bindVertexArray(this.pvao);
    const pc = 0, p0 = 1, p1 = 2;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(pc);
    gl.vertexAttribPointer(pc, 2, gl.FLOAT, false, 0, 0);
    this.pbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pbuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.partData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p0);
    gl.vertexAttribPointer(p0, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(p0, 1);
    gl.enableVertexAttribArray(p1);
    gl.vertexAttribPointer(p1, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(p1, 1);
    gl.bindVertexArray(null);

    // A 1x1 white texture used when no mask texture is bound.
    this.white = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.white);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

    this.cur = null;
    this.stats = { draws: 0 };
  }

  makeTarget(opts = {}) {
    return createTarget(this.gl, opts.w || this.W, opts.h || this.H, { float: opts.float !== false });
  }

  // Begin drawing into a target (null = none). Sets all state we rely on.
  bind(target, clear = null) {
    const gl = this.gl;
    this.cur = target;
    this.active = true;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    const w = target ? target.w : gl.drawingBufferWidth, h = target ? target.h : gl.drawingBufferHeight;
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (clear) {
      gl.clearColor(clear[0], clear[1], clear[2], clear[3] ?? 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    // design units -> NDC for this target (y down)
    const tw = target ? target.w : this.W, th = target ? target.h : this.H;
    const sx = (tw / DW), sy = (th / DH);
    this.ndc = [(2 / tw) * sx, 0, 0, (-2 / th) * sy, -1, 1];
  }

  done() {
    this.active = false;
    restoreP5(this.p, this.gl);
  }

  _blend(mode) {
    const gl = this.gl;
    gl.blendEquation(gl.FUNC_ADD);
    if (mode === 'add') gl.blendFunc(gl.ONE, gl.ONE);
    else if (mode === 'screen') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    else if (mode === 'multiply') gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
    else if (mode === 'erase') gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    else if (mode === 'replace') gl.blendFunc(gl.ONE, gl.ZERO);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  _mat3(m) {
    // affine [a b c d e f] -> column-major mat3
    return new Float32Array([m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1]);
  }

  _setCommon(pr, o) {
    const gl = this.gl, u = pr.u;
    const g = o.grade || [1, 1, 1];
    gl.uniform3f(u.u_grade, g[0] ?? 1, g[1] ?? 1, g[2] ?? 1);
    const tn = o.tint || [1, 1, 1];
    gl.uniform4f(u.u_tint, tn[0], tn[1], tn[2], 1);
    const cc = o.color || [0, 0, 0, 0];
    gl.uniform4f(u.u_color, cc[0], cc[1], cc[2], cc[3] ?? 0);
    this._setMask(pr, o.mask);
  }

  // Mask uniforms (texture unit 1). Leaves TEXTURE0 active.
  _setMask(pr, mk) {
    const gl = this.gl, u = pr.u;
    let mode = 0;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.white);
    if (mk) {
      if (mk.type === 'radial') {
        mode = 1;
        gl.uniform4f(u.u_mask, mk.x, mk.y, mk.r0, mk.r1);
      } else if (mk.type === 'linear') {
        mode = 2;
        const n = Math.hypot(mk.nx, mk.ny) || 1;
        gl.uniform4f(u.u_mask, mk.nx / n, mk.ny / n, mk.d0, mk.d1);
      } else if (mk.type === 'rect') {
        mode = 5;
        gl.uniform4f(u.u_mask, mk.x0, mk.y0, mk.x1, mk.y1);
        gl.uniform4f(u.u_mask2, mk.soft ?? 1, 0, 0, 0);
      } else if (mk.type === 'ellipse') {
        mode = 4;
        gl.uniform4f(u.u_mask, mk.x, mk.y, mk.r0, mk.r1);
        gl.uniform4f(u.u_mask2, mk.rx, mk.ry, mk.rot || 0, 0);
      } else if (mk.type === 'texture') {
        mode = 3;
        // mk.layer: mask layer; mk.m: mask layer local -> screen design units; threshold/softness
        const inv = M.inv(mk.m);
        const L = mk.layer;
        // screen -> local -> uv
        const su = [1 / L.w, 0, 0, 1 / L.h, 0, 0];
        let toUV = M.mul(su, inv);
        if (L.flipY) toUV = M.mul([1, 0, 0, -1, 0, 1], toUV);
        gl.uniform4f(u.u_mask, mk.threshold ?? 0.5, mk.softness ?? 0.05, 0, 0);
        gl.uniform4f(u.u_mask2, toUV[0], toUV[2], toUV[4], 0);
        gl.uniform4f(u.u_mask3, toUV[1], toUV[3], toUV[5], 0);
        gl.bindTexture(gl.TEXTURE_2D, L.tex);
      }
    }
    gl.uniform1i(u.u_maskTex, 1);
    gl.uniform1i(u.u_maskMode, mode);
    gl.uniform1f(u.u_maskInv, mk && mk.invert ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
  }

  // Draw a layer (painted framebuffer or texture) with local->screen transform m.
  // Layer: { tex, w, h, flipY }
  layer(L, m, o = {}) {
    if (!L || !L.tex) return;
    const op = o.opacity ?? 1;
    if (op <= 0.0005) return;
    if (o.warp) return this._warpLayer(L, m, o, op);
    const gl = this.gl, pr = this.progLayer;
    gl.useProgram(pr.prog);
    gl.bindVertexArray(this.vao);
    this._blend(o.blend);
    const toNdc = M.mul(this.ndc, m);
    gl.uniformMatrix3fv(pr.u.u_m, false, this._mat3(toNdc));
    gl.uniformMatrix3fv(pr.u.u_toScreen, false, this._mat3(m));
    const w = o.w ?? L.w, h = o.h ?? L.h;
    gl.uniform2f(pr.u.u_size, w, h);
    let uv = o.uv || [0, 0, 1, 1];
    if (L.flipY) uv = [uv[0], 1 - uv[1], uv[2], 1 - uv[3]];
    gl.uniform4f(pr.u.u_uv, uv[0], uv[1], uv[2], uv[3]);
    gl.uniform1f(pr.u.u_opacity, op);
    gl.uniform1f(pr.u.u_add, o.blend === 'add' ? 1 : 0);
    gl.uniform1f(pr.u.u_lod, o.lod ?? 0);
    this._setCommon(pr, o);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, L.tex);
    gl.uniform1i(pr.u.u_tex, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.stats.draws++;
  }

  _warpLayer(L, m, o, op) {
    const gl = this.gl, pr = this.progWarp, w = o.warp;
    gl.useProgram(pr.prog);
    gl.bindVertexArray(this.emptyVao);
    this._blend(o.blend);
    gl.uniformMatrix3fv(pr.u.u_screenToLocal, false, this._mat3(M.inv(m)));
    const lw = o.w ?? L.w, lh = o.h ?? L.h;
    gl.uniform2f(pr.u.u_size, lw, lh);
    let uv = o.uv || [0, 0, 1, 1];
    if (L.flipY) uv = [uv[0], 1 - uv[1], uv[2], 1 - uv[3]];
    gl.uniform4f(pr.u.u_uv, uv[0], uv[1], uv[2], uv[3]);
    gl.uniform1f(pr.u.u_opacity, op);
    gl.uniform1f(pr.u.u_add, o.blend === 'add' ? 1 : 0);
    const mode = { twirl: 1, noise: 2, bulge: 3, twirlNoise: 4 }[w.type] || 0;
    gl.uniform1i(pr.u.u_warp, mode);
    gl.uniform4f(pr.u.u_wp, w.cx ?? 960, w.cy ?? 540, w.radius ?? 800, w.angle ?? w.strength ?? 0);
    gl.uniform4f(pr.u.u_wp2, w.amp ?? 0, w.freq ?? 0.004, w.time ?? 0, w.falloff ?? 2);
    gl.uniform4f(pr.u.u_wp3, w.tilt ?? 1, w.tiltRot ?? 0, 0, 0);
    this._setCommon(pr, o);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, L.tex);
    gl.uniform1i(pr.u.u_tex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    this.stats.draws++;
  }

  // Additive radial glow centred at (x,y) (after transform m) with radius r (design units).
  glow(x, y, r, color, intensity = 1, o = {}) {
    if (intensity <= 0 || r <= 0) return;
    const gl = this.gl, pr = this.progGlow;
    const ext = o.ext ?? 4;
    const m0 = o.m || M.id();
    const sx = o.sx ?? 1, sy = o.sy ?? 1;
    const ang = o.rot ?? 0;
    // local quad: [-ext*r, ext*r] scaled by stretch
    const local = M.chain(m0, M.translate(x, y), M.rotate(ang), M.scale(sx, sy), M.translate(-ext * r, -ext * r));
    gl.useProgram(pr.prog);
    gl.bindVertexArray(this.vao);
    this._blend('add');
    gl.uniformMatrix3fv(pr.u.u_m, false, this._mat3(M.mul(this.ndc, local)));
    gl.uniformMatrix3fv(pr.u.u_toScreen, false, this._mat3(local));
    gl.uniform2f(pr.u.u_size, 2 * ext * r, 2 * ext * r);
    gl.uniform4f(pr.u.u_uv, 0, 0, 1, 1);
    gl.uniform3f(pr.u.u_gcolor, color[0], color[1], color[2]);
    gl.uniform1f(pr.u.u_intensity, intensity);
    gl.uniform1f(pr.u.u_ext, ext);
    const sh = o.shape || [2.2, 0.35, 3.0];
    gl.uniform3f(pr.u.u_shape, sh[0], sh[1], sh[2]);
    gl.uniform2f(pr.u.u_stretch, 1, 1);
    this._setCommon(pr, o);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.stats.draws++;
  }

  // Solid / gradient rectangle in local coords transformed by m.
  rect(x, y, w, h, c0, o = {}) {
    const gl = this.gl, pr = this.progSolid;
    const m = M.mul(o.m || M.id(), M.translate(x, y));
    gl.useProgram(pr.prog);
    gl.bindVertexArray(this.vao);
    this._blend(o.blend);
    gl.uniformMatrix3fv(pr.u.u_m, false, this._mat3(M.mul(this.ndc, m)));
    gl.uniformMatrix3fv(pr.u.u_toScreen, false, this._mat3(m));
    gl.uniform2f(pr.u.u_size, w, h);
    gl.uniform4f(pr.u.u_uv, 0, 0, 1, 1);
    const c1 = o.c1 || c0;
    gl.uniform4f(pr.u.u_c0, c0[0], c0[1], c0[2], c0[3] ?? 1);
    gl.uniform4f(pr.u.u_c1, c1[0], c1[1], c1[2], c1[3] ?? 1);
    gl.uniform1i(pr.u.u_grad, o.grad === 'vertical' ? 1 : o.grad === 'radial' ? 2 : 0);
    gl.uniform1f(pr.u.u_opacity, o.opacity ?? 1);
    gl.uniform1f(pr.u.u_add, o.blend === 'add' ? 1 : 0);
    this._setCommon(pr, o);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.stats.draws++;
  }

  // Full-frame fill (screen space)
  fill(c, o = {}) {
    this.rect(-2, -2, DW + 4, DH + 4, c, o);
  }

  // Particles: array-of-arrays [x, y, size, rot, r, g, b, a] in screen design units
  // (use o.m to transform positions from world space; sizes are scaled by the transform).
  particles(list, o = {}) {
    const n = list.length;
    if (!n) return;
    const gl = this.gl, pr = this.progPart;
    if (n > this.partCap) {
      while (this.partCap < n) this.partCap *= 2;
      this.partData = new Float32Array(this.partCap * 8);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pbuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.partData.byteLength, gl.DYNAMIC_DRAW);
    }
    const m = o.m;
    const sc = m ? M.scaleOf(m) : 1;
    const rot = m ? Math.atan2(m[1], m[0]) : 0;
    const d = this.partData;
    for (let i = 0; i < n; i++) {
      const q = list[i], k = i * 8;
      if (m) {
        d[k] = m[0] * q[0] + m[2] * q[1] + m[4];
        d[k + 1] = m[1] * q[0] + m[3] * q[1] + m[5];
      } else {
        d[k] = q[0];
        d[k + 1] = q[1];
      }
      d[k + 2] = q[2] * sc;
      d[k + 3] = (q[3] || 0) + rot;
      d[k + 4] = q[4];
      d[k + 5] = q[5];
      d[k + 6] = q[6];
      d[k + 7] = q[7];
    }
    gl.useProgram(pr.prog);
    gl.bindVertexArray(this.pvao);
    this._blend(o.blend);
    this._setMask(pr, o.mask);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pbuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, n * 8));
    gl.uniformMatrix3fv(pr.u.u_ndc, false, this._mat3(this.ndc));
    const kind = { soft: 0, glow: 1, tex: 2, hard: 3 }[o.kind || 'soft'];
    gl.uniform1i(pr.u.u_kind, kind);
    gl.uniform1f(pr.u.u_add, o.blend === 'add' ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, o.tex ? o.tex.tex : this.white);
    gl.uniform1i(pr.u.u_tex, 0);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.bindVertexArray(null);
    this.stats.draws++;
  }

  // Composite a full-frame target (scene buffer) onto the current target.
  target(T, o = {}) {
    this.layer({ tex: T.tex, w: DW, h: DH, flipY: true }, o.m || M.id(), o);
  }
}
