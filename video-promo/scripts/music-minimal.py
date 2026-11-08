"""La musique des vidéos courtes : minimale, moderne, un peu expérimentale.

Retour du propriétaire : l'ancienne musique ne lui plaisait pas, il veut
« un truc plus minimaliste, moderne, expérimental ». Rien n'est échantillonné,
tout est synthétisé ici, donc aucune question de licence :

  - une nappe d'accords en sinus désaccordés, filtrée lentement (Rém9, Sib7M,
    Fa9, Do add9), qui respire au lieu de jouer ;
  - une pulsation grave et feutrée, deux coups par mesure ;
  - des micro-clics (bruit et sinus aigus, 2 à 6 ms) placés au hasard sur
    les doubles croches et dispersés en stéréo : la texture « expérimentale » ;
  - une cloche FM sur un rythme euclidien qui tourne d'une section à l'autre,
    passée dans un écho ping-pong ;
  - un bégaiement de cloche toutes les quatre mesures, comme une erreur voulue.

Cinq minutes en sections de huit mesures dont la densité change : chaque vidéo
démarre à un endroit différent (`music` dans scripts/cartesia-shorts.mjs) et
n'entend donc pas la même chose. 92 bpm, ré dorien.

  python scripts/music-minimal.py   ->   public/music-minimal.mp3
"""
import subprocess
import numpy as np
from scipy.signal import butter, sosfilt
import wave

SR = 44100
BPM = 92
BEAT = 60 / BPM
S16 = BEAT / 4
BAR = BEAT * 4
DUR = 300.0
N = int(DUR * SR)
rng = np.random.default_rng(7)
t = np.arange(N) / SR
L = np.zeros(N)
R = np.zeros(N)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(buf_l, buf_r, sig, at, pan=0.0, gain=1.0):
    i = int(at * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    buf_l[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 - pan))
    buf_r[i:i + len(sig)] += sig * np.sqrt(0.5 * (1 + pan))


def section(x):
    """0..1 : la densité de la section en cours (huit mesures)."""
    k = int(x / (BAR * 8))
    return [0.35, 0.6, 0.85, 0.5, 1.0, 0.7, 0.45, 0.9, 0.6, 0.8, 0.4, 0.75, 0.95, 0.55, 0.65][k % 15]


# ---------------------------------------------------------------- la nappe
CHORDS = [
    [50, 53, 57, 60, 64],   # Rém9
    [46, 50, 53, 57, 60],   # Sib7M
    [41, 45, 48, 52, 55],   # Fa9 (sans tierce haute)
    [48, 52, 55, 62, 64],   # Do add9
]
pad = np.zeros(N)
seg = BAR * 2
fade = 1.4
for ci, start in enumerate(np.arange(0, DUR, seg)):
    notes = CHORDS[ci % len(CHORDS)]
    n0 = int(max(0, start - fade) * SR)
    n1 = min(N, int((start + seg + fade) * SR))
    tt = t[n0:n1]
    env = np.clip((tt - (start - fade)) / (2 * fade), 0, 1) * np.clip(((start + seg + fade) - tt) / (2 * fade), 0, 1)
    env = np.sin(env * np.pi / 2) ** 2
    s = np.zeros(n1 - n0)
    for m in notes:
        f = hz(m)
        for det in (-4, 0, 4):
            ff = f * 2 ** (det / 1200)
            s += np.sin(2 * np.pi * ff * tt + rng.uniform(0, 6.28)) * (0.6 if det else 1.0)
        s += 0.15 * np.sin(2 * np.pi * 2 * f * tt)
    pad[n0:n1] += s * env / len(notes)
# un filtre passe-bas qui s'ouvre et se ferme lentement : blocs de 50 ms
out = np.zeros(N)
blk = int(0.05 * SR)
zi = None
for b in range(0, N, blk):
    x = b / SR
    fc = 500 + 900 * (0.5 + 0.5 * np.sin(2 * np.pi * x / 23.0)) * (0.6 + 0.4 * section(x))
    sos = butter(2, fc, btype='low', fs=SR, output='sos')
    seg_out = sosfilt(sos, pad[b:b + blk], zi=zi if zi is not None else np.zeros((sos.shape[0], 2)))
    out[b:b + blk], zi = seg_out
pad = out * 0.22
L += pad * 0.95
R += pad * 1.0
# une nappe un peu décalée à droite pour la largeur
R[int(0.013 * SR):] += pad[: N - int(0.013 * SR)] * 0.25

# ---------------------------------------------------------------- la pulsation
kick_t = np.arange(int(0.45 * SR)) / SR
freq = 48 + 50 * np.exp(-kick_t * 28)
kick = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-kick_t * 7.5)
kick = sosfilt(butter(2, 180, btype='low', fs=SR, output='sos'), kick)
for b, start in enumerate(np.arange(0, DUR, BAR)):
    d = section(start)
    if d < 0.4:
        continue
    add(L, R, kick, start, gain=0.55)
    add(L, R, kick, start + BEAT * 2.5, gain=0.4 * d)

