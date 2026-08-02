import { describe, it, expect } from 'vitest';
import { buildVapiConfigPatch } from '../client-config.service';

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
