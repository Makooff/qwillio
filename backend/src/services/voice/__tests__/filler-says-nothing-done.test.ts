import { describe, it, expect } from 'vitest';
import { fillerFor, KNOWN_TOOLS } from '../voice-tools';
import type { VoiceLanguage } from '../speech-plans';

/**
 * Une phrase d'attente ne dit JAMAIS que c'est fait.
 *
 * Elle est prononcée au DÉMARRAGE de l'outil, avant sa réponse. Toute phrase
 * qui affirme un résultat ment une fois sur deux, et ment toujours quand
 * l'outil échoue.
 *
 * Deux appels réels du 16/09/2026, mot pour mot:
 *   « Parfait, je vous réserve ça. » puis, dans la seconde qui suit,
 *   « pourriez-vous épeler votre nom de famille » — rien n'était réservé, et
 *   rien ne l'a été de tout l'appel.
 *   « Je déplace votre rendez-vous, un instant. » SEPT fois, pendant que
 *   l'outil répondait sept fois « AUCUNE RESERVATION trouvee ».
 *
 * Ce qui rend ce défaut coûteux à trouver: le prompt avait été durci pendant
 * des semaines contre exactement ça, et le modèle n'y était pour rien. La
 * phrase venait d'une constante.
 */

/* La liste se LIT, elle ne se recopie pas. Elle était écrite à la main ici, et
   un outil ajouté plus tard n'aurait donc jamais été relu par ce garde-fou: la
   leçon vaut pour toute liste que deux endroits tiennent (6vicies). */
const TOOLS: readonly string[] = KNOWN_TOOLS;
const LANGS: VoiceLanguage[] = ['fr', 'en', 'nl'];

/** Les formes exactes qui ont menti, gelées langue par langue. */
const INTERDIT: Record<VoiceLanguage, string[]> = {
  fr: [
    'je vous réserve', "j'enregistre", 'je déplace', 'je finalise',
    "c'est noté", "c'est fait", "c'est réservé", "j'ai bien",
    'je retrouve', "je mets l'agenda à jour",
    /* 19/09/2026, avec l'outil d'annulation: « j'annule votre rendez-vous »
       est la même faute que « je déplace votre rendez-vous », en pire. Un
       appelant qui l'entend raccroche en croyant son créneau libéré, et le
       commerce le garde. */
    "j'annule", 'je supprime', "c'est annulé",
  ],
  en: [
    'lock that in', "i'm booking", 'let me move your', 'finishing the booking',
    'updating the calendar', 'got it,', 'let me find your',
    "i'm cancelling", "i'm canceling", 'let me cancel your', "that's cancelled",
  ],
  nl: [
    'ik leg dat voor u vast', 'ik boek dat', 'ik verplaats uw afspraak',
    'genoteerd', 'ik rond de reservatie af', 'ik werk de agenda bij',
    'ik annuleer', 'is geannuleerd',
  ],
};

/** Ce à quoi ressemble une phrase d'attente correcte: elle décrit le geste. */
const EN_COURS: Record<VoiceLanguage, RegExp> = {
  fr: /instant|regarde|vérifie|cherche|consulte|prends note|m'en occupe|laissez-moi|patienter|charge|suis dessus/i,
  en: /moment|second|check|look|still|on it|hold|taking|pull(ing)? that up/i,
  nl: /moment|ogenblik|kijk|zoek|bekijk|raadpleeg|noteer|bezig|geduld|laadt/i,
};

