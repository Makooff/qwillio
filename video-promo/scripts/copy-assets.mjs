// Ce que le film lit dans le reste du dépôt, copié et jamais redessiné : le logo
// (source unique), Marie, les photos floutées des illustrations du site et le
// plan filmé du service (licence Mixkit, voir frontend/public/marketing/VIDEO-SOURCE.md).
import fs from 'fs';
const pub = '../frontend/public';
fs.mkdirSync('public/marketing', { recursive: true });
fs.copyFileSync(`${pub}/qwillio-logo-512.svg`, 'public/qwillio-logo-512.svg');
fs.copyFileSync(`${pub}/characters/marie.webp`, 'public/marie.webp');
fs.copyFileSync(`${pub}/marketing/service-cafe.mp4`, 'public/service-cafe.mp4');
for (const f of fs.readdirSync(`${pub}/marketing`)) if (f.endsWith('-blur.webp')) fs.copyFileSync(`${pub}/marketing/${f}`, `public/marketing/${f}`);
console.log('assets ok');

// La police d'emoji en couleur (Noto Color Emoji, OFL) : prise sur le système
// plutôt que versionnée (10 Mo). Sans elle, le 📞 du rond de l'appel est gris.
const EMOJI = '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf';
if (fs.existsSync(EMOJI) && !fs.existsSync('public/fonts/NotoColorEmoji.ttf')) fs.copyFileSync(EMOJI, 'public/fonts/NotoColorEmoji.ttf');
