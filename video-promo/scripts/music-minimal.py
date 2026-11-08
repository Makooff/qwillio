"""La musique des vidéos : rythmée mais ambiante, et la signature sonore du logo.

Deux retours du propriétaire. La première version, minimale et expérimentale
(micro-clics au hasard, cloche FM, bégaiements), était « trop bizarre ». Ce qu'il
veut : « un truc dynamique et rythmé, mais ambiant », et « un slogan mélodique
pendant le logo ». Tout est synthétisé ici, donc aucune question de licence.

La piste (public/music-minimal.mp3), 108 bpm, fa majeur, I-V-vi-IV :
  - des accords chauds en sinus désaccordés, qui « pompent » sur chaque temps
    (le compresseur en side-chain de la musique électronique douce) ;
  - une grosse caisse feutrée sur les quatre temps, un charleston fermé sur
    les contretemps, un clap très bas sur 2 et 4 ;
  - une basse ronde en croches sur la fondamentale ;
  - un arpège clair en doubles croches, uniquement sur les notes de l'accord,
    passé dans un écho.
Des sections de huit mesures retirent ou rajoutent des couches : chaque vidéo
démarre à un endroit différent (`music` dans scripts/cartesia-shorts.mjs).

La signature (public/jingle.mp3), environ 3 s : cinq notes de cloche douce,
do - fa - la - sol, puis fa tenu, sur un accord de fa qui s'ouvre. Le fa final
tombe à 1,0 s : c'est lui qu'on cale sur le logo formé.

  python scripts/music-minimal.py
"""
import subprocess
import wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
BPM = 108
BEAT = 60 / BPM
S16 = BEAT / 4
BAR = BEAT * 4
rng = np.random.default_rng(3)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, btype='low', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, btype='high', fs=SR, output='sos'), x)


class Track:
    def __init__(self, dur):
        self.n = int(dur * SR)
        self.l = np.zeros(self.n)
        self.r = np.zeros(self.n)

    def add(self, sig, at, pan=0.0, gain=1.0):
        i = int(at * SR)
        if i >= self.n or i < 0:
            return
        sig = sig[: self.n - i] * gain
        self.l[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
        self.r[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def pad_note(f, dur):
    tt = np.arange(int(dur * SR)) / SR
    s = np.zeros_like(tt)
    for det, g in ((-6, 0.6), (0, 1.0), (6, 0.6)):
        s += g * np.sin(2 * np.pi * f * 2 ** (det / 1200) * tt + rng.uniform(0, 6.28))
    s += 0.12 * np.sin(2 * np.pi * 2 * f * tt)
    return s


def pluck(f, dur=0.45):
    tt = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 18) + 0.12 * np.sin(2 * np.pi * 3 * f * tt) * np.exp(-tt * 30)
    return s * np.exp(-tt * 7) * np.minimum(1, tt * 400) * np.minimum(1, (dur - tt) / 0.05)


def bell(f, dur=1.6, decay=3.2):
    """Une cloche douce : sinus et partiels inharmoniques qui s'éteignent vite."""
    tt = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * f * tt)
    s += 0.4 * np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt * 6)
    s += 0.18 * np.sin(2 * np.pi * f * 3.01 * tt) * np.exp(-tt * 10)
    s += 0.08 * np.sin(2 * np.pi * f * 4.2 * tt) * np.exp(-tt * 16)
    tail = np.minimum(1, (dur - tt) / 0.15)  # pas de clic à la coupe
    return s * np.exp(-tt * decay) * np.minimum(1, tt * 300) * tail


def kick():
    tt = np.arange(int(0.35 * SR)) / SR
    freq = 46 + 70 * np.exp(-tt * 35)
    return lp(np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-tt * 9), 220)


def hat(length=0.04):
    n = int(length * SR)
    return hp(rng.standard_normal(n), 7000) * np.exp(-np.arange(n) / (n / 5))


def clap():
    n = int(0.12 * SR)
    noise = sosfilt(butter(2, [900, 3500], btype='band', fs=SR, output='sos'), rng.standard_normal(n))
    env = np.exp(-np.arange(n) / (0.025 * SR))
    for d in (0.008, 0.016):  # trois claquements rapprochés
        k = int(d * SR)
        env[k:] += 0.6 * np.exp(-np.arange(n - k) / (0.02 * SR))
    return noise * env * 0.5


def echo(l, r, delay, fb=0.35, taps=5, tone=4000):
    d = int(delay * SR)
    wl, wr = np.zeros_like(l), np.zeros_like(r)
    for k in range(1, taps + 1):
        sh = d * k
        if sh >= len(l):
            break
        a, b = (r, l) if k % 2 else (l, r)
        wl[sh:] += a[: len(l) - sh] * fb ** k
        wr[sh:] += b[: len(r) - sh] * fb ** k
    return lp(wl, tone), lp(wr, tone)


def master(tr, target_db, out_mp3, fade_in=1.0, fade_out=2.5):
    mix = np.stack([tr.l, tr.r], 1)
    mix = np.tanh(mix * 1.2) / 1.2
    t = np.arange(tr.n) / SR
    dur = tr.n / SR
    env = np.clip(t / max(fade_in, 1e-3), 0, 1) * np.clip((dur - t) / max(fade_out, 1e-3), 0, 1)
    mix *= env[:, None]
    mix *= 10 ** (target_db / 20) / np.sqrt(np.mean(mix ** 2))
    peak = np.max(np.abs(mix))
    if peak > 0.89:
        mix *= 0.89 / peak
    wav = out_mp3.replace('public/', 'out/').replace('.mp3', '.wav')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-b:a', '192k', out_mp3], check=True)
    print(out_mp3, round(dur, 1), 's')


