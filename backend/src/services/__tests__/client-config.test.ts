import { describe, it, expect } from 'vitest';
import { buildVapiConfigPatch, parseFaq } from '../client-config.service';
import { CUSTOM_CHARACTER_ID } from '../../config/voice-characters';

const prev = {};

describe('buildVapiConfigPatch — items', () => {
  it('keeps a complete line', () => {
    const next = buildVapiConfigPatch(prev, {
      items: [{ category: 'restauration', name: 'Petit-déjeuner', price: '12 €' }],
    });
    expect(next.items).toHaveLength(1);
    expect(next.items[0]).toMatchObject({ name: 'Petit-déjeuner', price: '12 €' });
  });

  it('drops a line with no price', () => {
    // The receptionist reads this list aloud. A priceless entry means it
    // announces a service it cannot quote — worse than not having the entry.
    const next = buildVapiConfigPatch(prev, { items: [{ name: 'Petit-déjeuner', price: '' }] });
    expect(next.items).toEqual([]);
  });

  it('drops a line with no name', () => {
    expect(buildVapiConfigPatch(prev, { items: [{ name: '   ', price: '12 €' }] }).items).toEqual([]);
  });

  it('treats whitespace as missing', () => {
    expect(buildVapiConfigPatch(prev, { items: [{ name: 'Brunch', price: '  ' }] }).items).toEqual([]);
  });

  it('keeps the complete lines and drops only the incomplete ones', () => {
    const next = buildVapiConfigPatch(prev, {
      items: [
        { name: 'Petit-déjeuner', price: '12 €' },
        { name: 'Spa', price: '' },
        { name: 'Parking', price: '15 €' },
      ],
    });
    expect(next.items.map((i: { name: string }) => i.name)).toEqual(['Petit-déjeuner', 'Parking']);
  });

  it('defaults the category rather than dropping the line for it', () => {
    // A missing category is a labelling detail; a missing price is a promise.
    expect(buildVapiConfigPatch(prev, { items: [{ name: 'Brunch', price: '20 €' }] }).items[0].category)
      .toBe('service');
  });

  it('leaves items untouched when the patch does not mention them', () => {
    const existing = { items: [{ id: 'a', category: 'service', name: 'Spa', price: '40 €' }] };
    expect(buildVapiConfigPatch(existing, { faq: 'hello' }).items).toEqual(existing.items);
  });
});

describe('buildVapiConfigPatch — characterId', () => {
  it('persists the cloned voice selection', () => {
    // 'custom' is not in the catalog, so the catalog check alone rejected it and
    // the client's own cloned voice could never be selected from the dashboard.
    expect(buildVapiConfigPatch(prev, { characterId: CUSTOM_CHARACTER_ID }).characterId)
      .toBe(CUSTOM_CHARACTER_ID);
  });

  it('persists a catalog character', () => {
    expect(buildVapiConfigPatch(prev, { characterId: 'marie' }).characterId).toBe('marie');
  });

  it('keeps the previous selection when the id is unknown', () => {
    const existing = { characterId: 'marie' };
    expect(buildVapiConfigPatch(existing, { characterId: 'nobody' }).characterId).toBe('marie');
  });
});

