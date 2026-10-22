"""Make a sharper 2x idle sheet for the big previews (Forge, Dragon Select, the versus card).

The HD packs are painted at ~270 px tall, and the previews show them several times larger. Instead of letting the
browser stretch the frames bilinearly, each idle frame is resampled 2x with Lanczos and given a light unsharp mask,
then saved as 01_Idle@2x.png; manifest.json gets 01_Idle.hd = { file, scale }. Run after tools/trim_sprites.py.

  python3 games/dragon-clash/tools/upscale_idle.py
"""
import json, os, sys
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'dragons')
NAME, SCALE = '01_Idle', 2

for dragon in (sys.argv[1:] or sorted(os.listdir(ROOT))):
    d = os.path.join(ROOT, dragon)
    if not os.path.isdir(d):
        continue
    mp = os.path.join(d, 'manifest.json')
    man = json.load(open(mp))
    m = man['anims'][NAME]
    im = Image.open(os.path.join(d, NAME + '.png')).convert('RGBA')
    cols, n = m['cols'], m['n']
    cw, ch = im.width // cols, im.height // ((n + cols - 1) // cols)
    out = Image.new('RGBA', (im.width * SCALE, im.height * SCALE), (0, 0, 0, 0))
    for i in range(n):
        x0, y0 = (i % cols) * cw, (i // cols) * ch
        f = im.crop((x0, y0, x0 + cw, y0 + ch)).resize((cw * SCALE, ch * SCALE), Image.LANCZOS)
        f = f.filter(ImageFilter.UnsharpMask(radius=1.4, percent=90, threshold=2))
        out.paste(f, (x0 * SCALE, y0 * SCALE))
    file = NAME + '@2x.png'
    out.save(os.path.join(d, file), optimize=True)
    m['hd'] = {'file': file, 'scale': SCALE}
    json.dump(man, open(mp, 'w'), separators=(',', ':'))
    print(dragon, out.size)
