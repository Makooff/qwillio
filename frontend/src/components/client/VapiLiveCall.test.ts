import { describe, it, expect } from 'vitest';
import { errorText, isMicDenied, isProviderFault, shouldReportConnectFailure } from './VapiLiveCall';

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
