import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rescuePromise, urgencyFromTags } from '../promise-rescue';

/**
 * « JE NOTE ET ON VOUS RAPPELLE », SANS RIEN NOTER (20/09/2026).
 *
 * Trois appels réels: l'agent promet un rappel, n'appelle jamais
 * `captureLead`, et `leadAlertService` sort sur `no_lead`. Rien n'est écrit,
 * personne ne rappelle, et l'appelant raccroche RASSURÉ. C'est le défaut le
 * plus coûteux du produit: aucune erreur, aucune trace, un client perdu.
 *
 * La règle de prompt (« promettre un rappel EXIGE captureLead ») existe dans
 * les trois langues depuis le 16/09 et a été enfreinte deux fois depuis. Une
 * consigne est une probabilité; ce qui doit arriver à coup sûr se pose dans le
 * code.
 */

const facts = (over: Record<string, unknown> = {}) => ({
  analysis: {
    callbackPromised: true,
    callerName: 'Jean-Luc de la Forge',
    emailCollected: null,
    summary: 'Demande un devis pour un détartrage, rappel promis.',
    tags: [],
    ...over,
  },
  callerNumber: '32483620980',
  hasLiveLead: false,
  hasBooking: false,
});

describe('le filet rattrape ce que le modèle a oublié', () => {
  it('reconstruit un lead quand un rappel a été promis sans captureLead', () => {
    const out = rescuePromise(facts());
    expect(out.rescued).toBe(true);
    if (!out.rescued) return;
    expect(out.lead.phone).toBe('32483620980');
    expect(out.lead.name).toBe('Jean-Luc de la Forge');
    expect(out.lead.reason).toContain('devis');
  });

  it("ne rattrape rien quand captureLead a fait son travail", () => {
    /* Le chemin normal. Rattraper ici ferait DEUX leads et DEUX alertes pour
       un seul appel, et le gérant apprendrait à ignorer les deux. */
    const out = rescuePromise({ ...facts(), hasLiveLead: true });
    expect(out.rescued).toBe(false);
    if (out.rescued) return;
    expect(out.why).toBe('already_captured');
  });

  it("ne rattrape rien quand l'appelant repart avec un rendez-vous", () => {
    // Il est servi: il n'attend aucun rappel.
    const out = rescuePromise({ ...facts(), hasBooking: true });
    expect(out.rescued).toBe(false);
    if (out.rescued) return;
    expect(out.why).toBe('booked');
  });

  it("ne fabrique rien quand aucune promesse n'a été faite", () => {
    const out = rescuePromise(facts({ callbackPromised: false }));
    expect(out.rescued).toBe(false);
    if (out.rescued) return;
    expect(out.why).toBe('no_promise');
  });
});

describe("sans moyen de rappeler, on refuse plutôt que d'inventer", () => {
  it('un numéro masqué et aucun courriel: pas de lead', () => {
    /* Une fiche que le gérant ne peut pas honorer lui fait croire qu'il le
       peut. C'est pire que rien. */
    const out = rescuePromise({ ...facts(), callerNumber: null });
    expect(out.rescued).toBe(false);
    if (out.rescued) return;
    expect(out.why).toBe('unreachable');
  });

  it('un courriel seul suffit à rappeler', () => {
    const out = rescuePromise({
      ...facts({ emailCollected: 'jl@example.be' }),
      callerNumber: null,
    });
    expect(out.rescued).toBe(true);
    if (!out.rescued) return;
    expect(out.lead.email).toBe('jl@example.be');
    expect(out.lead.phone).toBeNull();
  });
});

describe('ce qui entre dans la fiche', () => {
  it("écarte un nom de remplissage, comme captureLead le fait", () => {
    // 6quadragesies: « client » resterait affiché comme le nom de quelqu'un.
    const out = rescuePromise(facts({ callerName: 'client' }));
    expect(out.rescued).toBe(true);
    if (!out.rescued) return;
    expect(out.lead.name).toBeNull();
    expect(out.lead.phone).toBe('32483620980');
  });

  it('garde une raison lisible même sans résumé', () => {
    const out = rescuePromise(facts({ summary: '   ' }));
    expect(out.rescued).toBe(true);
    if (!out.rescued) return;
    expect(out.lead.reason.length).toBeGreaterThan(0);
  });

  it("lit l'urgence sur les étiquettes que le modèle produit vraiment", () => {
    /* Le modèle ne rend pas de champ d'urgence: `tags` est ce qui existe.
       Réclamer un champ de plus ajouterait une sortie que rien ne vérifie. */
    expect(urgencyFromTags(['urgent', 'new_customer'])).toBe('high');
    expect(urgencyFromTags(['complaint'])).toBe('high');
    expect(urgencyFromTags(['repeat_customer'])).toBe('normal');
    expect(urgencyFromTags(null)).toBe('normal');
  });
});

describe('le filet ATTEINT le chemin réel', () => {
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const CALLS = stripComments(readFileSync(join(__dirname, '..', '..', 'client-call.service.ts'), 'utf8'));
  const WEBHOOK = stripComments(
    readFileSync(join(__dirname, '..', '..', '..', 'controllers', 'voice-webhook.controller.ts'), 'utf8'),
  );

  it("le post-appel demande la promesse au modèle d'analyse", () => {
    expect(CALLS).toMatch(/callbackPromised/);
    expect(CALLS).toMatch(/rescuePromise\(/);
  });

  it("le lead reconstruit remonte jusqu'à l'alerte", () => {
    /* Un filet construit et jamais branché est pire que pas de filet: il
       donne l'impression que la promesse serait tenue (6quindecies). */
    expect(WEBHOOK).toMatch(/rescuedLead/);
    expect(WEBHOOK).toMatch(/lead: liveLead \?\? rescuedLead/);
  });

  it("le lead capté en direct est passé au post-appel, sinon il doublerait", () => {
    expect(WEBHOOK).toMatch(/liveLead,/);
  });
});
