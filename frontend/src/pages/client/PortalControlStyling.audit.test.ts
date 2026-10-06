/**
 * Régression — règles « contour mauve, pas de fond mauve » et « pilule ».
 *
 * Audit statique des pages ROUTÉES du portail secondaire et de l'admin:
 * aucun bouton/déclencheur de contrôle ne doit garder un remplissage mauve
 * plein (`bg-[#7349fe]` non atténué) ni un état actif mauve lavé à plus de
 * ~15 %, et les toggles filtre/période/mode exposent `aria-pressed`.
 *
 * Les pages explicitement hors scope (ClientBilling, ClientSupport,
 * ClientCalls, ClientLeads, ClientBookings, Home/Receptionist V2) et les
 * pages legacy non routées (AgentEmail, AgentInventory, AgentAccounting,
 * AgentPayments sous pages/client, et l'ancien pages/admin/* non monté dans
 * App.tsx) ne sont pas auditées ici.
 */
import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('../../**/*.tsx', { as: 'raw', eager: true });

function read(rel: string): string {
  // Les clés du glob sont relatives à CE module (src/pages/client):
  // pages/client/X → ./X, pages/admin/X → ../admin/X, pages/X → ../X.
  const key = rel.startsWith('pages/client/')
    ? `./${rel.slice('pages/client/'.length)}`
    : rel.startsWith('pages/admin/')
      ? `../admin/${rel.slice('pages/admin/'.length)}`
      : `../${rel.slice('pages/'.length)}`;
  const mod = sources[key];
  if (typeof mod !== 'string') throw new Error(`source introuvable: ${key}`);
  return mod;
}

const CONTROL_PAGES = [
  'pages/client/ClientOverview.tsx',
  'pages/client/ClientReceptionist.tsx',
  'pages/client/ClientAccount.tsx',
  'pages/client/ClientSetupForwarding.tsx',
  'pages/client/ClientSetupCustomize.tsx',
  'pages/client/ClientSetupGuide.tsx',
  'pages/client/ClientIntegrations.tsx',
  'pages/client/ClientAnalytics.tsx',
  'pages/client/AgentCrm.tsx',
  'pages/client/CrmDeals.tsx',
  'pages/client/CrmActivities.tsx',
  'pages/client/CrmContactDetail.tsx',
  'pages/admin/Calls.tsx',
  'pages/admin/Leads.tsx',
  'pages/admin/Billing.tsx',
  'pages/admin/AdminSettings.tsx',
  'pages/admin/VoiceLab.tsx',
  'pages/admin/Lignes.tsx',
  'pages/admin/Agents.tsx',
  'pages/admin/Agency.tsx',
  'pages/admin/agents/ListProductAgents.tsx',
  'pages/admin/NotFound.tsx',
  'pages/Dashboard.tsx',
  'pages/Clients.tsx',
];

