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

  it('appelle le service qui traite déjà les appels Vapi', () => {
    expect(source).toContain('clientCallService.handleClientCallCompleted');
  });

  it('n\'écrit pas dans ClientCall par un second chemin', () => {
    /* `update` est permis : il complète la fiche que le service vient de
       créer. `create` et `upsert` seraient un second écrivain. */
    expect(source).not.toMatch(/clientCall\.(create|upsert)\(/);
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
