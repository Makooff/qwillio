import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, ChevronDown, ChevronUp, HelpCircle, MessageCircle,
  Search, BookOpen, Phone, Settings, CreditCard,
} from 'lucide-react';
import api from '../../services/api';

const CATEGORIES = [
  { id: 'general', icon: HelpCircle, label: 'Général' },
  { id: 'billing', icon: CreditCard, label: 'Facturation' },
  { id: 'technical', icon: Settings, label: 'Technique' },
  { id: 'calls', icon: Phone, label: 'Appels & IA' },
];

const FAQ_ITEMS = [
  {
    category: 'general',
    q: 'Comment fonctionne le réceptionniste IA ?',
    a: 'Votre réceptionniste IA répond aux appels entrants 24h/24 et 7j/7, qualifie les leads, prend des rendez-vous et transfère les appels urgents à votre équipe. Il utilise l\'IA conversationnelle avancée pour des échanges naturels.',
  },
  {
    category: 'general',
    q: 'Puis-je personnaliser l\'IA ?',
    a: 'Oui ! Allez dans la page Réceptionniste pour configurer le nom de votre entreprise et le numéro de transfert. Pour des personnalisations avancées (voix, script, horaires), contactez notre équipe support.',
  },
  {
    category: 'billing',
    q: 'Comment fonctionne la facturation ?',
    a: 'Vous payez des frais de setup uniques + un abonnement mensuel. Chaque plan inclut un quota d\'appels mensuel. Vous pouvez upgrader ou downgrader depuis la page Facturation.',
  },
  {
    category: 'billing',
    q: 'Que se passe-t-il si je dépasse mon quota ?',
    a: 'Quand vous atteignez votre limite mensuelle, les appels supplémentaires ne seront pas pris en charge par l\'IA. Vous recevrez une alerte avant d\'atteindre la limite. Pensez à upgrader votre plan.',
  },
  {
    category: 'technical',
    q: 'Comment configurer le transfert d\'appel ?',
    a: 'Allez dans Réceptionniste IA et entrez votre numéro de transfert. Quand l\'IA détecte qu\'un appelant a besoin d\'aide humaine, elle transfère automatiquement l\'appel à ce numéro.',
  },
  {
    category: 'calls',
    q: 'Comment les leads sont-ils qualifiés ?',
    a: 'L\'IA évalue chaque appelant de 1 à 10 selon son intention, son engagement et les informations fournies. Les appelants avec un score ≥ 7 sont marqués comme leads qualifiés. Retrouvez-les dans la page Leads.',
  },
  {
    category: 'calls',
    q: 'Puis-je écouter les enregistrements ?',
    a: 'Oui, allez dans Appels et cliquez sur n\'importe quel appel pour voir ses détails, y compris l\'enregistrement. Vous pouvez l\'écouter directement dans le navigateur.',
  },
  {
    category: 'technical',
    q: 'Mes données sont-elles sécurisées ?',
    a: 'Absolument. Toutes les données sont chiffrées en transit et au repos. Vos enregistrements et données clients sont stockés de façon sécurisée et accessibles uniquement par vous.',
  },
];

const inputCls = 'w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0D0D15] text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50 transition-all';

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
      setError(typeof errData === 'string' ? errData : (errData?.message || err.message || 'Échec de l\'envoi'));
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
        <h1 className="text-2xl font-bold text-[#F8F8FF] tracking-tight">Aide & Support</h1>
        <p className="text-sm text-[#8B8BA7]">Trouvez des réponses ou contactez notre équipe</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* FAQ */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-white/[0.06] bg-[#12121A] p-6">
            <h2 className="text-sm font-semibold text-[#F8F8FF] mb-4 flex items-center gap-2">
              <BookOpen size={16} className="text-[#7B5CF0]" />
              Questions fréquentes
            </h2>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8BA7]" />
              <input
                type="text"
                placeholder="Rechercher dans la FAQ..."
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0D0D15] text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7B5CF0]/50 transition-all"
              />
            </div>

            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
              <button onClick={() => setFaqCategory('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  faqCategory === 'all' ? 'bg-[#7B5CF0] text-white' : 'bg-white/[0.04] text-[#8B8BA7] hover:text-[#F8F8FF]'
                }`}
              >
                Tous
              </button>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setFaqCategory(c.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    faqCategory === c.id ? 'bg-[#7B5CF0] text-white' : 'bg-white/[0.04] text-[#8B8BA7] hover:text-[#F8F8FF]'
                  }`}
                >
                  <c.icon size={11} />
                  {c.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredFaq.map((faq, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-[#0D0D15] overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-[#F8F8FF] hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="pr-4">{faq.q}</span>
                    {openFaq === i
                      ? <ChevronUp size={15} className="text-[#8B8BA7] flex-shrink-0" />
                      : <ChevronDown size={15} className="text-[#8B8BA7] flex-shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        <div className="px-4 pb-4 pt-0">
                          <p className="text-sm text-[#8B8BA7] leading-relaxed">{faq.a}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              {filteredFaq.length === 0 && (
                <p className="text-sm text-[#8B8BA7] text-center py-6">Aucun résultat</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact form */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-white/[0.06] bg-[#12121A] p-6 sticky top-20">
            <h2 className="text-sm font-semibold text-[#F8F8FF] mb-4 flex items-center gap-2">
              <MessageCircle size={16} className="text-[#7B5CF0]" />
              Contacter le support
            </h2>

            {sent ? (
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-emerald-400/10 flex items-center justify-center mx-auto mb-4">
                  <Send size={26} className="text-emerald-400" />
                </div>
                <p className="text-base font-semibold text-[#F8F8FF] mb-1">Message envoyé !</p>
                <p className="text-sm text-[#8B8BA7] mb-4">Nous vous répondrons dans les 24h</p>
                <button onClick={() => setSent(false)} className="text-sm text-[#7B5CF0] hover:underline">
                  Envoyer un autre message
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-[#8B8BA7] mb-1.5 block">Catégorie</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(c => (
                      <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                          category === c.id
                            ? 'border-[#7B5CF0] bg-[#7B5CF0]/10 text-[#7B5CF0]'
                            : 'border-white/[0.08] text-[#8B8BA7] hover:bg-white/[0.04]'
                        }`}
                      >
                        <c.icon size={13} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#8B8BA7] mb-1.5 block">Sujet</label>
                  <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                    required placeholder="Décrivez brièvement votre problème"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#8B8BA7] mb-1.5 block">Message</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)}
                    required rows={5} placeholder="Décrivez votre problème en détail..."
                    className={inputCls + ' resize-none'}
                  />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button type="submit" disabled={sending}
                  className="w-full py-2.5 text-sm font-medium text-white bg-[#7B5CF0] rounded-xl hover:bg-[#6a4ee0] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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
