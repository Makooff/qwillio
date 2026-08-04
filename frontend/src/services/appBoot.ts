import { primeLive, startLiveLoop } from './liveData';
import { preloadClips } from '../components/client/useVoicePreview';
import api from './api';

/**
 * Everything the dashboard needs, fetched while the launch animation plays.
 *
 * The animation is dead time otherwise — a second and a half of logo, and then
 * the work starts. Doing the loading underneath it means the fade ends on a
 * dashboard that is already populated, with its chart animating because it has
 * numbers to animate.
 */

/** Endpoints the first screens read. Warmed before anything is rendered. */
const CLIENT_KEYS = [
  '/my-dashboard/overview',
  '/my-dashboard/settings',
  '/my-dashboard/calls?page=1&limit=6',
  '/my-dashboard/characters',
];

/**
 * Pull the route bundles in.
 *
 * They are lazy so the first paint is small; that is right for the login page
 * and wrong from the moment someone is logged in, when the next tap is
 * certainly one of these. Failures are ignored — a chunk that will not load
 * now will be requested again by the router.
 */
function preloadRouteChunks(): Promise<unknown> {
  return Promise.all([
    import('../components/layout/ClientLayout'),
    import('../pages/client/ClientOverview'),
    import('../pages/client/ClientCalls'),
    import('../pages/client/ClientLeads'),
    import('../pages/client/ClientReceptionist'),
    import('../pages/client/ClientAnalytics'),
    import('../pages/client/ClientAccount'),
  ].map(p => p.catch(() => undefined)));
}

/** Voice clips for the character grid, so ▶ never waits on a download. */
async function preloadVoiceClips(): Promise<void> {
  try {
    // Asks the server to synthesise the catalog if it has not already. Cheap
    // and idempotent — it answers immediately and works in the background.
    void api.post('/my-dashboard/characters/warm').catch(() => undefined);

    const [{ data: catalog }, { data: settings }] = await Promise.all([
      api.get('/my-dashboard/characters'),
      api.get('/my-dashboard/settings').catch(() => ({ data: null })),
    ]);
    const characters: Array<{ id: string }> = Array.isArray(catalog?.characters) ? catalog.characters : [];
    const override: string | undefined = settings?.customVoice?.voiceId;
    const suffix = override ? `?voiceId=${encodeURIComponent(override)}` : '';

    // The selected character first: it is the one most likely to be pressed,
    // and on a slow connection the rest can still be arriving.
    const selected = settings?.characterId;
    const ordered = characters.slice().sort((a, b) => Number(b.id === selected) - Number(a.id === selected));

    await preloadClips(ordered.map(c => `/my-dashboard/characters/${c.id}/preview${suffix}`));
  } catch { /* the press reports its own failure, properly */ }
}

/**
 * Load the client app in the background.
 *
 * Resolves when the dashboard can render without a spinner — the data and the
 * route bundles. The voice clips keep downloading afterwards: they are needed
 * on one screen, and holding the launch animation for them would trade a real
 * delay for a hypothetical one.
 */
export async function bootClientApp(): Promise<void> {
  startLiveLoop();
  void preloadVoiceClips();
  await Promise.all([
    primeLive(CLIENT_KEYS),
    preloadRouteChunks(),
  ]);
}
