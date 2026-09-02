import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { Phone, RefreshCw } from '../../components/icons';
import { pro } from '../../styles/pro-theme';
import { PageHeader, Card, SectionHead, Pill, IconBtn } from '../../components/pro/ProBlocks';

/**
 * Les lignes entrantes qui DEMANDENT une action.
 *
 * Écran d'exploitation, pas de client: il affiche `phoneSetupReason`, qui nomme
 * des variables d'environnement, dit qu'un autre client tient la ligne
 * partagée, ou qu'aucun numéro n'est configuré sur la plateforme. Le portail
 * client, lui, ne reçoit qu'une phrase dérivée de l'état.
 *
 * Il ne liste QUE ce qui cloche. Un client actif sur sa ligne dédiée n'a rien à
 * faire ici, et une page qui les afficherait tous cacherait les trois qui
 * comptent, ce qui est exactement la façon dont un client injoignable passe
 * inaperçu jusqu'à ce qu'un appelant se plaigne.
 */

type State = 'none' | 'shared' | 'provisioning' | 'pending_regulatory' | 'failed';

interface Ligne {
  id: string;
  businessName: string;
  planType: string | null;
  subscriptionStatus: string;
  vapiPhoneNumber: string | null;
  phoneSetupState: State;
  phoneSetupReason: string | null;
  phoneSetupAt: string | null;
}

/** L'état, dit en un mot, avec sa gravité. */
const ETATS: Record<State, { label: string; color: 'bad' | 'warn' | 'info' | 'neutral' }> = {
  failed:       { label: 'Sans ligne',      color: 'bad' },
  none:         { label: 'Rien de posé',    color: 'warn' },
  provisioning: { label: 'Achat en cours',  color: 'info' },
  shared:       { label: 'Ligne partagée',  color: 'neutral' },
  /* Neutre et non « info »: le dossier suit son cours chez Twilio, il n'y a
     rien à faire tant qu'il n'a pas répondu. Le peindre comme une alerte ferait
     paraître urgent ce qui ne l'est pas, et noierait les échecs, qui le sont. */
  pending_regulatory: { label: 'Dossier en cours', color: 'neutral' },
};

export default function Lignes() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    api.get('/admin/lignes')
      .then(({ data }) => setLignes(Array.isArray(data?.clients) ? data.clients : []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  /* Un abonné PAYANT resté sur la ligne partagée a droit à sa ligne et ne l'a
     pas: c'est une promesse commerciale non tenue, pas un réglage. Il se
     distingue donc d'un essai, pour qui la ligne partagée est normale. */
  const duSang = lignes.filter(
    l => l.phoneSetupState === 'failed' || (l.phoneSetupState === 'shared' && l.subscriptionStatus === 'active'),
  );

  return (
    <>
      <PageHeader
        title="Lignes entrantes"
        subtitle="Uniquement ce qui demande une action"
        badge="admin"
        right={<IconBtn title="Rafraîchir" onClick={load}><RefreshCw size={14} /></IconBtn>}
      />

      {loading && <p className="text-[13px]" style={{ color: pro.textSec }}>Chargement…</p>}

      {failed && (
        <p className="text-[13px]" style={{ color: pro.bad }}>
          La liste n'a pas pu être chargée.
        </p>
      )}

      {!loading && !failed && lignes.length === 0 && (
        /* L'état NORMAL quand tout va bien, et il doit se lire comme tel: une
           page vide sans un mot laisse croire à un écran cassé. */
        <Card>
          <p className="text-[13px]" style={{ color: pro.textSec }}>
            Chaque client vivant a sa ligne. Rien à faire.
          </p>
        </Card>
      )}

      {!loading && lignes.length > 0 && (
        <>
          {duSang.length > 0 && (
            <p className="mb-4 text-[13px]" style={{ color: pro.bad }}>
              {duSang.length === 1
                ? '1 client ne reçoit pas ses appels, ou paie une ligne dédiée qu\'il n\'a pas.'
                : `${duSang.length} clients ne reçoivent pas leurs appels, ou paient une ligne dédiée qu'ils n'ont pas.`}
            </p>
          )}

          <SectionHead title={`${lignes.length} ligne${lignes.length > 1 ? 's' : ''} à regarder`} />
          <Card>
            <div className="divide-y" style={{ borderColor: pro.border }}>
              {lignes.map(l => {
                const etat = ETATS[l.phoneSetupState] ?? ETATS.none;
                const paye = l.subscriptionStatus === 'active';
                return (
                  <div key={l.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium truncate" style={{ color: pro.text }}>
                          {l.businessName}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px]" style={{ color: pro.textSec }}>
                          <Phone size={11} />
                          {l.vapiPhoneNumber || 'aucun numéro'}
                          <span style={{ color: pro.textTer }}>
                            · {l.planType || 'sans forfait'} · {paye ? 'abonné' : 'essai'}
                          </span>
                        </p>
                      </div>
                      <Pill color={etat.color}>{etat.label}</Pill>
                    </div>

                    {l.phoneSetupReason && (
                      /* La raison TECHNIQUE, telle quelle. C'est elle qui évite
                         d'ouvrir les journaux pour savoir ce qui bloque. */
                      <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: pro.textTer }}>
                        {l.phoneSetupReason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
