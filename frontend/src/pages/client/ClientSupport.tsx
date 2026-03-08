import { useState } from 'react';
import { Send, ChevronDown, ChevronUp, HelpCircle, MessageCircle } from 'lucide-react';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';

export default function ClientSupport() {
  const { t } = useLang();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqItems = [
    { q: t('cdash.support.faq1.q'), a: t('cdash.support.faq1.a') },
    { q: t('cdash.support.faq2.q'), a: t('cdash.support.faq2.a') },
    { q: t('cdash.support.faq3.q'), a: t('cdash.support.faq3.a') },
    { q: t('cdash.support.faq4.q'), a: t('cdash.support.faq4.a') },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post('/my-dashboard/support', { subject, message });
      setSent(true);
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setError(err.response?.data?.error || t('cdash.support.error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">{t('cdash.support.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact form */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <MessageCircle size={16} className="text-[#6366f1]" />
            {t('cdash.support.contact')}
          </h2>

          {sent ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <Send size={24} className="text-emerald-600" />
              </div>
              <p className="text-sm text-emerald-600 font-medium">{t('cdash.support.sent')}</p>
              <button
                onClick={() => setSent(false)}
                className="mt-4 text-sm text-[#6366f1] hover:underline"
              >
                {t('cdash.support.contact')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-[#86868b] mb-1 block">{t('cdash.support.subject')}</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                />
              </div>
              <div>
                <label className="text-xs text-[#86868b] mb-1 block">{t('cdash.support.message')}</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  rows={5}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 resize-none"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={sending}
                className="w-full py-2.5 text-sm font-medium text-white bg-[#6366f1] rounded-xl hover:bg-[#4f46e5] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <Send size={14} />
                {sending ? t('cdash.support.sending') : t('cdash.support.send')}
              </button>
            </form>
          )}
        </div>

        {/* FAQ */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <HelpCircle size={16} className="text-[#6366f1]" />
            {t('cdash.support.faq')}
          </h2>
          <div className="space-y-2">
            {faqItems.map((faq, i) => (
              <div key={i} className="rounded-xl border border-[#d2d2d7]/40 bg-white overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium hover:bg-[#f5f5f7] transition-colors"
                >
                  <span>{faq.q}</span>
                  {openFaq === i ? <ChevronUp size={16} className="text-[#86868b] flex-shrink-0" /> : <ChevronDown size={16} className="text-[#86868b] flex-shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-3 pt-0">
                    <p className="text-sm text-[#86868b] leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
