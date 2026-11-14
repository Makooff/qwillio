# Référence générée depuis le code

<!-- Généré par scripts/sync-reference.mjs. Modifier les sources puis npm run sync:reference. -->

Cet inventaire est mécanique : il ne certifie ni les droits d’accès, ni le fonctionnement de bout en bout, ni l’activation en production. Une route ou un export présent n’est pas une promesse commerciale. Les segments enfants doivent être composés avec leur route parente dans App.tsx.

[Charte](../DESIGN.md) · [État fonctionnel](FONCTIONNALITES.md) · [Consignes communes](../AGENTS.md)

## Fondations partagées

Source : [tokens.json](../frontend/src/design-system/tokens.json), consommée par Tailwind et les helpers TypeScript du produit. La charte précise les rôles et l’état d’adoption.

| Rayon sémantique | px |
| --- | --- |
| none | 0 |
| detail | 6 |
| inset | 10 |
| input | 12 |
| surface | 14 |
| overlay | 16 |
| editorial | 20 |
| editorialMobile | 24 |
| editorialLarge | 28 |
| pill | 9999 |

| Clé Tailwind / token | px |
| --- | --- |
| 0 | 0 |
| 1 | 4 |
| 2 | 8 |
| 3 | 12 |
| 4 | 16 |
| 5 | 20 |
| 6 | 24 |
| 7 | 28 |
| 8 | 32 |
| 10 | 40 |
| 12 | 48 |
| 14 | 56 |
| 16 | 64 |
| 20 | 80 |
| 24 | 96 |
| 28 | 112 |
| 32 | 128 |
| 0.5 | 2 |
| 1.5 | 6 |
| 2.5 | 10 |

| Rôle | Taille | Graisse | Interligne |
| --- | --- | --- | --- |
| display | clamp(2.35rem, 6.5vw, 5.8rem) | 300 | 1.08 |
| heading | clamp(1.75rem, 4.5vw, 3.4rem) | 300 | 1.13 |
| subheading | clamp(1.3rem, 3.4vw, 1.5rem) | 400 | 1.33 |
| lead | clamp(1.0625rem, 3.4vw, 1.25rem) | 400 | 1.35 |
| body | 16px | 400 | 1.5 |
| ui | 13px | 400 | 1.5 |
| label | 12px | 500 | 1.4 |
| eyebrow | 13px | 500 | 1.4 |

## Site V2 : variables par défaut

Source : [v2.css](../frontend/src/styles/v2.css), bloc :root. Les canaux RVB sont conservés tels quels pour les opacités Tailwind.

| Variable | Valeur dans le code |
| --- | --- |
| `--q2-canvas` | `253 252 252` |
| `--q2-band` | `208 208 208` |
| `--q2-plate` | `198 198 198` |
| `--q2-ink` | `29 29 31` |
| `--q2-graphite` | `68 64 59` |
| `--q2-body` | `119 113 105` |
| `--q2-faint` | `165 159 151` |
| `--q2-indigo` | `#7a5fff` |
| `--q2-violet` | `#cd6bfb` |
| `--q2-deep` | `#7349fe` |
| `--q2-lift` | `#b9a8ff` |
| `--q2-indigo-ink` | `#7349fe` |
| `--q2-violet-ink` | `#9b3fd0` |
| `--q2-void` | `#0a0a0a` |
| `--q2-carbon` | `#111111` |
| `--q2-obsidian` | `#1a1a1a` |
| `--q2-border-d` | `#1f1f1f` |
| `--q2-mist` | `#d0d6e0` |
| `--q2-fog` | `#8a8f98` |
| `--q2-void-tint` | `#0a0a0a` |
| `--q2-shadow-whisper` | `rgba(0, 0, 0, 0.4) 0 0 1px, rgba(0, 0, 0, 0.04) 0 1px 1px, rgba(0, 0, 0, 0.04) 0 2px 4px` |
| `--q2-shadow-hover` | `0 30px 80px rgba(20, 16, 50, 0.1)` |
| `--q2-bad-ink` | `#b42318` |
| `--q2-bad-bg` | `#fdf4f3` |
| `--q2-bad-brd` | `#f0d3cf` |
| `--q2-ok-ink` | `#1a7f52` |
| `--q2-ok-bg` | `#f4faf6` |
| `--q2-ok-brd` | `#cfe4d7` |
| `--q2-hairline` | `1px solid rgb(var(--q2-plate))` |
| `--q2-hairline-d` | `1px solid #23252a` |
| `--q2-hero-media` | `0.26` |

## Site V2 : substitutions du thème sombre explicite

Source : même fichier, bloc [data-theme='dark']. Le mode système est également défini dans la feuille ; le générateur ne remplace pas un test des trois modes.

