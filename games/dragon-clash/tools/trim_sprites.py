"""Trim the empty space around the HD sprite dragons' frames.

Each sheet in assets/dragons/<id>/ holds 384 px cells, most of which is transparent. This crops every frame of a
sheet to the union of its opaque pixels (plus a small margin), rewrites the sheet with the smaller cells and records
the crop in manifest.json as cw/ch (cell size) and ox/oy (where the crop sits in the original 384 px cell). Foot rows
(`bot`) and the body centre (`cx`) stay in original-cell coordinates, so js/sprite.js only adds the offset.

Running it again is safe: already-trimmed sheets are skipped.   python3 games/dragon-clash/tools/trim_sprites.py
"""
import json, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'dragons')
PAD = 3

def trim(dragon):
    d = os.path.join(ROOT, dragon)
    mp = os.path.join(d, 'manifest.json')
    man = json.load(open(mp))
    anims = man.get('anims', man)
    for name, m in anims.items():
        if not isinstance(m, dict) or 'ox' in m:
            continue
        path = os.path.join(d, name + '.png')
        im = Image.open(path).convert('RGBA')
        cols, n = m['cols'], m['n']
        rows = (n + cols - 1) // cols
        cw, ch = im.width // cols, im.height // rows
        alpha = im.getchannel('A').point(lambda v: 255 if v > 3 else 0)
        box = None
        for i in range(n):
            x0, y0 = (i % cols) * cw, (i // cols) * ch
            b = alpha.crop((x0, y0, x0 + cw, y0 + ch)).getbbox()
            if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        if box is None:
            continue
        bx0, by0 = max(0, box[0] - PAD), max(0, box[1] - PAD)
        bx1, by1 = min(cw, box[2] + PAD), min(ch, box[3] + PAD)
        tw, th = bx1 - bx0, by1 - by0
        out = Image.new('RGBA', (tw * cols, th * rows), (0, 0, 0, 0))
        for i in range(n):
            x0, y0 = (i % cols) * cw, (i // cols) * ch
            out.paste(im.crop((x0 + bx0, y0 + by0, x0 + bx1, y0 + by1)), ((i % cols) * tw, (i // cols) * th))
        out.save(path, optimize=True)
        m.update({'cw': tw, 'ch': th, 'ox': bx0, 'oy': by0, 'cell': cw})
        print(f'{dragon}/{name}: {cw}x{ch} -> {tw}x{th}')
    json.dump(man, open(mp, 'w'), separators=(',', ':'))

for dragon in (sys.argv[1:] or sorted(os.listdir(ROOT))):
    if os.path.isdir(os.path.join(ROOT, dragon)):
        trim(dragon)
