import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../services/discord.service', () => ({
  discordService: { notify: vi.fn(), notifyAlerts: vi.fn(), notifyErrors: vi.fn(), notifySystem: vi.fn() },
}));

const { requireAutofixToken } = await import('../routes/autofix.routes');

/** Un req/res minimal : ce middleware ne lit qu'un en-tête et n'écrit qu'un code. */
function fake(req: Partial<Request>) {
  const res = {
    statusCode: 0 as number,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
  const next = vi.fn();
  return { req: req as Request, res: res as unknown as Response, next, raw: res };
}

describe('requireAutofixToken', () => {
  const REAL = 'a'.repeat(64);

  beforeEach(() => { process.env.AUTOFIX_TOKEN = REAL; });
  afterEach(() => { delete process.env.AUTOFIX_TOKEN; });

  it('accepte le jeton exact', () => {
    const f = fake({ header: () => REAL } as Partial<Request>);
    requireAutofixToken(f.req, f.res, f.next);
    expect(f.next).toHaveBeenCalledOnce();
    expect(f.raw.statusCode).toBe(0);
  });

  it('accepte un retour chariot final — le caractère invisible de Render', () => {
    // Payé le 08/10/2026 : l'interface de Render n'affiche pas le `\r` qu'un
    // copier-coller depuis un fichier CRLF a laissé, et le refus ne disait rien.
    const f = fake({ header: () => REAL + '\r' } as Partial<Request>);
    requireAutofixToken(f.req, f.res, f.next);
    expect(f.next).toHaveBeenCalledOnce();
  });

  it('accepte des espaces autour', () => {
    const f = fake({ header: () => `  ${REAL}\n` } as Partial<Request>);
    requireAutofixToken(f.req, f.res, f.next);
    expect(f.next).toHaveBeenCalledOnce();
  });

  it('refuse un jeton différent, et le dit', () => {
    const f = fake({ header: () => 'b'.repeat(64) } as Partial<Request>);
    requireAutofixToken(f.req, f.res, f.next);
    expect(f.next).not.toHaveBeenCalled();
    expect(f.raw.statusCode).toBe(401);
    expect(f.raw.body).toEqual({ error: 'invalid token' });
  });

  it('refuse un jeton absent', () => {
    const f = fake({ header: () => undefined } as Partial<Request>);
    requireAutofixToken(f.req, f.res, f.next);
    expect(f.raw.statusCode).toBe(401);
  });

  it('ne retire jamais les blancs INTÉRIEURS (un jeton n\'en contient pas)', () => {
    const f = fake({ header: () => REAL.slice(0, 32) + ' ' + REAL.slice(33) } as Partial<Request>);
    requireAutofixToken(f.req, f.res, f.next);
    expect(f.raw.statusCode).toBe(401);
  });

  it('rend 503 quand le serveur n\'a pas de jeton, et non 401', () => {
    // Le code se distingue du refus : 503 = mal configuré côté serveur,
    // 401 = la valeur envoyée ne correspond pas. Deux diagnostics différents.
    delete process.env.AUTOFIX_TOKEN;
    const f = fake({ header: () => REAL } as Partial<Request>);
    requireAutofixToken(f.req, f.res, f.next);
    expect(f.raw.statusCode).toBe(503);
  });

  it('refuse quand la variable de Render n\'est que des blancs', () => {
    process.env.AUTOFIX_TOKEN = '   ';
    const f = fake({ header: () => '   ' } as Partial<Request>);
    requireAutofixToken(f.req, f.res, f.next);
    expect(f.raw.statusCode).toBe(503);
  });
});