| Variable | Valeur dans le code |
| --- | --- |
| `--q2-canvas` | `10 10 10` |
| `--q2-band` | `17 17 17` |
| `--q2-plate` | `26 26 26` |
| `--q2-ink` | `245 244 242` |
| `--q2-graphite` | `201 198 193` |
| `--q2-body` | `152 148 142` |
| `--q2-faint` | `107 104 98` |
| `--q2-shadow-whisper` | `0 0 0 1px rgb(var(--q2-plate))` |
| `--q2-shadow-hover` | `0 30px 80px rgba(0, 0, 0, 0.45)` |
| `--q2-bad-ink` | `#ffb4ab` |
| `--q2-bad-bg` | `#24120f` |
| `--q2-bad-brd` | `#52251f` |
| `--q2-ok-ink` | `#8ee0b4` |
| `--q2-ok-bg` | `#0f1f17` |
| `--q2-ok-brd` | `#1f4433` |
| `--q2-hero-media` | `0.36` |
| `--q2-indigo-ink` | `#b9a8ff` |
| `--q2-violet-ink` | `#cd6bfb` |

## Portail et administration : tokens t

Source : [admin-theme.ts](../frontend/src/styles/admin-theme.ts). Les valeurs ne définissent pas à elles seules le style de toutes les pages historiques.

| Token | Valeur dans le code |
| --- | --- |
| `t.bg` | `#0a0a0a` |
| `t.panel` | `#0a0a0a` |
| `t.panelSolid` | `#0a0a0a` |
| `t.panelHover` | `#1a1a1a` |
| `t.elevated` | `#111111` |
| `t.inset` | `#111111` |
| `t.border` | `oklch(24% 0 0 / 0.55)` |
| `t.borderHi` | `oklch(32% 0 0 / 0.70)` |
| `t.borderFocus` | `rgba(115,73,254,0.50)` |
| `t.text` | `oklch(95% 0 0)` |
| `t.textSec` | `oklch(65% 0 0)` |
| `t.textTer` | `oklch(42% 0 0)` |
| `t.textMuted` | `oklch(28% 0 0)` |
| `t.brand` | `#7349fe` |
| `t.brandHi` | `#8a6fff` |
| `t.violet` | `#cd6bfb` |
| `t.live` | `oklch(72% 0.18 145)` |
| `t.accentGrad` | `#7349fe` |
| `t.accentGlow` | `rgba(115,73,254,0.10)` |
| `t.accentMid` | `rgba(115,73,254,0.10)` |
| `t.accentDim` | `rgba(115,73,254,0.14)` |
| `t.accentBrd` | `rgba(115,73,254,0.42)` |
| `t.violetGlow` | `oklch(70.5% 0.213 316 / 0.20)` |
| `t.okGlow` | `oklch(72% 0.18 145 / 0.18)` |
| `t.mesh` | `none` |
| `t.shadow` | `0 1px 2px oklch(0% 0 0 / 0.40), 0 0 0 1px oklch(100% 0 0 / 0.03)` |
| `t.shadowFloat` | `0 12px 32px oklch(0% 0 0 / 0.55), 0 0 0 1px oklch(100% 0 0 / 0.05)` |
| `t.shadowGlow` | `0 0 0 1px rgba(115,73,254,0.25)` |
| `t.success` | `oklch(72% 0.18 145)` |
| `t.warning` | `oklch(78% 0.18 75)` |
| `t.danger` | `oklch(65% 0.22 25)` |
| `t.info` | `oklch(70% 0.18 240)` |
| `t.r` | `14px` |
| `t.rSm` | `10px` |
| `t.rFull` | `9999px` |
| `t.blur` | `blur(40px)` |
| `t.blurSm` | `blur(20px)` |

Exports de la couche sémantique [design-system.ts](../frontend/src/styles/design-system.ts) : `surface`, `surfaceRaised`, `surfaceInset`, `surfaceFloat`, `hoverWash`, `btnPrimary`, `btnPrimaryHover`, `btnDanger`, `btnGhost`, `btnGhostHover`, `btnSubtle`, `btnSubtleHover`, `btnDisabled`, `focusRing`, `inputCls`, `selectCls`, `labelCls`, `badgeStyle`, `dotStyle`, `scrim`, `dialogPanel`, `dialogTitleCls`, `dialogMessageCls`, `ds`.

## Offre configurée

Source : [plans.ts](../backend/src/config/plans.ts). Vérifier séparément l’alignement Stripe et le parcours de paiement.

| Plan | EUR/mois | Minutes | EUR/min supplémentaire | Jours d’essai |
| --- | --- | --- | --- | --- |
| solo | 99 | 250 | 0.45 | 7 |
| starter | 249 | 750 | 0.39 | 7 |
| pro | 599 | 2000 | 0.35 | 7 |
| enterprise | 1290 | 5000 | 0.30 | 7 |

## Déclarations de routes frontend

