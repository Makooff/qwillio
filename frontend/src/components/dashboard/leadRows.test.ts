import { describe, it, expect } from 'vitest';
import {
  mergeLeadsAndContacts, phoneMatches, leadStatusOf, contactStatusOf,
  type ContactLike, type LeadLike,
} from './leadRows';

const lead = (o: Partial<LeadLike> & { id: string }): LeadLike => ({ ...o });
const contact = (o: Partial<ContactLike> & { id: string; name: string }): ContactLike => ({ ...o });

describe('phoneMatches', () => {
  /* Le cœur du correctif: couper les neuf derniers chiffras confondait un
     numéro belge et un numéro français qui se terminent pareil. La clé porte
     désormais le pays; deux pays distincts ne fusionnent JAMAIS. */
  it('ne confond jamais deux pays qui partagent leurs neuf derniers chiffres', () => {
    expect(phoneMatches('+32 477 12 34 56', '+33 477 12 34 56')).toBe(false);
    expect(phoneMatches('+33 477 12 34 56', '+32 477 12 34 56')).toBe(false);
  });

  it('apparie l’écriture internationale et l’écriture nationale', () => {
    expect(phoneMatches('+32 477 12 34 56', '0477 12.34.56')).toBe(true);
    expect(phoneMatches('+33 6 12 34 56 78', '06 12 34 56 78')).toBe(true);
    expect(phoneMatches('0477 12 34 56', '+32 477 12 34 56')).toBe(true);
  });

  it('un numéro national trouve son pays dans les données (pas un autre pays)', () => {
    /* Le dataset contient la forme +33 de ce numéro: l'écriture nationale
       adoptée est FR, et ne matche donc pas un +32 qui partagerait ses
       derniers chiffres. */
    const rows = mergeLeadsAndContacts(
      [lead({ id: 'fr', callerNumber: '+33 477 12 34 56' })],
      [contact({ id: 'c', name: 'Nat', phone: '0477 12 34 56' })],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].contactId).toBe('c');
  });

  it('refuse les numéros courts comme preuve d’identité', () => {
    expect(phoneMatches('1234', '1234')).toBe(false);
    expect(phoneMatches('1234', '1235')).toBe(false);
  });

  it('un numéro vide ne matche rien — jamais de regroupement anonyme', () => {
    expect(phoneMatches(null, '')).toBe(false);
    expect(phoneMatches(undefined, '0477123456')).toBe(false);
    expect(phoneMatches('', '')).toBe(false);
  });
});

