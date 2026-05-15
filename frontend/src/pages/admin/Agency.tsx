import { useState, useEffect, useCallback } from 'react';
import { Building2, Key, Plus, Trash2, Copy, Users, DollarSign, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Stat, Pill, PrimaryBtn, GhostBtn,
} from '../../components/pro/ProBlocks';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgencyClient {
  id: string;
  name: string;
  status: string;
  monthlyFee: number | null;
}

interface Agency {
  id: string;
  name: string;
  slug: string;
}

interface AgencyStats {
  agency: Agency;
  clientCount: number;
  activeClients: number;
  totalMrr: number;
  commission: number;
  clients: AgencyClient[];
}

interface ApiKey {
  id: string;
  name: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface CreateAgencyForm {
  name: string;
  slug: string;
  commissionPct: number;
}

interface CreateKeyForm {
  name: string;
  permissions: string[];
}

type LoadState = 'idle' | 'loading' | 'error';

const ALL_PERMISSIONS = ['read', 'write', 'admin'] as const;
type Permission = typeof ALL_PERMISSIONS[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clientStatusColor(status: string): 'ok' | 'warn' | 'bad' | 'neutral' {
  switch (status.toLowerCase()) {
    case 'active':   return 'ok';
    case 'trial':    return 'warn';
    case 'inactive': return 'bad';
    default:         return 'neutral';
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtMrr(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card>
      <div className="p-4 space-y-3 animate-pulse">
        <div className="h-3 rounded" style={{ background: 'rgba(255,255,255,0.06)', width: '40%' }} />
        <div className="h-7 rounded" style={{ background: 'rgba(255,255,255,0.06)', width: '60%' }} />
      </div>
    </Card>
  );
}

// ─── Agency Creation Form ──────────────────────────────────────────────────────

function AgencyCreateForm({ onCreate }: { onCreate: (stats: AgencyStats) => void }) {
  const { add } = useToast();
  const [form, setForm] = useState<CreateAgencyForm>({ name: '', slug: '', commissionPct: 20 });
  const [saving, setSaving] = useState(false);

  function handleNameChange(name: string) {
    setForm(prev => ({ ...prev, name, slug: slugify(name) }));
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.slug.trim()) {
      add('Nom et slug requis', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post<AgencyStats>('/agency', form);
      add('Agence créée avec succès', 'success');
      onCreate(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la création';
      add(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${pro.border}`,
    borderRadius: 10,
    color: pro.text,
    fontSize: 13,
    padding: '8px 12px',
    outline: 'none',
    width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: pro.textTer,
    marginBottom: 6,
    display: 'block',
  };

  return (
    <Card>
      <div className="p-5 space-y-4">
        <SectionHead title="Créer une agence" />
        <div className="space-y-3">
          <div>
            <label style={labelStyle}>Nom de l'agence</label>
            <input
              style={inputStyle}
              placeholder="Mon Agence SAS"
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Slug (identifiant URL)</label>
            <input
              style={inputStyle}
              placeholder="mon-agence"
              value={form.slug}
              onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Commission revendeur — {form.commissionPct}%</label>
            <input
              type="range"
              min={10}
              max={40}
              step={5}
              value={form.commissionPct}
              onChange={e => setForm(prev => ({ ...prev, commissionPct: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: pro.accent }}
            />
            <div className="flex justify-between mt-1" style={{ fontSize: 11, color: pro.textTer }}>
              <span>10%</span><span>40%</span>
            </div>
          </div>
        </div>
        <PrimaryBtn onClick={handleSubmit} disabled={saving}>
          <Building2 size={14} />
          {saving ? 'Création…' : "Créer l'agence"}
        </PrimaryBtn>
      </div>
    </Card>
  );
}

// ─── Client Row ───────────────────────────────────────────────────────────────

function ClientRow({ client }: { client: AgencyClient }) {
  return (
    <tr
      style={{
        borderBottom: `1px solid ${pro.border}`,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
    >
      <td className="py-3 px-4" style={{ fontSize: 13, color: pro.text }}>{client.name}</td>
      <td className="py-3 px-4">
        <Pill color={clientStatusColor(client.status)}>{client.status}</Pill>
      </td>
      <td className="py-3 px-4 stat-num text-right" style={{ fontSize: 13, color: pro.textSec }}>
        {client.monthlyFee != null ? fmtMrr(client.monthlyFee) : '—'}
      </td>
    </tr>
  );
}

// ─── API Key Row ───────────────────────────────────────────────────────────────

function ApiKeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: (id: string) => void }) {
  const { add } = useToast();

  function copyKey() {
    navigator.clipboard.writeText(apiKey.id).then(() => add('Copié!', 'success'));
  }

  return (
    <tr
      style={{
        borderBottom: `1px solid ${pro.border}`,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
    >
      <td className="py-3 px-4">
        <p style={{ fontSize: 13, color: pro.text }}>{apiKey.name}</p>
        <p style={{ fontSize: 11, color: pro.textTer }}>Créée le {fmtDate(apiKey.createdAt)}</p>
      </td>
      <td className="py-3 px-4">
        <div className="flex flex-wrap gap-1">
          {apiKey.permissions.map(p => (
            <Pill key={p} color="accent">{p}</Pill>
          ))}
        </div>
      </td>
      <td className="py-3 px-4 stat-num" style={{ fontSize: 12, color: pro.textTer }}>
        {fmtDate(apiKey.lastUsedAt)}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={copyKey}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Copier l'ID"
            style={{ color: pro.textSec }}
          >
            <Copy size={13} />
          </button>
          <button
            onClick={() => onRevoke(apiKey.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/[0.1] transition-colors"
            title="Révoquer"
            style={{ color: pro.bad }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── New Key Form ─────────────────────────────────────────────────────────────

function NewKeyForm({ onCreated }: { onCreated: (keys: ApiKey[]) => void }) {
  const { add } = useToast();
  const [form, setForm] = useState<CreateKeyForm>({ name: '', permissions: ['read'] });
  const [saving, setSaving] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  function togglePermission(p: Permission) {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(p)
        ? prev.permissions.filter(x => x !== p)
        : [...prev.permissions, p],
    }));
  }

  async function handleCreate() {
    if (!form.name.trim()) { add('Nom requis', 'error'); return; }
    if (form.permissions.length === 0) { add('Sélectionnez au moins une permission', 'error'); return; }
    setSaving(true);
    try {
      const { data } = await api.post<{ key: string; keys: ApiKey[] }>('/agency/api-keys', form);
      setNewKeyValue(data.key);
      onCreated(data.keys);
      setForm({ name: '', permissions: ['read'] });
      add('Clé créée — copiez-la maintenant!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      add(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  function copyNewKey() {
    if (!newKeyValue) return;
    navigator.clipboard.writeText(newKeyValue).then(() => add('Copié!', 'success'));
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${pro.border}`,
    borderRadius: 10,
    color: pro.text,
    fontSize: 13,
    padding: '7px 11px',
    outline: 'none',
    flex: 1,
  };

  return (
    <Card>
      <div className="p-4 space-y-3">
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: pro.textTer }}>
          Nouvelle clé
        </p>

        {newKeyValue && (
          <div
            className="rounded-xl p-3 space-y-2"
            style={{ background: 'rgba(34,197,94,0.06)', border: `1px solid rgba(34,197,94,0.2)` }}
          >
            <p style={{ fontSize: 11, color: pro.ok, fontWeight: 600 }}>
              Copiez cette clé maintenant — elle ne sera plus affichée.
            </p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 truncate rounded-lg px-2 py-1.5"
                style={{ fontSize: 11, background: 'rgba(0,0,0,0.3)', color: pro.text, fontFamily: 'monospace' }}
              >
                {newKeyValue}
              </code>
              <button
                onClick={copyNewKey}
                className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors flex-shrink-0"
                style={{ color: pro.ok }}
              >
                <Copy size={13} />
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            style={inputStyle}
            placeholder="Nom de la clé"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_PERMISSIONS.map(p => {
            const active = form.permissions.includes(p);
            return (
              <button
                key={p}
                onClick={() => togglePermission(p)}
                className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-colors"
                style={{
                  background: active ? 'rgba(123,92,240,0.15)' : 'rgba(255,255,255,0.04)',
                  color: active ? pro.accent : pro.textSec,
                  border: `1px solid ${active ? pro.accent : pro.border}`,
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        <PrimaryBtn onClick={handleCreate} disabled={saving} size="sm">
          <Plus size={13} />
          {saving ? 'Création…' : 'Créer la clé'}
        </PrimaryBtn>
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Agency() {
  const { add, toasts, remove } = useToast();
  const [statsState, setStatsState]   = useState<LoadState>('loading');
  const [keysState, setKeysState]     = useState<LoadState>('loading');
  const [agencyStats, setAgencyStats] = useState<AgencyStats | null>(null);
  const [apiKeys, setApiKeys]         = useState<ApiKey[]>([]);
  const [showNewKey, setShowNewKey]   = useState(false);

  const fetchStats = useCallback(async () => {
    setStatsState('loading');
    try {
      const { data } = await api.get<AgencyStats | null>('/agency/me');
      setAgencyStats(data);
      setStatsState('idle');
    } catch {
      setStatsState('error');
    }
  }, []);

  const fetchKeys = useCallback(async () => {
    setKeysState('loading');
    try {
      const { data } = await api.get<ApiKey[]>('/agency/api-keys');
      setApiKeys(data);
      setKeysState('idle');
    } catch {
      setKeysState('error');
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchKeys();
  }, [fetchStats, fetchKeys]);

  async function revokeKey(id: string) {
    try {
      await api.delete(`/agency/api-keys/${id}`);
      setApiKeys(prev => prev.filter(k => k.id !== id));
      add('Clé révoquée', 'success');
    } catch {
      add('Erreur lors de la révocation', 'error');
    }
  }

  function handleAgencyCreated(stats: AgencyStats) {
    setAgencyStats(stats);
    setStatsState('idle');
  }

  function handleKeysCreated(keys: ApiKey[]) {
    setApiKeys(keys);
    setShowNewKey(false);
  }

  const thStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: pro.textTer,
    padding: '8px 16px',
    textAlign: 'left',
    borderBottom: `1px solid ${pro.border}`,
  };

  return (
    <div className="space-y-5 admin-page">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Agences & API"
        subtitle="Programme revendeur + accès API"
        right={
          <GhostBtn onClick={() => { fetchStats(); fetchKeys(); }} size="sm">
            <RefreshCw size={13} />
            Actualiser
          </GhostBtn>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Left: Agency section (60%) ── */}
        <div className="lg:col-span-3 space-y-5">
          {statsState === 'loading' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          )}

          {statsState === 'error' && (
            <Card>
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Pill color="bad">Erreur</Pill>
                  <span style={{ fontSize: 13, color: pro.textSec }}>Impossible de charger les données agence</span>
                </div>
                <GhostBtn onClick={fetchStats} size="sm">
                  <RefreshCw size={13} />
                  Réessayer
                </GhostBtn>
              </div>
            </Card>
          )}

          {statsState === 'idle' && !agencyStats && (
            <AgencyCreateForm onCreate={handleAgencyCreated} />
          )}

          {statsState === 'idle' && agencyStats && (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Stat
                  label="Clients"
                  value={agencyStats.clientCount}
                  icon={Users}
                  hint="Total clients gérés"
                />
                <Stat
                  label="Clients actifs"
                  value={agencyStats.activeClients}
                  icon={Users}
                  accent
                />
                <Stat
                  label="MRR géré"
                  value={fmtMrr(agencyStats.totalMrr)}
                  icon={DollarSign}
                  hint="Revenu mensuel récurrent total"
                />
                <Stat
                  label="Commission mensuelle"
                  value={fmtMrr(agencyStats.commission)}
                  icon={DollarSign}
                  hint={`Agence: ${agencyStats.agency.slug}`}
                />
              </div>

              {/* Client list */}
              <Card>
                <div className="px-4 pt-4">
                  <SectionHead title="Clients" />
                </div>
                {agencyStats.clients.length === 0 ? (
                  <div className="py-10 text-center" style={{ fontSize: 13, color: pro.textTer }}>
                    Aucun client pour cette agence
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th style={thStyle}>Nom</th>
                          <th style={thStyle}>Statut</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Mensuel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agencyStats.clients.map(c => (
                          <ClientRow key={c.id} client={c} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>

        {/* ── Right: API Keys section (40%) ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="px-4 pt-4 pb-2">
              <SectionHead
                title="Clés API"
                action={
                  <GhostBtn onClick={() => setShowNewKey(v => !v)} size="sm">
                    <Key size={13} />
                    Nouvelle clé
                  </GhostBtn>
                }
              />
            </div>

            {showNewKey && (
              <div className="px-4 pb-4">
                <NewKeyForm onCreated={handleKeysCreated} />
              </div>
            )}

            {keysState === 'loading' && (
              <div className="px-4 pb-4 space-y-2 animate-pulse">
                {[0, 1].map(i => (
                  <div key={i} className="h-12 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
                ))}
              </div>
            )}

            {keysState === 'error' && (
              <div className="px-4 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill color="bad">Erreur</Pill>
                  <span style={{ fontSize: 12, color: pro.textSec }}>Impossible de charger les clés</span>
                </div>
                <GhostBtn onClick={fetchKeys} size="sm">
                  <RefreshCw size={13} />
                  Réessayer
                </GhostBtn>
              </div>
            )}

            {keysState === 'idle' && apiKeys.length === 0 && !showNewKey && (
              <div className="py-8 text-center" style={{ fontSize: 13, color: pro.textTer }}>
                Aucune clé API — créez-en une pour commencer
              </div>
            )}

            {keysState === 'idle' && apiKeys.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th style={thStyle}>Nom</th>
                      <th style={thStyle}>Permissions</th>
                      <th style={thStyle}>Dernier usage</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map(k => (
                      <ApiKeyRow key={k.id} apiKey={k} onRevoke={revokeKey} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-4 pb-4 pt-2">
              <p style={{ fontSize: 11, color: pro.textTer }}>
                <Building2 size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                Les clés API donnent accès à l'API Qwillio au nom de votre compte.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
