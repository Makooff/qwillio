/**
 * Rendus d'écrans pour les maquettes iPhone / Mac.
 *
 * Ce ne sont PAS des dessins: c'est le vrai portail client, rendu par le vrai
 * code, sur un faux backend. Toutes les réponses de `/api` sont fabriquées ici,
 * avec des données d'exemple cohérentes (une clinique bruxelloise), si bien que
 * chaque pixel vient des composants livrés et non d'une reconstitution.
 *
 * Les cotes sont celles des écrans réels, et une bande est laissée en haut pour
 * l'interface iOS, posée à la main dans la maquette.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4188';
const OUT = process.env.OUT || '/tmp/screens';
mkdirSync(OUT, { recursive: true });

/* Bande réservée à l'heure, au réseau et à la batterie, en points CSS.
   59 pt sur un iPhone 15 Pro, 0 sur un Mac où la barre est hors de l'écran. */
const IOS_STATUS_BAR = 59;

const now = new Date();
const iso = (dayOffset, h, m) => {
  const d = new Date(now);
  d.setDate(d.getDate() - dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const CALLS = [
  {
    id: 'c1', callerName: 'Camille Dubois', callerNumber: '+32 471 12 34 56',
    startedAt: iso(0, 9, 12), createdAt: iso(0, 9, 12), durationSeconds: 168,
    status: 'completed', sentiment: 'positive', outcome: 'lead_captured', isLead: true,
    leadScore: 88, bookingRequested: true, bookingDate: iso(-2, 14, 30),
    summary: 'Détartrage et contrôle. Rendez-vous fixé jeudi 14 h 30, confirmation envoyée par SMS.',
    nameCollected: 'Camille Dubois', phoneCollected: '+32 471 12 34 56',
    emailCollected: 'camille.dubois@proton.me', tags: ['new'], isSpam: false, direction: 'inbound',
  },
  {
    id: 'c2', callerName: 'Marc Lefèvre', callerNumber: '+32 478 90 21 44',
    startedAt: iso(0, 8, 41), createdAt: iso(0, 8, 41), durationSeconds: 96,
    status: 'completed', sentiment: 'neutral', outcome: 'transferred', isLead: false,
    summary: 'Demande le docteur Vermeulen pour un résultat d’analyse. Transféré au cabinet.',
    nameCollected: 'Marc Lefèvre', phoneCollected: '+32 478 90 21 44',
    tags: [], isSpam: false, direction: 'inbound',
  },
  {
    id: 'c3', callerName: 'Sofia Mertens', callerNumber: '+32 495 66 07 18',
    startedAt: iso(1, 18, 53), createdAt: iso(1, 18, 53), durationSeconds: 214,
    status: 'completed', sentiment: 'positive', outcome: 'lead_captured', isLead: true,
    leadScore: 76, bookingRequested: true, bookingDate: iso(-4, 11, 0),
    summary: 'Urgence, douleur molaire. Créneau de lundi 11 h proposé et accepté.',
    nameCollected: 'Sofia Mertens', phoneCollected: '+32 495 66 07 18',
    emailCollected: 'sofia.mertens@gmail.com', tags: ['contacted'], isSpam: false, direction: 'inbound',
  },
  {
    id: 'c4', callerName: 'Inès Peeters', callerNumber: '+32 470 33 89 02',
    startedAt: iso(1, 15, 27), createdAt: iso(1, 15, 27), durationSeconds: 132,
    status: 'completed', sentiment: 'positive', outcome: 'lead_captured', isLead: true,
    leadScore: 64,
    summary: 'Devis pour un blanchiment. Rappel demandé en fin de semaine.',
    nameCollected: 'Inès Peeters', phoneCollected: '+32 470 33 89 02',
    tags: ['new'], isSpam: false, direction: 'inbound',
  },
  {
    id: 'c5', callerName: 'Thomas Janssens', callerNumber: '+32 486 54 12 90',
    startedAt: iso(2, 10, 5), createdAt: iso(2, 10, 5), durationSeconds: 78,
    status: 'completed', sentiment: 'neutral', outcome: 'informed', isLead: false,
    summary: 'Horaires du samedi et adresse du cabinet.',
    tags: [], isSpam: false, direction: 'inbound',
  },
  {
    id: 'c6', callerName: 'Aline Grosjean', callerNumber: '+32 493 71 40 55',
    startedAt: iso(2, 9, 22), createdAt: iso(2, 9, 22), durationSeconds: 187,
    status: 'completed', sentiment: 'positive', outcome: 'lead_captured', isLead: true,
    leadScore: 71, bookingRequested: true, bookingDate: iso(-6, 9, 30),
    summary: 'Première visite, mutuelle Partenamut. Rendez-vous fixé mercredi 9 h 30.',
    nameCollected: 'Aline Grosjean', phoneCollected: '+32 493 71 40 55',
    tags: ['converted'], isSpam: false, direction: 'inbound',
  },
];

/* Trente jours d'appels, sans montée artificielle: un creux le week-end et un
   volume qui varie, ce qu'une vraie clinique produit. */
const dailyCalls = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (29 - i));
  const dow = d.getUTCDay();
  const base = dow === 0 ? 1 : dow === 6 ? 4 : 9;
  const wave = [0, 2, -1, 3, 1, -2, 2, 4, 0, 1][i % 10];
  return { date: d.toISOString().slice(0, 10), count: Math.max(0, base + wave) };
});

