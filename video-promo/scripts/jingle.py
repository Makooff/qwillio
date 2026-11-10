"""Le son du logo (public/jingle.mp3) : le pop D de scripts/pop-options.py.

Choisi à l'oreille par le propriétaire parmi quatre pops (bulle, goutte,
bouchon, bulle + note) : la bulle suivie d'une petite note claire. Le fichier
commence par une seconde de silence : la frise le lance une seconde avant le
logo formé, le pop tombe dessus.

  python scripts/jingle.py
"""
import runpy
import pathlib
import shutil

runpy.run_path(str(pathlib.Path(__file__).with_name('pop-options.py')))
shutil.copy('out/pop-d.mp3', 'public/jingle.mp3')
print('public/jingle.mp3 <- pop D')
