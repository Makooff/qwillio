"""Le son du logo (public/jingle.mp3) : le « pop » des effets sonores.

Le propriétaire a écarté toutes les signatures musicales (mélodies, accord,
souffle) : « plutôt les pop fx ». C'est donc le pop de la vidéo de référence
(public/media/sfx/pop.wav, voir src/fx.tsx), précédé d'une seconde de silence :
la frise lance ce fichier une seconde avant le logo formé, le pop tombe dessus.

  python scripts/jingle.py
"""
import subprocess

subprocess.run([
    'ffmpeg', '-v', 'error', '-y', '-i', 'public/media/sfx/pop.wav',
    '-af', 'adelay=1000|1000,apad=pad_dur=1.0,volume=0.9',
    '-b:a', '192k', 'public/jingle.mp3',
], check=True)
print('public/jingle.mp3 <- pop')
