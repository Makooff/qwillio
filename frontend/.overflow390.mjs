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

let failures = 0;
const page = await ctx.newPage();

for (const route of ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const offenders = [];
    for (const el of document.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > window.innerWidth + 1 || rect.left < -1) {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' && cs.visibility === 'hidden') continue;
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) {
          const pcs = getComputedStyle(p);
          if (pcs.overflowX !== 'visible' && p.getBoundingClientRect().right <= window.innerWidth + 1) {
            clipped = true; break;
          }
          p = p.parentElement;
        }
        if (clipped) continue;
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '')).slice(0, 110),
          left: Math.round(rect.left), right: Math.round(rect.right),
        });
      }
    }
    // Cibles tactiles: liens et boutons visibles sous 44px de haut
    const small = [];
    for (const el of document.querySelectorAll('a,button,[role="switch"],input,select')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const cs = getComputedStyle(el);
      let h = rect.height;
      const after = getComputedStyle(el, '::after');
      if (after && after.content && after.content !== 'none' && after.position === 'absolute') {
        const inset = parseFloat(after.top);
        if (!Number.isNaN(inset) && inset < 0) h += Math.abs(inset) * 2;
      }
      if (h < 43.5 && cs.visibility !== 'hidden') {
        small.push({ tag: el.tagName.toLowerCase(), h: Math.round(h), cls: String(el.className || '').slice(0, 80), text: (el.textContent || '').trim().slice(0, 32) });
      }
    }
    return {
      scrollW: de.scrollWidth, innerW: window.innerWidth,
      bodyScrollW: document.body.scrollWidth,
      offenders: offenders.slice(0, 12),
      small: small.slice(0, 14),
      headerH: Math.round(document.querySelector('header')?.getBoundingClientRect().height || 0),
      titleFs: getComputedStyle(document.querySelector('h1') || document.body).fontSize,
      navH: Math.round(document.querySelector('nav[aria-label="Navigation mobile"]')?.getBoundingClientRect().height || 0),
      mainPadX: getComputedStyle(document.querySelector('main') || document.body).paddingLeft,
      mainPadB: getComputedStyle(document.querySelector('main') || document.body).paddingBottom,
    };
  });

  const overflow = r.scrollW > r.innerW + 1 || r.offenders.length > 0;
  if (overflow) failures++;
  console.log(`\n${route}  ${overflow ? 'OVERFLOW' : 'OK'}`);
  console.log(`  scrollWidth=${r.scrollW} innerWidth=${r.innerW} body=${r.bodyScrollW}`);
  console.log(`  header=${r.headerH}px  h1=${r.titleFs}  bottomNav=${r.navH}px  main padX=${r.mainPadX} padB=${r.mainPadB}`);
  if (r.offenders.length) console.log('  offenders:', JSON.stringify(r.offenders, null, 1));
  if (r.small.length) console.log(`  targets<44px (${r.small.length}):`, JSON.stringify(r.small));
}

await browser.close();
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${ROUTES.length - failures}/${ROUTES.length} routes sans debordement horizontal a 390px`);
process.exit(failures === 0 ? 0 : 1);
