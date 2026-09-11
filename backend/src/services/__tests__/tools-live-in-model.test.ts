import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Les outils vivent DANS le modèle, jamais à la racine de l'assistant.
 *
 * ## Ce que l'API vivante a répondu, le 10/09/2026
 *
 *     {"message":["property tools should not exist"],"statusCode":400}
 *
 * Sur les SIX variantes. Rien dans le code ne le laissait deviner: la racine
 * paraissait naturelle, le compilateur ne dit rien d'un objet `any`, et la
 * documentation ne tranche pas.
 *
 * ## Pourquoi ça a dormi si longtemps
 *
 * La racine n'était renseignée que `if (tools.length > 0)`, et les outils se
 * réduisaient à `transferCall`, posé seulement si le client avait déjà un
 * numéro de transfert — c'est-à-dire jamais à l'inscription. Le champ fautif
 * n'était donc jamais envoyé. Le jour où les outils sont devenus
 * systématiques, la création d'assistant est tombée pour TOUT LE MONDE.
 *
 * C'est le mode d'échec du point 6octies dans son entier: un champ refusé ne
 * dégrade pas un appel, il annule l'assistant, et la seule trace est un 400
 * que personne ne lit.
 *
 * ## Pourquoi ce test lit le SOURCE
 *
 * Il ne peut pas parler à Vapi — c'est le travail de `npm run voice:validate`,
 * et lui seul fait autorité. Ce test fige la leçon déjà payée pour qu'elle ne
 * se reperde pas entre deux passages du script, exactement comme le test de
 * cloisonnement lit le contrôleur client.
 */
const read = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');

const SITES = [
  'services/onboarding.service.ts',
  'scripts/validate-assistant.ts',
];

describe('la place des outils dans la charge Vapi', () => {
  it("n'assigne jamais `tools` à la racine d'un assistant", () => {
    for (const file of SITES) {
      const source = read(file);
      /* `assistantData.tools = …` et `updatedConfig.tools = …` sont les deux
         formes exactes qui ont produit le refus. */
      expect(source, `${file} pose tools à la racine`).not.toMatch(/\b(assistantData|updatedConfig)\.tools\s*=/);
    }
  });

  it('envoie bien des outils, dans le modèle', () => {
    // Le test symétrique: retirer les outils ferait passer le premier et
    // rendrait l'agent muet sur le transfert, la base et les rendez-vous.
    const onboarding = read('services/onboarding.service.ts');
    expect(onboarding).toMatch(/assistantData\.model\.tools\s*=/);
    /* Le chemin de SYNCHRONISATION envoie aussi ses outils, dans `model`.
       Le motif ne suit plus l'appel: `buildAssistantTools` est appelé avant
       la charge, pour que la langue et le vocabulaire se lisent sur le profil
       fraîchement purgé. Ce qui doit rester vrai est que les outils partent,
       et qu'ils partent depuis ce constructeur-là. */
    expect(onboarding).toMatch(/buildAssistantTools\(client\.id\)/);
    expect(onboarding).toMatch(/tools:\s*syncTools/);
  });

  it('les fait entrer par le constructeur de l\'appel, jamais par une copie', () => {
    /* Une liste d'outils réécrite pour la synchronisation ne vieillirait pas
       avec celle de l'appel, et c'est l'originale qui part chez Vapi. */
    expect(read('services/onboarding.service.ts')).toContain('buildVoiceTools');
    expect(read('scripts/validate-assistant.ts')).toContain('buildVoiceTools');
  });
});

/**
 * La leçon vaut aussi pour qui LIT l'assistant distant, pas seulement pour qui
 * l'écrit.
 *
 * `voice:doctor` lisait `assistant.tools`, la racine. Or Vapi refuse ce champ
 * (« property tools should not exist »), donc un assistant distant n'en a
 * JAMAIS. Le docteur annonçait par conséquent « 0 outil » à tout le monde, y
 * compris sur un assistant parfaitement configuré, et conseillait de
 * resynchroniser — un geste qui ne changeait rien, puisque rien n'était cassé.
 *
 * Un diagnostic faux coûte plus cher qu'aucun diagnostic: on cherche la panne
 * là où elle n'est pas. Ici il a coûté une nuit et un script écrit pour rien.
 *
 * Le test symétrique de celui du dessus, donc: l'écriture pose les outils dans
 * `model`, la lecture les y cherche.
 */
describe('la place des outils quand on RELIT l\'assistant', () => {
  const doctor = read('scripts/diagnose-inbound.ts');

  it('cherche les outils dans `model.tools`', () => {
    expect(doctor).toMatch(/assistant\.model\?\.tools/);
  });

  it('ne compte JAMAIS la racine comme la liste des outils', () => {
    /* La forme fautive exacte: `const tools = Array.isArray(assistant.tools)`.
       La racine peut encore être lue pour signaler une anomalie, mais elle ne
       peut plus être ce que le verdict compte. */
    expect(doctor).not.toMatch(/const\s+tools\s*=\s*Array\.isArray\(assistant\.tools\)/);
  });

  it('signale la racine si elle porte quelque chose', () => {
    /* Vapi la refuse: si elle contenait un outil, ce serait que l'API a changé
       d'avis, et il faudrait le savoir plutôt que l'ignorer. */
    expect(doctor).toContain('rootTools');
    expect(doctor).toMatch(/RACINE/);
  });
});
