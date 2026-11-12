import { prisma } from '../config/database';

/**
 * Notes datees du fondateur sur un prospect, et l'issue de son dernier appel.
 *
 * L'issue est une LISTE FERMEE et non le `status` libre que `PUT /prospects/:id`
 * accepte tel quel: ces valeurs pilotent la composeuse automatique, qui ne
 * reprend que les prospects en `new`. Laisser le navigateur ecrire n'importe
 * quelle chaine, c'est pouvoir renvoyer par erreur un prospect qui a dit non
 * dans la file des appels automatiques.
 */

export const NOTE_MAX_CHARS = 5000;

/** Ce que le fondateur peut dire d'un appel qu'il vient de passer. */
export const CALL_OUTCOMES = ['contacted', 'callback', 'hot_lead', 'rejected'] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export function isCallOutcome(v: unknown): v is CallOutcome {
  return typeof v === 'string' && (CALL_OUTCOMES as readonly string[]).includes(v);
}

/** Texte d'une note, ou null s'il est vide ou trop long. */
export function cleanNoteBody(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const body = v.trim();
  if (!body || body.length > NOTE_MAX_CHARS) return null;
  return body;
}

const noteSelect = { id: true, body: true, createdAt: true, updatedAt: true } as const;

export const prospectNotesService = {
  async list(prospectId: string) {
    const exists = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { id: true } });
    if (!exists) return null;
    return prisma.prospectNote.findMany({
      where: { prospectId },
      orderBy: { createdAt: 'desc' },
      select: noteSelect,
    });
  },

  async add(prospectId: string, body: string) {
    const exists = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { id: true } });
    if (!exists) return null;
    return prisma.prospectNote.create({ data: { prospectId, body }, select: noteSelect });
  },

  async update(noteId: string, body: string) {
    const exists = await prisma.prospectNote.findUnique({ where: { id: noteId }, select: { id: true } });
    if (!exists) return null;
    return prisma.prospectNote.update({ where: { id: noteId }, data: { body }, select: noteSelect });
  },

  async remove(noteId: string) {
    const { count } = await prisma.prospectNote.deleteMany({ where: { id: noteId } });
    return count > 0;
  },

  /**
   * Pose l'issue d'un appel. Un client converti ne redescend jamais: c'est le
   * meme principe que `markContacted`, qui ne fait jamais reculer un prospect.
   * Poser une issue vaut aussi « appele »: le prospect entre dans « Mes
   * prospects » meme si l'appel a ete passe depuis un autre telephone.
   */
  async setOutcome(prospectId: string, outcome: CallOutcome) {
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { id: true, status: true, lastContactDate: true },
    });
    if (!prospect) return { ok: false as const, status: 404, error: 'not_found' };
    if (prospect.status === 'converted') {
      return { ok: false as const, status: 409, error: 'already_converted' };
    }
    const updated = await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        status: outcome,
        ...(prospect.lastContactDate ? {} : { lastContactDate: new Date() }),
      },
      select: { id: true, status: true, lastContactDate: true },
    });
    return { ok: true as const, prospect: updated };
  },
};
