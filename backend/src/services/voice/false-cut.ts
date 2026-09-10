import type { VoiceLanguage } from './speech-plans';

/**
 * Le FAUX DÉCOUPAGE: l'agent prend la parole alors que l'appelant n'avait pas
 * fini (TUR-13).
 *
 * Les deux compteurs voisins vont dans l'autre sens. `bargeIns` et
 * `hardBargeIns` comptent l'appelant qui coupe l'AGENT, ce qui mesure la
 * longueur des réponses. Personne ne comptait l'agent qui coupe l'APPELANT,
 * qui est pourtant le côté cher de l'arbitrage: 250 ms de silence en plus se
 * pardonnent, se faire couper la parole ne se pardonne pas. Sans ce taux, le
 * seuil d'endpointing se règle à l'oreille de qui le règle.
 *
 * Ce qu'on peut observer, et ce qu'on ne peut pas: le découpage lui-même
 * appartient au transcripteur, qui ne dit jamais « je me suis trompé ». Reste
 * sa SIGNATURE, et elle est nette — l'appelant reprend la parole presque
 * immédiatement après le début de l'énoncé, et son tour précédent s'arrêtait
 * au milieu d'une pensée. Deux conditions, parce qu'une seule ne trie rien:
 * une reprise immédiate peut être un « non non » de réaction, et une phrase
 * inachevée peut simplement rester en suspens.
 */

/**
 * Au-delà, l'appelant réagit à ce qu'il a entendu; en deçà, il n'a pas eu le
 * temps de l'entendre, il continuait sa phrase.
 */
export const FALSE_CUT_WINDOW_MS = 1_200;

/**
 * Les mots qui ne terminent pas une pensée: conjonctions, prépositions,
 * déterminants, hésitations. Un tour qui s'arrête là s'arrête au milieu.
 *
 * Par langue, et pas une liste unique: « or », « met », « een » sont des mots
 * de liaison en néerlandais et rien du tout ailleurs.
 */
const CONTINUATION: Record<VoiceLanguage, string[]> = {
  fr: [
    'et', 'ou', 'mais', 'donc', 'car', 'que', 'qui', 'quand', 'parce', 'pour',
    'avec', 'dans', 'sur', 'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une',
    'mon', 'ma', 'mes', 'je', 'j', 'c', 'est', 'à', 'au', 'aux', 'en', 'euh',
    'euhm', 'alors', 'enfin', 'puis', 'si', 'ne', 'pas',
  ],
  nl: [
    'en', 'of', 'maar', 'dus', 'want', 'dat', 'die', 'als', 'omdat', 'voor',
    'met', 'in', 'op', 'van', 'de', 'het', 'een', 'mijn', 'ik', 'is', 'te',
    'naar', 'eh', 'ehm', 'dan', 'nog', 'niet',
  ],
  en: [
    'and', 'or', 'but', 'so', 'because', 'that', 'which', 'when', 'for',
    'with', 'in', 'on', 'of', 'the', 'a', 'an', 'my', 'i', 'is', 'to', 'at',
    'um', 'uh', 'then', 'not',
  ],
};

/**
 * Le tour de l'appelant s'arrête-t-il au milieu d'une pensée ?
 *
 * La ponctuation FORTE tranche en premier quand elle est là: le transcripteur
 * qui écrit un point ou un point d'interrogation a lui-même conclu. Sinon on
 * regarde le dernier mot.
 */
export function endsMidThought(text: string, lang: VoiceLanguage = 'fr'): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (/[.!?]$/.test(t)) return false;
  // Une virgule finale est un aveu de suite: le transcripteur a coupé sur une
  // pause, pas sur une fin.
  if (/,$/.test(t)) return true;

  const words = t.toLowerCase().replace(/[^\p{L}\p{N}'\s-]/gu, ' ').trim().split(/\s+/);
  const last = words[words.length - 1];
  if (!last) return false;
  return CONTINUATION[lang].includes(last);
}

/**
 * L'agent a-t-il coupé l'appelant ?
 *
 * `speakingForMs` est la durée d'énoncé de l'agent au moment où l'appelant a
 * repris la parole; `previousCallerTurn` est ce que l'appelant venait de dire.
 */
export function isFalseCut(
  speakingForMs: number,
  previousCallerTurn: string | null,
  lang: VoiceLanguage = 'fr',
): boolean {
  if (speakingForMs > FALSE_CUT_WINDOW_MS) return false;
  return endsMidThought(previousCallerTurn ?? '', lang);
}
