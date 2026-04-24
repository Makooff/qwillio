import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Phone, Users, AlertCircle, ArrowRight, ChevronRight,
  Bot, BarChart3, ArrowUpRight, ArrowDownRight, Sparkles,
  CheckCircle2, Settings, Headphones,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import QwillioLoader from '../../components/QwillioLoader';
import { formatShortDate, daysUntil } from '../../utils/format';
import OnboardingChecklist from '../../components/client/OnboardingChecklist';

function greeting(name: string) {
  const h = new Date().getHours();
  const first = name?.split(' ')[0] || name;
  if (h < 12) return `Bonjour, ${first}`;
  if (h < 18) return `Bon après-midi, ${first}`;
  return `Bonsoir, ${first}`;
}

// ── Stripe / Vercel-style design tokens (local to this page) ─────────────
const C = {
  bg:       '#0A0A0C',
  panel:    'rgba(255,255,255,0.03)',
  border:   'rgba(255,255,255,0.07)',
  borderHi: 'rgba(255,255,255,0.12)',
  text:     '#F5F5F7',
  textSec:  '#A1A1A8',
  textTer:  '#6B6B75',
  accent:   '#7B5CF0',
  ok:       '#22C55E',
  warn:     '#F59E0B',
  bad:      '#EF4444',
};

