/**
 * La LECTURE d'un transcript, ramenée à des enseignements. Aucune I/O.
 *
 * `call-postmortem` juge un appel avec des règles — outil en erreur, ligne
 * muette, latence. Ce que des règles ne verront jamais : le modèle qui
 * annonce « c'est réservé » avant le retour de l'outil, le mot du métier
 * qu'il n'a pas compris, la formulation qui a fait répéter l'appelant. Ça se
 * LIT, ça ne se mesure pas. Ce module prépare cette lecture (le prompt) et en
 * valide le résultat (le parse), pour que le service qui appelle le modèle
 * n'ait aucune décision à prendre.
 *
 * Le contrat demandé au modèle tient en trois exigences, chacune payée par
 * l'expérience du dépôt :
 *
 * 1. UN SLUG STABLE. Le même phénomène relu sur un autre appel doit porter le
 *    même slug, sinon l'agrégation compte trois bruits au lieu d'un signal.
 * 2. UNE PREUVE CITÉE. Une règle apprise sans l'extrait qui l'a motivée est
 *    une règle qu'on ne peut pas relire — `prompts.py` nomme l'appel dans
 *    chaque docstring de test depuis toujours.
 * 3. RIEN QUAND IL N'Y A RIEN. Un appel simplement lent ou simplement raté
 *    n'a pas d'enseignement de conversation ; le modèle doit rendre une liste
 *    vide plutôt que d'inventer un pattern pour remplir.
 */

/** Un enseignement lu dans UN appel, avant agrégation. */
export interface ConversationPattern {
  /** kebab-case, stable d'un appel à l'autre pour le même phénomène. */
  slug: string;
  /** `conversation` → règle de prompt. `threshold` → réglage chiffré proposé. */
  kind: 'conversation' | 'threshold';
  title: string;
  /** Ce qui s'est passé, et la règle ou le réglage qui l'aurait empêché. */
  summary: string;
  /** L'extrait VERBATIM du transcript qui motive l'enseignement. */
  quote: string;
}

/** Le maximum d'enseignements pris sur un appel : au-delà, c'est du remplissage. */
const MAX_PATTERNS_PER_CALL = 3;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,59}$/;

/** Le transcript au-delà duquel on paie du bruit : les leçons sont au début et à la fin. */
const TRANSCRIPT_HEAD = 3000;
const TRANSCRIPT_TAIL = 2000;

export const ANALYSIS_SYSTEM_PROMPT = `Tu relis le transcript d'un appel entre un appelant et une réceptionniste IA, après que des règles automatiques l'ont jugé perfectible. Tu cherches UNIQUEMENT ce que des métriques ne peuvent pas voir :

- un malentendu de vocabulaire ou de nom (l'agent comprend autre chose que ce qui est dicté) ;
- une annonce prématurée (réservation, transfert, promesse dite AVANT que l'outil confirme) ;
- une formulation qui coûte un tour (question déjà répondue, détail demandé trop tôt, registre qui glisse) ;
- un savoir manquant qui a forcé l'agent à botcher ou à chercher ;
- un réglage chiffré qui se devine dans le déroulé (attente trop longue, interruption trop sensible) — alors kind "threshold".

Tu NE signales PAS : la politesse, le style, ce que les codes de verdict nomment déjà (outil en panne, ligne muette, latence — c'est mesuré, pas lu), ni rien qui ne soit pas visible dans le transcript. S'il n'y a rien d'enseignable, rends une liste vide. Inventer un pattern pour remplir est la faute à ne pas commettre : une règle apprise d'un appel qui n'a pas eu lieu dégrade tous les appels suivants.

Rends UNIQUEMENT un JSON :
{ "patterns": [ { "slug": "kebab-case-stable", "kind": "conversation" | "threshold", "title": "une ligne", "summary": "ce qui s'est passé + la règle qui l'aurait empêché", "quote": "extrait verbatim du transcript" } ] }

Contraintes :
- 0 à 3 patterns, les plus coûteux d'abord ;
- le slug désigne le PHÉNOMÈNE, pas l'appel : le même phénomène sur un autre appel doit porter le même slug (jamais de date, d'identifiant ou de nom propre dedans) ;
- la quote est COPIÉE du transcript, jamais paraphrasée ;
- title et summary en français.`;

export interface AnalysisInput {
  transcript: string;
  verdict: string;
  codes: string[];
  evidence: string[];
}

/** Le message utilisateur : le verdict mesuré d'abord, le transcript réduit ensuite. */
export function buildAnalysisUserMessage(call: AnalysisInput): string {
  const t = call.transcript;
  const réduit =
    t.length <= TRANSCRIPT_HEAD + TRANSCRIPT_TAIL
      ? t
      : `${t.slice(0, TRANSCRIPT_HEAD)}\n[… ${t.length - TRANSCRIPT_HEAD - TRANSCRIPT_TAIL} caractères centraux omis …]\n${t.slice(-TRANSCRIPT_TAIL)}`;
  return [
    `Verdict des règles : ${call.verdict} (${call.codes.join(', ') || 'aucun code'})`,
    call.evidence.length ? `Mesures : ${call.evidence.join(' ; ')}` : null,
    '',
    'TRANSCRIPT :',
    réduit,
  ]
    .filter(l => l !== null)
    .join('\n');
}

/**
 * Le parse, tolérant sur la forme et strict sur le fond.
 *
 * Tolérant : le modèle entoure parfois le JSON d'une clôture de code ou d'une
 * phrase. Strict : un slug invalide, une quote vide, un kind inconnu et
 * l'entrée tombe ENTIÈREMENT — une moitié d'enseignement est un enseignement
 * faux. Tout ce qui ne se parse pas rend une liste vide, jamais une erreur :
 * un appel mal lu ne doit pas casser le balayage des suivants.
 */
export function parsePatterns(raw: string): ConversationPattern[] {
  const text = (raw ?? '').trim();
  if (!text) return [];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  if (!candidate || !candidate.includes('{')) return [];

  let parsed: any;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed) ? parsed : parsed?.patterns;
  if (!Array.isArray(list)) return [];

  const out: ConversationPattern[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const slug = String(item.slug ?? '').trim().toLowerCase();
    const kind = item.kind === 'threshold' ? 'threshold' : 'conversation';
    const title = String(item.title ?? '').trim().slice(0, 200);
    const summary = String(item.summary ?? '').trim();
    const quote = String(item.quote ?? '').trim();
    if (!SLUG_RE.test(slug) || !title || !summary || !quote) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, kind, title, summary, quote: quote.slice(0, 500) });
    if (out.length >= MAX_PATTERNS_PER_CALL) break;
  }
  return out;
}
