import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Calendar, TrendingUp, User, Loader2, GripVertical, CheckCircle2, XCircle, ChevronDown } from '../../components/icons';
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
import PageHeader from '../../components/dashboard/PageHeader';

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
  contactId: string;
  title: string;
  value: string;
  probability: string;
  closeDate: string;
  stage: DealStage;
}

type NewDealTextField = 'title' | 'value' | 'closeDate';

/* Les entetes de colonne portaient des aplats PASTEL (`bg-amber-50`,
   `bg-violet-300`, ...) heriteés d'un theme clair: sur le noir du portail ils
   ressortaient comme des bandes lumineuses, et le libelle colore posé dessus
   devenait illisible. Chaque etape garde donc SA teinte, mais en voile: le
   fond a 10 % et le filet a 20 % de la meme couleur, ce que la page Leads fait
   deja pour ses etats. */
const STAGES: { key: DealStage; label: string; color: string; bgLight: string; border: string }[] = [
  { key: 'new',         label: 'Nouveau',     color: '#3b82f6', bgLight: 'bg-[#3b82f6]/10', border: 'border-[#3b82f6]/20' },
  { key: 'qualified',   label: 'Qualifié',    color: '#7349fe', bgLight: 'bg-[#7349fe]/10', border: 'border-[#7349fe]/20' },
  { key: 'appointment', label: 'Rendez-vous', color: '#f59e0b', bgLight: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/20' },
  { key: 'client',      label: 'Client',      color: '#10b981', bgLight: 'bg-[#10b981]/10', border: 'border-[#10b981]/20' },
  { key: 'inactive',    label: 'Inactif',     color: '#9ca3af', bgLight: 'bg-white/[0.06]', border: 'border-white/[0.10]' },
  { key: 'lost',        label: 'Perdu',       color: '#ef4444', bgLight: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/20' },
];

const MODAL_FIELDS: Array<{ label: string; key: NewDealTextField; type: string; placeholder: string }> = [
  { label: 'Intitulé *',     key: 'title',       type: 'text',   placeholder: 'Installation réceptionniste' },
  { label: 'Montant (€)',    key: 'value',       type: 'number', placeholder: '2500' },
  { label: 'Date de clôture', key: 'closeDate',  type: 'text',   placeholder: '15 avril' },
];

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)} k€` : `${n} €`;
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
      className={`bg-white/[0.04] rounded-xl border border-white/[0.07] p-3.5 transition-colors group
        ${overlay ? 'shadow-2xl rotate-1 scale-[1.02]' : 'hover:bg-white/[0.06] hover:border-white/[0.14]'}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...(overlay ? {} : listeners)}
          {...(overlay ? {} : attributes)}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-white/25 hover:text-[#A1A1A8] transition-colors flex-shrink-0"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#F5F5F7] mb-0.5 truncate">{deal.title}</p>
          <div className="flex items-center gap-1 mb-2">
            <User size={10} className="text-[#A1A1A8]" />
            <p className="text-[10px] text-[#A1A1A8] truncate">{deal.contactName}</p>
          </div>
          <div className="flex items-center justify-between mb-2">
            {/* Pas d'icone dollar devant un montant en euros: `fmt` porte deja
                le symbole, et ce n'etait pas le bon. */}
            <span className="text-xs font-bold text-[#7349fe]">{fmt(deal.value)}</span>
            <div className="flex items-center gap-1">
              <TrendingUp size={11} className="text-[#cd6afb]" />
              <span className="text-[10px] font-semibold text-[#cd6afb]">{deal.probability}%</span>
            </div>
          </div>
          <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full" style={{ width: `${deal.probability}%`, background: stage.color }} />
          </div>
          <div className="flex items-center gap-1">
            <Calendar size={10} className="text-[#A1A1A8]" />
            <span className="text-[10px] text-[#A1A1A8]">{deal.closeDate}</span>
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

/**
 * La repartition du pipeline, d'un coup d'oeil.
 *
 * Le kanban demandait de faire defiler six colonnes pour savoir ou en est
 * l'argent: on ne voyait jamais l'ensemble, ni sur telephone ni sur ordinateur.
 * Une barre empilee tient la reponse sur une ligne, et chaque segment est
 * proportionnel a la VALEUR de son etape, pas au nombre d'affaires: c'est la
 * valeur qui se pilote.
 *
 * « Perdu » est exclu: additionner du perdu au pipeline en cours ferait une
 * barre qui grandit quand les affaires echouent.
 */
function StageBar({ rows, total }: { rows: { key: DealStage; label: string; color: string; value: number }[]; total: number }) {
  if (total <= 0) return null;
  const live = rows.filter(r => r.key !== 'lost' && r.value > 0);
  if (live.length === 0) return null;

  return (
    <div className="mb-6">
      <div
        className="flex h-2 rounded-full overflow-hidden bg-white/[0.05]"
        role="img"
        aria-label={live.map(r => `${r.label}: ${fmt(r.value)}`).join(', ')}
      >
        {live.map(r => (
          <div
            key={r.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(r.value / total) * 100}%`, background: r.color }}
          />
        ))}
      </div>
      {/* Pas de legende sous la barre: la liste d'etapes juste en dessous porte
          deja la meme pastille, le meme libelle et le meme montant. Deux fois
          la meme information, c'est une de trop, et c'est la hauteur qui la
          paie. La barre ne dit que la PROPORTION. */}
    </div>
  );
}

/**
 * Le pipeline sur telephone: une etape par ligne, repliee.
 *
 * Le kanban est une grammaire d'ORDINATEUR. Sur un ecran de 390 px il donnait
 * une colonne et demie, et il fallait faire defiler pour decouvrir qu'il en
 * existait six: on ne savait meme pas ce qu'on ne voyait pas. Six lignes
 * tiennent dans un ecran, l'etat complet se lit sans un geste, et on ouvre
 * celle qui interesse.
 *
 * Le glisser-deposer disparait ici, et c'est un gain: sur tactile il se dispute
 * le geste avec le defilement de la page. Un selecteur d'etape le remplace, ce
 * qui est aussi la seule facon d'y arriver au clavier.
 */
function StageAccordion({
  stages, dealsByStage, openStage, onToggle, onMove,
}: {
  stages: typeof STAGES;
  dealsByStage: (s: DealStage) => Deal[];
  openStage: DealStage | null;
  onToggle: (s: DealStage) => void;
  onMove: (dealId: string, stage: DealStage) => void;
}) {
  return (
    <div className="lg:hidden divide-y divide-white/[0.06] border-y border-white/[0.06]">
      {stages.map(stage => {
        const rows = dealsByStage(stage.key);
        const total = rows.reduce((s, d) => s + d.value, 0);
        const open = openStage === stage.key;

        return (
          <div key={stage.key}>
            <button
              type="button"
              onClick={() => onToggle(stage.key)}
              aria-expanded={open}
              data-radius="keep"
              className="w-full flex items-center gap-3 py-3.5 text-left"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} aria-hidden="true" />
              <span className="text-[13px] font-medium text-[#F5F5F7] flex-1 min-w-0 truncate">{stage.label}</span>
              <span className="text-[11px] tabular-nums text-white/40">{rows.length}</span>
              <span className="text-[13px] font-semibold tabular-nums text-white/80 w-[72px] text-right">{fmt(total)}</span>
              <ChevronDown
                size={15}
                className={`text-white/30 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {open && (
              <div className="pb-3 space-y-2">
                {rows.length === 0 ? (
                  <p className="text-[12px] text-white/35 py-2">Aucune affaire à cette étape.</p>
                ) : rows.map(deal => (
                  <div key={deal.id} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
                    <p className="text-[13px] font-medium text-[#F5F5F7] truncate">{deal.title}</p>
                    <p className="text-[11px] text-[#A1A1A8] mt-0.5 truncate">{deal.contactName}</p>
                    <div className="flex items-center justify-between mt-2.5 gap-3">
                      <span className="text-[13px] font-semibold tabular-nums text-[#7349fe]">{fmt(deal.value)}</span>
                      <span className="text-[11px] text-white/35 tabular-nums">{deal.closeDate}</span>
                    </div>
                    <label className="sr-only" htmlFor={`stage-${deal.id}`}>Étape de {deal.title}</label>
                    <select
                      id={`stage-${deal.id}`}
                      value={deal.stage}
                      onChange={e => onMove(deal.id, e.target.value as DealStage)}
                      className="mt-3 w-full text-[12px] py-2 px-3"
                    >
                      {STAGES.map(s => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
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
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/[0.08] text-[#A1A1A8]">{deals.length}</span>
        </div>
        <span className="text-xs font-bold text-[#F5F5F7]">{fmt(total)}</span>
      </div>

      <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
        <div
          className={`space-y-2 min-h-[120px] rounded-2xl p-2 transition-colors
            ${isOver ? 'bg-[#7349fe]/[0.06] ring-1 ring-[#7349fe]/30' : 'bg-white/[0.02]'}`}
          data-stage={stage.key}
        >
          {deals.map(deal => (
            <DealCard key={deal.id} deal={deal} stage={stage} />
          ))}
          {deals.length === 0 && (
            <p className="text-[11px] text-[#A1A1A8] text-center py-6">
              {isOver ? 'Déposer ici' : 'Aucune affaire'}
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
    contactId: '', title: '', value: '', probability: '50', closeDate: '', stage: 'new',
  });
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [overStage, setOverStage] = useState<DealStage | null>(null);
  /* Sur telephone, une seule etape ouverte a la fois: c'est ce qui garde les
     six lignes visibles au-dessus de celle qu'on lit. */
  const [openStage, setOpenStage] = useState<DealStage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/crm/deals');
      // La route repond par un TABLEAU. Deballer `data.deals` donnait toujours
      // undefined, donc un pipeline vide meme avec des affaires en base: le
      // symptome exact d'un CRM « qui ne se remplit pas ».
      const rows: RawDeal[] = Array.isArray(data) ? data : (data?.deals || []);
      const mapped = rows.map((d: RawDeal): Deal => ({
        id: d.id,
        contactName: d.contact?.name || d.contactName || 'Contact inconnu',
        title: d.title || '',
        value: Number(d.value) || 0,
        probability: d.probability ?? 50,
        closeDate: d.closeDate ? new Date(d.closeDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'À définir',
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

  /* Une affaire appartient a un contact: le selecteur a besoin de la liste. */
  useEffect(() => {
    api.get('/crm/contacts', { params: { limit: 100 } })
      .then(({ data }) => setContacts(data?.contacts || []))
      .catch(() => { /* le selecteur reste vide et le dit */ });
  }, []);

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
    await moveDeal(draggedDeal.id, targetStage);
  };

  /* Le changement d'etape, une seule fois: le glisser-deposer de l'ordinateur
     et le selecteur du telephone doivent ecrire pareil, y compris le retour en
     arriere quand le serveur refuse. */
  const moveDeal = async (dealId: string, targetStage: DealStage) => {
    const current = deals.find(d => d.id === dealId);
    if (!current || current.stage === targetStage) return;

    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: targetStage } : d));
    try {
      await api.put(`/crm/deals/${dealId}`, { stage: targetStage });
    } catch {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: current.stage } : d));
    }
  };

  const handleAddDeal = async () => {
    if (!newDeal.title || !newDeal.contactId) return;
    try {
      // `contactId` est exige par la route. Le formulaire envoyait un nom libre
      // qui n'etait meme pas transmis: chaque creation repartait en 400, avale
      // par un catch muet, et le bouton semblait ne rien faire.
      await api.post('/crm/deals', {
        contactId: newDeal.contactId,
        title: newDeal.title,
        stage: newDeal.stage,
        value: parseFloat(newDeal.value) || 0,
        probability: parseInt(newDeal.probability) || 50,
        closeDate: newDeal.closeDate || null,
      });
      setNewDeal({ contactId: '', title: '', value: '', probability: '50', closeDate: '', stage: 'new' });
      setShowAddModal(false);
      fetchDeals();
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#7349fe]" size={32} />
      </div>
    );
  }

  const activeStageConfig = activeDeal ? STAGES.find(s => s.key === activeDeal.stage)! : null;

  return (
    <div>
      {/* La MÊME entête que les autres pages du portail, et non plus la sienne.
          Elle portait un titre en `text-2xl font-bold` là où le reste du
          dashboard est en `22px semibold`, et trois cartes encadrées là où les
          autres pages posent une rangée de chiffres séparée par des filets.
          Deux grammaires pour la même chose: on lisait deux produits. */}
      <PageHeader
        title="Pipeline"
        subtitle={`${deals.length} affaire${deals.length > 1 ? 's' : ''} · ${totalPipeline.toLocaleString('fr-FR')} € au total`}
        action={
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#7349fe] text-white text-sm font-medium rounded-xl hover:bg-[#8560ff] transition-colors"
          >
            <Plus size={16} /> Nouvelle affaire
          </button>
        }
        /* Les montants passent par la rangée partagée: nombre en blanc, teinte
           sur la pastille du libellé. Trois cellules, donc `grid-cols-3` côté
           composant, sans rien à régler ici. */
        kpis={[
          { label: 'Pipeline total', value: `${totalPipeline.toLocaleString('fr-FR')} €`, icon: TrendingUp,  color: '#7349fe' },
          { label: 'Gagné',          value: `${wonValue.toLocaleString('fr-FR')} €`,      icon: CheckCircle2, color: '#10b981' },
          { label: 'Perdu',          value: `${stageTotal('lost').toLocaleString('fr-FR')} €`, icon: XCircle,  color: '#ef4444' },
        ]}
      />

      {/* La repartition d'abord, quel que soit l'ecran: c'est la reponse a
          « ou en est le pipeline », et elle ne demandait aucun defilement. */}
      <StageBar
        rows={STAGES.map(st => ({ key: st.key, label: st.label, color: st.color, value: stageTotal(st.key) }))}
        total={totalPipeline}
      />

      <StageAccordion
        stages={STAGES}
        dealsByStage={stageDeals}
        openStage={openStage}
        onToggle={(st) => setOpenStage(prev => (prev === st ? null : st))}
        onMove={moveDeal}
      />

      {/* Kanban, ORDINATEUR seulement. C'est une grammaire de grand ecran: a
          390 px il donnait une colonne et demie et cachait l'existence des
          quatre autres. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="hidden lg:block overflow-x-auto pb-4">
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
              className="bg-[#141416] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold">Nouvelle affaire</h2>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/[0.06] text-[#A1A1A8] flex items-center justify-center hover:bg-white/[0.10]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-[#A1A1A8] mb-1 block">Contact *</label>
                  <select
                    value={newDeal.contactId}
                    onChange={e => setNewDeal(p => ({ ...p, contactId: e.target.value }))}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#F5F5F7] placeholder:text-[#6B6B75] focus:outline-none focus:ring-2 focus:ring-[#7349fe]/30 transition-colors"
                  >
                    <option value="">Choisir un contact…</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {contacts.length === 0 && (
                    <p className="text-[11px] text-[#A1A1A8] mt-1">
                      Aucun contact pour l’instant. Ils apparaissent tout seuls après vos premiers appels.
                    </p>
                  )}
                </div>
                {MODAL_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-medium text-[#A1A1A8] mb-1 block">{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={newDeal[f.key]}
                      onChange={e => setNewDeal(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#F5F5F7] placeholder:text-[#6B6B75] focus:outline-none focus:ring-2 focus:ring-[#7349fe]/30 transition-colors"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-[#A1A1A8] mb-1 block">Probabilité : {newDeal.probability} %</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={newDeal.probability}
                    onChange={e => setNewDeal(p => ({ ...p, probability: e.target.value }))}
                    className="w-full accent-[#7349fe]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#A1A1A8] mb-1 block">Étape</label>
                  <select
                    value={newDeal.stage}
                    onChange={e => setNewDeal(p => ({ ...p, stage: e.target.value as DealStage }))}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-[#7349fe]/30"
                  >
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-white/[0.08] text-[#A1A1A8] hover:bg-white/[0.06] transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleAddDeal}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#7349fe] rounded-xl hover:bg-[#7349fe] transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
