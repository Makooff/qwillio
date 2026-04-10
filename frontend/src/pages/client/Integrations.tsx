import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Link2, Unlink, RefreshCw, CheckCircle2, XCircle,
  ArrowLeftRight, ArrowRight, Clock, Database,
  TestTube, Loader2
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

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

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
          </motion.div>
        ))}
      </div>
    </div>
  );
}
