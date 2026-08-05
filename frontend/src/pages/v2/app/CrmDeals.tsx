import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, DollarSign, GripVertical, Plus, TrendingUp, User, X } from '../../../components/icons';
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
import api from '../../../services/api';
import { Card, Field, GhostBtn, Input, PageActions, PrimaryBtn, Select } from '../../../components/v2/app/Blocks';

/* Deal Pipeline, registre produit V2 (DA/v2-direction.md, addendum).
   Drag and drop dnd-kit conservé tel quel (mêmes capteurs, mêmes handlers,
   même PUT /crm/deals/:id optimiste). GET /crm/deals, POST /crm/deals. */

type DealStage = 'new' | 'qualified' | 'appointment' | 'client' | 'inactive' | 'lost';
type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

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

const STAGES: { key: DealStage; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: 'var(--q2p-info)' },
  { key: 'qualified', label: 'Qualified', color: 'var(--q2-lift)' },
  { key: 'appointment', label: 'Appointment', color: 'var(--q2p-warn)' },
  { key: 'client', label: 'Client', color: 'var(--q2p-ok)' },
  { key: 'inactive', label: 'Inactive', color: '#8A8F98' },
  { key: 'lost', label: 'Lost', color: 'var(--q2p-bad)' },
];

const PANEL_FIELDS: Array<{ label: string; key: NewDealTextField; type: string; placeholder: string }> = [
  { label: 'Contact Name *', key: 'contactName', type: 'text', placeholder: 'Jane Smith' },
  { label: 'Deal Title *', key: 'title', type: 'text', placeholder: 'AI Receptionist Setup' },
  { label: 'Value ($)', key: 'value', type: 'number', placeholder: '2500' },
  { label: 'Close Date', key: 'closeDate', type: 'text', placeholder: 'Apr 15' },
];

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;
}

