# 🚀 GUIDE DE DÉMARRAGE - BOT PULSE AUTOMATIQUE

## 🎯 Objectif : Lancer le bot et le laisser tourner en boucle

Une fois le code développé par Claude Code, voici comment démarrer ton bot pour qu'il tourne **en continu, automatiquement, sans intervention humaine**.

---

## ✅ PRÉREQUIS

Avant de démarrer le bot, assure-toi que :

- [x] Le code backend est déployé (Docker ou serveur)
- [x] PostgreSQL est accessible et les tables créées
- [x] Toutes les API keys sont configurées dans le `.env`
- [x] Les products et prices Stripe sont créés
- [x] Le webhook Stripe est configuré et pointe vers `/api/webhooks/stripe`

---

## 🔧 ÉTAPE 1 : Configuration initiale (Une seule fois)

### 1.1 Créer les packages Stripe

**IMPORTANT : À faire AVANT de lancer le bot**

```bash
# Se connecter au dashboard Stripe
https://dashboard.stripe.com/

# Mode TEST ou LIVE (tu choisis)
# Pour tester : activer mode TEST
# Pour prod : mode LIVE (attention, vrais paiements!)
```

**Créer 3 products avec leurs prices :**

#### Package BASIC
```
Product:
  Name: Réceptionniste IA - BASIC
  Description: Réceptionniste virtuelle 24/7 avec réservations automatiques

Prices:
  1. Setup Fee (one-time)
     - Amount: 697€
     - Type: One-time
     - ID: price_basic_setup_697
  
  2. Monthly Subscription (recurring)
     - Amount: 197€
     - Billing: Monthly
     - Type: Recurring
     - ID: price_basic_monthly_197
```

#### Package PRO
```
Product:
  Name: Réceptionniste IA - PRO
  Description: BASIC + Qualification prospects + Analytics

Prices:
  1. Setup Fee (one-time)
     - Amount: 997€
     - Type: One-time
     - ID: price_pro_setup_997
  
  2. Monthly Subscription (recurring)
     - Amount: 347€
     - Billing: Monthly
     - Type: Recurring
     - ID: price_pro_monthly_347
```

#### Package ENTERPRISE
```
Product:
  Name: Réceptionniste IA - ENTERPRISE
  Description: PRO + Multi-langues + Intégrations avancées

Prices:
  1. Setup Fee (one-time)
     - Amount: 1497€
     - Type: One-time
     - ID: price_enterprise_setup_1497
  
  2. Monthly Subscription (recurring)
     - Amount: 497€
     - Billing: Monthly
     - Type: Recurring
     - ID: price_enterprise_monthly_497
```

**Copier les Price IDs dans le `.env` :**
```env
STRIPE_PRICE_BASIC_SETUP=price_XXXXXXXXXXXXX
STRIPE_PRICE_BASIC_MONTHLY=price_XXXXXXXXXXXXX
STRIPE_PRICE_PRO_SETUP=price_XXXXXXXXXXXXX
STRIPE_PRICE_PRO_MONTHLY=price_XXXXXXXXXXXXX
STRIPE_PRICE_ENTERPRISE_SETUP=price_XXXXXXXXXXXXX
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_XXXXXXXXXXXXX
```

### 1.2 Créer les Payment Links Stripe

Pour chaque package, créer un Payment Link :

```bash
# BASIC
Stripe Dashboard → Payment Links → New
Product: Réceptionniste IA - BASIC
Prices: Setup (697€) + Subscription (197€/mois)
Success URL: https://yourdomain.com/success
Cancel URL: https://yourdomain.com/cancel

# Copier le lien généré
STRIPE_LINK_BASIC=https://buy.stripe.com/test_XXXXX

# Répéter pour PRO et ENTERPRISE
```

### 1.3 Configurer le Webhook Stripe

```bash
# Stripe Dashboard → Developers → Webhooks → Add endpoint

Endpoint URL: https://yourdomain.com/api/webhooks/stripe

Events to listen:
  ✓ checkout.session.completed
  ✓ customer.subscription.created
  ✓ customer.subscription.updated
  ✓ customer.subscription.deleted
  ✓ invoice.payment_succeeded
  ✓ invoice.payment_failed

# Copier le Signing Secret
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXX
```

---

## 🚀 ÉTAPE 2 : Démarrer le serveur

```bash
# Méthode 1 : Docker (recommandé)
cd bot-pulse-v2
docker compose up -d

# Méthode 2 : Local
cd bot-pulse-v2/backend
npm run build
npm start

# Vérifier que le serveur tourne
curl http://localhost:3000/health
# Devrait retourner: {"status":"healthy"}
```

---

## 🤖 ÉTAPE 3 : Activer le bot (Démarrer la boucle automatique)

