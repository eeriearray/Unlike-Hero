#!/usr/bin/env python3
"""Turn the supplied Dragon Warrior idle sheet into Dragon Clash's layered, recolorable character art.

Input:  tools/source/dragon-warrior-idle.png   (4800x4800, 10x10 grid of 480px cells, 97 frames, right-facing)
Output: assets/warrior/*.png + assets/warrior/rig.js

The pack only contains an idle animation. Everything else (run, attacks, hit reactions, victory) is built
in the game from this art plus procedural transforms and modular parts. This script does three things:

1. Splits every pixel into a colour class, so any palette can be applied without losing the hand-drawn shading:
     main   – the green scales          → tinted with the dragon's primary colour
     belly  – the yellow-green chest    → tinted with the belly colour (derived from primary/secondary)
     accent – the gold horns/spikes/plates → tinted with the secondary colour
     fixed  – outlines, claws, eyes, deep shadows → kept as drawn
   Class layers are stored as grey shading (brightness normalised per class) so the game can tint them with
   canvas 'multiply' compositing. No pixel reads are needed at runtime, so it also works from file://.
2. Cuts the original horns and tail out into their own layers. They become the "Warrior horns" and "Warrior tail"
   parts: one option among many, and the tail swings independently of the body.
3. Measures anchor points per frame (head, snout, eye, mouth, upper back, hip) so modular parts drawn by the game
   stay attached while the body breathes.

Run:  python3 tools/process_pack.py      (needs Pillow)
"""
import colorsys, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE_DIR = os.environ.get('DC_SOURCE_DIR', os.path.join(HERE, 'source'))
SRC = os.path.join(SOURCE_DIR, 'dragon-warrior-idle.png')
OUT = os.environ.get('DC_OUT_DIR', os.path.join(HERE, '..', 'assets', 'warrior'))

CELL = 480            # source cell size
COLS = 10
FRAMES_IN_PACK = 97
FRAMES = 24           # frames kept for the idle loop (evenly sampled)
CROP = (30, 140, 350, 450)   # region of each cell that holds the dragon (x0, y0, x1, y1)
SCALE = 0.5           # world units per source pixel (all rig coordinates are in these units)
RES = 1.4             # image pixels per world unit, so art stays sharp when the camera zooms in
OUT_COLS = 6

# Geometry used to separate parts (source-cell coordinates, measured on the pack)
TAIL_CUT_X = 189      # tail pixels are left of the standing leg...
TAIL_CUT_Y = 368      # ...below the hand...
TAIL_FOOT_Y = 419     # ...and above the toes (the tail tip, left of x=170, may dip lower)
HORN_CUT_Y = 199      # everything above this line on the head is horn
HEAD_BOX = (200, 150, 330, 250)


