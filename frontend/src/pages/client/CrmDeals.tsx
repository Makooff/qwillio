import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, DollarSign, Calendar, TrendingUp, User, Loader2, GripVertical } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

interface RawDeal {
  id: string;
  contactName?: string;
  title?: string;
  value?: number | string;
  probability?: number;
  closeDate?: string;
  stage?: string;
  contact?: { name?: string; niche?: string };
}

interface NewDealState {
  contactName: string;
  title: string;
  value: string;
  probability: string;
  closeDate: string;
  stage: DealStage;
}

type NewDealTextField = 'contactName' | 'title' | 'value' | 'closeDate';

const STAGES: { key: DealStage; label: string; color: string; bgLight: string; border: string }[] = [
  { key: 'new',         label: 'New',         color: '#3b82f6', bgLight: 'bg-blue-50',    border: 'border-blue-200' },
  { key: 'qualified',   label: 'Qualified',   color: '#6366F1', bgLight: 'bg-violet-50',  border: 'border-violet-200' },
  { key: 'appointment', label: 'Appointment', color: '#f59e0b', bgLight: 'bg-amber-50',   border: 'border-amber-200' },
  { key: 'client',      label: 'Client',      color: '#10b981', bgLight: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'inactive',    label: 'Inactive',    color: '#6b7280', bgLight: 'bg-gray-50',    border: 'border-gray-200' },
  { key: 'lost',        label: 'Lost',        color: '#ef4444', bgLight: 'bg-red-50',     border: 'border-red-200' },
];

const MODAL_FIELDS: Array<{ label: string; key: NewDealTextField; type: string; placeholder: string }> = [
  { label: 'Contact Name *', key: 'contactName', type: 'text',   placeholder: 'Jane Smith' },
  { label: 'Deal Title *',   key: 'title',       type: 'text',   placeholder: 'AI Receptionist Setup' },
  { label: 'Value ($)',      key: 'value',       type: 'number', placeholder: '2500' },
  { label: 'Close Date',    key: 'closeDate',   type: 'text',   placeholder: 'Apr 15' },
];

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;
}

