import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, ChevronDown, ChevronUp, HelpCircle, MessageCircle,
  Search, BookOpen, Phone, Zap, Settings, CreditCard
} from 'lucide-react';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';

const CATEGORIES = [
  { id: 'general', icon: HelpCircle, label: 'General', color: 'blue' },
  { id: 'billing', icon: CreditCard, label: 'Billing', color: 'purple' },
  { id: 'technical', icon: Settings, label: 'Technical', color: 'cyan' },
  { id: 'calls', icon: Phone, label: 'Calls & AI', color: 'amber' },
];

const FAQ_ITEMS = [
  {
    category: 'general',
    q: 'How does the AI receptionist work?',
    a: 'Your AI receptionist answers incoming calls 24/7, qualifies leads, books appointments, and transfers urgent calls to your team. It uses advanced conversational AI to have natural conversations with callers.',
  },
  {
    category: 'general',
    q: 'Can I customize the AI greeting?',
    a: 'Yes! Go to the AI Receptionist page to configure your business name, industry, and transfer settings. The AI adapts its responses based on your business context.',
  },
  {
    category: 'billing',
    q: 'How does billing work?',
    a: 'You pay a one-time setup fee plus a monthly subscription. Each plan includes a set number of calls per month. You can upgrade or downgrade your plan anytime from the Billing page.',
  },
  {
    category: 'billing',
    q: 'What happens if I exceed my call quota?',
    a: 'When you reach your monthly call limit, additional calls will not be answered by the AI. You\'ll receive a notification before reaching the limit. Consider upgrading your plan for more calls.',
  },
  {
    category: 'technical',
    q: 'How do I set up call transfer?',
    a: 'Go to AI Receptionist → Transfer settings and enter your backup phone number. When the AI determines a caller needs human assistance, it will transfer the call to that number.',
  },
  {
    category: 'calls',
    q: 'How are leads qualified?',
    a: 'The AI scores each caller from 1-10 based on their intent, engagement, and information provided. Callers scoring 7+ are marked as qualified leads. You can review all leads in the Leads page.',
  },
  {
    category: 'calls',
    q: 'Can I listen to call recordings?',
    a: 'Yes, go to Call History and click on any call to see its details including the recording. You can play it directly in the browser.',
  },
  {
    category: 'technical',
    q: 'Is my data secure?',
    a: 'Absolutely. All data is encrypted in transit and at rest. We comply with GDPR and SOC 2 standards. Your call recordings and customer data are stored securely and only accessible by you.',
  },
];

export default function ClientSupport() {
  const { t } = useLang();
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
      setError(typeof errData === 'string' ? errData : (errData?.message || err.message || 'Failed to send message'));
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
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Help & Support</h1>
        <p className="text-sm text-[#86868b]">Find answers or get in touch with our team</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── FAQ Section (3 cols) ── */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <BookOpen size={16} className="text-[#6366f1]" />
              Frequently asked questions
            </h2>

            {/* Search */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b]" />
              <input
                type="text"
                placeholder="Search FAQ..."
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-[#f5f5f7] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
              />
            </div>

            {/* Category filter */}
            <div className="flex gap-1.5 mb-4 overflow-x-auto">
              <button onClick={() => setFaqCategory('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  faqCategory === 'all' ? 'bg-[#6366f1] text-white' : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                All
              </button>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setFaqCategory(c.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    faqCategory === c.id ? 'bg-[#6366f1] text-white' : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  <c.icon size={12} />
                  {c.label}
                </button>
              ))}
            </div>

            {/* FAQ items */}
            <div className="space-y-2">
              {filteredFaq.map((faq, i) => (
                <div key={i} className="rounded-xl border border-[#d2d2d7]/40 bg-[#f5f5f7]/50 overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium hover:bg-[#f5f5f7] transition-colors"
                  >
                    <span className="pr-4">{faq.q}</span>
                    {openFaq === i ? <ChevronUp size={16} className="text-[#86868b] flex-shrink-0" /> : <ChevronDown size={16} className="text-[#86868b] flex-shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        <div className="px-4 pb-4 pt-0">
                          <p className="text-sm text-[#86868b] leading-relaxed">{faq.a}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              {filteredFaq.length === 0 && (
                <p className="text-sm text-[#86868b] text-center py-6">No results found</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Contact form (2 cols) ── */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 sticky top-20">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <MessageCircle size={16} className="text-[#6366f1]" />
              Contact support
            </h2>

            {sent ? (
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <Send size={28} className="text-emerald-600" />
                </div>
                <p className="text-lg font-semibold mb-1">Message sent!</p>
                <p className="text-sm text-[#86868b] mb-4">We'll get back to you within 24 hours</p>
                <button onClick={() => setSent(false)}
                  className="text-sm text-[#6366f1] hover:underline"
                >
                  Send another message
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category */}
                <div>
                  <label className="text-xs text-[#86868b] mb-1.5 block">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.map(c => (
                      <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                          category === c.id
                            ? 'border-[#6366f1] bg-[#6366f1]/5 text-[#6366f1]'
                            : 'border-[#d2d2d7]/60 text-[#86868b] hover:bg-[#f5f5f7]'
                        }`}
                      >
                        <c.icon size={14} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#86868b] mb-1 block">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    required
                    placeholder="Brief description of your issue"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#86868b] mb-1 block">Message</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    required
                    rows={5}
                    placeholder="Describe your issue in detail..."
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 resize-none transition-all"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full py-2.5 text-sm font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={14} />
                  {sending ? 'Sending...' : 'Send message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
