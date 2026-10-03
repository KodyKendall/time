#!/usr/bin/env python3
"""Helpers for generated plates and cut-outs (process v2, see docs/PROCESS_V2.md). Standard library only.

  edge     python3 tools/plate_tools.py edge plate.png [--from 400] [--step 64]
           Prints the first "grass" row (green clearly above red and blue) in each sampled column:
           the top edge of a hill or clifftop, in plate pixels. Use it to stand a character on the ground.
           Noisy on pale or yellow grass; check against the image.

  parts    python3 tools/plate_tools.py parts sheet.png out_prefix [--min 4000]
           Splits a sheet of separately painted parts (a rig sheet) into one PNG per piece: connected
           opaque regions (found at quarter resolution), largest first, each cropped with padding.
           Prints each piece's file, size and where it sat on the sheet.

  key      python3 tools/plate_tools.py key in.png out.png
           "Green screen" for models that can't output transparency: the art is generated on a flat
           magenta background; this samples that colour from the border, turns everything near it
           transparent with a soft edge, and removes magenta spill from the edge pixels.

  unstring python3 tools/plate_tools.py unstring in.png out.png HX HY
           Image models draw a stub of kite string leaving the character's hands. Zeroes alpha in the
           quadrant above-right of the hands (x > HX+20, y < HY-14) so the engine's own string takes over.
"""
import struct
import sys
import zlib


def load(path):
    """Decode an 8-bit RGB/RGBA, non-interlaced PNG. Returns (W, H, bytes_per_pixel, rows)."""
    d = open(path, 'rb').read()
    i, idat = 8, b''
    while i < len(d):
        n, = struct.unpack('>I', d[i:i + 4])
        t, c = d[i + 4:i + 8], d[i + 8:i + 8 + n]
        i += 12 + n
        if t == b'IHDR':
            W, H, bd, ct = struct.unpack('>IIBB', c[:10])
            assert bd == 8 and ct in (2, 6), f'{path}: only 8-bit RGB/RGBA supported'
        elif t == b'IDAT':
            idat += c
    bpp = {2: 3, 6: 4}[ct]
    raw, st = zlib.decompress(idat), W * bpp
    rows, prev, o = [], bytearray(st), 0
    for _ in range(H):
        f = raw[o]; o += 1
        line = bytearray(raw[o:o + st]); o += st
        for x in range(st):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    return W, H, bpp, rows


def save_rgba(path, W, H, rows):
    def chunk(t, data):
        return struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)
    raw = b''.join(b'\x00' + bytes(r) for r in rows)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0))
                           + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))


def edge(path, y0=400, step=64):
    W, H, bpp, rows = load(path)
    for x in range(0, W, step):
        for y in range(y0, H):
            r, g, b = rows[y][x * bpp:x * bpp + 3]
            if g > r + 25 and g > b + 15:
                print(x, y)
                break


def unstring(src, dst, hx, hy):
    W, H, bpp, rows = load(src)
    assert bpp == 4, 'cut-out must have an alpha channel'
    for y in range(0, max(0, hy - 14)):
        for x in range(hx + 20, W):
            rows[y][x * 4 + 3] = 0
    save_rgba(dst, W, H, rows)
    print('wrote', dst)


def key(src, dst, t0=40, t1=110):
    W, H, bpp, rows = load(src)
    # background colour: median of the border pixels
    border = [rows[y][x * bpp:x * bpp + 3] for y in (0, H - 1) for x in range(0, W, 8)] + \
             [rows[y][x * bpp:x * bpp + 3] for x in (0, W - 1) for y in range(0, H, 8)]
    bg = [sorted(p[i] for p in border)[len(border) // 2] for i in range(3)]
    out = []
    for y in range(H):
        r = rows[y]
        o = bytearray(W * 4)
        for x in range(W):
            R, G, B = r[x * bpp], r[x * bpp + 1], r[x * bpp + 2]
            d = ((R - bg[0]) ** 2 + (G - bg[1]) ** 2 + (B - bg[2]) ** 2) ** 0.5
            a = 0 if d <= t0 else 255 if d >= t1 else int(255 * ((d - t0) / (t1 - t0)) ** 1.5)
            if 0 < a < 255 or (a == 255 and d < t1 * 1.6):
                # spill: magenta pushes red and blue above green at the edges; pull them back
                m = min(R, B)
                if m > G:
                    k = (m - G) * (1 - a / 255 * 0.6)
                    R, B = int(R - k), int(B - k)
            o[x * 4:x * 4 + 4] = bytes((max(0, R), G, max(0, B), a))
        out.append(o)
    save_rgba(dst, W, H, out)
    print('keyed', dst, 'bg', bg)


def parts(src, prefix, min_area=4000):
    W, H, bpp, rows = load(src)
    assert bpp == 4, 'sheet must have an alpha channel'
    st = 4                                   # label on a coarse grid, then crop at full res
    gw, gh = W // st, H // st
    grid = [[rows[y * st][(x * st) * 4 + 3] > 40 for x in range(gw)] for y in range(gh)]
    seen = [[False] * gw for _ in range(gh)]
    comps = []
    for y in range(gh):
        for x in range(gw):
            if grid[y][x] and not seen[y][x]:
                stack, cells = [(x, y)], []
                seen[y][x] = True
                while stack:
                    cx, cy = stack.pop()
                    cells.append((cx, cy))
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1), (cx + 1, cy + 1), (cx - 1, cy - 1), (cx + 1, cy - 1), (cx - 1, cy + 1)):
                        if 0 <= nx < gw and 0 <= ny < gh and grid[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
                if len(cells) * st * st >= min_area:
                    comps.append(cells)
    comps.sort(key=len, reverse=True)
    for i, cells in enumerate(comps):
        xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
        pad = 12
        x0, y0 = max(0, min(xs) * st - pad), max(0, min(ys) * st - pad)
        x1, y1 = min(W, (max(xs) + 1) * st + pad), min(H, (max(ys) + 1) * st + pad)
        out = [bytearray(r[x0 * 4:x1 * 4]) for r in rows[y0:y1]]
        f = f'{prefix}_{i}.png'
        save_rgba(f, x1 - x0, y1 - y0, out)
        print(f, f'{x1 - x0}x{y1 - y0}', 'at', (x0, y0))


if __name__ == '__main__':
    a = sys.argv[1:]
    opt = lambda k, d: int(a[a.index(k) + 1]) if k in a else d
    if a and a[0] == 'edge':
        edge(a[1], opt('--from', 400), opt('--step', 64))
    elif a and a[0] == 'parts':
        parts(a[1], a[2], opt('--min', 4000))
    elif a and a[0] == 'key':
        key(a[1], a[2])
    elif a and a[0] == 'unstring':
        unstring(a[1], a[2], int(a[3]), int(a[4]))
    else:
        print(__doc__)
