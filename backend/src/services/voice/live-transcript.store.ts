import { logger } from '../../config/logger';

/**
 * Le transcript d'un appel PENDANT qu'il a lieu, en mémoire.
 *
 * La fiche « en cours » existe depuis `POST /api/voice-core/calls/start` : le
 * tableau de bord sait qu'un appel est en ligne. Il ne sait pas ce qui s'y
 * dit, et c'est pourtant le seul moment où le gérant voudrait lire — un
 * appelant qui s'énerve, un rendez-vous qui part de travers, une question à
 * laquelle sa réceptionniste ne sait pas répondre. À la fin de l'appel
 * l'information est encore vraie, elle n'est simplement plus actionnable.
 *
 * EN MÉMOIRE, ET C'EST LA MÊME DÉCISION QUE `call-session.store.ts` :
 *
 *     « The old pipeline wrote to Postgres on every partial transcript event.
 *       At two to five transcript events per second per call, that is a
 *       database round-trip inside the webhook's response path, on a Neon
 *       instance that may be cold. »
 *
 * Ici c'est une ligne par TOUR DE PAROLE et non par événement partiel, donc
 * moins violent — mais la conclusion ne change pas : écrire en base ce qui
 * sera réécrit en entier trente secondes plus tard, c'est payer deux fois
 * pour la même phrase. `POST /api/voice-core/calls` envoie le transcript
 * complet à la fin, et c'est LUI qui fait foi.
 *
 * CE QU'ON PERD À UN REDÉMARRAGE : le direct d'un appel en cours, le temps
 * qu'il se termine. La fiche, elle, est en base, et le transcript final
 * arrive quand même. C'est exactement le prix que le store Vapi accepte déjà.
 *
 * UN SEUL PROCESSUS. Ce service tourne sur une instance Render ; le store
 * Vapi fait déjà cette hypothèse depuis le début. Le jour où le backend passe
 * à plusieurs instances, ces deux stores se trompent ensemble, et la réponse
 * sera la même pour les deux — Redis, ou un canal de diffusion.
 */

export interface LigneDirecte {
  role: 'user' | 'assistant';
  text: string;
  at: number;
}

interface AppelDirect {
  clientId: string;
  lignes: LigneDirecte[];
  dernierSigne: number;
}

/** Au-delà, une ligne n'intéresse plus personne et la fiche a été remplacée
 *  par le transcript complet. Sert de filet quand la fin d'appel se perd. */
const DUREE_DE_VIE_MS = 30 * 60 * 1000;

/** Un appel de trente minutes à un tour toutes les cinq secondes en fait 360.
 *  Au-delà on garde la fin : c'est ce qui est en train de se dire. */
const MAX_LIGNES = 400;

class LiveTranscriptStore {
  private readonly appels = new Map<string, AppelDirect>();

  /**
   * L'appel décroche : on ouvre une place pour lui.
   *
   * C'EST ICI QUE LE `clientId` ENTRE, ET NULLE PART AILLEURS. Les lignes qui
   * suivront ne le portent pas — `voice-core` envoie `{room, role, text}` et
   * rien d'autre — et le faire remonter à chaque ligne obligerait à relire la
   * fiche en base à chaque tour de parole, c'est-à-dire exactement l'aller-
   * retour que ce store existe pour supprimer.
   *
   * Conséquence assumée : une ligne pour une salle inconnue est jetée. Si ce
   * processus redémarre pendant un appel, le direct de CET appel est perdu
   * jusqu'au raccroché — la fiche reste en base et le transcript complet
   * arrive quand même.
   */
  ouvrir(room: string, clientId: string): void {
    const salle = (room || '').trim();
    if (!salle || !clientId) return;
    this.purger();
    if (this.appels.has(salle)) return;   // un rejeu n'efface pas ce qui est dit
    this.appels.set(salle, { clientId, lignes: [], dernierSigne: Date.now() });
  }

  /**
   * Une ligne de plus. Rend `false` si elle n'a pas été retenue, pour que
   * l'appelant puisse le journaliser sans avoir à deviner pourquoi.
   */
  ajouter(room: string, role: 'user' | 'assistant', text: string): boolean {
    const salle = (room || '').trim();
    const propre = (text || '').trim();
    if (!salle || !propre) return false;

    const appel = this.appels.get(salle);
    if (!appel) return false;
    appel.lignes.push({ role, text: propre, at: Date.now() });
    if (appel.lignes.length > MAX_LIGNES) {
      appel.lignes.splice(0, appel.lignes.length - MAX_LIGNES);
    }
    appel.dernierSigne = Date.now();
    this.appels.set(salle, appel);
    return true;
  }

  /** Les lignes d'un appel, vides si on n'en a aucune. */
  lignes(room: string, clientId: string): LigneDirecte[] {
    const appel = this.appels.get((room || '').trim());
    /* LE CLOISONNEMENT EST ICI, et il n'est pas décoratif : la salle est un
       identifiant devinable (`call-_+32460206690_XXXX`), et ce store sert une
       route authentifiée par client. Sans cette ligne, un client pourrait
       lire l'appel d'un autre en demandant la bonne salle. */
    if (!appel || appel.clientId !== clientId) return [];
    return appel.lignes;
  }

  /** L'appel est fini : le transcript complet est parti en base. */
  terminer(room: string): void {
    this.appels.delete((room || '').trim());
  }

  /** Pour les tests. */
  vider(): void {
    this.appels.clear();
  }

  private purger(): void {
    const limite = Date.now() - DUREE_DE_VIE_MS;
    for (const [salle, appel] of this.appels) {
      if (appel.dernierSigne < limite) {
        this.appels.delete(salle);
        logger.info(`[voice-core] direct oublié pour ${salle} (inactif)`);
      }
    }
  }
}

export const liveTranscripts = new LiveTranscriptStore();
