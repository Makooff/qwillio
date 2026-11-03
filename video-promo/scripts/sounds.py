"""Les sons du film, synthétisés à partir de scripts/sfx.json.

Pas de musique. Un son par ÉVÉNEMENT (src/timeline.ts), et jamais deux fois le
même : chaque famille a son timbre, et chaque occurrence une graine qui fait
varier la hauteur, la durée et la place dans l'espace stéréo. C'est ce qui
manquait à la version précédente, où le même pop revenait 92 fois.
"""
import json
import wave
import numpy as np

SR = 48000
spec = json.load(open('scripts/sfx.json'))
N = int(SR * spec['duration'])
mix = np.zeros((2, N))


def T(n):
    return np.arange(n) / SR


def lowpass(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / fc) ** 4), len(x))


def highpass(x, fc):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (fc / np.maximum(f, 1)) ** 4), len(x))


def env(n, attack, decay):
    t = T(n)
    return np.minimum(1, t / attack) * np.exp(-t / decay)


def tone(f, dur, decay, attack=0.002, partials=((1, 1),)):
    n = int(dur * SR)
    t = T(n)
    y = sum(a * np.sin(2 * np.pi * f * r * t) for r, a in partials)
    return y * env(n, attack, decay)


def noise(dur, rng):
    return rng.standard_normal(int(dur * SR))


def note(m):
    return 440 * 2 ** ((m - 69) / 12)


# --- les timbres ------------------------------------------------------------

def ring(rng, v):
    # Une sonnerie douce, quatre notes alternées, comme un téléphone posé sur la table.
    out = np.zeros(int(0.9 * SR))
    seq = [76, 81, 76, 81]
    for i, m in enumerate(seq):
        s = tone(note(m) * v, 0.3, 0.09, 0.004, ((1, 1), (2, 0.25), (3, 0.08)))
        i0 = int(i * 0.17 * SR)
        out[i0:i0 + len(s)] += s[: len(out) - i0]
    return lowpass(out, 5000) * 0.5


def notify(rng, v):
    # Verre léger : partiels inharmoniques d'une petite cloche.
    m = rng.choice([86, 88, 91, 93])
    return tone(note(m) * v, 0.9, 0.22, 0.001, ((1, 1), (2.76, 0.35), (5.4, 0.12))) * 0.42


def swell(rng, v):
    n = int(0.55 * SR)
    t = T(n)
    f = 160 * v * (1 + 1.4 * (t / 0.55) ** 2)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.55) ** 2
    hiss = lowpass(noise(0.55, rng), 1800) * (t / 0.55) ** 2 * 0.15
    return (y * 0.5 + hiss)


def logo(rng, v):
    n = int(1.4 * SR)
    t = T(n)
    f = 70 * v + 90 * np.exp(-t / 0.05)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.22)
    body = tone(note(69) * v, 1.4, 0.28, 0.002, ((1, 1), (2, 0.3)))
    sparkle = np.zeros(n)
    s = tone(note(93) * v, 1.0, 0.35, 0.002, ((1, 1), (2.76, 0.25)))
    i0 = int(0.06 * SR)
    sparkle[i0:i0 + len(s)] += s[: n - i0]
    return thump * 0.8 + body * 0.35 + sparkle * 0.22


def air(rng, v):
    n = int(0.7 * SR)
    t = T(n)
    y = lowpass(noise(0.7, rng), 2200 * v) * np.sin(np.pi * np.minimum(1, t / 0.7)) ** 3
    return y * 0.35


def answer(rng, v):
    a = tone(note(79) * v, 0.5, 0.16, 0.003, ((1, 1), (2, 0.2)))
    b = tone(note(86) * v, 0.6, 0.2, 0.003, ((1, 1), (2, 0.2)))
    out = np.zeros(int(0.8 * SR))
    out[: len(a)] += a
    i0 = int(0.11 * SR)
    out[i0:i0 + len(b)] += b[: len(out) - i0]
    return out * 0.4


def voice(rng, v, ai):
    # Petite note boisée : le fondamental et un partiel aigu qui s'éteint vite.
    m = rng.choice([81, 84] if ai else [74, 77])
    n = int(0.35 * SR)
    t = T(n)
    f = note(m) * v
    y = np.sin(2 * np.pi * f * t) * env(n, 0.002, 0.07) + 0.4 * np.sin(2 * np.pi * f * 3.98 * t) * env(n, 0.001, 0.015)
    return y * 0.48


