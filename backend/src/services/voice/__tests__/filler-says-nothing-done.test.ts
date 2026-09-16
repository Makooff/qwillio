import { describe, it, expect } from 'vitest';
import { fillerFor } from '../voice-tools';
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

const TOOLS = [
  'checkAvailability', 'bookAppointment', 'captureLead',
  'lookupBooking', 'rescheduleBooking', 'lookupKnowledge',
];
const LANGS: VoiceLanguage[] = ['fr', 'en', 'nl'];

/** Les formes exactes qui ont menti, gelées langue par langue. */
const INTERDIT: Record<VoiceLanguage, string[]> = {
  fr: [
    'je vous réserve', "j'enregistre", 'je déplace', 'je finalise',
    "c'est noté", "c'est fait", "c'est réservé", "j'ai bien",
    'je retrouve', "je mets l'agenda à jour",
  ],
  en: [
    'lock that in', "i'm booking", 'let me move your', 'finishing the booking',
    'updating the calendar', 'got it,', 'let me find your',
  ],
  nl: [
    'ik leg dat voor u vast', 'ik boek dat', 'ik verplaats uw afspraak',
    'genoteerd', 'ik rond de reservatie af', 'ik werk de agenda bij',
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
