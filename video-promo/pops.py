"""Bande-son du film : uniquement des pops, aux instants que la page déclare.

La composition (index.html) publie la liste de ses apparitions dans window.SFX ;
`node render.mjs sfx` l'écrit dans sfx.json. Le son ne connaît donc aucun temps
par lui-même : déplacer une animation déplace son pop.
"""
import json, wave
import numpy as np

SR = 48000
DUR = 49.5
N = int(SR * DUR)
rs = np.random.default_rng(5)
mix = np.zeros((2, N))

def T(n): return np.arange(n) / SR

def lowpass(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / fc) ** 4), len(x))

def body(f, dur, drop=1.6, drop_t=0.022, decay=0.07, harm=0.18):
    """Une bulle qui éclate : départ plus aigu, chute rapide vers sa note, extinction ronde."""
    n = int(dur * SR); t = T(n)
    freq = f * (1 + (drop - 1) * np.exp(-t / drop_t))
    ph = 2 * np.pi * np.cumsum(freq) / SR
    env = np.minimum(1, t / 0.0012) * np.exp(-t / decay)
    y = (np.sin(ph) + harm * np.sin(2 * ph)) * env
    click = lowpass(rs.standard_normal(n), 4500) * np.exp(-t / 0.0018) * 0.25
    return y + click

def thump(f=110, dur=0.18, decay=0.05):
    n = int(dur * SR); t = T(n)
    ph = 2 * np.pi * np.cumsum(f * (1 + 0.8 * np.exp(-t / 0.015))) / SR
    return np.sin(ph) * np.minimum(1, t / 0.002) * np.exp(-t / decay)

def note(p, base=520.0): return base * 2 ** (p / 12)

def make(kind, p):
    if kind == 'tiny':
        return [(0, body(note(p, 880), 0.12, drop=1.45, decay=0.035, harm=0.1) * 0.55)]
    if kind == 'pop':
        return [(0, body(note(p), 0.2, decay=0.065) + 0.35 * thump(note(p) / 4, 0.2, decay=0.03))]
    if kind == 'big':
        return [(0, body(note(p, 330), 0.4, drop=1.9, drop_t=0.03, decay=0.14) + 0.7 * thump(95, 0.4, 0.09)),
                (0.045, body(note(p + 12, 660), 0.25, decay=0.08) * 0.45),
                (0.09, body(note(p + 19, 660), 0.25, decay=0.07) * 0.3)]
    if kind == 'double':
        return [(0, body(note(p), 0.2, decay=0.06)), (0.075, body(note(p + 7), 0.22, decay=0.07))]
    if kind == 'ring':  # la sonnerie, en roulé de petites bulles
        return [(i * 0.048, body(note(p + (0, 5, 0, 5, 0, 5)[i], 700), 0.12, decay=0.03) * 0.6) for i in range(6)]
    if kind == 'swell':  # bulle qui monte, quand les lobes se mettent en route
        n = int(0.32 * SR); t = T(n)
        ph = 2 * np.pi * np.cumsum(180 * (1 + 1.6 * (t / 0.32) ** 2)) / SR
        return [(0, np.sin(ph) * np.sin(np.pi * t / 0.32) ** 2 * 0.6)]
    raise ValueError(kind)

def place(sig, t0, gain, pan):
    i = int(t0 * SR); n = min(len(sig), N - i)
    if n <= 0: return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[0, i:i + n] += sig[:n] * gain * l * 1.41
    mix[1, i:i + n] += sig[:n] * gain * r * 1.41

for c in json.load(open('sfx.json')):
    pan = max(-0.45, min(0.45, (c['pitch'] - 7) / 24))  # plus aigu, un peu plus à droite
    for dt, s in make(c['kind'], c['pitch']):
        place(s, c['t'] + dt, c['gain'], pan)

# une pièce courte et sèche, pour que les pops ne sonnent pas « dans le vide »
irn = int(0.35 * SR); ti = T(irn)
for ch in (0, 1):
    ir = lowpass(rs.standard_normal(irn), 5000) * np.exp(-ti / 0.07); ir /= np.sqrt((ir ** 2).sum())
    M = 1 << int(np.ceil(np.log2(N + irn)))
    mix[ch] += 0.12 * np.fft.irfft(np.fft.rfft(mix[ch], M) * np.fft.rfft(ir, M), M)[:N]

mix /= np.abs(mix).max() / 0.89
w = wave.open('pops.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix.T * 32767).astype(np.int16).tobytes()); w.close()
print('ok')
