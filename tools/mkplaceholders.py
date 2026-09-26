# Creates placeholder segment scenes + film.js from the segment table (run once).
import os
root = os.path.join(os.path.dirname(__file__), '..', 'web', 'src')
segs = [
    ('earth', 'star', 'cell', 30, 52.5),
    ('sea', 'cell', 'eye', 52.5, 70),
    ('land', 'eye', 'ash', 70, 85),
    ('ancestors', 'ash', 'night', 85, 97.5),
    ('hunt', 'night', 'fields', 97.5, 107.5),
    ('city', 'fields', 'gear', 107.5, 117.5),
    ('machine', 'gear', 'die', 117.5, 130),
    ('mind', 'die', 'singularity', 130, 145),
]
for seg, a, b, t0, t1 in segs:
    d = os.path.join(root, 'scenes', seg)
    os.makedirs(d, exist_ok=True)
    f = os.path.join(d, 'index.js')
    if os.path.exists(f) and 'PLACEHOLDER' not in open(f, encoding='utf8').read():
        continue  # never overwrite a real scene
    open(f, 'w', encoding='utf8').write(
        f"// PLACEHOLDER for segment '{seg}' ({t0}-{t1} s). Replace with the real scene.\n"
        f"import {{ PIVOT }} from '../pivots.js';\n"
        f"import {{ placeholder }} from '../_placeholder.js';\n"
        f"export const scene = placeholder('{seg}', PIVOT.{a}, PIVOT.{b}, {t1 - t0});\n")
imports = "\n".join(f"import {{ scene as {s[0]} }} from './scenes/{s[0]}/index.js';" for s in segs)
rows = "\n".join(f"  {{ id: '{s[0]}', scene: {s[0]}, start: {s[3]}, end: {s[4]} }}," for s in segs)
open(os.path.join(root, 'film.js'), 'w', encoding='utf8').write(f"""// The film: one shot per segment. Segments hand off through shared PIVOT states (scenes/pivots.js),
// transforming into / out of them - no cross-fades, wipes or dissolves anywhere.
// Timing grid: 96 BPM, 4/4 -> one bar = 2.5 s. All segment boundaries sit on bar lines.
import {{ Film }} from './engine/film.js';
import {{ cosmos }} from './scenes/cosmos.js';
{imports}
import {{ captions }} from './captions.js';

export const SEGMENTS = [
  {{ id: 'cosmos', scene: cosmos, start: 0, end: 30 }},
{rows}
];

export async function buildFilm() {{
  return new Film({{ fps: 30, duration: 145, shots: SEGMENTS, overlays: captions() }});
}}
""")
print('ok')
