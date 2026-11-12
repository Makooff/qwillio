import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Notes du fondateur et issue d'appel. Deux choses figees ici: l'issue est une
 * liste fermee (le statut libre renverrait un « non » dans la file de la
 * composeuse automatique, qui ne lit que `new`), et un client converti ne
 * redescend jamais.
 */
const { prospectFindUnique, prospectUpdate, noteFindUnique, noteCreate, noteUpdate, noteDeleteMany, noteFindMany } =
  vi.hoisted(() => ({
    prospectFindUnique: vi.fn(),
    prospectUpdate: vi.fn(),
    noteFindUnique: vi.fn(),
    noteCreate: vi.fn(),
    noteUpdate: vi.fn(),
    noteDeleteMany: vi.fn(),
    noteFindMany: vi.fn(),
  }));

vi.mock('../../config/database', () => ({
  prisma: {
    prospect: { findUnique: prospectFindUnique, update: prospectUpdate },
    prospectNote: {
      findUnique: noteFindUnique, create: noteCreate, update: noteUpdate,
      deleteMany: noteDeleteMany, findMany: noteFindMany,
    },
  },
}));

import {
  prospectNotesService, cleanNoteBody, isCallOutcome, NOTE_MAX_CHARS,
} from '../prospect-notes.service';

beforeEach(() => vi.clearAllMocks());

describe('cleanNoteBody', () => {
  it('garde le texte, sans les blancs autour', () => {
    expect(cleanNoteBody('  Rappeler mardi  ')).toBe('Rappeler mardi');
  });
  it('refuse le vide, le non-texte et le trop long', () => {
    expect(cleanNoteBody('   ')).toBeNull();
    expect(cleanNoteBody(42)).toBeNull();
    expect(cleanNoteBody(undefined)).toBeNull();
    expect(cleanNoteBody('x'.repeat(NOTE_MAX_CHARS + 1))).toBeNull();
    expect(cleanNoteBody('x'.repeat(NOTE_MAX_CHARS))).toHaveLength(NOTE_MAX_CHARS);
  });
});

describe('isCallOutcome', () => {
  it('accepte les quatre issues', () => {
    for (const o of ['contacted', 'callback', 'hot_lead', 'rejected']) expect(isCallOutcome(o)).toBe(true);
  });
  it('refuse new (renverrait dans la file automatique) et converted (passe par la conversion)', () => {
    expect(isCallOutcome('new')).toBe(false);
    expect(isCallOutcome('converted')).toBe(false);
    expect(isCallOutcome('')).toBe(false);
  });
});

describe('prospectNotesService', () => {
  it('ajoute une note a un prospect existant', async () => {
    prospectFindUnique.mockResolvedValue({ id: 'p1' });
    noteCreate.mockResolvedValue({ id: 'n1', body: 'ok' });
    await expect(prospectNotesService.add('p1', 'ok')).resolves.toEqual({ id: 'n1', body: 'ok' });
    expect(noteCreate).toHaveBeenCalledWith(expect.objectContaining({ data: { prospectId: 'p1', body: 'ok' } }));
  });

  it('ne cree rien pour un prospect inconnu', async () => {
    prospectFindUnique.mockResolvedValue(null);
    await expect(prospectNotesService.add('nope', 'ok')).resolves.toBeNull();
    expect(noteCreate).not.toHaveBeenCalled();
  });

  it('pose l\'issue et date le premier contact', async () => {
    prospectFindUnique.mockResolvedValue({ id: 'p1', status: 'new', lastContactDate: null });
    prospectUpdate.mockResolvedValue({ id: 'p1', status: 'callback' });
    const r = await prospectNotesService.setOutcome('p1', 'callback');
    expect(r.ok).toBe(true);
    const data = prospectUpdate.mock.calls[0][0].data;
    expect(data.status).toBe('callback');
    expect(data.lastContactDate).toBeInstanceOf(Date);
  });

  it('ne reecrit pas la date d\'un prospect deja appele', async () => {
    prospectFindUnique.mockResolvedValue({ id: 'p1', status: 'contacted', lastContactDate: new Date('2026-11-01') });
    prospectUpdate.mockResolvedValue({ id: 'p1', status: 'hot_lead' });
    await prospectNotesService.setOutcome('p1', 'hot_lead');
    expect(prospectUpdate.mock.calls[0][0].data).toEqual({ status: 'hot_lead' });
  });

  it('ne fait jamais redescendre un client converti', async () => {
    prospectFindUnique.mockResolvedValue({ id: 'p1', status: 'converted', lastContactDate: new Date() });
    const r = await prospectNotesService.setOutcome('p1', 'rejected');
    expect(r).toEqual({ ok: false, status: 409, error: 'already_converted' });
    expect(prospectUpdate).not.toHaveBeenCalled();
  });
});
