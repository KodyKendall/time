// Projective painted cards for the machine segment.
//
// The engine compositor only draws layers through 2D affine transforms. A painted card that is
// seen in perspective (a rack face down a corridor, the floor, a tilting camera) needs a
// projective map, so this module adds one tiny WebGL2 program that draws a painted layer (or a
// flat colour) through a 3x3 homography with perspective-correct texture mapping.
// It shares the compositor's GL context and current render target; every call sets all the state
// it needs, and the compositor re-sets its own state on each of its draws.
// (Engine suggestion: a `comp.quad(L, H, o)` primitive would make this local helper unnecessary.)
import { hex } from '../../engine/math.js';

const VS = `#version 300 es
uniform mat3 u_H;        // (u,v,1) -> (x*w, y*w, w) in design units
uniform mat3 u_ndc;      // design units -> NDC (affine)
uniform vec2 u_poly[8];  // polygon in (u,v) card space, drawn as a triangle fan
uniform vec4 u_uv;       // texture sub-rect
out vec2 v_uv;
out vec2 v_st;
void main(){
  vec2 st = u_poly[gl_VertexID];
  vec3 h = u_H * vec3(st, 1.0);
  vec3 n = u_ndc * h;    // affine on homogeneous coords: (ndc*w, w)
  gl_Position = vec4(n.xy, 0.0, h.z);
  v_st = st;
  v_uv = mix(u_uv.xy, u_uv.zw, st);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_st;
uniform sampler2D u_tex;
uniform int u_solid;
uniform vec4 u_col;       // solid colour (premultiplied later)
uniform float u_opacity;
uniform float u_add;
uniform vec3 u_grade;     // saturation, brightness, contrast
uniform vec4 u_tint;
uniform vec4 u_color;     // colourise rgb, amount
uniform vec4 u_edge;      // soft card edges in st units: left, right, top, bottom (0 = hard)
uniform vec4 u_fog;       // near, far, amount, (unused)   - atmospheric depth haze
uniform vec3 u_fogCol;
out vec4 o;
vec3 grade(vec3 rgb){
  float l = dot(rgb, vec3(0.299, 0.587, 0.114));
  rgb = mix(vec3(l), rgb, u_grade.x);
  rgb = (rgb - 0.5) * u_grade.z + 0.5;
  rgb = max(rgb, 0.0) * u_grade.y;
  rgb *= u_tint.rgb;
  rgb = mix(rgb, u_color.rgb, u_color.a);
  return rgb;
}
void main(){
  vec4 c = u_solid == 1 ? vec4(u_col.rgb * u_col.a, u_col.a) : texture(u_tex, v_uv);
  if (c.a < 0.0005) discard;
  vec3 rgb = grade(c.rgb / c.a);
  if (u_fog.z > 0.0) {
    float depth = 1.0 / gl_FragCoord.w;
    float f = clamp((depth - u_fog.x) / (u_fog.y - u_fog.x), 0.0, 1.0);
    rgb = mix(rgb, u_fogCol, f * f * (3.0 - 2.0 * f) * u_fog.z);
  }
  float e = 1.0;
  if (u_edge.x > 0.0) e *= smoothstep(0.0, u_edge.x, v_st.x);
  if (u_edge.y > 0.0) e *= smoothstep(0.0, u_edge.y, 1.0 - v_st.x);
  if (u_edge.z > 0.0) e *= smoothstep(0.0, u_edge.z, v_st.y);
  if (u_edge.w > 0.0) e *= smoothstep(0.0, u_edge.w, 1.0 - v_st.y);
  float a = c.a * u_opacity * e;
  o = vec4(rgb * a, a * (1.0 - u_add));
}`;

function compile(gl, vs, fs) {
  const mk = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('machine quad shader: ' + gl.getShaderInfoLog(sh));
    return sh;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('machine quad link: ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
  }
  return { prog: p, u };
}