def click(rng, v):
    out = np.zeros(int(0.12 * SR))
    for k, (dt, g) in enumerate(((0.0, 1.0), (0.055 * v, 0.55))):
        n = int(0.012 * SR)
        s = highpass(noise(0.012, rng), 1500) * env(n, 0.0003, 0.0025) * g
        s += np.sin(2 * np.pi * (2400 - 500 * k) * v * T(n)) * env(n, 0.0002, 0.003) * 0.6 * g
        i0 = int(dt * SR)
        out[i0:i0 + n] += s
    return out * 1.1


def bump(rng, v):
    # Une vraie bulle : la hauteur MONTE quand elle éclate.
    n = int(0.16 * SR)
    t = T(n)
    f = 520 * v * (1 + 0.9 * t / 0.16)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.045)
    return y * 0.55


def land(rng, v):
    n = int(0.3 * SR)
    t = T(n)
    thud = np.sin(2 * np.pi * np.cumsum(150 * v + 60 * np.exp(-t / 0.02)) / SR) * env(n, 0.002, 0.06)
    tick = highpass(noise(0.3, rng), 3000) * env(n, 0.0005, 0.004) * 0.3
    return (thud * 0.6 + tick)


def confirm(rng, v):
    a = tone(note(84) * v, 0.5, 0.12, 0.002, ((1, 1), (3.98, 0.2)))
    b = tone(note(91) * v, 0.7, 0.2, 0.002, ((1, 1), (3.98, 0.2)))
    out = np.zeros(int(0.9 * SR))
    out[: len(a)] += a
    i0 = int(0.09 * SR)
    out[i0:i0 + len(b)] += b[: len(out) - i0]
    return out * 0.38


def slide(rng, v):
    n = int(0.45 * SR)
    t = T(n)
    y = np.zeros(n)
    x = noise(0.45, rng)
    # balayage d'un passe-bas qui descend : le panneau qui glisse et s'arrête
    a = 0.0
    fc = 3500 * v * np.exp(-t / 0.15) + 300
    al = 1 - np.exp(-2 * np.pi * fc / SR)
    for i in range(n):
        a += al[i] * (x[i] - a)
        y[i] = a
    return y * np.sin(np.pi * np.minimum(1, t / 0.45)) ** 2 * 0.5


KINDS = {
    'ring': ring, 'notify': notify, 'swell': swell, 'logo': logo, 'air': air, 'answer': answer,
    'click': click, 'bump': bump, 'land': land, 'confirm': confirm, 'slide': slide,
}


def place(sig, t0, gain, pan):
    i = int(t0 * SR)
    n = min(len(sig), N - i)
    if n <= 0:
        return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[0, i:i + n] += sig[:n] * gain * l * 1.41
    mix[1, i:i + n] += sig[:n] * gain * r * 1.41


for c in spec['cues']:
    rng = np.random.default_rng(1000 + c['seed'])
    v = 1 + rng.uniform(-0.03, 0.03)  # chaque occurrence, sa hauteur
    pan = rng.uniform(-0.3, 0.3)
    k = c['kind']
    sig = voice(rng, v, ai=c.get('gain', 1) > 0.6) if k == 'voice' else KINDS[k](rng, v)
    place(sig, c['t'], c.get('gain', 1), pan)

# une petite pièce, pour que les sons ne flottent pas dans le vide
rng = np.random.default_rng(9)
irn = int(0.5 * SR)
ti = T(irn)
for ch in (0, 1):
    ir = lowpass(rng.standard_normal(irn), 6000) * np.exp(-ti / 0.09)
    ir /= np.sqrt((ir ** 2).sum())
    M = 1 << int(np.ceil(np.log2(N + irn)))
    mix[ch] += 0.14 * np.fft.irfft(np.fft.rfft(mix[ch], M) * np.fft.rfft(ir, M), M)[:N]

mix /= np.abs(mix).max() / 0.89
w = wave.open('public/sounds.wav', 'wb')
w.setnchannels(2)
w.setsampwidth(2)
w.setframerate(SR)
w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
w.close()
print('ok', len(spec['cues']), 'sons')
