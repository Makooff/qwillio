import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Phone, Trash2, Check, Loader2, ChevronDown } from '../icons';

/**
 * « Votre numéro » — celui que vos clients composent depuis toujours.
 *
 * Pourquoi cet écran existe, et pourquoi son absence était bloquante.
 *
 * Le renvoi d'appel est ce qu'on demande à TOUS les clients de faire à
 * l'installation: garder leur numéro, et le renvoyer vers notre ligne. Mais un
 * appel renvoyé arrive chez nous sur une ligne que plusieurs clients partagent.
 * Ce qui dit alors DE QUI il s'agit, c'est le numéro d'origine transporté par le
 * renvoi, et le routage ne peut le reconnaître que si ce numéro a été déclaré
 * quelque part.
 *
 * Il n'existait aucun endroit pour le déclarer. La route serveur existait, mais
 * réservée au forfait Enterprise et appelée par aucun écran. Conséquence
 * concrète: un client recevait un numéro américain qu'il ne pouvait même pas
 * appeler pour tester, et devait attendre l'achat d'une ligne à lui.
 *
 * Le premier numéro est donc gratuit. Les suivants (« Boutique Ixelles ») sont
 * l'option multi-sites, et le serveur le dit lui-même quand on en ajoute un.
 */

interface Line {
  id: string;
  number: string;
  label: string | null;
  /* L'agent PROPRE à cette ligne. Tout est nullable: une ligne qui ne règle
     rien garde exactement la réceptionniste du client, et c'est ce qui rend le
     réglage sans risque pour les clients existants. */
  agentName?: string | null;
  greeting?: string | null;
  instructions?: string | null;
  transferNumber?: string | null;
}