describe('mergeLeadsAndContacts', () => {
  /* Le cœur de la fusion: la même personne, écrite deux fois, ne doit
     apparaître qu'une. C'est ce qui justifiait de fermer la page Contacts. */
  it('n’affiche qu’une ligne quand un lead et une fiche partagent le numéro', () => {
    const rows = mergeLeadsAndContacts(
      [lead({ id: 'a', callerName: 'Marie', callerNumber: '+32 477 12 34 56' })],
      [contact({ id: 'c1', name: 'Marie Dupont', phone: '0477123456', tags: ['vip'] })],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].contactId).toBe('c1');
    // La fiche apporte ce que l'appel n'a pas: ses étiquettes.
    expect(rows[0].tags).toEqual(['vip']);
  });

  it('garde les fiches qui n’ont aucun appel', () => {
    const rows = mergeLeadsAndContacts(
      [lead({ id: 'a', callerNumber: '0477123456' })],
      [contact({ id: 'c2', name: 'Sans appel', phone: '0499999999' })],
    );
    expect(rows).toHaveLength(2);
    const orphan = rows.find(r => r.contactId === 'c2')!;
    expect(orphan.lead).toBeNull();
    expect(orphan.name).toBe('Sans appel');
  });

  /* Un identifiant de contact et un identifiant d'appel sont deux uuid: sans
     préfixe, une clé React pourrait recycler une ligne pour une autre
     personne. */
  it('ne fabrique jamais deux lignes avec la même clé', () => {
    const rows = mergeLeadsAndContacts(
      [lead({ id: 'same', callerNumber: '0400000000' })],
      [contact({ id: 'same', name: 'Homonyme', phone: '0411111111' })],
    );
    expect(new Set(rows.map(r => r.id)).size).toBe(rows.length);
  });

  it('retombe sur la fiche quand l’appel n’a pas de nom', () => {
    const rows = mergeLeadsAndContacts(
      [lead({ id: 'a', callerNumber: '0477123456' })],
      [contact({ id: 'c1', name: 'Marie', phone: '+32477123456', email: 'm@x.be' })],
    );
    expect(rows[0].name).toBe('Marie');
    expect(rows[0].email).toBe('m@x.be');
  });

  it('ne perd pas un lead sans téléphone', () => {
    const rows = mergeLeadsAndContacts([lead({ id: 'a', callerName: 'Anonyme' })], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Anonyme');
  });

  it('garde une fiche sans téléphone, qui ne peut s’apparier à rien', () => {
    const rows = mergeLeadsAndContacts([], [contact({ id: 'c', name: 'Email seul', email: 'a@b.c' })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].contactId).toBe('c');
  });

  /* Deux fiches sur un même numéro sont un doublon que le backend n'a pas vu.
     Prendre toujours la première évite que la liste bouge d'un rechargement à
     l'autre. */
  it('est stable face à deux fiches sur le même numéro', () => {
    const contacts = [
      contact({ id: 'c1', name: 'Premier', phone: '0477123456' }),
      contact({ id: 'c2', name: 'Second', phone: '0477123456' }),
    ];
    const rows = mergeLeadsAndContacts([lead({ id: 'a', callerNumber: '0477123456' })], contacts);
    expect(rows[0].contactId).toBe('c1');
    expect(rows).toHaveLength(1);
  });

  /* Le bug rapporté: trois appels du MÊME numéro (tests d'orthographe) donnaient
     trois lignes avec trois noms différents. Une personne = une ligne. */
  it('3 appels même numéro, noms différents → 1 ligne, représentant = dernier appel', () => {
    const mk = () => [
      lead({ id: 'a1', callerName: 'Zz Test', callerNumber: '+32 477 12 34 56', createdAt: '2026-10-01T10:00:00Z' }),
      lead({ id: 'a2', callerName: 'Test Deux', callerNumber: '0477 12 34 56', createdAt: '2026-10-03T10:00:00Z' }),
      lead({ id: 'a3', callerName: 'Troisieme', callerNumber: '+32477123456', createdAt: '2026-10-02T10:00:00Z' }),
    ];
    const forward = mergeLeadsAndContacts(mk(), []);
    const shuffled = mergeLeadsAndContacts([mk()[2], mk()[0], mk()[1]], []);
    // Indépendant de l'ordre d'entrée: même résultat, représentant = le plus récent.
    expect(forward).toEqual(shuffled);
    expect(forward).toHaveLength(1);
    expect(forward[0].id).toBe('a2');
    expect(forward[0].name).toBe('Test Deux');
  });

  it('expose tout l’historique: callIds et callCount', () => {
    const rows = mergeLeadsAndContacts([
      lead({ id: 'a1', callerNumber: '0477123456', createdAt: '2026-10-01T10:00:00Z' }),
      lead({ id: 'a2', callerNumber: '+32 477 12 34 56', createdAt: '2026-10-02T10:00:00Z' }),
    ], []);
    expect(rows[0].callCount).toBe(2);
    expect(rows[0].callIds).toContain('a1');
    expect(rows[0].callIds).toContain('a2');
    expect(rows[0].callIds![0]).toBe('a2'); // récent d'abord
  });

  it('le nom de la fiche CRM prime sur le nom d’appel périmé', () => {
    const rows = mergeLeadsAndContacts(
      [lead({ id: 'a', callerName: 'Zz Test', callerNumber: '0477123456', createdAt: '2026-10-01T10:00:00Z' })],
      [contact({ id: 'c', name: 'Marie Dupont', phone: '+32 477 12 34 56' })],
    );
    expect(rows[0].name).toBe('Marie Dupont');
  });

  it('union des tags de l’appel et de la fiche', () => {
    const rows = mergeLeadsAndContacts(
      [lead({ id: 'a', callerNumber: '0477123456', tags: ['urgent'] })],
      [contact({ id: 'c', name: 'M', phone: '0477123456', tags: ['vip'] })],
    );
    expect(rows[0].tags).toEqual(expect.arrayContaining(['urgent', 'vip']));
  });

  it('le statut manuel de la fiche prime; sinon celui du lead', () => {
    const withManual = mergeLeadsAndContacts(
      [lead({ id: 'a', callerNumber: '0477123456', leadStatus: 'new' })],
      [contact({ id: 'c', name: 'M', phone: '0477123456', status: 'client' })],
    );
    expect(withManual[0].status).toBe('converted');
    const withoutManual = mergeLeadsAndContacts(
      [lead({ id: 'a', callerNumber: '0477123456', leadStatus: 'contacted' })],
      [contact({ id: 'c', name: 'M', phone: '0477123456', status: 'prospect' })],
    );
    expect(withoutManual[0].status).toBe('contacted');
  });

  it('sans numéro fiable, deux leads anonymes restent deux lignes', () => {
    const rows = mergeLeadsAndContacts(
      [lead({ id: 'a', callerName: 'Anonyme' }), lead({ id: 'b', callerName: 'Inconnu' })],
      [],
    );
    expect(rows).toHaveLength(2);
  });
});

