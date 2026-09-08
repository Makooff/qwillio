# Les quatre images du carrousel de l'accueil

Ce sont des **photographies**, générées localement avec FLUX.1-dev sur ComfyUI,
puis converties. Elles ont remplacé des visuels dessinés (colonnes de lumière,
arcs concentriques) qui ne tenaient pas: un dessin qui n'est pas tenu par un
illustrateur se lit comme une image d'agrafe.

Le script qui produisait ces visuels dessinés, `frontend/generate-carousel.mjs`,
a été **supprimé avec eux**. Le garder aurait été un piège: il écrit aux mêmes
quatre chemins, et le premier qui l'aurait lancé aurait effacé les photographies
sans un avertissement.

## Où, et à quelle taille

| Fichier | Panneau | Page visée |
|---|---|---|
| `frontend/public/carousel/a-propos.webp` | À propos | `/about` |
| `frontend/public/carousel/blog.webp` | Blog | `/blog` |
| `frontend/public/carousel/contact.webp` | Contact | `/contact` |
| `frontend/public/carousel/affiliation.webp` | Affiliation | `/affiliate` |

**1600 × 900**, WebP qualité 84. Les fichiers actuels pèsent de 29 à 166 ko.

Le 16:9 n'est pas décoratif: le composant dessine chaque image dans un bloc 16:9
fixe et centré, puis n'en montre qu'une part quand le panneau rétrécit. Le sujet
doit donc vivre au **centre** — une latte repliée ne laisse voir qu'une bande
verticale de 8 px prise au milieu, et un sujet posé sur un bord y donnerait un
aplat.

Tant qu'un fichier manque, le panneau garde son dégradé de repli: le composant
retombe dessus au premier `onError` (`components/ui/carousel-squeeze.tsx`,
fonction `Picture`). Déposer un fichier suffit à le faire apparaître, il n'y a
pas une ligne de code à changer.

## Le registre

Celui de la **vidéo du hero**: un lac alpin dans la brume, crêtes en couches,
vert-gris désaturé, contraste bas, lumière couverte. Pas de mauve de marque dans
ces images, pas de personne reconnaissable, aucun texte lisible — le panneau
porte déjà son mot en surimpression, et un texte dans l'image serait coupé en
deux dès que la carte se replie.

Les quatre se distinguent par **d'où on regarde**, jamais par une variation de
teinte: de face dans la brume, à la verticale de jour, à la verticale de nuit, à
la verticale sur l'eau.

| Panneau | La photographie |
|---|---|
| À propos | des crêtes boisées émergeant d'une mer de nuages, au petit jour |
| Blog | une route de montagne serpentant dans une forêt de conifères, vue du ciel |
| Contact | un échangeur autoroutier de nuit, à la verticale, traversé de traînées lumineuses |
| Affiliation | deux rivières glaciaires qui se rejoignent sur du sable noir, vues du ciel |

## En refaire une

Modèle: **FLUX.1-dev** en GGUF `Q6_K` (≈ 9,8 Go), qui tient sur 12 Go de VRAM.
Encodeur de texte `t5xxl_fp8_e4m3fn` + `clip_l`, VAE `ae.safetensors`. Le nœud
**ComfyUI-GGUF** est nécessaire pour charger le `.gguf`.

Rendu en **1344 × 768**, 28 pas, sampler `euler`, scheduler `simple`,
guidance 3.5. Puis agrandissement lanczos et recadrage en 1600 × 900.

Suffixe commun aux quatre prompts:

> landscape photograph, 16:9, telephoto compression, heavy atmospheric haze,
> desaturated cool colour grade, low contrast, soft overcast light, fine 35mm
> grain, subject centred in frame, no text, no signage, no logos, no watermark,
> no people.

À bannir, parce que c'est ce que les générateurs sortent par défaut: le casque de
téléopérateur, le globe en fil de fer, le cerveau lumineux, la poignée de main en
costume, le bureau avec un ordinateur portable et une tasse.

## Conversion

Les PNG sortis du générateur ne sont pas versionnés (2 à 4 Mo pièce, et rien ne
les sert). Seuls les WebP entrent dans `public/`:

```bash
cd frontend
node -e "
const sharp = require('sharp');
sharp('source.png').resize({ width: 1600, height: 900, kernel: 'lanczos3' })
  .webp({ quality: 84 }).toFile('public/carousel/blog.webp');
"
```

`sharp` est une dépendance du projet. Ne pas compter sur `ffmpeg`: il n'est pas
garanti présent, et c'est ce qui avait cassé `capture-screens.mjs`.

## Après avoir déposé une image

Relire le rendu **en clair ET en sombre**: ces images ne basculent pas avec le
thème, donc une image trop claire s'imposerait dans une page blanche autant que
dans une page noire. Vérifier aussi le coin **bas-gauche**: c'est là que le nom
du panneau s'écrit en blanc, sur un dégradé sombre. Les quatre actuelles y sont
foncées; une image claire à cet endroit demanderait de renforcer le dégradé.
