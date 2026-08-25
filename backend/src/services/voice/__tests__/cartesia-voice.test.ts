import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * La bascule vers Cartesia, et surtout ce qui l'EMPÊCHE.
 *
 * Une voix ratée sur un appel entrant coûte un client, et un champ inconnu fait
 * rejeter l'assistant entier par Vapi (ça s'est produit deux fois: sur
 * `backchannelPlan`, puis sur les codes de langue du plan de secours). Ces
 * tests portent donc moins sur ce que le bloc contient que sur les trois cas
 * où il ne doit PAS exister.
 */

const { envMock } = vi.hoisted(() => ({
  envMock: {
    VOICE_TTS_PROVIDER: '11labs',
    CARTESIA_MODEL: 'sonic-3.5',
    CARTESIA_VOICES: 'el_marie:ca_marie,el_lucas:ca_lucas',
    CARTESIA_DEFAULT_VOICE_ID: '',
    CARTESIA_API_KEY: '',
    VOICE_TTS_MODEL: 'eleven_turbo_v2_5',
    VOICE_TTS_MIN_CHUNK_CHARS: 60,
    VOICE_TTS_STYLE_CAP: 0.4,
    VOICE_SPEECH_SPEED: 1.0,
    VAPI_OPTIMIZE_LATENCY: 3,
    VAPI_VOICE_FALLBACK_1: 'el_fallback_1',
    VAPI_VOICE_FALLBACK_2: 'el_fallback_2',
  } as Record<string, unknown>,
}));
vi.mock('../../../config/env', () => ({ env: envMock }));
vi.mock('../../../config/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn() } }));

const { buildVoice, useCartesia } = await import('../speech-plans');

beforeEach(() => {
  envMock.VOICE_TTS_PROVIDER = 'cartesia';
  envMock.CARTESIA_DEFAULT_VOICE_ID = '';
  envMock.CARTESIA_VOICES = 'el_marie:ca_marie,el_lucas:ca_lucas';
});

describe('useCartesia — les trois garde-fous', () => {
  it('ne fait rien tant que le fournisseur n\'est pas demandé', () => {
    // Le défaut est `11labs`: poser le code ne doit rien changer avant qu'on
    // pose la variable. C'est ce qui rend cette branche essayable.
    envMock.VOICE_TTS_PROVIDER = '11labs';
    expect(useCartesia({ voiceId: 'el_marie' })).toBeNull();
  });

  it('laisse une voix CLONÉE chez ElevenLabs', () => {
    /* Un clone n'existe que chez ElevenLabs. Le servir par Cartesia ne
       donnerait pas une voix approchante: ça donnerait la voix de quelqu'un
       d'autre, au client qui a justement enregistré la sienne. */
    expect(useCartesia({ voiceId: 'el_marie', cloned: true })).toBeNull();
  });

  it('garde ElevenLabs pour un timbre sans correspondance', () => {
    /* Sans table, pas de bascule: on ne devine pas un timbre. C'est ce qui
       permet de basculer voix par voix, à l'oreille, plutôt que de découvrir
       sur un appel réel qu'un personnage sonne faux. */
    expect(useCartesia({ voiceId: 'el_inconnu' })).toBeNull();
  });

  it('accepte un timbre par défaut quand il est explicitement posé', () => {
    envMock.CARTESIA_DEFAULT_VOICE_ID = 'ca_defaut';
    expect(useCartesia({ voiceId: 'el_inconnu' })).toBe('ca_defaut');
  });

  it('traduit un timbre connu', () => {
    expect(useCartesia({ voiceId: 'el_lucas' })).toBe('ca_lucas');
  });

  /**
   * « J'ai mis l'identifiant d'une voix que j'aime. »
   *
   * C'est le geste naturel, et la première version le laissait sans effet: une
   * entrée sans deux-points ne produisait rien, ni erreur ni journal, et la
   * réceptionniste restait chez ElevenLabs sans que rien ne l'explique. Une
   * configuration qui ne marche pas doit se voir; celle-ci se comprend
   * maintenant toute seule.
   */
  it('accepte une voix SEULE, sans deux-points: celle-là, pour tout le monde', () => {
    envMock.CARTESIA_VOICES = 'ca_preferee';
    expect(useCartesia({ voiceId: 'el_marie' })).toBe('ca_preferee');
    expect(useCartesia({ voiceId: 'el_inconnu' })).toBe('ca_preferee');
  });

  it('laisse une correspondance explicite l\'emporter sur la voix unique', () => {
    // Les deux écritures cohabitent: « tout le monde en X, sauf Marie en Y ».
    envMock.CARTESIA_VOICES = 'ca_preferee,el_marie:ca_marie';
    expect(useCartesia({ voiceId: 'el_marie' })).toBe('ca_marie');
    expect(useCartesia({ voiceId: 'el_lucas' })).toBe('ca_preferee');
  });

  it('ne bascule toujours PAS un clone, même avec une voix unique', () => {
    // La règle qui protège la voix enregistrée du client ne connaît pas
    // d'exception, et surtout pas celle qui ratisse le plus large.
    envMock.CARTESIA_VOICES = 'ca_preferee';
    expect(useCartesia({ voiceId: 'el_marie', cloned: true })).toBeNull();
  });
});

/**
 * Une voix CHOISIE dans le sélecteur, par opposition à une voix traduite.
 *
 * Depuis que le sélecteur propose le catalogue Cartesia, l'identifiant
 * enregistré vient déjà du bon catalogue. Le chercher dans la table de
 * correspondance ne le trouverait pas, et le client entendrait la voix par
 * défaut au lieu de celle qu'il vient d'écouter et de choisir: le pire des
 * échecs, silencieux et exactement à l'endroit de la décision.
 */
describe('useCartesia — une voix venue du catalogue Cartesia', () => {
  it('sert l\'identifiant tel quel, sans passer par la table', () => {
    expect(useCartesia({ voiceId: 'ca_choisie', voiceProvider: 'cartesia' })).toBe('ca_choisie');
  });

  it('la sert même si le réglage global est revenu à ElevenLabs', () => {
    /* Le réglage global peut changer après le choix. Une voix choisie reste ce
       qu'elle est: l'envoyer à ElevenLabs, où son identifiant ne désigne rien,
       ferait échouer la synthèse plutôt que de « revenir en arrière ». */
    envMock.VOICE_TTS_PROVIDER = '11labs';
    expect(useCartesia({ voiceId: 'ca_choisie', voiceProvider: 'cartesia' })).toBe('ca_choisie');
  });

  it('change de voix de SECOURS, parce que l\'originale n\'existe pas ailleurs', () => {
    /* Quand la voix est traduite, l'identifiant ElevenLabs d'origine fait un
       secours parfait. Quand elle a été choisie chez Cartesia, ce même
       identifiant ne désigne rien chez ElevenLabs: le poser fabriquerait une
       voix de secours qui échoue elle aussi, ce qui est pire que pas de
       secours du tout puisque ça se découvre en pleine panne. */
    const v = buildVoice({ voiceId: 'ca_choisie', voiceProvider: 'cartesia', lang: 'fr' }) as any;
    expect(v.voiceId).toBe('ca_choisie');
    expect(v.fallbackPlan.voices.map((f: any) => f.voiceId)).toEqual(['el_fallback_1', 'el_fallback_2']);
  });
});

describe('buildVoice — le bloc Cartesia', () => {
  const voice = () => buildVoice({ voiceId: 'el_marie', lang: 'fr', style: 0.6, stability: 0.3 }) as any;

  it('décrit la voix dans le vocabulaire de Cartesia', () => {
    const v = voice();
    expect(v.provider).toBe('cartesia');
    expect(v.voiceId).toBe('ca_marie');
    expect(v.model).toBe('sonic-3.5');
    expect(v.language).toBe('fr');
  });

  it("N'ENVOIE AUCUN champ ElevenLabs", () => {
    /* `stability`, `style`, `similarityBoost`, `speed` et `useSpeakerBoost`
       n'existent pas sur `CartesiaVoice`, et Vapi rejette l'assistant ENTIER
       sur un champ inconnu, pas seulement la voix. Ce n'est donc pas une perte
       de réglage, c'est la condition pour que l'appel démarre. */
    const v = voice();
    for (const banned of ['stability', 'style', 'similarityBoost', 'speed', 'useSpeakerBoost']) {
      expect(v[banned]).toBeUndefined();
    }
  });

  it('garde la découpe en phrases, qui elle est acceptée des deux côtés', () => {
    // C'est le réglage qui a corrigé le « ça parle haché »: il ne doit pas se
    // perdre en changeant de fournisseur.
    expect(voice().chunkPlan.punctuationBoundaries).toEqual(['.', '!', '?']);
  });

  it('retombe sur la voix ElevenLabs D\'ORIGINE si Cartesia ne répond pas', () => {
    /* Le filet, et il est précis: la première voix de secours est le timbre
       ElevenLabs que ce personnage avait, pas une voix générique. Une panne
       Cartesia doit s'entendre comme « la même réceptionniste, un autre
       grain », jamais comme une ligne muette ni comme un inconnu. */
    const fallbacks = voice().fallbackPlan.voices;
    expect(fallbacks[0]).toMatchObject({ provider: '11labs', voiceId: 'el_marie' });
    expect(fallbacks[1].provider).toBe('11labs');
  });

  it('revient au bloc ElevenLabs complet dès que la bascule ne s\'applique pas', () => {
    envMock.VOICE_TTS_PROVIDER = '11labs';
    const v = voice();
    expect(v.provider).toBe('11labs');
    expect(v.voiceId).toBe('el_marie');
    // Les réglages de rendu reviennent avec, plafond de style compris.
    expect(v.style).toBe(0.4);
    expect(v.stability).toBe(0.35);
  });
});
