import { NicheId, resolveNiche } from './niches';

/**
 * Le catalogue des intégrations, à UN SEUL endroit.
 *
 * Il existe parce que le dépôt portait déjà la panne qu'il évite. `pages/v2/app/
 * Integrations.tsx` (non routée, heureusement) proposait Salesforce, Pipedrive,
 * Zoho et GoHighLevel en « bidirectionnel », alors que `crm-sync.service.ts`
 * n'a de gestionnaire que pour le webhook générique, Slack et HubSpot: tout le
 * reste tombait dans `default: no sync handler, skipping`. Et la route de
 * connexion accepte encore n'importe quelle chaîne et écrit
 * `syncStatus: 'connected'`. Un client aurait vu « connecté » sur une
 * intégration qui ne synchronise rien, et l'aurait découvert en cherchant ses
 * leads chez lui.
 *
 * Une liste de logos est facile. Ce fichier porte donc la seule chose qui rend
 * une intégration utile, et qu'aucune vitrine concurrente n'affiche: ce qu'elle
 * FAIT, et si elle marche AUJOURD'HUI.
 *
 * ── Les trois verbes ────────────────────────────────────────────────────────
 *
 * Une intégration ne vaut pour une réceptionniste vocale que si elle sert l'un
 * de ces trois verbes. Le classement n'est pas cosmétique: il dicte la
 * contrainte technique, et donc le coût.
 *
 *  - `read_live` — l'agent la lit PENDANT l'appel, et sa réponse change ce que
 *    l'agent DIT. Les créneaux libres, l'historique de l'appelant, la fiche
 *    d'un bien. Budget dur: environ une seconde et demie, au-delà l'appelant
 *    entend un blanc. C'est le seul verbe difficile, et le seul qui distingue
 *    d'un formulaire de contact.
 *  - `write_after` — le résultat atterrit là où le client travaille déjà.
 *    Asynchrone, réessayable, aucune contrainte de latence.
 *  - `notify` — un humain est prévenu. Asynchrone lui aussi.
 *
 * ── Les trois transports, et pourquoi « relais » n'est pas un aveu ──────────
 *
 *  - `native` — un gestionnaire existe dans ce dépôt. Ça marche aujourd'hui.
 *  - `relay` — atteignable aujourd'hui en collant une URL Make, Zapier ou n8n.
 *    Aucune ligne de code à écrire, et c'est ce qui permet d'annoncer des
 *    dizaines d'outils sans en inventer un seul: le service de synchro traite
 *    déjà `webhook`, `zapier`, `make` et `n8n` comme le même mécanisme, parce
 *    que c'en est un seul. Ce qui manquait n'était pas le code, c'était de le
 *    DIRE au client, métier par métier.
 *  - `planned` — rien ne marche encore, et l'écran doit l'écrire ainsi. C'est
 *    exactement ce que le concurrent affiche sur la totalité de sa page.
 *
 * Le verbe `read_live` ne peut PAS passer par un relais: un aller-retour Zapier
 * coûte plusieurs secondes, l'appelant a déjà raccroché. Un outil qu'on veut
 * lire pendant l'appel se code nativement, ou pas du tout. C'est la règle qui
 * décide de ce qui mérite un développement.
 */

export type IntegrationVerb = 'read_live' | 'write_after' | 'notify';
export type IntegrationTransport = 'native' | 'relay' | 'planned';
export type IntegrationSetup = 'url' | 'oauth' | 'apiKey' | 'none';

export interface IntegrationEntry {
  id: string;
  name: string;
  /** Ce que ça fait, dans l'ordre d'importance pour ce fournisseur. */
  verbs: IntegrationVerb[];
  transport: IntegrationTransport;
  /** Comment le client s'y branche. `url` = il colle une URL, sans nous. */
  setup: IntegrationSetup;
  /**
   * Une phrase en français disant ce que le client y GAGNE, pas ce que l'outil
   * est. « Synchroniser vos contacts » ne décide personne; « l'agent connaît
   * déjà l'appelant » si.
   */
  benefit: string;
  /**
   * Les métiers où ça compte. Vide = tous les métiers.
   *
   * Sert à ne montrer à un garagiste que ce qu'un garagiste branche. Une page
   * de quarante logos ne se lit pas, et la moitié ne le concerne jamais.
   */
  niches?: NicheId[];
}

/**
 * Les fournisseurs que `crm-sync.service.ts` sait réellement traiter.
 *
 * Écrit ici plutôt que redéclaré dans la route: c'est cette liste qui empêche
 * d'enregistrer une intégration qui ne synchronisera jamais, et une seconde
 * copie divergerait au premier ajout de gestionnaire.
 */
