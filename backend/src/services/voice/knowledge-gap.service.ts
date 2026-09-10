import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { normalizeUtterance } from './intent-router';
import { knowledgeEmbeddingsService } from './knowledge-embeddings.service';
import type { VoiceLanguage } from './speech-plans';

/**
 * Ce que la réceptionniste NE SAIT PAS, et comment elle finit par l'apprendre.
 *
 * ── Le trou que ce module bouche ────────────────────────────────────────────
 *
 * Quand un appelant demandait quelque chose d'absent de la base, l'agent
 * répondait « je fais remonter la question » — et la question s'arrêtait là.
 * Elle ne remontait à personne: le gérant ne l'apprenait pas, la base ne
 * grossissait pas, et l'appelant suivant reposait la même question pour la
 * même absence de réponse. La promesse tenue à l'appelant était la seule
 * partie du mécanisme qui existait.
 *
 * Un compteur portait pourtant déjà le nom « knowledge_gaps », dans le rapport
 * hebdomadaire. Il comptait les CONSULTATIONS, réussies comprises, et ne
 * gardait aucune question: il disait qu'on cherchait souvent, jamais quoi.
 *
 * ── La boucle, en trois temps ───────────────────────────────────────────────
 *
 *  1. l'appel enregistre la question, dans les mots de celui qui l'a posée. Ni
 *     le gérant ni nous n'aurions su l'écrire d'avance: c'est le seul moment où
 *     elle existe;
 *  2. le gérant la voit, avec le nombre de fois qu'elle a été posée, et répond
 *     une fois;
 *  3. sa réponse devient une entrée de la base, servie dès l'appel suivant, et
 *     la question ne revient plus.
 *
 * ── Pourquoi une empreinte, et pas l'identifiant de la ligne ────────────────
 *
 * « vous êtes ouverts le dimanche ? » et « ouvert dimanche ? » sont une seule
 * question à traiter. Sans regroupement, un gérant ouvre son portail sur
 * quarante variantes d'une même chose et referme l'onglet. L'empreinte
 * normalise, retire les mots vides, TRONQUE chaque mot à sa racine et TRIE ce
 * qui reste: l'ordre des mots et leur accord sont précisément ce qui change
 * d'un appelant à l'autre, et ni l'un ni l'autre ne porte d'information ici.
 *
 * Ce regroupement est lexical, donc imparfait, et il faut savoir jusqu'où: il
 * réunit « ouverts » et « ouvert », pas « ouvrez » et « ouvert », et encore
 * moins « tarif » et « prix ». Un regroupement sémantique demanderait un appel
 * de modèle par question posée.
 *
 * Ce qu'on peut se permettre de rater, et c'est ce qui rend le défaut
 * supportable: la boucle se referme d'elle-même. Le gérant répond à l'une des
 * variantes, sa réponse devient une entrée portant les mots de l'appelant, et
 * la variante suivante TROUVE cette entrée — donc ne produit plus de lacune.
 * Un mauvais regroupement coûte une ligne de trop avant que le sujet soit
 * couvert, jamais une question qui revient indéfiniment.
 */

export interface OpenGap {
  id: string;
  question: string;
  askedCount: number;
  lastAskedAt: Date;
  language: string;
}

/**
 * Les mots qui ne distinguent pas deux questions.
 *
 * Volontairement court: chaque mot retiré rapproche deux questions, et en
 * retirer trop finirait par confondre « avez-vous un parking » et « avez-vous
 * une terrasse ». Ne sont listés que les vides purs — articles, auxiliaires,
 * politesses — jamais un nom ni un verbe qui porte le sujet.
 */
