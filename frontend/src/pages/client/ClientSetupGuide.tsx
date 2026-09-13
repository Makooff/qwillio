import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronRight, Clock3, PhoneForwarded, BookOpen, HelpCircle } from '../../components/icons';
import api from '../../services/api';
import { invalidateLive } from '../../services/liveData';
import { DAYS, DEFAULT_HOURS, type WeekHours } from '../../utils/week-hours';

/**
 * Le parcours guidé : une question à la fois, dans l'ordre de ce qui manque.
 *
 * Retour du 13/09/2026 : « il faudrait plus de questions par rapport à la
 * niche et au client pendant l'onboarding ». L'inscription en libre-service
 * ne demande que le nom, le secteur, un site et un téléphone ; les champs du
 * métier n'étaient posés que dans la page Réceptionniste, à qui allait les
 * chercher. Ici ils sont POSÉS, un par un, avec l'exemple rempli du preset.
 *
 * La liste vient du serveur (`/my-dashboard/setup`) : ce qui manque, le plus
 * lourd d'abord. Chaque réponse est enregistrée aussitôt par le même PUT
 * partiel que la page Réceptionniste, donc dans la même forme. Le PUT est
 * PARTIEL : chaque étape n'envoie que sa clé, jamais une copie du reste,
 * qui écraserait ce qu'un autre écran vient d'enregistrer.
 *
 * Tout se passe : le score reste ce qu'il est, et la carte de la vue
 * d'ensemble le redit. « Services et tarifs » n'est pas posé ici (c'est une
 * liste, pas une réponse) : la carte y mène directement.
 */

interface PresetField { id: string; label: string; placeholder: string; multiline?: boolean }
interface FaqEntry { q: string; a: string }
interface SetupItem { id: string; label: string; hint: string; done: boolean; weight: number; to: string }
interface SetupState { score: number; missing: SetupItem[]; openGaps: number; niche: string }

type Step =
  | { kind: 'transferNumber'; id: string; label: string; hint: string }
  | { kind: 'hours'; id: string; label: string; hint: string }
  | { kind: 'field'; id: string; label: string; hint: string; field: PresetField }
  | { kind: 'faq'; id: string; label: string; hint: string };

const GUIDED = new Set(['transferNumber', 'hours', 'faq']);

const inputCls = 'w-full h-11 px-3.5 text-[14px] rounded-xl border border-white/[0.08] bg-white/[0.03] text-[#F8F8FF] placeholder-[#6B6B75] focus:outline-none focus:border-white/25 transition-colors';
const textareaCls = 'w-full min-h-[96px] px-3.5 py-3 text-[14px] leading-relaxed rounded-xl border border-white/[0.08] bg-white/[0.03] text-[#F8F8FF] placeholder-[#6B6B75] focus:outline-none focus:border-white/25 transition-colors resize-y';
const compactInputCls = 'h-9 px-3 text-[13px] rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#F8F8FF] focus:outline-none focus:border-white/25 transition-colors disabled:opacity-30';

function buildSteps(missing: SetupItem[], fields: PresetField[]): Step[] {
  const byId = new Map(fields.map(f => [f.id, f]));
  const steps: Step[] = [];
  for (const m of missing) {
    if (m.id.startsWith('field:')) {
      const field = byId.get(m.id.slice(6));
      if (field) steps.push({ kind: 'field', id: m.id, label: m.label, hint: m.hint, field });
    } else if (GUIDED.has(m.id)) {
      steps.push({ kind: m.id as 'transferNumber' | 'hours' | 'faq', id: m.id, label: m.label, hint: m.hint });
    }
  }
  return steps;
}

