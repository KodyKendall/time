// CITY — a tiny perspective renderer that shares the compositor's WebGL2 context.
//
// The engine compositor maps layers with 2D affine transforms only; the city needs true
// perspective (the fields tilt into a street, facades converge). This module projects planar
// 3D polygons on the CPU into homogeneous clip coordinates (w = camera depth) and lets the GPU do
// perspective-correct texturing, mip/anisotropic filtering and near-plane clipping. It follows
// the compositor's conventions (premultiplied alpha, design units, current target, R.view), so it
// interleaves with R.layer / R.glow calls as long as `flush()` is called before them.
import { compile } from '../../engine/gl.js';
import { M } from '../../engine/math.js';

const VS = `#version 300 es
layout(location=0) in vec3 a_pos;   // clip x, clip y, w
layout(location=1) in vec4 a_uv;    // uv (colour texture), uv2 (mask texture)
layout(location=2) in vec4 a_tint;  // rgb multiply, a = opacity
layout(location=3) in vec4 a_fog;   // rgb fog colour, a = amount
layout(location=4) in vec2 a_rev;   // reveal: value, threshold
out vec4 v_uv; out vec4 v_tint; out vec4 v_fog; out vec2 v_rev;
void main(){
  v_uv = a_uv; v_tint = a_tint; v_fog = a_fog; v_rev = a_rev;
  gl_Position = vec4(a_pos.xy, 0.0, a_pos.z);
}`;

const FS = `#version 300 es
precision highp float;
in vec4 v_uv; in vec4 v_tint; in vec4 v_fog; in vec2 v_rev;
uniform sampler2D u_tex;
uniform sampler2D u_mask;
uniform int u_mode;      // 0 plain, 1 mask texture alpha >= threshold, 2 reveal value < threshold
uniform float u_soft;
uniform float u_add;
out vec4 o;
void main(){
  vec4 c = texture(u_tex, v_uv.xy);
  if (c.a < 0.0005) discard;
  vec3 rgb = c.rgb / c.a;
  rgb *= v_tint.rgb;
  rgb = mix(rgb, v_fog.rgb, v_fog.a);
  float a = c.a * v_tint.a;
  if (u_mode == 1) {
    float m = texture(u_mask, v_uv.zw).a;
    a *= smoothstep(v_rev.y - u_soft, v_rev.y + u_soft, m);
  } else if (u_mode == 2) {
    // reveal with a painterly, grainy front (mask texture used as noise)
    float nz = texture(u_mask, v_uv.zw).a - 0.5;
    a *= 1.0 - smoothstep(v_rev.y - u_soft, v_rev.y, v_rev.x + nz * u_soft * 0.8);
  }
  if (a < 0.0005) discard;
  o = vec4(rgb * a, a * (1.0 - u_add));
}`;

const FLOATS = 17;
const WHITE_T = [1, 1, 1, 1];
const NOFOG = [0, 0, 0, 0];

