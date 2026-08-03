import { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowLeftRight, ArrowRight, CheckCircle2, ChevronDown, ChevronUp,
  Clock, Database, Link2, MapPin, RefreshCw, TestTube, Unlink, XCircle,
} from 'lucide-react';
import api from '../../../services/api';
import {
  Card, DangerBtn, EmptyState, GhostBtn, PageActions, Pill, PrimaryBtn, SectionHead,
} from '../../../components/v2/app/Blocks';

/* Intégrations, registre produit V2 (DA/v2-direction.md, addendum). Logique de
   données identique à la V1: GET/POST/DELETE /crm/integrations,
   POST /crm/integrations/:id/sync, GET /crm/sync-conflicts,
   POST /crm/sync-conflicts/:id/resolve. */

interface Integration {
  id: string;
  name: string;
  category: 'crm' | 'accounting' | 'payment' | 'calendar' | 'automation';
  connected: boolean;
  lastSync?: string;
  contactsSynced?: number;
  syncDirection: 'one_way' | 'bidirectional';
}

interface RawIntegration {
  id?: string;
  provider?: string;
  lastSync?: string;
  contactsSynced?: number;
  syncDirection?: 'one_way' | 'bidirectional';
}

interface RawConflict {
  id: string;
  integrationId?: string;
  provider?: string;
  integrationName?: string;
  field: string;
  localValue?: string;
  qwillioValue?: string;
  remoteValue?: string;
  externalValue?: string;
  contactName?: string;
  contact?: { name?: string };
  createdAt: string;
}

interface SyncConflict {
  id: string;
  integrationId: string;
  integrationName: string;
  field: string;
  qwillioValue: string;
  externalValue: string;
  contactName: string;
  createdAt: string;
}

/* Catalogue statique, enrichi du statut réel renvoyé par l'API */
const INTEGRATION_CATALOG: Omit<Integration, 'connected' | 'lastSync' | 'contactsSynced'>[] = [
  { id: 'hubspot', name: 'HubSpot', category: 'crm', syncDirection: 'bidirectional' },
  { id: 'salesforce', name: 'Salesforce', category: 'crm', syncDirection: 'bidirectional' },
  { id: 'pipedrive', name: 'Pipedrive', category: 'crm', syncDirection: 'bidirectional' },
  { id: 'zoho', name: 'Zoho CRM', category: 'crm', syncDirection: 'bidirectional' },
  { id: 'gohighlevel', name: 'GoHighLevel', category: 'crm', syncDirection: 'bidirectional' },
  { id: 'google-sheets', name: 'Google Sheets', category: 'crm', syncDirection: 'one_way' },
  { id: 'notion', name: 'Notion', category: 'crm', syncDirection: 'one_way' },
  { id: 'quickbooks', name: 'QuickBooks', category: 'accounting', syncDirection: 'bidirectional' },
  { id: 'wave', name: 'Wave', category: 'accounting', syncDirection: 'bidirectional' },
  { id: 'stripe', name: 'Stripe', category: 'payment', syncDirection: 'bidirectional' },
  { id: 'google-calendar', name: 'Google Calendar', category: 'calendar', syncDirection: 'bidirectional' },
  { id: 'zapier', name: 'Zapier', category: 'automation', syncDirection: 'one_way' },
];

const CATEGORY_LABELS: Record<string, string> = {
  crm: 'CRM',
  accounting: 'Accounting',
  payment: 'Payment',
  calendar: 'Calendar',
  automation: 'Automation',
};

const CATEGORY_ORDER = ['crm', 'accounting', 'payment', 'calendar', 'automation'];
const FILTERS = ['all', 'connected', 'crm', 'accounting', 'payment', 'calendar', 'automation'];

