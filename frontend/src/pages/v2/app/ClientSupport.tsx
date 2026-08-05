import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  CreditCard,
  HelpCircle,
  MessageCircle,
  Phone,
  Search,
  Send,
  Settings,
} from '../../../components/icons';
import api from '../../../services/api';
import {
  Card,
  EmptyState,
  Field,
  GhostBtn,
  Input,
  PageActions,
  PrimaryBtn,
  SectionHead,
  Textarea,
  inputCls,
} from '../../../components/v2/app/Blocks';

/* Support V2 « instrument ». Même endpoint que la V1 client:
   POST /my-dashboard/support (sujet préfixé par la catégorie).
   FAQ locale, accordéon hairline. Le h1 est rendu par AppShell. */

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
    a: "Votre réceptionniste IA répond aux appels entrants 24h/24 et 7j/7, qualifie les leads, prend des rendez-vous et transfère les appels urgents à votre équipe. Il utilise l'IA conversationnelle avancée pour des échanges naturels.",
  },
  {
    category: 'general',
    q: "Puis-je personnaliser l'IA ?",
    a: "Oui ! Allez dans la page Réceptionniste pour configurer le nom de votre entreprise et le numéro de transfert. Pour des personnalisations avancées (voix, script, horaires), contactez notre équipe support.",
  },
  {
    category: 'billing',
    q: 'Comment fonctionne la facturation ?',
    a: "Vous payez un abonnement mensuel, sans frais de setup. Chaque plan inclut un nombre de minutes par mois ; au-delà, les minutes supplémentaires sont facturées à l'usage. Vous pouvez upgrader ou downgrader depuis la page Facturation.",
  },
  {
    category: 'billing',
    q: 'Que se passe-t-il si je dépasse mon quota ?',
    a: "Quand vous atteignez votre limite mensuelle, les appels supplémentaires ne seront pas pris en charge par l'IA. Vous recevrez une alerte avant d'atteindre la limite. Pensez à upgrader votre plan.",
  },
  {
    category: 'technical',
    q: "Comment configurer le transfert d'appel ?",
    a: "Allez dans Réceptionniste IA et entrez votre numéro de transfert. Quand l'IA détecte qu'un appelant a besoin d'aide humaine, elle transfère automatiquement l'appel à ce numéro.",
  },
  {
    category: 'calls',
    q: 'Comment les leads sont-ils qualifiés ?',
    a: "L'IA évalue chaque appelant de 1 à 10 selon son intention, son engagement et les informations fournies. Les appelants avec un score ≥ 7 sont marqués comme leads qualifiés. Retrouvez-les dans la page Leads.",
  },
  {
    category: 'calls',
    q: 'Puis-je écouter les enregistrements ?',
    a: "Oui, allez dans Appels et cliquez sur n'importe quel appel pour voir ses détails, y compris l'enregistrement. Vous pouvez l'écouter directement dans le navigateur.",
  },
  {
    category: 'technical',
    q: 'Mes données sont-elles sécurisées ?',
    a: 'Absolument. Toutes les données sont chiffrées en transit et au repos. Vos enregistrements et données clients sont stockés de façon sécurisée et accessibles uniquement par vous.',
  },
];

const chipCls = (active: boolean) =>
  `inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium border transition-colors duration-150 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
    active
      ? 'bg-q2-obsidian border-q2-smoke-d text-white'
      : 'bg-transparent border-q2-graphite-d text-q2-fog hover:text-q2-mist'
  }`;

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post('/my-dashboard/support', { subject: `[${category}] ${subject}`, message });
      setSent(true);
      setSubject('');
      setMessage('');
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string | { message?: string } } } })?.response?.data
        ?.error;
      setError(
        typeof errData === 'string'
          ? errData
          : (errData as { message?: string } | undefined)?.message ??
              (err instanceof Error ? err.message : "Échec de l'envoi"),
      );
    } finally {
      setSending(false);
    }
  };

  const filteredFaq = FAQ_ITEMS.filter((f) => {
    if (faqCategory !== 'all' && f.category !== faqCategory) return false;
    if (faqSearch) {
      const q = faqSearch.toLowerCase();
      return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageActions subtitle="Trouvez des réponses ou contactez notre équipe" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* FAQ */}
        <section className="lg:col-span-3">
          <SectionHead
            title={
              <span className="flex items-center gap-2">
                <BookOpen size={12} aria-hidden="true" />
                Questions fréquentes
              </span>
            }
          />

          <div className="relative mb-3">
            <Search
              size={14}
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-q2-fog pointer-events-none"
            />
            <input
              type="search"
              placeholder="Rechercher dans la FAQ"
              aria-label="Rechercher dans la FAQ"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              className={`${inputCls} pl-9`}
            />
          </div>

          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
            <button type="button" onClick={() => setFaqCategory('all')} className={chipCls(faqCategory === 'all')}>
              Tous
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFaqCategory(c.id)}
                className={chipCls(faqCategory === c.id)}
              >
                <c.icon size={11} aria-hidden="true" />
                {c.label}
              </button>
            ))}
          </div>

          <Card pad={false}>
            {filteredFaq.length === 0 ? (
              <EmptyState icon={Search} title="Aucun résultat" description="Aucune question ne correspond à votre recherche." />
            ) : (
              filteredFaq.map((faq, i) => {
                const open = openFaq === i;
                return (
                  <div key={faq.q} className={i === 0 ? '' : 'border-t border-q2-graphite-d'}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenFaq(open ? null : i)}
                      className="w-full min-h-[52px] flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-q2-obsidian/50 transition-colors duration-100 focus:outline-none focus-visible:bg-q2-obsidian"
                    >
                      <span className="text-[13.5px] font-medium text-white">{faq.q}</span>
                      <ChevronDown
                        size={14}
                        aria-hidden="true"
                        className={`shrink-0 text-q2-fog transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {open && (
                      <p className="px-4 pb-4 text-[12.5px] leading-relaxed text-q2-mist q2-body-text">{faq.a}</p>
                    )}
                  </div>
                );
              })
            )}
          </Card>
        </section>

        {/* Contact */}
        <section className="lg:col-span-2">
          <SectionHead
            title={
              <span className="flex items-center gap-2">
                <MessageCircle size={12} aria-hidden="true" />
                Contacter le support
              </span>
            }
          />

          <Card>
            {sent ? (
              <EmptyState
                icon={Check}
                title="Message envoyé"
                description="Nous vous répondrons dans les 24h."
                action={
                  <GhostBtn type="button" onClick={() => setSent(false)}>
                    Envoyer un autre message
                  </GhostBtn>
                }
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <fieldset>
                  <legend className="block text-[12px] font-medium text-q2-mist mb-1.5">Catégorie</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={category === c.id}
                        onClick={() => setCategory(c.id)}
                        className={chipCls(category === c.id)}
                      >
                        <c.icon size={11} aria-hidden="true" />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <Field label="Sujet">
                  <Input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    placeholder="Décrivez brièvement votre problème"
                  />
                </Field>

                <Field label="Message">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    placeholder="Décrivez votre problème en détail"
                    className="resize-none"
                  />
                </Field>

                {error && (
                  <p className="text-[12px]" style={{ color: 'var(--q2p-bad)' }}>
                    {error}
                  </p>
                )}

                <PrimaryBtn type="submit" disabled={sending} className="w-full">
                  <Send size={13} aria-hidden="true" />
                  {sending ? 'Envoi…' : 'Envoyer le message'}
                </PrimaryBtn>
              </form>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
