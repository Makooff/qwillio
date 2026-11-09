"""La signature sonore du logo (public/jingle.mp3), environ 3 s.

Choisie à l'oreille par le propriétaire parmi trois pistes (scripts/jingle-options.py,
version B), après quatre refus : « trop bizarre », « pas assez minimal », puis
deux fois « trop jeu vidéo » (arpège rapide, pop). Ce qui reste : un accord de fa
majeur 9 en sinus doux qui gonfle et se pose sur le logo formé, une note de piano
feutré au sommet, et beaucoup d'air (réverbération). Peu de notes, aucune
attaque brillante.
La crête tombe à 1,0 s : c'est elle qu'on cale sur le logo formé.

  python scripts/jingle.py
"""
import runpy
import pathlib
import shutil

# La version B est fabriquée par jingle-options.py ; on la promeut telle quelle.
runpy.run_path(str(pathlib.Path(__file__).with_name('jingle-options.py')))
shutil.copy('out/jingle-b.mp3', 'public/jingle.mp3')
print('public/jingle.mp3 <- version B')