function timeAgo(date: string | null | undefined): string | undefined {
  if (!date) return undefined;
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const DEFAULT_FIELD_MAPPINGS: Record<string, { qwillio: string; external: string }[]> = {
  hubspot: [
    { qwillio: 'name', external: 'firstname + lastname' },
    { qwillio: 'email', external: 'email' },
    { qwillio: 'phone', external: 'phone' },
    { qwillio: 'company', external: 'company' },
    { qwillio: 'notes', external: 'description' },
  ],
  salesforce: [
    { qwillio: 'name', external: 'Name' },
    { qwillio: 'email', external: 'Email' },
    { qwillio: 'phone', external: 'Phone' },
    { qwillio: 'company', external: 'Account.Name' },
    { qwillio: 'notes', external: 'Description' },
  ],
  pipedrive: [
    { qwillio: 'name', external: 'name' },
    { qwillio: 'email', external: 'email[0].value' },
    { qwillio: 'phone', external: 'phone[0].value' },
    { qwillio: 'company', external: 'org_name' },
    { qwillio: 'notes', external: 'notes' },
  ],
};

/* Repli générique pour les intégrations sans mapping spécifique */
const GENERIC_FIELD_MAPPING = [
  { qwillio: 'name', external: 'name' },
  { qwillio: 'email', external: 'email' },
  { qwillio: 'phone', external: 'phone' },
  { qwillio: 'company', external: 'company' },
  { qwillio: 'notes', external: 'notes' },
];

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [expandedMappings, setExpandedMappings] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/crm/integrations');
        const connectedMap = new Map<string, RawIntegration>();
        (data.integrations || data || []).forEach((i: RawIntegration) => {
          const key = i.provider ?? i.id;
          if (key) connectedMap.set(key, i);
        });

        const merged: Integration[] = INTEGRATION_CATALOG.map((cat) => {
          const real = connectedMap.get(cat.id);
          return {
            ...cat,
            connected: !!real,
            lastSync: timeAgo(real?.lastSync),
            contactsSynced: real?.contactsSynced,
            syncDirection: real?.syncDirection ?? cat.syncDirection,
          };
        });
        setIntegrations(merged);

        try {
          const conflictsRes = await api.get('/crm/sync-conflicts');
          setConflicts((conflictsRes.data.conflicts || conflictsRes.data || []).map((c: RawConflict) => ({
            id: c.id,
            integrationId: c.integrationId ?? c.provider ?? '',
            integrationName: c.integrationName ?? c.provider ?? 'Unknown',
            field: c.field,
            qwillioValue: c.localValue ?? c.qwillioValue ?? '',
            externalValue: c.remoteValue ?? c.externalValue ?? '',
            contactName: c.contactName ?? c.contact?.name ?? 'Unknown contact',
            createdAt: c.createdAt,
          })));
        } catch {
          /* endpoint conflits absent: liste vide */
          setConflicts([]);
        }
      } catch {
        /* repli sur le catalogue, rien de connecté */
        setIntegrations(INTEGRATION_CATALOG.map((c) => ({ ...c, connected: false })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = filter === 'all'
    ? integrations
    : filter === 'connected'
      ? integrations.filter((i) => i.connected)
      : integrations.filter((i) => i.category === filter);

  const connectedCount = integrations.filter((i) => i.connected).length;

  const toggleConnect = async (id: string) => {
    const integration = integrations.find((i) => i.id === id);
    if (!integration) return;

    if (integration.connected) {
      try {
        await api.delete(`/crm/integrations/${id}`);
      } catch {
        /* bascule optimiste malgré l'erreur API */
      }
    } else {
      try {
        await api.post('/crm/integrations', { provider: id, config: {} });
      } catch {
        /* bascule optimiste malgré l'erreur API */
      }
    }

    setIntegrations((prev) => prev.map((i) =>
      i.id === id ? {
        ...i,
        connected: !i.connected,
        lastSync: !i.connected ? 'Just now' : undefined,
        contactsSynced: !i.connected ? 0 : undefined,
      } : i,
    ));
  };

  const toggleDirection = (id: string) => {
    setIntegrations((prev) => prev.map((i) =>
      i.id === id ? {
        ...i,
        syncDirection: i.syncDirection === 'one_way' ? 'bidirectional' : 'one_way',
      } : i,
    ));
  };

  const resolveConflict = async (conflictId: string, resolution: 'local' | 'remote') => {
    try {
      await api.post(`/crm/sync-conflicts/${conflictId}/resolve`, { resolution });
    } catch {
      /* retrait optimiste même si l'API échoue */
    }
    setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
  };

  const toggleFieldMapping = (integrationId: string) => {
    setExpandedMappings((prev) => {
      const next = new Set(prev);
      if (next.has(integrationId)) next.delete(integrationId);
      else next.add(integrationId);
      return next;
    });
  };

  const syncNow = async (id: string) => {
    try {
      await api.post(`/crm/integrations/${id}/sync`);
      setIntegrations((prev) => prev.map((i) =>
        i.id === id ? { ...i, lastSync: 'Just now' } : i,
      ));
    } catch {
      /* silencieux: l'UI garde l'horodatage précédent */
    }
  };

  const groups = CATEGORY_ORDER
    .map((cat) => ({ cat, items: filtered.filter((i) => i.category === cat) }))
    .filter((g) => g.items.length > 0);

  const iconBtn =
    'w-8 h-8 rounded-lg flex items-center justify-center text-q2-fog border border-q2-graphite-d hover:text-q2-mist hover:border-q2-smoke-d transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50';

  if (loading) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading integrations" className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl border border-q2-graphite-d bg-q2-carbon animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <PageActions subtitle={`${connectedCount} connected · ${integrations.length} available`} />

      <div
        role="group"
        aria-label="Filter integrations"
        className="inline-flex flex-wrap items-center gap-1 rounded-full bg-q2-obsidian border border-q2-graphite-d p-1 mb-5"
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`h-7 px-3 rounded-full text-[12px] font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
              filter === f ? 'bg-q2-indigo text-white' : 'text-q2-fog hover:text-q2-mist'
            }`}
          >
            {f === 'all' ? 'All' : f === 'connected' ? 'Connected' : CATEGORY_LABELS[f] || f}
          </button>
        ))}
      </div>

      {/* Catalogue en rangées groupées par catégorie */}
      <div className="space-y-6">
        {groups.map(({ cat, items }) => (
          <section key={cat}>
            <SectionHead title={CATEGORY_LABELS[cat]} />
            <Card pad={false}>
              {items.map((integration, idx) => {
                const expanded = expandedMappings.has(integration.id);
                return (
                  <div key={integration.id} className={idx === 0 ? '' : 'border-t border-q2-graphite-d'}>
                    <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3.5">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className={`w-8 h-8 shrink-0 rounded-lg bg-q2-obsidian flex items-center justify-center text-[11px] font-semibold ${
                            integration.connected ? 'text-q2-lift' : 'text-q2-fog'
                          }`}
                          aria-hidden="true"
                        >
                          {integration.name.substring(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-medium text-white truncate">{integration.name}</p>
                          {integration.connected && (integration.lastSync || integration.contactsSynced !== undefined) ? (
                            <div className="flex items-center gap-3 text-[11.5px] text-q2-fog tabular-nums">
                              {integration.lastSync && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock size={11} aria-hidden="true" /> {integration.lastSync}
                                </span>
                              )}
                              {integration.contactsSynced !== undefined && (
                                <span className="inline-flex items-center gap-1">
                                  <Database size={11} aria-hidden="true" /> {integration.contactsSynced} contacts
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11.5px] text-q2-fog truncate">{CATEGORY_LABELS[integration.category]}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {integration.connected ? (
                          <Pill tone="ok"><CheckCircle2 size={11} aria-hidden="true" /> Connected</Pill>
                        ) : (
                          <Pill><XCircle size={11} aria-hidden="true" /> Disconnected</Pill>
                        )}

                        {integration.connected && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleDirection(integration.id)}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium text-q2-mist border border-q2-graphite-d hover:border-q2-smoke-d transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                            >
                              {integration.syncDirection === 'bidirectional' ? (
                                <><ArrowLeftRight size={12} aria-hidden="true" /> Bidirectional</>
                              ) : (
                                <><ArrowRight size={12} aria-hidden="true" /> One-way</>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => syncNow(integration.id)}
                              aria-label={`Sync ${integration.name} now`}
                              title="Sync now"
                              className={iconBtn}
                            >
                              <RefreshCw size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Test ${integration.name} connection`}
                              title="Test connection"
                              className={iconBtn}
                            >
                              <TestTube size={14} aria-hidden="true" />
                            </button>
                          </>
                        )}

                        {integration.connected ? (
                          <DangerBtn type="button" onClick={() => toggleConnect(integration.id)} className="h-8">
                            <Unlink size={13} aria-hidden="true" /> Disconnect
                          </DangerBtn>
                        ) : (
                          <GhostBtn type="button" onClick={() => toggleConnect(integration.id)} className="h-8">
                            <Link2 size={13} aria-hidden="true" /> Connect
                          </GhostBtn>
                        )}
                      </div>
                    </div>

                    {/* Mapping de champs (lecture seule) */}
                    {integration.connected && (
                      <div className="px-4 pb-3.5">
                        <button
                          type="button"
                          onClick={() => toggleFieldMapping(integration.id)}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? 'Hide' : 'Show'} field mapping for ${integration.name}`}
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-q2-fog hover:text-q2-mist transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded"
                        >
                          <MapPin size={12} aria-hidden="true" />
                          Field Mapping
                          {expanded ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
                        </button>
                        {expanded && (
                          <div className="mt-2 rounded-xl border border-q2-graphite-d overflow-hidden">
                            {(DEFAULT_FIELD_MAPPINGS[integration.id] || GENERIC_FIELD_MAPPING).map((m) => (
                              <div
                                key={m.qwillio}
                                className="flex items-center gap-2 px-3 py-2 text-[12px] text-q2-fog border-t border-q2-graphite-d first:border-t-0"
                              >
                                <span className="font-medium text-q2-mist">{m.qwillio}</span>
                                <ArrowRight size={10} className="shrink-0" aria-hidden="true" />
                                <span className="font-mono">{m.external}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          </section>
        ))}
      </div>

      {/* Conflits de synchronisation */}
      <section className="mt-8">
        <SectionHead
          title={
            <span className="inline-flex items-center gap-2">
              <AlertTriangle
                size={13}
                aria-hidden="true"
                style={conflicts.length > 0 ? { color: 'var(--q2p-warn)' } : undefined}
              />
              Sync Conflicts
            </span>
          }
          action={conflicts.length > 0 ? <Pill tone="warn">{conflicts.length}</Pill> : undefined}
        />

        {conflicts.length === 0 ? (
          <Card pad={false}>
            <EmptyState
              icon={CheckCircle2}
              title="No sync conflicts"
              description="All your data is in sync across integrations."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {conflicts.map((conflict) => (
              <Card key={conflict.id}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-white truncate">{conflict.contactName}</p>
                    <p className="text-[11.5px] text-q2-fog truncate">
                      {conflict.integrationName} · Field: <span className="text-q2-mist">{conflict.field}</span>
                    </p>
                  </div>
                  {conflict.createdAt && (
                    <span className="text-[11.5px] text-q2-fog tabular-nums shrink-0">
                      {new Date(conflict.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl border border-q2-graphite-d bg-q2-obsidian p-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-1.5">Qwillio</p>
                    <p className="text-[13px] text-white truncate">{conflict.qwillioValue || '(empty)'}</p>
                  </div>
                  <div className="rounded-xl border border-q2-graphite-d bg-q2-obsidian p-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-1.5">External</p>
                    <p className="text-[13px] text-white truncate">{conflict.externalValue || '(empty)'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PrimaryBtn type="button" onClick={() => resolveConflict(conflict.id, 'local')}>
                    Keep Qwillio
                  </PrimaryBtn>
                  <GhostBtn type="button" onClick={() => resolveConflict(conflict.id, 'remote')}>
                    Keep External
                  </GhostBtn>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
