import { describe, it, expect } from 'vitest';
import { buildVapiConfigPatch } from '../client-config.service';
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