/* Carte deal triable (drag handle inchangé) */
function DealCard({ deal, stage, overlay = false }: { deal: Deal; stage: typeof STAGES[number]; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const card = (
    <div
      className={`bg-q2-obsidian rounded-xl border p-3 transition-colors duration-150 ${
        overlay ? 'border-q2-indigo/60' : 'border-q2-graphite-d hover:border-q2-smoke-d'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...(overlay ? {} : listeners)}
          {...(overlay ? {} : attributes)}
          aria-label={`Move ${deal.title}`}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-q2-fog hover:text-q2-mist transition-colors duration-150 shrink-0"
          tabIndex={-1}
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-medium text-white mb-1 truncate">{deal.title}</p>
          <div className="flex items-center gap-1.5 mb-2">
            <User size={10} className="text-q2-fog" aria-hidden="true" />
            <p className="text-[11px] text-q2-fog truncate">{deal.contactName}</p>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-white tabular-nums">
              <DollarSign size={11} className="text-q2-lift" aria-hidden="true" />
              {fmt(deal.value)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-q2-mist tabular-nums">
              <TrendingUp size={11} className="text-q2-fog" aria-hidden="true" />
              {deal.probability}%
            </span>
          </div>
          <div className="h-1 bg-q2-carbon rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full" style={{ width: `${deal.probability}%`, background: stage.color }} />
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={10} className="text-q2-fog" aria-hidden="true" />
            <span className="text-[11px] text-q2-fog tabular-nums">{deal.closeDate}</span>
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

/* Colonne d'étape (zone de dépôt) */
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
    <div className="w-64 shrink-0">
      <div className="flex items-center justify-between gap-2 px-3 h-10 rounded-t-xl bg-q2-carbon border border-q2-graphite-d">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: stage.color }} aria-hidden="true" />
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-mist truncate">{stage.label}</span>
          <span className="text-[11px] text-q2-fog tabular-nums">{deals.length}</span>
        </div>
        <span className="text-[12px] font-medium text-white tabular-nums">{fmt(total)}</span>
      </div>

      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          className={`space-y-2 min-h-[140px] rounded-b-xl border border-t-0 p-2 bg-q2-carbon transition-colors duration-150 ${
            isOver ? 'border-q2-indigo/50' : 'border-q2-graphite-d'
          }`}
          data-stage={stage.key}
        >
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} stage={stage} />
          ))}
          {deals.length === 0 && (
            <p className="text-[11.5px] text-q2-fog text-center py-8">
              {isOver ? 'Drop here' : 'No deals'}
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function CrmDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newDeal, setNewDeal] = useState<NewDealState>({
    contactName: '', title: '', value: '', probability: '50', closeDate: '', stage: 'new',
  });
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [overStage, setOverStage] = useState<DealStage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
      /* deals indisponibles: l'état courant est conservé */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDeals(); }, []);

  useEffect(() => {
    if (!showAddPanel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAddPanel(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAddPanel]);

  const stageDeals = (stage: DealStage) => deals.filter((d) => d.stage === stage);
  const stageTotal = (stage: DealStage) => stageDeals(stage).reduce((s, d) => s + d.value, 0);
  const totalPipeline = deals.filter((d) => d.stage !== 'lost').reduce((s, d) => s + d.value, 0);
  const wonValue = stageTotal('client');

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    setActiveDeal(deal ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) { setOverStage(null); return; }
    const targetDeal = deals.find((d) => d.id === over.id);
    const stage = targetDeal
      ? targetDeal.stage
      : (STAGES.find((s) => s.key === over.id)?.key ?? null);
    setOverStage(stage as DealStage | null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);
    setOverStage(null);

    if (!over || active.id === over.id) return;

    const draggedDeal = deals.find((d) => d.id === active.id);
    if (!draggedDeal) return;

    const overDeal = deals.find((d) => d.id === over.id);
    const targetStage: DealStage = overDeal
      ? overDeal.stage
      : (STAGES.find((s) => s.key === over.id)?.key ?? draggedDeal.stage) as DealStage;

    if (draggedDeal.stage === targetStage) return;

    setDeals((prev) => prev.map((d) => d.id === draggedDeal.id ? { ...d, stage: targetStage } : d));

    try {
      await api.put(`/crm/deals/${draggedDeal.id}`, { stage: targetStage });
    } catch {
      setDeals((prev) => prev.map((d) => d.id === draggedDeal.id ? { ...d, stage: draggedDeal.stage } : d));
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
      setShowAddPanel(false);
      fetchDeals();
    } catch { /* création ignorée */ }
  };

  const activeStageConfig = activeDeal ? STAGES.find((s) => s.key === activeDeal.stage)! : null;

  const summary = [
    { label: 'Total Pipeline', value: `$${totalPipeline.toLocaleString()}`, sub: `${deals.filter((d) => d.stage !== 'lost').length} active deals`, tone: 'accent' as Tone },
    { label: 'Won (Clients)', value: `$${wonValue.toLocaleString()}`, sub: `${stageDeals('client').length} closed`, tone: 'ok' as Tone },
    { label: 'Lost', value: `$${stageTotal('lost').toLocaleString()}`, sub: `${stageDeals('lost').length} lost deals`, tone: 'bad' as Tone },
  ];

  const toneColor = (tone: Tone) =>
    tone === 'ok' ? 'var(--q2p-ok)' : tone === 'bad' ? 'var(--q2p-bad)' : 'var(--q2-lift)';

  return (
    <div>
      <PageActions subtitle={`${deals.length} deals · $${totalPipeline.toLocaleString()} total pipeline`}>
        <PrimaryBtn type="button" onClick={() => setShowAddPanel(true)}>
          <Plus size={14} aria-hidden="true" /> Add Deal
        </PrimaryBtn>
      </PageActions>

      {/* Résumé du pipeline, une seule surface découpée par hairlines */}
      <Card pad={false} className="mb-5">
        <div className="flex flex-col sm:flex-row">
          {summary.map((s) => (
            <div
              key={s.label}
              className="flex-1 px-5 py-4 border-t sm:border-t-0 sm:border-l border-q2-graphite-d first:border-t-0 first:sm:border-l-0"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog mb-2">{s.label}</p>
              <p className="text-[22px] font-light tracking-tight tabular-nums leading-none" style={{ color: toneColor(s.tone) }}>
                {s.value}
              </p>
              <p className="text-[11.5px] text-q2-fog mt-2 tabular-nums">{s.sub}</p>
            </div>
          ))}
        </div>
      </Card>

      {loading ? (
        <div role="status" aria-busy="true" aria-label="Loading deals" className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div key={s.key} className="w-64 shrink-0 rounded-xl border border-q2-graphite-d bg-q2-carbon p-2 space-y-2">
              <div className="h-6 rounded bg-q2-obsidian animate-pulse" />
              <div className="h-20 rounded-xl bg-q2-obsidian animate-pulse" />
              <div className="h-20 rounded-xl bg-q2-obsidian animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 min-w-max">
              {STAGES.map((stage) => (
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
      )}

      {/* Panneau latéral: ajout de deal (remplace la modale V1) */}
      <AnimatePresence>
        {showAddPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setShowAddPanel(false)}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-q2-void/70"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
              aria-label="Add Deal"
              className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-q2-carbon border-l border-q2-graphite-d overflow-y-auto"
            >
              <header className="sticky top-0 bg-q2-carbon border-b border-q2-graphite-d px-5 h-14 flex items-center justify-between gap-3">
                <p className="text-[14px] font-medium text-white">Add Deal</p>
                <button
                  type="button"
                  onClick={() => setShowAddPanel(false)}
                  aria-label="Close panel"
                  className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-q2-fog hover:text-white hover:bg-q2-obsidian transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </header>

              <div className="p-5 space-y-4">
                {PANEL_FIELDS.map((f) => (
                  <Field key={f.key} label={f.label}>
                    <Input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={newDeal[f.key]}
                      onChange={(e) => setNewDeal((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  </Field>
                ))}

                <Field label={`Probability: ${newDeal.probability}%`}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={newDeal.probability}
                    aria-label="Probability"
                    onChange={(e) => setNewDeal((p) => ({ ...p, probability: e.target.value }))}
                    className="w-full accent-q2-indigo"
                  />
                </Field>

                <Field label="Stage">
                  <Select
                    value={newDeal.stage}
                    onChange={(e) => setNewDeal((p) => ({ ...p, stage: e.target.value as DealStage }))}
                  >
                    {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </Select>
                </Field>

                <div className="flex items-center gap-2 pt-1">
                  <PrimaryBtn
                    type="button"
                    onClick={handleAddDeal}
                    disabled={!newDeal.title || !newDeal.contactName}
                  >
                    Add Deal
                  </PrimaryBtn>
                  <GhostBtn type="button" onClick={() => setShowAddPanel(false)}>Cancel</GhostBtn>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
