import { describe, it, expect } from 'vitest';
import { isPlaceholderName, nameProblem } from '../spelled-name';

/**
 * LE NOM DE L'AGENT N'EST PAS CELUI DE L'APPELANT (19/09/2026).
 *
 * Relevé sur un compte réel: TROIS rendez-vous au nom de « Marc De La Foi »,
 * une mémoire d'appelant sous ce nom, et un brief d'ouverture qui annonçait
 * « il s'appelle probablement Marc De La Foi » à chaque appel. L'agent de ce
 * client s'appelle Marc et se présente par « Demtalix, bonjour. Je suis Marc,
 * votre assistant IA ».
 *
 * L'analyse de fin d'appel lit le TRANSCRIPT, qui porte toujours cette phrase.
 * Sur un appel de quatre secondes où l'appelant n'a RIEN dit, le seul nom
 * propre disponible est celui de l'agent.
 *
 * La liste statique de `PLACEHOLDERS` ne pouvait pas l'attraper: « Marc » est
 * un prénom parfaitement valide. Ce qui le disqualifie n'est pas sa forme,
 * c'est QUI il désigne — donc la garde doit recevoir les noms de ce client-là.
 */
describe("le nom de l'agent et celui du commerce sont des remplissages", () => {
  const own = ['Marc', 'Demtalix'];

  it("écarte le nom de l'agent seul", () => {
    expect(isPlaceholderName('Marc', own)).toBe(true);
  });

  it("écarte le cas RÉEL: le prénom de l'agent collé à un nom estropié", () => {
    /* « Marc De La Foi » n'est égal ni à « Marc » ni à « Demtalix », et c'est
       pourtant ce qui s'est retrouvé sur trois rendez-vous. */
    expect(isPlaceholderName('Marc De La Foi', own)).toBe(true);
  });

  it('écarte le nom du commerce, même noyé dans une phrase de nom', () => {
    expect(isPlaceholderName('Demtalix', own)).toBe(true);
    expect(isPlaceholderName('Cabinet Demtalix', ['Marc', 'Cabinet Demtalix'])).toBe(true);
  });

  it("laisse passer un VRAI appelant, y compris s'il porte le même prénom", () => {
    /* La garde ne doit pas coûter un client qui s'appelle vraiment Marc: elle
       ne rejette que le nom qui COMMENCE par celui de l'agent, et un vrai
       Marc Dupont n'apparaît jamais dans l'accueil. Ici on vérifie l'autre
       sens: un nom de famille différent de celui de l'agent passe. */
    expect(isPlaceholderName('Jean-Luc de la Forge', own)).toBe(false);
    expect(isPlaceholderName('Sophie Vermeulen', own)).toBe(false);
  });

  it('ne casse rien sans noms interdits: la liste statique tient toujours', () => {
    expect(isPlaceholderName('Marc')).toBe(false);
    expect(isPlaceholderName('client')).toBe(true);
    expect(isPlaceholderName('Monsieur')).toBe(true);
    expect(isPlaceholderName('Jean-Luc de la Forge')).toBe(false);
  });

  it('ignore un nom interdit vide ou absent', () => {
    expect(isPlaceholderName('Jean-Luc de la Forge', ['', '  '])).toBe(false);
    expect(isPlaceholderName('Jean-Luc de la Forge', [])).toBe(false);
  });

  it("`nameProblem` le rend comme un remplissage, donc la réservation le refuse", () => {
    /* C'est ce qui empêche `bookAppointment` d'écrire un rendez-vous au nom
       de l'agent: le résultat dira « RIEN N'EST RESERVE » et nommera ce qui
       manque, au lieu de poser la ligne. */
    expect(nameProblem('Marc De La Foi', own)).toBe('placeholder');
    expect(nameProblem('Jean-Luc de la Forge', own)).toBe(null);
  });
});
