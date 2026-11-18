"""Quatre « pops » pour la fin des vidéos, à choisir à l'oreille (out/pop-*.mp3).

Le propriétaire veut un son de pop satisfaisant à la place de la signature.
Ce qui rend un pop satisfaisant : une attaque nette mais pas sèche, une
hauteur qui bouge (la bulle qui monte, la goutte qui tombe), une queue très
courte et ronde. Chaque fichier a une seconde de silence devant : le pop tombe
à 1,0 s, sur le logo formé.
  A · bulle : un sinus qui monte vite, comme une bulle qui éclate
  B · goutte : un « plop » rond qui descend, façon goutte d'eau
  C · bouchon : un pop grave et sourd, avec un petit claquement
  D · pop doux et brillant : une bulle, puis une note claire très courte
"""
import subprocess
import wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
rng = np.random.default_rng(2)


def lp(x, f):
    return sosfilt(butter(2, f, btype='low', fs=SR, output='sos'), x)


def hp(x, f):
    return sosfilt(butter(2, f, btype='high', fs=SR, output='sos'), x)


def sweep(f0, f1, dur, curve=0.02):
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t / curve)
    return np.sin(2 * np.pi * np.cumsum(f) / SR), t


def write(name, sig):
    out = np.zeros(int(2.0 * SR))
    i = int(1.0 * SR)
    out[i:i + len(sig)] += sig[: len(out) - i]
    out /= np.max(np.abs(out)) + 1e-9
    out *= 0.85
    st = np.stack([out, out], 1)
    wav = f'out/pop-{name}.wav'
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-b:a', '192k', f'out/pop-{name}.mp3'], check=True)
    print(f'out/pop-{name}.mp3')


# A · bulle qui monte
s, t = sweep(260, 980, 0.12, 0.018)
a = s * np.exp(-t * 38) * np.minimum(1, t * 3000)
write('a', a)

# B · goutte qui descend
s, t = sweep(1400, 520, 0.16, 0.015)
b = s * np.exp(-t * 26) * np.minimum(1, t * 4000)
b += 0.25 * np.sin(2 * np.pi * 520 * 2 * t) * np.exp(-t * 40)
write('b', b)

# C · bouchon : grave, rond, petit claquement de bruit au départ
s, t = sweep(420, 180, 0.18, 0.02)
c = s * np.exp(-t * 22) * np.minimum(1, t * 2500)
n = int(0.006 * SR)
c[:n] += hp(rng.standard_normal(n), 1500) * np.exp(-np.arange(n) / (n / 4)) * 0.6
write('c', lp(c, 4000))

# D · bulle douce, puis une note claire très courte (mi6)
s, t = sweep(300, 900, 0.1, 0.016)
d = s * np.exp(-t * 40) * np.minimum(1, t * 3000)
tt = np.arange(int(0.45 * SR)) / SR
bell = (np.sin(2 * np.pi * 1318.5 * tt) + 0.3 * np.sin(2 * np.pi * 2637 * tt) * np.exp(-tt * 20)) * np.exp(-tt * 9) * np.minimum(1, tt * 800)
dd = np.zeros(int(0.06 * SR) + len(bell))
dd[: len(d)] += d
dd[int(0.06 * SR):] += 0.35 * bell
write('d', dd)

# Le son d'apparition d'un titre (public/media/sfx/softpop.wav) : la bulle de A,
# plus basse et plus douce, jouée UNE fois par titre (le propriétaire trouvait
# le clic à chaque mot « trop »).
s, t = sweep(200, 620, 0.09, 0.016)
soft = lp(s * np.exp(-t * 45) * np.minimum(1, t * 2500), 3000)
soft = soft / np.max(np.abs(soft)) * 0.7
with wave.open('public/media/sfx/softpop.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((soft * 32767).astype(np.int16).tobytes())
print('public/media/sfx/softpop.wav')

# Le son des notifications et de tout ce qui apparaît (public/media/sfx/pop.wav) :
# la bulle A, sans silence devant. Le propriétaire n'aimait pas le pop de la
# vidéo de référence sur les notifications : « un pop je veux ».
s, t = sweep(260, 980, 0.12, 0.018)
bub = s * np.exp(-t * 38) * np.minimum(1, t * 3000)
bub = bub / np.max(np.abs(bub)) * 0.8
with wave.open('public/media/sfx/pop.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((bub * 32767).astype(np.int16).tobytes())
print('public/media/sfx/pop.wav')
