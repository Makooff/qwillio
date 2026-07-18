# Plan produit pro — Qwillio, prêt à tourner

Audit complet + plan priorisé pour un produit ultra-professionnel et prêt à vendre.
Méthode : revue par impact utilisateur (P0 = bloquant, P3 = finition).
Chaque item indique **qui** fait (👤 toi / 🤖 moi / 🤝 les deux).

Dernière mise à jour : 2026-07-17.

---

## 0. Déjà fait cette session (rappel)

- ✅ Faux témoignages retirés (home, landing) + historique entreprise honnête (about)
- ✅ Fuite de credentials admin retirée de `/demo.html` (la démo vocale marche toujours)
- ✅ Sécurité webhooks Vapi : fail-closed en prod + comparaison timing-safe (PR #50)
- ✅ Bouclier anti-spam inbound (tous plans) + blocklist auto + spam exclu du quota + surfacé dashboard (PR #50)
- ✅ Repackaging des plans : base puissant (sentiment, transfert, transcript, anti-spam descendus en Solo/Starter) ; source de vérité `plan-features.ts` (PR #50)
- ✅ Pages : `/vs/rosie`, `/partenaires-fiduciaires`, `/plombier`, `/dentiste`, `/notaire`
- ✅ Dossier `sales/` complet (scripts, séquences, brochure, contrat, Loom, CSV)

---

## P0 — Bloquants avant de vendre sérieusement

| # | Item | Qui | Détail |
|---|---|---|---|
| P0-1 | **Mentions légales entreprise** | 👤 | N° BCE, forme juridique, siège dans footer + `/terms` `/privacy`. Obligatoire pour un site commercial belge ; un fiduciaire vérifie avant de signer. Dès obtention du statut. |
| P0-2 | **`VAPI_WEBHOOK_SECRET`** | 👤 | À poser dans Render + dashboard Vapi pour merger PR #50 sans casser l'ingestion d'appels. |
| P0-3 | **QA de bout en bout du parcours d'achat** | 🤝 | Tester : register → onboard → paiement Stripe → activation → 1er appel. Vérifier les états d'erreur (paiement échoué, webhook en retard). |
| P0-4 | **Numéro de démo / démo web testée en prod** | 👤 | Composer `qwillio.com/demo.html` micro autorisé, confirmer que l'appel se connecte. C'est la preuve produit n°1 en vente. |

## P1 — Crédibilité & conversion (fort levier clients)

| # | Item | Qui | Détail |
|---|---|---|---|
| P1-1 | **Trust signals réels** | 🤝 | Badges RGPD / hébergement UE / Belgique sur la home ; Trustpilot activé (gratuit, sans BCE au départ). 🤖 code des badges. |
| P1-2 | **Google Business Profile** | 👤 | Pas besoin de BCE. Adresse/tél vérifiables. Canal SEO local n°1. |
| P1-3 | **Étude de cas réelle** | 🤝 | Dès le 1er client satisfait : page `/cas/[client]` + témoignage vidéo. Le plus fort levier de conversion. 🤖 construit le template. |
| P1-4 | **États vides / chargement / erreur du dashboard** | 🤖 | Vérifier chaque page client (calls, leads, bookings, analytics) : squelette de chargement, état vide clair, message d'erreur récupérable. Audit produit-design. |
| P1-5 | **Onboarding sans couture** | 🤖 | Checklist d'activation claire (numéro branché, 1er appel test, config perso). Réduire les étapes où l'utilisateur peut se perdre. |

## P2 — Contenu & SEO (croissance, coût ~0 à produire)

| # | Item | Qui | Détail |
|---|---|---|---|
| P2-1 | **+6 verticales** | 🤖 | garage auto, kiné, avocat, restaurant, agence immo, coiffeur. Composant `Vertical.tsx` déjà générique. |
| P2-2 | **Landing pages par ville** | 🤖 | Bruxelles, Namur, Liège, Anvers + schema `LocalBusiness`. SEO local. |
| P2-3 | **+5 articles blog long-tail** | 🤖 | "réceptionniste IA vs répondeur", "coût standard téléphonique PME Belgique", "RGPD enregistrement d'appels", "prise de RDV auto [métier]". |
| P2-4 | **Page `/faq` + schema FAQPage** | 🤖 | Capte les "People Also Ask" Google. Aujourd'hui la FAQ est seulement sur pricing. |
| P2-5 | **+2-3 comparatifs `/vs`** | 🤖 | Ruby, AnsweringLegal, un concurrent FR/BE. Capte "X alternative". |
| P2-6 | **Maillage interne + BreadcrumbList schema** | 🤖 | Lier blog ↔ verticales ↔ pricing ; fil d'ariane structuré. |

## P2 — Marketing / lead gen

| # | Item | Qui | Détail |
|---|---|---|---|
| P2-7 | **Lead magnet gated** | 🤖 | PDF "Le vrai coût des appels manqués en Belgique" contre email → alimente Instantly. |
| P2-8 | **Capture email sur le blog** | 🤖 | Champ "recevez le playbook" en fin d'article. |
| P2-9 | **Pixels retargeting** | 👤 | Meta Pixel + Google Ads tag (comptes pub requis). 🤖 pose le code une fois les IDs fournis. |

## P3 — Finition & robustesse produit

| # | Item | Qui | Détail |
|---|---|---|---|
| P3-1 | **Accessibilité** | 🤖 | Ordre de focus, labels ARIA, cibles tactiles, contraste sur les pages publiques et le dashboard. |
| P3-2 | **Responsive extrême** | 🤖 | Tables (pricing, /vs) qui scrollent dans leur conteneur ; longues valeurs ; mobile 320px. |
| P3-3 | **Observabilité** | 🤝 | Confirmer Sentry front+back capte en prod ; alertes quota déjà en place. |
| P3-4 | **Couverture de tests** | 🤖 | E2E Playwright sur le parcours d'achat + les nouvelles pages ; tests unitaires sur la logique métier critique. |
| P3-5 | **Anti-spam avancé (Pro/Enterprise)** | 🤖 | Blocage temps réel au décrochage (assistant-request Vapi) + dashboard spam + allow/blocklist manuelle. La blocklist existe déjà. |

---

## Ordre d'exécution recommandé

1. **Toi maintenant** : `VAPI_WEBHOOK_SECRET` (P0-2) → je merge PR #50. Lancer Google Business (P1-2) + Trustpilot (P1-1). Tester la démo (P0-4).
2. **Moi ensuite (1 PR contenu)** : P2-1 verticales + P2-4 FAQ + P2-3 articles + P2-6 maillage/schema. Gros gain SEO d'un coup.
3. **Moi (1 PR produit)** : P1-4 états dashboard + P1-5 onboarding + P3-1/P3-2 accessibilité/responsive. Rend le produit "ultra-pro" au toucher.
4. **Moi (1 PR marketing)** : P2-7 lead magnet + P2-8 capture email + P1-3 template étude de cas.
5. **Quand statut juridique OK** : P0-1 mentions légales.
6. **Quand 1er client** : P1-3 vraie étude de cas + témoignage.

---

## Ce qui dépend uniquement de toi (hors code)

- Statut juridique + n° BCE
- Google Business Profile (adresse/tél)
- Trustpilot (compte gratuit)
- Comptes pub (Meta/Google) pour les pixels
- Contenu réel des études de cas (1er client)
- `VAPI_WEBHOOK_SECRET` dans Render + Vapi
