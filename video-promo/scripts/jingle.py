"""Le son du logo (public/jingle.mp3), environ 3 s.

Cinquième version. Le propriétaire a refusé une mélodie après l'autre (« trop
bizarre », « pas assez minimal », « trop jeu vidéo ») puis l'accord qui gonfle,
encore trop : « encore plus minimaliste, pas une mélodie pour le logo ».
Donc aucune note qui se suit, aucun accord qui se lit comme tel :
  - un souffle d'air filtré qui monte doucement pendant que le logo se forme ;
  - à 1,0 s, quand le logo est formé, un seul son grave et rond (une fondamentale
    et son octave, très feutrés) qui s'éteint dans une réverbération.
C'est une respiration, pas une signature musicale.

  python scripts/jingle.py
"""
import pathlib
import numpy as np

src = pathlib.Path(__file__).with_name('music-minimal.py').read_text()
ns = {}
exec(compile(src.split('# ================================================================== la piste')[0], 'music-minimal.py', 'exec'), ns)
Track, lp, hp, master = ns['Track'], ns['lp'], ns['hp'], ns['master']
SR = 44100
rng = np.random.default_rng(5)


def reverb(tr, size=2.2, wet=0.5):
    n = int(size * SR)
    t = np.arange(n) / SR
    for ch in ('l', 'r'):
        ir = lp(rng.standard_normal(n) * np.exp(-t * 3.0 / size), 4000)
        ir /= np.sqrt(np.sum(ir ** 2))
        x = getattr(tr, ch)
        y = np.fft.irfft(np.fft.rfft(x, len(x) + n) * np.fft.rfft(ir, len(x) + n))[: len(x)]
        setattr(tr, ch, x * (1 - wet) + y * wet * 0.6)


tr = Track(3.2)
# le souffle : un bruit doux, passé dans un filtre qui s'ouvre, jusqu'à 1,0 s
n = int(1.15 * SR)
t = np.arange(n) / SR
noise = hp(rng.standard_normal(n), 150)
# le filtre qui s'ouvre : un fondu entre un bruit sombre et un bruit clair
# (filtrer par blocs ferait des clics à chaque coupure)
x = (t / 1.15) ** 2
air = lp(noise, 450) * (1 - x) + lp(noise, 3000) * x
env = (t / 1.0).clip(0, 1) ** 2.2 * np.minimum(1, (1.15 - t) / 0.15)
tr.add(air * env, 0.0, pan=-0.1, gain=0.10)
tr.add(np.roll(air, 900) * env, 0.0, pan=0.1, gain=0.10)

# le son : une fondamentale grave et son octave, très feutrés, à 1,0 s
d = 2.1
t = np.arange(int(d * SR)) / SR
f = 87.31  # fa2
tone = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 2.5) + 0.08 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 5)
tone = lp(tone, 900) * np.minimum(1, t / 0.03) * np.exp(-t * 1.6) * np.minimum(1, (d - t) / 0.3)
tr.add(tone, 1.0, gain=0.38)
reverb(tr)
master(tr, -19, 'public/jingle.mp3', fade_in=0.0, fade_out=0.5)