const STOP_WORDS = new Set([
  // français
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'et', 'ou', 'a',
  'au', 'aux', 'en', 'est', 'ce', 'que', 'qu', 'qui', 'quoi', 'vous', 'je',
  'j', 'il', 'elle', 'on', 'pour', 'par', 'avec', 'dans', 'sur', 'y', 'ne',
  'pas', 'se', 's', 'votre', 'vos', 'mon', 'ma', 'mes', 'bonjour', 'merci',
  'excusez', 'moi', 'svp', 'plait', 'sil', 'donc', 'alors',
  // Les auxiliaires: ils portent l'accord, jamais le sujet. « vous ÊTES
  // ouverts » et « ouvert » demandent la même chose.
  'etes', 'suis', 'sommes', 'sont', 'etre', 'avez', 'avoir', 'ai', 'avons',
  'ont', 'fait', 'faire', 'faites',
  /* Les acquiescements, et c'est le seul endroit où ils comptent.
     Le seuil ci-dessous n'exige plus qu'UN mot signifiant, parce que « vous
     avez un parking ? » n'en laisse qu'un et est une vraie question. Ce sont
     donc ces mots-ci, et non le compte, qui doivent écarter « oui merci ».
     L'asymétrie tranche: une politesse mal filtrée coûte une ligne que le
     gérant écarte d'un clic, une vraie question perdue ne revient jamais. */
  'oui', 'non', 'ok', 'daccord', 'accord', 'beaucoup', 'super', 'parfait',
  'bien', 'voila', 'yes', 'no', 'okay', 'sure', 'great', 'ja', 'nee', 'goed',
  // anglais
  'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'at', 'is', 'are',
  'do', 'does', 'did', 'you', 'your', 'i', 'it', 'we', 'they', 'for', 'with',
  'can', 'could', 'would', 'please', 'hello', 'hi', 'thanks', 'thank',
  // néerlandais
  'de', 'het', 'een', 'en', 'of', 'te', 'in', 'op', 'is', 'zijn', 'u', 'ik',
  'we', 'ze', 'voor', 'met', 'kan', 'kunt', 'alstublieft', 'dank', 'hallo',
]);

/**
 * Un seul mot signifiant suffit.
 *
 * Il en fallait deux, et c'était trop: « vous avez un parking ? » n'en laisse
 * qu'un une fois l'auxiliaire et l'article retirés, et la question disparaissait
 * en silence. Ce qui écarte un accusé de réception, ce n'est pas le compte,
 * c'est la liste de mots vides ci-dessus.
 */
const MIN_MEANINGFUL_WORDS = 1;
/** Au-delà, ce n'est plus une question mais un monologue mal découpé. */
const MAX_QUESTION_CHARS = 500;

/**
 * L'empreinte d'une question: ce qui reste quand on retire la façon de la poser.
 *
 * Rendue vide quand il ne reste rien de signifiant, et l'appelant est alors
 * ignoré plutôt que rangé sous une empreinte vide qui absorberait tout.
 */
export function fingerprint(question: string): string {
  const words = normalizeUtterance(question)
    .split(' ')
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));

  if (words.length < MIN_MEANINGFUL_WORDS) return '';

  /* Trié, dédoublonné, tronqué, et borné à la longueur de la colonne.
     Le tri parce que l'ordre des mots varie d'un appelant à l'autre sans rien
     dire de la question; la troncature parce que l'accord aussi. */
  return [...new Set(words.map(stem))].sort().join(' ').slice(0, 200);
}

/**
 * La racine d'un mot, à la serpe.
 *
 * Six caractères, et c'est un compromis mesuré, pas un chiffre rond: en
 * dessous, « livraison » et « livret » se confondent; au-dessus, « ouvert » et
 * « ouverts » redeviennent deux mots. Aucun désaccord d'accord ne survit à
 * cette longueur pour les mots courants, et les mots courts, eux, sont rendus
 * intacts.
 */
function stem(word: string): string {
  return word.length <= 6 ? word : word.slice(0, 6);
}

class KnowledgeGapService {
  /**
   * Consigner une question restée sans réponse.
   *
   * Ne lève JAMAIS, et n'est jamais attendue sur le chemin d'un appel: un
   * apprentissage raté coûte une question perdue, une exception coûterait le
   * tour de parole de l'appelant.
   */
  async record(input: {
    clientId: string;
    question: string;
    language?: VoiceLanguage;
    source?: 'lookup' | 'transcript';
  }): Promise<void> {
    const question = input.question.trim().replace(/\s+/g, ' ').slice(0, MAX_QUESTION_CHARS);
    const key = fingerprint(question);
    if (!key) return;

    try {
      /* La question DÉJÀ répondue ne rouvre pas une ligne.
         Sans ce test, une entrée créée hier et que la recherche n'a pas su
         retrouver aujourd'hui redemanderait au gérant de répondre à ce qu'il a
         déjà répondu — et le portail se remplirait de son propre travail. Le
         compteur monte quand même: c'est le signal qu'une réponse existe mais
         ne se trouve pas, ce qui est un défaut de mots-clés, pas de savoir. */
      await prisma.knowledgeGap.upsert({
        where: { clientId_fingerprint: { clientId: input.clientId, fingerprint: key } },
        create: {
          clientId: input.clientId,
          question,
          fingerprint: key,
          language: input.language ?? 'fr',
          source: input.source ?? 'lookup',
        },
        update: { askedCount: { increment: 1 }, lastAskedAt: new Date() },
      });
    } catch (error) {
      logger.warn(`[KnowledgeGap] enregistrement refusé pour ${input.clientId}: ${(error as Error).message}`);
    }
  }

