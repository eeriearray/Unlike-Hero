#!/usr/bin/env python3
"""Build Dragon Clash's sound effects from the local sound packs.

  python3 tools/build_sfx.py "/Users/akshat/Desktop/DRAGON SOUND EFFECT"

Sources (not in the repo; 8.5 GB of WAV):
  <dir>/NN. Name.wav                                   announcer lines
  <dir>/Helton Yan's Pixel Combat - Single Files/*.wav  combat effects

For each game event below it picks the listed sounds (up to 3 numbered variants each, for variety), trims silence,
downmixes to mono, normalises loudness per category so effects sit together, and encodes AAC (.m4a, macOS afconvert).
Output: assets/sfx/*.m4a and assets/sfx/sfx.js (the manifest js/audio.js loads).
"""
import glob, json, os, re, subprocess, sys, tempfile, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'sfx')
PC = "Helton Yan's Pixel Combat - Single Files"

# event: (category, [sound names]). Category sets the loudness target.
EVENTS = {
    # Hits by strength
    'hitLight':   ('hit',   ['FGHTImpt_HIT-Smack', 'FGHTImpt_MELEE-Gut Punch', 'FGHTImpt_MELEE-Swish Hit']),
    'hitHeavy':   ('hit',   ['FGHTImpt_HIT-Strong Punch', 'FGHTImpt_HIT-Strong Smack', 'FGHTImpt_MELEE-Kick Critical']),
    'hitHuge':    ('big',   ['DSGNImpt_MELEE-Homerunner', 'DSGNMisc_SKILL IMPACT-Critical Strike']),
    # Elemental layers on top of the hit
    'elemFire':      ('elem', ['DSGNImpt_EXPLOSION-Fire Hit', 'DSGNImpt_EXPLOSION-Pyro Burst']),
    'elemIce':       ('elem', ['DSGNMisc_SKILL IMPACT-Glassy Sprites', 'DSGNTonl_SKILL IMPACT-Energy Crystal']),
    'elemLightning': ('elem', ['DSGNImpt_EXPLOSION-Electric Hit', 'DSGNImpt_EXPLOSION-Voltaic Blast']),
    'elemEarth':     ('elem', ['DSGNImpt_EXPLOSION-Sand Impact', 'DSGNMisc_SKILL IMPACT-Pebbles']),
    'elemWater':     ('elem', ['DSGNMisc_SKILL RELEASE-Wet Splash', 'DSGNMisc_PROJECTILE-Water Bolt']),
    # Swings
    'swingLight': ('swing', ['WHSH_MOVEMENT-Simple Whoosh', 'SWSH_MOVEMENT-Bamboo Whip']),
    'swingHeavy': ('swing', ['WHSH_MOVEMENT-Wind Sweep Swish', 'WHSH_MOVEMENT-Windy Swipy', 'DSGNMisc_MELEE-Sword Slash']),
    # Signature / ability releases and the charge before them
    'castFire':      ('cast', ['DSGNMisc_SKILL RELEASE-Flame Ball', 'DSGNMisc_SKILL RELEASE-Fire Sphere']),
    'castIce':       ('cast', ['MAGSpel_CAST-Sharp Summon', 'MAGSpel_CAST-Sharper Summon']),
    'castLightning': ('cast', ['MAGSpel_CAST-Zap Up', 'DSGNMisc_HIT-Laser Electric Zap']),
    'castEarth':     ('cast', ['DSGNImpt_EXPLOSION-Eruption', 'DSGNImpt_EXPLOSION-Thud']),
    'castWater':     ('cast', ['MAGSpel_CAST-Underwater', 'DSGNMisc_PROJECTILE-Water Bolt']),
    'charge':        ('soft', ['MAGSpel_CAST-Energy Riser']),
    # Movement
    'jump':     ('move', ['WHSH_MOVEMENT-Windy Passby']),
    'airJump':  ('move', ['WHSH_MOVEMENT-Wind Shaker']),
    'land':     ('step', ['FEETMisc_STEP-Hard Step']),
    'step':     ('step', ['FEETMisc_STEP-Boots on Concrete']),
    'dodge':    ('move', ['DSGNMisc_MOVEMENT-Phase Swish']),
    'ledge':    ('step', ['FGHTImpt_MELEE-Kick Block']),
    'respawn':  ('soft', ['MAGSpel_CAST-Aura Rise']),
    'buff':     ('soft', ['MAGSpel_CAST-Growing Strength']),
    # KO and rules
    'koBoom':   ('big',  ['DSGNImpt_EXPLOSION-Bass Hit']),
    'rule':     ('soft', ['DSGNImpt_EXPLOSION-Flare Extinguish']),
    'clash':    ('elem', ['DSGNImpt_EXPLOSION-Crunchy Burst']),
    'shatter':  ('elem', ['DSGNMisc_SKILL IMPACT-Glassy Sprites']),
    'denied':   ('ui',   ['UIMisc_INTERFACE-Denied']),
    # Interface
    'ui':       ('ui',   ['UIClick_INTERFACE-Positive Click']),
    'uiBack':   ('ui',   ['UIClick_INTERFACE-Metallic Click']),
    'select':   ('ui',   ['UIMisc_INTERFACE-Zap Select']),
    'count':    ('ui',   ['UIClick_INTERFACE-Strong Click 1']),
    # Announcer
    'vFight':        ('voice', ['02. Fight']),
    'vKO':           ('voice', ['17. KO']),
    'vKnockout':     ('voice', ['16. Knockout']),
    'vVictor':       ('voice', ['14. Victor']),
    'vGameOver':     ('voice', ['28. Game Over']),
    'vDeathMatch':   ('voice', ['13. Death Match']),
    'vSuddenDeath':  ('voice', ['15. Sudden Death']),
    'vFrenzy':       ('voice', ['06. Killing Frenzy']),
    'vChampion':     ('voice', ['01. Select Your Champion']),
    'vFury':         ('voice', ['03. Embrace the Fury']),
}
# Loudness targets (RMS dBFS of the trimmed sound). Voices on top, UI and steps quiet.
TARGET = {'voice': -14, 'big': -15, 'hit': -17, 'elem': -19, 'cast': -19, 'swing': -22, 'move': -24, 'soft': -24, 'step': -27, 'ui': -24}
MAX_SECONDS = {'voice': 3.2, 'big': 1.6, 'hit': 0.8, 'elem': 1.2, 'cast': 1.4, 'swing': 0.7, 'move': 0.8, 'soft': 1.6, 'step': 0.4, 'ui': 0.5}