export const NATIVE_SYNC_PROVIDERS = ['webhook', 'zapier', 'make', 'n8n', 'slack', 'hubspot'] as const;

/** Ceux dont le secret EST une URL, donc sans jeton à obtenir. */
export const URL_SETUP_PROVIDERS = ['webhook', 'zapier', 'make', 'n8n', 'slack'] as const;

export const INTEGRATIONS: IntegrationEntry[] = [
  // ── Ce qui marche aujourd'hui, tous métiers ───────────────────────────────
  {
    id: 'google-calendar',
    name: 'Google Agenda',
    verbs: ['read_live', 'write_after'],
    transport: 'native',
    setup: 'oauth',
    benefit: "L'agent lit vos vrais créneaux pendant l'appel et pose le rendez-vous avant de raccrocher.",
  },
  {
    id: 'make',
    name: 'Make',
    verbs: ['write_after', 'notify'],
    transport: 'native',
    setup: 'url',
    benefit: 'Une URL à coller, et vos appels, contacts et affaires partent vers les 2000 outils de Make.',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    verbs: ['write_after', 'notify'],
    transport: 'native',
    setup: 'url',
    benefit: "Le même mécanisme que Make, si c'est Zapier que vous utilisez déjà.",
  },
  {
    id: 'n8n',
    name: 'n8n',
    verbs: ['write_after', 'notify'],
    transport: 'native',
    setup: 'url',
    benefit: 'Pour ceux qui hébergent leurs automatisations eux-mêmes.',
  },
  {
    id: 'webhook',
    name: 'Webhook',
    verbs: ['write_after'],
    transport: 'native',
    setup: 'url',
    benefit: 'Votre propre serveur reçoit le JSON brut de chaque appel.',
  },
  {
    id: 'slack',
    name: 'Slack',
    verbs: ['notify'],
    transport: 'native',
    setup: 'url',
    benefit: 'Le canal reçoit un message quand un appel produit un lead, et se tait le reste du temps.',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    verbs: ['write_after'],
    transport: 'native',
    setup: 'apiKey',
    benefit: 'Chaque appelant devient un contact HubSpot, avec le résumé de son appel.',
  },

  // ── Atteignables aujourd'hui par relais, sans une ligne de code ───────────
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    verbs: ['write_after'],
    transport: 'relay',
    setup: 'url',
    benefit: 'Vos appels créent des personnes et des affaires dans Pipedrive.',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    verbs: ['write_after'],
    transport: 'relay',
    setup: 'url',
    benefit: 'Les leads captés au téléphone remontent dans Salesforce.',
  },
  {
    id: 'notion',
    name: 'Notion',
    verbs: ['write_after'],
    transport: 'relay',
    setup: 'url',
    benefit: 'Une ligne par appel dans votre base Notion, résumé compris.',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    verbs: ['write_after'],
    transport: 'relay',
    setup: 'url',
    benefit: 'Vos appels alimentent une base Airtable que vous filtrez comme vous voulez.',
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    verbs: ['write_after'],
    transport: 'relay',
    setup: 'url',
    benefit: 'Un tableur qui se remplit tout seul, sans rien apprendre de nouveau.',
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    verbs: ['notify'],
    transport: 'relay',
    setup: 'url',
    benefit: "L'équipe est prévenue dans Teams plutôt que dans Slack.",
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    verbs: ['write_after'],
    transport: 'relay',
    setup: 'url',
    benefit: 'Les demandes de devis prises au téléphone arrivent en comptabilité.',
    niches: ['financial', 'home_services', 'auto'],
  },

  // ── Lecture pendant l'appel: à coder nativement, jamais par relais ────────
  {
    id: 'cal-com',
    name: 'Cal.com',
    verbs: ['read_live', 'write_after'],
    transport: 'planned',
    setup: 'apiKey',
    benefit: "Même chose que Google Agenda, pour ceux qui sont sur Cal.com.",
  },
  {
    id: 'outlook-calendar',
    name: 'Outlook / Microsoft 365',
    verbs: ['read_live', 'write_after'],
    transport: 'planned',
    setup: 'oauth',
    benefit: "L'agenda Microsoft lu pendant l'appel, comme celui de Google.",
  },

  // ── Immobilier ────────────────────────────────────────────────────────────
  {
    id: 'apimo',
    name: 'Apimo',
    verbs: ['write_after'],
    transport: 'planned',
    setup: 'apiKey',
    benefit: "Les demandes reçues au téléphone rejoignent vos contacts Apimo.",
    niches: ['real_estate'],
  },
  {
    id: 'hektor',
    name: 'Hektor',
    verbs: ['write_after'],
    transport: 'planned',
    setup: 'apiKey',
    benefit: 'Les acquéreurs appelés remontent dans Hektor.',
    niches: ['real_estate'],
  },

  // ── Restauration ──────────────────────────────────────────────────────────
  {
    id: 'zenchef',
    name: 'Zenchef',
    verbs: ['read_live', 'write_after'],
    transport: 'planned',
    setup: 'apiKey',
    benefit: "L'agent voit le plan de salle et pose la réservation directement.",
    niches: ['restaurant'],
  },
  {
    id: 'thefork',
    name: 'TheFork',
    verbs: ['write_after'],
    transport: 'planned',
    setup: 'apiKey',
    benefit: 'Les réservations prises au téléphone rejoignent celles de TheFork.',
    niches: ['restaurant'],
  },

  // ── Beauté et bien-être ───────────────────────────────────────────────────
  {
    id: 'planity',
    name: 'Planity',
    verbs: ['read_live', 'write_after'],
    transport: 'planned',
    setup: 'apiKey',
    benefit: "L'agent connaît le planning de chaque coiffeur avant de proposer une heure.",
    niches: ['salon'],
  },
  {
    id: 'treatwell',
    name: 'Treatwell',
    verbs: ['write_after'],
    transport: 'planned',
    setup: 'apiKey',
    benefit: 'Le rendez-vous pris au téléphone apparaît dans Treatwell.',
    niches: ['salon'],
  },

  // ── Services à domicile ───────────────────────────────────────────────────
  {
    id: 'jobber',
    name: 'Jobber',
    verbs: ['write_after'],
    transport: 'planned',
    setup: 'apiKey',
    benefit: "Une demande d'intervention devient un job Jobber, avec l'adresse dictée au téléphone.",
    niches: ['home_services'],
  },

  // ── Santé ─────────────────────────────────────────────────────────────────
  {
    id: 'doctolib',
    name: 'Doctolib',
    verbs: ['read_live', 'write_after'],
    transport: 'planned',
    setup: 'oauth',
    benefit: "L'agenda Doctolib lu et écrit pendant l'appel, sans double saisie.",
    niches: ['dental', 'medical', 'veterinary'],
  },

  // ── Juridique ─────────────────────────────────────────────────────────────
  {
    id: 'clio',
    name: 'Clio',
    verbs: ['write_after'],
    transport: 'planned',
    setup: 'apiKey',
    benefit: "Un appelant devient un dossier Clio, avec le motif de son appel.",
    niches: ['law'],
  },

  // ── Sport ─────────────────────────────────────────────────────────────────
  {
    id: 'mindbody',
    name: 'Mindbody',
    verbs: ['write_after'],
    transport: 'planned',
    setup: 'apiKey',
    benefit: 'Les inscriptions prises au téléphone rejoignent Mindbody.',
    niches: ['fitness'],
  },
];

