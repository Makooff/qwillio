import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ecrituresDuNumero } from '../routes/voice-core.routes';
import { voiceCoreAuth } from '../middleware/voice-core.middleware';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Le pont vers `qwillio-voice-core`.
 *
 * Deux choses seulement sont testables sans base, et ce sont les deux qui
 * cassent en silence : la résolution du numéro appelé, et le portier.
 */

describe('retrouver le client depuis le numéro appelé', () => {
  /**
   * Le même téléphone s'écrit de trois façons selon l'écran où il a été tapé.
   * Une égalité exacte ne trouve rien ET NE LÈVE PAS : l'agent décroche sur le
   * profil générique, au nom de « Qwillio », chez un client qui paie pour son
   * propre nom. C'est le pire mode d'échec, parce qu'il ressemble à un succès.
   */
  it('reconnaît les trois écritures du même numéro belge', () => {
    const formes = ecrituresDuNumero('+32460258033');
    expect(formes).toContain('+32460258033');
    expect(formes).toContain('32460258033');
    expect(formes).toContain('0460258033');
  });

  it('part aussi bien de la forme nationale', () => {
    const formes = ecrituresDuNumero('0460258033');
    expect(formes).toContain('+32460258033');
    expect(formes).toContain('32460258033');
  });

  it('survit aux espaces que le client tape', () => {
    expect(ecrituresDuNumero('0460 25 80 33')).toContain('+32460258033');
  });

  it('ne rend rien pour ce qui n\'est pas un numéro', () => {
    expect(ecrituresDuNumero('')).toEqual([]);
    expect(ecrituresDuNumero('bonjour')).toEqual([]);
  });
});

function fausseReponse() {
  const r: any = { code: 0, corps: null };
  r.status = (c: number) => { r.code = c; return r; };
  r.json = (b: unknown) => { r.corps = b; return r; };
  return r;
}

function fausseRequete(cle?: string) {
  return { header: (n: string) => (n.toLowerCase() === 'x-api-key' ? cle : undefined) } as any;
}

describe('le portier du pont', () => {
  const avant = process.env.VOICE_CORE_API_KEY;
  beforeEach(() => { process.env.VOICE_CORE_API_KEY = 'secret-de-test'; });
  afterEach(() => {
    if (avant === undefined) delete process.env.VOICE_CORE_API_KEY;
    else process.env.VOICE_CORE_API_KEY = avant;
  });

  it('laisse passer la bonne clé', () => {
    const suite = vi.fn();
    voiceCoreAuth(fausseRequete('secret-de-test'), fausseReponse(), suite);
    expect(suite).toHaveBeenCalled();
  });

  it('refuse une mauvaise clé', () => {
    const suite = vi.fn();
    const res = fausseReponse();
    voiceCoreAuth(fausseRequete('pas-la-bonne'), res, suite);
    expect(suite).not.toHaveBeenCalled();
    expect(res.code).toBe(401);
  });

  it('refuse une clé absente', () => {
    const suite = vi.fn();
    const res = fausseReponse();
    voiceCoreAuth(fausseRequete(undefined), res, suite);
    expect(suite).not.toHaveBeenCalled();
    expect(res.code).toBe(401);
  });

  /**
   * LE TEST QUI COMPTE. Ouvrir quand la variable manque ne se voit jamais en
   * développement — elle y est toujours — et expose le profil de tous les
   * clients le jour d'un déploiement où elle manque.
   */
  it('reste FERMÉ quand le secret n\'est pas configuré', () => {
    delete process.env.VOICE_CORE_API_KEY;
    const suite = vi.fn();
    const res = fausseReponse();
    voiceCoreAuth(fausseRequete('n\'importe quoi'), res, suite);
    expect(suite).not.toHaveBeenCalled();
    expect(res.code).toBe(503);
  });

  it('ne distingue pas une clé vide d\'une clé fausse dans sa réponse', () => {
    const a = fausseReponse();
    const b = fausseReponse();
    voiceCoreAuth(fausseRequete(''), a, vi.fn());
    voiceCoreAuth(fausseRequete('xxxx'), b, vi.fn());
    expect(a.corps).toEqual(b.corps);
  });
});


/**
 * LE BRANCHEMENT SUR CE QUI EXISTE.
 *
 * Ces trois-là lisent le SOURCE, pas le comportement. C'est délibéré : ce qui
 * casse ici ne lève pas et ne rate aucun test classique — une écriture
 * directe dans `ClientCall` réussit parfaitement, elle remplit juste le
 * tableau de bord de lignes sans résumé, sans lead et sans date limite, et
 * personne ne s'en aperçoit avant de regarder un appel un mois plus tard.
 * Un test de comportement demanderait une base et un OpenAI ; celui-ci coûte
 * une lecture de fichier et attrape exactement la régression qu'on craint.
 */
