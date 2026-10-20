import { describe, expect, it, vi } from 'vitest';
import { loadLeadDirectory } from './leadDirectory';

describe('annuaire complet des leads et contacts', () => {
  it('charge toutes les pages de groupes ET contacts avec le véritable contrat contacts', async () => {
    const get = vi.fn(async (path: string) => {
      const u = new URL(path, 'https://fixture.test');
      const page = Number(u.searchParams.get('page'));
      if (u.pathname.includes('/crm/')) return { contacts: [{ id: `c${page}`, name: `Contact ${page}` }], pagination: { pages: 2 } };
      return { data: [{ id: `g${page}` }], pagination: { totalPages: 2 } };
    });
    const result = await loadLeadDirectory(get);
    expect(result.leads.map(l => l.id)).toEqual(['g1', 'g2']);
    expect(result.contacts.map(c => c.id)).toEqual(['c1', 'c2']);
    expect(get.mock.calls.every(([url]) => url.includes('limit=100'))).toBe(true);
  });

  it('ne masque pas les erreurs de chargement des leads derrière une liste vide', async () => {
    await expect(loadLeadDirectory(async () => { throw new Error('offline'); })).rejects.toThrow('offline');
  });

  it('garde les leads sur un forfait sans CRM sans signaler une panne', async () => {
    const result = await loadLeadDirectory(async path => {
      if (path.includes('/crm/')) throw Object.assign(new Error('capability'), { response: { status: 403 } });
      return { data: [{ id: 'call' }], pagination: { totalPages: 1 } };
    });
    expect(result.leads).toHaveLength(1);
    expect(result.contacts).toEqual([]);
    expect(result.contactsUnavailable).toBe(false);
  });

  it('signale une panne CRM sans effacer les leads ni afficher une fausse liste complète', async () => {
    const result = await loadLeadDirectory(async path => {
      if (path.includes('/crm/')) throw new Error('offline CRM');
      return { data: [{ id: 'call' }], pagination: { totalPages: 1 } };
    });
    expect(result.leads).toHaveLength(1);
    expect(result.contactsUnavailable).toBe(true);
  });

  it('transmet le filtre téléphone à chaque page serveur', async () => {
    const get = vi.fn(async (path: string) => path.includes('/crm/') ? { contacts: [] } : { data: [], pagination: { totalPages: 0 } });
    await loadLeadDirectory(get, '+32477123456');
    expect(get.mock.calls[0][0]).toContain('phone=%2B32477123456');
  });
});
