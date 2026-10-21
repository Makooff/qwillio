import type { ContactLike, LeadLike } from '../components/dashboard/leadRows';

type DirectoryPage<T> = { data?: T[]; contacts?: T[]; pagination?: { totalPages?: number; pages?: number } };
type DirectoryGetter = (path: string) => Promise<unknown>;

/** Fetch complete grouped identities before local CRM merge, filters and pagination.
 * Never merge a global CRM directory with only one page of call identities.
 */
export async function loadLeadDirectory<L extends LeadLike = LeadLike>(get: DirectoryGetter, phone = '') {
  const readPages = async <T>(base: string, field: 'data' | 'contacts') => {
    const result: T[] = [];
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const response = await get(`${base}${base.includes('?') ? '&' : '?'}page=${page}&limit=100`) as DirectoryPage<T>;
      const rows = response[field];
      if (!Array.isArray(rows)) throw new Error('Réponse annuaire invalide');
      result.push(...rows);
      const total = response.pagination?.totalPages ?? response.pagination?.pages ?? 1;
      if (!Number.isInteger(total) || total < 0) throw new Error('Pagination annuaire invalide');
      pages = total;
    }
    return result;
  };
  const leads = await readPages<L>(`/my-dashboard/leads${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`, 'data');
  try {
    const contacts = await readPages<ContactLike>('/crm/contacts', 'contacts');
    return { leads, contacts, contactsUnavailable: false };
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    return { leads, contacts: [] as ContactLike[], contactsUnavailable: status !== 403 };
  }
}