def classify(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    h *= 360
    if v < 0.16:
        return 'fixed', v
    if 18 <= h <= 66 and s >= 0.42 and v >= 0.33:
        return 'accent', v
    if 62 < h < 100 and v >= 0.33 and s >= 0.22:
        return 'belly', v
    if 86 <= h <= 175 and s >= 0.22:
        return 'main', v
    return 'fixed', v


def frame_cell(sheet, i):
    c, r = i % COLS, i // COLS
    return sheet.crop((c * CELL, r * CELL, c * CELL + CELL, r * CELL + CELL))


# ───────────────────────── Cutout rig from frame 0 ─────────────────────────
# The pack has no run/attack/hurt frames, so the body is cut into articulated parts along its anatomy and
# animated with joints. Polygons and joints are in source-cell pixels, measured on frame 0.
# Draw order and parents live in the game (js/rig.js); this only cuts, fills and packs the art.
PARTS = [
    # name,        parent,    pivot (joint),  polygon (first match wins, in this order)
    ('head',       'torso',   (250, 242), [(196, 180), (304, 180), (304, 238), (270, 247), (250, 254), (230, 244), (221, 228), (200, 214)]),
    ('nearArmUp',  'torso',   (278, 254), [(264, 234), (304, 234), (300, 296), (292, 310), (278, 316), (274, 300), (270, 280), (266, 260)]),
    ('nearArmLo',  'nearArmUp', (287, 306), [(276, 300), (330, 296), (330, 372), (296, 372), (288, 352), (282, 334), (278, 318)]),
    ('farArmUp',   'torso',   (214, 250), [(184, 220), (226, 220), (228, 250), (222, 268), (206, 276), (200, 284), (180, 284), (176, 250)]),
    ('farArmLo',   'farArmUp', (190, 285), [(150, 270), (204, 280), (200, 292), (204, 330), (211, 352), (206, 370), (156, 370), (150, 300)]),
    ('farThigh',   'root',    (236, 340), [(203, 334), (250, 328), (252, 350), (238, 380), (198, 380), (196, 364)]),
    ('farShin',    'farThigh', (214, 378), [(176, 374), (240, 374), (232, 404), (230, 446), (170, 446), (170, 404)]),
    ('nearThigh',  'root',    (272, 342), [(254, 338), (302, 334), (304, 382), (262, 382), (258, 360)]),
    ('nearShin',   'nearThigh', (286, 380), [(256, 376), (306, 376), (322, 446), (250, 446), (258, 410)]),
]
JOINT_PAD = 10         # interior pixels around a joint copied into the parent too, so bending leaves no gap
FILL = [                # torso areas hidden behind limbs in the painting, inpainted from the surrounding scales
    [(262, 240), (294, 240), (294, 322), (262, 322)],
    [(204, 236), (232, 236), (232, 290), (204, 290)],
    [(228, 330), (284, 330), (284, 356), (228, 356)],
]


def point_in(poly, x, y):
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            inside = not inside
        j = i
    return inside


def build_rig(cell, norm, tr):
    px = cell.load()
    names = [p[0] for p in PARTS] + ['torso']
    imgs = {n: Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0)) for n in names}
    joints = {p[0]: (p[1], p[2]) for p in PARTS}
    for y in range(CROP[1], CROP[3]):
        for x in range(CROP[0], CROP[2]):
            p = px[x, y]
            if p[3] < 8:
                continue
            k, _ = classify(*p[:3])
            is_tail = x < TAIL_CUT_X and y > TAIL_CUT_Y and (y < TAIL_FOOT_Y or x < 170)
            in_head = HEAD_BOX[0] <= x < HEAD_BOX[2] and HEAD_BOX[1] <= y < HEAD_BOX[3]
            is_horn = in_head and ((x >= 218 and y < HORN_CUT_Y) or (k == 'accent' and 232 <= x < 268 and y < HORN_CUT_Y + 6))
            if is_tail or is_horn:
                continue
            owner = 'torso'
            for name, parent, pivot, poly in PARTS:
                if point_in(poly, x, y):
                    owner = name
                    break
            imgs[owner].putpixel((x, y), p)
            # Joint overlap: pixels near a joint also go to the parent part
            for name, (parent, pivot) in joints.items():
                if owner == name and parent != 'root' and k != 'fixed' and (x - pivot[0]) ** 2 + (y - pivot[1]) ** 2 <= JOINT_PAD ** 2:
                    imgs[parent].putpixel((x, y), p)
            for name, (parent, pivot) in joints.items():
                if parent == 'root' and owner == name and k != 'fixed' and (x - pivot[0]) ** 2 + (y - pivot[1]) ** 2 <= (JOINT_PAD + 4) ** 2:
                    imgs['torso'].putpixel((x, y), p)
    # Inpaint the torso where limbs covered it: grow inward from the surrounding scales, slightly shaded.
    t = imgs['torso']
    tp = t.load()
    holes = [(x, y) for poly in FILL for y in range(CELL) for x in range(CELL) if point_in(poly, x, y) and tp[x, y][3] < 128 and px[x, y][3] >= 128]
    holes = set(holes)
    filled = list(holes)
    for _ in range(40):
        if not holes:
            break
        done = []
        for (x, y) in holes:
            acc = [0, 0, 0]; n = 0
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = tp[x + dx, y + dy]
                if q[3] >= 128 and (x + dx, y + dy) not in holes:
                    acc[0] += q[0]; acc[1] += q[1]; acc[2] += q[2]; n += 1
            if n:
                done.append(((x, y), (round(acc[0] / n * 0.97), round(acc[1] / n * 0.97), round(acc[2] / n * 0.97), 255)))
        for (pt, col) in done:
            tp[pt[0], pt[1]] = col
            holes.discard(pt)
    # Soften the fill (row-by-row growth leaves streaks) and shade it a little: it reads as the chest's shadowed side.
    if filled:
        from PIL import ImageFilter
        soft = t.filter(ImageFilter.GaussianBlur(2.2))
        sp = soft.load()
        for (x, y) in filled:
            q = sp[x, y]
            tp[x, y] = (round(q[0] * 0.88), round(q[1] * 0.88), round(q[2] * 0.88), 255)

    def shade(k, p):
        if k == 'fixed':
            return p
        g = max(0, min(255, round(255 * classify(*p[:3])[1] / norm[k])))
        return (g, g, g, p[3])

    # Pack every part into one atlas per colour class
    layer_names = ['main', 'belly', 'accent', 'fixed']
    packed = []
    x_cursor, y_cursor, row_h, ATLAS_W = 0, 0, 0, 1024
    for name in names:
        bb = imgs[name].getbbox()
        if not bb:
            continue
        bb = (bb[0] - 2, bb[1] - 2, bb[2] + 2, bb[3] + 2)
        crop = imgs[name].crop(bb)
        sw, sh = round(crop.width * SCALE * RES), round(crop.height * SCALE * RES)
        if x_cursor + sw > ATLAS_W:
            x_cursor = 0; y_cursor += row_h + 2; row_h = 0
        packed.append((name, bb, crop, (x_cursor, y_cursor, sw, sh)))
        x_cursor += sw + 2; row_h = max(row_h, sh)
    atlas_h = y_cursor + row_h
    atlases = {k: Image.new('RGBA', (ATLAS_W, atlas_h), (0, 0, 0, 0)) for k in layer_names}
    parts = {}
    for name, bb, crop, rect in packed:
        layers = {k: Image.new('RGBA', crop.size, (0, 0, 0, 0)) for k in layer_names}
        cp = crop.load()
        for yy in range(crop.height):
            for xx in range(crop.width):
                p = cp[xx, yy]
                if p[3] < 8:
                    continue
                k, _ = classify(*p[:3])
                layers[k].putpixel((xx, yy), shade(k, p))
        for k in layer_names:
            atlases[k].paste(layers[k].resize(rect[2:], Image.LANCZOS), rect[:2])
        parent, pivot = joints.get(name, ('root', (250, 340)))
        parts[name] = {'rect': list(rect), 'origin': tr(bb[:2]), 'size': [round(crop.width * SCALE, 1), round(crop.height * SCALE, 1)],
                       'pivot': tr(pivot), 'parent': parent}
    parts['torso']['pivot'] = tr((252, 336))    # the waist
    files = {}
    for k in layer_names:
        atlases[k].save(os.path.join(OUT, f'rig-{k}.png'), optimize=True)
        files[f'rig-{k}'] = f'rig-{k}.png'
    return parts, files