describe('les phrases d\'attente décrivent le geste, jamais son issue', () => {
  for (const tool of TOOLS) {
    for (const lang of LANGS) {
      it(`${tool} / ${lang}: aucune affirmation de résultat`, () => {
        const phrases = [...fillerFor(tool, lang, 'start'), ...fillerFor(tool, lang, 'delayed')];
        for (const phrase of phrases) {
          const bas = phrase.toLowerCase();
          for (const forme of INTERDIT[lang]) {
            expect(bas, `« ${phrase} » annonce un résultat avant que l'outil réponde`)
              .not.toContain(forme);
          }
        }
      });
    }
  }

  it('chaque outil garde au moins une phrase de démarrage', () => {
    // Le silence pendant qu'un agenda charge est pire qu'une phrase d'attente:
    // l'appelant croit que la ligne a coupé.
    for (const tool of TOOLS) {
      for (const lang of LANGS) {
        expect(fillerFor(tool, lang, 'start').length, `${tool}/${lang}`).toBeGreaterThan(0);
      }
    }
  });

  it('et chacune se lit comme une action en cours', () => {
    for (const tool of TOOLS) {
      for (const lang of LANGS) {
        for (const phrase of fillerFor(tool, lang, 'start')) {
          expect(phrase, `${tool}/${lang}: « ${phrase} » ne décrit aucun geste en cours`)
            .toMatch(EN_COURS[lang]);
        }
      }
    }
  });

  it('tombe si on repose la forme fautive', () => {
    // La garde elle-même, vérifiée: ce sont les deux phrases exactes des appels
    // du 16/09, et le test doit les refuser.
    const fautives = ['Parfait, je vous réserve ça.', 'Je déplace votre rendez-vous, un instant.'];
    for (const phrase of fautives) {
      const bas = phrase.toLowerCase();
      expect(INTERDIT.fr.some(f => bas.includes(f))).toBe(true);
    }
  });
});

/**
 * ET EN PAROLE-À-PAROLE, ELLE NE SE DIT PAS DU TOUT (17/09/2026).
 *
 * Sur ce chemin le modèle produit son audio lui-même et annonce SPONTANÉMENT
 * ce qu'il va faire avant d'appeler l'outil. Notre phrase s'ajoute alors
 * par-dessus, dans une autre voix, en disant la même chose. Relevé deux fois
 * dans un seul appel réel:
 *
 *   « Je vais maintenant vérifier vos rendez-vous. Un instant s'il vous
 *     plaît. »   (le modèle)
 *   « Je cherche votre réservation, un instant. »   (cette table, mot pour mot)
 *
 * C'est « il répète en boucle ce qu'il fait », le retour exact du
 * propriétaire. En classique la phrase reste indispensable: la chaîne ne peut
 * RIEN dire pendant que l'outil tourne.
 *
 * ET LA PHRASE RETARDÉE SE TAIT AUSSI (19/09/2026). Elle avait été gardée au
 * motif qu'elle « ne part qu'après `VOICE_FILLER_DELAY_MS`, quand il ne reste
 * que du silence ». Ce seuil vaut 1 200 ms, et le relevé du LENDEMAIN donne
 * les durées d'outil réelles: 2,2 / 6,1 / 2,9 / 4,5 / 7,7 s. Les cinq le
 * dépassent, donc elle partait sur TOUS les outils, par-dessus la narration
 * du modèle. Même défaut, même retour du propriétaire, et le correctif du 17
 * n'en fermait que la moitié.
 *
 * La règle: une justification qui repose sur un seuil se relit quand on MESURE
 * ce que ce seuil filtre.
 */
