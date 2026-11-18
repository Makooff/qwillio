"""Trois signatures plus posées, à choisir à l'oreille (out/jingle-a|b|c.mp3).

Le propriétaire a refusé trois versions : trop bizarre, pas assez minimale, puis
« trop jeu vidéo » (arpège rapide et pop). Ce qui fait « jeu vidéo » : des notes
courtes et rapides, des timbres synthétiques brillants. Les trois pistes ici
font l'inverse : peu de notes, lentes, timbres feutrés, beaucoup d'air.
  A · piano feutré : deux notes tenues, une sixte qui s'ouvre (do puis la)
  B · accord qui gonfle : un fa majeur 9 qui monte doucement et se pose
  C · souffle vocal : deux notes chantées « mm », comme une voix douce
Chaque fois, l'instant marquant tombe à 1,0 s, sur le logo formé.
"""
import pathlib
import numpy as np

src = pathlib.Path(__file__).with_name('music-minimal.py').read_text()
ns = {}
exec(compile(src.split('# ================================================================== la piste')[0], 'music-minimal.py', 'exec'), ns)
Track, pad_note, lp, hp, echo, master = ns['Track'], ns['pad_note'], ns['lp'], ns['hp'], ns['echo'], ns['master']
SR = 44100
rng = np.random.default_rng(11)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)


def reverb(tr, size=1.6, wet=0.35):
    """Une réverbération simple : bruit qui décroît, convolué (pièce douce)."""
    n = int(size * SR)
    ir_t = np.arange(n) / SR
    for ch in ('l', 'r'):
        ir = rng.standard_normal(n) * np.exp(-ir_t * 3.2 / size)
        ir = lp(ir, 5000)
        ir /= np.sqrt(np.sum(ir ** 2))
        x = getattr(tr, ch)
        y = np.fft.irfft(np.fft.rfft(x, len(x) + n) * np.fft.rfft(ir, len(x) + n))[: len(x)]
        setattr(tr, ch, x * (1 - wet) + y * wet * 0.6)


def piano(f, dur=3.0):
    tt = np.arange(int(dur * SR)) / SR
    s = np.zeros_like(tt)
    for k, a in ((1, 1.0), (2, 0.45), (3, 0.18), (4, 0.08), (5, 0.04)):
        fk = f * k * (1 + 0.0004 * k * k)  # légère inharmonicité des cordes
        s += a * np.sin(2 * np.pi * fk * tt) * np.exp(-tt * (1.1 + 0.9 * k))
    hammer = lp(rng.standard_normal(len(tt)), 1200) * np.exp(-tt * 60) * 0.05
    s = lp(s + hammer, 2600)  # le feutre : on coupe le brillant
    return s * np.minimum(1, tt * 300) * np.minimum(1, (dur - tt) / 0.3)


# A · piano feutré
a = Track(3.4)
a.add(piano(hz(72)), 0.55, pan=-0.15, gain=0.30)
a.add(piano(hz(65), 2.8), 1.0, pan=-0.05, gain=0.22)
a.add(piano(hz(81)), 1.0, pan=0.15, gain=0.30)
a.add(piano(hz(53), 2.8), 1.0, gain=0.14)
reverb(a, 1.8, 0.4)
master(a, -18, 'out/jingle-a.mp3', fade_in=0.0, fade_out=0.6)

# B · accord qui gonfle et se pose
b = Track(3.4)
ch = np.zeros(int(3.0 * SR))
for m in (53, 60, 64, 67, 69):
    ch += pad_note(hz(m), 3.0)
tt = np.arange(len(ch)) / SR
swell = np.clip(tt / 0.75, 0, 1) ** 2  # monte jusqu'à 1,0 s (départ à 0,25)
ch = lp(ch / 5 * swell * np.exp(-np.maximum(0, tt - 0.75) * 1.1) * np.minimum(1, (3.0 - tt) / 0.4), 2000)
b.add(ch, 0.25, gain=0.42)
b.add(piano(hz(77), 2.4), 1.0, gain=0.16)
reverb(b, 2.2, 0.45)
master(b, -18, 'out/jingle-b.mp3', fade_in=0.0, fade_out=0.6)


def hum(f, dur):
    """Un « mm » chanté : une dent de scie douce passée dans deux formants."""
    tt = np.arange(int(dur * SR)) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * tt) * np.minimum(1, tt / 0.4)
    ph = np.cumsum(f * vib) / SR
    saw = sum(np.sin(2 * np.pi * k * ph) / k for k in range(1, 14))
    from scipy.signal import butter, sosfilt
    s = sosfilt(butter(2, [200, 450], btype='band', fs=SR, output='sos'), saw) * 1.0
    s += sosfilt(butter(2, [800, 1300], btype='band', fs=SR, output='sos'), saw) * 0.25
    return s * np.minimum(1, tt / 0.12) * np.minimum(1, (dur - tt) / 0.5)


# C · souffle vocal, deux voix en tierce
c = Track(3.4)
c.add(hum(hz(64), 0.6), 0.45, pan=-0.1, gain=0.5)
c.add(hum(hz(60), 0.6), 0.45, pan=0.1, gain=0.35)
c.add(hum(hz(65), 2.0), 1.0, pan=-0.1, gain=0.5)
c.add(hum(hz(69), 2.0), 1.0, pan=0.1, gain=0.38)
c.add(piano(hz(53), 2.4), 1.0, gain=0.10)
reverb(c, 2.0, 0.45)
master(c, -18, 'out/jingle-c.mp3', fade_in=0.0, fade_out=0.6)