describe('buildVapiConfigPatch — customVoice', () => {
  it('stores a chosen voice with a name and a date', () => {
    const next = buildVapiConfigPatch(prev, { customVoice: { voiceId: 'v_1', name: 'Grave' } });
    expect(next.customVoice).toMatchObject({ voiceId: 'v_1', name: 'Grave' });
    expect(typeof next.customVoice.createdAt).toBe('string');
  });

  it('removes the override when the voice is cleared', () => {
    // Clearing has to mean "back to the character's own voice", which is the
    // absence of the key — not a customVoice holding an empty id.
    const existing = { customVoice: { voiceId: 'v_1', name: 'Grave', createdAt: 'x' } };
    expect(buildVapiConfigPatch(existing, { customVoice: null }).customVoice).toBeUndefined();
    expect(buildVapiConfigPatch(existing, { customVoice: { voiceId: '  ' } }).customVoice).toBeUndefined();
  });

  it('keeps the original date when the same voice is re-selected', () => {
    const existing = { customVoice: { voiceId: 'v_1', name: 'Grave', createdAt: '2026-01-01T00:00:00.000Z' } };
    const next = buildVapiConfigPatch(existing, { customVoice: { voiceId: 'v_1' } });
    expect(next.customVoice.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('carries the cloned flag, which changes the tuning', () => {
    expect(buildVapiConfigPatch(prev, { customVoice: { voiceId: 'v_1', cloned: true } }).customVoice.cloned).toBe(true);
    expect(buildVapiConfigPatch(prev, { customVoice: { voiceId: 'v_1' } }).customVoice.cloned).toBeUndefined();
  });

  it('never touches the character', () => {
    // The regression this guards: choosing a voice used to move the client onto
    // a pseudo-character, losing the face, the name and the personality.
    const existing = { characterId: 'lucas' };
    expect(buildVapiConfigPatch(existing, { customVoice: { voiceId: 'v_1' } }).characterId).toBe('lucas');
  });

  it('leaves the override untouched when the patch does not mention it', () => {
    const existing = { customVoice: { voiceId: 'v_1', name: 'Grave', createdAt: 'x' } };
    expect(buildVapiConfigPatch(existing, { faq: 'hello' }).customVoice).toEqual(existing.customVoice);
  });
});

describe('parseFaq', () => {
  it('reads the shape the placeholder taught clients to type', () => {
    const entries = parseFaq('Q : Faut-il réserver ?\nR : Oui, on privilégie le rendez-vous.');
    expect(entries).toEqual([{ q: 'Faut-il réserver ?', a: 'Oui, on privilégie le rendez-vous.' }]);
  });

  it('reads several pairs, and English markers too', () => {
    const entries = parseFaq('Q: Parking?\nA: Yes, free.\n\nQuestion : Terrasse ?\nRéponse : En été.');
    expect(entries).toHaveLength(2);
    expect(entries[1]).toEqual({ q: 'Terrasse ?', a: 'En été.' });
  });

  it('keeps a multi-line answer whole', () => {
    // A client who pressed Enter inside an answer has not started a new one.
    const entries = parseFaq('Q : Horaires ?\nR : Lundi au vendredi.\nSamedi sur rendez-vous.');
    expect(entries[0].a).toBe('Lundi au vendredi.\nSamedi sur rendez-vous.');
  });

  it('keeps a question that has no answer yet', () => {
    // Dropping it would erase what the client wrote. It shows up empty, and
    // they finish it.
    expect(parseFaq('Q : Livrez-vous ?')).toEqual([{ q: 'Livrez-vous ?', a: '' }]);
  });

  it('ignores prose that is not a pair', () => {
    expect(parseFaq('Voici nos questions fréquentes.')).toEqual([]);
    expect(parseFaq('')).toEqual([]);
  });
});

describe('buildVapiConfigPatch — faqEntries and knowledge', () => {
  it('renders the text the agent reads from the entries', () => {
    // `faq` is what every downstream reader consumes. It must never be typed
    // and rendered at the same time, or the two disagree.
    const next = buildVapiConfigPatch(prev, {
      faqEntries: [{ q: 'Ouvert le dimanche ?', a: 'Non.' }],
    });
    expect(next.faq).toBe('Q : Ouvert le dimanche ?\nR : Non.');
    expect(next.faqEntries).toHaveLength(1);
  });

  it('lets the entries win over a text posted in the same call', () => {
    const next = buildVapiConfigPatch(prev, {
      faq: 'texte périmé',
      faqEntries: [{ q: 'Parking ?', a: 'Oui.' }],
    });
    expect(next.faq).toBe('Q : Parking ?\nR : Oui.');
  });

  it('drops an entry with no question', () => {
    expect(buildVapiConfigPatch(prev, { faqEntries: [{ q: '  ', a: 'Oui.' }] }).faqEntries).toEqual([]);
  });

  it('keeps only non-empty named fields, under sanitised ids', () => {
    const next = buildVapiConfigPatch(prev, {
      knowledge: { emergencyProtocol: 'Appeler le 112.', cancellationPolicy: '   ', 'bad key!': 'x' },
    });
    expect(next.knowledge).toEqual({ emergencyProtocol: 'Appeler le 112.', badkey: 'x' });
  });

  it('leaves the knowledge alone when the patch does not mention it', () => {
    const existing = { knowledge: { emergencyProtocol: 'Appeler le 112.' } };
    expect(buildVapiConfigPatch(existing, { faq: 'x' }).knowledge).toEqual(existing.knowledge);
  });
});

describe('buildVapiConfigPatch — moteur vocal', () => {
  /* Ce réglage décide de ce que l'appelant entend: parole-à-parole (le modèle
     entend et répond en audio) ou chaîne classique (transcription, modèle,
     synthèse). Il était validé ici depuis toujours, mais le contrôleur ne le
     relayait pas: le réglage existait de bout en bout SAUF au milieu, donc
     changer de moteur était impossible, même en appelant l'API à la main. */

  it('accepte les trois modes', () => {
    expect(buildVapiConfigPatch(prev, { voiceMode: 'realtime' }).voiceMode).toBe('realtime');
    expect(buildVapiConfigPatch(prev, { voiceMode: 'classic' }).voiceMode).toBe('classic');
    expect(buildVapiConfigPatch(prev, { voiceMode: 'auto' }).voiceMode).toBe('auto');
  });

  it('ramène une valeur inconnue à `auto` au lieu de l’écrire', () => {
    // Une faute de frappe ne doit pas décider en silence de ce que l'appelant
    // entend, ni faire refuser l'assistant entier par Vapi.
    expect(buildVapiConfigPatch(prev, { voiceMode: 'realtimee' as never }).voiceMode).toBe('auto');
    expect(buildVapiConfigPatch(prev, { voiceMode: '' as never }).voiceMode).toBe('auto');
  });

  it('ne touche pas au mode quand la mise à jour porte sur autre chose', () => {
    // L'auto-save de la page envoie tout son formulaire à chaque frappe: une
    // modification de la FAQ ne doit pas réinitialiser le moteur.
    const withMode = buildVapiConfigPatch(prev, { voiceMode: 'classic' });
    const after = buildVapiConfigPatch(withMode, { faqEntries: [{ q: 'Ouvert ?', a: 'Oui' }] });
    expect(after.voiceMode).toBe('classic');
  });
});
