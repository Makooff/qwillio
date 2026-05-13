# GUIDE DE DÉMARRAGE — QWILLIO

## Plateforme
Qwillio est un SaaS US-focused d'IA réceptionniste pour petites entreprises.  
Modèle : **self-onboarding** → trial 30j gratuit → abonnement mensuel automatique.  
Monnaie : **USD**. Déploiement : Render (backend) + Vercel (frontend) + Neon (PostgreSQL).

---

## Plans & Pricing

| Plan       | Mensuel | Appels/mois | Overage     |
|------------|---------|-------------|-------------|
| Starter    | $497    | 800         | $0.22/appel |
| Pro        | $1,297  | 2,000       | $0.18/appel |
| Enterprise | $2,497  | 4,000       | $0.15/appel |

Setup fee : **$0** (inclus dans le trial).

---

## ÉTAPE 1 : Stripe — Créer les prices

Dans le Dashboard Stripe, créer **3 produits récurrents** (abonnement mensuel) :

### Starter
```
Product: Qwillio Starter
Price:   $497 / month (recurring)
→ copier le Price ID → STRIPE_PRICE_BASIC_MONTHLY
```

### Pro
```
Product: Qwillio Pro
Price:   $1,297 / month (recurring)
→ copier le Price ID → STRIPE_PRICE_PRO_MONTHLY
```

### Enterprise
```
Product: Qwillio Enterprise
Price:   $2,497 / month (recurring)
→ copier le Price ID → STRIPE_PRICE_ENTERPRISE_MONTHLY
```

### Configurer le Webhook Stripe
```
URL:    https://your-backend.onrender.com/api/webhooks/stripe
Events:
  ✓ checkout.session.completed
  ✓ customer.subscription.created
  ✓ customer.subscription.updated
  ✓ customer.subscription.deleted
  ✓ invoice.payment_succeeded
  ✓ invoice.payment_failed
→ STRIPE_WEBHOOK_SECRET = whsec_XXXX
```

---

## ÉTAPE 2 : Variables d'environnement (backend)

```env
# App
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-frontend.vercel.app
API_BASE_URL=https://your-backend.onrender.com

# Database (Neon)
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=<random 64 chars>
JWT_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# VAPI
VAPI_PUBLIC_KEY=...
VAPI_PRIVATE_KEY=...
VAPI_ASSISTANT_ID=<english assistant ID>
VAPI_ASSISTANT_ID_FR=<french assistant ID>
VAPI_PHONE_NUMBER=+1XXXXXXXXXX
VAPI_PHONE_NUMBER_ID=<VAPI phone number ID>

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASIC_MONTHLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...

# Resend (emails)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Qwillio <hello@qwillio.com>

# Twilio (outbound calls local presence)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX

# Google Places (prospecting)
GOOGLE_PLACES_API_KEY=AIza...

# Discord (internal notifications)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_CALLS=...
DISCORD_WEBHOOK_LEADS=...
DISCORD_WEBHOOK_SYSTEM=...
DISCORD_WEBHOOK_ALERTS=...

# Automation
CALLS_PER_DAY=50
AUTOMATION_START_HOUR=9
AUTOMATION_END_HOUR=19
AUTOMATION_DAYS=1,2,3,4,5
TZ=America/New_York
```

---

## ÉTAPE 3 : Démarrer le serveur

### Render (recommandé)
```bash
# Build command
npm run build

# Start command
node dist/server.js

# Health check
GET /health → {"status":"healthy"}
```

### Local (dev)
```bash
cd backend
npm run dev
# Serveur sur http://localhost:3000
```

---

## ÉTAPE 4 : Flow client — Self-onboarding

Quand un client s'inscrit :

```
1. /register         → crée User (role: client)
2. /confirm-email    → vérifie l'email
3. /onboard          → renseigne businessName, plan, industry
4. Stripe Checkout   → enregistre la carte (trial = $0 maintenant)
5. Webhook reçu      → checkout.session.completed (source: self-onboarding)
6. Backend crée:
   ✓ Client record (isTrial: true, trialEndDate: J+30)
   ✓ VAPI assistant personnalisé (async, retry 3x)
   ✓ Email de bienvenue avec numéro Qwillio
7. Dashboard client  → /dashboard (operationnel)
```

Après 30 jours, premier prélèvement automatique via Stripe subscription.

---

## ÉTAPE 5 : Automation loop (29 crons actifs)

Le backend tourne en boucle automatique. Crons principaux :

| Fréquence         | Action                                     |
|-------------------|--------------------------------------------|
| Toutes les 5 min  | Outbound engine (appels prospects)         |
| Toutes les 15 min | Retry onboarding clients en attente        |
| Toutes les 15 min | CRM sync (webhook / HubSpot)               |
| Toutes les heures | Relances prospects + reminders             |
| Chaque jour 9h    | Prospection Google Places                  |
| Chaque jour 9h    | Vérification call forwarding               |
| Chaque lundi 8h   | Rapport hebdomadaire clients               |
| Dimanche minuit   | Optimisation IA assistants (Enterprise)    |

Pas d'action manuelle nécessaire — le bot démarre automatiquement au boot.

---

## ÉTAPE 6 : Local presence (appels sortants)

Pour activer la présence locale (caller ID = même area code que le prospect) :

1. Provisionner des numéros Twilio par area code
2. Les insérer dans la table `local_presence_numbers` :
```sql
INSERT INTO local_presence_numbers (area_code, phone_number, city, active)
VALUES ('212', '+12125551234', 'New York', true),
       ('310', '+13105551234', 'Los Angeles', true);
```
3. Le moteur outbound les utilise automatiquement.

Sans numéros provisionnés → fallback sur `TWILIO_PHONE_NUMBER`.

---

## ÉTAPE 7 : CRM Integrations

Les clients peuvent connecter leur CRM. Sync toutes les 15 min.

### Webhook (universel)
```json
{
  "provider": "webhook",
  "config": {
    "webhookUrl": "https://hooks.zapier.com/...",
    "secret": "optional-hmac-secret"
  }
}
```
Payload envoyé : contacts + calls + deals modifiés depuis le dernier sync.

### HubSpot (OAuth)
```json
{
  "provider": "hubspot",
  "accessToken": "pat-na1-..."
}
```
Upsert contacts via HubSpot v3 batch API (keyed by email).

---

## Vérifier que tout tourne

```bash
# Health backend
curl https://your-backend.onrender.com/health

# Logs Render
Dashboard Render → Logs → chercher:
  "[BOOT] All cron jobs registered"
  "[CRON] Outbound engine"
  "Self-onboarding complete"

# Discord
Canal #system → notifications de démarrage
Canal #calls  → chaque appel sortant
Canal #leads  → chaque nouveau prospect qualifié
```

---

## Checklist production

- [ ] Stripe en mode LIVE
- [ ] Webhook Stripe actif et testé
- [ ] VAPI assistants créés (EN + FR)
- [ ] VAPI_PHONE_NUMBER configuré
- [ ] Resend domaine vérifié
- [ ] Discord webhooks configurés
- [ ] Google Places API key avec quota suffisant
- [ ] `npm run build` sans erreur TypeScript
- [ ] Health check retourne `{"status":"healthy"}`
- [ ] Premier client test self-onboardé avec succès
