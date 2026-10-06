// Text-to-speech narration via the ElevenLabs API (SDK: @elevenlabs/elevenlabs-js).
// Every call is recorded in audio/build/tts/manifest.json with its text, voice,
// model and character usage, and the running total is checked against --budget.
//
//   node tools/tts.mjs --text "The first move is what sets everything in motion." [--id line01]
//                      [--voice DODLEQrClDo8wCz460ld] [--model eleven_v4 | --turbo]
//                      [--emotion "[quiet, reflective narration]"] [--stability 0.5] [--speed 1.0]
//                      [--out audio/build/tts/line01.mp3] [--play] [--budget 5]
//   node tools/tts.mjs --spend                # print spend so far
//   node tools/tts.mjs --voices                # list available voices (id + name)
//
// Emotions on v4 are directed with audio tags inline in the text, e.g.
// "[softly, with wonder] On the table sat a single lantern, already lit."
// --emotion prepends a tag so narration scripts stay clean. See
// skills/elevenlabs-voice-narration/SKILL.md for the full tag guide.
//
// Auth: ELEVENLABS_API_KEY env var, or a local .env file with ELEVENLABS_API_KEY=...
// (never commit the key; .env is gitignored). Get a key at https://elevenlabs.io/app/settings/api-keys
import fs from 'node:fs';
import path from 'node:path';
import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Minimal .env loader (no dependency): KEY=value lines,ignores comments/blanks.
for (const p of [path.join(ROOT, '.env'), path.join(process.cwd(), '.env')]) {
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !m[1].startsWith('#') && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  args[k] = v;
}

const DIR = path.join(ROOT, 'audio', 'build', 'tts');
const MANIFEST = path.join(DIR, 'manifest.json');
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { items: [] };
const spentChars = () => manifest.items.reduce((s, it) => s + (it.characters ?? 0), 0);
// ~$0.30 per 1k chars on Creator tier is a rough ceiling; flags/budgets use characters.
const EST_COST = (chars) => (chars / 1000) * 0.30;

if (args.spend) {
  console.log(`tts: ${manifest.items.length} calls, ${spentChars()} chars (~$${EST_COST(spentChars()).toFixed(2)} ceiling)`);
  process.exit(0);
}

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY is not set (env var or .env file). See header of tools/tts.mjs.');
}
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

if (args.voices) {
  const { voices } = await elevenlabs.voices.getAll();
  for (const v of voices) console.log(v.voiceId, '-', v.name);
  process.exit(0);
}

const LAUREN = 'DODLEQrClDo8wCz460ld'; // Lauren — Friendly, Comforting and Soft (project default)
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || LAUREN;
let text = args.text || (args.file ? fs.readFileSync(path.resolve(ROOT, args.file), 'utf8') : null);
if (!text) throw new Error('need --text "..." or --file <txt>');
if (args.emotion) text = `[${args.emotion.replace(/^\[|\]$/g, '')}] ${text}`;
const voiceId = args.voice || DEFAULT_VOICE;
// eleven_v4: most expressive, emotion via audio tags; eleven_v4_turbo trades some quality for latency.
const modelId = args.model || (args.turbo ? 'eleven_v4_turbo' : 'eleven_v4');
const budget = +(args.budget || 5); // dollars, rough ceiling estimate
if (EST_COST(spentChars() + text.length) > budget) {
  throw new Error(`budget: ~$${EST_COST(spentChars()).toFixed(2)} used + ~$${EST_COST(text.length).toFixed(2)} for this call > $${budget}`);
}

const voiceSettings = {};
if (args.stability) voiceSettings.stability = +args.stability;
if (args.similarity) voiceSettings.similarityBoost = +args.similarity;
if (args.speed) voiceSettings.speed = +args.speed; // 0.7–1.2, 1.0 = natural pace
const audio = await elevenlabs.textToSpeech.convert(voiceId, {
  text,
  modelId,
  outputFormat: args.format || 'mp3_44100_128',
  ...(Object.keys(voiceSettings).length ? { voiceSettings } : {}),
  ...(args.seed ? { seed: +args.seed } : {}),
  ...(args.prev ? { previousText: args.prev } : {}),
  ...(args.next ? { nextText: args.next } : {}),
});

if (args.play === 'true' || (!args.out && !args.id)) {
  await play(audio);
  process.exit(0);
}

fs.mkdirSync(DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const id = args.id || `line_${stamp}`;
const out = args.out || path.join(DIR, `${id}.mp3`);

// The SDK returns a Node Readable stream; collect and write it.
const chunks = [];
for await (const chunk of audio) chunks.push(chunk);
fs.writeFileSync(out, Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c)))));

manifest.items.push({
  id, file: path.relative(ROOT, out), voiceId, modelId,
  characters: text.length, text: text.slice(0, 500), created: new Date().toISOString(),
});
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

console.log('wrote', path.relative(ROOT, out), `(${text.length} chars, ~$${EST_COST(text.length).toFixed(3)} ceiling)`);
if (args.play) await play(fs.createReadStream(out));
