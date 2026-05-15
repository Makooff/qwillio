import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Palette, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/ui/Toast';
import { pro } from '../../styles/pro-theme';
import {
  PageHeader, Card, SectionHead, Pill, PrimaryBtn,
} from '../../components/pro/ProBlocks';

interface ProspectOption {
  id: string;
  businessName: string;
  niche: string;
  city: string;
  score: number;
  googleRating: number | null;
}

interface BrandAnalysis {
  prospectId: string;
  businessName: string;
  brandTone: 'professional' | 'friendly' | 'urgent' | 'luxury' | 'technical';
  brandPersonality: string[];
  recommendedVoiceTone: string;
  recommendedSmsStyle: string;
  recommendedEmailOpener: string;
  pitchAngle: string;
  colorMood: string;
  actionId: string;
}

type PillColor = 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'neutral';

const TONE_COLORS: Record<BrandAnalysis['brandTone'], PillColor> = {
  professional: 'info',
  friendly: 'ok',
  urgent: 'bad',
  luxury: 'accent',
  technical: 'neutral',
};

const TONE_LABELS: Record<BrandAnalysis['brandTone'], string> = {
  professional: 'Professionnel',
  friendly: 'Convivial',
  urgent: 'Urgent',
  luxury: 'Luxe',
  technical: 'Technique',
};

export default function BrandingAgent() {
  const [search, setSearch] = useState('');
  const [prospects, setProspects] = useState<ProspectOption[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<ProspectOption | null>(null);
  const [analysis, setAnalysis] = useState<BrandAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
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

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const selectProspect = useCallback((p: ProspectOption) => {
    setSelectedProspect(p);
    setSearch(p.businessName);
    setDropdownOpen(false);
    setAnalysis(null);
    setError(null);
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!selectedProspect) return;
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await api.post('/ai-agents/branding/analyze', {
        prospectId: selectedProspect.id,
      });
      setAnalysis(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur d\'analyse';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setAnalyzing(false);
    }
  }, [selectedProspect, toast]);

  return (
    <div className="space-y-5 max-w-[900px]">
      <ToastContainer toasts={toasts} remove={remove} />

      <PageHeader
        title="Branding Agent"
        subtitle="Analyse l'identité de marque et recommande le ton de communication"
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

      {/* Selected prospect */}
      {selectedProspect && (
        <Card>
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold" style={{ color: pro.text }}>{selectedProspect.businessName}</p>
              <div className="flex items-center gap-2 mt-1">
                <Pill color="info">{selectedProspect.niche}</Pill>
                <Pill color="neutral">{selectedProspect.city}</Pill>
              </div>
            </div>
            <PrimaryBtn onClick={runAnalysis} disabled={analyzing}>
              {analyzing ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Analyse…
                </>
              ) : (
                <>
                  <Palette size={13} />
                  Analyser la marque
                </>
              )}
            </PrimaryBtn>
          </div>
        </Card>
      )}

      {/* Analyzing skeleton */}
      {analyzing && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl h-8" style={{ background: pro.panel }} />
          ))}
        </div>
      )}

      {/* Analysis result */}
      {analysis && !analyzing && (
        <div className="space-y-4">
          {/* Brand tone — large pill */}
          <Card>
            <div className="p-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: pro.textSec }}>Ton de marque</p>
                <div className="flex items-center gap-3">
                  <span
                    className="text-[16px] font-bold px-4 py-1.5 rounded-full"
                    style={{
                      background: analysis.brandTone === 'professional' ? 'rgba(96,165,250,0.15)'
                        : analysis.brandTone === 'friendly' ? 'rgba(34,197,94,0.15)'
                        : analysis.brandTone === 'urgent' ? 'rgba(239,68,68,0.15)'
                        : analysis.brandTone === 'luxury' ? 'rgba(123,92,240,0.15)'
                        : 'rgba(255,255,255,0.06)',
                      color: analysis.brandTone === 'professional' ? pro.info
                        : analysis.brandTone === 'friendly' ? pro.ok
                        : analysis.brandTone === 'urgent' ? pro.bad
                        : analysis.brandTone === 'luxury' ? pro.accent
                        : pro.textSec,
                    }}
                  >
                    {TONE_LABELS[analysis.brandTone]}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: pro.textSec }}>Ambiance couleur</p>
                <span
                  className="text-[12px] font-medium px-3 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', color: pro.textSec }}
                >
                  {analysis.colorMood}
                </span>
              </div>
            </div>
          </Card>

          {/* Brand personality pills */}
          {analysis.brandPersonality.length > 0 && (
            <Card>
              <div className="p-4">
                <p className="text-[11px] uppercase tracking-wider font-semibold mb-3" style={{ color: pro.textSec }}>Personnalité de marque</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.brandPersonality.map((trait) => (
                    <Pill key={trait} color={TONE_COLORS[analysis.brandTone]}>
                      {trait}
                    </Pill>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* 2x2 info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <div className="p-4">
                <p className="text-[10.5px] uppercase tracking-wider font-semibold mb-2" style={{ color: pro.textSec }}>Ton vocal recommandé</p>
                <p className="text-[13px]" style={{ color: pro.text }}>{analysis.recommendedVoiceTone}</p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-[10.5px] uppercase tracking-wider font-semibold mb-2" style={{ color: pro.textSec }}>Style SMS</p>
                <p className="text-[13px]" style={{ color: pro.text }}>{analysis.recommendedSmsStyle}</p>
              </div>
            </Card>
            <Card>
              <div className="p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-[10.5px] uppercase tracking-wider font-semibold mb-2" style={{ color: pro.textSec }}>Ouverture email</p>
                <p className="text-[13px] italic" style={{ color: pro.text }}>"{analysis.recommendedEmailOpener}"</p>
              </div>
            </Card>
            <Card>
              <div className="p-4" style={{ background: 'rgba(123,92,240,0.06)' }}>
                <p className="text-[10.5px] uppercase tracking-wider font-semibold mb-2" style={{ color: pro.accent }}>Angle de pitch</p>
                <p className="text-[13px]" style={{ color: pro.text }}>{analysis.pitchAngle}</p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
