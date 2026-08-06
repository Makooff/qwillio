/* Visite guidée du tableau de bord, une image par page.
 *
 * Même principe que `capture-dashboard.mjs` (jeton posé dans localStorage,
 * API répondue par le script) mais au lieu d'une illustration marketing, on
 * traverse TOUTES les pages du dashboard et on en sort une capture chacune,
 * pour relecture.
 *
 * Différence importante avec le script marketing : ici, une route d'API qui
 * n'est pas stubée renvoie une réponse vide plutôt qu'une erreur. Une page qui
 * apparaît vide dans les captures est donc une page sans données, pas une page
 * cassée. Ce qui est cassé apparaît dans le rapport d'erreurs console imprimé
 * en fin de course.
 *
 * Usage : npm run build && node scripts/capture-dashboard-tour.mjs
 *         -> /tmp/qwillio-tour/NN-nom.png
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const PREVIEW_PORT = 4174;
const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = '/tmp/qwillio-tour';

const iso = (minutesAgo) => new Date(Date.UTC(2026, 6, 14, 15, 40) - minutesAgo * 60000).toISOString();

const USER = {
  id: 'demo-client', name: 'Camille Dubois', email: 'camille@studio-lumen.be',
  role: 'client', clientId: 'demo-client',
  emailConfirmed: true, hasSubscription: true, onboardingCompleted: true,
};

const CLIENT = {
  id: 'demo-client', businessName: 'Studio Lumen', businessType: 'salon',
  planType: 'pro', subscriptionStatus: 'active', isTrial: false,
  monthlyMinutesQuota: 1500, transferNumber: '+32 2 511 84 20',
  vapiPhoneNumber: '+32 2 588 19 04', forwardingStatus: 'verified',
  forwardingVerifiedAt: iso(60 * 24 * 12), hasTestCall: true,
  hasCustomConfig: true, aiEnabled: true, agentLanguage: 'fr',
  contactEmail: 'camille@studio-lumen.be', contactName: 'Camille Dubois',
  contactPhone: '+32 471 22 10 88',
};

const OVERVIEW = {
  client: CLIENT,
  calls: { today: 18, yesterday: 14, thisMonth: 327 },
  sentiment: { positive: 241, neutral: 63, negative: 23 },
  leads: { thisMonth: 96 },
  spam: { blockedThisMonth: 41 },
  minutes: { used: 968, quota: 1500, percent: 65 },
};

const CALLS = [
  { id: 'c1', callerName: 'Amélie Rousseau', phoneNumber: '+32 475 22 10 88', startedAt: iso(38), duration: 96, outcome: 'lead_captured', sentiment: 'positive', summary: 'Demande un rendez-vous coupe et couleur pour samedi matin. Créneau de 10 h proposé et accepté.', transcript: 'Bonjour, Studio Lumen, je suis Marie...', recordingUrl: 'https://example.com/r1.mp3', leadScore: 82 },
  { id: 'c2', callerName: 'Julien Moreau', phoneNumber: '+32 496 71 40 12', startedAt: iso(94), duration: 142, outcome: 'transferred', sentiment: 'neutral', summary: 'Réclamation sur une prestation de la semaine passée, transféré à Camille.', leadScore: 40 },
  { id: 'c3', callerName: 'Sophie Lambert', phoneNumber: '+32 478 03 55 61', startedAt: iso(176), duration: 61, outcome: 'lead_captured', sentiment: 'positive', summary: 'Demande les tarifs balayage, coordonnées prises.', leadScore: 74 },
  { id: 'c4', callerName: 'Marc Vermeulen', phoneNumber: '+32 471 88 92 04', startedAt: iso(233), duration: 208, outcome: 'transferred', sentiment: 'positive', summary: 'Question sur un forfait mariage.', leadScore: 66 },
  { id: 'c5', callerName: 'Inès Bertrand', phoneNumber: '+32 493 60 17 39', startedAt: iso(310), duration: 74, outcome: 'lead_captured', sentiment: 'neutral', summary: 'Report d’un rendez-vous de jeudi à vendredi.', leadScore: 58 },
  { id: 'c6', callerName: 'Thomas Declercq', phoneNumber: '+32 470 45 28 73', startedAt: iso(402), duration: 118, sentiment: 'neutral', summary: 'Appel non encore analysé.' },
];

const LEADS = [
  { id: 'l1', name: 'Amélie Rousseau', phone: '+32 475 22 10 88', email: 'amelie.r@gmail.com', score: 82, status: 'new', createdAt: iso(38), source: 'call', notes: 'Coupe + couleur samedi' },
  { id: 'l2', name: 'Sophie Lambert', phone: '+32 478 03 55 61', email: 'slambert@outlook.be', score: 74, status: 'contacted', createdAt: iso(176), source: 'call', notes: 'Tarifs balayage' },
  { id: 'l3', name: 'Marc Vermeulen', phone: '+32 471 88 92 04', email: null, score: 66, status: 'qualified', createdAt: iso(233), source: 'call', notes: 'Forfait mariage' },
];

const BOOKINGS = [
  { id: 'b1', customerName: 'Amélie Rousseau', customerPhone: '+32 475 22 10 88', bookingDate: iso(-60 * 24), bookingTime: '10:00', serviceType: 'Coupe + couleur', status: 'confirmed' },
  { id: 'b2', customerName: 'Inès Bertrand', customerPhone: '+32 493 60 17 39', bookingDate: iso(-60 * 48), bookingTime: '14:30', serviceType: 'Brushing', status: 'confirmed' },
];

const ANALYTICS = {
  daily: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10),
    calls: 12 + ((i * 7) % 11), leads: 3 + (i % 5), minutes: 28 + ((i * 5) % 19),
  })),
  outcomes: [
    { outcome: 'lead_captured', count: 96 },
    { outcome: 'transferred', count: 74 },
    { outcome: 'info', count: 121 },
    { outcome: 'spam', count: 41 },
  ],
  sentiment: OVERVIEW.sentiment,
  totals: { calls: 327, leads: 96, minutes: 968, avgDuration: 108 },
};

const BILLING = {
  client: CLIENT,
  plan: { id: 'pro', name: 'Pro', monthlyPriceEur: 599, includedMinutes: 2000, overagePerMinuteEur: 0.35 },
  status: 'active',
  minutes: { used: 968, quota: 1500, percent: 65 },
  nextInvoiceDate: iso(-60 * 24 * 12),
  invoices: [
    { id: 'i1', date: iso(60 * 24 * 18), amount: 599, status: 'paid', url: '#' },
    { id: 'i2', date: iso(60 * 24 * 48), amount: 599, status: 'paid', url: '#' },
  ],
};

/* Réponses exactes d'abord, filet vide ensuite : une page sans stub s'affiche
   dans son état « rien à montrer » au lieu de partir en écran d'erreur. */
