import { useEffect, useState } from 'react';
import api from '../../services/api';
import {
  RefreshCw, Zap, Activity, TrendingUp, Search, Phone, Clock, CheckCircle,
  Target, Sparkles, Plus, X, Globe, MapPin, Download,
} from 'lucide-react';
import OrbsLoader from '../../components/OrbsLoader';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, IconBtn, PrimaryBtn, GhostBtn, Pill,
} from '../../components/pro/ProBlocks';

type StatusColor = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'accent';

// ─── Campaign builder data ────────────────────────────────
const ALL_NICHES = [
  { value: 'home_services', label: '🔧 Services à domicile (plombier, électricien…)' },
  { value: 'dental',        label: '🦷 Dentaire' },
  { value: 'auto',          label: '🚗 Garage automobile' },
  { value: 'medical',       label: '⚕️ Médecine / Para-médical' },
  { value: 'salon',         label: '💇 Salon de coiffure / Beauté' },
  { value: 'veterinary',    label: '🐾 Vétérinaire' },
  { value: 'law',           label: '⚖️ Avocat / Notaire' },
  { value: 'restaurant',    label: '🍽️ Restaurant / Traiteur' },
  { value: 'fitness',       label: '🏋️ Salle de sport / Yoga' },
  { value: 'real_estate',   label: '🏠 Immobilier' },
  { value: 'financial',     label: '💼 Comptable / Assurance' },
  { value: 'childcare',     label: '👶 Crèche / Garderie' },
  { value: 'pet',           label: '🐶 Toilettage / Pension chiens' },
  { value: 'hotel',         label: '🏨 Hôtel / B&B' },
  { value: 'cleaning',      label: '🧹 Nettoyage' },
  { value: 'funeral',       label: '🕊️ Pompes funèbres' },
];

const CITIES_US = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'Austin', 'Jacksonville', 'Fort Worth',
  'Columbus', 'Charlotte', 'Indianapolis', 'San Francisco', 'Seattle', 'Denver',
  'Nashville', 'Miami', 'Atlanta', 'Las Vegas', 'Minneapolis', 'Boston', 'San Jose',
];
const CITIES_FR = [
  'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Montpellier',
  'Strasbourg', 'Bordeaux', 'Lille', 'Rennes', 'Grenoble', 'Toulon', 'Dijon',
];
const CITIES_BE = [
  'Bruxelles', 'Liège', 'Charleroi', 'Namur', 'Mons', 'La Louvière', 'Tournai',
];

interface TriggerAction {
  id: string;
  label: string;
  description: string;
  endpoint: string;
  icon: any;
}

const TRIGGERS: TriggerAction[] = [
  { id: 'scrape',              label: 'Scraping Apify',       description: 'Lancer scraping Google Maps',   endpoint: '/prospecting/trigger/scrape',              icon: Search },
  { id: 'call',                label: 'Tenter un appel',      description: 'Déclencher 1 appel sortant',    endpoint: '/prospecting/trigger/call',                icon: Phone },
  { id: 'ab-analysis',         label: 'Analyse A/B',          description: 'Analyser résultats tests A/B',  endpoint: '/prospecting/trigger/ab-analysis',         icon: TrendingUp },
  { id: 'best-time',           label: 'Meilleurs horaires',   description: 'Calculer horaires optimaux',    endpoint: '/prospecting/trigger/best-time',           icon: Clock },
  { id: 'script-learning',     label: 'Script learning',      description: 'Lancer optimisation script',    endpoint: '/prospecting/trigger/script-learning',     icon: Activity },
  { id: 'follow-ups',          label: 'Follow-ups',           description: 'Traiter suivis dus',            endpoint: '/prospecting/trigger/follow-ups',          icon: CheckCircle },
  { id: 'rescore',             label: 'Re-scoring',           description: 'Rescorer prospects non scorés', endpoint: '/prospecting/trigger/rescore',             icon: Zap },
  { id: 'seed-local-presence', label: 'Local presence',       description: 'Alimenter numéros locaux',      endpoint: '/prospecting/trigger/seed-local-presence', icon: Phone },
];

