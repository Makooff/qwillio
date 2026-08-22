import { describe, it, expect } from 'vitest';
import { errorDetail, errorText, explainEndedReason, isBenignEndedReason, isMicDenied, isNormalTeardown, isProviderFault, phaseLabel, shouldReportConnectFailure } from './VapiLiveCall';

describe('isMicDenied', () => {
  it('recognises the DOMException the browser throws on refusal', () => {
    const denied = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    expect(isMicDenied(denied)).toBe(true);
  });

  it('recognises a refusal the SDK wrapped one level down', () => {
    expect(isMicDenied({ error: { name: 'NotReadableError' } })).toBe(true);
  });

  it('recognises a device that is missing or held by another app', () => {
    expect(isMicDenied({ message: 'NotFoundError: no audio input' })).toBe(true);
  });

  it('never blames the microphone for an HTTP failure', () => {
    // The config route returns JSON that legitimately mentions the microphone;
    // reading a 503 as a permission problem would send the user into iOS
    // settings for a server that is simply unconfigured.
    expect(isMicDenied({ response: { status: 503, data: { error: 'microphone' } } })).toBe(false);
  });

  it('rejects everything unrelated', () => {
    for (const bad of [null, undefined, 42, [], {}, 'meeting ended', { message: 'ejected' }]) {
      expect(isMicDenied(bad)).toBe(false);
    }
  });
});

describe('errorText', () => {
  it('returns a plain string message', () => {
    expect(errorText({ message: 'Meeting ended' })).toBe('Meeting ended');
  });

  it('returns null when message is an object', () => {
    // This is the crash: Vapi emits `{ message: { message, error } }`, the
    // object reached state, JSX rendered it, and React #31 took the whole
    // dashboard down over a call that had merely failed.
    expect(errorText({ message: { message: 'x', error: 'y' } })).toBeNull();
  });

  it('falls back to a nested error message', () => {
    expect(errorText({ error: { message: 'ejected' } })).toBe('ejected');
  });

  it('accepts a bare string', () => {
    expect(errorText('boom')).toBe('boom');
  });

  it('reads a real Error', () => {
    expect(errorText(new Error('mic_denied'))).toBe('mic_denied');
  });

  it('rejects everything that is not usable text', () => {
    for (const bad of [null, undefined, 42, [], {}, { message: '' }, { message: '   ' }, { message: 7 }]) {
      expect(errorText(bad)).toBeNull();
    }
  });
});

describe('isProviderFault', () => {
  it('recognises the payload Vapi sends when the wallet is empty', () => {
    // Charge relevée sur un vrai appareil: le message utile est imbriqué sous
    // `message.message`, là où `errorText` refuse d'aller.
    const real = {
      type: 'start-method-error',
      stage: 'unknown',
      error: {
        message: {
          message: 'Your Wallet Balance is 0. Please Purchase More Credits or Upgrade Your Plan Before Proceeding.',
          error: 'Bad Request',
          statusCode: 400,
        },
      },
    };
    expect(isProviderFault(real)).toBe(true);
  });

  it('recognises the other ways a provider says the same thing', () => {
    expect(isProviderFault({ message: 'Insufficient credits' })).toBe(true);
    expect(isProviderFault('Quota exceeded')).toBe(true);
  });

  it('never blames the account for a device or network failure', () => {
    // Sinon un micro refusé afficherait « rechargez le solde », et personne ne
    // penserait plus à regarder ses autorisations.
    for (const bad of [null, undefined, {}, 'meeting ended', { name: 'NotAllowedError' }, { message: 'ejected' }]) {
      expect(isProviderFault(bad)).toBe(false);
    }
  });

  it('survives a circular payload', () => {
    const loop: any = { a: 1 };
    loop.self = loop;
    expect(isProviderFault(loop)).toBe(false);
  });
});

describe('shouldReportConnectFailure', () => {
  it("dit l'echec quand l'appel n'a jamais decroche", () => {
    // Le bug signale depuis un iPhone: `call-end` arrive sans `call-start`, et
    // se taire laissait un bouton qui tourne puis s'efface, sans un mot a lire.
    expect(shouldReportConnectFailure(false, false)).toBe(true);
  });

  it("se tait quand l'appel a bien eu lieu", () => {
    expect(shouldReportConnectFailure(true, false)).toBe(false);
  });

  it("n'ecrase pas une raison deja affichee", () => {
    // « Micro refuse » dit quoi faire; la phrase generique ne dit rien.
    expect(shouldReportConnectFailure(false, true)).toBe(false);
  });
});