### Méthode 1 : Via l'API

```bash
# Démarrer le bot
curl -X POST http://localhost:3000/api/bot/start \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Réponse attendue:
{
  "success": true,
  "message": "Bot démarré avec succès",
  "config": {
    "calls_per_day": 50,
    "automation_hours": "9h-19h",
    "automation_days": "Lun-Ven"
  }
}
```

### Méthode 2 : Via l'interface web

```bash
# Ouvrir le frontend
http://localhost:5173

# Se connecter
# Aller dans Settings
# Cliquer sur "Démarrer le Bot" 🚀
```

### Méthode 3 : Via le dashboard

```bash
# Page dashboard
# Bouton en haut à droite: "▶️ Démarrer le Bot"
```

---

## 📊 ÉTAPE 4 : Vérifier que le bot tourne

### 4.1 Vérifier le status

```bash
# Via API
curl http://localhost:3000/api/bot/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Réponse attendue:
{
  "active": true,
  "calls_today": 0,
  "calls_quota": 50,
  "prospects_today": 0,
  "last_prospection": null,
  "last_call": null,
  "next_prospection": "2026-02-10T09:00:00Z",
  "next_call": "2026-02-10T09:20:00Z"
}
```

### 4.2 Vérifier les logs

```bash
# Docker
docker compose logs -f backend

# Local
tail -f backend/logs/app.log

# Tu devrais voir:
[INFO] Bot activé - Mode automatique
[INFO] Cron prospection programmé: 9h (lun-ven)
[INFO] Cron appels programmé: toutes les 20min (9h-19h, lun-ven)
[INFO] Cron relances programmé: toutes les heures
```

### 4.3 Vérifier Discord (si configuré)

Dans ton canal Discord, tu devrais recevoir :

```
🚀 Bot Pulse V2 Démarré

Status: Actif ✅
Quota appels: 50/jour
Horaires: 9h-19h (Lun-Ven)
Prochaine prospection: 10/02/2026 à 09:00
Prochain appel: 10/02/2026 à 09:20
```

---

## 🔄 ÉTAPE 5 : Observer le premier cycle (Jour 1)

### Timeline du premier jour

```
09:00 → Prospection automatique
        - Recherche 30 prospects sur Google Places
        - Sauvegarde dans la BD
        - Notification Discord "📊 30 nouveaux prospects"

09:20 → Premier appel
        - Sélection du meilleur prospect (score le plus élevé)
        - Appel VAPI avec Marie
        - Notification Discord "📞 Appel en cours: Restaurant X"

09:24 → Fin du premier appel
        - Analyse transcript
        - Si intéressé: envoi devis automatique
        - Notification Discord "✅ Prospect qualifié" ou "❌ Pas intéressé"

09:40 → Deuxième appel
        - Sélection du prochain prospect
        - Appel VAPI
        - Etc.

... (toutes les 20min jusqu'à 19h)

19:00 → Dernier appel de la journée

19:30 → Résumé quotidien Discord
        "📊 RÉSUMÉ DU JOUR
        Appels: 25
        Qualifiés: 8
        Devis envoyés: 8
        En attente réponse: 8"
```

---

## 💰 ÉTAPE 6 : Première vente (généralement J+1 à J+7)

**Quand un prospect paye :**

```
1. Stripe webhook reçu → checkout.session.completed
2. Backend créé le client dans la BD
3. Backend créé la subscription Stripe (paiement mensuel auto)
4. Backend génère automatiquement:
   ✓ Assistant VAPI personnalisé
   ✓ Numéro téléphone VAPI
   ✓ Workflow n8n (JSON)
   ✓ Config client (JSON)
   ✓ Documentation (README + Guide)
   ✓ ZIP package complet

5. Email automatique envoyé au client avec:
   - Pièce jointe: receptionniste-{business-name}.zip
   - Numéro IA: +32 XXX XX XX XX
   - Instructions setup

6. Notification Discord:
   "🎉 NOUVELLE VENTE!
   Client: Restaurant Le Gourmet
   Package: PRO
   Setup: 997€
   MRR: +347€
   Total CA: 1,344€"
```

---

## 🎛️ CONTRÔLE DU BOT

### Commandes disponibles

```bash
# Démarrer le bot
POST /api/bot/start

# Arrêter le bot
POST /api/bot/stop

# Status du bot
GET /api/bot/status

# Modifier la config
PATCH /api/bot/config
{
  "calls_per_day": 30,        # Réduire à 30 appels/jour
  "automation_hours": "10-18" # Changer horaires
}

# Forcer une prospection maintenant
POST /api/bot/prospection/trigger

# Forcer un appel maintenant
POST /api/bot/call/trigger

# Voir les stats
GET /api/dashboard/stats
```

