import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  ArrowLeft, Check, ChevronRight,
  Building2, Phone, Loader2, Sparkles, SlidersHorizontal, LogOut,
} from '../components/icons';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import AssistantChat from '../components/client/AssistantChat';
import { useLang } from '../stores/langStore';
import api from '../services/api';
import { getReferral, clearReferral } from '../lib/referral';

/**
 * Last step of sign-up: describe the business and configure the receptionist.
 *
 * The card is already registered by now (the guard in App.tsx will not let an
 * unpaid account in), so nothing here touches billing. Two ways through:
 * talk it out with the assistant, or fill the fields by hand.
 */

type Path = null | 'assistant' | 'manual';
type Step = 1 | 2;

export default function SelfOnboard() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { t, lang } = useLang();
  const isFr = lang === 'fr';

  const [path, setPath] = useState<Path>(null);
  const [step, setStep] = useState<Step>(1);
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const finish = async (payload: Record<string, unknown> = {}) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/onboard', {
        businessName: businessName.trim() || undefined,
        businessPhone: phone.trim() || undefined,
        industry: industry || undefined,
        website: website.trim() || undefined,
        referralCode: getReferral(),
        ...payload,
      });
      clearReferral();
      if (data.token) localStorage.setItem('token', data.token);
      if (data.user) useAuthStore.setState({ user: data.user, token: data.token, isLoading: false });
      navigate(data.user?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 402) {
        // The card never cleared — the guard will send them back to /subscribe.
        navigate('/subscribe');
        return;
      }
      const response = (err as { response?: { data?: { error?: string | { message?: string } } } })?.response;
      const errData = response?.data?.error;
      setError(
        typeof errData === 'string'
          ? errData
          : ((errData as { message?: string })?.message || (isFr ? 'Une erreur est survenue.' : 'Something went wrong.')),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]/60">
        <div className="max-w-[640px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QwillioLogo size={28} />
            <span className="text-xl font-semibold tracking-tight">Qwillio</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#86868b]">{isFr ? 'Étape 2 / 2' : 'Step 2 / 2'}</span>
            <LangToggle />
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="inline-flex items-center gap-1.5 text-sm text-[#86868b] hover:text-red-500 transition-colors"
              title={isFr ? 'Se déconnecter' : 'Log out'}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-6 py-10 pb-12">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        {/* ═══ Choice: talk it out, or fill it in ═══ */}
        {path === null && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isFr ? 'Configurons votre réceptionniste' : "Let's set up your receptionist"}
            </h1>
            <p className="mt-2 mb-8 text-[15px] leading-relaxed text-[#525257]">
              {isFr
                ? 'Deux façons de faire, le résultat est le même. Vous pourrez tout changer plus tard.'
                : 'Two ways to do it, same result. Everything stays editable later.'}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPath('assistant')}
                className="group rounded-2xl border-2 border-[#d2d2d7] bg-white p-6 text-left transition-colors hover:border-[#7a5fff]"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#7a5fff]/10">
                  <Sparkles size={20} className="text-[#7a5fff]" />
                </div>
                <h2 className="text-base font-semibold">
                  {isFr ? 'Avec l’assistant' : 'With the assistant'}
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#86868b]">
                  {isFr
                    ? 'Répondez à quelques questions, à l’écrit ou à la voix. Il remplit tout pour vous.'
                    : 'Answer a few questions, by voice or text. It fills everything in for you.'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPath('manual')}
                className="group rounded-2xl border-2 border-[#d2d2d7] bg-white p-6 text-left transition-colors hover:border-[#7a5fff]"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#1d1d1f]/[0.06]">
                  <SlidersHorizontal size={20} className="text-[#1d1d1f]" />
                </div>
                <h2 className="text-base font-semibold">
                  {isFr ? 'Manuellement' : 'Manually'}
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#86868b]">
                  {isFr
                    ? 'Remplissez les champs vous-même. Deux écrans, deux minutes.'
                    : 'Fill the fields yourself. Two screens, two minutes.'}
                </p>
              </button>
            </div>
          </>
        )}

        {/* ═══ Assistant path ═══ */}
        {path === 'assistant' && (
          <>
            <button
              type="button"
              onClick={() => setPath(null)}
              className="mb-5 inline-flex items-center gap-1.5 text-sm text-[#86868b] transition-colors hover:text-[#1d1d1f]"
            >
              <ArrowLeft size={16} /> {isFr ? 'Choisir une autre méthode' : 'Pick another way'}
            </button>

            <AssistantChat
              isFr={isFr}
              initialMode="onboarding"
              lockMode
              onCompleted={() => { void finish(); }}
              /* First-time setup: no number is assigned yet and the page above
                 already introduces the step, so the identity header is noise. */
              showHeader={false}
            />

            <button
              type="button"
              onClick={() => { void finish(); }}
              disabled={loading}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-medium text-white transition-colors duration-300 hover:bg-[#7a5fff] disabled:opacity-40"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isFr ? 'Terminer et ouvrir le dashboard' : 'Finish and open the dashboard'}
            </button>
            <p className="mt-2.5 text-[13px] text-[#86868b]">
              {isFr
                ? 'L’assistant vous y emmène tout seul quand il a l’essentiel.'
                : 'The assistant takes you there on its own once it has the essentials.'}
            </p>
          </>
        )}

        {/* ═══ Manual path ═══ */}
        {path === 'manual' && (
          <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-8">
            {step === 1 && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#7a5fff]/10 flex items-center justify-center">
                    <Building2 size={20} className="text-[#7a5fff]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">{t('selfOnboard.step1.title')}</h2>
                    <p className="text-sm text-[#86868b]">{t('selfOnboard.step1.subtitle')}</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('selfOnboard.businessName')} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#7a5fff]/30 focus:border-[#7a5fff] transition-colors"
                      placeholder="Acme Inc."
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('selfOnboard.industry')}</label>
                    <select
                      value={industry}
                      onChange={e => setIndustry(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#7a5fff]/30 focus:border-[#7a5fff] transition-colors"
                    >
                      <option value="">{t('selfOnboard.selectIndustry')}</option>
                      <option value="restaurant">Restaurant / Food</option>
                      <option value="medical">Medical / Healthcare</option>
                      <option value="legal">Legal</option>
                      <option value="real-estate">Real Estate</option>
                      <option value="salon">Salon / Spa</option>
                      <option value="automotive">Automotive</option>
                      <option value="dental">Dental</option>
                      <option value="hvac">HVAC / Plumbing</option>
                      <option value="retail">Retail / E-commerce</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('selfOnboard.website')}</label>
                    <input
                      type="url"
                      value={website}
                      onChange={e => setWebsite(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#7a5fff]/30 focus:border-[#7a5fff] transition-colors"
                      placeholder="https://mywebsite.com"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#7a5fff]/10 flex items-center justify-center">
                    <Phone size={20} className="text-[#7a5fff]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">{t('selfOnboard.step2.title')}</h2>
                    <p className="text-sm text-[#86868b]">{t('selfOnboard.step2.subtitle')}</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('selfOnboard.phone')}</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#7a5fff]/30 focus:border-[#7a5fff] transition-colors"
                      placeholder="+32 470 12 34 56"
                    />
                    <p className="text-xs text-[#86868b] mt-2">{t('selfOnboard.phoneHint')}</p>
                  </div>
                </div>
              </>
            )}

            {/* ── Navigation ── */}
            <div className="flex items-center justify-between gap-4 mt-10 pt-6 px-2 sm:px-4 border-t border-[#d2d2d7]/40">
              <button
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#86868b] hover:text-[#1d1d1f] transition-colors flex-shrink-0"
                onClick={() => (step > 1 ? setStep(1) : setPath(null))}
              >
                <ArrowLeft size={18} /> {t('onboard.prev')}
              </button>

              {step < 2 ? (
                <button
                  className="inline-flex items-center gap-1.5 bg-[#7a5fff] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-[#7349fe] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  disabled={!businessName.trim()}
                  onClick={() => setStep(2)}
                >
                  {t('onboard.next')} <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  className="inline-flex items-center justify-center gap-1.5 bg-[#1d1d1f] text-white text-sm font-medium px-5 sm:px-6 py-3 rounded-full hover:bg-[#424245] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink min-w-0"
                  disabled={loading}
                  onClick={() => { void finish(); }}
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin flex-shrink-0" /> <span className="truncate">{isFr ? 'Finalisation…' : 'Finishing…'}</span></>
                  ) : (
                    <><Check size={18} className="flex-shrink-0" /> <span className="truncate">{isFr ? 'Ouvrir mon dashboard' : 'Open my dashboard'}</span></>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
