import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Link2, Unlink, RefreshCw, CheckCircle2, XCircle,
  ArrowLeftRight, ArrowRight, Clock, Database,
  TestTube, Loader2, AlertTriangle, ChevronDown, ChevronUp, MapPin
} from 'lucide-react';
import api from '../../services/api';

interface Integration {
  id: string;
  name: string;
  category: 'crm' | 'accounting' | 'payment' | 'calendar' | 'automation';
  connected: boolean;
  lastSync?: string;
  contactsSynced?: number;
  syncDirection: 'one_way' | 'bidirectional';
}

// Available integrations catalog (static — enriched with real status from API)
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

function timeAgo(date: string | null | undefined): string | undefined {
  if (!date) return undefined;
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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

// Generic fallback for integrations without specific mapping
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
        const connectedMap = new Map<string, any>();
        (data.integrations || data || []).forEach((i: any) => {
          connectedMap.set(i.provider || i.id, i);
        });

        const merged: Integration[] = INTEGRATION_CATALOG.map(cat => {
          const real = connectedMap.get(cat.id);
          return {
            ...cat,
            connected: !!real,
            lastSync: timeAgo(real?.lastSync),
            contactsSynced: real?.contactsSynced,
            syncDirection: real?.syncDirection || cat.syncDirection,
          };
        });
        setIntegrations(merged);

        // Fetch sync conflicts
        try {
          const conflictsRes = await api.get('/crm/sync-conflicts');
          setConflicts((conflictsRes.data.conflicts || conflictsRes.data || []).map((c: any) => ({
            id: c.id,
            integrationId: c.integrationId || c.provider,
            integrationName: c.integrationName || c.provider || 'Unknown',
            field: c.field,
            qwillioValue: c.localValue || c.qwillioValue || '',
            externalValue: c.remoteValue || c.externalValue || '',
            contactName: c.contactName || c.contact?.name || 'Unknown contact',
            createdAt: c.createdAt,
          })));
        } catch {
          // No conflicts endpoint yet — show empty
          setConflicts([]);
        }
      } catch {
        // Fallback to catalog with nothing connected
        setIntegrations(INTEGRATION_CATALOG.map(c => ({ ...c, connected: false })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = filter === 'all'
    ? integrations
    : filter === 'connected'
      ? integrations.filter(i => i.connected)
      : integrations.filter(i => i.category === filter);

  const connectedCount = integrations.filter(i => i.connected).length;

  const toggleConnect = async (id: string) => {
    const integration = integrations.find(i => i.id === id);
    if (!integration) return;

    if (integration.connected) {
      // Disconnect
      try {
        await api.delete(`/crm/integrations/${id}`);
      } catch {}
    } else {
      // Connect
      try {
        await api.post('/crm/integrations', { provider: id, config: {} });
      } catch {}
    }

    setIntegrations(prev => prev.map(i =>
      i.id === id ? {
        ...i,
        connected: !i.connected,
        lastSync: !i.connected ? 'Just now' : undefined,
        contactsSynced: !i.connected ? 0 : undefined,
      } : i
    ));
  };

  const toggleDirection = (id: string) => {
    setIntegrations(prev => prev.map(i =>
      i.id === id ? {
        ...i,
        syncDirection: i.syncDirection === 'one_way' ? 'bidirectional' : 'one_way',
      } : i
    ));
  };

  const resolveConflict = async (conflictId: string, resolution: 'local' | 'remote') => {
    try {
      await api.post(`/crm/sync-conflicts/${conflictId}/resolve`, { resolution });
    } catch {
      // Optimistic removal even if API fails
    }
    setConflicts(prev => prev.filter(c => c.id !== conflictId));
  };

  const toggleFieldMapping = (integrationId: string) => {
    setExpandedMappings(prev => {
      const next = new Set(prev);
      if (next.has(integrationId)) next.delete(integrationId);
      else next.add(integrationId);
      return next;
    });
  };

  const syncNow = async (id: string) => {
    try {
      await api.post(`/crm/integrations/${id}/sync`);
      setIntegrations(prev => prev.map(i =>
        i.id === id ? { ...i, lastSync: 'Just now' } : i
      ));
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#6366f1]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">Integrations</h1>
          <p className="text-sm text-[#86868b] mt-1">{connectedCount} connected · {integrations.length} available</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'connected', 'crm', 'accounting', 'payment', 'calendar', 'automation'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-[#6366f1] text-white'
                : 'bg-white border border-[#d2d2d7]/60 text-[#1d1d1f] hover:bg-[#f5f5f7]'
            }`}
          >
            {f === 'all' ? 'All' : f === 'connected' ? 'Connected' : CATEGORY_LABELS[f] || f}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((integration, idx) => (
          <motion.div
            key={integration.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-5 hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                  integration.connected ? 'bg-green-50 text-green-600' : 'bg-[#f5f5f7] text-[#86868b]'
                }`}>
                  {integration.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-[#1d1d1f]">{integration.name}</h3>
                  <span className="text-xs text-[#86868b] uppercase">{CATEGORY_LABELS[integration.category]}</span>
                </div>
              </div>
              {integration.connected ? (
                <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                  <CheckCircle2 size={14} /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-[#86868b]">
                  <XCircle size={14} /> Disconnected
                </span>
              )}
            </div>

            {/* Stats (if connected) */}
            {integration.connected && (
              <div className="flex gap-4 mb-4 text-xs text-[#86868b]">
                {integration.lastSync && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {integration.lastSync}
                  </span>
                )}
                {integration.contactsSynced !== undefined && (
                  <span className="flex items-center gap-1">
                    <Database size={12} /> {integration.contactsSynced} contacts
                  </span>
                )}
              </div>
            )}

            {/* Sync direction */}
            {integration.connected && (
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => toggleDirection(integration.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f5f5f7] text-xs font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors"
                >
                  {integration.syncDirection === 'bidirectional' ? (
                    <><ArrowLeftRight size={12} /> Bidirectional</>
                  ) : (
                    <><ArrowRight size={12} /> One-way</>
                  )}
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => toggleConnect(integration.id)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  integration.connected
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-[#6366f1] text-white hover:bg-[#5558e6]'
                }`}
              >
                {integration.connected ? <><Unlink size={14} /> Disconnect</> : <><Link2 size={14} /> Connect</>}
              </button>
              {integration.connected && (
                <>
                  <button onClick={() => syncNow(integration.id)} className="p-2 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors" title="Sync now">
                    <RefreshCw size={16} />
                  </button>
                  <button className="p-2 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors" title="Test connection">
                    <TestTube size={16} />
                  </button>
                </>
              )}
            </div>

            {/* Field Mapping (read-only) */}
            {integration.connected && (
              <div className="mt-3 border-t border-[#d2d2d7]/40 pt-3">
                <button
                  onClick={() => toggleFieldMapping(integration.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                >
                  <MapPin size={12} />
                  Field Mapping
                  {expandedMappings.has(integration.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {expandedMappings.has(integration.id) && (
                  <div className="mt-2 space-y-1">
                    {(DEFAULT_FIELD_MAPPINGS[integration.id] || GENERIC_FIELD_MAPPING).map((m, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-[#86868b] bg-[#f5f5f7] rounded-lg px-2.5 py-1.5">
                        <span className="font-medium text-[#1d1d1f]">{m.qwillio}</span>
                        <ArrowRight size={10} className="flex-shrink-0" />
                        <span className="font-mono">{m.external}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Sync Conflicts Section */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className={conflicts.length > 0 ? 'text-amber-500' : 'text-[#86868b]'} />
          <h2 className="text-lg font-semibold text-[#1d1d1f]">Sync Conflicts</h2>
          {conflicts.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">{conflicts.length}</span>
          )}
        </div>

        {conflicts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-8 text-center">
            <CheckCircle2 size={32} className="text-green-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-[#1d1d1f]">No sync conflicts</p>
            <p className="text-xs text-[#86868b] mt-1">All your data is in sync across integrations.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conflicts.map(conflict => (
              <div key={conflict.id} className="bg-white rounded-2xl border border-amber-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1d1d1f]">{conflict.contactName}</p>
                    <p className="text-xs text-[#86868b]">{conflict.integrationName} &middot; Field: <span className="font-medium">{conflict.field}</span></p>
                  </div>
                  {conflict.createdAt && (
                    <span className="text-xs text-[#86868b]">{new Date(conflict.createdAt).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-[#f5f5f7] rounded-lg p-3">
                    <p className="text-[10px] uppercase font-medium text-[#86868b] mb-1">Qwillio</p>
                    <p className="text-sm text-[#1d1d1f] font-medium truncate">{conflict.qwillioValue || '(empty)'}</p>
                  </div>
                  <div className="bg-[#f5f5f7] rounded-lg p-3">
                    <p className="text-[10px] uppercase font-medium text-[#86868b] mb-1">External</p>
                    <p className="text-sm text-[#1d1d1f] font-medium truncate">{conflict.externalValue || '(empty)'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolveConflict(conflict.id, 'local')}
                    className="flex-1 py-2 rounded-xl text-sm font-medium bg-[#6366f1] text-white hover:bg-[#5558e6] transition-colors"
                  >
                    Keep Qwillio
                  </button>
                  <button
                    onClick={() => resolveConflict(conflict.id, 'remote')}
                    className="flex-1 py-2 rounded-xl text-sm font-medium border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
                  >
                    Keep External
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
