import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ChevronRight, ChevronLeft, Check, AlertCircle,
  Loader2, PartyPopper, Sparkles
} from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import { useLang } from '../stores/langStore';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'multiselect' | 'email' | 'tel' | 'url';
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export default function OnboardingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const clientId = params.get('id') || '';
  const token = params.get('token') || '';
  const { t } = useLang();

  const [sections, setSections] = useState<FormSection[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const confettiRef = useRef<HTMLCanvasElement>(null);

  const api = axios.create({ baseURL: '/api', headers: { 'x-portal-token': token } });

  useEffect(() => {
    if (!clientId || !token) {
      setError(t('onboard.error.link'));
      setLoading(false);
      return;
    }
    api.get(`/onboarding/${clientId}/form?token=${token}`)
      .then(res => {
        const d = res.data;
        if (d.completed) { setCompleted(true); setLoading(false); return; }
        setSections(d.sections || []);
        setFormData(d.existingData || {});
      })
      .catch(err => { const errData = err.response?.data?.error; setError(typeof errData === 'string' ? errData : (errData?.message || err.message || t('onboard.error.load'))); })
      .finally(() => setLoading(false));
  }, [clientId, token]);

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiSelect = (name: string, option: string) => {
    setFormData(prev => {
      const current = prev[name] || [];
      const next = current.includes(option)
        ? current.filter((o: string) => o !== option)
        : [...current, option];
      return { ...prev, [name]: next };
    });
  };

  const canAdvance = () => {
    const section = sections[currentSection];
    if (!section) return true;
    return section.fields
      .filter(f => f.required)
      .every(f => {
        const v = formData[f.name];
        if (Array.isArray(v)) return v.length > 0;
        return v && String(v).trim() !== '';
      });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/onboarding/${clientId}/form`, { data: formData, token });
      setCompleted(true);
      launchConfetti();
      setTimeout(() => {
        navigate(`/portal?id=${clientId}&token=${token}`);
      }, 4000);
    } catch (err: any) {
      const errData = err.response?.data?.error;
      setError(typeof errData === 'string' ? errData : (errData?.message || err.message || t('onboard.error.submit')));
    } finally {
      setSubmitting(false);
    }
  };

  const launchConfetti = () => {
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#6366f1', '#6366f1', '#a855f7', '#f59e0b', '#ec4899', '#22d3ee'];
    const particles: { x: number; y: number; vx: number; vy: number; w: number; h: number; color: string; rotation: number; rv: number }[] = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        w: Math.random() * 10 + 4,
        h: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rv: (Math.random() - 0.5) * 8,
      });
    }

    let frame = 0;
    const animate = () => {
      frame++;
      if (frame > 300) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.rotation += p.rv;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame / 300);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      requestAnimationFrame(animate);
    };
    animate();
  };

  const progress = sections.length > 0 ? ((currentSection + 1) / sections.length) * 100 : 0;

  /* ── Error state ── */
  if (error && !completed) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <LangToggle className="fixed top-4 right-4 z-50" />
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-2xl font-semibold text-[#1d1d1f] mb-2">{t('onboard.error.title')}</h2>
          <p className="text-[#86868b]">{error}</p>
        </div>
      </div>
    );
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LangToggle className="fixed top-4 right-4 z-50" />
        <div className="text-center">
          <Loader2 size={40} className="mx-auto text-[#6366f1] animate-spin mb-4" />
          <p className="text-[#86868b]">{t('onboard.loading')}</p>
        </div>
      </div>
    );
  }

  /* ── Completed state ── */
  if (completed) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6 relative">
        <LangToggle className="fixed top-4 right-4 z-50" />
        <canvas ref={confettiRef} className="fixed inset-0 pointer-events-none z-50" />
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#6366f1]/10 flex items-center justify-center mx-auto mb-6">
            <PartyPopper size={40} className="text-[#6366f1]" />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f] mb-3">{t('onboard.done.title')}</h2>
          <p className="text-[#86868b] leading-relaxed mb-6">{t('onboard.done.text')}</p>
          <div className="inline-flex items-center gap-2 text-sm text-[#6366f1] font-medium">
            <Sparkles size={16} />
            <span>{t('onboard.done.agent')}</span>
          </div>
        </div>
      </div>
    );
  }

  const section = sections[currentSection];

  /* ── Form ── */
  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]/60">
        <div className="max-w-[640px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QwillioLogo size={28} />
            <span className="text-xl font-semibold tracking-tight">Qwillio</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#86868b]">{t('onboard.step')} {currentSection + 1} / {sections.length}</span>
            <LangToggle />
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-[#d2d2d7]/30">
          <div
            className="h-full bg-[#6366f1] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* ── Step dots ── */}
      <div className="flex items-center justify-center gap-2 py-6">
        {sections.map((_, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
              i < currentSection
                ? 'bg-[#6366f1] text-white'
                : i === currentSection
                ? 'bg-[#6366f1]/10 text-[#6366f1] border-2 border-[#6366f1]'
                : 'bg-[#f5f5f7] text-[#86868b]'
            }`}
          >
            {i < currentSection ? <Check size={14} /> : i + 1}
          </div>
        ))}
      </div>

      {/* ── Form card ── */}
      <main className="max-w-[640px] mx-auto px-6 pb-12">
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-8">
          <h2 className="text-2xl font-semibold tracking-tight mb-2">{section?.title}</h2>
          {section?.description && (
            <p className="text-[#86868b] text-sm mb-8">{section.description}</p>
          )}

          <div className="space-y-6">
            {section?.fields.map(field => (
              <div key={field.name}>
                <label className="block text-sm font-medium mb-2">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all resize-none"
                    placeholder={field.placeholder}
                    value={formData[field.name] || ''}
                    onChange={e => handleChange(field.name, e.target.value)}
                    rows={4}
                  />
                ) : field.type === 'select' ? (
                  <select
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
                    value={formData[field.name] || ''}
                    onChange={e => handleChange(field.name, e.target.value)}
                  >
                    <option value="">{field.placeholder || t('onboard.select')}</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'multiselect' ? (
                  <div className="flex flex-wrap gap-2">
                    {field.options?.map(opt => {
                      const selected = (formData[field.name] || []).includes(opt);
                      return (
                        <label
                          key={opt}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-all ${
                            selected
                              ? 'bg-[#6366f1] text-white'
                              : 'bg-white border border-[#d2d2d7] text-[#1d1d1f] hover:border-[#6366f1]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleMultiSelect(field.name, opt)}
                            hidden
                          />
                          {selected && <Check size={14} />}
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type={field.type}
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
                    placeholder={field.placeholder}
                    value={formData[field.name] || ''}
                    onChange={e => handleChange(field.name, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          {/* ── Navigation ── */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-[#d2d2d7]/40">
            {currentSection > 0 ? (
              <button
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                onClick={() => setCurrentSection(prev => prev - 1)}
              >
                <ChevronLeft size={18} /> {t('onboard.prev')}
              </button>
            ) : <div />}

            {currentSection < sections.length - 1 ? (
              <button
                className="inline-flex items-center gap-1.5 bg-[#6366f1] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-[#4f46e5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!canAdvance()}
                onClick={() => setCurrentSection(prev => prev + 1)}
              >
                {t('onboard.next')} <ChevronRight size={18} />
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-1.5 bg-[#1d1d1f] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-[#424245] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!canAdvance() || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <><Loader2 size={18} className="animate-spin" /> {t('onboard.submitting')}</>
                ) : (
                  <>{t('onboard.finish')} <Check size={18} /></>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