// ------------------------------------------------------------------------------------------------
// Camera: position, yaw (heading; 0 = world -Y = "north" = screen-up of the top-down pivot),
// pitch (-PI/2 = looking straight down), focal length f in design units, principal point.
// ------------------------------------------------------------------------------------------------
export function makeCam(pos, yaw, pitch, f, cx = 960, cy = 540) {
  const hx = Math.sin(yaw), hy = -Math.cos(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const right = [Math.cos(yaw), Math.sin(yaw), 0];
  const fwd = [cp * hx, cp * hy, sp];
  const up = [-sp * hx, -sp * hy, cp];
  const [px, py, pz] = pos;
  const cam = {
    pos, yaw, pitch, f, cx, cy, right, fwd, up,
    // homogeneous design-unit coords: screen = (h[0]/h[2], h[1]/h[2])
    hom(x, y, z) {
      const dx = x - px, dy = y - py, dz = z - pz;
      const xc = dx * right[0] + dy * right[1];
      const yc = -(dx * up[0] + dy * up[1] + dz * up[2]);
      const zc = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
      return [cx * zc + f * xc, cy * zc + f * yc, zc];
    },
    depth(x, y, z) { return (x - px) * fwd[0] + (y - py) * fwd[1] + (z - pz) * fwd[2]; },
    // screen position [x, y, depth] (depth <= 0: behind the camera)
    toScreen(x, y, z) {
      const h = cam.hom(x, y, z);
      return [h[0] / h[2], h[1] / h[2], h[2]];
    },
    // design units per world unit for an object at depth z
    scaleAt(z) { return f / z; },
  };
  return cam;
}

// ------------------------------------------------------------------------------------------------
export class R3 {
  static get(gl) { return gl.__cityR3 || (gl.__cityR3 = new R3(gl)); }
  constructor(gl) {
    this.gl = gl;
    this.prog = compile(gl, VS, FS, 'city3d');
    this.cap = 1 << 15;
    this.data = new Float32Array(this.cap * FLOATS);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS * 4;
    const attr = (loc, size, off) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off * 4);
    };
    attr(0, 3, 0); attr(1, 4, 3); attr(2, 4, 7); attr(3, 4, 11); attr(4, 2, 15);
    gl.bindVertexArray(null);
    this.white = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.white);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.n = 0;
    this.key = null;
    this.draws = 0;
  }

  // Start a batch sequence for this render context + camera.
  begin(R, cam) {
    this.R = R;
    this.cam = cam;
    this.aff = M.mul(R.comp.ndc, R.view);
    this.n = 0;
    this.key = null;
  }

  setCam(cam) { this.cam = cam; }

  _state(tex, o) {
    const mask = o.mask ? o.mask.tex || o.mask : null;
    const mode = o.mode ?? (mask ? 1 : 0);
    const blend = o.blend || 'normal';
    const soft = o.soft ?? 0.02;
    const t = tex ? tex.tex || tex : this.white;
    return { t, mask, mode, blend, soft, id: `${mode}|${blend}|${soft}` };
  }

  _same(a, b) { return a && b && a.t === b.t && a.mask === b.mask && a.id === b.id; }

  // Convex planar polygon: pts [[x,y,z],..] world, uvs [[u,v],..] in 0..1 layer space.
  // o: { tint:[r,g,b,a], fog:[r,g,b,amt], mask:layer, uv2:[[u,v],..], rev:[..]|number, thr, mode, soft, blend }
  poly(tex, pts, uvs, o = {}) {
    const n = pts.length;
    if (n < 3) return;
    const cam = this.cam, A = this.aff;
    // project; skip if entirely behind the camera
    const H = new Array(n);
    let front = 0;
    for (let i = 0; i < n; i++) {
      const h = cam.hom(pts[i][0], pts[i][1], pts[i][2]);
      if (h[2] > 1e-3) front++;
      H[i] = [A[0] * h[0] + A[2] * h[1] + A[4] * h[2], A[1] * h[0] + A[3] * h[1] + A[5] * h[2], h[2]];
    }
    if (!front) return;
    const st = this._state(tex, o);
    if (!this._same(st, this.key)) {
      this.flush();
      this.key = st;
    }
    const need = (n - 2) * 3;
    if (this.n + need > this.cap) this.flush(), (this.key = st);
    const tint = o.tint || WHITE_T, fog = o.fog || NOFOG;
    const uv2 = o.uv2 || uvs;
    const rev = o.rev ?? 0, thr = o.thr ?? 1e9;
    const d = this.data;
    const put = (i) => {
      const k = this.n * FLOATS;
      const h = H[i];
      d[k] = h[0]; d[k + 1] = h[1]; d[k + 2] = h[2];
      d[k + 3] = uvs[i][0]; d[k + 4] = uvs[i][1]; d[k + 5] = uv2[i][0]; d[k + 6] = uv2[i][1];
      const tn = Array.isArray(tint[0]) ? tint[i] : tint;
      d[k + 7] = tn[0]; d[k + 8] = tn[1]; d[k + 9] = tn[2]; d[k + 10] = tn[3] ?? 1;
      const fg = Array.isArray(fog[0]) ? fog[i] : fog;
      d[k + 11] = fg[0]; d[k + 12] = fg[1]; d[k + 13] = fg[2]; d[k + 14] = fg[3] ?? 0;
      d[k + 15] = Array.isArray(rev) ? rev[i] : rev; d[k + 16] = Array.isArray(thr) ? thr[i] : thr;
      this.n++;
    };
    for (let i = 1; i < n - 1; i++) { put(0); put(i); put(i + 1); }
  }

  // Axis-aligned rectangle of a layer placed in 3D by an origin + two edge vectors (u along e1, v along e2).
  quad(tex, p0, e1, e2, uv = [0, 0, 1, 1], o = {}) {
    const P = [
      p0,
      [p0[0] + e1[0], p0[1] + e1[1], p0[2] + e1[2]],
      [p0[0] + e1[0] + e2[0], p0[1] + e1[1] + e2[1], p0[2] + e1[2] + e2[2]],
      [p0[0] + e2[0], p0[1] + e2[1], p0[2] + e2[2]],
    ];
    const U = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
    this.poly(tex, P, U, o);
  }

  flush() {
    if (!this.n || !this.key) { this.n = 0; return; }
    const gl = this.gl, st = this.key, pr = this.prog;
    gl.useProgram(pr.prog);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * FLOATS));
    gl.blendEquation(gl.FUNC_ADD);
    if (st.blend === 'add') gl.blendFunc(gl.ONE, gl.ONE);
    else if (st.blend === 'multiply') gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, st.mask || this.white);
    gl.uniform1i(pr.u.u_mask, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, st.t);
    gl.uniform1i(pr.u.u_tex, 0);
    gl.uniform1i(pr.u.u_mode, st.mode);
    gl.uniform1f(pr.u.u_soft, st.soft);
    gl.uniform1f(pr.u.u_add, st.blend === 'add' ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, this.n);
    gl.bindVertexArray(null);
    this.draws++;
    this.n = 0;
  }

  end() {
    this.flush();
    this.key = null;
  }
}
