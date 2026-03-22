import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Link2, Unlink, RefreshCw, CheckCircle2, XCircle,
  ArrowLeftRight, ArrowRight, Clock, Database,
  TestTube, Settings2
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  category: 'crm' | 'accounting' | 'payment' | 'calendar' | 'automation';
  connected: boolean;
  lastSync?: string;
  contactsSynced?: number;
  syncDirection: 'one_way' | 'bidirectional';
}

const INTEGRATIONS: Integration[] = [
  { id: 'hubspot', name: 'HubSpot', category: 'crm', connected: false, syncDirection: 'bidirectional' },
  { id: 'salesforce', name: 'Salesforce', category: 'crm', connected: false, syncDirection: 'bidirectional' },
  { id: 'pipedrive', name: 'Pipedrive', category: 'crm', connected: false, syncDirection: 'bidirectional' },
  { id: 'zoho', name: 'Zoho CRM', category: 'crm', connected: false, syncDirection: 'bidirectional' },
  { id: 'gohighlevel', name: 'GoHighLevel', category: 'crm', connected: false, syncDirection: 'bidirectional' },
  { id: 'google-sheets', name: 'Google Sheets', category: 'crm', connected: false, syncDirection: 'one_way' },
  { id: 'notion', name: 'Notion', category: 'crm', connected: false, syncDirection: 'one_way' },
  { id: 'quickbooks', name: 'QuickBooks', category: 'accounting', connected: false, syncDirection: 'bidirectional' },
  { id: 'wave', name: 'Wave', category: 'accounting', connected: false, syncDirection: 'bidirectional' },
  { id: 'stripe', name: 'Stripe', category: 'payment', connected: true, lastSync: '2 min ago', contactsSynced: 47, syncDirection: 'bidirectional' },
  { id: 'google-calendar', name: 'Google Calendar', category: 'calendar', connected: true, lastSync: '5 min ago', contactsSynced: 23, syncDirection: 'bidirectional' },
  { id: 'zapier', name: 'Zapier', category: 'automation', connected: false, syncDirection: 'one_way' },
];

const CATEGORY_LABELS: Record<string, string> = {
  crm: 'CRM',
  accounting: 'Accounting',
  payment: 'Payment',
  calendar: 'Calendar',
  automation: 'Automation',
};

export default function Integrations() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all'
    ? integrations
    : filter === 'connected'
      ? integrations.filter(i => i.connected)
      : integrations.filter(i => i.category === filter);

  const connectedCount = integrations.filter(i => i.connected).length;

  const toggleConnect = (id: string) => {
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
                  <button className="p-2 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors" title="Sync now">
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
