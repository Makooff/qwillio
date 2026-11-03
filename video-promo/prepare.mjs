// Prépare ce que la composition lit et qui ne se versionne pas :
// le logo (lu depuis la source unique du dépôt) et les images des deux plans filmés.
import fs from 'fs'; import { execFileSync } from 'child_process';
const pub = '../frontend/public';
fs.writeFileSync('logo.js', 'window.LOGO_SVG=' + JSON.stringify(fs.readFileSync(`${pub}/qwillio-logo-512.svg`, 'utf8')) + ';');
const grade = 'fps=60,scale=1920:1080:flags=lanczos,eq=contrast=1.08:saturation=0.75:brightness=-0.04';
for (const [name, file, ss] of [['bakery', 'sector-bakery.mp4', '1.0'], ['salon', 'sector-salon.mp4', '2.0']]) {
  fs.mkdirSync(`foot/${name}`, { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', ss, '-t', '2.2', '-i', `${pub}/marketing/${file}`, '-vf', grade, '-q:v', '3', `foot/${name}/%04d.jpg`]);
}
console.log('assets ok');
