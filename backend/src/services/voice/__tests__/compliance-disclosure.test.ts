import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, ensureDisclosure, firstMessageVariants, hasAiDisclosure } from '../system-prompt';
import { shouldRecord, type CallerHistory, type ClientVoiceProfile } from '../realtime-context.service';

/**
 * Conformité au décroché (AI Act art. 50 + RGPD/314bis).
 *
 * Deux invariants que rien ne doit pouvoir réintroduire en silence:
 *  1. chaque premier message annonce que l'appelant parle à une IA, et
 *     annonce l'enregistrement quand — et seulement quand — il a lieu;
 *  2. aucun prompt du dépôt ne nie être une IA ni n'instruit de le cacher.
 */

const profile: ClientVoiceProfile = {
  clientId: 'client_1',
  businessName: 'Le Comptoir',
  businessType: 'restaurant',
  agentName: 'Camille',
  language: 'fr',
  timezone: 'Europe/Paris',
  transferNumber: null,
  instructions: null,
  services: [],
  openingHours: null,
  bookingEnabled: true,
  calendarConnected: false,
  planType: 'pro',
  characterId: null,
  customVoice: null,
  country: 'FR',
  customLlm: true,
  voiceMode: 'auto',
  hasKnowledgeBase: false,
  recordCalls: true,
};

const newCaller: CallerHistory = {
  previousCalls: 0,
  lastCallAt: null,
  lastSummary: null,
  knownName: null,
  hasUpcomingBooking: false,
};

const allVariantSets = (p: ClientVoiceProfile) => [
  firstMessageVariants(p, null),
  firstMessageVariants(p, 'Julien'),
];

describe('divulgation IA au décroché', () => {
  it('annonce l\'IA dans chaque variante française, appelant connu ou non', () => {
    for (const variants of allVariantSets(profile)) {
      for (const v of variants) expect(v).toMatch(/assistant IA/i);
    }
  });

  it('annonce l\'IA dans chaque variante anglaise', () => {
    const en = { ...profile, language: 'en' as const, agentName: 'Ashley' };
    for (const variants of allVariantSets(en)) {
      for (const v of variants) expect(v).toMatch(/AI assistant/i);
    }
  });
});

describe('notice d\'enregistrement', () => {
  it('est prononcée dans chaque variante quand l\'appel est enregistré', () => {
    for (const variants of allVariantSets(profile)) {
      for (const v of variants) expect(v).toContain('Cet appel est enregistré.');
    }
    const en = { ...profile, language: 'en' as const };
    for (const variants of allVariantSets(en)) {
      for (const v of variants) expect(v).toContain('This call is recorded.');
    }
  });

  it('disparaît — dans les deux langues — quand l\'enregistrement est coupé', () => {
    const off = { ...profile, recordCalls: false };
    for (const variants of allVariantSets(off)) {
      for (const v of variants) expect(v).not.toMatch(/enregistré/i);
    }
    const en = { ...off, language: 'en' as const };
    for (const variants of allVariantSets(en)) {
      for (const v of variants) expect(v).not.toMatch(/recorded/i);
    }
  });

  it('shouldRecord: un profil d\'avant le champ (cache) vaut « enregistré »', () => {
    expect(shouldRecord({ recordCalls: undefined as unknown as boolean })).toBe(true);
    expect(shouldRecord({ recordCalls: true })).toBe(true);
    expect(shouldRecord({ recordCalls: false })).toBe(false);
  });
});

describe('le prompt interdit de nier être une IA', () => {
  it('en français', () => {
    expect(buildSystemPrompt(profile, newCaller)).toMatch(/assistant vocal IA[\s\S]*confirme/i);
  });
  it('en anglais', () => {
    const prompt = buildSystemPrompt({ ...profile, language: 'en' }, newCaller);
    expect(prompt).toMatch(/AI voice assistant[\s\S]*confirm it plainly/i);
  });
});

describe('aucun script de déni d\'IA ne survit dans le dépôt', () => {
  // Garde de régression sur les sources elles-mêmes: le déni scripté a déjà
  // existé (« non, je suis réelle »), il ne doit pas pouvoir revenir par un
  // simple revert de prompt.
  const sources = [
    '../../vapi.service.ts',
    '../../../config/vapi-templates.ts',
    '../../../config/niche-scripts.ts',
    '../system-prompt.ts',
  ].map(rel => readFileSync(join(__dirname, rel), 'utf8'));

  const forbidden = [
    'je suis réelle',
    "I'm real",
    'Never reveal you are AI',
    'jamais révéler que tu es une IA',
    "people don't know it's AI",
    "most people can't tell",
  ];

  for (const needle of forbidden) {
    it(`ne contient plus « ${needle} »`, () => {
      for (const src of sources) expect(src).not.toContain(needle);
    });
  }
});

