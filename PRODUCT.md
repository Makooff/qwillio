# Qwillio — produit et direction

Révision du 14 novembre 2026.

Qwillio aide les professionnels à traiter leurs appels, comprendre les demandes et organiser leurs suites : informations, rendez-vous, contacts et suivi. La présentation doit donner la cohérence et la précision d’un produit établi, avec une identité propre et des parcours complets.

## Références pour travailler

- [État fonctionnel](docs/FONCTIONNALITES.md) : surfaces accessibles, code serveur présent, prototypes et limites de vérification.
- [Charte Qwillio](DESIGN.md) : branding, spacing, arrondis, typographie, composants et interactions, inspirés de Codex et d’ElevenLabs.
- [Consignes communes](AGENTS.md) : même contexte pour Claude et Codex.
- [Référence générée](docs/REFERENCE-GENEREE.md) : inventaire des routes, tokens et offre configurée.

## Développer sans confondre ambition et état actuel

Le réceptionniste, les espaces client/admin, le CRM et les outils vocaux constituent le socle à approfondir. De nouveaux modules, marchés, langues, interfaces et intégrations peuvent enrichir le produit.

La page publique Agent redirige actuellement vers l’accueil ; seul le module Agent CRM est explicitement monté côté client. D’autres modules disposent de code ou d’écrans administratifs sans que cela prouve leur ouverture commerciale. Le portail actif utilise `pages/client/`, pas le prototype `pages/v2/app/`.

La qualité attendue ne signifie ni simplification graphique systématique ni immobilité. Une nouvelle idée doit pouvoir être proposée, prototypée et intégrée au système lorsqu’elle améliore l’usage. [Politique d’évolution](docs/EVOLUTION.md).

## Parler du produit avec justesse

Les fonctions accessibles doivent être distinguées des possibilités futures. Prix, quotas et essais se vérifient dans `backend/src/config/plans.ts` et le parcours de facturation. Performances vocales, disponibilité, résultats commerciaux et activation des fournisseurs demandent des preuves adaptées ; ne pas transformer un objectif ou un ancien document en garantie.

Les contenus sont organisés en français, anglais et néerlandais pour la publication. L’interface déclare actuellement français/anglais ; les capacités vocales se vérifient séparément.