# ───────────────────────── Other pack animations (optional) ─────────────────────────
# Drop the pack's other sheets into tools/source/ with their original names and re-run. Each is matched by name,
# checked to be a square-cell grid, and only non-empty cells count as frames. Order matters: run02 before run.
ANIM_PATTERNS = [
    ('walk', r'walk'), ('run2', r'run[ _-]?0?2'), ('run', r'run'),
    ('defense2', r'defen[cs]e[ _-]?0?2'), ('defense', r'defen[cs]e|block|guard'),
    ('hurt', r'hurt'), ('death', r'death|dead|die'), ('entrance', r'entrance|intro'),
    ('attack1', r'attack[ _-]?0?1(?!\d)'), ('attack2', r'attack[ _-]?0?2(?!\d)'), ('attack3', r'attack[ _-]?0?3(?!\d)'), ('attack4', r'attack[ _-]?0?4(?!\d)'),
]
MAX_ANIM_FRAMES = 32
ANIM_COLS = 8


def find_anim_sheets():
    import re
    found, report = {}, []
    for fn in sorted(os.listdir(SOURCE_DIR)):
        if not fn.lower().endswith('.png') or os.path.join(SOURCE_DIR, fn) == SRC:
            continue
        stem = os.path.splitext(fn)[0].lower()
        for name, pat in ANIM_PATTERNS:
            if re.search(pat, stem):
                if name in found:
                    report.append(f'  {fn}: ignored, {name} already taken by {os.path.basename(found[name])}')
                else:
                    found[name] = os.path.join(SOURCE_DIR, fn)
                break
        else:
            report.append(f'  {fn}: name not recognised, skipped')
    return found, report


