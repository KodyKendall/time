// Image generation for painted plates (backgrounds, character cut-outs) via the OpenAI Images API.
// Every call is recorded in web/assets/<film>/manifest.json with its prompt, references, token
// usage and cost, and the film's total spend is checked against --budget before anything is sent.
//
//   node tools/gen.mjs --film tether --id bg1 --prompt "..." [--ref img.jpg --ref img2.png]
//                      [--n 2] [--quality low|medium|high] [--size 1536x1024] [--transparent]
//                      [--model gpt-image-2] [--budget 3] [--style character]
//   node tools/gen.mjs --film tether --spend          # print spend so far
//
// --transparent: gpt-image-1.5 returns real transparency; gpt-image-2 can't, so it paints on a flat
// magenta "green screen" that tools/plate_tools.py key then removes (files written as *_keyed.png).
//
// The film's style preamble (web/assets/<film>/style.txt) is prepended to every prompt, so all
// plates share one look. With --ref the request goes to /images/edits and the references guide
// composition and style; without, to /images/generations.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const argv = process.argv.slice(2);
const args = { ref: [] };
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  if (k === 'ref') args.ref.push(v);
  else args[k] = v;
}

const film = args.film || 'tether';
const DIR = path.join(ROOT, 'web', 'assets', film);
const MANIFEST = path.join(DIR, 'manifest.json');
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { film, items: [] };
const spent = () => manifest.items.reduce((s, it) => s + (it.cost_usd ?? it.estimated_cost_usd ?? 0), 0);

if (args.spend) {
  console.log(`${film}: ${manifest.items.length} calls, $${spent().toFixed(3)} spent/reserved`);
  process.exit(0);
}

const model = args.model || 'gpt-image-2';
const quality = args.quality || 'low';   // low by default: cheap; ask for medium only for keepers
const size = args.size || '1536x1024';
const n = +(args.n || 1);
const budget = +(args.budget || 3);
if (!args.id || !args.prompt) throw new Error('need --id and --prompt');
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');

// Per-1M-token rates for gpt-image-2 (text in, image in, image out). Used only to log spend.
const RATE = { text: 5, image: 8, out: 32 };
// Rough pre-flight estimate per output image, so one call can't blow the budget.
const EST = { low: 0.02, medium: 0.07, high: 0.25 }[quality] * n;
if (spent() + EST > budget) {
  throw new Error(`budget: $${spent().toFixed(2)} spent + ~$${EST.toFixed(2)} for this call > $${budget}`);
}

// --style character -> style-character.txt (cut-outs); default style.txt (background plates)
const stylePath = path.join(DIR, args.style ? `style-${args.style}.txt` : 'style.txt');
const style = fs.existsSync(stylePath) ? fs.readFileSync(stylePath, 'utf8').trim() : '';
const NATIVE_ALPHA = model !== 'gpt-image-2';
const chroma = args.transparent && !NATIVE_ALPHA;
const KEY_NOTE = 'Background: a perfectly flat, uniform, solid pure magenta (#FF00FF) fill behind the subject, edge to edge: no gradient, no texture, no shadow, no ground, no other colour. Do not use magenta anywhere in the subject.';
const prompt = [style, args.prompt, chroma ? KEY_NOTE : ''].filter(Boolean).join('\n\n').replace(/isolated on a fully transparent background/gi, 'isolated on a flat magenta background');

let res;
if (args.ref.length) {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('n', String(n));
  form.append('size', size);
  form.append('quality', quality);
  if (args.transparent && NATIVE_ALPHA) form.append('background', 'transparent');
  for (const r of args.ref) {
    const buf = fs.readFileSync(path.resolve(ROOT, r));
    const type = r.endsWith('.png') ? 'image/png' : r.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    form.append('image[]', new Blob([buf], { type }), path.basename(r));
  }
  res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form,
  });
} else {
  res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, n, size, quality, ...(args.transparent && NATIVE_ALPHA ? { background: 'transparent' } : {}) }),
  });
}
const json = await res.json();
if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(json.error || json)}`);

const u = json.usage || {};
const d = u.input_tokens_details || {};
const textIn = d.text_tokens ?? (u.input_tokens || 0) - (d.image_tokens || 0);
const cost = (textIn * RATE.text + (d.image_tokens || 0) * RATE.image + (u.output_tokens || 0) * RATE.out) / 1e6;

fs.mkdirSync(path.join(DIR, 'gen'), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const files = json.data.map((img, i) => {
  const rel = path.join('gen', `${args.id}_${stamp}_${i}.png`);
  fs.writeFileSync(path.join(DIR, rel), Buffer.from(img.b64_json, 'base64'));
  return rel;
});

manifest.items.push({
  id: args.id, files, model, quality, size, n, transparent: !!args.transparent,
  prompt: args.prompt, refs: args.ref, usage: u, cost_usd: +cost.toFixed(4), created: new Date().toISOString(),
});
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

for (const f of files) console.log('wrote', path.relative(ROOT, path.join(DIR, f)));
if (chroma) {
  const { execFileSync } = await import('node:child_process');
  for (const f of files) {
    const src = path.join(DIR, f), dst = src.replace(/\.png$/, '_keyed.png');
    execFileSync('python3', [path.join(ROOT, 'tools', 'plate_tools.py'), 'key', src, dst]);
    console.log('keyed', path.relative(ROOT, dst));
  }
}
console.log(`cost $${cost.toFixed(3)} · ${film} total spent/reserved $${spent().toFixed(3)} of $${budget}`);
