import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, DollarSign, Calendar, TrendingUp, User, Loader2 } from 'lucide-react';
import api from '../../services/api';

type DealStage = 'new' | 'qualified' | 'appointment' | 'client' | 'inactive' | 'lost';

interface Deal {
  id: string;
  contactName: string;
  title: string;
  value: number;
  probability: number;
  closeDate: string;
  stage: DealStage;
  company?: string;
}

const STAGES: { key: DealStage; label: string; color: string; bgLight: string; border: string }[] = [
  { key: 'new',         label: 'New',         color: '#3b82f6', bgLight: 'bg-blue-50',    border: 'border-blue-200' },
  { key: 'qualified',   label: 'Qualified',   color: '#8b5cf6', bgLight: 'bg-violet-50',  border: 'border-violet-200' },
  { key: 'appointment', label: 'Appointment', color: '#f59e0b', bgLight: 'bg-amber-50',   border: 'border-amber-200' },
  { key: 'client',      label: 'Client',      color: '#10b981', bgLight: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'inactive',    label: 'Inactive',    color: '#6b7280', bgLight: 'bg-gray-50',    border: 'border-gray-200' },
  { key: 'lost',        label: 'Lost',        color: '#ef4444', bgLight: 'bg-red-50',     border: 'border-red-200' },
];

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;
}

export default function CrmDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeal, setNewDeal] = useState({ contactName: '', title: '', value: '', probability: '50', closeDate: '', stage: 'new' as DealStage });

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/crm/deals');
      const mapped = (data.deals || []).map((d: any) => ({
        id: d.id,
        contactName: d.contact?.name || d.contactName || 'Unknown',
        title: d.title || '',
        value: Number(d.value) || 0,
        probability: d.probability ?? 50,
        closeDate: d.closeDate ? new Date(d.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD',
        stage: (d.stage || 'new') as DealStage,
        company: d.contact?.niche || '',
      }));
      setDeals(mapped);
    } catch {
      // Keep existing state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDeals(); }, []);

  const stageDeals = (stage: DealStage) => deals.filter(d => d.stage === stage);
  const stageTotal = (stage: DealStage) => stageDeals(stage).reduce((s, d) => s + d.value, 0);

  const handleAddDeal = async () => {
    if (!newDeal.title || !newDeal.contactName) return;
    try {
      await api.post('/crm/deals', {
        title: newDeal.title,
        stage: newDeal.stage,
        value: parseFloat(newDeal.value) || 0,
        probability: parseInt(newDeal.probability) || 50,
        closeDate: newDeal.closeDate || null,
      });
      setNewDeal({ contactName: '', title: '', value: '', probability: '50', closeDate: '', stage: 'new' });
      setShowAddModal(false);
      fetchDeals();
    } catch {}
  };

  const handleStageChange = async (dealId: string, newStage: DealStage) => {
    try {
      await api.put(`/crm/deals/${dealId}`, { stage: newStage });
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage } : d));
    } catch {}
  };

  const totalPipeline = deals.filter(d => d.stage !== 'lost').reduce((s, d) => s + d.value, 0);
  const wonValue = stageTotal('client');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#6366f1]" size={32} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deal Pipeline</h1>
          <p className="text-sm text-[#86868b]">{deals.length} deals · ${totalPipeline.toLocaleString()} total pipeline</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#6366f1] text-white text-sm font-medium rounded-xl hover:bg-[#4f46e5] transition-colors"
        >
          <Plus size={16} /> Add Deal
        </button>
      </motion.div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Pipeline', value: `$${totalPipeline.toLocaleString()}`, sub: `${deals.filter(d => d.stage !== 'lost').length} active deals`, color: '#6366f1' },
          { label: 'Won (Clients)',   value: `$${wonValue.toLocaleString()}`, sub: `${stageDeals('client').length} closed`, color: '#10b981' },
          { label: 'Lost',            value: `$${stageTotal('lost').toLocaleString()}`, sub: `${stageDeals('lost').length} lost deals`, color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4">
            <p className="text-xs text-[#86868b] mb-1">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] text-[#86868b] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {STAGES.map(stage => {
            const items = stageDeals(stage.key);
            const total = stageTotal(stage.key);
            return (
              <div key={stage.key} className="w-64 flex-shrink-0">
                {/* Column header */}
                <div className={`flex items-center justify-between mb-2 px-3 py-2 rounded-xl ${stage.bgLight} ${stage.border} border`}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                    <span className="text-xs font-semibold" style={{ color: stage.color }}>{stage.label}</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/60 text-[#86868b]">{items.length}</span>
                  </div>
                  <span className="text-xs font-bold text-[#1d1d1f]">{fmt(total)}</span>
                </div>

                {/* Cards */}
                <div className="space-y-2 min-h-[120px] rounded-2xl bg-[#f5f5f7]/50 p-2">
                  {items.map((deal, idx) => (
                    <motion.div key={deal.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                      className="bg-white rounded-xl border border-[#d2d2d7]/60 p-3.5 hover:shadow-sm hover:border-[#d2d2d7] transition-all cursor-pointer group">
                      <p className="text-[11px] font-semibold text-[#1d1d1f] mb-0.5 truncate">{deal.title}</p>
                      <div className="flex items-center gap-1 mb-2">
                        <User size={10} className="text-[#86868b]" />
                        <p className="text-[10px] text-[#86868b] truncate">{deal.contactName}</p>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          <DollarSign size={11} className="text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-600">{fmt(deal.value)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp size={11} className="text-[#6366f1]" />
                          <span className="text-[10px] font-semibold text-[#6366f1]">{deal.probability}%</span>
                        </div>
                      </div>
                      {/* Probability bar */}
                      <div className="h-1 bg-[#f5f5f7] rounded-full overflow-hidden mb-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${deal.probability}%`, background: stage.color }} />
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={10} className="text-[#86868b]" />
                        <span className="text-[10px] text-[#86868b]">{deal.closeDate}</span>
                      </div>
                    </motion.div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-[11px] text-[#86868b] text-center py-6">No deals</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Deal Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold">Add Deal</h2>
                <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Contact Name *', key: 'contactName', type: 'text', placeholder: 'Jane Smith' },
                  { label: 'Deal Title *',   key: 'title',       type: 'text', placeholder: 'AI Receptionist Setup' },
                  { label: 'Value ($)',       key: 'value',       type: 'number', placeholder: '2500' },
                  { label: 'Close Date',      key: 'closeDate',   type: 'text', placeholder: 'Apr 15' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-medium text-[#86868b] mb-1 block">{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder}
                      value={(newDeal as any)[f.key]}
                      onChange={e => setNewDeal(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-[#86868b] mb-1 block">Probability: {newDeal.probability}%</label>
                  <input type="range" min={0} max={100} value={newDeal.probability}
                    onChange={e => setNewDeal(p => ({ ...p, probability: e.target.value }))}
                    className="w-full accent-[#6366f1]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#86868b] mb-1 block">Stage</label>
                  <select value={newDeal.stage} onChange={e => setNewDeal(p => ({ ...p, stage: e.target.value as DealStage }))}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 bg-white">
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-[#d2d2d7]/60 hover:bg-[#f5f5f7] transition-colors">
                  Cancel
                </button>
                <button onClick={handleAddDeal}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] transition-colors">
                  Add Deal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
