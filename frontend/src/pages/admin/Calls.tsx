import { useState, useEffect, useCallback } from 'react';

const API = 'https://qwillio.onrender.com';
const getToken = () => localStorage.getItem('accessToken') ?? localStorage.getItem('token') ?? '';

interface CallRecord {
  id: string;
  createdAt: string;
  duration: number | null;
  outcome: string | null;
  interestLevel: number | null;
  sentiment: string | null;
  prospect: {
    businessName: string;
    phone: string;
    niche: string;
  } | null;
}

interface CallsData {
  calls: CallRecord[];
  total: number;
  page: number;
  totalPages: number;
}

const outcomeColors: Record<string, string> = {
  answered: '#22c55e',
  voicemail: '#f59e0b',
  failed: '#ef4444',
  no_answer: '#6b7280',
  transferred: '#8b5cf6',
};

const outcomeLabels: Record<string, string> = {
  answered: 'Répondu',
  voicemail: 'Messagerie',
  failed: 'Échoué',
  no_answer: 'Sans réponse',
  transferred: 'Transféré',
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Calls() {
  const [data, setData] = useState<CallsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [page, setPage] = useState(1);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (search) params.set('search', search);
      if (outcome) params.set('outcome', outcome);
      const res = await fetch(`${API}/api/admin/calls?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Normalize response — API may return array or {calls:[]}
      if (Array.isArray(json)) {
        setData({ calls: json, total: json.length, page: 1, totalPages: 1 });
      } else {
        setData(json);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [page, search, outcome]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    const handler = () => fetchCalls();
    window.addEventListener('admin-refresh', handler);
    return () => window.removeEventListener('admin-refresh', handler);
  }, [fetchCalls]);

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
          Historique des appels
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          {data ? `${data.total} appel${data.total !== 1 ? 's' : ''} au total` : 'Chargement…'}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Rechercher un prospect…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{
            flex: 1, minWidth: '200px', padding: '8px 12px',
            background: '#1e1e2e', border: '1px solid #2d2d3d', borderRadius: '8px',
            color: '#e2e8f0', fontSize: '14px', outline: 'none',
          }}
        />
        <select
          value={outcome}
          onChange={e => { setOutcome(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px', background: '#1e1e2e', border: '1px solid #2d2d3d',
            borderRadius: '8px', color: '#e2e8f0', fontSize: '14px', outline: 'none',
          }}
        >
          <option value="">Tous les résultats</option>
          {Object.entries(outcomeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button
          onClick={fetchCalls}
          style={{
            padding: '8px 16px', background: '#7c3aed', border: 'none', borderRadius: '8px',
            color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
          }}
        >
          Actualiser
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          Chargement des appels…
        </div>
      )}

      {error && (
        <div style={{
          background: '#1a0a0a', border: '1px solid #ef4444', borderRadius: '8px',
          padding: '16px', color: '#ef4444', marginBottom: '16px',
        }}>
          Erreur : {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {data.calls.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px', color: '#64748b',
              background: '#0d0d15', borderRadius: '12px', border: '1px solid #1e1e2e',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📞</div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Aucun appel trouvé</div>
              <div style={{ fontSize: '14px' }}>Les appels effectués par le bot apparaîtront ici.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e1e2e' }}>
                    {['Prospect', 'Téléphone', 'Date', 'Durée', 'Résultat', 'Intérêt', 'Sentiment'].map(h => (
                      <th key={h} style={{
                        padding: '10px 12px', textAlign: 'left', color: '#64748b',
                        fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.calls.map(call => (
                    <tr
                      key={call.id}
                      style={{ borderBottom: '1px solid #0d0d15', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1a1a2e')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px', fontWeight: 500, color: '#f8fafc' }}>
                        {(call.prospect as any)?.businessName ?? (call.prospect as any)?.company ?? (call.prospect as any)?.firstName ?? '—'}
                      </td>
                      <td style={{ padding: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {call.prospect?.phone ?? '—'}
                      </td>
                      <td style={{ padding: '12px', color: '#94a3b8' }}>
                        {formatDate(call.createdAt)}
                      </td>
                      <td style={{ padding: '12px', color: '#94a3b8' }}>
                        {formatDuration(call.duration)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {call.outcome ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '3px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                            background: (outcomeColors[call.outcome] ?? '#6b7280') + '22',
                            color: outcomeColors[call.outcome] ?? '#6b7280',
                          }}>
                            {outcomeLabels[call.outcome] ?? call.outcome}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {call.interestLevel != null ? (
                          <span style={{
                            fontWeight: 700,
                            color: call.interestLevel >= 7 ? '#22c55e' : call.interestLevel >= 4 ? '#f59e0b' : '#ef4444',
                          }}>
                            {call.interestLevel}/10
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px', color: '#94a3b8', textTransform: 'capitalize' }}>
                        {call.sentiment ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                style={{
                  padding: '6px 14px', background: page <= 1 ? '#1e1e2e' : '#2d2d3d',
                  border: 'none', borderRadius: '6px', color: page <= 1 ? '#64748b' : '#e2e8f0',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ← Précédent
              </button>
              <span style={{ padding: '6px 14px', color: '#94a3b8', fontSize: '14px' }}>
                Page {page} / {data.totalPages}
              </span>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{
                  padding: '6px 14px', background: page >= data.totalPages ? '#1e1e2e' : '#2d2d3d',
                  border: 'none', borderRadius: '6px',
                  color: page >= data.totalPages ? '#64748b' : '#e2e8f0',
                  cursor: page >= data.totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