export default function ClientSetupGuide() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  // Ce que le serveur porte déjà, pour n'envoyer que des objets complets.
  const [transferNumber, setTransferNumber] = useState('');
  const [hours, setHours] = useState<WeekHours>(DEFAULT_HOURS);
  const [knowledge, setKnowledge] = useState<Record<string, string>>({});
  const [faqEntries, setFaqEntries] = useState<FaqEntry[]>([]);
  const [suggestedFaq, setSuggestedFaq] = useState<FaqEntry[]>([]);
  const [chosenFaq, setChosenFaq] = useState<Set<number>>(new Set());
  const [customFaq, setCustomFaq] = useState<FaqEntry>({ q: '', a: '' });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [setup, settings] = await Promise.all([
          api.get('/my-dashboard/setup').then(r => r.data as SetupState),
          api.get('/my-dashboard/settings').then(r => r.data as Record<string, unknown>),
        ]);
        if (!alive) return;
        const presets = (settings.knowledgePresets as { fields?: PresetField[]; faq?: FaqEntry[] } | undefined) ?? {};
        const built = buildSteps(setup.missing ?? [], presets.fields ?? []);
        setSteps(built);
        const wanted = searchParams.get('step');
        const at = wanted ? built.findIndex(s => s.id === wanted) : -1;
        setIndex(at >= 0 ? at : 0);
        setTransferNumber(typeof settings.transferNumber === 'string' ? settings.transferNumber : '');
        const h = settings.hours;
        setHours(h && typeof h === 'object' && !Array.isArray(h) ? { ...DEFAULT_HOURS, ...(h as Partial<WeekHours>) } : DEFAULT_HOURS);
        setKnowledge(settings.knowledge && typeof settings.knowledge === 'object' ? settings.knowledge as Record<string, string> : {});
        setFaqEntries(Array.isArray(settings.faqEntries) ? settings.faqEntries as FaqEntry[] : []);
        setSuggestedFaq(Array.isArray(presets.faq) ? presets.faq : []);
        if (!built.length) setFinalScore(setup.score);
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setError(msg || 'Le parcours n’a pas pu être chargé.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // Lu une fois au montage : l'étape demandée dans l'URL sert de point de départ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = steps[index] ?? null;

  const finish = useCallback(async () => {
    invalidateLive('/my-dashboard/');
    try {
      const { data } = await api.get('/my-dashboard/setup');
      setFinalScore(typeof data?.score === 'number' ? data.score : 0);
    } catch {
      setFinalScore(0);
    }
  }, []);

  const advance = useCallback(() => {
    setProblem(null);
    if (index + 1 >= steps.length) void finish();
    else setIndex(i => i + 1);
  }, [index, steps.length, finish]);

  const payloadFor = (s: Step): Record<string, unknown> | null => {
    switch (s.kind) {
      case 'transferNumber':
        return transferNumber.trim() ? { transferNumber: transferNumber.trim() } : null;
      case 'hours':
        return { hours };
      case 'field': {
        const value = (knowledge[s.field.id] ?? '').trim();
        return value ? { knowledge: { ...knowledge, [s.field.id]: value } } : null;
      }
      case 'faq': {
        const picked = suggestedFaq.filter((_, i) => chosenFaq.has(i));
        const own = customFaq.q.trim() && customFaq.a.trim() ? [{ q: customFaq.q.trim(), a: customFaq.a.trim() }] : [];
        const added = [...picked, ...own];
        return added.length ? { faqEntries: [...faqEntries, ...added] } : null;
      }
    }
  };

  const save = async () => {
    if (!step) return;
    const payload = payloadFor(step);
    if (!payload) { setProblem('Répondez, ou passez cette question.'); return; }
    setSaving(true);
    setProblem(null);
    try {
      await api.put('/my-dashboard/settings', payload);
      if (payload.faqEntries) setFaqEntries(payload.faqEntries as FaqEntry[]);
      invalidateLive('/my-dashboard/');
      advance();
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      setProblem(data?.message || data?.error || 'L’enregistrement a échoué. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const canSave = useMemo(() => step ? payloadFor(step) !== null : false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, transferNumber, hours, knowledge, chosenFaq, customFaq, faqEntries]);

  if (loading) {
    return (
      <main className="max-w-[720px]" aria-busy="true">
        <div className="animate-pulse rounded-2xl bg-white/[0.04] h-64" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-[720px] space-y-4">
        <p className="text-sm text-white/60" role="alert">{error}</p>
        <button type="button" onClick={() => navigate(0)} className="rounded-full bg-white/[0.06] px-4 h-9 text-sm text-white hover:bg-white/[0.1] transition-colors">Réessayer</button>
      </main>
    );
  }

  if (finalScore !== null || !step) {
    const score = finalScore ?? 100;
    return (
      <main className="max-w-[720px] space-y-6">
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
              <Check size={16} className="text-emerald-400" aria-hidden="true" />
            </span>
            <h1 className="text-[18px] font-semibold text-white/90">
              {score >= 100 ? 'Votre réceptionniste sait tout ce qu’il lui faut' : `Votre réceptionniste connaît ${score} % de son métier`}
            </h1>
          </div>
          <p className="mt-3 text-[13px] text-white/60 leading-relaxed">
            {score >= 100
              ? 'Ce qu’on lui demandera et qu’elle ne saura pas remontera dans la vue d’ensemble, pour que vous répondiez une fois.'
              : 'Ce qui reste est listé sur la vue d’ensemble, avec les questions d’appelants restées sans réponse. Revenez quand vous voulez.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/dashboard" className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-[#0a0a0a] transition-opacity hover:opacity-90 active:scale-[0.97]">
              Retour à la vue d’ensemble <ChevronRight size={14} aria-hidden="true" />
            </Link>
            <Link to="/dashboard/receptionist#connaissances" className="inline-flex min-h-[40px] items-center rounded-full border border-white/[0.1] px-5 text-sm text-white/80 hover:bg-white/[0.04] transition-colors">
              Services et tarifs
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const Icon = step.kind === 'transferNumber' ? PhoneForwarded : step.kind === 'hours' ? Clock3 : step.kind === 'faq' ? HelpCircle : BookOpen;

  return (
    <main className="max-w-[720px] space-y-6">
      <header>
        <p className="text-[12px] uppercase tracking-wider text-white/40">
          Question {index + 1} sur {steps.length}
        </p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-white/90">Compléter votre réceptionniste</h1>
        <p className="mt-1 text-[13px] text-white/50">Une question à la fois. Passez celles qui ne vous concernent pas.</p>
      </header>

      <div className="h-1 rounded-full overflow-hidden bg-white/[0.05]">
        <div className="h-full rounded-full bg-[#7A5FFF] transition-[width] duration-500 ease-out" style={{ width: `${(index / steps.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={step.id}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          aria-labelledby="guide-step-title"
          className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.05] shrink-0">
              <Icon size={15} className="text-white/70" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="guide-step-title" className="text-[16px] font-semibold text-white/90">{step.label}</h2>
              <p className="mt-1 text-[12.5px] text-white/50 leading-relaxed">
                {step.kind === 'field' ? <>Par exemple : <span className="text-white/70">{step.field.placeholder}</span></> : step.hint}
              </p>
            </div>
          </div>

          <div className="mt-5">
            {step.kind === 'transferNumber' && (
              <input
                type="tel"
                value={transferNumber}
                onChange={e => setTransferNumber(e.target.value)}
                placeholder="+32 475 12 34 56"
                aria-label={step.label}
                className={inputCls}
                autoFocus
              />
            )}

            {step.kind === 'field' && (
              step.field.multiline ? (
                <textarea
                  value={knowledge[step.field.id] ?? ''}
                  onChange={e => setKnowledge(k => ({ ...k, [step.field.id]: e.target.value }))}
                  placeholder={step.field.placeholder}
                  aria-label={step.label}
                  className={textareaCls}
                  autoFocus
                />
              ) : (
                <input
                  type="text"
                  value={knowledge[step.field.id] ?? ''}
                  onChange={e => setKnowledge(k => ({ ...k, [step.field.id]: e.target.value }))}
                  placeholder={step.field.placeholder}
                  aria-label={step.label}
                  className={inputCls}
                  autoFocus
                />
              )
            )}

            {step.kind === 'hours' && (
              <div className="rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
                {DAYS.map(d => {
                  const h = hours[d.k];
                  return (
                    <div key={d.k} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5">
                      <span className="col-span-3 text-[13px] font-medium text-[#F2F2F2]">{d.l}</span>
                      <button
                        type="button"
                        onClick={() => setHours(w => ({ ...w, [d.k]: { ...w[d.k], open: !w[d.k].open } }))}
                        aria-pressed={h.open}
                        className="col-span-3 h-8 px-3 rounded-lg text-[11.5px] font-semibold uppercase tracking-wider transition-colors"
                        style={{ background: h.open ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.08)', color: h.open ? '#22C55E' : '#EF4444' }}
                      >
                        {h.open ? 'Ouvert' : 'Fermé'}
                      </button>
                      <input type="time" value={h.from} disabled={!h.open} aria-label={`${d.l}, ouverture`}
                        onChange={e => setHours(w => ({ ...w, [d.k]: { ...w[d.k], from: e.target.value } }))}
                        className={`${compactInputCls} col-span-3`} />
                      <input type="time" value={h.to} disabled={!h.open} aria-label={`${d.l}, fermeture`}
                        onChange={e => setHours(w => ({ ...w, [d.k]: { ...w[d.k], to: e.target.value } }))}
                        className={`${compactInputCls} col-span-3`} />
                    </div>
                  );
                })}
              </div>
            )}

            {step.kind === 'faq' && (
              <div className="space-y-4">
                {suggestedFaq.length > 0 && (
                  <ul className="space-y-2">
                    {suggestedFaq.map((f, i) => {
                      const on = chosenFaq.has(i);
                      return (
                        <li key={f.q}>
                          <button
                            type="button"
                            onClick={() => setChosenFaq(set => { const next = new Set(set); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                            aria-pressed={on}
                            className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${on ? 'border-white/30 bg-white/[0.06]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]'}`}
                          >
                            <span className="block text-[13.5px] font-medium text-white/90">{f.q}</span>
                            <span className="block mt-1 text-[12.5px] text-white/55 leading-relaxed">{f.a}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="grid gap-2">
                  <input type="text" value={customFaq.q} onChange={e => setCustomFaq(c => ({ ...c, q: e.target.value }))}
                    placeholder="Une autre question qu’on vous pose" aria-label="Votre question" className={inputCls} />
                  <textarea value={customFaq.a} onChange={e => setCustomFaq(c => ({ ...c, a: e.target.value }))}
                    placeholder="Et ce que l’agent doit répondre" aria-label="Votre réponse" className={textareaCls} style={{ minHeight: 72 }} />
                </div>
              </div>
            )}
          </div>

          {problem && <p className="mt-3 text-[12.5px] text-red-400" role="alert">{problem}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={advance} disabled={saving}
              className="text-[13px] text-white/50 hover:text-white/80 transition-colors disabled:opacity-50">
              Passer
            </button>
            <button type="button" onClick={save} disabled={saving || !canSave}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-[#0a0a0a] transition-opacity hover:opacity-90 active:scale-[0.97] disabled:opacity-40">
              {saving ? 'Enregistrement…' : index + 1 >= steps.length ? 'Enregistrer et terminer' : 'Enregistrer et continuer'}
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </motion.section>
      </AnimatePresence>
    </main>
  );
}