const cache = new WeakMap(); // gl -> program record
function prog(gl) {
  let rec = cache.get(gl);
  if (!rec) {
    rec = compile(gl, VS, FS);
    rec.vao = gl.createVertexArray();
    rec.white = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, rec.white);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    rec.polyBuf = new Float32Array(16);
    cache.set(gl, rec);
  }
  return rec;
}

const UNIT = [[0, 0], [1, 0], [1, 1], [0, 1]];

// Draw a card through homography H (row-major 3x3 as [a,b,c, d,e,f, g,h,i] mapping (u,v,1) ->
// (x*w, y*w, w) in screen design units). L: painted layer or null for a solid colour (o.color).
// o: { uv, opacity, blend, grade, tint, colorize, solid:[r,g,b,a], poly:[[u,v]...], edge:[l,r,t,b] }
export function drawCard(R, L, H, o = {}) {
  const comp = R.comp, gl = comp.gl;
  const P = prog(gl);
  const poly = o.poly || UNIT;
  if (poly.length < 3) return;
  gl.useProgram(P.prog);
  gl.bindVertexArray(P.vao);
  // blending (premultiplied, like the compositor)
  gl.blendEquation(gl.FUNC_ADD);
  if (o.blend === 'add') gl.blendFunc(gl.ONE, gl.ONE);
  else if (o.blend === 'screen') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
  else if (o.blend === 'multiply') gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
  else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  // column-major upload
  gl.uniformMatrix3fv(P.u.u_H, false, new Float32Array([H[0], H[3], H[6], H[1], H[4], H[7], H[2], H[5], H[8]]));
  const n = comp.ndc;
  gl.uniformMatrix3fv(P.u.u_ndc, false, new Float32Array([n[0], n[1], 0, n[2], n[3], 0, n[4], n[5], 1]));
  const pb = P.polyBuf;
  const cnt = Math.min(8, poly.length);
  for (let i = 0; i < cnt; i++) { pb[i * 2] = poly[i][0]; pb[i * 2 + 1] = poly[i][1]; }
  gl.uniform2fv(P.u.u_poly, pb);
  let uv = o.uv || [0, 0, 1, 1];
  if (L && L.flipY) uv = [uv[0], 1 - uv[1], uv[2], 1 - uv[3]];
  gl.uniform4f(P.u.u_uv, uv[0], uv[1], uv[2], uv[3]);
  const solid = !L;
  gl.uniform1i(P.u.u_solid, solid ? 1 : 0);
  const sc = o.solid ? (typeof o.solid === 'string' ? [...hex(o.solid), 1] : o.solid) : [1, 1, 1, 1];
  gl.uniform4f(P.u.u_col, sc[0], sc[1], sc[2], sc[3] ?? 1);
  gl.uniform1f(P.u.u_opacity, o.opacity ?? 1);
  gl.uniform1f(P.u.u_add, o.blend === 'add' ? 1 : 0);
  const g = o.grade || [1, 1, 1];
  gl.uniform3f(P.u.u_grade, g[0], g[1], g[2]);
  const tn = o.tint || [1, 1, 1];
  gl.uniform4f(P.u.u_tint, tn[0], tn[1], tn[2], 1);
  const cc = o.colorize || [0, 0, 0, 0];
  gl.uniform4f(P.u.u_color, cc[0], cc[1], cc[2], cc[3] ?? 0);
  const ed = o.edge || [0, 0, 0, 0];
  gl.uniform4f(P.u.u_edge, ed[0], ed[1], ed[2], ed[3]);
  const fg = o.fog || [0, 1, 0];
  gl.uniform4f(P.u.u_fog, fg[0], fg[1], fg[2], 0);
  const fc = o.fogCol || [0, 0, 0];
  gl.uniform3f(P.u.u_fogCol, fc[0], fc[1], fc[2]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, solid ? P.white : L.tex);
  gl.uniform1i(P.u.u_tex, 0);
  gl.drawArrays(gl.TRIANGLE_FAN, 0, cnt);
  gl.bindVertexArray(null);
  comp.stats.draws++;
}