describe('isNormalTeardown', () => {
  // La charge exacte relevee sur iPhone, apres un appel qui s'etait bien
  // deroule: Daily annonce la fermeture de la salle par un evenement d'ERREUR.
  const ejected = {
    type: 'daily-error',
    error: { message: { type: 'ejected', msg: 'Meeting has ended' }, action: 'error', errorMsg: 'Meeting has ended' },
  };

  it('reconnait le raccroche apres un appel qui a decroche', () => {
    expect(isNormalTeardown(ejected, true)).toBe(true);
  });

  it("reste un echec quand l'appel n'avait jamais decroche", () => {
    // Meme texte, sens inverse: la salle s'est fermee avant que l'appel commence.
    expect(isNormalTeardown(ejected, false)).toBe(false);
  });

  it('ne blanchit pas une vraie panne survenue en cours d\'appel', () => {
    expect(isNormalTeardown({ error: { message: 'pipeline-error-eleven-labs' } }, true)).toBe(false);
  });
});

describe('explainEndedReason', () => {
  it('traduit un motif connu', () => {
    expect(explainEndedReason('pipeline-error-openai-llm-failed', true))
      .toBe("Le modèle vocal a refusé l'appel.");
  });

  it('lit le motif le PLUS PRÉCIS quand plusieurs correspondent', () => {
    // « openai » et « 401 » sont tous deux presents: c'est la cle qui a ete
    // refusee, pas le modele qui est tombe, et l'ordre de la table le decide.
    expect(explainEndedReason('pipeline-error-openai-401-unauthorized', true))
      .toMatch(/clé fournisseur/);
    // Meme piege pour la voix, qui doit passer avant le motif « openai ».
    expect(explainEndedReason('pipeline-error-openai-voice-failed', true))
      .toMatch(/voix/);
  });

  it('rend null sur un motif inconnu, pour que l\'appelant montre le brut', () => {
    // Une explication approximative enverrait chercher au mauvais endroit:
    // l'identifiant tel quel se recherche, une phrase inventee ne se recherche
    // pas.
    expect(explainEndedReason('some-reason-nobody-has-seen-yet', true)).toBeNull();
  });

  it('ne rend rien pour ce qui n\'est pas un motif', () => {
    expect(explainEndedReason('', true)).toBeNull();
    expect(explainEndedReason('   ', true)).toBeNull();
    expect(explainEndedReason(null, true)).toBeNull();
    expect(explainEndedReason(undefined, true)).toBeNull();
    expect(explainEndedReason(42, true)).toBeNull();
  });

  it('parle anglais quand on le lui demande', () => {
    expect(explainEndedReason('pipeline-error-deepgram-transcriber-failed', false))
      .toMatch(/Transcription/);
  });
});

describe('errorDetail', () => {
  it('SÉRIALISE une Error, dont les champs ne sont pas énumérables', () => {
    /* `JSON.stringify(new Error('boum'))` rend `{}`. On rendait donc null, et
       l'écran n'affichait ni détail ni tiroir: le seul cas où le détail aurait
       servi était celui où il disparaissait (captures du 21/08). */
    const out = errorDetail(new Error('boum'));
    expect(out).toContain('boum');
    expect(out).toContain('Error');
  });

  it('garde les champs que le SDK accroche à son Error', () => {
    const e = Object.assign(new Error('rejeté'), { code: 'PIPELINE' });
    expect(errorDetail(e)).toContain('PIPELINE');
  });

  it('rend toujours null pour ce qui ne porte rien', () => {
    expect(errorDetail({})).toBeNull();
    expect(errorDetail(null)).toBeNull();
  });
});

describe('phaseLabel', () => {
  it("nomme l'étape, parce que « vérifiez le micro » n'oriente vers rien", () => {
    expect(phaseLabel('joining', true)).toBe(' pendant la liaison audio');
    expect(phaseLabel('creating', true)).toBe(' pendant la création de l’appel');
    expect(phaseLabel('prep', true)).toBe(' pendant la préparation');
  });

  it("ne dit rien plutôt que d'inventer une étape", () => {
    expect(phaseLabel(null, true)).toBe('');
  });

  it('parle anglais aussi', () => {
    expect(phaseLabel('joining', false)).toBe(' while linking audio');
  });
});

describe('isBenignEndedReason', () => {
  it('reconnait un raccroché, des deux côtés', () => {
    /* On affichait « L'appel a été raccroché normalement » EN ROUGE, comme une
       panne. Une phrase qui se contredit elle-même en dit long sur le sérieux
       de l'écran qui la porte. */
    expect(isBenignEndedReason('customer-ended-call')).toBe(true);
    expect(isBenignEndedReason('assistant-ended-call')).toBe(true);
  });

  it('ne blanchit aucune vraie panne', () => {
    expect(isBenignEndedReason('call.in-progress.error-assistant-did-not-receive-customer-audio')).toBe(false);
    expect(isBenignEndedReason('pipeline-error-openai-llm-failed')).toBe(false);
    expect(isBenignEndedReason('silence-timed-out')).toBe(false);
    expect(isBenignEndedReason(null)).toBe(false);
  });
});
