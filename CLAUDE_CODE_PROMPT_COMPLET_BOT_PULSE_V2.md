# BOT PULSE V2 - PROMPT COMPLET POUR CLAUDE CODE

## 🎯 CONTEXTE DU PROJET

Bot Pulse est une plateforme SaaS **déjà opérationnelle** qui automatise la prospection et la vente de solutions d'IA téléphonique pour les entreprises locales (restaurants, hôtels, salons, services).

**IMPORTANT : Ce projet existe déjà avec :**
- Base de code fonctionnelle dans `C:\Users\makho\Documents\Bot Pulse\bot-pulse\`
- Docker containers actifs (n8n, PostgreSQL, backend, frontend)
- Base de données PostgreSQL opérationnelle
- Workflows n8n de 43 nodes en production
- APIs configurées : VAPI, Stripe, Resend, Google Places

**TON RÔLE : Créer un système backend/frontend complet et moderne qui REMPLACE/COMPLÈTE le système actuel.**

---

## 🔄 WORKFLOW AUTOMATIQUE EN BOUCLE (CRITIQUE)

**IMPORTANT : Le système doit fonctionner EN CONTINU, 24/7, sans intervention humaine.**

### 🎯 Cycle Automatique Complet

```
┌─────────────────────────────────────────────────────────────┐
│ BOUCLE INFINIE - TANT QUE BOT_ACTIF = true                 │
└─────────────────────────────────────────────────────────────┘

ÉTAPE 1 : PROSPECTION (Quotidien - 9h)
┌─────────────────────────────────────────────────────────────┐
│ 1. Rechercher 20-30 nouveaux prospects sur Google Places   │
│    → Types: restaurants, hotels, salons, services          │
│    → Zones: Belgique (Bruxelles, Anvers, Gand, etc.)      │
│ 2. Extraire toutes les données (nom, tel, email, rating)   │
│ 3. Calculer score automatiquement (0-100)                  │
│ 4. Sauvegarder dans BD avec status='new'                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
ÉTAPE 2 : APPELS DE VENTE (Toutes les 20min, 9h-19h)
┌─────────────────────────────────────────────────────────────┐
│ 1. Sélectionner 1 prospect status='new' (meilleur score)   │
│ 2. Appeler avec VAPI (Marie vend un réceptionniste IA)     │
│    → Marie présente les 3 packages (BASIC/PRO/ENTERPRISE)  │
│    → Marie pose questions de qualification                  │
│    → Marie collecte l'email                                 │
│ 3. Analyser transcript avec GPT-4                          │
│    → Extraire: intérêt (1-10), besoins, email             │
│ 4. Si intérêt ≥ 7 → ÉTAPE 3                               │
│    Si intérêt < 7 → Marquer pour rappel 3 mois            │
└─────────────────────────────────────────────────────────────┘
                            ↓
ÉTAPE 3 : ENVOI DEVIS (Immédiat après appel)
┌─────────────────────────────────────────────────────────────┐
│ 1. Générer devis automatiquement                           │
│    → Package recommandé selon besoins                       │
│    → Prix: BASIC (697€+197€/m), PRO (997€+347€/m),        │
│              ENTERPRISE (1497€+497€/m)                      │
│ 2. Créer lien de paiement Stripe                          │
│ 3. Envoyer email HTML avec devis + lien Stripe            │
│ 4. Programmer relances J+1, J+3, J+7                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
ÉTAPE 4 : RELANCES AUTOMATIQUES (Toutes les heures)
┌─────────────────────────────────────────────────────────────┐
│ 1. Vérifier si relances programmées à envoyer              │
│ 2. Envoyer email relance (template J+1, J+3 ou J+7)       │
│ 3. Si J+7 passé sans réponse → rappel dans 3 mois         │
└─────────────────────────────────────────────────────────────┘
                            ↓
ÉTAPE 5 : PAIEMENT REÇU (Webhook Stripe instantané)
┌─────────────────────────────────────────────────────────────┐
│ 1. Stripe webhook: checkout.session.completed              │
│ 2. Créer client dans BD                                    │
│ 3. Créer subscription Stripe (paiement mensuel auto)       │
│ 4. → GÉNÉRATION AUTOMATIQUE WORKFLOW (CRITIQUE!)           │
└─────────────────────────────────────────────────────────────┘
                            ↓
ÉTAPE 6 : GÉNÉRATION WORKFLOW CLIENT (Automatique)
┌─────────────────────────────────────────────────────────────┐
│ 1. Créer assistant VAPI personnalisé pour le client        │
│    → System prompt adapté au business                       │
│    → Voix ElevenLabs configurée                            │
│    → Nom: "Réceptionniste - {Nom Business}"                │
│                                                             │
│ 2. Acheter numéro téléphone VAPI (Belgique)                │
│    → Associer au nouvel assistant                          │
│                                                             │
│ 3. GÉNÉRER WORKFLOW N8N COMPLET (JSON)                     │
│    → Webhook entrant sur le numéro VAPI                    │
│    → Node OpenAI (réponses intelligentes)                  │
│    → Node Google Calendar (réservations)                   │
│    → Node Airtable (stockage données)                      │
│    → Node Email (confirmations)                            │
│    → Node SMS (rappels)                                    │
│                                                             │
│ 4. Packager le tout:                                       │
│    → workflow.json (fichier n8n importable)                │
│    → config.json (credentials, phone, etc.)                │
│    → README.md (instructions setup)                        │
│    → guide-utilisation.pdf                                 │
│                                                             │
│ 5. Créer ZIP: receptionniste-{business-name}.zip           │
└─────────────────────────────────────────────────────────────┘
                            ↓
ÉTAPE 7 : LIVRAISON CLIENT (Automatique)
┌─────────────────────────────────────────────────────────────┐
│ 1. Envoyer email de bienvenue avec:                        │
│    → Pièce jointe: receptionniste-{business-name}.zip      │
│    → Téléphone IA: +32 XXX XX XX XX                        │
│    → Instructions step-by-step                             │
│    → Lien dashboard client (accès système)                 │
│                                                             │
│ 2. Notification Discord "🎉 NOUVELLE VENTE!"               │
│    → Business: {nom}                                        │
│    → Package: {BASIC/PRO/ENTERPRISE}                       │
│    → MRR: {197/347/497}€                                   │
│    → CA: {setup + monthly}€                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
RETOUR À L'ÉTAPE 1 (Boucle continue)

