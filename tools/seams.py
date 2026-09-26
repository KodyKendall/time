# Seam checker: renders frames around each segment boundary and reports frame-to-frame change,
# so a hand-off that "jumps" (a cut instead of a transformation) stands out from normal motion.
#   python tools/seams.py [--w 960] [--b 30,52.5] [--frames 3] [--reuse]
# Writes out/seams/seam_<b>.png strips (frames around each boundary) and prints a table:
#   diff = mean |dRGB| (0-255, grain filtered) between consecutive frames; jump = boundary diff / median of others.
import argparse, os, subprocess, sys
from statistics import median
from PIL import Image, ImageChops, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
ap = argparse.ArgumentParser()
ap.add_argument('--w', type=int, default=960)
ap.add_argument('--b', default='30,52.5,70,85,97.5,107.5,117.5,130')
ap.add_argument('--frames', type=int, default=3, help='frames on each side of the boundary')
ap.add_argument('--reuse', action='store_true', help='reuse stills from a previous run')
a = ap.parse_args()
B = [float(x) for x in a.b.split(',')]
offs = list(range(-a.frames, a.frames))  # frame b+o for o in [-n, n-1]; boundary step is (-1 -> 0)
ts = {b: [b + o / FPS for o in offs] for b in B}
name = lambda t: os.path.join(ROOT, 'out', 'stills', f'seam_{t:.2f}.png')

if not a.reuse:
    cmd = ['node', 'tools/cli.mjs', 'still', '--film', 'film', '--w', str(a.w), '--name', 'seam', '--strict', '1']
    for b in B:
        for t in ts[b]:
            cmd += ['--t', f'{t:.5f}']
    r = subprocess.run(cmd, cwd=ROOT)
    if r.returncode:
        sys.exit(r.returncode)

os.makedirs(os.path.join(ROOT, 'out', 'seams'), exist_ok=True)
def diff(p, q):
    # compare 8x box-reduced frames so film grain (reseeded at 12 fps) doesn't mask real change
    d = ImageChops.difference(p.reduce(8), q.reduce(8))
    return sum(ImageStat.Stat(d).mean[:3]) / 3

print(f"{'boundary':>9}  {'diffs (... | boundary | ...)':<48} {'jump':>6}")
worst = 0
for b in B:
    ims = [Image.open(name(t)).convert('RGB') for t in ts[b]]
    ds = [diff(ims[i], ims[i + 1]) for i in range(len(ims) - 1)]
    k = a.frames - 1  # index of the (b-1 -> b) step
    # film grain is reseeded at 12 fps (and always at a boundary, since boundaries are multiples of 2.5 s):
    # compare the boundary step against other steps that also reseed the grain, if there are any
    seed = [int(t * 12 + 1e-6) for t in ts[b]]
    reseed = [seed[i] != seed[i + 1] for i in range(len(ds))]
    others = [d for i, d in enumerate(ds) if i != k and reseed[i] == reseed[k]] or [d for i, d in enumerate(ds) if i != k]
    jump = ds[k] / max(median(others), 0.25)
    worst = max(worst, jump)
    cells = ' '.join(f"[{d:5.2f}]" if i == k else f"{d:5.2f}" for i, d in enumerate(ds))
    flag = '  <-- CHECK' if jump > 2.5 else ''
    print(f"{b:9.2f}  {cells:<48} {jump:6.2f}{flag}")
    # strip of the two frames either side of the boundary, for eyeballing
    w, h = ims[0].size
    tw = 480
    th = round(h * tw / w)
    strip = Image.new('RGB', (tw * 4 + 30, th), (40, 40, 40))
    for j, im in enumerate(ims[k - 1:k + 3]):
        strip.paste(im.resize((tw, th), Image.LANCZOS), (j * tw + (30 if j >= 2 else 0), 0))
    strip.save(os.path.join(ROOT, 'out', 'seams', f'seam_{b:g}.png'))
print(f"\nworst jump ratio {worst:.2f} (<= 2.5 reads as continuous motion)")
