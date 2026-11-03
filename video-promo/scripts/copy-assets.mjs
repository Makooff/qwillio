// Ce que le film lit dans le reste du dépôt, copié et jamais redessiné :
// le logo (source unique) et Marie, le personnage réceptionniste du portail.
import fs from 'fs';
const pub = '../frontend/public';
fs.mkdirSync('public', { recursive: true });
fs.copyFileSync(`${pub}/qwillio-logo-512.svg`, 'public/qwillio-logo-512.svg');
fs.copyFileSync(`${pub}/characters/marie.webp`, 'public/marie.webp');
console.log('assets ok');
