import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PhoneCall, Send, Bell, Check, Clock, Link2, Loader2, X } from '../../components/icons';
import api from '../../services/api';

/**
 * Les intégrations, rangées par ce qu'elles FONT.
 *
 * Le réflexe est de les ranger par catégorie (CRM, agenda, messagerie) et de
 * poser une grille de logos. C'est ce que fait la concurrence, et c'est ce qui
 * produit une page où tout se ressemble et où rien ne dit à quoi ça sert.
 *
 * Trois sections, trois verbes, et la première est la seule qui distingue une
 * réceptionniste d'un formulaire de contact: ce que l'agent LIT pendant l'appel
 * change ce qu'il DIT. Les deux autres se contentent de ranger le résultat
 * ailleurs, ce qui est utile mais ne s'entend pas au téléphone.
 *
 * L'état est écrit tel que le serveur l'envoie, jamais embelli. « Bientôt »
 * reste « bientôt »: une carte qui afficherait « connecté » sur une intégration
 * que la synchro ignore serait découverte par le client en cherchant ses leads
 * chez lui, ce qui coûte plus cher que l'aveu.
 */

type Verb = 'read_live' | 'write_after' | 'notify';
type Transport = 'native' | 'relay' | 'planned';

interface Entry {
  id: string;
  name: string;
  verbs: Verb[];
  transport: Transport;
  setup: 'url' | 'oauth' | 'apiKey' | 'none';
  benefit: string;
  connected: boolean;
}

const SECTIONS: { verb: Verb; icon: typeof PhoneCall; title: string; blurb: string }[] = [
  {
    verb: 'read_live',
    icon: PhoneCall,
    title: "Pendant l'appel",
    blurb: "L'agent les consulte en parlant. C'est ce qui lui permet d'annoncer un vrai créneau au lieu de promettre un rappel.",
  },
  {
    verb: 'write_after',
    icon: Send,
    title: "Après l'appel",
    blurb: 'Le résultat part là où vous travaillez déjà, sans que personne le recopie.',
  },
  {
    verb: 'notify',
    icon: Bell,
    title: 'Prévenir quelqu’un',
    blurb: 'Un message part vers votre équipe quand un appel mérite une réaction humaine.',
  },
];

/** L'état réel, dit en un mot. Aucun n'est décoratif. */
function badge(entry: Entry): { label: string; cls: string; icon: typeof Check } {
  if (entry.connected) {
    return { label: 'Connecté', cls: 'text-[#4ade80] bg-[#4ade80]/10', icon: Check };
  }
  if (entry.transport === 'native') {
    return { label: 'Disponible', cls: 'text-[#7349fe] bg-[#7349fe]/10', icon: Link2 };
  }
  if (entry.transport === 'relay') {
    return { label: 'Via Make ou Zapier', cls: 'text-[#8B8BA7] bg-white/[0.04]', icon: Link2 };
  }
  return { label: 'Bientôt', cls: 'text-[#8B8BA7] bg-white/[0.04]', icon: Clock };
}

