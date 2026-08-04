import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4173';
const ROUTES = ['/dashboard', '/dashboard/calls', '/dashboard/receptionist', '/dashboard/account'];

const USER = {
  id: 'u_test', name: 'Marie Dupont', email: 'marie@qwillio.com',
  role: 'client', planType: 'pro',
  emailConfirmed: true, hasSubscription: true, onboardingCompleted: true,
  clientId: 'cl_test',
};

const OVERVIEW = {
  client: {
    planType: 'pro', subscriptionStatus: 'active', vapiPhoneNumber: '+1 514 555 0142',
    transferNumber: '+1 514 555 0199', isTrial: false, trialEndDate: null,
    monthlyMinutesQuota: 500, hasCustomConfig: true, hasTestCall: true,
    forwardingStatus: 'verified', forwardingVerifiedAt: '2026-07-01T10:00:00Z',
    planFeatures: ['Appels illimites', 'Analyse de sentiment', 'Rendez-vous automatiques'],
    businessName: 'Plomberie Dupont et Associes de Montreal',
  },
  calls: { thisMonth: 1284, today: 42, yesterday: 31, total: 5421, avgDuration: 187 },
  minutes: { used: 412, quota: 500, percent: 82 },
  bookings: { thisMonth: 64, upcoming: 12 },
  leads: { thisMonth: 213 },
  spam: { blockedThisMonth: 37 },
  sentiment: { positive: 811, neutral: 302, negative: 91 },
};

const CALLS = Array.from({ length: 12 }).map((_, i) => ({
  id: `c${i}`,
  callerNumber: '+1 514 555 01' + String(10 + i),
  callerName: i % 3 ? 'Jean-Baptiste Tremblay-Lafontaine' : '',
  durationSeconds: 60 + i * 37,
  sentiment: ['positive', 'neutral', 'negative'][i % 3],
  outcome: ['lead_captured', 'booking_made', 'transferred', 'missed'][i % 4],
  summary: 'Appelant interesse par un devis de renovation de salle de bain complete.',
  transcript: 'AI: Bonjour, Plomberie Dupont.\nUser: Bonjour, je voudrais un devis.',
  createdAt: new Date(Date.now() - i * 36e5).toISOString(),
  isLead: i % 2 === 0,
  bookingRequested: i % 4 === 1,
  bookingDetails: null,
  emailCollected: 'jean.baptiste.tremblay@exemple-tres-long.com',
  leadScore: 7,
  recordingUrl: '',
  phoneNumber: '+1 514 555 0110',
  startedAt: new Date(Date.now() - i * 36e5).toISOString(),
}));

const SETTINGS = {
  businessName: 'Plomberie Dupont et Associes', businessType: 'home_services',
  transferNumber: '+1 514 555 0199', agentName: 'Marie', agentLanguage: 'fr',
  contactPhone: '+1 514 555 0100', address: '1234 Rue Sainte-Catherine Ouest',
  city: 'Montreal', postalCode: 'H3G 1P1', forwardingType: 'unconditional',
  googleCalendarId: '', vapiPhoneNumber: '+1 514 555 0142',
  vapiAssistantId: 'asst_1', monthlyMinutesQuota: 500,
  forwardingStatus: 'verified', forwardingVerifiedAt: '2026-07-01T10:00:00Z',
  items: [
    { id: 'i1', category: 'service', name: 'Debouchage de drain principal', price: '180 EUR' },
    { id: 'i2', category: 'tarif', name: 'Deplacement urgence nuit', price: '95 EUR' },
  ],
  hours: null, faq: 'Q : Intervenez-vous la nuit ?\nR : Oui, 24h/24.',
  personalityPreset: 'warm', personalityNotes: '', characterId: 'marie',
  vapiConfig: { notifications: { notifEmail: true, notifWeekly: true, notifLeads: true, notifQuota: true } },
  contactName: 'Marie Dupont', contactEmail: 'marie@qwillio.com', country: 'Canada',
};

function jsonFor(url) {
  const u = url.split('?')[0];
  if (u.endsWith('/my-dashboard/overview')) return OVERVIEW;
  if (u.endsWith('/my-dashboard/calls')) {
    return { data: CALLS, pagination: { total: 128, page: 1, limit: 20, totalPages: 7 } };
  }
  if (u.endsWith('/my-dashboard/settings')) return SETTINGS;
  if (u.includes('google-calendar/status')) return { connected: false };
  if (u.endsWith('/my-dashboard/characters')) {
    return { characters: [
      { id: 'marie', name: 'Marie', taglineFr: 'Chaleureuse', taglineEn: 'Warm', gender: 'female', accent: 'fr-CA' },
      { id: 'lucas', name: 'Lucas', taglineFr: 'Direct', taglineEn: 'Direct', gender: 'male', accent: 'fr-CA' },
    ] };
  }
  if (u.includes('/auth/me') || u.includes('/auth/verify')) return USER;
  return {};
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-CA',
});

await ctx.route('**/api/**', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(jsonFor(route.request().url())),
  });
});

await ctx.addInitScript((user) => {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('qwillio_token', 'test-token');
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('auth-storage', JSON.stringify({
    state: { user, token: 'test-token', isAuthenticated: true }, version: 0,
  }));
}, USER);


const page = await ctx.newPage();
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const pill = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Navigation mobile"]');
  const bar = nav.firstElementChild;
  const r = bar.getBoundingClientRect();
  const links = [...nav.querySelectorAll('a')].map(a => {
    const lr = a.getBoundingClientRect();
    return { label: a.getAttribute('aria-label'), w: Math.round(lr.width), h: Math.round(lr.height) };
  });
  const bubble = nav.querySelector('span[aria-hidden="true"]:not([class*="rounded-full"])');
  return { barLeft: Math.round(r.left), barRight: Math.round(r.right), barH: Math.round(r.height), links,
           bubbleLeft: bubble ? bubble.style.left : null };
});
console.log('PILL', JSON.stringify(pill));

// Le tap sur la pilule navigue
await page.locator('nav[aria-label="Navigation mobile"] a[aria-label="Appels"]').tap();
await page.waitForTimeout(900);
console.log('APRES TAP', page.url());
await page.screenshot({ path: '.shot-calls.png' });

// Le hamburger ouvre le drawer
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: '.shot-overview.png' });
await page.locator('button[aria-label="Ouvrir le menu"]').tap();
await page.waitForTimeout(500);
const drawer = await page.evaluate(() => {
  const asides = [...document.querySelectorAll('aside')].map(a => {
    const r = a.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right) };
  });
  const close = document.querySelector('button[aria-label="Fermer le menu"]').getBoundingClientRect();
  const navLinks = [...document.querySelectorAll('aside nav a')].map(a => Math.round(a.getBoundingClientRect().height));
  return { asides, close: { w: Math.round(close.width), h: Math.round(close.height) }, navLinkHeights: navLinks.slice(0, 4) };
});
console.log('DRAWER', JSON.stringify(drawer));
await page.screenshot({ path: '.shot-drawer.png' });

await page.goto(BASE + '/dashboard/receptionist', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: '.shot-recep.png', fullPage: false });
await page.goto(BASE + '/dashboard/account', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: '.shot-account.png' });

await browser.close();