const OVERVIEW = {
  client: {
    id: 'demo', businessName: 'Clinique Dentaire Léopold', businessType: 'dentiste',
    planType: 'pro', subscriptionStatus: 'active', vapiPhoneNumber: '+32 2 588 14 90',
    isTrial: false, trialEndDate: null, monthlyMinutesQuota: 500, totalCallsMade: 412,
    monthlyFee: 249, setupFee: 0, transferNumber: '+32 2 512 44 11', currency: 'EUR',
    activationDate: iso(120, 10, 0), cancellationDate: null,
    trialStartDate: null, trialConvertedAt: iso(113, 10, 0),
    contactName: 'Dr Élodie Vermeulen', contactEmail: 'elodie@clinique-leopold.be',
    hasCustomConfig: true, hasTestCall: true,
    forwardingStatus: 'verified', forwardingVerifiedAt: iso(119, 11, 0),
    planFeatures: ['Appels illimités', 'Agenda connecté', 'SMS de confirmation', 'CRM'],
  },
  calls: { total: 412, thisMonth: 138, thisWeek: 34, today: 7, avgDuration: 152 },
  minutes: { quota: 500, used: 341, percent: 68 },
  bookings: { total: 194, thisMonth: 61, upcoming: 12 },
  leads: { thisMonth: 47 },
  dailyCalls,
  spam: { blockedThisMonth: 9, blockedTotal: 38 },
  sentiment: { positive: 246, neutral: 128, negative: 21 },
};

const USER = {
  id: 'u-demo', email: 'elodie@clinique-leopold.be', name: 'Élodie Vermeulen',
  role: 'client', clientId: 'demo', emailVerified: true, onboardingCompleted: true,
};

function mockFor(pathname, search) {
  const p = pathname.replace(/^\/api/, '');
  /* `checkAuth` lit l'utilisateur À LA RACINE de la réponse, pas sous `user`:
     enveloppé, il le prend pour une réponse invalide, efface le jeton et
     renvoie sur la page de connexion. */
  if (p === '/auth/me') return USER;
  if (p === '/my-dashboard/overview') return OVERVIEW;
  if (p.startsWith('/my-dashboard/calls')) {
    const limit = Number(new URLSearchParams(search).get('limit') || 20);
    return { data: CALLS.slice(0, limit), pagination: { total: CALLS.length, page: 1, limit, totalPages: 1 } };
  }
  if (p.startsWith('/my-dashboard/leads')) {
    const leads = CALLS.filter(c => c.isLead);
    return { data: leads, pagination: { total: leads.length, page: 1, limit: 20, totalPages: 1 } };
  }
  if (p.startsWith('/my-dashboard/bookings')) {
    return { data: CALLS.filter(c => c.bookingRequested), pagination: { total: 3, page: 1, limit: 20, totalPages: 1 } };
  }
  if (p.startsWith('/my-dashboard/config')) {
    return {
      businessName: 'Clinique Dentaire Léopold', businessType: 'dentiste', language: 'fr',
      greeting: 'Clinique Dentaire Léopold, bonjour. Que puis-je faire pour vous ?',
      personalityNotes: 'Ton chaleureux, vouvoiement, phrases courtes.',
      faq: 'Parking: gratuit rue Belliard. Mutuelles: toutes acceptées.',
      hours: { mon: '8h-18h', tue: '8h-18h', wed: '8h-13h', thu: '8h-18h', fri: '8h-16h' },
      items: [{ name: 'Détartrage', price: '75 €' }, { name: 'Blanchiment', price: '290 €' }],
      voiceId: 'fr-charlotte', transferNumber: '+32 2 512 44 11',
    };
  }
  if (p.startsWith('/my-dashboard/status')) return { active: true, status: 'active' };
  return {};
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* Chaque page est demandée deux fois par le portail (cache + rafraîchissement),
   donc la route reste posée pour toute la session du contexte. */
async function shoot({ name, path, width, height, scale, statusBar }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    locale: 'fr-BE',
    timezoneId: 'Europe/Brussels',
  });
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockFor(url.pathname, url.search)),
    });
  });
  await context.addInitScript(() => {
    localStorage.setItem('token', 'demo-token');
    /* Sans cette clé le portail sort en ANGLAIS: la langue est stockée, pas
       déduite de la locale du navigateur, et une maquette française montrant
       « AI Receptionist » se remarque tout de suite. */
    localStorage.setItem('qwillio-lang', 'fr');
  });
  const page = await context.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  if (statusBar) {
    await page.addStyleTag({
      /* La bande réservée doit être de la couleur de l'application, pas de
         celle de la page: laissée au fond du document, elle sortait BLANCHE
         au-dessus d'un portail sombre, et la maquette aurait montré un
         bandeau clair sous l'heure. */
      content: `html,body{background:#0a0a0c!important}body{padding-top:${statusBar}px!important}`,
    });
    await page.waitForTimeout(400);
  }
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width, height } });
  console.log(name, `${width * scale}x${height * scale}`, file);
  await context.close();
}

/* iPhone 15 Pro: 393x852 pt, densité 3, soit 1179x2556 pixels réels. */
const phone = { width: 393, height: 852, scale: 3, statusBar: IOS_STATUS_BAR };
/* MacBook Pro 14": 1512x982 pt, densité 2, soit 3024x1964 pixels réels. */
const mac = { width: 1512, height: 982, scale: 2, statusBar: 0 };

await shoot({ name: 'iphone-apercu', path: '/dashboard', ...phone });
await shoot({ name: 'iphone-appels', path: '/dashboard/calls', ...phone });
await shoot({ name: 'iphone-leads', path: '/dashboard/leads', ...phone });
await shoot({ name: 'iphone-receptionniste', path: '/dashboard/receptionist', ...phone });
await shoot({ name: 'mac-apercu', path: '/dashboard', ...mac });
await shoot({ name: 'mac-appels', path: '/dashboard/calls', ...mac });

await browser.close();
