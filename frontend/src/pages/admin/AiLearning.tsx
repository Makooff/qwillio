import { useEffect, useState } from 'react';
import api from '../../services/api';
import { RefreshCw, Brain, Clock, BarChart3, Trash2, Edit3 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import OrbsLoader from '../../components/OrbsLoader';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, IconBtn, Pill,
} from '../../components/pro/ProBlocks';

type PillColor = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

const confidenceColor = (rate: number): PillColor => {
  if (rate >= 70) return 'ok';
  if (rate >= 40) return 'warn';
  return 'bad';
};

const statusColor = (s?: string): PillColor => {
  const v = (s || '').toLowerCase();
  if (v === 'active' || v === 'running' || v === 'live') return 'ok';
  if (v === 'paused' || v === 'pending') return 'warn';
  if (v === 'failed' || v === 'error' || v === 'reverted') return 'bad';
  return 'neutral';
};

export default function AiLearning() {
  const [stats, setStats] = useState<any>(null);
  const [mutations, setMutations] = useState<any[]>([]);
  const [abTests, setAbTests] = useState<any[]>([]);
  const [bestTimes, setBestTimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mutations' | 'abtests' | 'besttimes'>('mutations');
  const { toasts, add: _toast, remove } = useToast();
  void _toast;

  const load = async () => {
    setLoading(true);
    const [s, m, a, b] = await Promise.all([
      api.get('/ai/stats').catch(() => null),
      api.get('/ai/mutations?limit=50').catch(() => null),
      api.get('/ai/ab-tests').catch(() => null),
      api.get('/ai/best-times').catch(() => null),
    ]);
    if (s?.data) setStats(s.data);
    if (m?.data) setMutations(Array.isArray(m.data.data) ? m.data.data : (Array.isArray(m.data) ? m.data : []));
    if (a?.data) setAbTests(Array.isArray(a.data.data) ? a.data.data : (Array.isArray(a.data) ? a.data : []));
    if (b?.data) setBestTimes(Array.isArray(b.data.data) ? b.data.data : (Array.isArray(b.data) ? b.data : []));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const TABS = [
    { id: 'mutations', label: 'Mutations de script', count: mutations.length },
    { id: 'abtests', label: 'Tests A/B', count: abTests.length },
    { id: 'besttimes', label: 'Meilleurs horaires', count: bestTimes.length },
  ] as const;

  const lastTrained = stats?.lastTrainedAt ?? stats?.lastUpdatedAt ?? stats?.updatedAt;
  const accuracy = stats?.avgSuccessRate ?? stats?.accuracy;

  if (loading && !stats && mutations.length === 0 && abTests.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <OrbsLoader size={120} fullscreen={false} />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="IA — Apprentissage"
        subtitle="Optimisation automatique des scripts et horaires"
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </IconBtn>
        }
      />

      {/* KPI Grid */}
      <section>
        <SectionHead title="Aperçu" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label="Modèles / mutations"
            value={stats?.totalMutations ?? mutations.length}
            hint="Total cumulé"
          />
          <Stat
            label="Échantillons"
            value={stats?.totalSamples ?? stats?.totalCalls ?? abTests.length}
            hint="Données d'entraînement"
          />
          <Stat
            label="Dernier entraînement"
            value={lastTrained ? fmtDate(lastTrained) : '—'}
            hint="Mise à jour du modèle"
          />
          <Stat
            label="Précision moyenne"
            value={accuracy != null ? `${Number(accuracy).toFixed(1)}%` : '—'}
            hint="Taux de succès"
          />
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: `1px solid ${pro.border}` }}>
        {TABS.map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className="px-4 py-2.5 text-[12.5px] font-medium transition-colors border-b-2 -mb-px"
            style={{
              color: tab === tb.id ? pro.text : pro.textSec,
              borderBottomColor: tab === tb.id ? pro.borderHi : 'transparent',
            }}
          >
            {tb.label}
            {tb.count > 0 && (
              <span
                className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                style={{ background: 'rgba(255,255,255,0.05)', color: pro.textSec }}
              >
                {tb.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Mutations */}
      {tab === 'mutations' && (
        <section>
          <SectionHead title="Règles apprises" />
          <Card>
            {mutations.length === 0 ? (
              <div className="p-12 text-center" style={{ color: pro.textTer }}>
                <Brain className="w-7 h-7 mx-auto mb-3" />
                <p className="text-[13px]">Aucune mutation</p>
              </div>
            ) : (
              mutations.map((m: any, i: number) => {
                const rate = Number(m.successRate ?? 0);
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                    style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      <Brain size={14} style={{ color: pro.text }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Pill color="info">{m.type ?? 'script'}</Pill>
                        <Pill color={statusColor(m.status)}>{m.status ?? 'active'}</Pill>
                        {m.blocked && <Pill color="bad">bloqué</Pill>}
                      </div>
                      <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                        {m.niche ?? '—'}
                      </p>
                      <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                        Créée le {fmtDate(m.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Pill color={confidenceColor(rate)}>{rate.toFixed(1)}%</Pill>
                      <IconBtn title="Éditer">
                        <Edit3 className="w-4 h-4" />
                      </IconBtn>
                      <IconBtn title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </IconBtn>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </section>
      )}

      {/* A/B Tests */}
      {tab === 'abtests' && (
        <section>
          <SectionHead title="Tests A/B" />
          {abTests.length === 0 ? (
            <Card>
              <div className="p-12 text-center" style={{ color: pro.textTer }}>
                <BarChart3 className="w-7 h-7 mx-auto mb-3" />
                <p className="text-[13px]">Aucun test A/B</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {abTests.map((ab: any) => {
                const callsA = ab.callsA ?? 0;
                const callsB = ab.callsB ?? 0;
                const totalCalls = callsA + callsB;
                const rateA = ab.conversionRateA ?? (callsA > 0 ? ((ab.leadsA ?? 0) / callsA) * 100 : 0);
                const rateB = ab.conversionRateB ?? (callsB > 0 ? ((ab.leadsB ?? 0) / callsB) * 100 : 0);
                const maxRate = Math.max(rateA, rateB, 1);
                const diff = maxRate > 0 ? (Math.abs(rateA - rateB) / maxRate) * 100 : 0;
                const isSignificant = totalCalls > 100 && diff > 15;
                const hasWinner = !!ab.winnerId;

                return (
                  <Card key={ab.id}>
                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold truncate" style={{ color: pro.text }}>
                            {ab.niche ?? 'Test A/B'}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: pro.textTer }}>
                            {ab.language ?? 'EN'} · {totalCalls} appels
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {hasWinner && <Pill color="ok">Gagnant</Pill>}
                          {totalCalls > 100 ? (
                            <Pill color={isSignificant ? 'ok' : 'warn'}>
                              {isSignificant ? 'Significatif' : 'En cours'}
                            </Pill>
                          ) : (
                            <Pill color="neutral">Collecte</Pill>
                          )}
                          <Pill color={statusColor(ab.status)}>{ab.status ?? 'active'}</Pill>
                        </div>
                      </div>

                      {/* Variant A */}
                      <div className="space-y-3 mb-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px]" style={{ color: pro.textSec }}>
                              Variante A
                              {hasWinner && ab.winnerId === ab.variantAId && (
                                <span style={{ color: pro.ok }}> · gagnant</span>
                              )}
                            </span>
                            <span className="text-[11px] font-semibold tabular-nums" style={{ color: pro.text }}>
                              {rateA.toFixed(1)}%
                            </span>
                          </div>
                          <div
                            className="h-5 rounded-lg overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.04)' }}
                          >
                            <div
                              className="h-full rounded-lg transition-all duration-500 flex items-center px-2"
                              style={{
                                width: `${maxRate > 0 ? (rateA / maxRate) * 100 : 0}%`,
                                minWidth: rateA > 0 ? '24px' : '0',
                                background:
                                  hasWinner && ab.winnerId === ab.variantAId
                                    ? 'rgba(34,197,94,0.25)'
                                    : 'rgba(255,255,255,0.10)',
                              }}
                            >
                              <span className="text-[9px] tabular-nums" style={{ color: pro.textSec }}>
                                {callsA}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Variant B */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px]" style={{ color: pro.textSec }}>
                              Variante B
                              {hasWinner && ab.winnerId === ab.variantBId && (
                                <span style={{ color: pro.ok }}> · gagnant</span>
                              )}
                            </span>
                            <span className="text-[11px] font-semibold tabular-nums" style={{ color: pro.text }}>
                              {rateB.toFixed(1)}%
                            </span>
                          </div>
                          <div
                            className="h-5 rounded-lg overflow-hidden"
                            style={{ background: 'rgba(255,255,255,0.04)' }}
                          >
                            <div
                              className="h-full rounded-lg transition-all duration-500 flex items-center px-2"
                              style={{
                                width: `${maxRate > 0 ? (rateB / maxRate) * 100 : 0}%`,
                                minWidth: rateB > 0 ? '24px' : '0',
                                background:
                                  hasWinner && ab.winnerId === ab.variantBId
                                    ? 'rgba(34,197,94,0.25)'
                                    : 'rgba(255,255,255,0.10)',
                              }}
                            >
                              <span className="text-[9px] tabular-nums" style={{ color: pro.textSec }}>
                                {callsB}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div
                        className="flex items-center gap-6 pt-3"
                        style={{ borderTop: `1px solid ${pro.border}` }}
                      >
                        <div>
                          <p
                            className="text-[10px] uppercase tracking-wider"
                            style={{ color: pro.textTer }}
                          >
                            Différence
                          </p>
                          <p
                            className="text-[12.5px] font-semibold tabular-nums"
                            style={{ color: diff > 15 ? pro.ok : pro.textSec }}
                          >
                            {diff.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p
                            className="text-[10px] uppercase tracking-wider"
                            style={{ color: pro.textTer }}
                          >
                            Total appels
                          </p>
                          <p className="text-[12.5px] font-semibold tabular-nums" style={{ color: pro.text }}>
                            {totalCalls}
                          </p>
                        </div>
                        <div>
                          <p
                            className="text-[10px] uppercase tracking-wider"
                            style={{ color: pro.textTer }}
                          >
                            Seuil
                          </p>
                          <p
                            className="text-[12.5px] font-semibold tabular-nums"
                            style={{ color: totalCalls >= 200 ? pro.ok : pro.textSec }}
                          >
                            {totalCalls} / 200
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Best Times */}
      {tab === 'besttimes' && (
        <section>
          <SectionHead title="Horaires optimaux" />
          {bestTimes.length === 0 ? (
            <Card>
              <div className="p-12 text-center" style={{ color: pro.textTer }}>
                <Clock className="w-7 h-7 mx-auto mb-3" />
                <p className="text-[13px]">Aucune donnée horaire</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {bestTimes.map((bt: any) => (
                <Card key={bt.id}>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[13px] font-semibold" style={{ color: pro.text }}>
                        {bt.niche}
                      </span>
                      <Clock className="w-4 h-4" style={{ color: pro.textSec }} />
                    </div>
                    <div className="space-y-2">
                      {bt.bestHours?.slice(0, 3).map((h: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span
                            className="text-[11px] font-mono w-12 tabular-nums"
                            style={{ color: pro.textSec }}
                          >
                            {String(h.hour).padStart(2, '0')}h00
                          </span>
                          <div
                            className="flex-1 h-1.5 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(h.rate * 100, 100)}%`,
                                background: pro.textSec,
                              }}
                            />
                          </div>
                          <span
                            className="text-[11px] w-12 text-right tabular-nums"
                            style={{ color: pro.textSec }}
                          >
                            {(h.rate * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
