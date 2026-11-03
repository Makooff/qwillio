// Prépare ce que la composition lit et qui ne se versionne pas :
// le logo (lu depuis la source unique du dépôt) et les images des deux plans filmés.
import fs from 'fs'; import { execFileSync } from 'child_process';
const pub = '../frontend/public';
fs.writeFileSync('logo.js', 'window.LOGO_SVG=' + JSON.stringify(fs.readFileSync(`${pub}/qwillio-logo-512.svg`, 'utf8')) + ';');
const grade = 'fps=60,scale=1920:1080:flags=lanczos,eq=contrast=1.08:saturation=0.75:brightness=-0.04';
const gradeFor = name => (name === 'cafe' ? 'fps=60,scale=1920:1080:flags=lanczos,eq=saturation=0.85' : grade);
for (const [name, file, ss, len] of [['bakery', 'sector-bakery.mp4', '1.0', '2.2'], ['salon', 'sector-salon.mp4', '2.0', '2.2'], ['cafe', 'service-cafe.mp4', '1.0', '4.8']]) {
  fs.mkdirSync(`foot/${name}`, { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', ss, '-t', len, '-i', `${pub}/marketing/${file}`, '-vf', gradeFor(name), '-q:v', '3', `foot/${name}/%04d.jpg`]);
}
// La réceptionniste de la carte d'appel : le personnage « Marie » du site.
fs.mkdirSync('assets', { recursive: true });
fs.copyFileSync(`${pub}/characters/marie.webp`, 'assets/marie.webp');
console.log('assets ok');