  /** Les questions en attente, les plus posées d'abord. */
  async open(clientId: string, limit = 20): Promise<OpenGap[]> {
    try {
      return await prisma.knowledgeGap.findMany({
        where: { clientId, status: 'open' },
        orderBy: [{ askedCount: 'desc' }, { lastAskedAt: 'desc' }],
        take: limit,
        select: { id: true, question: true, askedCount: true, lastAskedAt: true, language: true },
      });
    } catch (error) {
      logger.warn(`[KnowledgeGap] lecture refusée pour ${clientId}: ${(error as Error).message}`);
      return [];
    }
  }

  /** Combien de questions attendent une réponse. Sert au bandeau et au chat. */
  async openCount(clientId: string): Promise<number> {
    try {
      return await prisma.knowledgeGap.count({ where: { clientId, status: 'open' } });
    } catch {
      return 0;
    }
  }

  /**
   * La réponse du gérant devient une entrée de la base.
   *
   * Les mots de l'APPELANT sont conservés comme mots-clés, et c'est la moitié
   * de l'intérêt: le gérant écrit sa réponse dans ses mots à lui (« horaires
   * d'ouverture »), l'appelant suivant emploiera les siens (« ouvert le
   * dimanche »), et sans ce pont la nouvelle entrée ne serait pas retrouvée par
   * la question même qui l'a fait naître.
   *
   * Le cloisonnement passe par le `clientId` du jeton, jamais par l'identifiant
   * reçu: une écriture est refusée si la question n'appartient pas à
   * l'appelant.
   */
  async answer(input: {
    clientId: string;
    gapId: string;
    answer: string;
    title?: string;
  }): Promise<{ ok: true; entryId: string } | { ok: false; reason: string }> {
    const answer = input.answer.trim();
    if (!answer) return { ok: false, reason: 'empty_answer' };

    const gap = await prisma.knowledgeGap.findFirst({
      where: { id: input.gapId, clientId: input.clientId },
    });
    if (!gap) return { ok: false, reason: 'not_found' };
    if (gap.status === 'answered') return { ok: false, reason: 'already_answered' };

    const entry = await prisma.businessKnowledge.create({
      data: {
        clientId: input.clientId,
        kind: 'faq',
        title: (input.title?.trim() || gap.question).slice(0, 300),
        content: answer,
        keywords: gap.fingerprint.split(' ').slice(0, 12),
        /* Une entrée née d'une vraie question passe devant les présets: elle a
           été demandée, eux ont été supposés. */
        priority: Math.min(gap.askedCount, 10),
      },
    });

    await prisma.knowledgeGap.update({
      where: { id: gap.id },
      data: { status: 'answered', answeredEntryId: entry.id, answeredAt: new Date() },
    });

    /* L'embedding est calculé hors du chemin de la réponse: le gérant a
       enregistré, l'entrée est déjà servie par la recherche lexicale, et
       attendre un appel réseau pour lui rendre la main serait payer une
       amélioration au prix d'une latence. */
    void knowledgeEmbeddingsService
      .generateMissing(input.clientId)
      .catch(err => logger.warn(`[KnowledgeGap] embedding différé: ${err.message}`));

    logger.info(`[KnowledgeGap] ${input.clientId}: « ${gap.question} » répondue, entrée ${entry.id}`);
    return { ok: true, entryId: entry.id };
  }

  /** Écarter une question: elle ne revient plus, et son compteur cesse de monter. */
  async dismiss(clientId: string, gapId: string): Promise<boolean> {
    const { count } = await prisma.knowledgeGap.updateMany({
      where: { id: gapId, clientId, status: 'open' },
      data: { status: 'dismissed' },
    });
    return count > 0;
  }
}

export const knowledgeGapService = new KnowledgeGapService();