// ── Reusable building blocks ────────────────────────────────────────────
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border ${className}`} style={{ background: C.panel, borderColor: C.border }}>
    {children}
  </div>
);

const SectionHead = ({ title, action }: { title: string; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-3 px-1">
    <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.textSec }}>{title}</h2>
    {action}
  </div>
);

const Stat = ({ label, value, hint, trend }: {
  label: string; value: string | number; hint?: string;
  trend?: { dir: 'up' | 'down' | 'flat'; pct: number };
}) => (
  <Card>
    <div className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: C.textTer }}>{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-[26px] font-semibold tabular-nums leading-none" style={{ color: C.text }}>{value}</p>
        {trend && trend.pct > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium" style={{ color: trend.dir === 'up' ? C.ok : trend.dir === 'down' ? C.bad : C.textSec }}>
            {trend.dir === 'up' && <ArrowUpRight size={11} />}
            {trend.dir === 'down' && <ArrowDownRight size={11} />}
            {trend.pct}%
          </span>
        )}
      </div>
      {hint && <p className="text-[11.5px] mt-1.5" style={{ color: C.textTer }}>{hint}</p>}
    </div>
  </Card>
);

const QuickAction = ({ icon: Icon, label, desc, to }: { icon: any; label: string; desc: string; to: string }) => (
  <Link to={to} className="block">
    <Card className="hover:border-white/[0.14] transition-colors group">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <Icon size={14} style={{ color: C.text }} />
          </div>
          <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: C.textSec }} />
        </div>
        <p className="text-[13px] font-semibold" style={{ color: C.text }}>{label}</p>
        <p className="text-[11.5px] mt-0.5" style={{ color: C.textTer }}>{desc}</p>
      </div>
    </Card>
  </Link>
);

export default function ClientOverview() {
  const { user, checkAuth } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [chartRange, setChartRange] = useState<7 | 30>(30);
  const retryCount = useRef(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ov, an, cl] = await Promise.all([
        api.get('/my-dashboard/overview'),
        api.get(`/my-dashboard/analytics?days=${chartRange}`).catch(() => ({ data: null })),
        api.get('/my-dashboard/calls?page=1&limit=6').catch(() => ({ data: { data: [] } })),
      ]);
      setData(ov.data);
      setAnalytics(an.data);
      setCalls(cl.data?.data || []);
      setPaymentPending(false);
      retryCount.current = 0;
      checkAuth();
      if (searchParams.has('payment')) {
        searchParams.delete('payment');
        setSearchParams(searchParams, { replace: true });
      }
    } catch (err: any) {
      // Auto-retry on 4xx (paid → activation in flight)
      const code = err?.response?.status;
      if ((code === 401 || code === 403 || code === 404) && retryCount.current < 6) {
        retryCount.current++;
        setPaymentPending(true);
        setTimeout(load, 2500);
        return;
      }
      setError(err?.response?.data?.error || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [chartRange, checkAuth, searchParams, setSearchParams]);

  useEffect(() => { load(); }, [load]);

  // Sync with the AI status pill toggle from the top bar
  useEffect(() => {
    const h = () => { load(); };
    window.addEventListener('ai-status-change', h);
    return () => window.removeEventListener('ai-status-change', h);
  }, [load]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <QwillioLoader size={120} fullscreen={false} />
      {paymentPending && (
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: C.text }}>Paiement reçu</p>
          <p className="text-xs mt-1" style={{ color: C.textSec }}>Activation de votre compte en cours…</p>
        </div>
      )}
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <AlertCircle className="w-9 h-9 mb-3" style={{ color: C.bad }} />
      <p className="text-sm" style={{ color: C.textSec }}>{error}</p>
      <button onClick={load} className="mt-4 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: C.accent, color: '#fff' }}>
        Réessayer
      </button>
    </div>
  );

  const c = data?.client || {};
  const isActive = c.subscriptionStatus === 'active' || c.subscriptionStatus === 'trialing';
  const isPaused = c.subscriptionStatus === 'paused';

  const callsToday = data?.calls?.today ?? 0;
  const callsYesterday = data?.calls?.yesterday ?? 0;
  const callsMonth = data?.calls?.thisMonth ?? 0;
  const leadsMonth = data?.leads?.thisMonth ?? 0;
  const sentTotal = (data?.sentiment?.positive || 0) + (data?.sentiment?.neutral || 0) + (data?.sentiment?.negative || 0);
  const positiveRate = sentTotal > 0 ? Math.round((data.sentiment.positive / sentTotal) * 100) : 0;
  const convRate = callsMonth > 0 ? Math.round((leadsMonth / callsMonth) * 100) : 0;

  const callsTodayPct = callsYesterday > 0
    ? Math.abs(Math.round(((callsToday - callsYesterday) / callsYesterday) * 100))
    : 0;
  const callsTodayDir: 'up' | 'down' | 'flat' = callsToday > callsYesterday ? 'up' : callsToday < callsYesterday ? 'down' : 'flat';

  const quotaUsed = data?.calls?.quotaUsed || 0;
  const quotaTotal = c.monthlyCallsQuota || data?.calls?.quota || 0;
  const quotaPct = quotaTotal > 0 ? Math.round((quotaUsed / quotaTotal) * 100) : 0;

  const chartData = (analytics?.daily || []).map((d: any) => ({
    date: formatShortDate(d.date),
    Appels: d.calls,
    Leads: d.leads,
  }));

  const onboardingClient = {
    hasPhone: !!(c.transferNumber || c.vapiPhoneNumber),
    hasTestCall: !!c.hasTestCall,
    hasCustomConfig: !!c.hasCustomConfig,
    hasCallForwarding: c.forwardingStatus === 'verified' || !!c.forwardingVerifiedAt,
    forwardingStatus: c.forwardingStatus,
    forwardingVerifiedAt: c.forwardingVerifiedAt,
    isActive,
    transferNumber: c.transferNumber,
    vapiPhoneNumber: c.vapiPhoneNumber,
    subscriptionStatus: c.subscriptionStatus,
    businessName: c.businessName,
  };
  const onboardingDone =
    onboardingClient.hasPhone && onboardingClient.hasTestCall && onboardingClient.hasCustomConfig && onboardingClient.isActive;

  return (
    <div className="space-y-8 max-w-[1200px]">
      {/* ─── Header ─── */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: C.text }}>
            {greeting(user?.name || 'Utilisateur')}
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: C.textSec }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}
            <span style={{ color: isActive ? C.ok : isPaused ? C.warn : C.bad }}>●</span>
            {' '}
            {isActive ? 'Service actif' : isPaused ? 'En pause' : 'Inactif'}
          </p>
        </div>
      </motion.div>

      {/* ─── Onboarding (only if not done) ─── */}
      {!onboardingDone && <OnboardingChecklist client={onboardingClient} />}

      {/* ─── Banners ─── */}
      {c.isTrial && (
        <Card className="px-5 py-3 flex items-center gap-3">
          <Sparkles size={16} style={{ color: C.accent }} />
          <p className="text-[13px] flex-1" style={{ color: C.text }}>
            Période d'essai — <strong>{daysUntil(c.trialEndDate)} jours restants</strong>
          </p>
          <Link to="/dashboard/billing" className="text-[12.5px] font-medium hover:underline whitespace-nowrap" style={{ color: C.accent }}>
            Mettre à jour →
          </Link>
        </Card>
      )}

      {!c.transferNumber && (
        <Card className="px-5 py-3 flex items-center gap-3" >
          <AlertCircle size={14} style={{ color: C.bad }} />
          <p className="text-[13px] flex-1" style={{ color: C.text }}>Numéro de transfert non configuré</p>
          <Link to="/dashboard/receptionist#transfer" className="text-[12.5px] font-medium hover:underline whitespace-nowrap" style={{ color: C.accent }}>
            Configurer →
          </Link>
        </Card>
      )}

      {/* ─── KPI grid ─── */}
      <section>
        <SectionHead title="Aperçu" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label="Appels aujourd'hui"
            value={callsToday}
            trend={callsTodayPct > 0 ? { dir: callsTodayDir, pct: callsTodayPct } : undefined}
            hint={callsYesterday ? `vs ${callsYesterday} hier` : undefined}
          />
          <Stat
            label="Appels ce mois"
            value={callsMonth}
            hint={quotaTotal ? `${quotaPct}% du quota (${quotaUsed}/${quotaTotal})` : undefined}
          />
          <Stat
            label="Leads ce mois"
            value={leadsMonth}
            hint={callsMonth > 0 ? `${convRate}% de conversion` : undefined}
          />
          <Stat
            label="Sentiment positif"
            value={`${positiveRate}%`}
            hint={sentTotal > 0 ? `${sentTotal} appel${sentTotal > 1 ? 's' : ''} analysé${sentTotal > 1 ? 's' : ''}` : 'Pas encore de données'}
          />
        </div>
      </section>

      {/* ─── Performance chart ─── */}
      <section>
        <SectionHead
          title="Performance"
          action={
            <div className="flex p-0.5 rounded-lg border" style={{ borderColor: C.border, background: C.panel }}>
              {[7, 30].map(d => (
                <button key={d} onClick={() => setChartRange(d as 7 | 30)}
                  className="text-[11px] font-medium px-2.5 h-6 rounded-md transition-colors"
                  style={{
                    color: chartRange === d ? C.text : C.textSec,
                    background: chartRange === d ? 'rgba(255,255,255,0.06)' : 'transparent',
                  }}>
                  {d}j
                </button>
              ))}
            </div>
          }
        />
        <Card>
          <div className="p-4 h-[240px]">
            {chartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center" style={{ color: C.textTer }}>
                <BarChart3 size={28} className="opacity-50 mb-2" />
                <p className="text-[12px]">Pas encore de données</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="appels" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.accent} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="leads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.ok} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={C.ok} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke={C.textTer} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis stroke={C.textTer} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#141417', border: `1px solid ${C.borderHi}`, borderRadius: 8, fontSize: 11, color: C.text }}
                    cursor={{ stroke: C.borderHi, strokeWidth: 1 }}
                  />
                  <Area type="monotone" dataKey="Appels" stroke={C.accent} strokeWidth={1.5} fill="url(#appels)" />
                  <Area type="monotone" dataKey="Leads"  stroke={C.ok}     strokeWidth={1.5} fill="url(#leads)"  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </section>

      {/* ─── Recent activity ─── */}
      <section>
        <SectionHead
          title="Activité récente"
          action={<Link to="/dashboard/calls" className="text-[11.5px] font-medium hover:underline" style={{ color: C.textSec }}>Tout voir →</Link>}
        />
        <Card>
          {calls.length === 0 ? (
            <div className="p-12 flex flex-col items-center" style={{ color: C.textTer }}>
              <Phone size={28} className="opacity-50 mb-2" />
              <p className="text-[12.5px]">Aucun appel pour le moment</p>
            </div>
          ) : (
            <div>
              {calls.slice(0, 6).map((call: any, i: number) => (
                <Link to={`/dashboard/calls?id=${call.id}`} key={call.id || i}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                  style={{ borderTop: i > 0 ? `1px solid ${C.border}` : undefined }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Phone size={13} style={{ color: C.textSec }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: C.text }}>
                      {call.callerName || call.phoneNumber || 'Appel inconnu'}
                    </p>
                    <p className="text-[11px]" style={{ color: C.textTer }}>
                      {call.startedAt
                        ? new Date(call.startedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                      {call.duration ? ` · ${Math.round(call.duration)}s` : ''}
                    </p>
                  </div>
                  {call.outcome && (
                    <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{
                        background: call.outcome === 'lead_captured' ? 'rgba(34,197,94,0.10)'
                                  : call.outcome === 'transferred'   ? 'rgba(123,92,240,0.10)'
                                  : 'rgba(255,255,255,0.04)',
                        color: call.outcome === 'lead_captured' ? C.ok
                              : call.outcome === 'transferred'   ? C.accent
                              : C.textSec,
                      }}>
                      {call.outcome === 'lead_captured' ? 'Lead' : call.outcome === 'transferred' ? 'Transféré' : call.outcome}
                    </span>
                  )}
                  <ChevronRight size={14} style={{ color: C.textTer }} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* ─── Quick actions ─── */}
      <section>
        <SectionHead title="Actions rapides" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction icon={Phone}    label="Configurer le renvoi"     desc="iPhone et Android — guide pas à pas" to="/dashboard/setup/call-forwarding" />
          <QuickAction icon={Bot}      label="Personnaliser l'IA"       desc="Voix, scripts, transferts"          to="/dashboard/receptionist" />
          <QuickAction icon={Settings} label="Paramètres du compte"     desc="Profil, sécurité, notifications"    to="/dashboard/account" />
        </div>
      </section>

      {/* ─── Helper / support ─── */}
      <section className="pt-2">
        <Card>
          <div className="p-4 flex items-center gap-3">
            <Headphones size={16} style={{ color: C.textSec }} />
            <p className="text-[12.5px] flex-1" style={{ color: C.text }}>
              Besoin d'aide ? Notre équipe répond en moins d'une heure.
            </p>
            <Link to="/dashboard/support" className="text-[12px] font-medium hover:underline" style={{ color: C.accent }}>
              Contacter le support →
            </Link>
          </div>
        </Card>
      </section>

      <p className="text-center text-[10px]" style={{ color: C.textTer }}>
        Qwillio · {c.planType ? `Plan ${c.planType.charAt(0).toUpperCase() + c.planType.slice(1)}` : 'Plan'} · Mis à jour {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