Source : [App.tsx](../frontend/src/App.tsx). Segments littéraux, dans l’ordre du fichier ; les redirections et routes imbriquées restent à lire dans leur contexte.

- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/auth/confirm`
- `/auth/confirm-email-change`
- `/privacy`
- `/terms`
- `/about`
- `/contact`
- `/gdpr`
- `/sla`
- `/fr/privacy`
- `/fr/terms`
- `/fr/gdpr`
- `/fr/sla`
- `/fr/about`
- `/fr/contact`
- `/receptionist`
- `/agent`
- `/pricing`
- `/blog`
- `/blog/:slug`
- `/vs/:slug`
- `/affiliate`
- `/affiliate/dashboard`
- `/faq`
- `/fr/faq`
- `/ville/:ville`
- `/fr/ville/:ville`
- `/partenaires-fiduciaires`
- `/fr/partenaires-fiduciaires`
- `/partenaires`
- `/plombier`
- `/dentiste`
- `/notaire`
- `/garagiste`
- `/kine`
- `/avocat`
- `/restaurant`
- `/immobilier`
- `/coiffeur`
- `/fiduciaire`
- `/fr/plombier`
- `/fr/dentiste`
- `/fr/notaire`
- `/fr/garagiste`
- `/fr/kine`
- `/fr/avocat`
- `/fr/restaurant`
- `/fr/immobilier`
- `/fr/coiffeur`
- `/fr/fiduciaire`
- `/verify-email`
- `/subscribe`
- `/onboard`
- `/dashboard`
- `calls`
- `leads`
- `bookings`
- `receptionist`
- `analytics`
- `billing`
- `account`
- `setup/call-forwarding`
- `setup/customize`
- `setup/guide`
- `support`
- `integrations`
- `agent/crm`
- `agent}
          {}
          <Route path=`
- `crm/deals`
- `crm/activities`
- `crm/:id`
- `/portal`
- `/onboarding`
- `/admin`
- `clients`
- `settings`
- `calls`
- `leads`
- `billing`
- `agents`
- `agents/email-ai`
- `agents/accounting-ai`
- `agents/inventory-ai`
- `agents/payments-ai`
- `agents/marketing-ai`
- `agents/reputation-ai`
- `agents/scheduling-ai`
- `agents/support-ai`
- `agents/crm-ai`
- `agents/document-ai`
- `agents/local-seo-ai`
- `agents/lead-gen-ai`
- `agents/analytics-ai`
- `lab`
- `lignes`
- `learning-agents`
- `agency`
- `prospects`
- `prospecting`
- `ai-learning`
- `ai-decisions`
- `analytics`
- `notifications`
- `monitor`
- `system`
- `logs`
- `campaigns`
- `followups`
- `costs`
- `retention`
- `phone-validation`
- `agents/work-planner`
- `agents/business-plan`
- `agents/branding`
- `agents/evolution`
- `*`
- `/closer`
- `prospects`
- `followups`
- `account`
- `*`

## Points de montage des routeurs backend

Source : [server.ts](../backend/src/server.ts). Cet inventaire vise les montages directs de routeurs nommés *Routes ; il ne recense pas tous les endpoints ni middlewares.

| Préfixe | Routeur |
| --- | --- |
| `/api/v1` | `publicApiRoutes` |
| `/api/auth` | `authRoutes` |
| `/api/prospects` | `prospectsRoutes` |
| `/api/clients` | `clientsRoutes` |
| `/api/dashboard` | `dashboardRoutes` |
| `/api/bot` | `botRoutes` |
| `/api/campaigns` | `campaignsRoutes` |
| `/api/webhooks` | `webhooksRoutes` |
| `/api/client-portal` | `clientPortalRoutes` |
| `/api/onboarding` | `onboardingRoutes` |
| `/api/admin-analytics` | `adminAnalyticsRoutes` |
| `/api/my-dashboard` | `myDashboardRoutes` |
| `/api/public` | `publicCharactersRoutes` |
| `/api/public` | `publicDemoRoutes` |
| `/api/trial` | `trialRoutes` |
| `/api/agent` | `agentRoutes` |
| `/api/crm` | `crmRoutes` |
| `/api/ai` | `aiLearningRoutes` |
| `/api/prospecting` | `prospectingRoutes` |
| `/api/admin/agents` | `adminAgentsRoutes` |
| `/api/admin` | `adminRoutes` |
| `/api/client` | `clientApiRoutes` |
| `/api/voice-core` | `voiceCoreRoutes` |
| `/api/autofix` | `autofixRoutes` |
| `/api/learning` | `learningRoutes` |
| `/api/closer` | `closerRoutes` |
| `/api/ai-agents` | `aiAgentsRoutes` |
| `/api/agency` | `agencyRoutes` |
| `/api/affiliate` | `affiliateRoutes` |
