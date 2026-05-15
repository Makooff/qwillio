import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, TrendingUp, CheckCircle, XCircle, MinusCircle, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Pill, PrimaryBtn, GhostBtn,
} from '../../components/pro/ProBlocks';

interface ProspectOption {
  id: string;
  businessName: string;
  niche: string;
  city: string;
  score: number;
  googleRating: number | null;
}

interface BizPlanResult {
  prospectId: string;
  businessName: string;
  niche: string;
  htmlPitch: string;
  projectedMonthlyRevenue: number;
  projectedAnnualRevenue: number;
  roiMonths: number;
  keyBenefits: string[];
  generatedAt: string;
  actionId: string;
}

type OutcomeType = 'converted' | 'rejected' | 'no_response';

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function BusinessPlanAgent() {
  const [search, setSearch] = useState('');
  const [prospects, setProspects] = useState<ProspectOption[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<ProspectOption | null>(null);
  const [result, setResult] = useState<BizPlanResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState<OutcomeType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toasts, add: toast, remove } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchProspects = useCallback(async (query: string) => {
    if (!query.trim()) { setProspects([]); setDropdownOpen(false); return; }
    try {
      const res = await api.get('/prospects', { params: { search: query, limit: 10 } });
      const items = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setProspects(items);
      setDropdownOpen(items.length > 0);
    } catch {
      setProspects([]);
    }
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchProspects(value), 300);
  }, [searchProspects]);

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const selectProspect = useCallback((p: ProspectOption) => {
    setSelectedProspect(p);
    setSearch(p.businessName);
    setDropdownOpen(false);
    setResult(null);
    setError(null);
  }, []);

  const generatePitch = useCallback(async () => {
    if (!selectedProspect) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post('/ai-agents/business-plan/generate', {
        prospectId: selectedProspect.id,
      });
      setResult(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de génération';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setGenerating(false);
    }
  }, [selectedProspect, toast]);

  const saveOutcome = useCallback(async (outcome: OutcomeType) => {
    if (!result?.actionId) return;
    setSavingOutcome(outcome);
    try {
      await api.post('/ai-agents/business-plan/outcome', {
        actionId: result.actionId,
        outcome,
      });
      toast('Résultat enregistré', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
    } finally {
      setSavingOutcome(null);
    }
  }, [result, toast]);

  return (
    <div className="space-y-5 max-w-[900px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Business Plan Agent"
        subtitle="Génère des pitches ROI personnalisés par prospect"
      />

      {error && (
        <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: 'rgba(239,68,68,0.10)', color: pro.bad, border: `1px solid rgba(239,68,68,0.20)` }}>
          {error}
        </div>
      )}

      {/* Search */}
      <section>
        <SectionHead title="Sélectionner un prospect" />
        <div className="relative">
          <div className="flex items-center gap-2 h-10 px-3 rounded-xl" style={{ background: pro.panel, border: `1px solid ${pro.border}` }}>
            <Search size={14} style={{ color: pro.textSec }} />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              onFocus={() => prospects.length > 0 && setDropdownOpen(true)}
              placeholder="Rechercher par nom, niche…"
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: pro.text }}
            />
          </div>
          {dropdownOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
              style={{ background: '#16161A', border: `1px solid ${pro.border}` }}
            >
              {prospects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProspect(p)}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: pro.text }}>{p.businessName}</p>
                    <p className="text-[11px]" style={{ color: pro.textSec }}>{p.niche} · {p.city}</p>
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: p.score >= 70 ? pro.ok : pro.textSec }}>
                    {p.score}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Selected prospect card */}
      {selectedProspect && (
        <Card>
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold" style={{ color: pro.text }}>{selectedProspect.businessName}</p>
              <div className="flex items-center gap-2 mt-1">
                <Pill color="info">{selectedProspect.niche}</Pill>
                <Pill color="neutral">{selectedProspect.city}</Pill>
                {selectedProspect.googleRating && (
                  <Pill color="warn">★ {selectedProspect.googleRating}</Pill>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: pro.textSec }}>Score</p>
                <p className="text-[20px] font-bold tabular-nums" style={{ color: selectedProspect.score >= 70 ? pro.ok : pro.warn }}>
                  {selectedProspect.score}
                </p>
              </div>
              <PrimaryBtn onClick={generatePitch} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Génération…
                  </>
                ) : (
                  <>
                    <TrendingUp size={13} />
                    Générer le pitch ROI
                  </>
                )}
              </PrimaryBtn>
            </div>
          </div>
        </Card>
      )}

      {/* Generating skeleton */}
      {generating && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl h-8" style={{ background: pro.panel }} />
          ))}
        </div>
      )}

      {/* Result */}
      {result && !generating && (
        <div className="space-y-4">
          {/* Revenue stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <div className="p-4 text-center">
                <p className="text-[10.5px] uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>Revenue mensuel</p>
                <p className="text-[20px] font-bold tabular-nums" style={{ color: pro.ok }}>{fmtEur(result.projectedMonthlyRevenue)}</p>
                <p className="text-[10px] mt-1" style={{ color: pro.textSec }}>/mois</p>
              </div>
            </Card>
            <Card>
              <div className="p-4 text-center">
                <p className="text-[10.5px] uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>Revenue annuel</p>
                <p className="text-[20px] font-bold tabular-nums" style={{ color: pro.info }}>{fmtEur(result.projectedAnnualRevenue)}</p>
                <p className="text-[10px] mt-1" style={{ color: pro.textSec }}>/an</p>
              </div>
            </Card>
            <Card>
              <div className="p-4 text-center">
                <p className="text-[10.5px] uppercase tracking-wider mb-2" style={{ color: pro.textSec }}>ROI</p>
                <p className="text-[20px] font-bold tabular-nums" style={{ color: pro.accent }}>
                  {result.roiMonths}
                </p>
                <p className="text-[10px] mt-1" style={{ color: pro.textSec }}>mois</p>
              </div>
            </Card>
          </div>

          {/* Key benefits */}
          {result.keyBenefits.length > 0 && (
            <Card>
              <div className="p-4">
                <p className="text-[11px] uppercase tracking-wider font-semibold mb-3" style={{ color: pro.textSec }}>Bénéfices clés</p>
                <ul className="space-y-1.5">
                  {result.keyBenefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: pro.text }}>
                      <CheckCircle size={13} className="mt-0.5 flex-shrink-0" style={{ color: pro.ok }} />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          {/* HTML Pitch preview */}
          <Card>
            <div className="p-4">
              <p className="text-[11px] uppercase tracking-wider font-semibold mb-3" style={{ color: pro.textSec }}>Aperçu du pitch</p>
              <div
                className="prose prose-invert max-w-none text-[13px]"
                dangerouslySetInnerHTML={{ __html: result.htmlPitch }}
              />
            </div>
          </Card>

          {/* Outcome buttons */}
          <Card>
            <div className="p-4">
              <p className="text-[11px] uppercase tracking-wider font-semibold mb-3" style={{ color: pro.textSec }}>Résultat</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveOutcome('converted')}
                  disabled={savingOutcome !== null}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-[12.5px] font-medium transition-colors disabled:opacity-50"
                  style={{ background: 'rgba(34,197,94,0.15)', color: pro.ok, border: `1px solid rgba(34,197,94,0.25)` }}
                >
                  <CheckCircle size={13} />
                  {savingOutcome === 'converted' ? '…' : '✓ Converti'}
                </button>
                <button
                  onClick={() => saveOutcome('rejected')}
                  disabled={savingOutcome !== null}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-[12.5px] font-medium transition-colors disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.10)', color: pro.bad, border: `1px solid rgba(239,68,68,0.20)` }}
                >
                  <XCircle size={13} />
                  {savingOutcome === 'rejected' ? '…' : '✗ Refusé'}
                </button>
                <GhostBtn onClick={() => saveOutcome('no_response')} disabled={savingOutcome !== null}>
                  <MinusCircle size={13} />
                  {savingOutcome === 'no_response' ? '…' : '— Sans réponse'}
                </GhostBtn>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