describe('la remontée d\'appel passe par le chemin existant', () => {
  const source = readFileSync(join(__dirname, '../routes/voice-core.routes.ts'), 'utf8');

  /* Le fichier SANS ses commentaires de bloc.
     Ce fichier-ci est abondamment commente, et ses commentaires nomment les
     appels qu'ils expliquent. Chercher un nom dans `source` peut donc tomber
     sur la prose qui le decrit au lieu du code qui l'execute : c'est arrive
     le 28/09, ou l'ordre `deleteMany` avant `handleClientCallCompleted` a ete
     declare faux parce que le premier `handleClientCallCompleted` trouve
     etait celui du commentaire d'en-tete, trente lignes plus haut. Tout ce
     qui compte des POSITIONS ou des OCCURRENCES lit `code`. */
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '');

  it('appelle le service qui traite déjà les appels Vapi', () => {
    expect(source).toContain('clientCallService.handleClientCallCompleted');
  });

  it('ne CRÉE jamais la fiche finale lui-même', () => {
    /* C'est le service qui crée la fiche d'un appel terminé, et lui seul.
       Un `create` ici rendrait des lignes sans résumé, sans sentiment, sans
       lead et sans date limite — et il faudrait un mois pour s'en apercevoir. */
    expect(code).not.toMatch(/clientCall\.create\(/);
  });

  /* ── Le placeholder « en direct », et ses deux conditions ──────────────────
     Le 28/09 une seconde écriture dans `ClientCall` est apparue, pour que le
     gérant voie l'appel PENDANT qu'il a lieu. Elle est légitime, mais elle ne
     l'est qu'à deux conditions, et les voici figées. */

  it('n\'écrit en direct qu\'une fiche « en cours »', () => {
    /* Un placeholder qui n'est pas marqué `in-progress` deviendrait un appel
       terminé sans transcript ni analyse, indiscernable d'une vraie fiche. */
    const upserts = code.match(/clientCall\.upsert\(/g) ?? [];
    expect(upserts).toHaveLength(1);
    expect(code).toMatch(/status: 'in-progress'/);
  });

  it('efface le placeholder AVANT de laisser le service écrire', () => {
    /* `handleClientCallCompleted` fait un `create`. Laisser le placeholder en
       place le ferait échouer sur la contrainte d'unicité de `vapiCallId` —
       sur CHAQUE appel, et seulement en production, puisqu'il faut un appel
       réel pour qu'un placeholder existe. */
    const efface = code.indexOf('clientCall.deleteMany');
    const service = code.indexOf('clientCallService.handleClientCallCompleted(');
    expect(efface).toBeGreaterThan(-1);
    expect(efface).toBeLessThan(service);
  });

  it('ne prend pas un appel en cours pour un doublon', () => {
    /* La garde d'idempotence voyait une fiche et concluait « déjà traité ».
       Avec le placeholder, elle aurait sauté transcript, résumé et lead sur
       tous les appels. */
    expect(code).toMatch(/status !== 'in-progress'/);
  });

  /* ── Les trois details de reservation ─────────────────────────────────────
     `client_bookings` porte `customer_email`, `party_size` et
     `special_requests` depuis le premier jour, et la chaine vocale n'en
     remplissait aucun : un restaurant recevait « table pour Dupont, 20 h »
     sans savoir combien de couverts mettre, et rappelait — ce que l'agent
     etait cense lui eviter. Ces colonnes sont maintenant remplies ; ce qui
     suit gele le fait qu'elles le restent. */

  it('ecrit les trois details que la base portait a vide', () => {
    for (const colonne of ['customerEmail:', 'partySize:', 'specialRequests:']) {
      expect(code).toContain(colonne);
    }
  });

  it('les RENVOIE aussi, pas seulement les accepte', () => {
    /* L'agent relit la reservation qu'il vient d'ecrire pour la confirmer a
       voix haute et la retrouver au rappel. Les taire au retour ferait dire
       « c'est note » sur un nombre de couverts qu'il ne saurait plus. */
    for (const champ of ['customerEmail: true', 'partySize: true', 'specialRequests: true']) {
      expect(code).toContain(champ);
    }
  });

  it('borne ce qui vient d\'un modele de langue avant la base', () => {
    /* Derniere frontiere avant Postgres, et la seule que rien ne contourne.
       `party_size` est une colonne entiere : un flottant ou un « 200 » dicte
       par erreur casserait l'ecriture au lieu du rendez-vous. */
    expect(code).toMatch(/Number\.isInteger\(Number\(partySize\)\)/);
    expect(code).toMatch(/Math\.min\(Number\(partySize\), 500\)/);
    expect(code).toMatch(/slice\(0, 255\)/);   // email
    expect(code).toMatch(/slice\(0, 500\)/);   // demandes particulieres
  });

  it('jette une adresse qui n\'en est pas une plutot que de l\'ecrire', () => {
    /* Une adresse fausse est pire qu'une adresse absente : le gerant ecrit,
       et son message part dans le vide sans jamais revenir en erreur. */
    expect(code).toMatch(/\[\^@\\s\]\+@\[\^@\\s\]\+/);
  });

  it('transporte les horaires du client jusqu\'à l\'agent', () => {
    /* Sans eux, `voice-core` décide avec une table écrite en dur et propose
       mercredi 9 h chez un commerce fermé le mercredi. */
    expect(source).toContain('openingHours: profil.weekHours');
    expect(source).toContain('timezone: profil.timezone');
  });

  it('transmet le transcript, sans lequel toute l\'analyse est vide', () => {
    expect(source).toMatch(/transcript/);
    expect(source).toContain("typeof transcript === 'string' ? transcript : ''");
  });

  it('ne facture jamais l\'option Superagent par effet de bord', () => {
    /* `voiceMode` décrit le moteur Vapi. Y écrire 'realtime' parce que
       VC_BRAIN=realtime facturerait une option non achetée. */
    expect(source).not.toMatch(/voiceMode:\s*'realtime'/);
  });
});