/**
 * LEG-1, le trou qui restait: un accueil PAR LIGNE, écrit librement par le
 * client dans un champ de 400 caractères, remplaçait l'accueil conforme en
 * entier.
 *
 * Un client qui écrit « Garage Dupont, bonjour ! » faisait donc sauter, sans le
 * savoir, une obligation qui pèse sur NOUS: l'article 50 de l'AI Act vise le
 * fournisseur du système, pas le commerçant qui l'utilise.
 */
describe('ensureDisclosure — l\'accueil de ligne ne peut plus faire sauter l\'annonce', () => {
  const client = (over: Record<string, unknown> = {}) =>
    ({ ...profile, ...over }) as never;

  it('complète un accueil qui ne dit rien, sans écarter la phrase du client', () => {
    const r = ensureDisclosure('Garage Dupont, bonjour !', client());
    // La phrase du client est GARDÉE: il l'a écrite pour cette ligne, et c'est
    // la première seconde de son appel.
    expect(r.text.startsWith('Garage Dupont, bonjour !')).toBe(true);
    expect(hasAiDisclosure(r.text, 'fr')).toBe(true);
    expect(r.added).toContain('ai');
  });

  it('ne retouche pas un accueil qui annonce déjà l\'IA', () => {
    const said = 'Garage Dupont, bonjour, je suis Camille, votre assistant IA.';
    const r = ensureDisclosure(said, client({ recordCalls: false }));
    expect(r.text).toBe(said);
    expect(r.added).toEqual([]);
  });

  it('n\'annonce l\'enregistrement que s\'il a lieu', () => {
    // Annoncer un enregistrement qui n'existe pas est un mensonge de confort,
    // et il se retourne aussi bien qu'une annonce manquante.
    const enregistre = ensureDisclosure('Bonjour !', client({ recordCalls: true }));
    expect(enregistre.added).toContain('recording');

    const pas = ensureDisclosure('Bonjour !', client({ recordCalls: false }));
    expect(pas.added).not.toContain('recording');
    expect(pas.text).not.toMatch(/enregistr/i);
  });

  it('reconnaît l\'annonce dans les trois langues', () => {
    expect(hasAiDisclosure('je suis votre assistant IA', 'fr')).toBe(true);
    expect(hasAiDisclosure("I'm an AI assistant", 'en')).toBe(true);
    expect(hasAiDisclosure('ik ben uw AI-assistent', 'nl')).toBe(true);
    expect(hasAiDisclosure('Garage Dupont, bonjour !', 'fr')).toBe(false);
  });
});

/**
 * LEG-5, le parcours complet. Le mode sans enregistrement se joue à TROIS
 * endroits qui ne se parlent pas: le drapeau posé sur l'assistant, la phrase
 * d'accueil qui promet (ou non) l'enregistrement, et la fin d'appel qui garde
 * (ou non) l'URL. Chacun est testé de son côté; leur ACCORD ne l'était pas.
 *
 * Or le désaccord n'est pas théorique. Un assistant périmé chez Vapi, un
 * réglage changé en cours d'appel, une surcharge d'escouade: dans chacun de
 * ces cas l'URL arrive alors que l'appelant vient d'entendre qu'il n'est pas
 * enregistré. Garder cette URL fait mentir la phrase.
 */
describe('le mode sans enregistrement, de bout en bout', () => {
  const silent: ClientVoiceProfile = { ...profile, recordCalls: false };

  it('la décision est la même aux trois endroits', () => {
    expect(shouldRecord(silent)).toBe(false);
    expect(shouldRecord(profile)).toBe(true);
  });

  it('l\'accueil ne promet pas un enregistrement qui n\'a pas lieu', () => {
    for (const greeting of firstMessageVariants(silent, null)) {
      expect(/enregistr/i.test(greeting)).toBe(false);
    }
  });

  /**
   * L'invariant que ce parcours existe pour protéger: couper l'enregistrement
   * ne coupe PAS l'annonce IA. Les deux obligations sont distinctes, elles
   * viennent de deux textes différents, et les confondre ferait sauter la plus
   * lourde des deux en changeant une case à cocher de confort.
   */
  it('couper l\'enregistrement ne fait pas sauter l\'annonce IA', () => {
    for (const greeting of firstMessageVariants(silent, null)) {
      expect(hasAiDisclosure(greeting, 'fr')).toBe(true);
    }
  });

  it('un client qui enregistre l\'annonce, lui', () => {
    for (const greeting of firstMessageVariants(profile, null)) {
      expect(/enregistr/i.test(greeting)).toBe(true);
      expect(hasAiDisclosure(greeting, 'fr')).toBe(true);
    }
  });

  it('le prompt ne réintroduit pas la notice quand elle ne s\'applique pas', () => {
    expect(/enregistr/i.test(buildSystemPrompt(silent, newCaller))).toBe(false);
  });
});
