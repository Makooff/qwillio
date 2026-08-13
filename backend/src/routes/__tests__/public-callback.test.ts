import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { record, prospectFindFirst, prospectCreate } = vi.hoisted(() => ({
  record: vi.fn(),
  prospectFindFirst: vi.fn(),
  prospectCreate: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: { prospect: { findFirst: prospectFindFirst, create: prospectCreate } },
}));
vi.mock('../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/call-consent.service', () => ({
  callConsentService: { record },
}));

import router from '../public-callback.routes';
import { CONSENT_STATEMENTS } from '../../config/consent-statements';

const app = express();
app.use(express.json());
app.use('/api/public', router);

beforeEach(() => {
  vi.clearAllMocks();
  record.mockResolvedValue({ id: 'c1', phone: '+32470123456', collectedAt: new Date('2026-08-13T18:00:00Z') });
  prospectFindFirst.mockResolvedValue(null);
  prospectCreate.mockResolvedValue({});
});

const body = (over: Record<string, unknown> = {}) => ({
  phone: '+32470123456',
  name: 'Marie Dupont',
  businessName: 'Boulangerie Dupont',
  locale: 'fr',
  consent: true,
  ...over,
});

describe('demande publique de rappel', () => {
  it('enregistre le consentement et crée le prospect', async () => {
    const res = await request(app).post('/api/public/callback-request').send(body());

    expect(res.status).toBe(201);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+32470123456', countryCode: 'BE', source: 'web_form' }),
    );
    expect(prospectCreate).toHaveBeenCalled();
  });

  it('enregistre le libellé DU SERVEUR, jamais celui envoyé par le client', async () => {
    /* Le cœur de la valeur probante. Si on inscrivait le texte reçu, on
       prouverait un consentement à un texte qu'on aurait pu écrire soi-même
       après coup: la preuve ne vaudrait rien. */
    await request(app)
      .post('/api/public/callback-request')
      .send(body({ statement: "J'accepte absolument tout, y compris d'être appelé la nuit" }));

    expect(record.mock.calls[0][0].statement).toBe(CONSENT_STATEMENTS.fr);
  });

  it('REFUSE sans case cochée, et n’enregistre rien', async () => {
    // Pas de consentement déduit de l'envoi du formulaire: le RGPD exige un
    // acte positif clair.
    const res = await request(app).post('/api/public/callback-request').send(body({ consent: false }));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('consent_required');
    expect(record).not.toHaveBeenCalled();
    expect(prospectCreate).not.toHaveBeenCalled();
  });

  it('refuse un numéro incomplet ou illisible', async () => {
    /* « +32 470 12 » est le cas qui a fait tomber ma première version: en
       supprimant les espaces, elle en faisait un « +3247012 » d'apparence
       valide. `toE164` exige 8 chiffres au minimum. */
    for (const phone of ['+32 470 12', 'pas un numero', '', '0470123456']) {
      const res = await request(app).post('/api/public/callback-request').send(body({ phone }));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_phone');
    }
    expect(record).not.toHaveBeenCalled();
  });

  it('accepte un format national quand le pays est fourni', async () => {
    // Un visiteur tape son numéro comme il le connaît, pas en E.164.
    const res = await request(app)
      .post('/api/public/callback-request')
      .send(body({ phone: '0470 12 34 56', country: 'BE' }));

    expect(res.status).toBe(201);
    expect(record.mock.calls[0][0].phone).toBe('+32470123456');
  });

  it('déduit le pays du préfixe', async () => {
    await request(app).post('/api/public/callback-request').send(body({ phone: '+33612345678' }));
    expect(record.mock.calls[0][0].countryCode).toBe('FR');
  });

  it('n’écrase pas un prospect existant', async () => {
    // Un formulaire public ne doit pas pouvoir remettre à zéro une fiche déjà
    // travaillée par un commercial.
    prospectFindFirst.mockResolvedValue({ id: 'p_existant' });

    const res = await request(app).post('/api/public/callback-request').send(body());

    expect(res.status).toBe(201);
    expect(record).toHaveBeenCalled();
    expect(prospectCreate).not.toHaveBeenCalled();
  });

  it('pose une date d’expiration au consentement', async () => {
    // Un consentement sans terme se périme mal: on ne rappelle pas quelqu'un
    // sur la foi d'un clic oublié depuis des années.
    await request(app).post('/api/public/callback-request').send(body());
    expect(record.mock.calls[0][0].expiresAt).toBeInstanceOf(Date);
  });

  it('ne renvoie aucun identifiant interne', async () => {
    // Route publique: elle n'a pas à devenir un moyen de sonder la base.
    const res = await request(app).post('/api/public/callback-request').send(body());
    expect(res.body.id).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('c1');
  });
});
