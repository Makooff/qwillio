/**
 * Détection d'un opt-out d'appel exprimé À VOIX HAUTE pendant un appel sortant
 * (roadmap 3.3, première brique).
 *
 * Avant ceci, un prospect qui disait « ne me rappelez plus » n'avait AUCUN
 * champ où atterrir: le moteur le rappelait jusqu'à épuiser ses 3 tentatives.
 * La détection est volontairement lexicale et conservatrice — un faux positif
 * coûte un prospect, un faux négatif coûte une infraction; en cas de doute la
 * phrase doit être assez explicite pour qu'un humain la lise comme un refus
 * de RAPPEL, pas comme un simple « pas intéressé » (qui, lui, reste un
 * prospect à recontacter dans trois mois).
 */

const OPT_OUT_PATTERNS: RegExp[] = [
  // FR
  /ne\s+(?:me\s+)?(?:r)?appelez\s+plus/i,
  /arr[êe]tez\s+de\s+(?:m['’]?)?appeler/i,
  /retirez[- ]moi\s+de\s+(?:votre|vos|la)\s+liste/i,
  /supprimez\s+mon\s+num[ée]ro/i,
  /je\s+ne\s+veux\s+plus\s+(?:que\s+vous\s+m['’]?appeliez|d['’]appels?)/i,
  /liste\s+rouge|bloctel/i,
  // EN
  /do\s*n[o']t\s+call\s+(?:me\s+)?(?:again|anymore|back)/i,
  /stop\s+calling(?:\s+me)?/i,
  /take\s+me\s+off\s+(?:your|the)\s+list/i,
  /remove\s+(?:me|my\s+number)\s+from\s+(?:your|the)\s+list/i,
  /never\s+call\s+(?:me|us)\s+again/i,
  // NL
  /bel\s+(?:me|mij|ons)\s+niet\s+meer/i,
  /stop\s+met\s+(?:mij\s+te\s+)?bellen/i,
  /haal\s+(?:me|mij)\s+van\s+(?:je|jullie|de)\s+lijst/i,
];

export function detectCallOptOut(transcript: string | null | undefined): boolean {
  if (!transcript) return false;
  return OPT_OUT_PATTERNS.some(p => p.test(transcript));
}