def read(path):
    with wave.open(path) as w:
        n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
        raw = w.readframes(n)
    if sw == 2:
        a = np.frombuffer(raw, '<i2').astype(np.float32) / 32768
    elif sw == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3)
        a = ((b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16)) << 8 >> 8).astype(np.float32) / 8388608
    elif sw == 4:
        a = np.frombuffer(raw, '<i4').astype(np.float32) / 2147483648
    else:
        raise ValueError('unsupported sample width %d' % sw)
    return a.reshape(-1, ch).mean(axis=1), sr


def process(a, sr, cat):
    # Trim silence below -50 dB at both ends, keep a 5 ms lead-in, fade out the tail
    thr = 10 ** (-50 / 20)
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx):
        return None
    a = a[max(0, idx[0] - int(0.005 * sr)): idx[-1] + 1]
    a = a[: int(MAX_SECONDS[cat] * sr)]
    fade = min(len(a), int(0.04 * sr))
    a[-fade:] *= np.linspace(1, 0, fade)
    rms = np.sqrt(np.mean(a ** 2)) + 1e-9
    a = a * (10 ** (TARGET[cat] / 20) / rms)
    peak = np.max(np.abs(a))
    if peak > 0.97:
        a = a * (0.97 / peak)
    return a


def write_m4a(a, sr, dest):
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        with wave.open(tmp.name, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
            w.writeframes((np.clip(a, -1, 1) * 32767).astype('<i2').tobytes())
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '96000', tmp.name, dest], check=True)
        os.unlink(tmp.name)


def find(src, name):
    if re.match(r'^\d\d\. ', name):
        p = os.path.join(src, name + '.wav')
        return [p] if os.path.exists(p) else []
    files = sorted(glob.glob(os.path.join(src, PC, glob.escape(name) + '_HY_PC*.wav')))
    return files[:3] if len(files) > 3 else files


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Desktop/DRAGON SOUND EFFECT')
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, '*.m4a')):
        os.unlink(f)
    manifest, missing, total = {}, [], 0
    for ev, (cat, names) in EVENTS.items():
        out = []
        for name in names:
            files = find(src, name)
            if not files:
                missing.append(f'{ev}: {name}')
                continue
            for path in files:
                if len(out) >= 4:
                    break
                a, sr = read(path)
                a = process(a, sr, cat)
                if a is None:
                    continue
                fn = f'{ev}-{len(out) + 1}.m4a'
                write_m4a(a, sr, os.path.join(OUT, fn))
                total += os.path.getsize(os.path.join(OUT, fn))
                out.append({'file': fn, 'dur': round(len(a) / sr, 3)})
        if out:
            manifest[ev] = out
    with open(os.path.join(OUT, 'sfx.js'), 'w') as fh:
        fh.write('// Generated by tools/build_sfx.py from the local sound packs. Do not edit by hand.\n')
        fh.write('window.DC_SFX = ' + json.dumps(manifest, indent=1) + ';\n')
    print(f'{sum(len(v) for v in manifest.values())} sounds for {len(manifest)} events, {total / 1024:.0f} KB')
    for m in missing:
        print('  missing:', m)


if __name__ == '__main__':
    main()