┌─────────────────────────────────────────────────────────────┐
│ Le cycle recommence automatiquement                        │
│ Objectif: 50 appels/jour = ~10 qualifiés = ~3 ventes/mois │
└─────────────────────────────────────────────────────────────┘
```

### 🔑 Points Critiques d'Automatisation

1. **AUCUNE INTERVENTION MANUELLE**
   - ❌ Pas de clic pour lancer l'appel
   - ❌ Pas de clic pour envoyer le devis
   - ❌ Pas de clic pour créer le workflow client
   - ✅ Tout se fait automatiquement via crons + webhooks

2. **GÉNÉRATION WORKFLOW N8N**
   ```javascript
   // Template de workflow n8n à générer
   {
     "name": "Réceptionniste IA - {business_name}",
     "nodes": [
       {
         "name": "Webhook VAPI",
         "type": "n8n-nodes-base.webhook",
         "parameters": {
           "path": "vapi-{client_id}",
           "httpMethod": "POST"
         }
       },
       {
         "name": "Extraire Données Appel",
         "type": "n8n-nodes-base.set",
         "parameters": {
           "values": {
             "caller_phone": "={{$json.customer.number}}",
             "transcript": "={{$json.transcript}}",
             "timestamp": "={{$now}}"
           }
         }
       },
       {
         "name": "Analyser Demande",
         "type": "n8n-nodes-base.openAi",
         "parameters": {
           "operation": "message",
           "model": "gpt-4-turbo",
           "messages": {
             "values": [{
               "role": "system",
               "content": "Analyser cette demande client: {{$json.transcript}}"
             }]
           }
         }
       },
       {
         "name": "Si Réservation",
         "type": "n8n-nodes-base.if",
         "parameters": {
           "conditions": {
             "string": [{
               "value1": "={{$json.intent}}",
               "value2": "reservation"
             }]
           }
         }
       },
       {
         "name": "Vérifier Dispo Google Calendar",
         "type": "n8n-nodes-base.googleCalendar",
         "parameters": {
           "operation": "get",
           "calendar": "{client_calendar_id}",
           "start": "={{$json.requested_datetime}}",
           "end": "={{$json.requested_datetime + 1h}}"
         }
       },
       {
         "name": "Créer Réservation",
         "type": "n8n-nodes-base.googleCalendar",
         "parameters": {
           "operation": "create",
           "summary": "Réservation {{$json.customer_name}}",
           "start": "={{$json.requested_datetime}}",
           "attendees": "={{$json.customer_email}}"
         }
       },
       {
         "name": "Enregistrer Airtable",
         "type": "n8n-nodes-base.airtable",
         "parameters": {
           "operation": "create",
           "table": "Réservations",
           "fields": {
             "values": {
               "Nom": "={{$json.customer_name}}",
               "Tel": "={{$json.caller_phone}}",
               "Date": "={{$json.requested_datetime}}",
               "Personnes": "={{$json.party_size}}"
             }
           }
         }
       },
       {
         "name": "Email Confirmation Client",
         "type": "n8n-nodes-base.emailSend",
         "parameters": {
           "toEmail": "={{$json.customer_email}}",
           "subject": "Confirmation réservation - {business_name}",
           "html": "<h1>Réservation confirmée!</h1>..."
         }
       },
       {
         "name": "SMS Rappel J-1",
         "type": "n8n-nodes-base.httpRequest",
         "parameters": {
           "method": "POST",
           "url": "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
           "body": {
             "To": "={{$json.caller_phone}}",
             "Body": "Rappel: réservation demain à {business_name}"
           }
         }
       },
       {
         "name": "Réponse VAPI",
         "type": "n8n-nodes-base.respondToWebhook",
         "parameters": {
           "responseBody": {
             "message": "Votre réservation est confirmée pour {{$json.requested_datetime}}"
           }
         }
       }
     ],
     "connections": {
       // Connections logiques entre nodes
     }
   }
   ```

3. **DÉCLENCHEURS AUTOMATIQUES**
   - **Cron Prospection**: `0 9 * * 1-5` (9h, lun-ven)
   - **Cron Appels**: `*/20 9-19 * * 1-5` (toutes les 20min, 9h-19h)
   - **Cron Relances**: `0 * * * *` (toutes les heures)
   - **Webhook Stripe**: Instantané sur paiement
   - **Webhook VAPI**: Instantané sur fin d'appel

4. **ÉTAT DU BOT**
   ```sql
   CREATE TABLE bot_status (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     is_active BOOLEAN DEFAULT true,
     calls_today INTEGER DEFAULT 0,
     calls_quota_daily INTEGER DEFAULT 50,
     last_prospection TIMESTAMP,
     last_call TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

5. **ENDPOINTS DE CONTRÔLE**
   ```typescript
   // Démarrer le bot
   POST /api/bot/start
   → Active tous les crons
   → is_active = true
   
   // Arrêter le bot
   POST /api/bot/stop
   → Désactive tous les crons
   → is_active = false
   
   // Status du bot
   GET /api/bot/status
   → { active: true, calls_today: 23, quota: 50, ... }
   ```

---

## 📊 MODÈLE ÉCONOMIQUE

### Packages de Vente

| Package | Setup Fee | Abonnement Mensuel | Volume Appels | Features |
|---------|-----------|-------------------|---------------|----------|
| **BASIC** | 697€ | 197€/mois | 200 appels/mois | Réceptionniste IA 24/7, Réservations, FAQ |
| **PRO** | 997€ | 347€/mois | 500 appels/mois | BASIC + Qualification prospects + Analytics |
| **ENTERPRISE** | 1497€ | 497€/mois | 1000 appels/mois | PRO + Multi-langues + Intégrations avancées |

**Objectif : 30 clients actifs = 10,410€ MRR (si tous PRO)**
**ROI projeté : 1000%+ après 3 mois**

---

## 🔑 CREDENTIALS EXISTANTES (À RÉUTILISER)

### Base de données PostgreSQL
```env
DATABASE_URL=postgresql://n8n_user:Couronne94.@localhost:5432/n8n_db
POSTGRES_USER=n8n_user
POSTGRES_PASSWORD=Couronne94.
POSTGRES_DB=n8n_db
POSTGRES_PORT=5432
```

### VAPI (Appels IA)
```env
# Keys existantes
VAPI_PUBLIC_KEY=eaded992-3a0b-48a4-bdb3-09438c4e54a4
VAPI_PRIVATE_KEY=bc604c5b-1f21-4b73-9887-d3de7e9f300a
VAPI_ASSISTANT_ID=7db314c1-cb60-4aaa-a050-e5496d6db641
VAPI_PHONE_NUMBER=+16073548569

# Configuration
VAPI_BASE_URL=https://api.vapi.ai
VAPI_MODEL=gpt-4-turbo
VAPI_VOICE_PROVIDER=11labs
VAPI_VOICE_ID=21m00Tcm4TlvDq8ikWAM
VAPI_STABILITY=0.75
VAPI_SIMILARITY_BOOST=0.85
```

### Stripe (Paiements) - MODE LIVE
```env
# ATTENTION : Clés LIVE, pas TEST
STRIPE_MODE=live
STRIPE_SECRET_KEY=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
STRIPE_PUBLISHABLE_KEY=pk_live_51SI3rrEJ1kx0sRhJFGJ6DqcVU4iI2DjHI58vU0Q7bLJCzXLxTXKyj6CIaZQE4KGlOBmiBgNVdP4PxhgWyUyuHjEf004kXaDQl7

# Price IDs (à créer dans Stripe)
STRIPE_PRICE_BASIC_SETUP=price_basic_setup_697
STRIPE_PRICE_BASIC_MONTHLY=price_basic_monthly_197
STRIPE_PRICE_PRO_SETUP=price_pro_setup_997
STRIPE_PRICE_PRO_MONTHLY=price_pro_monthly_347
STRIPE_PRICE_ENTERPRISE_SETUP=price_enterprise_setup_1497
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_enterprise_monthly_497

# Payment Links
STRIPE_LINK_BASIC=https://buy.stripe.com/XXXXX
STRIPE_LINK_PRO=https://buy.stripe.com/XXXXX
STRIPE_LINK_ENTERPRISE=https://buy.stripe.com/XXXXX
```

### Resend (Emails)
```env
RESEND_API_KEY=re_b76Nto6D_PDn4qpvedEccd8AWpPPpLVWm
RESEND_FROM_EMAIL=Bot Pulse <noreply@botpulse.com>
RESEND_SMTP_HOST=smtp.resend.com
RESEND_SMTP_PORT=587
```

### Google Places API
```env
GOOGLE_PLACES_API_KEY=AIzaSyDummyKeyHere
# Quota: 28,000 requêtes/mois gratuit
```

### ElevenLabs (Voix ultra-réaliste)
```env
ELEVENLABS_API_KEY=[À configurer]
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Rachel FR
ELEVENLABS_STABILITY=0.75
ELEVENLABS_SIMILARITY=0.85
```

### Discord Notifications
```env
DISCORD_WEBHOOK_URL=[À configurer]
```

### n8n Webhooks
```env
N8N_WEBHOOK_SECRET=[Générer un secret aléatoire]
N8N_BASE_URL=http://localhost:5678
```

---

## 🗄️ SCHÉMA DE BASE DE DONNÉES COMPLET

### Tables principales

#### `users` (Administrateurs)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

#### `prospects` (Leads prospectés)
```sql
CREATE TABLE prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Informations business
    business_name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100) NOT NULL CHECK (business_type IN ('restaurant', 'hotel', 'salon', 'service', 'ecommerce', 'medical', 'other')),
    sector VARCHAR(100),
    
    -- Localisation
    address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(10) DEFAULT 'BE',
    
    -- Contact
    phone VARCHAR(50),
    email VARCHAR(255),
    website TEXT,
    contact_name VARCHAR(255),
    
    -- Google Places
    google_place_id VARCHAR(255) UNIQUE,
    google_rating DECIMAL(2,1),
    google_reviews_count INTEGER,
    google_types TEXT[], -- Array de types
    
    -- Scoring & Qualification
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'qualified', 'converted', 'lost')),
    
    -- Appel VAPI
    last_call_date TIMESTAMP,
    call_duration INTEGER, -- secondes
    call_transcript TEXT,
    call_sentiment VARCHAR(20), -- positive, neutral, negative
    interest_level INTEGER CHECK (interest_level >= 0 AND interest_level <= 10),
    
    -- Besoins identifiés
    pain_points TEXT[],
    needs_identified JSONB,
    
    -- Suivi
    notes TEXT,
    next_action VARCHAR(255),
    next_action_date DATE,
    last_contact_date TIMESTAMP,
    assigned_to_user_id UUID REFERENCES users(id),
    
    -- Métadonnées
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Index
    CONSTRAINT chk_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX idx_prospects_status ON prospects(status);
CREATE INDEX idx_prospects_score ON prospects(score DESC);
CREATE INDEX idx_prospects_business_type ON prospects(business_type);
CREATE INDEX idx_prospects_city ON prospects(city);
CREATE INDEX idx_prospects_created_at ON prospects(created_at DESC);
CREATE INDEX idx_prospects_google_place_id ON prospects(google_place_id);
```

#### `calls` (Historique appels VAPI)
```sql
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    
    -- Infos appel VAPI
    vapi_call_id VARCHAR(255) UNIQUE,
    phone_number VARCHAR(50) NOT NULL,
    direction VARCHAR(20) CHECK (direction IN ('outbound', 'inbound')),
    
    -- Durée & Status
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    status VARCHAR(50) CHECK (status IN ('queued', 'ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer', 'canceled')),
    
    -- Transcription & Analyse
    transcript TEXT,
    summary TEXT,
    sentiment VARCHAR(20),
    interest_level INTEGER CHECK (interest_level >= 0 AND interest_level <= 10),
    
    -- Données extraites
    email_collected VARCHAR(255),
    needs_mentioned TEXT[],
    objections TEXT[],
    budget_mentioned VARCHAR(100),
    timeline_mentioned VARCHAR(100),
    decision_maker_reached BOOLEAN DEFAULT false,
    
    -- Résultat
    outcome VARCHAR(50) CHECK (outcome IN ('qualified', 'not_interested', 'callback_later', 'wrong_number', 'voicemail', 'technical_issue')),
    recommended_package VARCHAR(20) CHECK (recommended_package IN ('basic', 'pro', 'enterprise')),
    next_action VARCHAR(255),
    
    -- Enregistrement
    recording_url TEXT,
    
    -- Métadonnées
    cost DECIMAL(10,4), -- Coût en EUR
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX idx_calls_prospect ON calls(prospect_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX idx_calls_vapi_id ON calls(vapi_call_id);
```

#### `quotes` (Devis générés)
```sql
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    
    -- Package
    package_type VARCHAR(20) NOT NULL CHECK (package_type IN ('basic', 'pro', 'enterprise')),
    
    -- Prix
    setup_fee DECIMAL(10,2) NOT NULL,
    monthly_fee DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    
    -- Features incluses
    features_included JSONB NOT NULL, -- Array de features
    
    -- Validité
    valid_until DATE NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'expired', 'rejected')),
    
    -- Tracking
    sent_at TIMESTAMP,
    viewed_at TIMESTAMP,
    accepted_at TIMESTAMP,
    
    -- Stripe
    stripe_payment_link TEXT,
    
    -- Métadonnées
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE INDEX idx_quotes_prospect ON quotes(prospect_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_valid_until ON quotes(valid_until);
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
```

#### `clients` (Clients actifs)
```sql
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Référence
    prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    
    -- Infos business
    business_name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100) NOT NULL,
    sector VARCHAR(100),
    
    -- Contact principal
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    
    -- Adresse
    address TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(10) DEFAULT 'BE',
    
    -- Package & Facturation
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('basic', 'pro', 'enterprise')),
    setup_fee DECIMAL(10,2) NOT NULL,
    monthly_fee DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    
    -- Stripe
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    subscription_status VARCHAR(50) DEFAULT 'active' CHECK (subscription_status IN ('active', 'paused', 'past_due', 'canceled', 'incomplete')),
    
    -- VAPI Configuration
    vapi_assistant_id VARCHAR(255),
    vapi_phone_number VARCHAR(50),
    vapi_config JSONB, -- Configuration complète de l'assistant
    
    -- Onboarding
    onboarding_status VARCHAR(50) DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'in_progress', 'completed', 'failed')),
    onboarding_completed_at TIMESTAMP,
    
    -- Dates importantes
    activation_date TIMESTAMP,
    cancellation_date TIMESTAMP,
    
    -- Usage & Analytics
    total_calls_made INTEGER DEFAULT 0,
    monthly_calls_quota INTEGER,
    last_call_date TIMESTAMP,
    
    -- Métadonnées
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_status ON clients(subscription_status);
CREATE INDEX idx_clients_plan ON clients(plan_type);
CREATE INDEX idx_clients_stripe_customer ON clients(stripe_customer_id);
CREATE INDEX idx_clients_onboarding ON clients(onboarding_status);
CREATE INDEX idx_clients_created_at ON clients(created_at DESC);
```

#### `campaigns` (Campagnes d'emails)
```sql
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Configuration
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'email' CHECK (type IN ('email', 'sms', 'mixed')),
    
    -- Ciblage
    target_business_types TEXT[], -- Array: ['restaurant', 'hotel']
    target_cities TEXT[],
    target_min_score INTEGER,
    target_max_score INTEGER,
    target_statuses TEXT[], -- Array: ['interested', 'qualified']
    
    -- Contenu
    subject_line VARCHAR(255),
    message_template TEXT NOT NULL, -- Avec variables: {{business_name}}, {{contact_name}}, etc.
    
    -- Planning
    scheduled_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'canceled')),
    
    -- Statistiques
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    
    -- Métadonnées
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_scheduled_date ON campaigns(scheduled_date);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);
```

#### `campaign_sends` (Envois individuels)
```sql
CREATE TABLE campaign_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    
    -- Envoi
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    
    -- Tracking
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    replied_at TIMESTAMP,
    bounced_at TIMESTAMP,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed')),
    
    -- Erreurs
    error_message TEXT,
    
    -- Tracking IDs
    message_id VARCHAR(255), -- Resend message ID
    
    UNIQUE(campaign_id, prospect_id)
);

CREATE INDEX idx_campaign_sends_campaign ON campaign_sends(campaign_id);
CREATE INDEX idx_campaign_sends_prospect ON campaign_sends(prospect_id);
CREATE INDEX idx_campaign_sends_status ON campaign_sends(status);
CREATE INDEX idx_campaign_sends_sent_at ON campaign_sends(sent_at DESC);
```

#### `reminders` (Relances automatiques)
```sql
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Cible
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('prospect', 'quote', 'client')),
    target_id UUID NOT NULL,
    
    -- Type de relance
    reminder_type VARCHAR(50) NOT NULL CHECK (reminder_type IN ('quote_followup_d1', 'quote_followup_d3', 'quote_followup_d7', 'payment_failed', 'callback_3months')),
    
    -- Planning
    scheduled_at TIMESTAMP NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'canceled')),
    sent_at TIMESTAMP,
    
    -- Résultat
    result TEXT,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reminders_scheduled ON reminders(scheduled_at, status);
CREATE INDEX idx_reminders_target ON reminders(target_type, target_id);
CREATE INDEX idx_reminders_status ON reminders(status);
```

#### `payments` (Historique paiements)
```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    
    -- Stripe
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_invoice_id VARCHAR(255),
    
    -- Montant
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    
    -- Type
    payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('setup_fee', 'monthly_subscription', 'upgrade', 'one_time')),
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'disputed')),
    
    -- Dates
    paid_at TIMESTAMP,
    failed_at TIMESTAMP,
    refunded_at TIMESTAMP,
    
    -- Métadonnées
    description TEXT,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE INDEX idx_payments_client ON payments(client_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_stripe_payment_intent ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_paid_at ON payments(paid_at DESC);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
```

#### `webhook_logs` (Logs des webhooks)
```sql
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source
    source VARCHAR(50) NOT NULL CHECK (source IN ('n8n', 'vapi', 'stripe', 'resend')),
    event_type VARCHAR(100) NOT NULL,
    
    -- Données
    payload JSONB NOT NULL,
    headers JSONB,
    
    -- Processing
    status VARCHAR(50) DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
    processed_at TIMESTAMP,
    
    -- Erreurs
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Métadonnées
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
```

#### `analytics_daily` (Statistiques quotidiennes)
```sql
CREATE TABLE analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    
    -- Prospection
    prospects_added INTEGER DEFAULT 0,
    prospects_contacted INTEGER DEFAULT 0,
    prospects_qualified INTEGER DEFAULT 0,
    
    -- Appels
    calls_made INTEGER DEFAULT 0,
    calls_successful INTEGER DEFAULT 0,
    calls_failed INTEGER DEFAULT 0,
    total_call_duration INTEGER DEFAULT 0, -- secondes
    
    -- Conversion
    quotes_sent INTEGER DEFAULT 0,
    quotes_accepted INTEGER DEFAULT 0,
    new_clients INTEGER DEFAULT 0,
    
    -- Revenus
    revenue_setup_fees DECIMAL(10,2) DEFAULT 0,
    revenue_subscriptions DECIMAL(10,2) DEFAULT 0,
    
    -- Coûts
    cost_vapi_calls DECIMAL(10,2) DEFAULT 0,
    cost_apis DECIMAL(10,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_date ON analytics_daily(date DESC);
```

---

## 🔄 WORKFLOW COMPLET DÉTAILLÉ

### PHASE 1 : PROSPECTION AUTOMATIQUE (10-30 leads/jour)

**Déclencheur : Tous les jours à 9h (lun-ven)**

1. **Recherche Google Places**
   - Types : restaurant, hotel, beauty_salon, spa, gym, medical
   - Zones : Bruxelles, Anvers, Gand, Liège, Namur, Charleroi
   - Radius : 5000m par recherche
   - Max : 20 résultats par recherche

2. **Extraction données**
   ```javascript
   {
     business_name: place.name,
     business_type: detectType(place.types),
     address: place.formatted_address,
     city: extractCity(place.address_components),
     phone: place.formatted_phone_number,
     website: place.website,
     google_place_id: place.place_id,
     google_rating: place.rating,
     google_reviews_count: place.user_ratings_total,
     google_types: place.types
   }
   ```

3. **Scoring automatique (0-100)**
   ```javascript
   score = 0;
   
   // Rating (max 30 points)
   if (rating) score += rating * 6;
   
   // Reviews (max 20 points)
   if (reviews_count) score += Math.min(reviews_count / 10, 20);
   
   // Website (15 points)
   if (website) score += 15;
   
   // Phone (15 points)
   if (phone) score += 15;
   
   // Type prioritaire (20 points)
   if (['restaurant', 'hotel'].includes(business_type)) {
     score += 20;
   } else {
     score += 10;
   }
   ```

4. **Dédoublonnage**
   - Vérifier `google_place_id` n'existe pas déjà
   - Si existe : skip
   - Si nouveau : INSERT dans `prospects`

5. **Status initial**
   - status = 'new'
   - next_action = 'call'
   - next_action_date = TODAY

### PHASE 2 : QUALIFICATION PAR APPELS IA (50 appels/jour)

**Déclencheur : Toutes les 20 minutes (9h-19h, lun-ven)**

1. **Sélection prospect à appeler**
   ```sql
   SELECT * FROM prospects 
   WHERE status = 'new' 
   AND phone IS NOT NULL
   AND (last_call_date IS NULL OR last_call_date < NOW() - INTERVAL '90 days')
   ORDER BY score DESC
   LIMIT 1;
   ```

2. **Appel VAPI avec Marie**
   
   **System Prompt complet :**
   ```
   Tu es Marie, conseillère commerciale senior chez Bot Pulse, spécialiste en solutions de réceptionniste virtuelle IA.

   IDENTITÉ:
   - Prénom: Marie
   - Poste: Conseillère Commerciale Senior
   - Entreprise: Bot Pulse
   - Expertise: Solutions de réceptionniste IA pour commerces et restaurants
   - Personnalité: Professionnelle, chaleureuse, à l'écoute, pas pushy
   - Ton: Naturel, conversationnel, jamais robotique
   - Accent: Français standard, prononciation claire

   CONTEXTE ACTUEL:
   - Tu appelles: {{business_name}}
   - Type: {{business_type}}
   - Ville: {{city}}
   - Rating Google: {{google_rating}}/5 ({{google_reviews_count}} avis)

   OBJECTIF:
   Qualifier le prospect et l'intéresser à une démonstration gratuite de notre réceptionniste IA.
   Tu NE vends PAS directement, tu QUALIFIES et DÉMONTRES la valeur.

   CE QUE TU VENDS:
   Bot Pulse propose des réceptionnistes virtuelles IA qui:
   - Répondent aux appels 24h/24 et 7j/7
   - Prennent les réservations automatiquement
   - Répondent aux questions fréquentes (horaires, menu, prix, services)
   - Transfèrent les appels urgents à l'équipe
   - Rappellent les clients automatiquement
   - Enregistrent tous les messages
   - S'intègrent avec les systèmes existants

   PACKAGES DISPONIBLES:
   - BASIC (197€/mois): Réceptionniste IA 24/7, réservations, FAQ
   - PRO (347€/mois): BASIC + qualification prospects + analytics
   - ENTERPRISE (497€/mois): PRO + multi-langues + intégrations avancées

   DÉROULEMENT DE L'APPEL:

   1. OUVERTURE (15-20 secondes)
   "Bonjour, je suis Marie, conseillère commerciale de Bot Pulse. Je vous appelle concernant une solution qui pourrait vraiment transformer la gestion de vos appels clients. Vous êtes bien Monsieur ou Madame le gérant ?"

   2. ACCROCHE (si pas le gérant)
   "Pourriez-vous me passer le gérant s'il vous plaît ? C'est important."
   
   3. PITCH (30-45 secondes)
   "Je vais être directe: nous aidons des [type d'établissement] comme le vôtre à ne plus jamais manquer un appel client, même pendant les heures de pointe ou la nuit.
   
   Notre réceptionniste IA prend les réservations, répond aux questions sur le menu et les horaires, et transfère les urgences vers vous.
   
   C'est comme avoir une employée à plein temps, mais disponible 24/7 pour 10 fois moins cher."

   4. QUESTIONS DE QUALIFICATION
   
   Question 1 (Pain Point):
   "Actuellement, comment gérez-vous les appels quand vous êtes débordés ?"
   → Écoute: appels manqués, frustration, perte de clients
   
   Question 2 (Volume):
   "Environ combien d'appels recevez-vous par jour ?"
   → Moins de 20: BASIC / 20-50: PRO / 50+: PREMIUM
   
   Question 3 (Système actuel):
   "Utilisez-vous déjà un système de réservation en ligne ou tout est par téléphone ?"
   → Comprendre niveau de digitalisation
   
   Question 4 (Budget):
   "Avez-vous déjà un budget alloué pour améliorer la gestion de vos appels ?"
   → Si oui: très qualifié / Si non: éduquer sur ROI

   Question 5 (Urgence):
   "Sur une échelle de 1 à 10, à quel point est-ce une priorité pour vous de résoudre ce problème ?"
   → Score d'intérêt

   5. COLLECTE EMAIL
   "Je comprends parfaitement votre situation. Ce que je vous propose, c'est de vous envoyer un devis personnalisé par email avec tous les détails et même une démonstration vidéo.
   
   Quelle est votre meilleure adresse email ?"

   6. PROPOSITION PACKAGE
   Selon les réponses:
   - Petit volume + budget limité → BASIC
   - Volume moyen + veut analytics → PRO
   - Gros volume + besoins avancés → ENTERPRISE

   "Vu votre volume d'appels et vos besoins, je pense que notre package [BASIC/PRO/ENTERPRISE] serait parfait pour vous.
   
   L'installation coûte [697€/997€/1497€] une seule fois, puis c'est [197€/347€/497€] par mois.
   
   Pour vous donner une idée, si vous manquez ne serait-ce que 5 réservations par mois à cause d'appels manqués, ça vous coûte bien plus cher que notre solution."

   7. CLÔTURE
   
   Si INTÉRESSÉ (score ≥ 7/10):
   "Parfait ! Vous allez recevoir le devis par email dans les 2 minutes avec un lien de paiement sécurisé. Vous pourrez aussi planifier une démo gratuite si vous voulez voir le système en action.
   
   Merci pour votre temps et à très bientôt !"
   
   Si PAS INTÉRESSÉ (score < 7/10):
   "Je comprends, peut-être que ce n'est pas le bon moment. Puis-je vous rappeler dans 3 mois au cas où votre situation évolue ?"
   
   Si NON DÉCIDEUR:
   "D'accord, pourriez-vous transmettre mon nom et numéro au gérant ? C'est Marie de Bot Pulse, il peut me rappeler au [votre numéro]."

   RÈGLES IMPORTANTES:

   LANGAGE:
   - Phrases courtes (max 15-20 mots)
   - Éviter le jargon technique
   - Utiliser "vous" et éviter "tu"
   - Sourire dans la voix (ton positif)
   - Pauses naturelles après les questions
   - Pas de "euh", "genre", "en fait"

   GESTION OBJECTIONS:

   Objection 1: "C'est trop cher"
   → "Je comprends. Mais combien vous coûte un client perdu à cause d'un appel manqué ? Notre système se rembourse en quelques réservations par mois."

   Objection 2: "On a déjà quelqu'un qui répond"
   → "C'est super ! Notre solution ne remplace pas votre équipe, elle la complète. Elle gère les appels pendant la nuit, les weekends, et quand vous êtes débordés."

   Objection 3: "Je dois réfléchir"
   → "Bien sûr ! C'est pour ça que je vous envoie le devis par email avec tous les détails. Vous pourrez prendre le temps de regarder tranquillement."

   Objection 4: "Ça marche vraiment avec une IA ?"
   → "Excellente question ! Nos clients sont bluffés. L'IA comprend le contexte, pose les bonnes questions, et si c'est vraiment complexe, elle transfère vers vous. Je peux vous montrer une démo ?"

   Objection 5: "Je n'ai pas le temps maintenant"
   → "Pas de problème ! Je vous envoie le devis par email et vous me dites quand vous voulez en discuter. Quelle est votre adresse email ?"

   FIN D'APPEL:
   - Maximum 5 minutes par appel
   - Si la personne veut raccrocher: laisser partir poliment
   - Si conversation s'éternise: recentrer sur l'objectif (envoyer devis)
   - Toujours finir sur une note positive

   DONNÉES À EXTRAIRE:
   - Nom du contact
   - Email (CRUCIAL)
   - Volume d'appels quotidien
   - Budget disponible (oui/non/à discuter)
   - Niveau d'intérêt (1-10)
   - Pain points mentionnés
   - Objections soulevées
   - Package recommandé
   - Décision: démo/devis/rappel/refus
   ```

   **First Message :**
   ```
   Bonjour, je suis Marie, conseillère commerciale de Bot Pulse. Je vous appelle concernant une solution qui pourrait vraiment transformer la gestion de vos appels clients. Vous êtes bien Monsieur ou Madame le gérant ?
   ```

   **Configuration voix :**
   ```json
   {
     "provider": "11labs",
     "voiceId": "21m00Tcm4TlvDq8ikWAM",
     "stability": 0.75,
     "similarityBoost": 0.85,
     "style": 0.6,
     "useSpeakerBoost": true
   }
   ```

3. **Pendant l'appel : Notifications Discord**
   ```
   📞 APPEL EN COURS
   
   Prospect: La Bonne Table
   Secteur: Restaurant
   Tel: +32 2 123 45 67
   Status: Marie parle...
   ```

4. **Analyse du transcript après appel**
   
   Utiliser GPT-4 pour extraire :
   ```javascript
   {
     contact_name: "Jean Dupont",
     email: "jean@labonnetable.be",
     interest_level: 8,
     pain_points: ["Appels manqués le soir", "Débordé weekend"],
     daily_calls_volume: 30,
     budget_available: "yes",
     timeline: "immediate",
     objections: ["Prix", "Confiance en IA"],
     recommended_package: "pro",
     decision_maker: true,
     outcome: "qualified",
     next_action: "send_quote"
   }
   ```

5. **Mise à jour prospect**
   ```sql
   UPDATE prospects SET
     status = CASE 
       WHEN interest_level >= 7 THEN 'qualified'
       WHEN interest_level >= 4 THEN 'interested'
       ELSE 'contacted'
     END,
     email = COALESCE(email, collected_email),
     contact_name = COALESCE(contact_name, extracted_name),
     interest_level = extracted_interest_level,
     pain_points = extracted_pain_points,
     last_call_date = NOW(),
     next_action = CASE
       WHEN interest_level >= 7 THEN 'send_quote'
       WHEN interest_level >= 4 THEN 'callback_7days'
       ELSE 'callback_3months'
     END
   WHERE id = prospect_id;
   ```

6. **Si intéressé (score ≥ 7) : Envoi automatique du devis**

### PHASE 3 : GÉNÉRATION ET ENVOI DEVIS

**Déclencheur : Immédiatement après qualification positive**

1. **Création du devis**
   ```sql
   INSERT INTO quotes (
     prospect_id,
     package_type,
     setup_fee,
     monthly_fee,
     features_included,
     valid_until,
     status,
     stripe_payment_link
   ) VALUES (
     prospect_id,
     recommended_package,
     CASE recommended_package
       WHEN 'basic' THEN 697
       WHEN 'pro' THEN 997
       WHEN 'enterprise' THEN 1497
     END,
     CASE recommended_package
       WHEN 'basic' THEN 197
       WHEN 'pro' THEN 347
       WHEN 'enterprise' THEN 497
     END,
     features_json,
     CURRENT_DATE + INTERVAL '7 days',
     'sent',
     stripe_link
   );
   ```

2. **Template Email HTML Complet**
   ```html
   <!DOCTYPE html>
   <html lang="fr">
   <head>
       <meta charset="UTF-8">
       <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <title>Votre Devis Bot Pulse</title>
       <style>
           body {
               font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
               line-height: 1.6;
               color: #333;
               background-color: #f4f4f4;
               margin: 0;
               padding: 0;
           }
           .container {
               max-width: 600px;
               margin: 20px auto;
               background: #ffffff;
               border-radius: 10px;
               overflow: hidden;
               box-shadow: 0 4px 6px rgba(0,0,0,0.1);
           }
           .header {
               background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
               color: white;
               padding: 40px 30px;
               text-align: center;
           }
           .header h1 {
               margin: 0;
               font-size: 28px;
               font-weight: 700;
           }
           .header p {
               margin: 10px 0 0;
               font-size: 16px;
               opacity: 0.9;
           }
           .content {
               padding: 40px 30px;
           }
           .greeting {
               font-size: 18px;
               margin-bottom: 20px;
           }
           .package-box {
               background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
               color: white;
               padding: 30px;
               border-radius: 10px;
               margin: 30px 0;
               text-align: center;
           }
           .package-box h2 {
               margin: 0 0 15px;
               font-size: 24px;
               font-weight: 700;
           }
           .price {
               font-size: 48px;
               font-weight: 700;
               margin: 15px 0;
           }
           .price-sub {
               font-size: 16px;
               opacity: 0.9;
           }
           .features {
               background: #f8f9fa;
               border-left: 4px solid #667eea;
               padding: 20px;
               margin: 20px 0;
               border-radius: 5px;
           }
           .features ul {
               list-style: none;
               padding: 0;
               margin: 0;
           }
           .features li {
               padding: 10px 0;
               border-bottom: 1px solid #e9ecef;
           }
           .features li:last-child {
               border-bottom: none;
           }
           .features li:before {
               content: "✅ ";
               margin-right: 10px;
           }
           .cta-button {
               display: inline-block;
               background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
               color: white;
               padding: 18px 45px;
               text-decoration: none;
               border-radius: 30px;
               font-weight: 700;
               font-size: 18px;
               margin: 25px 0;
               box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
               transition: transform 0.2s;
           }
           .cta-button:hover {
               transform: translateY(-2px);
           }
           .urgency {
               background: #fff3cd;
               border: 1px solid #ffc107;
               color: #856404;
               padding: 15px;
               border-radius: 5px;
               margin: 20px 0;
               text-align: center;
               font-weight: 600;
           }
           .footer {
               background: #f8f9fa;
               padding: 30px;
               text-align: center;
               color: #666;
               font-size: 14px;
               border-top: 1px solid #e9ecef;
           }
           .signature {
               margin-top: 30px;
               padding-top: 20px;
               border-top: 2px solid #e9ecef;
           }
           @media only screen and (max-width: 600px) {
               .container {
                   margin: 10px;
               }
               .header {
                   padding: 30px 20px;
               }
               .content {
                   padding: 30px 20px;
               }
               .price {
                   font-size: 36px;
               }
           }
       </style>
   </head>
   <body>
       <div class="container">
           <!-- Header -->
           <div class="header">
               <h1>🤖 Bot Pulse</h1>
               <p>Votre Réceptionniste IA 24/7</p>
           </div>
           
           <!-- Content -->
           <div class="content">
               <p class="greeting">Bonjour {{contact_name}},</p>
               
               <p>Suite à notre conversation téléphonique, voici votre <strong>devis personnalisé</strong> pour <strong>{{business_name}}</strong>.</p>
               
               <!-- Package Box -->
               <div class="package-box">
                   <h2>📦 PACKAGE {{package_name}}</h2>
                   <div class="price">{{monthly_price}}€<span class="price-sub">/mois</span></div>
                   <p class="price-sub">Installation unique: <strong>{{setup_price}}€</strong></p>
               </div>
               
               <!-- Features -->
               <div class="features">
                   <h3 style="margin-top: 0;">✨ Fonctionnalités incluses :</h3>
                   <ul>
                       {{#features}}
                       <li>{{this}}</li>
                       {{/features}}
                   </ul>
               </div>
               
               <!-- Urgency -->
               <div class="urgency">
                   ⏰ Cette offre est valable jusqu'au {{valid_until_formatted}}
               </div>
               
               <!-- CTA -->
               <div style="text-align: center;">
                   <a href="{{payment_link}}" class="cta-button">💳 Finaliser mon inscription</a>
               </div>
               
               <p style="margin-top: 30px;">Notre équipe technique configurera votre réceptionniste IA dans les <strong>48 heures</strong> après validation du paiement.</p>
               
               <p>Des questions ? Répondez simplement à cet email, je serai ravie de vous aider !</p>
               
               <!-- Signature -->
               <div class="signature">
                   <p style="margin: 5px 0;"><strong>Marie</strong></p>
                   <p style="margin: 5px 0; color: #666;">Conseillère Commerciale Senior</p>
                   <p style="margin: 5px 0; color: #667eea;"><strong>Bot Pulse</strong></p>
               </div>
           </div>
           
           <!-- Footer -->
           <div class="footer">
               <p style="margin: 5px 0;">Bot Pulse - Votre assistant IA téléphonique</p>
               <p style="margin: 5px 0; font-size: 12px;">
                   <a href="{{unsubscribe_link}}" style="color: #666; text-decoration: none;">Se désinscrire</a>
               </p>
           </div>
       </div>
       
       <!-- Tracking Pixel -->
       <img src="{{tracking_pixel_url}}" width="1" height="1" style="display:none;" alt="">
   </body>
   </html>
   ```

3. **Variables template par package**
   
   **BASIC :**
   ```javascript
   {
     package_name: "BASIC",
     monthly_price: 197,
     setup_price: 697,
     features: [
       "Réceptionniste IA disponible 24h/24, 7j/7",
       "Prise de réservations automatique",
       "Réponses aux questions fréquentes (horaires, menu, prix)",
       "Transfert des appels urgents vers votre équipe",
       "Enregistrement de tous les messages",
       "Dashboard de suivi en temps réel",
       "Support technique par email",
       "200 appels inclus par mois"
     ]
   }
   ```
   
   **PRO :**
   ```javascript
   {
     package_name: "PRO",
     monthly_price: 347,
     setup_price: 997,
     features: [
       "✨ Tout du package BASIC, plus:",
       "Qualification automatique des prospects",
       "Analytics détaillés (taux de conversion, sources, etc.)",
       "Collecte d'emails et données clients",
       "Rappels automatiques aux clients",
       "Intégration avec votre système de réservation",
       "Support technique prioritaire (téléphone + email)",
       "500 appels inclus par mois"
     ]
   }
   ```
   
   **ENTERPRISE :**
   ```javascript
   {
     package_name: "ENTERPRISE",
     monthly_price: 497,
     setup_price: 1497,
     features: [
       "🌟 Tout du package PRO, plus:",
       "Support multi-langues (FR, EN, NL, ES)",
       "Intégrations avancées (CRM, POS, Google Calendar)",
       "Assistant personnalisé pour votre secteur",
       "Formation de votre équipe (2h)",
       "Optimisation continue basée sur vos données",
       "Account manager dédié",
       "Support 24/7 (téléphone, email, chat)",
       "1000 appels inclus par mois"
     ]
   }
   ```

4. **Envoi via Resend**
   ```python
   await resend.emails.send({
     "from": "Marie - Bot Pulse <marie@botpulse.com>",
     "to": prospect_email,
     "subject": f"Votre devis Bot Pulse - {business_name}",
     "html": rendered_template,
     "headers": {
       "X-Entity-Ref-ID": quote_id
     },
     "tags": [
       {"name": "campaign", "value": "quote"},
       {"name": "package", "value": package_type}
     ]
   })
   ```

5. **Créer reminder automatique**
   ```sql
   -- J+1
   INSERT INTO reminders (target_type, target_id, reminder_type, scheduled_at)
   VALUES ('quote', quote_id, 'quote_followup_d1', NOW() + INTERVAL '1 day');
   
   -- J+3
   INSERT INTO reminders (target_type, target_id, reminder_type, scheduled_at)
   VALUES ('quote', quote_id, 'quote_followup_d3', NOW() + INTERVAL '3 days');
   
   -- J+7
   INSERT INTO reminders (target_type, target_id, reminder_type, scheduled_at)
   VALUES ('quote', quote_id, 'quote_followup_d7', NOW() + INTERVAL '7 days');
   ```

6. **Notification Discord**
   ```
   ✅ PROSPECT QUALIFIÉ !
   
   Commerce: La Bonne Table
   Contact: Jean Dupont
   Email: jean@labonnetable.be
   Package: PRO (249€/mois)
   Intérêt: 8/10
   
   Devis envoyé: ✅
   Lien paiement: https://buy.stripe.com/xxxxx
   ```

### PHASE 4 : RELANCES AUTOMATIQUES

**Déclencheur : Cron toutes les heures**

1. **Sélectionner reminders à envoyer**
   ```sql
   SELECT * FROM reminders
   WHERE status = 'pending'
   AND scheduled_at <= NOW()
   ORDER BY scheduled_at ASC
   LIMIT 50;
   ```

2. **Template relance J+1**
   ```html
   <!DOCTYPE html>
   <html lang="fr">
   <head>
       <meta charset="UTF-8">
       <style>
           /* Styles similaires au devis */
       </style>
   </head>
   <body>
       <div class="container">
           <div class="header">
               <h1>🤖 Bot Pulse</h1>
           </div>
           
           <div class="content">
               <p>Bonjour {{contact_name}},</p>
               
               <p>Je voulais m'assurer que vous aviez bien reçu notre proposition pour <strong>{{business_name}}</strong>.</p>
               
               <p><strong>Votre offre est toujours disponible.</strong></p>
               
               <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                   <p style="margin: 0;">📦 Package {{package_name}}: <strong>{{monthly_price}}€/mois</strong></p>
                   <p style="margin: 10px 0 0;">Installation: {{setup_price}}€ (unique)</p>
               </div>
               
               <p>Pour rappel, notre réceptionniste IA vous permet de ne plus jamais rater un appel client, même pendant les heures de pointe ou la nuit.</p>
               
               <div style="text-align: center; margin: 30px 0;">
                   <a href="{{payment_link}}" class="cta-button">💳 Voir mon offre</a>
               </div>
               
               <p>Des questions ? Je suis là pour vous aider !</p>
               
               <p>Marie<br>Bot Pulse</p>
           </div>
       </div>
   </body>
   </html>
   ```

3. **Template relance J+3**
   ```html
   <!-- Header similar -->
   <div class="content">
       <p>Bonjour {{contact_name}},</p>
       
       <p>Je revenais vers vous concernant votre projet de réceptionniste IA pour <strong>{{business_name}}</strong>.</p>
       
       <div class="urgency">
           ⏰ Plus que 4 jours pour profiter de cette offre !
       </div>
       
       <p>Je comprends que vous avez peut-être des questions. N'hésitez pas à me répondre directement, je serai ravie d'en discuter avec vous.</p>
       
       <p><strong>Quelques chiffres de nos clients :</strong></p>
       <ul>
           <li>✅ 95% de satisfaction client</li>
           <li>✅ En moyenne 40 appels manqués évités par mois</li>
           <li>✅ ROI positif dès le 2ème mois</li>
       </ul>
       
       <div style="text-align: center; margin: 30px 0;">
           <a href="{{payment_link}}" class="cta-button">Je finalise mon inscription</a>
       </div>
       
       <p>À très bientôt,<br>Marie</p>
   </div>
   ```

4. **Template relance J+7 (dernier jour)**
   ```html
   <!-- Header similar -->
   <div class="content">
       <p>Bonjour {{contact_name}},</p>
       
       <div class="urgency" style="background: #f8d7da; border-color: #dc3545; color: #721c24;">
           🚨 DERNIÈRE CHANCE - Votre offre expire aujourd'hui !
       </div>
       
       <p>C'est le dernier jour pour bénéficier de votre offre personnalisée pour <strong>{{business_name}}</strong>.</p>
       
       <p>Je ne veux pas que vous passiez à côté de cette opportunité. Nos clients constatent en moyenne <strong>une augmentation de 25% de leurs réservations</strong> grâce à notre réceptionniste IA.</p>
       
       <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 10px; text-align: center; margin: 25px 0;">
           <h2 style="margin: 0 0 15px;">Package {{package_name}}</h2>
           <p style="font-size: 36px; font-weight: 700; margin: 0;">{{monthly_price}}€<span style="font-size: 16px;">/mois</span></p>
           <p style="margin: 10px 0 0;">Installation: {{setup_price}}€</p>
       </div>
       
       <div style="text-align: center; margin: 30px 0;">
           <a href="{{payment_link}}" class="cta-button">Je profite de l'offre maintenant</a>
       </div>
       
       <p style="color: #dc3545; font-weight: 600;">⚠️ Cette offre ne sera plus disponible après aujourd'hui.</p>
       
       <p>Marie<br>Bot Pulse</p>
   </div>
   ```

5. **Rappel 3 mois (pour prospects non convertis)**
   ```html
   <!-- Header similar -->
   <div class="content">
       <p>Bonjour {{contact_name}},</p>
       
       <p>Nous nous étions parlé il y a 3 mois concernant une solution de réceptionniste IA pour <strong>{{business_name}}</strong>.</p>
       
       <p>Je voulais savoir si votre situation avait évolué et si vous seriez toujours intéressé par une démonstration gratuite de notre système ?</p>
       
       <p><strong>Quelques nouveautés depuis notre dernier échange :</strong></p>
       <ul>
           <li>✨ Nouveau système de rappels automatiques SMS</li>
           <li>✨ Intégration directe avec Google Calendar</li>
           <li>✨ Application mobile pour suivre vos appels en temps réel</li>
       </ul>
       
       <p>Si vous êtes intéressé, je peux vous envoyer une nouvelle proposition adaptée à vos besoins actuels.</p>
       
       <div style="text-align: center; margin: 30px 0;">
           <a href="mailto:marie@botpulse.com?subject=Rappel%20{{business_name}}" class="cta-button">Oui, je suis intéressé</a>
       </div>
       
       <p>Sinon, pas de problème ! N'hésitez pas à revenir vers moi si le besoin se présente à l'avenir.</p>
       
       <p>Marie<br>Bot Pulse</p>
   </div>
   ```

### PHASE 5 : WEBHOOK STRIPE → ONBOARDING AUTOMATIQUE

**Déclencheur : `checkout.session.completed` de Stripe**

1. **Réception webhook Stripe**
   ```python
   @app.post("/api/webhooks/stripe")
   async def stripe_webhook(request: Request):
       payload = await request.body()
       sig_header = request.headers.get('stripe-signature')
       
       try:
           event = stripe.Webhook.construct_event(
               payload, sig_header, STRIPE_WEBHOOK_SECRET
           )
       except Exception as e:
           return {"error": str(e)}, 400
       
       # Log webhook
       await db.webhook_logs.insert({
           "source": "stripe",
           "event_type": event.type,
           "payload": event.data.object,
           "status": "received"
       })
       
       if event.type == 'checkout.session.completed':
           await handle_payment_success(event.data.object)
       
       return {"received": True}
   ```

2. **Création du client**
   ```python
   async def handle_payment_success(session):
       # Récupérer metadata
       quote_id = session.metadata.get('quote_id')
       quote = await db.quotes.find_one({"id": quote_id})
       prospect = await db.prospects.find_one({"id": quote.prospect_id})
       
       # Créer le client
       client = await db.clients.insert({
           "prospect_id": prospect.id,
           "quote_id": quote.id,
           "business_name": prospect.business_name,
           "business_type": prospect.business_type,
           "contact_name": prospect.contact_name,
           "contact_email": prospect.email,
           "contact_phone": prospect.phone,
           "plan_type": quote.package_type,
           "setup_fee": quote.setup_fee,
           "monthly_fee": quote.monthly_fee,
           "stripe_customer_id": session.customer,
           "subscription_status": "active",
           "onboarding_status": "pending",
           "activation_date": datetime.now()
       })
       
       # Créer la subscription Stripe
       subscription = stripe.Subscription.create(
           customer=session.customer,
           items=[{
               "price": get_price_id(quote.package_type, "monthly")
           }],
           metadata={
               "client_id": client.id,
               "business_name": prospect.business_name
           }
       )
       
       await db.clients.update(
           {"id": client.id},
           {"stripe_subscription_id": subscription.id}
       )
       
       # Lancer onboarding automatique
       await onboard_client_automatically(client)
   ```

3. **Création automatique assistant VAPI pour le client**
   ```python
   async def onboard_client_automatically(client):
       try:
           # Mettre à jour status
           await db.clients.update(
               {"id": client.id},
               {"onboarding_status": "in_progress"}
           )
           
           # 1. Créer l'assistant VAPI personnalisé
           assistant = await vapi_client.create_assistant({
               "name": f"Réceptionniste - {client.business_name}",
               "model": {
                   "provider": "openai",
                   "model": "gpt-4-turbo",
                   "temperature": 0.7,
                   "messages": [{
                       "role": "system",
                       "content": generate_client_system_prompt(client)
                   }]
               },
               "voice": {
                   "provider": "11labs",
                   "voiceId": "21m00Tcm4TlvDq8ikWAM",
                   "stability": 0.75,
                   "similarityBoost": 0.85
               },
               "firstMessage": f"Bonjour, {client.business_name}, comment puis-je vous aider ?",
               "serverUrl": f"{BASE_URL}/api/webhooks/vapi/client/{client.id}",
               "endCallFunctionEnabled": True,
               "recordingEnabled": True
           })
           
           # 2. Acheter un numéro de téléphone
           phone_number = await vapi_client.buy_phone_number({
               "country": "BE",  # Belgique
               "assistantId": assistant.id
           })
           
           # 3. Sauvegarder la config
           await db.clients.update(
               {"id": client.id},
               {
                   "vapi_assistant_id": assistant.id,
                   "vapi_phone_number": phone_number.number,
                   "vapi_config": {
                       "assistant_id": assistant.id,
                       "phone_number": phone_number.number,
                       "webhook_url": f"{BASE_URL}/api/webhooks/vapi/client/{client.id}"
                   },
                   "onboarding_status": "completed",
                   "onboarding_completed_at": datetime.now()
               }
           )
           
           # 4. Envoyer email de bienvenue avec config
           await send_welcome_email(client, phone_number.number)
           
           # 5. Notifier Discord
           await discord_notify(f"""
           🎉 NOUVELLE VENTE !
           
           Client: {client.business_name}
           Package: {client.plan_type.upper()}
           MRR: {client.monthly_fee}€
           Setup: {client.setup_fee}€
           
           Téléphone: {phone_number.number}
           Assistant VAPI: Créé automatiquement ✅
           
           Total CA: {client.setup_fee + client.monthly_fee}€
           """)
           
       except Exception as e:
           await db.clients.update(
               {"id": client.id},
               {"onboarding_status": "failed"}
           )
           await discord_notify(f"❌ ERREUR onboarding {client.business_name}: {str(e)}")
   ```

4. **System prompt personnalisé pour le client**
   ```python
   def generate_client_system_prompt(client):
       return f"""
   Tu es la réceptionniste virtuelle de {client.business_name}, un {client.business_type} situé à {client.city}.
   
   TON RÔLE:
   - Accueillir chaleureusement tous les appelants
   - Répondre aux questions fréquentes sur l'établissement
   - Prendre les réservations/rendez-vous
   - Noter les messages pour l'équipe
   - Transférer les appels urgents
   
   INFORMATIONS ÉTABLISSEMENT:
   - Nom: {client.business_name}
   - Type: {client.business_type}
   - Téléphone: {client.contact_phone}
   - Email: {client.contact_email}
   - Horaires: [À configurer par le client]
   
   TON STYLE:
   - Professionnel mais chaleureux
   - Ton positif et souriant
   - Phrases courtes et claires
   - Vouvoiement systématique
   
   FONCTIONNALITÉS DISPONIBLES:
   {"- Qualification de prospects" if client.plan_type in ['pro', 'premium'] else ""}
   {"- Support multi-langues (FR, EN, NL, ES)" if client.plan_type == 'premium' else ""}
   
   INSTRUCTIONS:
   1. Si question sur horaires/menu/prix: répondre selon les infos fournies
   2. Si demande de réservation: prendre nom, nombre de personnes, date, heure, téléphone
   3. Si demande urgente (livraison en cours, problème client): proposer de transférer immédiatement
   4. Si question hors de tes connaissances: proposer de prendre un message
   5. Toujours finir par "Y a-t-il autre chose pour vous aider ?"
   
   IMPORTANT: Tu représentes {client.business_name}, sois impeccable !
   """
   ```

5. **Email de bienvenue client**
   ```html
   <!DOCTYPE html>
   <html lang="fr">
   <head>
       <meta charset="UTF-8">
       <style>
           /* Styles similaires */
       </style>
   </head>
   <body>
       <div class="container">
           <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
               <h1>🎉 Bienvenue chez Bot Pulse !</h1>
               <p>Votre réceptionniste IA est prête</p>
           </div>
           
           <div class="content">
               <p>Bonjour {{contact_name}},</p>
               
               <p><strong>Félicitations !</strong> Votre réceptionniste IA pour <strong>{{business_name}}</strong> est maintenant opérationnelle.</p>
               
               <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0;">
                   <h3 style="margin: 0 0 15px; color: #059669;">📞 Votre nouveau numéro IA</h3>
                   <p style="font-size: 32px; font-weight: 700; color: #10b981; margin: 0;">{{vapi_phone_number}}</p>
                   <p style="margin: 10px 0 0; color: #666;">Ce numéro est désormais géré par votre réceptionniste IA 24/7</p>
               </div>
               
               <h3>✨ Que faire maintenant ?</h3>
               
               <ol style="line-height: 2;">
                   <li><strong>Testez votre réceptionniste</strong><br>Appelez le {{vapi_phone_number}} pour voir comment elle répond</li>
                   <li><strong>Personnalisez-la</strong><br>Connectez-vous à votre dashboard pour configurer les horaires, FAQ, etc.</li>
                   <li><strong>Redirigez vos appels</strong><br>Transférez votre numéro principal vers le {{vapi_phone_number}}</li>
               </ol>
               
               <div style="text-align: center; margin: 35px 0;">
                   <a href="{{dashboard_url}}" class="cta-button" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                       Accéder à mon dashboard
                   </a>
               </div>
               
               <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 25px 0;">
                   <p style="margin: 0; color: #92400e;">
                       <strong>💡 Astuce:</strong> Pendant les 7 premiers jours, nous recommandons de garder votre ancien système en parallèle pour une transition en douceur.
                   </p>
               </div>
               
               <h3>📚 Ressources utiles</h3>
               <ul>
                   <li><a href="#">Guide de démarrage rapide (PDF)</a></li>
                   <li><a href="#">Configurer vos horaires d'ouverture</a></li>
                   <li><a href="#">Ajouter des questions fréquentes</a></li>
                   <li><a href="#">Personnaliser les réponses</a></li>
               </ul>
               
               <h3>🆘 Besoin d'aide ?</h3>
               <p>Notre équipe support est là pour vous :</p>
               <ul>
                   <li>📧 Email: support@botpulse.com</li>
                   <li>📞 Téléphone: +32 2 XXX XX XX</li>
                   {{#if is_premium}}
                   <li>💬 Chat 24/7: Via votre dashboard</li>
                   {{/if}}
               </ul>
               
               <div style="background: #f0fdf4; padding: 25px; border-radius: 10px; margin: 30px 0; text-align: center;">
                   <h3 style="margin: 0 0 10px; color: #059669;">Merci de nous faire confiance !</h3>
                   <p style="margin: 0; color: #666;">Nous sommes impatients de voir votre activité prospérer avec Bot Pulse</p>
               </div>
               
               <p style="margin-top: 40px;">À très bientôt,</p>
               <p><strong>L'équipe Bot Pulse</strong></p>
           </div>
           
           <div class="footer">
               <p>Bot Pulse - Votre réceptionniste IA 24/7</p>
           </div>
       </div>
   </body>
   </html>
   ```

---

## 🎨 INTERFACE UTILISATEUR FRONTEND

### Pages & Composants

#### Dashboard (`/`)
```typescript
interface DashboardStats {
  prospects: {
    total: number;
    new_this_month: number;
    by_status: Record<string, number>;
  };
  clients: {
    total_active: number;
    new_this_month: number;
    by_plan: Record<string, number>;
  };
  revenue: {
    mrr: number;
    setup_fees_this_month: number;
    total_this_month: number;
    projected_next_month: number;
  };
  conversion: {
    prospect_to_client: number;
    quote_acceptance_rate: number;
  };
  calls: {
    today: number;
    this_week: number;
    success_rate: number;
  };
}
```

**Layout :**
```
┌─────────────────────────────────────────────────────┐
│ 📊 Tableau de Bord                                  │
├──────────┬──────────┬──────────┬───────────────────┤
│ Prospects│ Clients  │   MRR    │ Conversion        │
│   245    │    32    │ 5,560€   │    13.1%         │
│ +15      │    +3    │ +747€    │   +2.3%          │
└──────────┴──────────┴──────────┴───────────────────┘

┌─────────────────────────────────────────────────────┐
│ 📈 MRR Evolution (6 derniers mois)                  │
│                                    ╱─╲               │
│                          ╱───╲   ╱   ╲             │
│                    ╱───╲       ╲╱     ╲            │
│              ╱───╲                                  │
│        ╱───╲                                        │
│  ───╲╱                                              │
│ Sep  Oct  Nov  Dec  Jan  Fev                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 📋 Activité Récente                                 │
├─────────────────────────────────────────────────────┤
│ ✅ Nouveau client: La Bonne Table (PRO - 249€/mois)│
│ 📞 Appel réussi: Hotel Luxe Paris (intérêt: 9/10)  │
│ 📧 Devis envoyé: Salon Belle Coiffure (BASIC)      │
│ 💰 Paiement reçu: 1,219€ - Restaurant Le Gourmet   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 🎯 Campagnes Actives                                │
├─────────────────────────────────────────────────────┤
│ Relance Restaurants Bruxelles    ▓▓▓▓▓▓▓░░░ 72%    │
│ Follow-up Hotels                  ▓▓▓▓░░░░░░ 45%    │
└─────────────────────────────────────────────────────┘
```

#### Prospects (`/prospects`)
```
┌─────────────────────────────────────────────────────┐
│ 🔍 Recherche: [___________]  🔽 Filtres             │
│                                                      │
│ Status: [Tous v] Type: [Tous v] Ville: [Tous v]    │
│ Score min: [___] Score max: [___]                   │
│                                                      │
│ [+ Nouvelle Prospection]                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Nom Commerce         | Type  | Score | Status       │
├──────────────────────┼───────┼───────┼─────────────┤
│ La Bonne Table       │ Rest. │  92   │ Qualifié    │
│ Hotel Luxe Paris     │ Hotel │  88   │ Intéressé   │
│ Salon Belle Coiffure │ Salon │  75   │ Contacté    │
│ Garage Auto Plus     │ Serv. │  65   │ Nouveau     │
└─────────────────────────────────────────────────────┘

[Page 1 2 3 ... 12]
```

**Détails prospect (modal) :**
```
┌─────────────────────────────────────────────────────┐
│ 📋 La Bonne Table                         [x Close] │
├─────────────────────────────────────────────────────┤
│ Type: Restaurant | Score: 92/100 | Status: Qualifié│
│                                                      │
│ 📍 Adresse                                          │
│ Rue de la Paix 123, 1000 Bruxelles                 │
│                                                      │
│ 📞 Contact                                          │
│ Tel: +32 2 123 45 67                               │
│ Email: contact@labonnetable.be                     │
│ Contact: Jean Dupont                               │
│                                                      │
│ ⭐ Google                                           │
│ Rating: 4.6/5 (234 avis)                           │
│                                                      │
│ 📞 Dernier Appel (15/01/2026)                      │
│ Durée: 4min 32s                                    │
│ Intérêt: 9/10                                      │
│ Besoins: Appels manqués le soir, Débordé weekend  │
│                                                      │
│ 💬 Transcript                                       │
│ Marie: Bonjour, je suis Marie de Bot Pulse...      │
│ Jean: Ah oui bonjour, je vous écoute...           │
│ [Voir complet]                                     │
│                                                      │
│ 📝 Notes                                            │
│ Très intéressé, veut voir démo avant décision     │
│                                                      │
│ 🎯 Prochaine Action                                 │
│ Envoyer devis PRO - Prévu le 20/01/2026           │
│                                                      │
│ [Qualifier] [Appeler] [Envoyer Email] [Supprimer] │
└─────────────────────────────────────────────────────┘
```

#### Clients (`/clients`)
```
┌─────────────────────────────────────────────────────┐
│ Plan: [Tous v] Status: [Actifs v] Onboarding: [v]  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Nom         | Plan    | MRR   | Status | Activé     │
├─────────────┼─────────┼───────┼────────┼───────────┤
│ Le Gourmet  │ PREMIUM │ 499€  │ Actif  │ 01/12/25  │
│ Spa Zen     │ PRO     │ 249€  │ Actif  │ 15/12/25  │
│ Coiffure+   │ BASIC   │  99€  │ Actif  │ 20/01/26  │
└─────────────────────────────────────────────────────┘
```

**Détails client :**
```
┌─────────────────────────────────────────────────────┐
│ 🏢 Le Gourmet Restaurant                  [x Close] │
├─────────────────────────────────────────────────────┤
│ Package: PREMIUM | MRR: 499€ | Status: ✅ Actif    │
│                                                      │
│ 📞 Téléphone IA: +32 2 987 65 43                   │
│ Assistant VAPI: asst_abc123xyz                     │
│                                                      │
│ 📊 Statistiques (30 derniers jours)                │
│ Appels reçus: 342                                  │
│ Réservations prises: 127                           │
│ Messages enregistrés: 45                           │
│ Taux de satisfaction: 96%                          │
│                                                      │
│ 💰 Facturation                                      │
│ Prochain paiement: 01/03/2026 (499€)              │
│ Historique:                                        │
│ - 01/02/26: 499€ ✅                                │
│ - 15/01/26: 1,490€ (Setup) ✅                      │
│                                                      │
│ 🔧 Actions                                          │
│ [Voir Dashboard Client] [Pause Abonnement]        │
│ [Portail Stripe] [Annuler]                        │
└─────────────────────────────────────────────────────┘
```

#### Campagnes (`/campaigns`)
```
┌─────────────────────────────────────────────────────┐
│ [+ Nouvelle Campagne]                               │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Nom                     | Envoyés | Ouverts | Status│
├─────────────────────────┼─────────┼─────────┼──────┤
│ Relance Restaurants BXL │  120    │  48 (40%)│ ✅   │
│ Follow-up Hotels        │   85    │  25 (29%)│ 🔄   │
│ Promo Janvier          │    0    │   0      │ 📝   │
└─────────────────────────────────────────────────────┘
```

**Créer campagne (modal) :**
```
┌─────────────────────────────────────────────────────┐
│ ✉️ Nouvelle Campagne Email                          │
├─────────────────────────────────────────────────────┤
│ Nom de la campagne:                                 │
│ [_______________________________]                   │
│                                                      │
│ Ciblage:                                            │
│ Types: [x] Restaurant [ ] Hotel [x] Salon          │
│ Villes: [x] Bruxelles [ ] Anvers [ ] Gand          │
│ Score min: [70] Score max: [100]                   │
│ Status: [x] Intéressé [x] Qualifié                 │
│                                                      │
│ Prospects ciblés: 45                                │
│                                                      │
│ Message:                                            │
│ Sujet: [________________________]                   │
│                                                      │
│ Corps: (Variables: {{business_name}}, {{city}})    │
│ [___________________________________]               │
│ [___________________________________]               │
│ [___________________________________]               │
│                                                      │
│ Aperçu: [Voir]                                     │
│                                                      │
│ Planning:                                           │
│ ( ) Envoyer maintenant                             │
│ (•) Planifier: [20/02/2026] à [09:00]             │
│                                                      │
│ [Annuler] [Créer Campagne]                         │
└─────────────────────────────────────────────────────┘
```

#### Paramètres (`/settings`)
```
┌─────────────────────────────────────────────────────┐
│ ⚙️ Paramètres                                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│ 🔑 API Keys                                         │
│ Google Places: [sk_*********************] [Tester] │
│ Stripe Secret: [sk_*********************] [Tester] │
│ Resend:        [re_*********************] [Tester] │
│ VAPI:          [vapi_*******************] [Tester] │
│ Discord:       [https://************...] [Tester]  │
│                                                      │
│ 🤖 Automation                                       │
│ Appels par jour: [50]                              │
│ Horaires: [09:00] à [19:00]                        │
│ Jours: [x]Lu [x]Ma [x]Me [x]Je [x]Ve [ ]Sa [ ]Di  │
│                                                      │
│ 📧 Email Templates                                  │
│ [Gérer les templates]                              │
│                                                      │
│ 👥 Utilisateurs                                     │
│ admin@botpulse.com (Admin)                         │
│ [+ Ajouter utilisateur]                            │
│                                                      │
│ [Sauvegarder]                                      │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 CONFIGURATION TECHNIQUE DÉTAILLÉE

### Environnement complet (.env)
```env
# ============================================================
# APPLICATION
# ============================================================
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
API_BASE_URL=http://localhost:3000

# ============================================================
# DATABASE
# ============================================================
DATABASE_URL=postgresql://n8n_user:Couronne94.@localhost:5432/n8n_db
POSTGRES_USER=n8n_user
POSTGRES_PASSWORD=Couronne94.
POSTGRES_DB=n8n_db
POSTGRES_PORT=5432

# ============================================================
# AUTHENTICATION
# ============================================================
JWT_SECRET=super-secret-jwt-key-change-in-production-32chars-minimum!
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# ============================================================
# VAPI (Appels IA)
# ============================================================
VAPI_PUBLIC_KEY=eaded992-3a0b-48a4-bdb3-09438c4e54a4
VAPI_PRIVATE_KEY=bc604c5b-1f21-4b73-9887-d3de7e9f300a
VAPI_ASSISTANT_ID=7db314c1-cb60-4aaa-a050-e5496d6db641
VAPI_PHONE_NUMBER=+16073548569
VAPI_BASE_URL=https://api.vapi.ai
VAPI_WEBHOOK_SECRET=your-vapi-webhook-secret

# Voice Configuration
VAPI_MODEL=gpt-4-turbo
VAPI_VOICE_PROVIDER=11labs
VAPI_VOICE_ID=21m00Tcm4TlvDq8ikWAM
VAPI_STABILITY=0.75
VAPI_SIMILARITY_BOOST=0.85
VAPI_TEMPERATURE=0.7
VAPI_MAX_TOKENS=500

# ============================================================
# STRIPE (Paiements) - LIVE MODE
# ============================================================
STRIPE_MODE=live
STRIPE_SECRET_KEY=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
STRIPE_PUBLISHABLE_KEY=pk_live_51SI3rrEJ1kx0sRhJFGJ6DqcVU4iI2DjHI58vU0Q7bLJCzXLxTXKyj6CIaZQE4KGlOBmiBgNVdP4PxhgWyUyuHjEf004kXaDQl7
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Price IDs (créer dans Stripe Dashboard)
STRIPE_PRICE_BASIC_SETUP=price_basic_setup_490
STRIPE_PRICE_BASIC_MONTHLY=price_basic_monthly_99
STRIPE_PRICE_PRO_SETUP=price_pro_setup_970
STRIPE_PRICE_PRO_MONTHLY=price_pro_monthly_249
STRIPE_PRICE_PREMIUM_SETUP=price_premium_setup_1490
STRIPE_PRICE_PREMIUM_MONTHLY=price_premium_monthly_499

# Payment Links
STRIPE_LINK_BASIC=https://buy.stripe.com/XXXXX
STRIPE_LINK_PRO=https://buy.stripe.com/XXXXX
STRIPE_LINK_PREMIUM=https://buy.stripe.com/XXXXX

# ============================================================
# RESEND (Emails)
# ============================================================
RESEND_API_KEY=re_b76Nto6D_PDn4qpvedEccd8AWpPPpLVWm
RESEND_FROM_EMAIL=Marie - Bot Pulse <marie@botpulse.com>
RESEND_FROM_NAME=Marie - Bot Pulse
RESEND_REPLY_TO=contact@botpulse.com

# SMTP (optionnel)
RESEND_SMTP_HOST=smtp.resend.com
RESEND_SMTP_PORT=587
RESEND_SMTP_USER=resend
RESEND_SMTP_PASSWORD=re_b76Nto6D_PDn4qpvedEccd8AWpPPpLVWm

# ============================================================
# GOOGLE PLACES API
# ============================================================
GOOGLE_PLACES_API_KEY=AIzaSyDummyKeyHere
GOOGLE_PLACES_QUOTA_DAILY=28000

# ============================================================
# ELEVENLABS (Voix ultra-réaliste)
# ============================================================
ELEVENLABS_API_KEY=sk_your_elevenlabs_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_STABILITY=0.75
ELEVENLABS_SIMILARITY=0.85
ELEVENLABS_MODEL=eleven_multilingual_v2

# ============================================================
# DISCORD NOTIFICATIONS
# ============================================================
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/abcdefghijk

# ============================================================
# N8N INTEGRATION
# ============================================================
N8N_WEBHOOK_SECRET=generate-a-random-secret-here
N8N_BASE_URL=http://localhost:5678
N8N_WEBHOOK_URL=http://localhost:5678/webhook

# ============================================================
# AUTOMATION SETTINGS
# ============================================================
CALLS_PER_DAY=50
AUTOMATION_START_HOUR=9
AUTOMATION_END_HOUR=19
AUTOMATION_DAYS=1,2,3,4,5
MAX_CALLS_PER_BATCH=1
CALL_INTERVAL_MINUTES=20

# Prospection
PROSPECTION_DAILY_QUOTA=30
PROSPECTION_RADIUS_METERS=5000
PROSPECTION_CITIES=Bruxelles,Anvers,Gand,Liège,Namur,Charleroi

# ============================================================
# REMINDERS
# ============================================================
REMINDER_QUOTE_D1=true
REMINDER_QUOTE_D3=true
REMINDER_QUOTE_D7=true
REMINDER_CALLBACK_3MONTHS=true

# ============================================================
# RATE LIMITING
# ============================================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_LOGIN_MAX=5

# ============================================================
# LOGGING
# ============================================================
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_ENABLED=true
LOG_FILE_PATH=./logs/app.log
LOG_ROTATION=daily
LOG_MAX_SIZE=100M

# ============================================================
# CORS
# ============================================================
CORS_ORIGIN=http://localhost:5173,https://yourdomain.com
CORS_CREDENTIALS=true

# ============================================================
# TIMEZONE
# ============================================================
TZ=Europe/Brussels

# ============================================================
# FEATURES FLAGS
# ============================================================
FEATURE_VAPI_CALLS=true
FEATURE_STRIPE_PAYMENTS=true
FEATURE_AUTO_PROSPECTION=true
FEATURE_EMAIL_CAMPAIGNS=true
FEATURE_DISCORD_NOTIFICATIONS=true
FEATURE_AUTO_ONBOARDING=true
```

---

## 📦 STRUCTURE COMPLÈTE DU PROJET

```
bot-pulse-v2/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts          # Prisma/PostgreSQL config
│   │   │   ├── stripe.ts            # Stripe SDK config
│   │   │   ├── resend.ts            # Resend SDK config
│   │   │   ├── vapi.ts              # VAPI SDK config
│   │   │   ├── env.ts               # Environment validation
│   │   │   └── logger.ts            # Winston logger
│   │   │
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts   # Login, register, refresh token
│   │   │   ├── prospects.controller.ts
│   │   │   ├── clients.controller.ts
│   │   │   ├── calls.controller.ts
│   │   │   ├── quotes.controller.ts
│   │   │   ├── campaigns.controller.ts
│   │   │   ├── payments.controller.ts
│   │   │   ├── webhooks.controller.ts
│   │   │   └── dashboard.controller.ts
│   │   │
│   │   ├── services/
│   │   │   ├── prospection.service.ts    # Google Places search
│   │   │   ├── scoring.service.ts        # Algorithm scoring
│   │   │   ├── vapi.service.ts           # VAPI calls management
│   │   │   ├── email.service.ts          # Resend emails
│   │   │   ├── stripe.service.ts         # Payments & subscriptions
│   │   │   ├── onboarding.service.ts     # Auto client setup
│   │   │   ├── reminder.service.ts       # Relances automatiques
│   │   │   ├── discord.service.ts        # Discord notifications
│   │   │   └── analytics.service.ts      # Stats & dashboard
│   │   │
│   │   ├── models/
│   │   │   └── schema.prisma            # Prisma schema
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts       # JWT verification
│   │   │   ├── validation.middleware.ts # Zod validation
│   │   │   ├── ratelimit.middleware.ts  # Rate limiting
│   │   │   ├── error.middleware.ts      # Global error handler
│   │   │   └── logger.middleware.ts     # Request logging
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── prospects.routes.ts
│   │   │   ├── clients.routes.ts
│   │   │   ├── calls.routes.ts
│   │   │   ├── quotes.routes.ts
│   │   │   ├── campaigns.routes.ts
│   │   │   ├── payments.routes.ts
│   │   │   ├── webhooks.routes.ts
│   │   │   └── dashboard.routes.ts
│   │   │
│   │   ├── utils/
│   │   │   ├── validators.ts            # Zod schemas
│   │   │   ├── helpers.ts               # Utility functions
│   │   │   ├── templates.ts             # Email templates
│   │   │   └── constants.ts             # App constants
│   │   │
│   │   ├── types/
│   │   │   └── index.ts                 # TypeScript types
│   │   │
│   │   ├── jobs/                        # Cron jobs
│   │   │   ├── prospection.job.ts       # Daily prospection
│   │   │   ├── calling.job.ts           # Hourly calling
│   │   │   ├── reminders.job.ts         # Hourly reminders check
│   │   │   └── analytics.job.ts         # Daily stats aggregation
│   │   │
│   │   └── server.ts                    # Express server
│   │
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts                      # Seed data
│   │   └── migrations/
│   │
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                      # shadcn/ui components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── label.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Layout.tsx
│   │   │   │   └── Navigation.tsx
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── StatsCards.tsx
│   │   │   │   ├── MRRChart.tsx
│   │   │   │   ├── ConversionChart.tsx
│   │   │   │   ├── ActivityFeed.tsx
│   │   │   │   └── CampaignsList.tsx
│   │   │   │
│   │   │   ├── prospects/
│   │   │   │   ├── ProspectList.tsx
│   │   │   │   ├── ProspectCard.tsx
│   │   │   │   ├── ProspectDetails.tsx
│   │   │   │   ├── ProspectionForm.tsx
│   │   │   │   └── CallHistory.tsx
│   │   │   │
│   │   │   ├── clients/
│   │   │   │   ├── ClientList.tsx
│   │   │   │   ├── ClientCard.tsx
│   │   │   │   ├── ClientDetails.tsx
│   │   │   │   └── ClientAnalytics.tsx
│   │   │   │
│   │   │   ├── campaigns/
│   │   │   │   ├── CampaignList.tsx
│   │   │   │   ├── CampaignForm.tsx
│   │   │   │   ├── CampaignStats.tsx
│   │   │   │   └── EmailPreview.tsx
│   │   │   │
│   │   │   ├── quotes/
│   │   │   │   ├── QuoteList.tsx
│   │   │   │   └── QuoteDetails.tsx
│   │   │   │
│   │   │   └── auth/
│   │   │       ├── LoginForm.tsx
│   │   │       └── RegisterForm.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Prospects.tsx
│   │   │   ├── Clients.tsx
│   │   │   ├── Campaigns.tsx
│   │   │   ├── Quotes.tsx
│   │   │   ├── Analytics.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── Login.tsx
│   │   │   └── Register.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useProspects.ts
│   │   │   ├── useClients.ts
│   │   │   ├── useCampaigns.ts
│   │   │   ├── useQuotes.ts
│   │   │   └── useDashboard.ts
│   │   │
│   │   ├── services/
│   │   │   └── api.ts                   # Axios instance
│   │   │
│   │   ├── stores/
│   │   │   ├── authStore.ts             # Zustand auth state
│   │   │   └── appStore.ts              # App state
│   │   │
│   │   ├── types/
│   │   │   └── index.ts
│   │   │
│   │   ├── utils/
│   │   │   ├── helpers.ts
│   │   │   └── constants.ts
│   │   │
│   │   ├── styles/
│   │   │   └── globals.css
│   │   │
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── index.html
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 ORDRE DE DÉVELOPPEMENT RECOMMANDÉ

1. **Setup infrastructure (2h)**
   - Structure projet
   - Docker-compose
   - Configuration TypeScript
   - Prisma schema
   - Migrations initiales
   - Seed data

2. **Backend core (4h)**
   - Configuration services (database, logger, env)
   - Authentication (JWT, bcrypt)
   - Middleware (auth, validation, error handling)
   - Routes de base

3. **Prospection system (3h)**
   - Service Google Places
   - Algorithm scoring
   - Prospection job (cron)
   - API endpoints prospects

4. **VAPI integration (4h)**
   - Service VAPI
   - System prompt generation
   - Call management
   - Webhook handler
   - Transcript analysis

5. **Quote system (2h)**
   - Quote generation
   - Email templates (HTML)
   - Resend integration
   - API endpoints quotes

6. **Stripe integration (3h)**
   - Stripe service
   - Payment Intent creation
   - Subscription management
   - Webhook handler
   - Payment links

7. **Auto-onboarding (3h)**
   - Onboarding service
   - VAPI assistant creation
   - Phone number purchase
   - Client system prompt
   - Welcome email

8. **Reminders system (2h)**
   - Reminder scheduler
   - Email templates (relances)
   - Cron job
   - API endpoints

9. **Campaigns (2h)**
   - Campaign management
   - Targeting logic
   - Batch email sending
   - Tracking (opens/clicks)

10. **Analytics & Dashboard (3h)**
    - Analytics service
    - Daily aggregation job
    - Dashboard API endpoints
    - Stats calculation

11. **Discord notifications (1h)**
    - Discord service
    - Notification triggers

12. **Frontend setup (2h)**
    - Vite + React + TypeScript
    - Tailwind + shadcn/ui
    - Routing
    - API service (Axios)
    - Auth store (Zustand)

13. **Frontend pages (6h)**
    - Login/Register
    - Dashboard (stats, charts, feed)
    - Prospects (list, details, filters)
    - Clients (list, details, analytics)
    - Campaigns (list, create, stats)
    - Settings

14. **Testing & Debug (4h)**
    - Unit tests (services critiques)
    - Integration tests
    - E2E tests (optionnel)
    - Debug & fix

15. **Documentation (2h)**
    - README complet
    - API documentation
    - Setup guide
    - User guide

**TOTAL ESTIMÉ : 43 heures**

---

## ✅ CHECKLIST FINALE

### Avant de commencer
- [ ] Docker Desktop installé
- [ ] Node.js 18+ installé
- [ ] PostgreSQL accessible
- [ ] Toutes les API keys disponibles
- [ ] Stripe configuré (products + prices)

### Backend
- [ ] Structure projet créée
- [ ] Prisma schema défini
- [ ] Migrations exécutées
- [ ] Seed data créé
- [ ] Auth fonctionnel (JWT)
- [ ] Tous les endpoints implémentés
- [ ] Webhooks testés (Stripe, VAPI)
- [ ] Jobs cron configurés
- [ ] Error handling complet
- [ ] Logging configuré
- [ ] Rate limiting actif

### Frontend
- [ ] Pages principales créées
- [ ] Composants UI (shadcn)
- [ ] Routing configuré
- [ ] Auth flow complet
- [ ] API calls fonctionnels
- [ ] Loading states
- [ ] Error handling
- [ ] Responsive design
- [ ] Dark mode (optionnel)

### Intégrations
- [ ] VAPI calls fonctionnels
- [ ] Stripe payments OK
- [ ] Emails Resend envoyés
- [ ] Google Places search OK
- [ ] Discord notifications OK
- [ ] n8n webhooks (si applicable)

### Testing
- [ ] Tests unitaires services
- [ ] Tests intégration APIs
- [ ] Test complet workflow (prospect → client)
- [ ] Test paiement Stripe
- [ ] Test relances automatiques

### Documentation
- [ ] README.md complet
- [ ] .env.example à jour
- [ ] API endpoints documentés
- [ ] Guide d'installation
- [ ] Guide d'utilisation

### Production
- [ ] Variables d'environnement prod
- [ ] SSL configuré
- [ ] Domaine configuré
- [ ] Monitoring (Sentry, optionnel)
- [ ] Backup database
- [ ] Health check endpoint

---

## 🎯 LIVRABLES ATTENDUS

1. **Code backend complet** (TypeScript + Express + Prisma)
2. **Code frontend complet** (React + TypeScript + Tailwind + shadcn/ui)
3. **Base de données** (Schema Prisma + Migrations + Seeds)
4. **Docker setup** (docker-compose.yml fonctionnel)
5. **Documentation** (README + API docs + Setup guide)
6. **Tests** (Unit tests + Integration tests)
7. **.env.example** (Toutes les variables documentées)

---

## ⚠️ NOTES IMPORTANTES

### Sécurité
- **Stripe**: Tu es en MODE LIVE ! Attention aux tests.
- **JWT Secret**: Change-le en production
- **Passwords**: Bcrypt avec 12 rounds minimum
- **API Keys**: Jamais dans le code, toujours en .env
- **CORS**: Configure correctement les origins
- **Rate limiting**: Actif sur tous les endpoints sensibles
- **Validation**: Zod sur tous les inputs

### Performance
- **Indexes SQL**: Sur toutes les colonnes fréquemment requêtées
- **Pagination**: Obligatoire sur toutes les listes
- **Cache**: Considérer Redis pour les données fréquentes
- **Lazy loading**: Frontend
- **Code splitting**: Frontend

### Qualité du code
- **TypeScript strict**: Aucun `any`
- **ESLint + Prettier**: Configurés
- **Comments**: Sur la logique complexe uniquement
- **Error handling**: Try-catch partout
- **Logging**: Niveau approprié (info en prod, debug en dev)

### Workflow n8n
- **Séparation**: Le backend ne gère PAS les workflows n8n
- **Webhooks**: Le backend REÇOIT des webhooks de n8n
- **APIs**: Le backend peut APPELER des webhooks n8n pour déclencher des workflows

### Ce qui n'est PAS inclus (je gère)
- ❌ Configuration des workflows n8n
- ❌ Setup des assistants VAPI manuellement
- ❌ Configuration des numéros de téléphone manuellement
- ❌ Templates d'appels IA custom

---

## 🤖 QUESTIONS POUR CLAUDE CODE

Avant de commencer, confirme-moi :

1. **Stack technique** : Tu es OK avec Node.js/TypeScript + React/TypeScript ?
2. **Base de données** : Prisma te convient ou tu préfères Drizzle ?
3. **UI Library** : shadcn/ui ça te va ?
4. **État management** : Zustand ou React Query ?
5. **Charts** : Recharts, Chart.js ou autre ?
6. **Tests** : Jest + React Testing Library ?
7. **Déploiement** : Tu veux un Dockerfile ou juste docker-compose ?

Si tout te convient, **commence immédiatement le développement** en suivant l'ordre recommandé ! 🚀

---

## 🎨 DESIGN SYSTEM

### Palette de couleurs
```css
:root {
  /* Primary */
  --primary: #667eea;
  --primary-hover: #5a67d8;
  --primary-light: #a4b6fc;
  
  /* Secondary */
  --secondary: #764ba2;
  
  /* Success */
  --success: #10b981;
  --success-light: #d1fae5;
  
  /* Warning */
  --warning: #f59e0b;
  --warning-light: #fef3c7;
  
  /* Danger */
  --danger: #ef4444;
  --danger-light: #fee2e2;
  
  /* Neutral */
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-500: #6b7280;
  --gray-700: #374151;
  --gray-900: #111827;
}
```

### Typography
```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

h1 { font-size: 2rem; font-weight: 700; }
h2 { font-size: 1.5rem; font-weight: 600; }
h3 { font-size: 1.25rem; font-weight: 600; }
```

### Responsive breakpoints
```css
/* Mobile: 0-640px */
/* Tablet: 641-1024px */
/* Desktop: 1025px+ */
```

---

**C'EST TOUT ! Tu as maintenant TOUTES les informations nécessaires pour créer Bot Pulse V2 de A à Z.** 🚀

**GO !**