# ---------------------------------------------------------------- les micro-clics
hp = butter(2, 2500, btype='high', fs=SR, output='sos')
for i, start in enumerate(np.arange(0, DUR, S16)):
    d = section(start)
    pos = i % 16
    p = (0.55 if pos % 4 == 2 else 0.18) * d
    if rng.random() > p:
        continue
    if rng.random() < 0.6:
        n = int(rng.uniform(0.002, 0.006) * SR)
        c = sosfilt(hp, rng.standard_normal(n)) * np.exp(-np.arange(n) / (n / 4))
        g = rng.uniform(0.04, 0.11)
    else:
        n = int(0.012 * SR)
        tt = np.arange(n) / SR
        c = np.sin(2 * np.pi * rng.choice([3200, 4100, 5300, 6800]) * tt) * np.exp(-tt * 700)
        g = rng.uniform(0.03, 0.07)
    add(L, R, c, start + rng.normal(0, 0.004), pan=rng.uniform(-0.9, 0.9), gain=g)

# ---------------------------------------------------------------- la cloche FM, en euclidien
def euclid(k, n, rot):
    return [((i + rot) * k) % n < k for i in range(n)]


def bell(f, dur=1.1):
    tt = np.arange(int(dur * SR)) / SR
    idx = 2.2 * np.exp(-tt * 9)
    return np.sin(2 * np.pi * f * tt + idx * np.sin(2 * np.pi * f * 3.5 * tt)) * np.exp(-tt * 4.2)


SCALE = [62, 65, 67, 69, 72, 74, 76, 79]  # ré dorien, pentatonique
bl = np.zeros(N)
br = np.zeros(N)
notes_played = []
for barn, bstart in enumerate(np.arange(0, DUR, BAR)):
    d = section(bstart)
    pat = euclid(5 if d > 0.6 else 3, 16, (barn // 8) % 5)
    for s16, on in enumerate(pat):
        if not on or rng.random() > 0.35 + 0.6 * d:
            continue
        m = SCALE[(barn * 3 + s16 * 5) % len(SCALE)]
        at = bstart + s16 * S16
        b = bell(hz(m))
        pan = rng.uniform(-0.5, 0.5)
        add(bl, br, b, at, pan=pan, gain=0.13)
        notes_played.append((at, m))
# l'écho ping-pong, en croche pointée
dly = int(BEAT * 0.75 * SR)
wl, wr = np.zeros(N), np.zeros(N)
src_l, src_r = bl.copy(), br.copy()
g = 0.42
for k in range(1, 7):
    sh = dly * k
    if sh >= N:
        break
    # alternance gauche / droite
    if k % 2:
        wr[sh:] += src_l[: N - sh] * g ** k
        wl[sh:] += src_r[: N - sh] * g ** k
    else:
        wl[sh:] += src_l[: N - sh] * g ** k
        wr[sh:] += src_r[: N - sh] * g ** k
lp = butter(2, 3500, btype='low', fs=SR, output='sos')
L += bl + sosfilt(lp, wl) * 0.55
R += br + sosfilt(lp, wr) * 0.55

# ---------------------------------------------------------------- le bégaiement
for bstart in np.arange(BAR * 3, DUR, BAR * 4):
    if section(bstart) < 0.5:
        continue
    at = bstart + BEAT * 3.5
    m = SCALE[int(bstart) % len(SCALE)] + 12
    grain = bell(hz(m), 0.06)
    for r in range(6):
        add(L, R, grain * (1 - r / 7), at + r * S16 / 2, pan=(-1) ** r * 0.7, gain=0.09)

# ---------------------------------------------------------------- l'air
air = sosfilt(butter(2, [3000, 9000], btype='band', fs=SR, output='sos'), rng.standard_normal(N))
swell = 0.5 + 0.5 * np.sin(2 * np.pi * t / 17.0)
L += air * swell * 0.006
R += np.roll(air, 4410) * swell * 0.006

# ---------------------------------------------------------------- le master
mix = np.stack([L, R], 1)
mix = np.tanh(mix * 1.4) / 1.4
fade_in = np.clip(t / 1.5, 0, 1)
fade_out = np.clip((DUR - t) / 3, 0, 1)
mix *= (fade_in * fade_out)[:, None]
rms = np.sqrt(np.mean(mix ** 2))
target = 10 ** (-16 / 20)
mix *= target / rms
peak = np.max(np.abs(mix))
if peak > 0.89:
    mix *= 0.89 / peak
pcm = (mix * 32767).astype(np.int16)
with wave.open('out/music-minimal.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'out/music-minimal.wav', '-b:a', '160k', 'public/music-minimal.mp3'], check=True)
print('public/music-minimal.mp3', DUR, 's')
