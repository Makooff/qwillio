import type { Page, Route } from '@playwright/test';

/**
 * Le portail client, servi par une API simulée.
 *
 * Pourquoi simuler plutôt que lancer le vrai serveur: ces parcours existent
 * pour attraper les régressions du NAVIGATEUR — une garde de route qui renvoie
 * au mauvais endroit, une sauvegarde automatique qui écrase ce qu'on vient de
 * taper, une page qui ne se remplit plus parce que la forme de la réponse a
 * changé. Aucune ne demande un vrai Postgres, et en exiger un rendrait
 * l'intégration continue dépendante d'une base, donc rouge pour des raisons
 * qui n'ont rien à voir avec le code testé.
 *
 * La contrepartie est réelle et se dit: si le serveur change la FORME de ses
 * réponses sans que ces fixtures suivent, les tests resteront verts et
 * l'application cassera. Les fixtures ci-dessous décrivent donc ce que le
 * serveur renvoie vraiment, et le commentaire de chaque route dit où le
 * vérifier.
 */

export const API = 'https://qwillio.onrender.com/api';

/** Ce que `/auth/me` doit rendre pour que `ClientRoute` laisse passer. */
export const CLIENT_USER = {
  id: 'user-e2e',
  email: 'test@qwillio.com',
  name: 'Test Client',
  role: 'client',
  onboardingCompleted: true,
};

/** `GET /my-dashboard/settings` — la configuration de la réceptionniste. */
export const SETTINGS = {
  businessName: 'Salon Test',
  businessType: 'salon',
  agentLanguage: 'fr',
  agentName: 'Noura',
  transferNumber: '+32470000000',
  characterId: 'marie',
  personalityPreset: 'warm',
  personalityNotes: '',
  items: [{ id: 'a1', category: 'service', name: 'Coupe', price: '35 €' }],
  hours: null,
  faqEntries: [],
  knowledge: {},
  vapiAssistantId: 'asst-e2e',
};

const json = (body: unknown) => (route: Route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Branche les routes du portail et pose la session.
 *
 * `addInitScript` plutôt qu'un `localStorage.setItem` après navigation: le
 * jeton doit exister AVANT le premier rendu, sinon `checkAuth` conclut à
 * l'absence de session et la garde renvoie sur /login avant que le test ait
 * eu le temps d'agir.
 */
export async function signIn(page: Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript(() => localStorage.setItem('token', 'jeton-e2e'));

  /* Le filet d'abord, et c'est un piège de Playwright: les routes sont
     essayées de la DERNIÈRE enregistrée à la première. Déclaré en dernier, ce
     motif attrape-tout passerait avant `/auth/me` et la session ne serait
     jamais reconnue. */
  await page.route(`${API}/**`, route => {
    if (route.request().method() === 'GET') return json({})(route);
    return json({ success: true })(route);
  });

  await page.route(`${API}/auth/me`, json(CLIENT_USER));
  await page.route(`${API}/my-dashboard/settings`, route =>
    route.request().method() === 'PUT'
      ? json({ success: true })(route)
      : json({ ...SETTINGS, ...overrides })(route),
  );
  await page.route(`${API}/my-dashboard/overview`, json({
    client: { businessName: 'Salon Test', planType: 'starter', isTrial: false },
    stats: { totalCalls: 0, leads: 0 },
  }));
  await page.route(`${API}/my-dashboard/integrations/google-calendar/status`, json({ connected: false }));
  await page.route(`${API}/my-dashboard/characters`, json({
    characters: [{
      id: 'marie', name: 'Marie', accent: 'FR', gender: 'f', personaKey: 'warm',
      taglineFr: 'Chaleureuse', taglineEn: 'Warm', previewFr: '', previewEn: '',
    }],
  }));
  await page.route(`${API}/crm/integrations`, json([]));
}
