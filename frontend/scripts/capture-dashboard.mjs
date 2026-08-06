/* Captures du tableau de bord pour les illustrations du site.
 *
 * La connexion Google ne fonctionne qu'en production : impossible d'ouvrir le
 * dashboard sur une préview. Le script pose donc le jeton dans localStorage
 * (le store d'auth le relit au démarrage) et répond lui-même aux appels d'API
 * avec un client ENTIÈREMENT CONFIGURÉ : renvoi vérifié, appel test fait,
 * personnalisation faite, abonnement actif, quota entamé, appels réels dans la
 * liste. Aucun encart « à configurer », aucune étape de démarrage : le
 * dashboard tel qu'il est une fois installé.
 *
 * Usage : node scripts/capture-dashboard.mjs           (après npm run build)
 *           -> public/screens/hero-dashboard.webp   (1600 de large)
 *           -> public/screens/mobile-overview.webp  (390 de large)
 *
 *         node scripts/capture-dashboard.mjs --figma
 *           -> /tmp/qwillio-figma/*.png, résolution NATIVE des appareils, pour
 *              coller dans les mockups Figma :
 *              - iPhone 15 Pro : 1179 x 2556, avec la bande haute laissée VIDE
 *                (54 pt) pour que la barre d'état du mockup se pose dessus sans
 *                masquer l'en-tête de l'application ;
 *              - fenêtre de navigateur : 3840 x 2115, soit exactement le ratio
 *                du corps du kit macOS (1280 x 705) en 3x.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const PREVIEW_PORT = 4173;
const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const iso = (minutesAgo) => new Date(Date.UTC(2026, 6, 14, 15, 40) - minutesAgo * 60000).toISOString();

const USER = {
  id: 'demo-client',
  name: 'Camille Dubois',
  email: 'camille@studio-lumen.be',
  role: 'client',
  clientId: 'demo-client',
  /* Les trois portes d'inscription de App.tsx (signupStep) : sans elles,
     l'application renvoie vers la confirmation d'adresse ou le paiement. */
  emailConfirmed: true,
  hasSubscription: true,
  onboardingCompleted: true,
};

/* Compte installé de bout en bout : c'est ce qui fait disparaître les encarts
   d'onboarding et les alertes « à configurer » de la page d'accueil. */
const CLIENT = {
  id: 'demo-client',
  businessName: 'Studio Lumen',
  businessType: 'salon',
  planType: 'pro',
  subscriptionStatus: 'active',
  isTrial: false,
  monthlyMinutesQuota: 1500,
  transferNumber: '+32 2 511 84 20',
  vapiPhoneNumber: '+32 2 588 19 04',
  forwardingStatus: 'verified',
  forwardingVerifiedAt: iso(60 * 24 * 12),
  hasTestCall: true,
  hasCustomConfig: true,
  aiEnabled: true,
  agentLanguage: 'fr',
};

const OVERVIEW = {
  client: CLIENT,
  calls: { today: 18, yesterday: 14, thisMonth: 327 },
  sentiment: { positive: 241, neutral: 63, negative: 23 },
  leads: { thisMonth: 96 },
  spam: { blockedThisMonth: 41 },
  minutes: { used: 968, quota: 1500, percent: 65 },
};

/* Seules les issues que le dashboard sait libeller sont utilisées
   (outcomeLabel ne connaît que lead_captured et transferred) : inventer une
   autre valeur ferait apparaître la clé brute dans l'illustration. Les appels
   sans issue sont un état réel : la fiche n'a pas encore été analysée. */
const CALLS = [
  { id: 'c1', callerName: 'Amélie Rousseau', phoneNumber: '+32 475 22 10 88', startedAt: iso(38), duration: 96, outcome: 'lead_captured' },
  { id: 'c2', callerName: 'Julien Moreau', phoneNumber: '+32 496 71 40 12', startedAt: iso(94), duration: 142, outcome: 'transferred' },
  { id: 'c3', callerName: 'Sophie Lambert', phoneNumber: '+32 478 03 55 61', startedAt: iso(176), duration: 61, outcome: 'lead_captured' },
  { id: 'c4', callerName: 'Marc Vermeulen', phoneNumber: '+32 471 88 92 04', startedAt: iso(233), duration: 208, outcome: 'transferred' },
  { id: 'c5', callerName: 'Inès Bertrand', phoneNumber: '+32 493 60 17 39', startedAt: iso(310), duration: 74, outcome: 'lead_captured' },
  { id: 'c6', callerName: 'Thomas Declercq', phoneNumber: '+32 470 45 28 73', startedAt: iso(402), duration: 118 },
];