const fmtTime = (v?: string) => {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

export default function AdminProspecting() {
  const [status, setStatus] = useState<any>(null);
  const [abTests, setAbTests] = useState<any[]>([]);
  const [mutations, setMutations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [mainBusy, setMainBusy] = useState(false);
  const { toasts, add: toast, remove } = useToast();

  // Campaign builder state
  const [cbNiches, setCbNiches] = useState<string[]>([]);
  const [cbCities, setCbCities] = useState<string[]>([]);
  const [cbKeyword, setCbKeyword] = useState('');
  const [cbCountry, setCbCountry] = useState<'US' | 'FR' | 'BE'>('US');
  const [cbBusy, setCbBusy] = useState(false);

  const cbCityList = cbCountry === 'US' ? CITIES_US : cbCountry === 'FR' ? CITIES_FR : CITIES_BE;

  const toggleNiche = (v: string) =>
    setCbNiches(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const toggleCity = (v: string) =>
    setCbCities(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const runCampaign = async () => {
    if (!cbNiches.length || !cbCities.length) {
      toast('Sélectionne au moins 1 niche et 1 ville', 'error');
      return;
    }
    setCbBusy(true);
    try {
      await api.post('/prospecting/trigger/custom-scrape', {
        niches: cbNiches,
        cities: cbCities,
        extraQueries: cbKeyword ? [cbKeyword] : [],
      });
      toast(`Scraping lancé — ${cbNiches.length} niche(s), ${cbCities.length} ville(s)`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.error ?? 'Erreur scraping', 'error');
    } finally { setCbBusy(false); }
  };

  // Download the scraped prospects as a CSV table (name, phone, city, rating…).
  // Filters by the campaign's selected niches if any; otherwise exports all
  // callable prospects, sorted best-to-call.
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (cbNiches.length === 1) params.set('niche', cbNiches[0]);
      const { data } = await api.get(`/prospects/export?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast(e?.response?.data?.error ?? 'Erreur export CSV', 'error');
    } finally { setExporting(false); }
  };

  const load = async () => {
    setLoading(true);
    const [s, a, m] = await Promise.all([
      api.get('/prospecting/status').catch(() => null),
      api.get('/prospecting/ab-tests').catch(() => null),
      api.get('/prospecting/mutations').catch(() => null),
    ]);
    if (s?.data) setStatus(s.data);
    if (a?.data) setAbTests(Array.isArray(a.data.data) ? a.data.data : (Array.isArray(a.data) ? a.data : []));
    if (m?.data) setMutations(Array.isArray(m.data.data) ? m.data.data : (Array.isArray(m.data) ? m.data : []));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const trigger = async (action: TriggerAction) => {
    setTriggering(action.id);
    try {
      await api.post(action.endpoint);
      toast(`${action.label} déclenché`, 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message ?? `Erreur ${action.label}`, 'error');
    } finally { setTriggering(null); }
  };

  const runMain = async () => {
    setMainBusy(true);
    try {
      await api.post('/prospecting/trigger/scrape');
      toast('Cycle de prospection lancé', 'success');
      setTimeout(load, 1500);
    } catch { toast('Erreur lancement prospection', 'error'); }
    finally { setMainBusy(false); }
  };

  // Derived counts
  const totalProspects = status?.prospectsFound ?? status?.totalProspects ?? 0;
  const called         = status?.callsToday     ?? 0;
  const interested     = status?.interested     ?? status?.interestedCount ?? 0;
  const converted      = status?.converted      ?? status?.convertedCount  ?? 0;

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <OrbsLoader size={40} fullscreen={false} />
    </div>
  );

  const mutationPill = (m: any): { color: StatusColor; label: string } => {
    if (m.blocked) return { color: 'bad', label: 'Bloqué' };
    if (m.status === 'winner') return { color: 'ok', label: 'Gagnant' };
    return { color: 'neutral', label: m.status ?? 'active' };
  };

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Moteur de prospection"
        subtitle="Pipeline de leads, scoring et tests A/B"
        right={
          <IconBtn onClick={load} title="Rafraîchir">
            <RefreshCw className="w-4 h-4" />
          </IconBtn>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Target}     label="Prospects"  value={totalProspects} hint="Base totale" />
        <Stat icon={Phone}      label="Appelés"    value={called}         hint="Aujourd'hui" />
        <Stat icon={Sparkles}   label="Intéressés" value={interested}     hint="Score ≥ 7" />
        <Stat icon={TrendingUp} label="Convertis"  value={converted}      hint="Clients signés" />
      </div>

      {/* Main cron control */}
      <section>
        <SectionHead title="Contrôle cycle" />
        <Card>
          <div className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Activity size={18} style={{ color: pro.text }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: pro.text }}>
                Cycle de prospection
              </p>
              <p className="text-[11.5px]" style={{ color: pro.textSec }}>
                {status?.isRunning ? 'En cours…' : 'Prêt à lancer'}
                {status?.lastScrape ? ` · dernier scrape ${fmtTime(status.lastScrape)}` : ''}
              </p>
            </div>
            <PrimaryBtn size="sm" onClick={runMain} disabled={mainBusy}>
              {mainBusy ? '…' : (<><Zap size={12} /> Lancer le cycle</>)}
            </PrimaryBtn>
          </div>
        </Card>
      </section>

      {/* Manual triggers */}
      <section>
        <SectionHead title="Déclenchement manuel" />
        <Card>
          {TRIGGERS.map((action, i) => {
            const Icon = action.icon;
            const busy = triggering === action.id;
            return (
              <div
                key={action.id}
                className="flex items-center gap-3.5 px-4 py-3"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Icon size={14} style={{ color: pro.text }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                    {action.label}
                  </p>
                  <p className="text-[11.5px] truncate" style={{ color: pro.textTer }}>
                    {action.description}
                  </p>
                </div>
                <GhostBtn size="sm" onClick={() => trigger(action)} disabled={busy}>
                  {busy ? '…' : 'Exécuter'}
                </GhostBtn>
              </div>
            );
          })}
        </Card>
      </section>

      {/* ── Campaign Builder ───────────────────────────── */}
      <section>
        <SectionHead title="Campagne personnalisée" />
        <Card>
          <div className="p-4 space-y-4">

            {/* Country selector */}
            <div className="flex gap-2">
              {(['US', 'FR', 'BE'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => { setCbCountry(c); setCbCities([]); }}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
                  style={{
                    background: cbCountry === c ? pro.accent : 'rgba(255,255,255,0.06)',
                    color: cbCountry === c ? '#000' : pro.text,
                    border: `1px solid ${cbCountry === c ? pro.accent : pro.border}`,
                  }}
                >
                  {c === 'US' ? '🇺🇸 USA' : c === 'FR' ? '🇫🇷 France' : '🇧🇪 Belgique'}
                </button>
              ))}
            </div>

            {/* Niche selector */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
                <Globe size={10} className="inline mr-1" />Niches ciblées
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_NICHES.map(n => {
                  const sel = cbNiches.includes(n.value);
                  return (
                    <button
                      key={n.value}
                      onClick={() => toggleNiche(n.value)}
                      className="px-2.5 py-1 rounded-lg text-[11.5px] transition-colors"
                      style={{
                        background: sel ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                        color: sel ? '#a5b4fc' : pro.textSec,
                        border: `1px solid ${sel ? 'rgba(99,102,241,0.5)' : pro.border}`,
                      }}
                    >
                      {n.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* City selector */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>
                <MapPin size={10} className="inline mr-1" />Villes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {cbCityList.map(city => {
                  const sel = cbCities.includes(city);
                  return (
                    <button
                      key={city}
                      onClick={() => toggleCity(city)}
                      className="px-2.5 py-1 rounded-lg text-[11.5px] transition-colors"
                      style={{
                        background: sel ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                        color: sel ? '#86efac' : pro.textSec,
                        border: `1px solid ${sel ? 'rgba(34,197,94,0.4)' : pro.border}`,
                      }}
                    >
                      {city}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom keyword */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: pro.textSec }}>
                Mot-clé personnalisé (optionnel)
              </p>
              <input
                value={cbKeyword}
                onChange={e => setCbKeyword(e.target.value)}
                placeholder="ex: chef cuisinier, coach de vie, …"
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${pro.border}`,
                  color: pro.text,
                }}
              />
            </div>

            {/* Summary + Launch */}
            <div className="flex items-center justify-between pt-1">
              <div className="text-[11.5px]" style={{ color: pro.textTer }}>
                {cbNiches.length > 0 && (
                  <span>{cbNiches.length} niche{cbNiches.length > 1 ? 's' : ''}</span>
                )}
                {cbNiches.length > 0 && cbCities.length > 0 && <span> × </span>}
                {cbCities.length > 0 && (
                  <span>{cbCities.length} ville{cbCities.length > 1 ? 's' : ''}</span>
                )}
                {cbNiches.length > 0 && cbCities.length > 0 && (
                  <span style={{ color: pro.textSec }}>
                    {' '}= ~{cbNiches.length * cbCities.length * 3 * 20} prospects max
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <GhostBtn
                  size="sm"
                  onClick={() => { setCbNiches([]); setCbCities([]); setCbKeyword(''); }}
                  disabled={cbBusy}
                >
                  <X size={11} /> Reset
                </GhostBtn>
                <GhostBtn size="sm" onClick={exportCsv} disabled={exporting}>
                  <Download size={11} /> {exporting ? '…' : 'Exporter CSV'}
                </GhostBtn>
                <PrimaryBtn size="sm" onClick={runCampaign} disabled={cbBusy || !cbNiches.length || !cbCities.length}>
                  {cbBusy ? '…' : (<><Plus size={12} /> Lancer le scraping</>)}
                </PrimaryBtn>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* A/B Tests */}
      {abTests.length > 0 && (
        <section>
          <SectionHead title="Tests A/B actifs" />
          <Card>
            {abTests.slice(0, 5).map((ab: any, i: number) => (
              <div
                key={ab.id}
                className="flex items-center gap-3.5 px-4 py-3"
                style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <TrendingUp size={14} style={{ color: pro.text }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                    {ab.niche ?? 'Global'}
                  </p>
                  <p className="text-[11.5px] truncate tabular-nums" style={{ color: pro.textTer }}>
                    A : {ab.callsA ?? 0} · B : {ab.callsB ?? 0}
                  </p>
                </div>
                <Pill color={ab.winnerId ? 'ok' : 'warn'}>
                  {ab.winnerId ? 'Terminé' : 'En cours'}
                </Pill>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* Recent mutations */}
      {mutations.length > 0 && (
        <section>
          <SectionHead title="Mutations de script récentes" />
          <Card>
            {mutations.slice(0, 6).map((m: any, i: number) => {
              const p = mutationPill(m);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3.5 px-4 py-3"
                  style={{ borderTop: i > 0 ? `1px solid ${pro.border}` : undefined }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Sparkles size={14} style={{ color: pro.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: pro.text }}>
                      {m.niche ?? 'Global'} — {m.type}
                    </p>
                    <p className="text-[11.5px] truncate tabular-nums" style={{ color: pro.textTer }}>
                      Succès : {(m.successRate ?? 0).toFixed(1)}%
                    </p>
                  </div>
                  <Pill color={p.color}>{p.label}</Pill>
                </div>
              );
            })}
          </Card>
        </section>
      )}
    </div>
  );
}
