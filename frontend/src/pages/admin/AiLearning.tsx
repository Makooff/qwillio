import { useState, useEffect, useCallback } from 'react';

const API = 'https://qwillio.onrender.com';
const getToken = () => localStorage.getItem('accessToken') ?? localStorage.getItem('token') ?? '';

interface NicheInsight {
  id: string;
  niche: string;
  insight: string;
  callsAnalyzed?: number;
  successRate?: number | null;
  createdAt: string;
  updatedAt: string;
}

interface ScriptMutation {
  id: string;
  version?: string;
  status?: string;
  winRate?: number | null;
  callsCount?: number;
  createdAt: string;
}

export default function AiLearning() {
  const [insights, setInsights] = useState<NicheInsight[]>([]);
  const [scripts, setScripts] = useState<ScriptMutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [insightsRes, scriptsRes] = await Promise.allSettled([
        fetch(`${API}/api/admin/ai/insights`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API}/api/admin/ai/scripts`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);

      if (insightsRes.status === 'fulfilled' && insightsRes.value.ok) {
        const json = await insightsRes.value.json();
        setInsights(json.insights ?? []);
      }
      if (scriptsRes.status === 'fulfilled' && scriptsRes.value.ok) {
        const json = await scriptsRes.value.json();
        setScripts(json.scripts ?? []);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('admin-refresh', handler);
    return () => window.removeEventListener('admin-refresh', handler);
  }, [fetchData]);

  return (
    <div style={{ padding: '24px', color: '#e2e8f0' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
          AI Learning
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Apprentissages automatiques de l&apos;IA à partir des appels
        </p>
      </div>

      {/* Explainer */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0a2e, #0d0d15)',
        border: '1px solid #7c3aed44', borderRadius: '12px', padding: '20px', marginBottom: '28px',
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '28px' }}>🧠</span>
          <div>
            <div style={{ fontWeight: 700, color: '#c4b5fd', marginBottom: '6px' }}>
              Comment fonctionne l&apos;apprentissage ?
            </div>
            <div style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
              Après chaque appel, l&apos;IA analyse le transcript, détecte les objections récurrentes par secteur,
              et ajuste automatiquement le script d&apos;appel pour améliorer le taux de réussite.
              Les insights sont générés par niche et permettent d&apos;optimiser les créneaux d&apos;appel, le ton,
              et les arguments utilisés.
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

      {/* Niche Insights */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Insights par secteur
        </h2>
        {!loading && insights.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px', color: '#64748b',
            background: '#0d0d15', borderRadius: '12px', border: '1px solid #1e1e2e',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📊</div>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Aucun insight disponible</div>
            <div style={{ fontSize: '13px' }}>Les insights apparaîtront après les premiers appels analysés.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
            {insights.map(insight => (
              <div key={insight.id} style={{
                background: '#0d0d15', border: '1px solid #1e1e2e', borderRadius: '10px', padding: '16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 700, color: '#c4b5fd', fontSize: '14px', textTransform: 'capitalize' }}>
                    {insight.niche}
                  </span>
                  {insight.callsAnalyzed != null && (
                    <span style={{ color: '#64748b', fontSize: '12px' }}>
                      {insight.callsAnalyzed} appels analysés
                    </span>
                  )}
                </div>
                <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
                  {insight.insight}
                </p>
                {insight.successRate != null && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: insight.successRate >= 50 ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                    Taux de succès : {Math.round(insight.successRate)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Script Mutations */}
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Évolutions du script d&apos;appel
        </h2>
        {!loading && scripts.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px', color: '#64748b',
            background: '#0d0d15', borderRadius: '12px', border: '1px solid #1e1e2e',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>✍️</div>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Aucune mutation de script</div>
            <div style={{ fontSize: '13px' }}>L&apos;IA génèrera des variantes de script après l&apos;analyse des appels.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {scripts.map(script => (
              <div key={script.id} style={{
                background: '#0d0d15', border: '1px solid #1e1e2e', borderRadius: '10px', padding: '14px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
              }}>
                <div>
                  <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '14px' }}>
                    {script.version ? `v${script.version}` : script.id.slice(0, 8)}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '10px' }}>
                    {script.callsCount != null ? `${script.callsCount} appels · ` : ''}{new Date(script.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {script.winRate != null && (
                    <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '14px' }}>
                      {Math.round(script.winRate)}% win rate
                    </span>
                  )}
                  {script.status && (
                    <span style={{
                      padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                      background: script.status === 'active' ? '#22c55e22' : '#1e1e2e',
                      color: script.status === 'active' ? '#22c55e' : '#94a3b8',
                    }}>
                      {script.status === 'active' ? 'Actif' : script.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