// Remplissage mauve plein sur un CONTRÔLE: on ne cible que les contextes
// bouton (suivi de classes text/border/hover). Les indicateurs non contrôles
// (barres de progression `bg-[#7A5FFF] transition-[width]`, charts, puces)
// restent en teinte de marque et sont hors cible.
const FULL_PURPLE_FILL = /bg-\[(?:#7349fe|#8a6fff|#7a5fff)\](?=\s+(?:text-|border|hover:))/i;
// Lavage mauve actif > 15 % (les washes statut à 10-12 % restent la grammaire
// des badges; les seuils violents /15 /20 sur des CONTROLS sont interdits).
const ACTIVE_PURPLE_WASH = /bg-\[#7349fe\]\/(?:1[6-9]|[2-9][0-9])/;

describe('portail secondaire + admin routé — pas de fond mauve sur les contrôles', () => {
  for (const rel of CONTROL_PAGES) {
    it(`${rel} — aucun remplissage mauve plein`, () => {
      expect(read(rel)).not.toMatch(FULL_PURPLE_FILL);
    });
  }

  it('ClientReceptionist — le sélecteur de mode de transfert ne lave pas en mauve actif', () => {
    expect(read('pages/client/ClientReceptionist.tsx')).not.toMatch(ACTIVE_PURPLE_WASH);
  });
});

describe('états actifs accessibles (aria-pressed) sur les toggles migrés', () => {
  const TOGGLE_PAGES: Array<[string, number]> = [
    // [fichier, nombre minimum d'occurrences aria-pressed]
    ['pages/client/ClientReceptionist.tsx', 1],
    ['pages/client/ClientAnalytics.tsx', 1],
    ['pages/client/CrmActivities.tsx', 2],
    ['pages/admin/VoiceLab.tsx', 2],
  ];

  for (const [rel, min] of TOGGLE_PAGES) {
    it(`${rel} — aria-pressed présent (>= ${min})`, () => {
      const count = (read(rel).match(/aria-pressed=/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(min);
    });
  }
});

describe('admin — les sélecteurs VoiceLab gardent un arrondi plafonné par classe', () => {
  it('VoiceLab — les <select> ne se pillulisent pas en ellipse via classe', () => {
    // Les surfaces ouvertes restent plafonnées; seuls les contrôles prennent
    // la pilule (imposée par la règle [data-dashboard] de globals.css, pas
    // par une classe rounded-full locale qui déborderait sur les menus).
    expect(read('pages/admin/VoiceLab.tsx')).not.toMatch(/rounded-full/);
  });
});

/* Lavages mauves INLINE (style={{ background: 'rgba(122,95,255,…)' }}) sur
   des contrôles: le grep de classes ne les voit pas, eux. Seuils identiques
   aux classes: rien au-dessus de ~15 % sur un bouton/état actif. */
const INLINE_PURPLE_WASH_ON_CONTROL =
  /background:\s*'rgba\(122,\s*95,\s*255,\s*0?\.(?:1[6-9]|[2-9][0-9]*)\)'/;

describe('portail secondaire + admin routé — pas de lavage mauve inline sur les contrôles', () => {
  const INLINE_PAGES = [
    'pages/admin/Agency.tsx',
    'pages/admin/Agents.tsx',
    'pages/admin/Calls.tsx',
    'pages/admin/Leads.tsx',
    'pages/admin/Billing.tsx',
    'pages/admin/AdminSettings.tsx',
    'pages/admin/VoiceLab.tsx',
    'pages/admin/Lignes.tsx',
    'pages/client/ClientReceptionist.tsx',
    'pages/client/ClientIntegrations.tsx',
    'pages/client/ClientAnalytics.tsx',
    'pages/client/ClientOverview.tsx',
    'pages/client/ClientSetupForwarding.tsx',
    'pages/client/ClientSetupCustomize.tsx',
    'pages/client/ClientSetupGuide.tsx',
    'pages/client/AgentCrm.tsx',
    'pages/client/CrmDeals.tsx',
    'pages/client/CrmActivities.tsx',
    'pages/client/CrmContactDetail.tsx',
    'pages/Dashboard.tsx',
    'pages/Clients.tsx',
  ];

  for (const rel of INLINE_PAGES) {
    it(`${rel} — aucun lavage mauve inline > 15 %`, () => {
      expect(read(rel)).not.toMatch(INLINE_PURPLE_WASH_ON_CONTROL);
    });
  }

  it('Agency — les toggles de permission exposent aria-pressed', () => {
    expect(read('pages/admin/Agency.tsx')).toMatch(/aria-pressed=\{active\}/);
  });

  it('ClientReceptionist — le bouton Connecter est un contour mauve, pas un fond', () => {
    const src = read('pages/client/ClientReceptionist.tsx');
    expect(src).toMatch(/aria-pressed=\{open\}/);
    expect(src).not.toMatch(/background:\s*'rgba\(122,95,255,0\.16\)'/);
  });
});