export default function OwnNumber({ isFr = true }: { isFr?: boolean }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /** La ligne dont on règle l'agent, ou null. Une seule à la fois. */
  const [editing, setEditing] = useState<string | null>(null);

  /* Enregistré au `blur` et non à chaque frappe: c'est un réglage qu'on ajuste,
     pas un formulaire qu'on soumet, et une requête par caractère saturerait
     l'API pour rien. Le PUT est PARTIEL, donc on n'envoie que le champ touché:
     poster l'objet entier écraserait ce qu'un autre champ vient d'enregistrer. */
  const saveLine = async (id: string, patch: Record<string, string>) => {
    try {
      const { data } = await api.put(`/my-dashboard/phone-numbers/${id}`, patch);
      if (data?.number) setLines(ls => ls.map(l => (l.id === id ? data.number : l)));
    } catch {
      setError("Ce réglage n'a pas pu être enregistré.");
    }
  };

  useEffect(() => {
    api.get('/my-dashboard/phone-numbers')
      .then(({ data }) => setLines(Array.isArray(data?.numbers) ? data.numbers : []))
      .catch(() => setError("Impossible de lire vos numéros."))
      .finally(() => setLoading(false));
  }, []);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/my-dashboard/phone-numbers', {
        number: value.trim(),
        label: label.trim() || (lines.length === 0 ? 'Mon numéro' : null),
      });
      setLines(l => [...l, data.number]);
      setValue('');
      setLabel('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      const code = e?.response?.data?.error;
      /* Le message du serveur passe tel quel quand il en donne un: c'est lui
         qui sait si c'est le forfait, et il le formule mieux qu'un code. */
      setError(
        code === 'invalid_number'
          ? 'Numéro trop court. Indiquez-le au format international, par exemple +32 2 555 00 11.'
          : code === 'number_already_routed'
            ? 'Ce numéro est déjà rattaché à un autre compte. Contactez-nous si c\'est une erreur.'
            : e?.response?.data?.message || "L'enregistrement a échoué. Réessayez dans un instant.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/my-dashboard/phone-numbers/${id}`);
      setLines(l => l.filter(x => x.id !== id));
    } catch {
      setError('Suppression impossible. Réessayez dans un instant.');
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-[12px] text-[#8B8BA7]">
        <Loader2 size={13} /> Chargement…
      </p>
    );
  }

  return (
    <div>
      <p className="text-[12px] text-[#9A9AA5] mb-4 leading-relaxed">
        {isFr
          ? "Le numéro que vos clients composent aujourd'hui. Déclarez-le ici, puis renvoyez-le vers votre ligne Qwillio : c'est ce qui permet de reconnaître vos appels sans que vous ayez à changer de numéro."
          : 'The number your customers already dial. Declare it here, then forward it to your Qwillio line.'}
      </p>

      {lines.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] divide-y divide-white/[0.06] mb-4">
          {lines.map(l => (
            <div key={l.id}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Phone size={13} className="flex-shrink-0 text-[#7349fe]" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#F2F2F2] truncate">{l.number}</span>
                  <span className="block text-[11px] text-[#8B8BA7] truncate">
                    {l.label || 'Sans nom'}
                    {l.agentName ? ` · ${l.agentName}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(editing === l.id ? null : l.id)}
                  aria-label={`Régler l'agent de ${l.number}`}
                  aria-expanded={editing === l.id}
                  className="flex-shrink-0 h-8 px-2.5 rounded-full grid place-items-center text-[11.5px] transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#8B8BA7' }}
                >
                  <span className="flex items-center gap-1">
                    Son agent
                    <ChevronDown size={12} className={editing === l.id ? 'rotate-180' : ''} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(l.id)}
                  aria-label={`Retirer ${l.number}`}
                  className="flex-shrink-0 w-8 h-8 rounded-full grid place-items-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#8B8BA7' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {editing === l.id && (
                /* Un agent différent PAR LIGNE. Un garage a une ligne atelier et
                   une ligne vente: même entreprise, mais pas le même accueil ni
                   le même téléphone au bout du transfert.
                   Laisser un champ vide rend la ligne à l'agent du client: c'est
                   ce qui permet de revenir en arrière, et pas seulement de
                   changer de valeur. */
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-[11px] text-[#8B8BA7] leading-snug">
                    Laissez vide pour garder la réceptionniste de votre entreprise sur cette ligne.
                  </p>
                  {([
                    { key: 'label' as const,          ph: 'Nom de la ligne (Atelier)' },
                    { key: 'agentName' as const,      ph: "Prénom de l'agent (Léo)" },
                    { key: 'greeting' as const,       ph: 'Phrase d\'accueil (Atelier, bonjour)' },
                    { key: 'transferNumber' as const, ph: 'Transférer vers (+32 2 555 99 99)' },
                    { key: 'instructions' as const,   ph: 'Consignes propres à cette ligne' },
                  ]).map(f => (
                    <input
                      key={f.key}
                      defaultValue={l[f.key] ?? ''}
                      placeholder={f.ph}
                      onBlur={e => saveLine(l.id, { [f.key]: e.target.value })}
                      className="w-full px-3 py-2 text-[13px] rounded-lg border border-white/[0.08] bg-[#0A0A0C] text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7349fe]/50 transition-colors"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="+32 2 555 00 11"
          inputMode="tel"
          className="w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0A0A0C] text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7349fe]/50 transition-colors"
        />
        {lines.length > 0 && (
          // Le libellé n'apparaît qu'à partir de la deuxième ligne: sur la
          // première il n'y a rien à distinguer, et un champ vide de plus est
          // une question de plus.
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Boutique Ixelles"
            className="w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.08] bg-[#0A0A0C] text-[#F8F8FF] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7349fe]/50 transition-colors"
          />
        )}
        <button
          type="button"
          onClick={add}
          disabled={busy || value.replace(/\D/g, '').length < 8}
          className="h-10 px-4 text-[13px] font-semibold rounded-xl bg-[#7349fe] text-white disabled:opacity-40 transition-colors"
        >
          {busy ? 'Enregistrement…' : saved ? 'Enregistré' : lines.length === 0 ? 'Enregistrer mon numéro' : 'Ajouter cette ligne'}
        </button>
      </div>

      {saved && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-emerald-400">
          <Check size={13} /> Enregistré. Renvoyez maintenant ce numéro vers votre ligne Qwillio.
        </p>
      )}
      {error && <p role="status" className="mt-2 text-[12px] text-[#f0a0a0] leading-snug">{error}</p>}
    </div>
  );
}