# ================================================================== la piste
DUR = 300.0
tr = Track(DUR)
# fa majeur : Fa - Do - Rém - Sib, une mesure chacun
CHORDS = [
    (41, [53, 57, 60, 64]),   # Fa : fa la do mi
    (36, [52, 55, 60, 62]),   # Do : mi sol do ré
    (38, [53, 57, 60, 62]),   # Rém : fa la do ré
    (34, [50, 53, 57, 60]),   # Sib : ré fa la do
]
# Les couches présentes, section par section (huit mesures) :
# pad, kick, hats, clap, bass, arp
SECTIONS = [
    (1, 1, 1, 0, 1, 0), (1, 1, 1, 1, 1, 1), (1, 1, 0, 0, 1, 1), (1, 1, 1, 1, 1, 1),
    (1, 0, 1, 0, 0, 1), (1, 1, 1, 1, 1, 1), (1, 1, 1, 0, 1, 1), (1, 1, 1, 1, 1, 0),
]
nbars = int(DUR / BAR) + 1


def layers(bar):
    return SECTIONS[(bar // 8) % len(SECTIONS)]


# le pompage : un creux à chaque temps, remonté en un demi-temps
t = np.arange(tr.n) / SR
phase = (t % BEAT) / BEAT
pump = 0.55 + 0.45 * np.minimum(1, phase / 0.45) ** 1.5

pad_l, pad_r = np.zeros(tr.n), np.zeros(tr.n)
arp = Track(DUR)
for bar in range(nbars):
    start = bar * BAR
    root, notes = CHORDS[bar % 4]
    on = layers(bar)
    # la nappe, avec un fondu qui chevauche la mesure suivante
    seg = np.zeros(int((BAR + 0.6) * SR))
    for m in notes:
        seg += pad_note(hz(m), BAR + 0.6)
    tt = np.arange(len(seg)) / SR
    env = np.minimum(1, tt / 0.25) * np.minimum(1, (BAR + 0.6 - tt) / 0.6)
    seg = lp(seg * env / len(notes), 1400)
    i = int(start * SR)
    j = min(tr.n, i + len(seg))
    pad_l[i:j] += seg[: j - i]
    pad_r[i:j] += seg[: j - i]
    for b in range(4):
        at = start + b * BEAT
        if on[1]:
            tr.add(kick(), at, gain=0.9)
        if on[2]:
            tr.add(hat(), at + BEAT / 2, pan=0.25, gain=0.10)
            tr.add(hat(0.02), at + BEAT * 0.75, pan=-0.3, gain=0.045)
        if on[3] and b in (1, 3):
            tr.add(clap(), at, pan=0.05, gain=0.25)
        if on[4]:
            for h in (0, 0.5):
                tt = np.arange(int(BEAT * 0.45 * SR)) / SR
                bass = (np.sin(2 * np.pi * hz(root) * tt) + 0.25 * np.sin(2 * np.pi * hz(root) * 2 * tt)) * np.exp(-tt * 5) * np.minimum(1, tt * 200) * np.minimum(1, (tt[-1] - tt) / 0.04)
                tr.add(lp(bass, 400), at + h * BEAT, gain=0.42)
    if on[5]:
        seq = [notes[k] + 12 for k in (0, 1, 2, 3, 2, 1, 2, 3)]
        for k in range(16):
            m = seq[k % len(seq)]
            arp.add(pluck(hz(m)), start + k * S16, pan=0.35 * np.sin(k * 0.8), gain=0.13 if k % 4 else 0.16)
tr.l += pad_l * pump * 0.34
tr.r += pad_r * pump * 0.34
el, er = echo(arp.l, arp.r, BEAT * 0.75, fb=0.32, tone=3500)
tr.l += lp(arp.l, 5000) + el * 0.5
tr.r += lp(arp.r, 5000) + er * 0.5
master(tr, -16, 'public/music-minimal.mp3', fade_in=1.0, fade_out=3.0)

# ================================================================== la signature
JDUR = 3.2
jg = Track(JDUR)
# do5 - fa5 - la5 - sol5, puis fa5 tenu : « Qwil-li-o » qui se pose
melody = [(0.00, 72, 0.9), (0.20, 77, 0.9), (0.40, 81, 1.0), (0.62, 79, 0.85), (1.00, 77, 1.1)]
for at, m, g in melody:
    dec = 1.6 if at >= 1.0 else 3.4
    jg.add(bell(hz(m), 2.2, dec), at, pan=0.0, gain=0.22 * g)
    jg.add(bell(hz(m + 12), 1.2, dec * 1.8), at + 0.004, pan=0.3, gain=0.05 * g)
# l'accord de fa qui s'ouvre sous la dernière note
chord = np.zeros(int(2.4 * SR))
for m in (53, 57, 60, 65, 69):
    chord += pad_note(hz(m), 2.4)
tt = np.arange(len(chord)) / SR
chord = lp(chord / 5 * np.minimum(1, tt / 0.5) * np.exp(-np.maximum(0, tt - 0.8) * 1.6), 2200)
jg.add(chord, 0.75, gain=0.35)
# une basse de fa qui assoit la fin
tt = np.arange(int(1.6 * SR)) / SR
jg.add(lp(np.sin(2 * np.pi * hz(41) * tt) * np.exp(-tt * 2.2) * np.minimum(1, tt * 100) * np.minimum(1, (1.6 - tt) / 0.2), 300), 1.0, gain=0.4)
el, er = echo(jg.l, jg.r, BEAT * 0.5, fb=0.28, taps=3, tone=5000)
jg.l += el * 0.4
jg.r += er * 0.4
master(jg, -15, 'public/jingle.mp3', fade_in=0.0, fade_out=0.4)