describe('contrat des groupes serveur', () => {
  it('présente le rappel dicté sans dédoubler le contact lié sur un autre numéro', () => {
    const rows = mergeLeadsAndContacts([{
      id: 'call', identityKey: 'phone:+32477123456', callerNumber: '+32477123456', phoneCollected: '+33612345678', contactId: 'callback-contact',
    }], [contact({ id: 'callback-contact', name: 'Marie', phone: '+33612345678' })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBe('+33612345678');
    expect(rows[0].lead?.callerNumber).toBe('+32477123456');
  });
  it('préserve le compte et tous les identifiants du groupe déjà paginé', () => {
    const rows = mergeLeadsAndContacts([{
      id: 'last', callerNumber: '+32477123456', identityKey: 'phone:+32477123456',
      callIds: ['first', 'middle', 'last'], callCount: 3, leadStatus: 'lost',
      contactId: 'known', createdAt: '2026-10-03T10:00:00Z',
    }], []);
    expect(rows[0].callCount).toBe(3);
    expect(rows[0].callIds).toEqual(['first', 'middle', 'last']);
    expect(rows[0].contactId).toBe('known');
    expect(rows[0].status).toBe('lost');
  });

  it('une identité anonyme du serveur ne se regroupe pas par numéro douteux', () => {
    const rows = mergeLeadsAndContacts([
      { id: 'one', identityKey: 'anon:one', callerNumber: 'unknown1234' },
      { id: 'two', identityKey: 'anon:two', callerNumber: 'unknown1234' },
    ], []);
    expect(rows).toHaveLength(2);
  });

  it('ne donne pas un score ancien au groupe dont le score est inconnu', () => {
    const rows = mergeLeadsAndContacts([
      { id: 'one', identityKey: 'phone:+32477123456', callerNumber: '+32477123456', leadScore: null },
    ], [contact({ id: 'contact', name: 'Nom connu', phone: '+32477123456', leadScore: 9 })]);
    expect(rows[0].score).toBeNull();
  });
});

describe('les deux échelles d’état', () => {
  it('lit l’état d’un lead dans sa colonne, sinon dans ses étiquettes', () => {
    expect(leadStatusOf({ id: 'a', leadStatus: 'converted' })).toBe('converted');
    expect(leadStatusOf({ id: 'a', tags: ['contacted'] })).toBe('contacted');
    expect(leadStatusOf({ id: 'a' })).toBe('new');
  });

  it('traduit le vocabulaire du CRM vers celui des leads', () => {
    expect(contactStatusOf('client')).toBe('converted');
    expect(contactStatusOf('lost')).toBe('lost');
    expect(contactStatusOf('active')).toBe('contacted');
    expect(contactStatusOf('prospect')).toBe('new');
    expect(contactStatusOf(undefined)).toBe('new');
  });
});