export default function ClientIntegrations() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  /* Le fournisseur en cours de branchement, ou null. Un seul à la fois: le
     formulaire tient dans la carte plutôt que dans une fenêtre, parce qu'on
     colle une URL et qu'ouvrir une modale pour un champ est disproportionné. */
  const [opening, setOpening] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    api.get('/crm/integrations/catalog')
      .then(r => setEntries(r.data.integrations ?? []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const connect = async (entry: Entry) => {
    setSaving(true);
    setProblem('');
    try {
      await api.post(`/crm/integrations/${entry.id}/connect`, { config: { webhookUrl: url.trim() } });
      setEntries(list => list.map(e => (e.id === entry.id ? { ...e, connected: true } : e)));
      setOpening(null);
      setUrl('');
    } catch (e: unknown) {
      /* Le message du serveur tel quel: c'est lui qui sait pourquoi une URL est
         refusée (adresse interne, absence de HTTPS), et le réécrire ici ferait
         diverger les deux au premier changement de règle. */
      const detail = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setProblem(detail || "La connexion n'a pas abouti.");
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async (entry: Entry) => {
    setEntries(list => list.map(e => (e.id === entry.id ? { ...e, connected: false } : e)));
    try {
      await api.post(`/crm/integrations/${entry.id}/disconnect`);
    } catch {
      // Remettre l'état vrai plutôt que laisser croire à une déconnexion.
      setEntries(list => list.map(e => (e.id === entry.id ? { ...e, connected: true } : e)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2.5 py-16 text-sm text-[#8B8BA7]" aria-busy="true">
        <Loader2 className="w-4 h-4 animate-spin" />
        Chargement des intégrations
      </div>
    );
  }

  if (failed) {
    return (
      <p className="py-16 text-sm text-[#8B8BA7]">
        La liste n'a pas pu être chargée. Rechargez la page.
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-12 pb-16">
      <p className="text-sm leading-relaxed text-[#8B8BA7]">
        Seuls les outils de votre métier sont listés. Ce qui porte « Via Make ou Zapier »
        fonctionne dès aujourd'hui : vous collez l'URL de votre scénario, et vos appels y partent.
      </p>

      {SECTIONS.map(section => {
        /* Un fournisseur qui sert deux verbes n'apparaît qu'une fois, sous le
           plus fort: le voir deux fois donnerait l'impression de deux
           intégrations à brancher. */
        const mine = entries.filter(e => e.verbs[0] === section.verb);
        if (mine.length === 0) return null;
        const Icon = section.icon;
        const live = section.verb === 'read_live';

        return (
          <section key={section.verb}>
            <div className="flex items-baseline gap-2.5">
              <Icon className="w-4 h-4 shrink-0 translate-y-0.5 text-[#7349fe]" />
              <h2 className="text-[15px] font-semibold text-[#F5F5F7]">{section.title}</h2>
            </div>
            <p className="mt-1.5 mb-5 pl-[26px] text-[13px] leading-relaxed text-[#8B8BA7]">
              {section.blurb}
            </p>

            <ul className="space-y-2">
              {mine.map((entry, i) => {
                const b = badge(entry);
                const BadgeIcon = b.icon;
                const canOpen = entry.setup === 'url' && !entry.connected && entry.transport !== 'planned';

                return (
                  <motion.li
                    key={entry.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                    /* La lecture en direct est la seule section qui change ce
                       que l'appelant ENTEND: elle est posée sur une surface
                       plus marquée, les deux autres restent en retrait. */
                    className={`rounded-xl border px-4 py-3.5 ${
                      live
                        ? 'border-[#7349fe]/20 bg-[#7349fe]/[0.04]'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#F5F5F7]">{entry.name}</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-[#8B8BA7]">{entry.benefit}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium ${b.cls}`}>
                        <BadgeIcon className="w-3 h-3" />
                        {b.label}
                      </span>
                    </div>

                    {(canOpen || entry.connected) && (
                      <div className="mt-3 flex items-center gap-3">
                        {canOpen && opening !== entry.id && (
                          <button
                            onClick={() => { setOpening(entry.id); setUrl(''); setProblem(''); }}
                            className="text-[13px] font-medium text-[#7349fe] hover:text-[#8f6dff] transition-colors"
                          >
                            Brancher
                          </button>
                        )}
                        {entry.connected && (
                          <button
                            onClick={() => disconnect(entry)}
                            className="text-[13px] text-[#8B8BA7] hover:text-[#F5F5F7] transition-colors"
                          >
                            Débrancher
                          </button>
                        )}
                      </div>
                    )}

                    {opening === entry.id && (
                      <div className="mt-3 space-y-2">
                        <label htmlFor={`url-${entry.id}`} className="block text-[12px] text-[#8B8BA7]">
                          {entry.transport === 'relay'
                            ? `L'URL du scénario Make, Zapier ou n8n qui reçoit vos appels pour ${entry.name}`
                            : "L'URL qui recevra vos appels"}
                        </label>
                        <div className="flex gap-2">
                          <input
                            id={`url-${entry.id}`}
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            placeholder="https://hook.eu2.make.com/..."
                            className="flex-1 min-w-0 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[13px] text-[#F5F5F7] placeholder-[#5c5c73] focus:border-[#7349fe]/50 focus:outline-none transition-colors"
                          />
                          <button
                            onClick={() => connect(entry)}
                            disabled={saving || !url.trim()}
                            className="shrink-0 rounded-lg bg-[#7349fe] px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-40 hover:bg-[#8f6dff] transition-colors"
                          >
                            {saving ? 'Connexion' : 'Connecter'}
                          </button>
                          <button
                            onClick={() => { setOpening(null); setProblem(''); }}
                            aria-label="Annuler"
                            className="shrink-0 rounded-lg border border-white/[0.07] px-2 text-[#8B8BA7] hover:text-[#F5F5F7] transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {problem && <p className="text-[12px] text-[#f87171]">{problem}</p>}
                      </div>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
