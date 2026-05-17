import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, ChevronDown, ChevronUp, HelpCircle, MessageCircle,
  Search, BookOpen, Phone, Settings, CreditCard,
} from 'lucide-react';
import api from '../../services/api';

const CATEGORIES = [
  { id: 'general', icon: HelpCircle, label: 'GÃ©nÃ©ral' },
  { id: 'billing', icon: CreditCard, label: 'Facturation' },
  { id: 'technical', icon: Settings, label: 'Technique' },
  { id: 'calls', icon: Phone, label: 'Appels & IA' },
];

const FAQ_ITEMS = [
  {
    category: 'general',
    q: 'Comment fonctionne le rÃ©ceptionniste IA ?',
    a: 'Votre rÃ©ceptionniste IA rÃ©pond aux appels entrants 24h/24 et 7j/7, qualifie les leads, prend des rendez-vous et transfÃ¨re les appels urgents Ã  votre Ã©quipe. Il utilise l\'IA conversationnelle avancÃ©e pour des Ã©changes naturels.',
  },
  {
    category: 'general',
    q: 'Puis-je personnaliser l\'IA ?',
    a: 'Oui ! Allez dans la page RÃ©ceptionniste pour configurer le nom de votre entreprise et le numÃ©ro de transfert. Pour des personnalisations avancÃ©es (voix, script, horaires), contactez notre Ã©quipe support.',
  },
  {
    category: 'billing',
    q: 'Comment fonctionne la facturation ?',
    a: 'Vous payez des frais de setup uniques + un abonnement mensuel. Chaque plan inclut un quota d\'appels mensuel. Vous pouvez upgrader ou downgrader depuis la page Facturation.',
  },
  {
    category: 'billing',
    q: 'Que se passe-t-il si je dÃ©passe mon quota ?',
    a: 'Quand vous atteignez votre limite mensuelle, les appels supplÃ©mentaires ne seront pas pris en charge par l\'IA. Vous recevrez une alerte avant d\'atteindre la limite. Pensez Ã  upgrader votre plan.',
  },
  {
    category: 'technical',
    q: 'Comment configurer le transfert d\'appel ?',
    a: 'Allez dans RÃ©ceptionniste IA et entrez votre numÃ©ro de transfert. Quand l\'IA dÃ©tecte qu\'un appelant a besoin d\'aide humaine, elle transfÃ¨re automatiquement l\'appel Ã  ce numÃ©ro.',
  },
  {
    category: 'calls',
    q: 'Comment les leads sont-ils qualifiÃ©s ?',
    a: 'L\'IA Ã©value chaque appelant de 1 Ã  10 selon son intention, son engagement et les informations fournies. Les appelants avec un score â‰¥ 7 sont marquÃ©s comme leads qualifiÃ©s. Retrouvez-les dans la page Leads.',
  },
  {
    category: 'calls',
    q: 'Puis-je Ã©couter les enregistrements ?',
    a: 'Oui, allez dans Appels et cliquez sur n\'importe quel appel pour voir ses dÃ©tails, y compris l\'enregistrement. Vous pouvez l\'Ã©couter directement dans le navigateur.',
  },
  {
    category: 'technical',
    q: 'Mes donnÃ©es sont-elles sÃ©curisÃ©es ?',
    a: 'Absolument. Toutes les donnÃ©es sont chiffrÃ©es en transit et au repos. Vos enregistrements et donnÃ©es clients sont stockÃ©s de faÃ§on sÃ©curisÃ©e et accessibles uniquement par vous.',
  },
];

const inputCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] placeholder-[#8B8BA7] focus:outline-none focus:border-[#6366F1]/50 transition-all';

export default function ClientSupport() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [faqSearch, setFaqSearch] = useState('');
  const [faqCategory, setFaqCategory] = useState('all');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post('/my-dashboard/support', { subject: `[${category}] ${subject}`, message });
      setSent(true);
      setSubject('');
      setMessage('');
    } catch (err: any) {
      const errData = err.response?.data?.error;
      setError(typeof errData === 'string' ? errData : (errData?.message || err.message || 'Ã‰chec de l\'envoi'));
    } finally {
      setSending(false);
    }
  };

  const filteredFaq = FAQ_ITEMS.filter(f => {
    if (faqCategory !== 'all' && f.category !== faqCategory) return false;
    if (faqSearch) {
      const q = faqSearch.toLowerCase();
      return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-[22px] font-semibold text-[#F5F5F7] tracking-tight">Aide & Support</h1>
        <p className="text-[12.5px] text-[#A1A1A8] mt-0.5">Trouvez des rÃ©ponses ou contactez notre Ã©quipe</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* FAQ */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6">
            <h2 className="text-sm font-semibold text-[#F5F5F7] mb-4 flex items-center gap-2">
              <BookOpen size={16} className="text-[#6366F1]" />
              Questions frÃ©quentes
            </h2>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A8]" />
              <input
                type="text"
                placeholder="Rechercher dans la FAQ..."
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] placeholder-[#8B8BA7] focus:outline-none focus:border-[#6366F1]/50 transition-all"
              />
            </div>

            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
              <button onClick={() => setFaqCategory('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  faqCategory === 'all' ? 'bg-[#6366F1] text-white' : 'bg-white/[0.04] text-[#A1A1A8] hover:text-[#F5F5F7]'
                }`}
              >
                Tous
              </button>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setFaqCategory(c.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    faqCategory === c.id ? 'bg-[#6366F1] text-white' : 'bg-white/[0.04] text-[#A1A1A8] hover:text-[#F5F5F7]'
                  }`}
                >
                  <c.icon size={11} />
                  {c.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredFaq.map((faq, i) => (
                <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-[#F5F5F7] hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="pr-4">{faq.q}</span>
                    {openFaq === i
                      ? <ChevronUp size={15} className="text-[#A1A1A8] flex-shrink-0" />
                      : <ChevronDown size={15} className="text-[#A1A1A8] flex-shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        <div className="px-4 pb-4 pt-0">
                          <p className="text-sm text-[#A1A1A8] leading-relaxed">{faq.a}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              {filteredFaq.length === 0 && (
                <p className="text-sm text-[#A1A1A8] text-center py-6">Aucun rÃ©sultat</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact form */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 sticky top-20">
            <h2 className="text-sm font-semibold text-[#F5F5F7] mb-4 flex items-center gap-2">
              <MessageCircle size={16} className="text-[#6366F1]" />
              Contacter le support
            </h2>

            {sent ? (
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-emerald-400/10 flex items-center justify-center mx-auto mb-4">
                  <Send size={26} className="text-emerald-400" />
                </div>
                <p className="text-base font-semibold text-[#F5F5F7] mb-1">Message envoyÃ© !</p>
                <p className="text-sm text-[#A1A1A8] mb-4">Nous vous rÃ©pondrons dans les 24h</p>
                <button onClick={() => setSent(false)} className="text-sm text-[#6366F1] hover:underline">
                  Envoyer un autre message
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-[#A1A1A8] mb-1.5 block">CatÃ©gorie</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(c => (
                      <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                          category === c.id
                            ? 'border-[#6366F1] bg-[#6366F1]/10 text-[#6366F1]'
                            : 'border-white/[0.07] text-[#A1A1A8] hover:bg-white/[0.04]'
                        }`}
                      >
                        <c.icon size={13} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#A1A1A8] mb-1.5 block">Sujet</label>
                  <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                    required placeholder="DÃ©crivez briÃ¨vement votre problÃ¨me"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#A1A1A8] mb-1.5 block">Message</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)}
                    required rows={5} placeholder="DÃ©crivez votre problÃ¨me en dÃ©tail..."
                    className={inputCls + ' resize-none'}
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button type="submit" disabled={sending}
                  className="w-full py-2.5 text-sm font-medium text-white bg-[#6366F1] rounded-xl hover:bg-[#6a4ee0] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={14} />
                  {sending ? 'Envoi...' : 'Envoyer le message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
