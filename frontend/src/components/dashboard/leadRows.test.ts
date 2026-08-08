import { describe, it, expect } from 'vitest';
import {
  mergeLeadsAndContacts, digits, leadStatusOf, contactStatusOf,
  type ContactLike, type LeadLike,
} from './leadRows';

const lead = (o: Partial<LeadLike> & { id: string }): LeadLike => ({ ...o });
const contact = (o: Partial<ContactLike> & { id: string; name: string }): ContactLike => ({ ...o });

describe('digits', () => {
  /* La regression que ce test tient: `+32 477…` et `0477…` sont la meme
     personne. Comparer les chiffres bruts en faisait deux lignes. */
  it('donne la meme cle aux ecritures internationale et nationale', () => {
    expect(digits('+32 477 12 34 56')).toBe(digits('0477 12.34.56'));
    expect(digits('+33 6 12 34 56 78')).toBe(digits('06 12 34 56 78'));
  });

  it('laisse les numeros courts tels quels, et tolere le vide', () => {
    expect(digits('1234')).toBe('1234');
    expect(digits(null)).toBe('');
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
    /* Une seule ligne: les deux fiches decrivent la meme personne, et les
       montrer toutes les deux reproduirait le doublon qu'on vient de fermer. */
    expect(rows).toHaveLength(1);
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
