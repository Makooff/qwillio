#!/usr/bin/env node
/**
 * Regenerates the app icons from the single logo source.
 *
 * Why this exists: the shipped icons were the bare logo on a transparent
 * canvas, with the mark spanning ~91% of the square. Two consequences:
 *   - the background was whatever the OS composited underneath, so the icon
 *     looked different on iOS, Android and desktop,
 *   - the mark ran to the edges and read as cramped next to other icons.
 *
 * Here the background is explicit and the mark sits at MARK_SCALE of the
 * canvas, which also keeps it inside the Android maskable safe zone.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, '..', 'public');

/** Brand white from the logo itself, so the icon plate matches the mark. */
const PLATE = '#FDFDFF';
/**
 * Shrink applied around the canvas centre. The source art is already centred
 * on (256, 256) and spans ~91% of the width; 0.79 brings it to ~72%, which
 * leaves a comfortable margin and clears the maskable safe zone.
 */
const MARK_SCALE = 0.79;

const logo = readFileSync(join(pub, 'qwillio-logo-512.svg'), 'utf8');

// Lift the inner <g>…</g> out of the source and re-wrap it, so the logo file
// stays the one place the artwork is defined.
const inner = logo.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${PLATE}"/>
  <g transform="translate(256 256) scale(${MARK_SCALE}) translate(-256 -256)">
${inner}
  </g>
</svg>
`;

writeFileSync(join(pub, 'app-icon.svg'), iconSvg);

const targets = [
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-192.png', size: 192 },
  { file: 'apple-touch-icon.png', size: 180 },
];

const buf = Buffer.from(iconSvg);
await Promise.all(
  targets.map(({ file, size }) =>
    sharp(buf, { density: 512 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(join(pub, file))
      .then(() => console.log(`✓ ${file} (${size}×${size})`)),
  ),
);
