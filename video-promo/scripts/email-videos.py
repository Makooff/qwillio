"""Les vidéos des e-mails de vente : version web légère + vignette cliquable.

Un e-mail ne lit pas de vidéo (Gmail, Outlook et Apple Mail la bloquent ou la
mettent en pièce jointe, ce qui envoie en spam). La règle du métier : une
image fixe avec un bouton lecture, qui renvoie vers la vidéo hébergée.

Sortie, servie par Vercel :
  frontend/public/v/<langue>/<slug>.mp4   4:5, 720 px, ~1,5 Mo, démarre tout de suite
  frontend/public/v/<langue>/<slug>.jpg   vignette 600 px avec le bouton lecture

  python video-promo/scripts/email-videos.py            (toutes les langues)
  python video-promo/scripts/email-videos.py nl         (une seule)
"""
import pathlib, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOC = ROOT / 'video-promo' / 'social'
OUT = ROOT / 'frontend' / 'public' / 'v'
# Les cinq vidéos qui servent la vente : le problème, le cabinet la nuit,
# l'urgence (artisans), l'objection « elle va inventer », et l'appel à l'essai.
PICK = ['s01', 's02', 's05', 's06', 's11']
# L'image de couverture de chaque vidéo (celle où la première phrase est entière), en images à 30 fps.
COVER = {f'{l.split()[0]}': int(l.split()[2]) for l in (ROOT / 'video-promo' / 'scripts' / 'cover-frames.txt').read_text().splitlines() if l.strip()}

def play_overlay(img: Image.Image) -> Image.Image:
    w, h = img.size
    over = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    r = int(w * 0.11)
    cx, cy = w // 2, int(h * 0.8)
    # une ombre douce, puis le disque blanc et le triangle indigo de la marque
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx - r, cy - r + 6, cx + r, cy + r + 6], fill=(20, 10, 40, 90))
    over = Image.alpha_composite(over, sh.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(over)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 240))
    t = r * 0.42
    d.polygon([(cx - t * 0.7, cy - t), (cx - t * 0.7, cy + t), (cx + t, cy)], fill=(122, 95, 255, 255))
    return Image.alpha_composite(img.convert('RGBA'), over).convert('RGB')

langs = [a for a in sys.argv[1:2]] or ['fr', 'en', 'nl']
for lang in langs:
    (OUT / lang).mkdir(parents=True, exist_ok=True)
    for f in sorted((SOC / lang / '4x5').glob('s*.mp4')):
        if f.stem[:3] not in PICK:
            continue
        mp4 = OUT / lang / f.name
        subprocess.run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-i', str(f), '-vf', 'scale=720:-2',
                        '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p',
                        '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', str(mp4)], check=True)
        # la vignette : la même image que la couverture TikTok, titre entier
        at = COVER.get(f'{lang}-{f.stem[:3]}', 90) / 30
        frame = OUT / lang / (f.stem + '.frame.png')
        subprocess.run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-ss', f'{at:.2f}', '-i', str(f), '-frames:v', '1',
                        '-vf', 'scale=600:-2', str(frame)], check=True)
        play_overlay(Image.open(frame)).save(OUT / lang / (f.stem + '.jpg'), quality=86, optimize=True, progressive=True)
        frame.unlink()
        print(lang, f.stem, round(mp4.stat().st_size / 1e6, 1), 'Mo')
