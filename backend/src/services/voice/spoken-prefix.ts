import type { VoiceLanguage } from './speech-plans';

/**
 * Tronquer un énoncé à ce que l'appelant a RÉELLEMENT entendu (TUR-9).
 *
 * Le pipeline génère beaucoup plus vite que le temps réel: quand l'appelant
 * coupe la parole, le modèle a souvent écrit quatre phrases et la synthèse
 * n'en a joué qu'une et demie. L'historique du tour suivant, lui, porte les
 * quatre. L'agent croit donc avoir dit des choses que personne n'a entendues,
 * et toute la suite de la conversation s'appuie dessus: « comme je vous
 * disais », un créneau jamais énoncé, une question déjà posée. C'est un défaut
 * silencieux, invisible au transcript, et qui ne ressemble pas à une panne.
 *
 * Ce qu'on possède et ce qu'on ne possède pas: la synthèse appartient à Vapi,
 * qui ne rend AUCUN horodatage au mot. Il reste le seul signal fiable de la
 * chaîne, celui que `speech-update` donne des deux côtés — depuis combien de
 * temps l'agent parlait quand il a été coupé. La durée se convertit en
 * caractères par un débit de parole, ce qui est une ESTIMATION et s'assume
 * comme telle.
 *
 * L'arbitrage tient en une phrase: garder du texte jamais entendu ramène le
 * défaut d'origine, en retirer un peu trop fait au pire répéter l'agent. Les
 * deux erreurs ne coûtent pas la même chose, donc la coupe est franche.
 */

/**
 * Débit de parole en CARACTÈRES par seconde, à la vitesse de synthèse par
 * défaut. Les caractères et non les syllabes: on tronque une chaîne, et une
 * mesure en syllabes demanderait un syllabeur par langue pour la même
 * précision — la marge de garde plus bas couvre déjà l'écart.
 */
const SPEECH_RATE_CPS: Record<VoiceLanguage, number> = {
  fr: 15,
  nl: 15,
  en: 16,
};

/**
 * En dessous de cette part de l'énoncé, on ne touche à rien.
 *
 * Le débit est une estimation: à quelques dixièmes de la fin, l'écart entre
 * l'estimé et le joué n'est plus qu'un bruit de mesure, et couper là ferait
 * répéter l'agent sans rien corriger. La coupe ne sert que quand l'appelant a
 * manifestement manqué une part substantielle.
 */
const MIN_TRUNCATION_RATIO = 0.85;

/** Ce que porte l'historique quand l'appelant n'a rien entendu du tout. */
const NOTHING_HEARD = '…';

export interface SpokenPrefix {
  /** Le texte à mettre dans l'historique. */
  text: string;
  /** Vrai si on a effectivement retiré quelque chose. */
  truncated: boolean;
}

/**
 * La part de `text` que l'appelant a plausiblement entendue en `elapsedMs`.
 *
 * La coupe tombe toujours sur une frontière de MOT, et sur le mot entier: un
 * mot coupé en deux ne se lit pas comme une phrase interrompue, il se lit
 * comme une faute de frappe, et le modèle le corrigerait en le réécrivant.
 */
export function spokenPrefix(text: string, elapsedMs: number, lang: VoiceLanguage = 'fr'): SpokenPrefix {
  const full = (text || '').trim();
  if (!full) return { text: full, truncated: false };
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return { text: NOTHING_HEARD, truncated: true };

  const heardChars = (elapsedMs / 1000) * SPEECH_RATE_CPS[lang];
  if (heardChars >= full.length * MIN_TRUNCATION_RATIO) return { text: full, truncated: false };

  // Terminer le mot en cours plutôt que de le trancher.
  let cut = Math.max(0, Math.floor(heardChars));
  while (cut < full.length && !/\s/.test(full[cut])) cut++;

  const kept = full.slice(0, cut).trim();
  if (!kept) return { text: NOTHING_HEARD, truncated: true };

  // Les points de suspension disent au modèle que la phrase s'est arrêtée là
  // sans avoir fini, ce qu'aucune ponctuation forte ne saurait dire.
  return { text: `${kept.replace(/[,;:]$/, '')}…`, truncated: true };
}