### Arrêter le bot

```bash
# Via API
curl -X POST http://localhost:3000/api/bot/stop \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Via interface
# Bouton "⏸️ Arrêter le Bot" dans Settings

# Effet:
- Tous les crons sont désactivés
- Les appels en cours se terminent normalement
- Le bot ne fera plus de nouvelles actions
```

---

## 📈 MONITORING

### Tableau de bord en temps réel

```bash
# Ouvrir le dashboard
http://localhost:5173/dashboard

# Tu verras en temps réel:
- Nombre de prospects
- Appels du jour
- Devis envoyés
- Ventes
- MRR (Monthly Recurring Revenue)
- Graphiques d'évolution
```

### Logs importants à surveiller

```bash
# Prospection
[INFO] Prospection démarrée
[INFO] 25 nouveaux prospects trouvés
[INFO] Prospects sauvegardés en BD

# Appels
[INFO] Appel VAPI démarré - Prospect: Restaurant X
[INFO] Appel terminé - Durée: 4min 32s
[INFO] Transcript analysé - Intérêt: 8/10
[INFO] Email collecté: contact@restaurant-x.be

# Devis
[INFO] Devis généré - Package: PRO
[INFO] Email envoyé à contact@restaurant-x.be
[INFO] Relances programmées (J+1, J+3, J+7)

# Ventes
[INFO] Webhook Stripe reçu - checkout.session.completed
[INFO] Client créé - Restaurant Le Gourmet
[INFO] Assistant VAPI créé - ID: asst_abc123
[INFO] Numéro acheté - +32 2 987 65 43
[INFO] Workflow généré - receptionniste-le-gourmet.zip
[INFO] Email bienvenue envoyé
```

---

## ⚠️ TROUBLESHOOTING

### Le bot ne démarre pas

```bash
# Vérifier les variables d'env
cat .env | grep "VAPI\|STRIPE\|GOOGLE"

# Vérifier la connexion PostgreSQL
docker compose exec db psql -U n8n_user -d n8n_db -c "SELECT 1;"

# Vérifier les crons
# Dans les logs, chercher: "Cron registered"
```

### Aucun appel ne se fait

```bash
# Vérifier qu'il y a des prospects
curl http://localhost:3000/api/prospects?status=new

# Vérifier le quota
curl http://localhost:3000/api/bot/status
# Si calls_today >= calls_quota → c'est normal, quota atteint

# Vérifier l'heure
# Les appels se font seulement 9h-19h, lun-ven
```

### Les emails ne partent pas

```bash
# Vérifier la clé Resend
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer YOUR_RESEND_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"test@test.com","to":"you@example.com","subject":"Test","html":"<p>Test</p>"}'

# Si erreur 401 → clé invalide
# Si erreur 403 → domaine non vérifié
```

### Webhook Stripe ne fonctionne pas

```bash
# Vérifier le webhook est actif
Stripe Dashboard → Webhooks → Status: Active

# Tester le webhook
Stripe Dashboard → Webhooks → Test webhook
Event: checkout.session.completed

# Vérifier les logs backend
# Tu dois voir: "Webhook Stripe reçu - checkout.session.completed"
```

---

## 🎯 CHECKLIST FINALE

Avant de laisser le bot tourner en production :

- [ ] Stripe est en mode LIVE (si tu veux de vrais paiements)
- [ ] Webhook Stripe est configuré et testé
- [ ] Discord webhook configuré (notifications)
- [ ] ElevenLabs API key configurée (voix ultra-réaliste)
- [ ] Google Places API key avec quota suffisant
- [ ] Base de données backupée régulièrement
- [ ] Monitoring mis en place (Sentry optionnel)
- [ ] Bot status = active ✅
- [ ] Premier cycle de prospection testé
- [ ] Premier appel testé
- [ ] Premier devis envoyé et testé
- [ ] Génération workflow client testée

---

## 🚀 C'EST PARTI !

Une fois tout configuré :

```bash
# 1. Démarrer le serveur
docker compose up -d

# 2. Activer le bot
curl -X POST http://localhost:3000/api/bot/start

# 3. Ouvrir le dashboard
open http://localhost:5173

# 4. Laisser tourner et observer les ventes arriver ! 💰
```

**Le bot va maintenant :**
- ✅ Prospecter automatiquement chaque jour à 9h
- ✅ Appeler 50 prospects par jour (toutes les 20min)
- ✅ Envoyer les devis automatiquement
- ✅ Gérer les relances automatiquement
- ✅ Créer les clients automatiquement après paiement
- ✅ Générer et livrer les workflows automatiquement
- ✅ Recommencer en boucle, tous les jours

**Objectif : 3-5 ventes par mois = 1,000€+ MRR avec zéro intervention !** 🎉
