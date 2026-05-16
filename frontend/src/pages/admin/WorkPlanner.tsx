import { useEffect, useState, useCallback } from 'react';
import { Calendar, ClipboardList } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, PrimaryBtn, GhostBtn,
} from '../../components/pro/ProBlocks';

interface DayPlanItem {
  prospectId: string;
  businessName: string;
  niche: string;
  city: string;
  phone: string;
  score: number;
  priorityScore: number;
  reasoning: string;
  bestCallTime: string;
  language: 'en' | 'fr';
}

interface DayPlan {
  date: string;
  totalProspects: number;
  items: DayPlanItem[];
  planNotes: string;
  generatedAt: string;
  actionId?: string;
}

const toDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const scoreColor = (score: number): string => {
  if (score >= 70) return pro.ok;
  if (score >= 50) return pro.warn;
  return pro.textSec;
};

export default function WorkPlanner() {
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(toDateString(new Date()));
  const [contactedCount, setContactedCount] = useState<number>(0);
  const [qualifiedCount, setQualifiedCount] = useState<number>(0);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();

  const generatePlan = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const { data: res } = await api.post<{ success: boolean; plan: DayPlan }>('/ai-agents/work-planner/day-plan', {
        date,
        maxProspects: 50,
      });
      setPlan(res.plan ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de génération';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    generatePlan(selectedDate);
  }, [generatePlan, selectedDate]);

  const handleSaveOutcome = useCallback(async () => {
    if (!plan?.actionId) {
      toast('Aucun plan actif à enregistrer', 'error');
      return;
    }
    setSavingOutcome(true);
    try {
      await api.post('/ai-agents/work-planner/outcome', {
        actionId: plan.actionId,
        contactedCount,
        qualifiedCount,
      });
      toast('Résultats enregistrés', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
    } finally {
      setSavingOutcome(false);
    }
  }, [plan, contactedCount, qualifiedCount, toast]);

  return (
    <div className="space-y-5 max-w-[1200px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Work Planner"
        subtitle="Plan d'appels IA quotidien"
        right={
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 px-3 rounded-xl text-[12.5px] font-medium outline-none"
                style={{
                  background: pro.panel,
                  border: `1px solid ${pro.border}`,
                  color: pro.text,
                }}
              />
            </div>
            <PrimaryBtn onClick={() => generatePlan(selectedDate)} disabled={loading} size="sm">
              <Calendar size={13} />
              {loading ? 'Génération…' : 'Générer le plan'}
            </PrimaryBtn>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: 'rgba(239,68,68,0.10)', color: pro.bad, border: `1px solid rgba(239,68,68,0.20)` }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl h-8" style={{ background: pro.panel }} />
          ))}
        </div>
      )}

      {/* Plan content */}
      {!loading && plan && (
        <>
          {/* Plan notes */}
          {plan.planNotes && (
            <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: 'rgba(96,165,250,0.07)', border: `1px solid rgba(96,165,250,0.15)`, color: pro.info }}>
              <div className="flex items-start gap-2">
                <ClipboardList size={14} className="mt-0.5 flex-shrink-0" />
                <p>{plan.planNotes}</p>
              </div>
            </div>
          )}

          {/* Table */}
          <section>
            <SectionHead title={`Plan du jour — ${plan.totalProspects} prospects`} />
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${pro.border}` }}>
                      {['#', 'Business', 'Niche', 'Ville', 'Score', 'Heure', 'Raisonnement', 'Langue'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10.5px]" style={{ color: pro.textSec }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.items.map((item, i) => {
                      const isTop10 = i < 10;
                      return (
                        <tr
                          key={item.prospectId}
                          className="hover:bg-white/[0.02] transition-colors"
                          style={{
                            borderTop: i > 0 ? `1px solid ${pro.border}` : undefined,
                            background: isTop10 ? 'rgba(255,255,255,0.02)' : undefined,
                          }}
                        >
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: pro.textSec }}>{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium max-w-[150px] truncate" style={{ color: pro.text }}>
                            {item.businessName}
                          </td>
                          <td className="px-4 py-2.5" style={{ color: pro.textSec }}>{item.niche}</td>
                          <td className="px-4 py-2.5" style={{ color: pro.textSec }}>{item.city}</td>
                          <td className="px-4 py-2.5 tabular-nums font-semibold" style={{ color: scoreColor(item.score) }}>
                            {item.score}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: pro.text }}>{item.bestCallTime}</td>
                          <td className="px-4 py-2.5 max-w-[200px] truncate" style={{ color: pro.textSec }}>
                            {item.reasoning}
                          </td>
                          <td className="px-4 py-2.5 uppercase text-[10px] font-bold" style={{ color: item.language === 'fr' ? pro.info : pro.accent }}>
                            {item.language}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* Outcome section */}
          <section>
            <SectionHead title="Résultats du jour" />
            <Card>
              <div className="p-4 flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: pro.textSec }}>
                    Prospects contactés
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={contactedCount}
                    onChange={(e) => setContactedCount(Number(e.target.value))}
                    className="h-9 w-28 px-3 rounded-xl text-[12.5px] outline-none tabular-nums"
                    style={{
                      background: pro.panel,
                      border: `1px solid ${pro.border}`,
                      color: pro.text,
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: pro.textSec }}>
                    Qualifiés
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={qualifiedCount}
                    onChange={(e) => setQualifiedCount(Number(e.target.value))}
                    className="h-9 w-28 px-3 rounded-xl text-[12.5px] outline-none tabular-nums"
                    style={{
                      background: pro.panel,
                      border: `1px solid ${pro.border}`,
                      color: pro.text,
                    }}
                  />
                </div>
                <GhostBtn onClick={handleSaveOutcome} disabled={savingOutcome}>
                  {savingOutcome ? 'Enregistrement…' : 'Enregistrer'}
                </GhostBtn>
              </div>
            </Card>
          </section>
        </>
      )}

      {/* Empty state */}
      {!loading && !plan && !error && (
        <Card>
          <div className="p-12 text-center" style={{ color: pro.textSec }}>
            <Calendar className="w-7 h-7 mx-auto mb-3" />
            <p className="text-[13px]">Aucun plan pour cette date</p>
          </div>
        </Card>
      )}
    </div>
  );
}