describe('la phrase de démarrage se tait en parole-à-parole', () => {
  const profile = (over: Record<string, unknown> = {}) => ({
    clientId: 'c1', language: 'fr' as const, timezone: 'Europe/Brussels',
    bookingEnabled: true, calendarConnected: true, customLlm: true,
    voiceTier: null, voiceMode: 'classic', customVoice: null, superagentAllowed: true,
    knowledgeFields: [], weekHours: {}, ...over,
  }) as any;

  const startMessages = (tools: any[]) => tools.flatMap(
    (t: any) => (t.messages ?? []).filter((m: any) => m.type === 'request-start'));
  const delayedMessages = (tools: any[]) => tools.flatMap(
    (t: any) => (t.messages ?? []).filter((m: any) => m.type === 'request-response-delayed'));

  /*
   * TAIRE LA PHRASE NE LA RETIRE PAS (19/09/2026).
   *
   * Ce test exigeait `toHaveLength(0)`, sur la prémisse que `messages: []`
   * fait silence. Un appel réel l'a démentie: les DEUX appels d'outil sont
   * suivis, 10 ms après `Tool execution started`, d'un `sayQueuePush` de
   * Vapi, et l'appelant a entendu « Donne-moi un moment. » — une phrase
   * absente de toutes nos tables, et TUTOYANTE, sur un agent dont le prompt
   * impose le vouvoiement depuis dix jours. L'audio du modèle ne passe pas
   * par cette file (le tour précédent n'a aucun `sayQueuePush`).
   *
   * Le silence n'était donc pas une option offerte: le choix réel est entre
   * NOTRE phrase et CELLE DE VAPI. Le test passait pendant que le défaut du
   * fournisseur tutoyait l'appelant — exactement ce que `toBeUndefined` avait
   * laissé passer sur `transcriber` (6sexquinquagesies).
   */
  it('reprend la main sur la phrase de démarrage: UNE, minimale, et vouvoyante', async () => {
    const { buildVoiceTools } = await import('../voice-tools');
    const tools = buildVoiceTools(profile({ voiceTier: 'superagent' }));
    expect(tools.length).toBeGreaterThan(0);
    const starts = startMessages(tools);
    expect(starts.length).toBeGreaterThan(0);
    for (const m of starts) {
      /* UNE seule formulation, et la même pour tous les outils: c'est ce qui
         l'empêche de narrer, donc de faire doublon avec la narration que le
         modèle produit déjà (le défaut du 17/09). */
      expect(m.contents).toHaveLength(1);
      const text: string = m.contents[0].text;
      expect(text.length).toBeLessThan(20);
      /* Et surtout: elle VOUVOIE. C'est la raison d'être du correctif. */
      expect(text).not.toMatch(/\b(tu|toi|ton|ta|tes)\b/i);
      expect(text).not.toMatch(/Donne-moi|Attends/i);
    }
    /* La même pour tous les outils, littéralement. */
    expect(new Set(starts.map((m: any) => m.contents[0].text)).size).toBe(1);
  });

  it('la phrase RETARDÉE se tait aussi: 1 200 ms est sous TOUTES les durées mesurées', async () => {
    /* La version précédente de ce test exigeait l'inverse, sur la foi d'un
       seuil que les mesures du lendemain contredisent. Elle passait pendant
       que l'appelant entendait deux voix dire la même chose. */
    const { buildVoiceTools } = await import('../voice-tools');
    const tools = buildVoiceTools(profile({ voiceTier: 'superagent' }));
    expect(delayedMessages(tools)).toHaveLength(0);
  });

  it('une seule phrase par outil, jamais deux: la retardée reste tue', async () => {
    /* Ce test exigeait AUCUN message, même prémisse démentie que ci-dessus.
       Ce qui compte pour l'appelant n'est pas le silence — impossible à
       obtenir — mais qu'il n'entende pas DEUX phrases par outil: c'est la
       retardée qui relançait le bavardage à chaque appel, et elle, aucun
       défaut de Vapi ne la remplace. */
    const { buildVoiceTools } = await import('../voice-tools');
    const tools = buildVoiceTools(profile({ voiceTier: 'superagent' }));
    for (const t of tools as any[]) {
      const messages = t.messages ?? [];
      expect(messages.filter((m: any) => m.type === 'request-response-delayed')).toHaveLength(0);
      expect(messages.length).toBeLessThanOrEqual(1);
    }
  });

  it('la chaîne classique les garde toutes les deux: elle ne peut rien dire pendant l\'outil', async () => {
    const { buildVoiceTools } = await import('../voice-tools');
    const tools = buildVoiceTools(profile());
    expect(startMessages(tools).length).toBeGreaterThan(0);
    expect(delayedMessages(tools).length).toBeGreaterThan(0);
  });
});
