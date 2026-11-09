"""La signature sonore du logo (public/jingle.mp3), 3 s.

Troisième version, sur le retour du propriétaire : « plutôt pop, satisfaisant,
ambiant ». Ce qui donne cette sensation :
  - un arpège montant, rapide et clair (fa - la - do - fa), en notes pincées
    rondes : la montée qui se résout sur la tonique, c'est le « satisfaisant » ;
  - un « pop » doux sur la note d'arrivée, une bulle qui monte en 40 ms ;
  - une nappe de fa majeur 9 qui s'ouvre sous l'arrivée et s'éteint lentement
    dans un écho : l'ambiance.
La note d'arrivée tombe à 1,0 s : c'est elle qu'on cale sur le logo formé.

  python scripts/jingle.py
"""
import pathlib
import numpy as np

# Les briques de synthèse sont celles de la musique, pour que tout sonne pareil.
SR = 44100


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def load():
    # music-minimal.py produit sa piste à l'import : on n'en prend que les fonctions.
    src = pathlib.Path(__file__).with_name('music-minimal.py').read_text()
    head = src.split('# ================================================================== la piste')[0]
    ns = {}
    exec(compile(head, 'music-minimal.py', 'exec'), ns)
    return ns


m = load()
Track, pad_note, lp, echo, master = m['Track'], m['pad_note'], m['lp'], m['echo'], m['master']


def round_pluck(f, dur=1.4, decay=3.5):
    """Une note pincée ronde, façon marimba douce : fondamentale, octave brève."""
    tt = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 14) + 0.15 * np.sin(2 * np.pi * 4 * f * tt) * np.exp(-tt * 30)
    return s * np.exp(-tt * decay) * np.minimum(1, tt * 500) * np.minimum(1, (dur - tt) / 0.1)


def pop(dur=0.09):
    tt = np.arange(int(dur * SR)) / SR
    f = 500 + 900 * np.minimum(1, tt / 0.04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 45) * np.minimum(1, tt * 2000)


jg = Track(3.0)
for at, note, g in ((0.70, 77, 0.75), (0.78, 81, 0.8), (0.86, 84, 0.85)):
    jg.add(round_pluck(hz(note), 1.0, 5.0), at, pan=-0.2 + 0.2 * (note - 77) / 7, gain=0.22 * g)
# l'arrivée : fa6 et fa5 ensemble, et la bulle
jg.add(round_pluck(hz(89), 1.8, 2.4), 1.0, pan=0.15, gain=0.16)
jg.add(round_pluck(hz(77), 1.8, 2.2), 1.0, pan=-0.1, gain=0.20)
jg.add(pop(), 1.0, gain=0.10)
# la nappe de fa majeur 9 qui s'ouvre
chord = np.zeros(int(2.0 * SR))
for note in (53, 57, 60, 64, 67):
    chord += pad_note(hz(note), 2.0)
tt = np.arange(len(chord)) / SR
chord = lp(chord / 5 * np.minimum(1, tt / 0.35) * np.exp(-np.maximum(0, tt - 0.5) * 1.8) * np.minimum(1, (2.0 - tt) / 0.3), 1800)
jg.add(chord, 0.92, gain=0.30)
el, er = echo(jg.l, jg.r, 60 / 108 * 0.5, fb=0.32, taps=4, tone=4500)
jg.l += el * 0.45
jg.r += er * 0.45
master(jg, -16, 'public/jingle.mp3', fade_in=0.0, fade_out=0.5)
