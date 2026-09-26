// Copies p5 + p5.brush into web/vendor and applies three small patches to p5.brush:
//  1. The spectral blend pass runs with blendMode(REPLACE) so its output is written verbatim.
//  2. The blend shader becomes transparency-aware (premultiplied output), so brushes can paint
//     onto transparent framebuffers ("layers") without mixing against an implicit white paper.
//     On opaque targets the result is identical to upstream.
//  3. flushActiveComposite() is exported as `flush`, so pending brush work can be committed
//     to the current target before switching to another one.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const vendor = path.join(root, 'web', 'vendor');
fs.mkdirSync(vendor, { recursive: true });

fs.copyFileSync(path.join(root, 'node_modules/p5/lib/p5.min.js'), path.join(vendor, 'p5.min.js'));

let src = fs.readFileSync(path.join(root, 'node_modules/p5.brush/dist/p5.brush.esm.js'), 'utf8');

function replaceOnce(haystack, needle, replacement, label) {
  const i = haystack.indexOf(needle);
  if (i < 0 || haystack.indexOf(needle, i + 1) >= 0) throw new Error(`patch "${label}" did not match exactly once`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
}

// 1. REPLACE blending during the composite pass.
src = replaceOnce(src,
  't.push(),t.translate(0,0),t.shader(e),e.setUniform("u_source",r)',
  't.push(),t.blendMode(t.REPLACE),t.translate(0,0),t.shader(e),e.setUniform("u_source",r)',
  'replace-blend');

// 2. Transparency-aware spectral composite (premultiplied alpha in and out).
src = replaceOnce(src,
  'vec3 bgColor=mix(vec3(1.0),source.rgb,source.a);outColor=vec4(spectral_mix(bgColor,pigment.rgb,mixIntensity),1.);',
  'if(source.a<0.004){outColor=vec4(pigment.rgb*mixIntensity,mixIntensity);return;}' +
  'float outA=mixIntensity+source.a*(1.0-mixIntensity);' +
  'vec3 srcC=clamp(source.rgb/source.a,0.0,1.0);' +
  'float fk=clamp(mixIntensity/outA,0.0,1.0);' +
  'outColor=vec4(spectral_mix(srcC,pigment.rgb,fk)*outA,outA);',
  'alpha-shader');

// 3. Export the composite flush.
const m = src.match(/,(\w+)=\(\)=>\{\w+\(\),\w+\.blend\(!1,!0\),\w+\.clearMask\(/);
if (!m) throw new Error('patch "flush-export": flushActiveComposite not found');
src = replaceOnce(src, 'export{', `export{${m[1]} as flush,`, 'flush-export');

// 4. Never cull strokes as "off canvas". The stock test adds the transform's pixel translation to
//    untransformed model coordinates (ignoring scale and the WEBGL centre origin), so strokes in
//    scaled / translated layers froze in place at some resolutions: dots and dashes at 4K with in-layer
//    transforms, strokes stopping early in low-res layers. Our strokes follow finite paths (no flow
//    field), so there is nothing to protect against; the GPU clips anything truly off-canvas.
{
  const mm = src.match(/isInCanvas\(\)\{[^}]*\}/g);
  if (!mm || mm.length !== 1) throw new Error('patch "no-cull": isInCanvas not found exactly once');
  src = replaceOnce(src, mm[0], 'isInCanvas(){return!0}', 'no-cull');
}

fs.writeFileSync(path.join(vendor, 'p5.brush.esm.js'), '// p5.brush 2.2.3 (MIT) — patched by tools/patch-brush.mjs\n' + src);
console.log('vendor ready:', fs.readdirSync(vendor).join(', '));