def build_anim(path, name, norm, idle_feet_src):
    sheet = Image.open(path).convert('RGBA')
    W, H = sheet.size
    cell = CELL if W % CELL == 0 and H % CELL == 0 else (W // 10 if W % 10 == 0 and H % (W // 10) == 0 else None)
    if not cell:
        return None, f'{os.path.basename(path)}: {W}x{H} is not a square-cell grid, skipped'
    cols, rows = W // cell, H // cell
    cells = []
    for r in range(rows):
        for c in range(cols):
            im = sheet.crop((c * cell, r * cell, c * cell + cell, r * cell + cell))
            if cell != CELL:
                im = im.resize((CELL, CELL), Image.LANCZOS)
            bb = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
            if bb:
                cells.append((im, bb))
    if not cells:
        return None, f'{os.path.basename(path)}: no frames found'
    n_src = len(cells)
    picks = cells if n_src <= MAX_ANIM_FRAMES else [cells[round(i * (n_src - 1) / (MAX_ANIM_FRAMES - 1))] for i in range(MAX_ANIM_FRAMES)]
    x0 = max(0, min(b[0] for _, b in picks) - 6); y0 = max(0, min(b[1] for _, b in picks) - 6)
    x1 = min(CELL, max(b[2] for _, b in picks) + 6); y1 = min(CELL, max(b[3] for _, b in picks) + 6)
    cw, ch = x1 - x0, y1 - y0
    layer_names = ['main', 'belly', 'accent', 'fixed']
    rows_out = (len(picks) + ANIM_COLS - 1) // ANIM_COLS
    out = {k: Image.new('RGBA', (cw * ANIM_COLS, ch * rows_out), (0, 0, 0, 0)) for k in layer_names}

    def shade(k, p):
        if k == 'fixed':
            return p
        g = max(0, min(255, round(255 * classify(*p[:3])[1] / norm[k])))
        return (g, g, g, p[3])

    eyes, boxes, grounds = [], [], []
    for i, (im, bb) in enumerate(picks):
        px = im.load()
        eye = None
        layers = {k: Image.new('RGBA', (cw, ch), (0, 0, 0, 0)) for k in layer_names}
        for y in range(y0, y1):
            for x in range(x0, x1):
                p = px[x, y]
                if p[3] < 8:
                    continue
                k, _ = classify(*p[:3])
                layers[k].putpixel((x - x0, y - y0), shade(k, p))
                # The eye is the only near-white patch in the upper part of the body (claws are grey, horns gold)
                if p[0] > 225 and p[1] > 225 and p[2] > 200 and p[3] > 200 and y < bb[1] + (bb[3] - bb[1]) * 0.35:
                    eye = (eye[0] + x, eye[1] + y, eye[2] + 1) if eye else (x, y, 1)
        c, r = i % ANIM_COLS, i // ANIM_COLS
        for k in layer_names:
            out[k].paste(layers[k], (c * cw, r * ch))
        eyes.append((eye[0] / eye[2], eye[1] / eye[2]) if eye else None)
        boxes.append(bb)
        grounds.append(bb[3])
    for i in range(len(eyes)):
        if eyes[i] is None:
            eyes[i] = eyes[i - 1] if i and eyes[i - 1] else None
    files = {}
    pw, ph = round(cw * SCALE * RES), round(ch * SCALE * RES)
    for k in layer_names:
        out[k].resize((pw * ANIM_COLS, ph * rows_out), Image.LANCZOS).save(os.path.join(OUT, f'anim-{name}-{k}.png'), optimize=True)
        files[f'anim-{name}-{k}'] = f'anim-{name}-{k}.png'

    def u(v, o):
        return round((v - o) * SCALE, 1)
    # The impact frame: highest reach for the leaping attack, furthest forward reach for the others.
    if name == 'attack1':
        impact = min(range(len(boxes)), key=lambda i: boxes[i][1])
    else:
        impact = max(range(len(boxes)), key=lambda i: boxes[i][2])
    ground = max(grounds)
    info = {
        'cell': [round(cw * SCALE, 1), round(ch * SCALE, 1)], 'cols': ANIM_COLS, 'frames': len(picks), 'sourceFrames': n_src,
        'feet': [u(idle_feet_src[0], x0), u(idle_feet_src[1], y0)],
        'impact': impact,
        'eyes': [[u(e[0], x0), u(e[1], y0)] if e else None for e in eyes],
        'reach': [[u(b[0], x0), u(b[1], y0), u(b[2], x0), u(b[3], y0)] for b in boxes],
        'source': os.path.basename(path),
    }
    note = f'{os.path.basename(path)} → {name}: {cols}x{rows} grid of {cell}px, {n_src} frames' + (f' (sampled to {len(picks)})' if n_src > len(picks) else '') + f', impact frame {impact}'
    if abs(ground - idle_feet_src[1]) > 8:
        note += f'  WARNING: lowest pixel at y={ground}, idle stands at y={idle_feet_src[1]}; check the ground line'
    return (info, files), note


def main():
    sheet = Image.open(SRC).convert('RGBA')
    picks = [round(i * (FRAMES_IN_PACK - 1) / FRAMES) for i in range(FRAMES)]
    cw, ch = CROP[2] - CROP[0], CROP[3] - CROP[1]

    # First pass: collect brightness per class to normalise shading.
    vals = {'main': [], 'belly': [], 'accent': []}
    cells = [frame_cell(sheet, i) for i in picks]
    for cell in cells[:4]:
        for p in cell.getdata():
            if p[3] > 128:
                k, v = classify(*p[:3])
                if k in vals:
                    vals[k].append(v)
    norm = {}
    for k, arr in vals.items():
        arr.sort()
        norm[k] = arr[int(len(arr) * 0.93)] if arr else 1.0

    def shade(k, p):
        if k == 'fixed':
            return p
        g = max(0, min(255, round(255 * classify(*p[:3])[1] / norm[k])))
        return (g, g, g, p[3])

    layer_names = ['main', 'belly', 'accent', 'fixed']
    body = {k: Image.new('RGBA', (cw * OUT_COLS, ch * ((FRAMES + OUT_COLS - 1) // OUT_COLS)), (0, 0, 0, 0)) for k in layer_names}
    tail = {k: Image.new('RGBA', (cw, ch), (0, 0, 0, 0)) for k in layer_names}
    horns = {k: Image.new('RGBA', (cw, ch), (0, 0, 0, 0)) for k in layer_names}

    anchors = []
    for fi, cell in enumerate(cells):
        layers = {k: Image.new('RGBA', (cw, ch), (0, 0, 0, 0)) for k in layer_names}
        px = cell.load()
        snout = None
        top = None
        eye = None
        for y in range(CROP[1], CROP[3]):
            for x in range(CROP[0], CROP[2]):
                p = px[x, y]
                if p[3] < 8:
                    continue
                k, v = classify(*p[:3])
                is_tail = x < TAIL_CUT_X and y > TAIL_CUT_Y and (y < TAIL_FOOT_Y or x < 170)
                in_head = HEAD_BOX[0] <= x < HEAD_BOX[2] and HEAD_BOX[1] <= y < HEAD_BOX[3]
                is_horn = in_head and ((x >= 218 and y < HORN_CUT_Y) or (k == 'accent' and 232 <= x < 268 and y < HORN_CUT_Y + 6))
                target = tail if is_tail else horns if is_horn else None
                if target is not None:
                    if fi == 0:
                        target[k].putpixel((x - CROP[0], y - CROP[1]), shade(k, p))
                    continue
                layers[k].putpixel((x - CROP[0], y - CROP[1]), shade(k, p))
                if in_head and 205 <= y <= 236 and p[3] > 200 and (snout is None or x > snout[0]):
                    snout = (x, y)
                if in_head and 240 <= x <= 275 and p[3] > 200 and k == 'main' and (top is None or y < top[1]):
                    top = (x, y)
                # the red pupil
                if in_head and p[0] > 150 and p[1] < 90 and p[2] < 90 and p[3] > 200:
                    eye = (x, y)
        c, r = fi % OUT_COLS, fi // OUT_COLS
        for k in layer_names:
            body[k].paste(layers[k], (c * cw, r * ch))
        anchors.append({'snout': snout, 'top': top, 'eye': eye})

    # Fill any missed eye detection from the previous frame
    for i, a in enumerate(anchors):
        if a['eye'] is None:
            a['eye'] = anchors[i - 1]['eye'] if i else (271, 212)

    os.makedirs(OUT, exist_ok=True)
    w, h = round(cw * SCALE), round(ch * SCALE)          # cell size in world units
    pw, ph = round(w * RES), round(h * RES)              # cell size in image pixels
    out_files = {}
    for k in layer_names:
        img = body[k].resize((pw * OUT_COLS, ph * ((FRAMES + OUT_COLS - 1) // OUT_COLS)), Image.LANCZOS)
        img.save(os.path.join(OUT, f'body-{k}.png'), optimize=True)
        out_files[f'body-{k}'] = f'body-{k}.png'
    for name, group in (('tail', tail), ('horns', horns)):
        for k in layer_names:
            if group[k].getbbox() is None:
                continue
            group[k].resize((pw, ph), Image.LANCZOS).save(os.path.join(OUT, f'{name}-{k}.png'), optimize=True)
            out_files[f'{name}-{k}'] = f'{name}-{k}.png'

    def tr(pt):  # source-cell coords → output-cell coords
        return [round((pt[0] - CROP[0]) * SCALE, 1), round((pt[1] - CROP[1]) * SCALE, 1)]

    # Feet: lowest opaque row, centred between the outermost foot pixels (frame 0)
    a0 = frame_cell(sheet, 0).getchannel('A')
    bb = a0.getbbox()
    feet_y = bb[3]
    row = [x for x in range(TAIL_CUT_X, CELL) if a0.getpixel((x, feet_y - 6)) > 100]
    feet_x = (min(row) + max(row)) / 2

    rig = {
        'source': 'Dragon Warrior pack: idle.png (97 frames, 480px cells). Processed by tools/process_pack.py.',
        'cell': [w, h], 'cols': OUT_COLS, 'frames': FRAMES, 'fps': 10,
        'scale': SCALE, 'res': RES,
        'feet': tr((feet_x, feet_y)),
        'layers': out_files,
        'tailRoot': tr((TAIL_CUT_X + 2, 394)),
        'hornRoot': tr((250, 201)),
        'back': tr((214, 236)),        # between the shoulder blades: wings attach here
        'hip': tr((228, 342)),
        'chest': tr((262, 280)),
        'frame': [{
            'snout': tr(a['snout'] or (300, 222)),
            'top': tr(a['top'] or (252, 196)),
            'eye': tr(a['eye']),
        } for a in anchors],
    }
    rig['parts'], rig_files = build_rig(frame_cell(sheet, 0), norm, tr)
    rig['layers'].update(rig_files)
    # Other pack animations, if present
    rig['anims'] = {}
    sheets, report = find_anim_sheets()
    for name, path in sheets.items():
        res, note = build_anim(path, name, norm, (feet_x, feet_y))
        report.append('  ' + note)
        if res:
            rig['anims'][name] = res[0]
            rig['layers'].update(res[1])
    missing = [n for n, _ in ANIM_PATTERNS if n not in rig['anims']]
    print('Pack animations found: ' + (', '.join(sorted(rig['anims'])) or 'none besides idle'))
    print('Missing: ' + ', '.join(missing))
    for line in report:
        print(line)
    # Head motion relative to frame 0, used to move horns and head parts with the breathing loop
    s0 = rig['frame'][0]['snout']
    for f in rig['frame']:
        f['dx'] = round(f['snout'][0] - s0[0], 1)
        f['dy'] = round(f['snout'][1] - s0[1], 1)
    with open(os.path.join(OUT, 'rig.js'), 'w') as fh:
        fh.write('// Generated by tools/process_pack.py from the Dragon Warrior pack. Do not edit by hand.\n')
        fh.write('window.DC_WARRIOR_RIG = ' + json.dumps(rig, indent=1) + ';\n')
    print('normalisation', norm)
    print('wrote', len(out_files), 'layers, feet', rig['feet'], 'frame0', rig['frame'][0])


if __name__ == '__main__':
    sys.exit(main())