// --- Sortable deal card ---
function DealCard({ deal, stage, overlay = false }: { deal: Deal; stage: typeof STAGES[number]; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const card = (
    <div
      className={`bg-white rounded-xl border border-[#d2d2d7]/60 p-3.5 transition-colors group
        ${overlay ? 'shadow-2xl rotate-1 scale-[1.02]' : 'hover:shadow-sm hover:border-[#d2d2d7]'}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...(overlay ? {} : listeners)}
          {...(overlay ? {} : attributes)}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-[#d2d2d7] hover:text-[#86868b] transition-colors flex-shrink-0"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#1d1d1f] mb-0.5 truncate">{deal.title}</p>
          <div className="flex items-center gap-1 mb-2">
            <User size={10} className="text-[#86868b]" />
            <p className="text-[10px] text-[#86868b] truncate">{deal.contactName}</p>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <DollarSign size={11} className="text-[#6366f1]" />
              <span className="text-xs font-bold text-[#6366f1]">{fmt(deal.value)}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp size={11} className="text-[#a855f7]" />
              <span className="text-[10px] font-semibold text-[#a855f7]">{deal.probability}%</span>
            </div>
          </div>
          <div className="h-1 bg-[#f5f5f7] rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full" style={{ width: `${deal.probability}%`, background: stage.color }} />
          </div>
          <div className="flex items-center gap-1">
            <Calendar size={10} className="text-[#86868b]" />
            <span className="text-[10px] text-[#86868b]">{deal.closeDate}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (overlay) return card;

  return (
    <div ref={setNodeRef} style={style}>
      {card}
    </div>
  );
}

// --- Droppable column ---
function StageColumn({
  stage,
  deals,
  isOver,
}: {
  stage: typeof STAGES[number];
  deals: Deal[];
  isOver: boolean;
}) {
  const total = deals.reduce((s, d) => s + d.value, 0);

  return (
    <div className="w-64 flex-shrink-0">
      <div className={`flex items-center justify-between mb-2 px-3 py-2 rounded-xl ${stage.bgLight} ${stage.border} border`}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
          <span className="text-xs font-semibold" style={{ color: stage.color }}>{stage.label}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/60 text-[#86868b]">{deals.length}</span>
        </div>
        <span className="text-xs font-bold text-[#1d1d1f]">{fmt(total)}</span>
      </div>

      <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
        <div
          className={`space-y-2 min-h-[120px] rounded-2xl p-2 transition-colors
            ${isOver ? 'bg-[#6366f1]/[0.06] ring-1 ring-[#6366f1]/30' : 'bg-[#f5f5f7]/50'}`}
          data-stage={stage.key}
        >
          {deals.map(deal => (
            <DealCard key={deal.id} deal={deal} stage={stage} />
          ))}
          {deals.length === 0 && (
            <p className="text-[11px] text-[#86868b] text-center py-6">
              {isOver ? 'Drop here' : 'No deals'}
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// --- Main component ---
export default function CrmDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeal, setNewDeal] = useState<NewDealState>({
    contactName: '', title: '', value: '', probability: '50', closeDate: '', stage: 'new',
  });
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [overStage, setOverStage] = useState<DealStage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/crm/deals');
      const mapped = (data.deals || []).map((d: RawDeal): Deal => ({
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
      // keep state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDeals(); }, []);

  const stageDeals = (stage: DealStage) => deals.filter(d => d.stage === stage);
  const stageTotal = (stage: DealStage) => stageDeals(stage).reduce((s, d) => s + d.value, 0);
  const totalPipeline = deals.filter(d => d.stage !== 'lost').reduce((s, d) => s + d.value, 0);
  const wonValue = stageTotal('client');

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find(d => d.id === event.active.id);
    setActiveDeal(deal ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) { setOverStage(null); return; }
    // over.id is either a deal id or a stage key
    const targetDeal = deals.find(d => d.id === over.id);
    const stage = targetDeal
      ? targetDeal.stage
      : (STAGES.find(s => s.key === over.id)?.key ?? null);
    setOverStage(stage as DealStage | null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);
    setOverStage(null);

    if (!over || active.id === over.id) return;

    const draggedDeal = deals.find(d => d.id === active.id);
    if (!draggedDeal) return;

    // Determine target stage: over.id may be a deal id or stage key
    const overDeal = deals.find(d => d.id === over.id);
    const targetStage: DealStage = overDeal
      ? overDeal.stage
      : (STAGES.find(s => s.key === over.id)?.key ?? draggedDeal.stage) as DealStage;

    if (draggedDeal.stage === targetStage) return;

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === draggedDeal.id ? { ...d, stage: targetStage } : d));

    try {
      await api.put(`/crm/deals/${draggedDeal.id}`, { stage: targetStage });
    } catch {
      // Revert on failure
      setDeals(prev => prev.map(d => d.id === draggedDeal.id ? { ...d, stage: draggedDeal.stage } : d));
    }
  };

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
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#6366f1]" size={32} />
      </div>
    );
  }

  const activeStageConfig = activeDeal ? STAGES.find(s => s.key === activeDeal.stage)! : null;

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deal Pipeline</h1>
          <p className="text-sm text-[#86868b]">{deals.length} deals · ${totalPipeline.toLocaleString()} total pipeline</p>
        </div>
        <button
          type="button"
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
          { label: 'Won (Clients)',   value: `$${wonValue.toLocaleString()}`,       sub: `${stageDeals('client').length} closed`,                          color: '#10b981' },
          { label: 'Lost',           value: `$${stageTotal('lost').toLocaleString()}`, sub: `${stageDeals('lost').length} lost deals`,                    color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-4">
            <p className="text-xs text-[#86868b] mb-1">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] text-[#86868b] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Kanban board with drag-and-drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {STAGES.map(stage => (
              <StageColumn
                key={stage.key}
                stage={stage}
                deals={stageDeals(stage.key)}
                isOver={overStage === stage.key}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeDeal && activeStageConfig ? (
            <DealCard deal={activeDeal} stage={activeStageConfig} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>

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
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e8e8ed]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                {MODAL_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-medium text-[#86868b] mb-1 block">{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={newDeal[f.key]}
                      onChange={e => setNewDeal(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-colors"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-[#86868b] mb-1 block">Probability: {newDeal.probability}%</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={newDeal.probability}
                    onChange={e => setNewDeal(p => ({ ...p, probability: e.target.value }))}
                    className="w-full accent-[#6366f1]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#86868b] mb-1 block">Stage</label>
                  <select
                    value={newDeal.stage}
                    onChange={e => setNewDeal(p => ({ ...p, stage: e.target.value as DealStage }))}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 bg-white"
                  >
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-[#d2d2d7]/60 hover:bg-[#f5f5f7] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddDeal}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] transition-colors"
                >
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
