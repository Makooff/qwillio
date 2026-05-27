import { useEffect, useState, useCallback, type ComponentType } from 'react';
import { Activity, MessageSquare, ListChecks, Zap, RefreshCw, Save, Check } from 'lucide-react';
import api from '../../services/api';
import { pro } from '../../styles/pro-theme';
import { Card, PageHeader, SectionHead, PrimaryBtn, GhostBtn, Pill, Stat } from '../pro/ProBlocks';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';

interface AgentMetrics {
  last24h: { total: number; byStatus: Record<string, number> };
  last7d: { total: number; byStatus: Record<string, number> };
  last30d: { total: number; byStatus: Record<string, number> };
}

interface PromptRow {
  id: string;
  agentType: string;
  language: 'fr' | 'en';
  systemPrompt: string;
  userPromptTemplate: string;
  version: number;
  active: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

interface ActivityRow {
  id: string;
  clientId: string;
  type?: string;
  status?: string;
  channel?: string;
  content?: unknown;
  createdAt: string;
}

type Tab = 'overview' | 'prompts' | 'activity' | 'run';

interface Props {
  agentType: string;
  displayName: string;
  icon: ComponentType<{ size?: number; style?: React.CSSProperties }>;
  description?: string;
  /** When true, the per-agent runner accepts a free-form JSON params body. */
  runForm?: 'json' | 'none';
}

export function AgentDetailShell({ agentType, displayName, icon: Icon, description, runForm = 'json' }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [prompts, setPrompts] = useState<{ fr: PromptRow | null; en: PromptRow | null }>({ fr: null, en: null });
  const [savingLang, setSavingLang] = useState<'fr' | 'en' | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<unknown>(null);
  const [runClientId, setRunClientId] = useState('');
  const [runParams, setRunParams] = useState('{}');
  const { toasts, add: addToast, remove: removeToast } = useToast();

  const loadAll = useCallback(async () => {
    try {
      const [m, a, p] = await Promise.all([
        api.get(`/admin/agents/${agentType}/metrics`),
        api.get(`/admin/agents/${agentType}/activity`, { params: { limit: 100 } }),
        api.get(`/admin/agents/${agentType}`),
      ]);
      setMetrics(m.data);
      setActivity(Array.isArray(a.data) ? a.data : []);
      setPrompts(p.data.prompts ?? { fr: null, en: null });
    } catch (e: any) {
      addToast(`Erreur chargement: ${e?.response?.data?.error ?? e.message}`, 'error');
    }
  }, [agentType, addToast]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const savePrompt = async (language: 'fr' | 'en') => {
    const row = prompts[language];
    if (!row) {
      addToast(`Aucun prompt à enregistrer pour ${language.toUpperCase()}`, 'error');
      return;
    }
    setSavingLang(language);
    try {
      await api.put(`/admin/agents/${agentType}/prompts`, {
        language,
        systemPrompt: row.systemPrompt,
        userPromptTemplate: row.userPromptTemplate,
      });
      addToast(`Prompt ${language.toUpperCase()} sauvegardé (nouvelle version)`, 'success');
      await loadAll();
    } catch (e: any) {
      addToast(`Échec sauvegarde: ${e?.response?.data?.error ?? e.message}`, 'error');
    } finally {
      setSavingLang(null);
    }
  };

  const onRun = async () => {
    if (!runClientId.trim()) {
      addToast('clientId requis', 'error');
      return;
    }
    let parsedParams: unknown = {};
    try { parsedParams = JSON.parse(runParams || '{}'); }
    catch { addToast('JSON params invalide', 'error'); return; }
    setRunning(true);
    setRunResult(null);
    try {
      const { data } = await api.post(`/admin/agents/${agentType}/run`, {
        clientId: runClientId.trim(),
        params: parsedParams,
      });
      setRunResult(data);
      addToast('Exécution OK', 'success');
      await loadAll();
    } catch (e: any) {
      setRunResult({ error: e?.response?.data?.error ?? e.message });
      addToast(`Échec exécution: ${e?.response?.data?.error ?? e.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5 admin-page">
      <ToastContainer toasts={toasts} remove={removeToast} />
      <PageHeader
        title={displayName}
        subtitle={description ?? `Configuration et supervision de l'agent ${displayName}`}
      />

      <Card>
        <div className="p-4 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: pro.panelHi, border: `1px solid ${pro.border}` }}
          >
            <Icon size={18} style={{ color: pro.accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold" style={{ color: pro.text }}>{displayName}</p>
            <p className="text-[11px]" style={{ color: pro.textTer }}>Type: {agentType}</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: pro.border }}>
        {([
          { id: 'overview', label: "Vue d'ensemble", icon: Activity },
          { id: 'prompts',  label: 'Prompts',          icon: MessageSquare },
          { id: 'activity', label: 'Audit log',        icon: ListChecks },
          { id: 'run',      label: 'Lancer',           icon: Zap },
        ] as const).map(({ id, label, icon: TabIcon }) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className="px-3.5 py-2 text-[12.5px] font-medium transition-colors active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-t-md flex items-center gap-1.5"
            style={{
              background: tab === id ? pro.panelHi : 'transparent',
              color: tab === id ? pro.text : pro.textSec,
              borderBottom: tab === id ? `2px solid ${pro.accent}` : '2px solid transparent',
            }}
          >
            <TabIcon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Stat icon={Activity} label="24 dernières heures" value={metrics?.last24h.total ?? 0} />
          <Stat icon={Activity} label="7 derniers jours"     value={metrics?.last7d.total ?? 0} />
          <Stat icon={Activity} label="30 derniers jours"    value={metrics?.last30d.total ?? 0} />
          <Card className="md:col-span-3">
            <div className="p-4">
              <SectionHead title="Répartition par statut (30 jours)" />
              {metrics ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(metrics.last30d.byStatus).length === 0 ? (
                    <p className="text-[12px]" style={{ color: pro.textTer }}>Aucune activité sur 30 jours.</p>
                  ) : Object.entries(metrics.last30d.byStatus).map(([status, count]) => (
                    <Pill key={status} color={status === 'sent' || status === 'approved' ? 'ok' : status === 'escalated' ? 'warn' : 'info'}>
                      {status}: {count}
                    </Pill>
                  ))}
                </div>
              ) : (
                <p className="text-[12px]" style={{ color: pro.textTer }}>Chargement…</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === 'prompts' && (
        <div className="space-y-4">
          {(['fr', 'en'] as const).map(language => {
            const row = prompts[language];
            return (
              <Card key={language}>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <SectionHead title={`Prompts ${language.toUpperCase()}`} />
                    <div className="flex items-center gap-2 text-[11px]" style={{ color: pro.textTer }}>
                      {row && <span>v{row.version} · {new Date(row.updatedAt).toLocaleString('fr-FR')}</span>}
                      {!row && <span>Aucune version DB, le fallback inline sera utilisé</span>}
                    </div>
                  </div>
                  <PromptEditor
                    initial={row}
                    language={language}
                    onChange={updated => setPrompts(s => ({ ...s, [language]: { ...(s[language] ?? createBlankRow(agentType, language)), ...updated } as PromptRow }))}
                  />
                  <div className="flex justify-end">
                    <PrimaryBtn onClick={() => savePrompt(language)} disabled={savingLang === language}>
                      {savingLang === language ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                      <span className="ml-1.5">{savingLang === language ? 'Sauvegarde…' : 'Sauvegarder'}</span>
                    </PrimaryBtn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'activity' && (
        <Card>
          <div className="p-4">
            <SectionHead title="Audit log (100 dernières)" />
            {activity.length === 0 ? (
              <p className="text-[12px] py-10 text-center" style={{ color: pro.textTer }}>Aucune activité.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-[12px]">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${pro.border}` }}>
                      <th className="text-left py-2 pr-3" style={{ color: pro.textSec }}>Date</th>
                      <th className="text-left py-2 pr-3" style={{ color: pro.textSec }}>Client</th>
                      <th className="text-left py-2 pr-3" style={{ color: pro.textSec }}>Type</th>
                      <th className="text-left py-2 pr-3" style={{ color: pro.textSec }}>Statut</th>
                      <th className="text-left py-2 pr-3" style={{ color: pro.textSec }}>Canal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map(a => (
                      <tr key={a.id} style={{ borderBottom: `1px solid ${pro.border}` }}>
                        <td className="py-2 pr-3 tabular-nums" style={{ color: pro.text }}>{new Date(a.createdAt).toLocaleString('fr-FR')}</td>
                        <td className="py-2 pr-3" style={{ color: pro.textSec }}>{a.clientId.slice(0, 8)}…</td>
                        <td className="py-2 pr-3" style={{ color: pro.text }}>{a.type ?? '·'}</td>
                        <td className="py-2 pr-3"><Pill color={a.status === 'sent' || a.status === 'approved' ? 'ok' : a.status === 'escalated' ? 'warn' : 'info'}>{a.status ?? 'n/a'}</Pill></td>
                        <td className="py-2 pr-3" style={{ color: pro.textSec }}>{a.channel ?? '·'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {tab === 'run' && (
        <Card>
          <div className="p-4 space-y-3">
            <SectionHead title="Lancer une exécution manuelle" />
            <p className="text-[11.5px]" style={{ color: pro.textSec }}>
              Exécute l'agent pour un client précis avec des paramètres custom. Le résultat est enregistré dans l'audit log.
            </p>
            <label className="block">
              <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Client ID</span>
              <input
                type="text"
                value={runClientId}
                onChange={e => setRunClientId(e.target.value)}
                placeholder="uuid du client"
                className="mt-1 w-full px-3 py-2 rounded-lg text-[12.5px] outline-none focus:ring-2 focus:ring-white/30"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              />
            </label>
            {runForm === 'json' && (
              <label className="block">
                <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>Params JSON</span>
                <textarea
                  rows={6}
                  value={runParams}
                  onChange={e => setRunParams(e.target.value)}
                  placeholder={defaultParamsPlaceholder(agentType)}
                  className="mt-1 w-full px-3 py-2 rounded-lg text-[11.5px] outline-none focus:ring-2 focus:ring-white/30 font-mono"
                  style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
                />
              </label>
            )}
            <div className="flex justify-between items-center gap-2 flex-wrap">
              <GhostBtn onClick={() => { setRunResult(null); setRunParams('{}'); setRunClientId(''); }}>Reset</GhostBtn>
              <PrimaryBtn onClick={onRun} disabled={running}>
                {running ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                <span className="ml-1.5">{running ? 'Exécution…' : 'Lancer'}</span>
              </PrimaryBtn>
            </div>
            {runResult !== null && (
              <div
                className="mt-2 p-3 rounded-lg text-[11px] font-mono overflow-x-auto"
                style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Check size={12} style={{ color: pro.ok }} />
                  <span className="font-sans text-[12px] font-semibold">Résultat</span>
                </div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(runResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function createBlankRow(agentType: string, language: 'fr' | 'en'): PromptRow {
  return {
    id: '',
    agentType,
    language,
    systemPrompt: '',
    userPromptTemplate: '',
    version: 0,
    active: true,
    updatedBy: null,
    updatedAt: new Date().toISOString(),
  };
}

function defaultParamsPlaceholder(agentType: string): string {
  switch (agentType) {
    case 'marketing':  return '{\n  "contentType": "social_post",\n  "topic": "...",\n  "channel": "facebook"\n}';
    case 'reputation': return '{\n  "platform": "google",\n  "rating": 3,\n  "reviewText": "..."\n}';
    case 'scheduling': return '{\n  "date": "2026-06-01",\n  "slotCount": 3\n}';
    case 'support':    return '{\n  "channel": "email",\n  "ticketText": "..."\n}';
    default:           return '{}';
  }
}

function PromptEditor({
  initial,
  language: _language,
  onChange,
}: {
  initial: PromptRow | null;
  language: 'fr' | 'en';
  onChange: (patch: Partial<PromptRow>) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <label className="block">
        <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>System prompt</span>
        <textarea
          rows={10}
          defaultValue={initial?.systemPrompt ?? ''}
          onChange={e => onChange({ systemPrompt: e.target.value })}
          className="mt-1 w-full px-3 py-2 rounded-lg text-[11.5px] outline-none focus:ring-2 focus:ring-white/30 font-mono"
          style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
        />
      </label>
      <label className="block">
        <span className="text-[11.5px] font-medium" style={{ color: pro.textSec }}>User prompt template</span>
        <textarea
          rows={10}
          defaultValue={initial?.userPromptTemplate ?? ''}
          onChange={e => onChange({ userPromptTemplate: e.target.value })}
          className="mt-1 w-full px-3 py-2 rounded-lg text-[11.5px] outline-none focus:ring-2 focus:ring-white/30 font-mono"
          style={{ background: pro.panelHi, border: `1px solid ${pro.border}`, color: pro.text }}
        />
      </label>
    </div>
  );
}
