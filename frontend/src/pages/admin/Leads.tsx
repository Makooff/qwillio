import { useState, useEffect, useCallback } from 'react';

const API = 'https://qwillio.onrender.com';
const getToken = () => localStorage.getItem('accessToken') ?? localStorage.getItem('token') ?? '';

interface Lead {
  id: string;
  createdAt: string;
  interestLevel?: number;
  score?: number;
  status?: string;
  sentiment?: string | null;
  outcome?: string | null;
  transcript?: string | null;
  // prospect sub-object (from callLog include) or direct fields
  prospect?: {
    businessName?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
    niche?: string;
    city?: string;
  } | null;
  // direct fields if response is flat prospect list
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  niche?: string;
  city?: string;
  businessName?: string;
}

function getLeadName(lead: Lead): string {
  if (lead.prospect?.businessName) return lead.prospect.businessName;
  if (lead.prospect?.company) return lead.prospect.company;
  if (lead.prospect?.firstName) return `${lead.prospect.firstName} ${lead.prospect.lastName ?? ''}`.trim();
  if (lead.businessName) return lead.businessName;
  if (lead.company) return lead.company;
  if (lead.firstName) return `${lead.firstName} ${lead.lastName ?? ''}`.trim();
  return 'Inconnu';
}

function getLeadPhone(lead: Lead): string {
  return lead.prospect?.phone ?? lead.phone ?? '—';
}

function getLeadNiche(lead: Lead): string {
  return lead.prospect?.niche ?? lead.niche ?? lead.status ?? '—';
}

function getLeadCity(lead: Lead): string {
  return lead.prospect?.city ?? lead.city ?? '—';
}

function getInterestLevel(lead: Lead): number {
  return lead.interestLevel ?? lead.score ?? 6;
}

function interestColor(level: number): string {
  if (level >= 8) return '#22c55e';
  if (level >= 6) return '#f59e0b';
  return '#94a3b8';
}

function interestLabel(level: number): string {
  if (level >= 9) return 'Très chaud';
  if (level >= 7) return 'Chaud';
  if (level >= 6) return 'Tiède';
  return 'Qualifié';
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/admin/leads`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Normalize — API may return array or {leads:[]}
      if (Array.isArray(json)) {
        setLeads(json);
      } else {
        setLeads(json.leads ?? []);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    const handler = () => fetchLeads();
    window.addEventListener('admin-refresh', handler);
    return () => window.removeEventListener('admin-refresh', handler);
  }, [fetchLeads]);

  const grouped = {
    hot: leads.filter(l => getInterestLevel(l) >= 8),
    warm: leads.filter(l => getInterestLevel(l) >= 6 && getInterestLevel(l) < 8),
  };

  const LeadCard = ({ lead }: { lead: Lead }) => {
    const level = getInterestLevel(lead);
    return (
      <div
        onClick={() => setSelected(lead)}
        style={{
          background: '#0d0d15', border: '1px solid #1e1e2e', borderRadius: '10px',
          padding: '14px', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s',
          marginBottom: '10px',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = '#7c3aed';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = '#1e1e2e';
          (e.currentTarget as HTMLDivElement).style.transform = 'none';
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '14px' }}>
            {getLeadName(lead)}
          </div>
          <span style={{
            padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
            background: interestColor(level) + '22',
            color: interestColor(level),
          }}>
            {level}/10 · {interestLabel(level)}
          </span>
        </div>
        <div style={{ color: '#64748b', fontSize: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <span>📞 {getLeadPhone(lead)}</span>
          <span>🏢 {getLeadNiche(lead)}</span>
          <span>📍 {getLeadCity(lead)}</span>
        </div>
        {lead.transcript && (
          <div style={{
            marginTop: '8px', color: '#94a3b8', fontSize: '12px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            &ldquo;{lead.transcript.slice(0, 80)}…&rdquo;
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
            Pipeline Leads
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            {leads.length} lead{leads.length !== 1 ? 's' : ''} qualifié{leads.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchLeads}
          style={{
            padding: '8px 16px', background: '#7c3aed', border: 'none',
            borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
          }}
        >
          Actualiser
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          Chargement des leads…
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

      {!loading && !error && (
        <>
          {leads.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px', color: '#64748b',
              background: '#0d0d15', borderRadius: '12px', border: '1px solid #1e1e2e',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎯</div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Aucun lead qualifié</div>
              <div style={{ fontSize: '14px' }}>Les prospects qualifiés apparaîtront ici.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px',
                  paddingBottom: '8px', borderBottom: '2px solid #22c55e44',
                }}>
                  <span style={{ fontSize: '16px' }}>🔥</span>
                  <span style={{ fontWeight: 700, color: '#22c55e' }}>Très chaud</span>
                  <span style={{ background: '#22c55e22', color: '#22c55e', borderRadius: '20px', padding: '1px 8px', fontSize: '12px', fontWeight: 700 }}>
                    {grouped.hot.length}
                  </span>
                </div>
                {grouped.hot.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '13px', padding: '16px', textAlign: 'center' }}>
                    Aucun pour l&apos;instant
                  </div>
                ) : grouped.hot.map(l => <LeadCard key={l.id} lead={l} />)}
              </div>

              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px',
                  paddingBottom: '8px', borderBottom: '2px solid #f59e0b44',
                }}>
                  <span style={{ fontSize: '16px' }}>♨️</span>
                  <span style={{ fontWeight: 700, color: '#f59e0b' }}>Chaud / Tiède</span>
                  <span style={{ background: '#f59e0b22', color: '#f59e0b', borderRadius: '20px', padding: '1px 8px', fontSize: '12px', fontWeight: 700 }}>
                    {grouped.warm.length}
                  </span>
                </div>
                {grouped.warm.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '13px', padding: '16px', textAlign: 'center' }}>
                    Aucun pour l&apos;instant
                  </div>
                ) : grouped.warm.map(l => <LeadCard key={l.id} lead={l} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          style={{
            position: 'fixed', inset: 0, background: '#00000088', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{
              background: '#0d0d15', border: '1px solid #2d2d3d', borderRadius: '16px',
              padding: '28px', maxWidth: '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ color: '#f8fafc', fontWeight: 700, fontSize: '18px' }}>
                {getLeadName(selected)}
              </h2>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '20px' }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <Row label="Téléphone" value={getLeadPhone(selected)} />
              <Row label="Secteur" value={getLeadNiche(selected)} />
              <Row label="Ville" value={getLeadCity(selected)} />
              <Row label="Intérêt" value={`${getInterestLevel(selected)}/10 — ${interestLabel(getInterestLevel(selected))}`} />
              <Row label="Sentiment" value={selected.sentiment ?? '—'} />
              <Row label="Résultat" value={selected.outcome ?? selected.status ?? '—'} />
              {selected.transcript && (
                <div>
                  <div style={{ color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Transcript</div>
                  <div style={{
                    color: '#94a3b8', background: '#1e1e2e', borderRadius: '8px',
                    padding: '12px', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap',
                  }}>
                    {selected.transcript}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ color: '#64748b', fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#e2e8f0', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