const ROUTES = [
  [/\/auth\/me$/, () => USER],
  [/\/my-dashboard\/overview/, () => OVERVIEW],
  [/\/my-dashboard\/calls\/[^/]+$/, () => CALLS[0]],
  [/\/my-dashboard\/calls/, () => ({ data: CALLS, total: CALLS.length, page: 1 })],
  [/\/my-dashboard\/leads/, () => ({ data: LEADS, total: LEADS.length, page: 1 })],
  [/\/my-dashboard\/bookings/, () => ({ data: BOOKINGS, total: BOOKINGS.length, page: 1 })],
  [/\/my-dashboard\/analytics/, () => ANALYTICS],
  [/\/my-dashboard\/billing/, () => BILLING],
  [/\/my-dashboard\/settings/, () => CLIENT],
  [/\/my-dashboard\/knowledge/, () => ({ data: [], total: 0 })],
  [/\/my-dashboard\/integrations/, () => ({ data: [], total: 0 })],
  [/\/voices|\/characters/, () => ({ data: [], voices: [] })],
];

const PAGES = [
  ['accueil', '/dashboard'],
  ['appels', '/dashboard/calls'],
  ['leads', '/dashboard/leads'],
  ['receptionniste', '/dashboard/receptionist'],
  ['analytique', '/dashboard/analytics'],
  ['facturation', '/dashboard/billing'],
  ['compte', '/dashboard/account'],
  ['integrations', '/dashboard/account/integrations'],
  ['support', '/dashboard/support'],
  ['setup-renvoi', '/dashboard/setup/call-forwarding'],
  ['setup-personnalisation', '/dashboard/setup/customize'],
  ['agent-hub', '/dashboard/agent'],
  ['agent-marketing', '/dashboard/agent/marketing'],
  ['agent-reputation', '/dashboard/agent/reputation'],
  ['agent-rendezvous', '/dashboard/agent/scheduling'],
  ['agent-support', '/dashboard/agent/support'],
  ['agent-crm', '/dashboard/agent/crm'],
  ['agent-documents', '/dashboard/agent/document'],
  ['agent-seo-local', '/dashboard/agent/local-seo'],
  ['agent-leadgen', '/dashboard/agent/lead-gen'],
  ['agent-analytique', '/dashboard/agent/analytics'],
  ['agent-email-bientot', '/dashboard/agent/email'],
  ['crm-contacts', '/dashboard/crm'],
  ['crm-affaires', '/dashboard/crm/deals'],
  ['crm-activites', '/dashboard/crm/activities'],
];

async function main() {
  const preview = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    cwd: process.cwd(), stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 2500));
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('token', 'demo-token'));

  const report = [];

  for (const [i, [name, path]] of PAGES.entries()) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });

    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const hit = ROUTES.find(([re]) => re.test(url));
      const body = hit ? hit[1]() : { data: [], total: 0 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    try {
      await page.goto(`http://localhost:${PREVIEW_PORT}${path}`, { waitUntil: 'networkidle', timeout: 20000 });
    } catch (e) {
      errors.push(`goto: ${e.message.slice(0, 160)}`);
    }
    await page.waitForTimeout(1200);

    const file = `${OUT}/${String(i + 1).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: file });

    /* Une page qui n'affiche presque rien est le signal le plus utile du lot. */
    const textLength = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().length);
    report.push({ name, path, file, textLength, errors: [...new Set(errors)].slice(0, 4) });
    await page.close();
  }

  await browser.close();
  preview.kill();

  await writeFile(`${OUT}/rapport.json`, JSON.stringify(report, null, 2));
  for (const r of report) {
    const flag = r.textLength < 400 ? ' ⚠ PAGE QUASI VIDE' : '';
    console.log(`${r.name.padEnd(26)} ${String(r.textLength).padStart(5)} car.${flag}`);
    for (const e of r.errors) console.log(`    ${e}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