const ROUTES = [
  [/\/auth\/me$/, () => USER],
  [/\/my-dashboard\/overview/, () => OVERVIEW],
  [/\/my-dashboard\/calls/, () => ({ data: CALLS, total: CALLS.length, page: 1 })],
  [/\/my-dashboard\/settings/, () => CLIENT],
  [/\/my-dashboard\/analytics/, () => ({ daily: [], outcomes: [], sentiment: OVERVIEW.sentiment })],
  [/\/my-dashboard\/leads/, () => ({ data: [], total: 0 })],
  [/\/my-dashboard\/bookings/, () => ({ data: [], total: 0 })],
];

async function main() {
  const preview = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch({ executablePath: CHROMIUM });

  const figma = process.argv.includes('--figma');

  /* statusBar : hauteur en points laissée vide en haut de la capture. La
     fenêtre est réduite d'autant, puis la bande est rajoutée par sharp, si bien
     que l'image finale fait exactement la taille de l'écran de l'appareil et
     que la barre de navigation basse reste collée en bas. */
  const shots = figma
    /* Chaque format reprend le ratio EXACT de la zone d'écran du mockup
       correspondant, relevé dans les fichiers Figma de l'utilisateur, pour que
       l'image remplisse le masque sans être ni étirée ni rognée :
         Chrome (kit macOS)  corps 1280 x 705
         Safari Big Sur      corps 1280 x 731 (barre d'outils 53)
         MacBook Pro 16      écran 2061.87 x 1334.09
         iPhone (mockup)     écran 392 x 850 (54 pt de barre d'état en haut) */
    ? [
        { width: 1280, height: 705, scale: 3, out: '/tmp/qwillio-figma/dashboard-chrome.png', png: true },
        { width: 1280, height: 731, scale: 3, out: '/tmp/qwillio-figma/dashboard-safari.png', png: true },
        { width: 1374, height: 889, scale: 3, out: '/tmp/qwillio-figma/dashboard-macbook.png', png: true },
        { width: 392, height: 850 - 54, scale: 3, statusBar: 54, out: '/tmp/qwillio-figma/dashboard-iphone.png', png: true },
      ]
    /* hero-dashboard : le corps de la fenêtre Safari du hero mesure 2560 x 1462
       dans le PNG du kit, soit exactement 1280 x 731 en points. La capture est
       donc prise à cette taille (x2 = la taille native du corps), puis réduite à
       1600 de large pour l'écran. Aucune déformation dans le cadre. */
    : [
        { width: 1280, height: 731, scale: 2, outWidth: 1600, out: 'public/screens/hero-dashboard.webp' },
        { width: 390, height: 844, scale: 2, out: 'public/screens/mobile-overview.webp' },
      ];

  await mkdir(figma ? '/tmp/qwillio-figma' : 'public/screens', { recursive: true });

  for (const { width, height, scale, out, png: asPng, statusBar, outWidth } of shots) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
    await ctx.addInitScript(() => {
      localStorage.setItem('token', 'demo-token');
    });
    const page = await ctx.newPage();

    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const hit = ROUTES.find(([re]) => re.test(url));
      if (!hit) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(hit[1]()),
      });
    });

    await page.goto(`http://localhost:${PREVIEW_PORT}/dashboard`, { waitUntil: 'networkidle' });
    /* On attend un chiffre réel plutôt qu'un délai : le squelette de chargement
       ne doit jamais finir dans une illustration. */
    await page.getByText('327').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);

    const shot = await page.screenshot();
    let img = sharp(shot);
    if (statusBar) {
      /* Fond repris du châssis de l'application pour que la bande se fonde */
      img = sharp(await img.extend({
        top: statusBar * scale,
        background: '#0F1011',
      }).png().toBuffer());
    }
    await (asPng ? img.png() : img.resize({ width: outWidth ?? width }).webp({ quality: 88 })).toFile(out);
    console.log(out, 'ok');
    await page.close();
    await ctx.close();
  }

  await browser.close();
  preview.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