/** Une intégration par son identifiant. */
export function findIntegration(id: string): IntegrationEntry | null {
  return INTEGRATIONS.find(i => i.id === id) ?? null;
}

/**
 * Ce qu'on enregistre réellement, par opposition à ce qu'on affiche.
 *
 * `planned` est refusé à la connexion: écrire une ligne `connected` pour un
 * fournisseur que la synchro ignorera est précisément le mensonge que ce
 * fichier existe pour empêcher.
 */
export function isConnectable(id: string): boolean {
  const entry = findIntegration(id);
  return !!entry && entry.transport !== 'planned';
}

/**
 * Le catalogue vu par UN métier: ce qui le concerne, le concret d'abord.
 *
 * L'ordre est celui de l'utilité décroissante et non l'alphabet: ce qui marche
 * aujourd'hui en haut, ce qui demande un détour par Make ensuite, ce qui n'existe
 * pas encore à la fin. Un écran trié autrement ferait scroller un client
 * jusqu'à une promesse avant de lui montrer ce qu'il peut brancher ce soir.
 */
const TRANSPORT_ORDER: Record<IntegrationTransport, number> = { native: 0, relay: 1, planned: 2 };

export function catalogueForBusinessType(businessType: string | null | undefined): IntegrationEntry[] {
  const niche = resolveNiche(businessType);
  return INTEGRATIONS
    .filter(i => !i.niches || i.niches.includes(niche))
    .sort((a, b) => {
      const t = TRANSPORT_ORDER[a.transport] - TRANSPORT_ORDER[b.transport];
      if (t !== 0) return t;
      // À transport égal, la lecture pendant l'appel passe devant: c'est elle
      // qui change ce que l'agent dit, donc ce que le client entend.
      const live = Number(b.verbs.includes('read_live')) - Number(a.verbs.includes('read_live'));
      return live !== 0 ? live : a.name.localeCompare(b.name, 'fr');
    });
}
