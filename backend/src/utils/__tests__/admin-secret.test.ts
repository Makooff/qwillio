import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request } from 'express';

/* `env` est lu à chaque appel, mais c'est un objet figé au chargement du
   module: on le remplace donc par un mock mutable pour piloter ADMIN_SECRET
   scénario par scénario.
   `vi.hoisted` est obligatoire ici: `vi.mock` remonte en tête de fichier, donc
   une const déclarée normalement n'existerait pas encore au moment du mock. */
const { envMock, loggerMock } = vi.hoisted(() => ({
  envMock: { ADMIN_SECRET: '' } as { ADMIN_SECRET: string },
  loggerMock: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

vi.mock('../../config/env', () => ({ env: envMock }));
vi.mock('../../config/logger', () => ({ logger: loggerMock }));

import { isAdminSecretAuthorized, MIN_ADMIN_SECRET_LENGTH, __resetAdminSecretWarning } from '../admin-secret';

/** 32 caractères, la longueur minimale acceptée. */
const STRONG = 'a'.repeat(MIN_ADMIN_SECRET_LENGTH);

const reqWith = (secret?: string): Request =>
  ({
    headers: secret === undefined ? {} : { 'x-admin-secret': secret },
    method: 'GET',
    originalUrl: '/api/admin/clients',
    ip: '203.0.113.7',
  }) as unknown as Request;

describe('isAdminSecretAuthorized', () => {
  beforeEach(() => {
    envMock.ADMIN_SECRET = '';
    loggerMock.warn.mockClear();
    loggerMock.error.mockClear();
    __resetAdminSecretWarning();
  });

  it('refuse quand ADMIN_SECRET est vide, même si la requête en porte un', () => {
    expect(isAdminSecretAuthorized(reqWith('peu importe'), 'test')).toBe(false);
  });

  it('refuse quand la requête ne porte aucun secret', () => {
    envMock.ADMIN_SECRET = STRONG;
    expect(isAdminSecretAuthorized(reqWith(), 'test')).toBe(false);
  });

  it('accepte le secret exact et laisse une trace', () => {
    envMock.ADMIN_SECRET = STRONG;
    expect(isAdminSecretAuthorized(reqWith(STRONG), 'authMiddleware')).toBe(true);

    // La trace est le cœur du correctif: un accès admin sans compte doit être
    // visible dans les logs, avec la route et l'IP.
    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
    const line = loggerMock.warn.mock.calls[0][0] as string;
    expect(line).toContain('authMiddleware');
    expect(line).toContain('/api/admin/clients');
    expect(line).toContain('203.0.113.7');
  });

  it('ne journalise jamais le secret lui-même', () => {
    envMock.ADMIN_SECRET = STRONG;
    isAdminSecretAuthorized(reqWith(STRONG), 'test');
    expect(loggerMock.warn.mock.calls[0][0]).not.toContain(STRONG);
  });

  it('refuse un secret voisin', () => {
    envMock.ADMIN_SECRET = STRONG;
    expect(isAdminSecretAuthorized(reqWith(STRONG.slice(0, -1) + 'b'), 'test')).toBe(false);
    expect(loggerMock.warn).not.toHaveBeenCalled();
  });

  it('refuse un secret de longueur différente sans planter', () => {
    // timingSafeEqual jette si les tampons diffèrent en taille: la garde de
    // longueur doit passer avant, sinon une requête forgée devient un 500.
    envMock.ADMIN_SECRET = STRONG;
    expect(() => isAdminSecretAuthorized(reqWith('court'), 'test')).not.toThrow();
    expect(isAdminSecretAuthorized(reqWith(STRONG + 'x'), 'test')).toBe(false);
  });

  it('DÉSACTIVE la porte quand le secret configuré est trop court', () => {
    const weak = 'a'.repeat(MIN_ADMIN_SECRET_LENGTH - 1);
    envMock.ADMIN_SECRET = weak;

    // Même en présentant le bon secret: un secret énumérable ne doit pas
    // ouvrir un accès administrateur total.
    expect(isAdminSecretAuthorized(reqWith(weak), 'test')).toBe(false);
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
  });

  it("n'avertit qu'une fois pour un secret trop court", () => {
    envMock.ADMIN_SECRET = 'trop-court';
    isAdminSecretAuthorized(reqWith('trop-court'), 'test');
    isAdminSecretAuthorized(reqWith('trop-court'), 'test');
    isAdminSecretAuthorized(reqWith('trop-court'), 'test');
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
  });
});
