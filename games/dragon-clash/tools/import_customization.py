#!/usr/bin/env python3
"""Cut the delivered customization pack into the gear pipeline's file names.

  python3 tools/import_customization.py [pack dir] && python3 tools/build_gear.py

The pack (default: docs/emberfang-preview/customization) holds fx/<name>.png sheets (4 columns x 2 rows of frames)
and icons/<name>.png (128 px). Frames and icons are written to assets/gear/src/ under the names
docs/GEAR-ASSETS.md lists; build_gear.py then sizes them and writes the manifest.
"""
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', '..', 'docs', 'emberfang-preview', 'customization')
SRC = os.path.join(HERE, '..', 'assets', 'gear', 'src')

FX = {  # sheet → (game name, frames used)
    'aegis_bubble': ('aegis', 8), 'aegis_shatter': ('aegis-break', 8), 'phase_dash': ('phase', 8),
    'decoy_pop': ('decoy-pop', 6), 'rage_aura': ('rage', 8), 'gust_wind': ('gust', 8),
}
ICONS = {
    'ability_fade': 'icon-ability-fade', 'ability_aegis': 'icon-ability-aegis', 'ability_phase_dash': 'icon-ability-phase',
    'ability_decoy': 'icon-ability-decoy', 'ability_rage': 'icon-ability-rage', 'ability_gust': 'icon-ability-gust',
}

n = 0
for sheet, (name, frames) in FX.items():
    im = Image.open(os.path.join(PACK, 'fx', sheet + '.png')).convert('RGBA')
    cw, ch = im.width // 4, im.height // 2
    for i in range(frames):
        cell = im.crop(((i % 4) * cw, (i // 4) * ch, (i % 4 + 1) * cw, (i // 4 + 1) * ch))
        cell.save(os.path.join(SRC, 'fx-%s-%d.png' % (name, i + 1))); n += 1
for src, name in ICONS.items():
    Image.open(os.path.join(PACK, 'icons', src + '.png')).convert('RGBA').save(os.path.join(SRC, name + '.png')); n += 1
print('%d files written to assets/gear/src' % n)
