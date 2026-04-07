import { useState, useEffect, useCallback } from 'react';

const API = 'https://qwillio.onrender.com';
const getToken = () => localStorage.getItem('accessToken') ?? localStorage.getItem('token') ?? '';

interface AiDecision {
  id: string;
  type: string;
  context?: string | null;
  decision: string;
  reasoning?: string | null;
  outcome?: string | null;
  createdAt: string;
}

const typeColors: Record<string, string> = {
  script_mutation: '#8b5cf6',
  skip_prospect: '#f59e0b',
  call_timing: '#3b82f6',
  objection_handling: '#22c55e',
  retry_decision: '#ec4899',
};

export default function AiDecisions() {
  const [decisions, setDecisions] = useState<AiDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchDecisions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/admin/ai/decisions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDecisions(json.decisions ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDecisions(); }, [fetchDecisions]);

  useEffect(() => {
    const handler = () => fetchDecisions();
    window.addEventListener('admin-refresh', handler);
    return () => window.removeEventListener('admin-refresh', handler);
  }, [fetchDecisions]);

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
          AI Decisions
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Journal des décisions autonomes prises par l&apos;IA
        </p>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #0a1a2e, #0d0d15)',
        border: '1px solid #3b82f644', borderRadius: '12px', padding: '20px', marginBottom: '28px',
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '28px' }}>⚡</span>
          <div>
            <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: '6px' }}>
              Décisions autonomes
            </div>
            <div style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
              L&apos;IA prend des décisions en temps réel : sauter un prospect mal ciblé,
              modifier son script après un refus récurrent, choisir le meilleur créneau d&apos;appel,
              ou décider d&apos;un rappel. Chaque décision est enregistrée ici pour audit et transparence.
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Chargement…</div>
      )}

      {error && (
        <div style={{ background: '#1a0a0a', border: '1px solid #ef4444', borderRadius: '8px', padding: '16px', color: '#ef4444', marginBottom: '16px' }}>
          Erreur : {error}
        </div>
      )}

      {!loading && decisions.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px', color: '#64748b',
          background: '#0d0d15', borderRadius: '12px', border: '1px solid #1e1e2e',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤖</div>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Aucune décision enregistrée</div>
          <div style={{ fontSize: '14px' }}>Les décisions de l&apos;IA apparaîtront ici au fur et à mesure des appels.</div>
        </div>
      )}

      {!loading && decisions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {decisions.map(d => (
            <div
              key={d.id}
              style={{
                background: '#0d0d15', border: '1px solid #1e1e2e', borderRadius: '10px',
                overflow: 'hidden', transition: 'border-color 0.15s',
              }}
            >
              <div
                onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                style={{
                  padding: '14px 16px', cursor: 'pointer', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                    background: (typeColors[d.type] ?? '#6b7280') + '22',
                    color: typeColors[d.type] ?? '#6b7280',
                    whiteSpace: 'nowrap',
                  }}>
                    {d.type.replace(/_/g, ' ')}
                  </span>
                  <span style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.decision}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>
                    {new Date(d.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>{expanded === d.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expanded === d.id && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #1e1e2e', paddingTop: '14px' }}>
                  {d.reasoning && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>RAISONNEMENT</div>
                      <div style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.6' }}>{d.reasoning}</div>
                    </div>
                  )}
                  {d.context && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>CONTEXTE</div>
                      <div style={{ color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace', background: '#1e1e2e', padding: '8px', borderRadius: '6px' }}>
                        {d.context}
                      </div>
                    </div>
                  )}
                  {d.outcome && (
                    <div>
                      <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>RÉSULTAT</div>
                      <div style={{ color: '#94a3b8', fontSize: '13px' }}>{d.outcome}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
