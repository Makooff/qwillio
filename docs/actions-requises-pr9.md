# Actions requises — PR #9 (hardening & quality)

Tutoriel pas à pas de ce que **toi** dois faire. Ordonné par priorité.
La PR : https://github.com/Makooff/qwillio/pull/9

---

## 🔴 1. Rotation du `AUTOFIX_TOKEN` (URGENT — repo public)

Le token était commité dans `.env.autofix` : il est dans l'historique git **public**. Considère-le compromis.

```powershell
# a) Générer un nouveau token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- **b)** Render → service **qwillio-backend** → **Environment** → mets `AUTOFIX_TOKEN` = la nouvelle valeur → **Save** (ça redéploie).
- **c)** Mets la **même** valeur dans ton `backend/.env.autofix` local (le token doit matcher des 2 côtés).

L'ancien token est mort dès que les deux côtés ont la nouvelle valeur.

---

## 🔴 2. Merger la PR #9

1. Ouvre https://github.com/Makooff/qwillio/pull/9
2. Attends que les checks **CI** (Backend · Frontend) soient verts.
3. (Optionnel) relis le diff — sinon les 87 tests + la review CodeRabbit couvrent.
4. **Merge pull request** → **Confirm merge**.
5. (Optionnel) supprime la branche `chore/hardening-quality`.

> Vérif visuelle avant merge : connecte-toi à la **preview Vercel** de la PR
> (`...vercel.app`) avec `makho.off@gmail.com` + ton mot de passe → clique
> Settings / AdminSettings / Landing.

---

## 🟠 3. Baseline migration Prisma en prod (1 seule fois)

Aujourd'hui chaque deploy fait `prisma db push --accept-data-loss` (dangereux).
On bascule vers de vraies migrations. **Prends un snapshot Neon d'abord.**

```powershell
# Récupère le DATABASE_URL prod dans Render → Environment → DATABASE_URL
$env:DATABASE_URL = '<URL_NEON_PROD>'
cd C:\Users\matpo\Documents\Qwillio\backend

# Marque la baseline comme déjà appliquée (NE touche pas les données)
npx prisma migrate resolve --applied 0_init

Remove-Item Env:DATABASE_URL
```

Puis édite `backend/render.yaml` :

```yaml
# AVANT
preDeployCommand: npx prisma db push --accept-data-loss || true
# APRÈS
preDeployCommand: npx prisma migrate deploy
```

Commit + push. À partir de là : `npm run db:migrate` en local pour créer une
migration, et Render l'applique tout seul (`migrate deploy`) à chaque deploy.
Détails complets : `backend/prisma/migrations/README.md`.

---

## 🟡 4. Nettoyer `ADMIN_SEED_PASSWORD`

Tu l'as mis sur Render pour reset ton mot de passe prod. Une fois que tu peux
te connecter sur qwillio.com, **retire la variable** `ADMIN_SEED_PASSWORD` dans
Render → Environment (sinon le seed se rejoue à chaque boot — sans danger, mais
plus propre sans).

---

## 🟢 5. (Recommandé) Purger les secrets de l'historique git

Le repo est **public** et l'historique contient l'ancien `AUTOFIX_TOKEN` + l'ancien
mot de passe admin `Qwillio2026!`. Après les avoir tous rotés (étapes 1 & 4), tu
peux réécrire l'historique pour les effacer :

```powershell
# Installe git-filter-repo (https://github.com/newren/git-filter-repo)
# puis, sur un clone frais :
git filter-repo --invert-paths --path .env.autofix
# (et remplace les littéraux 'Qwillio2026!' via --replace-text)
git push --force --all
```

⚠️ Réécrit l'historique public (force-push) — fais-le quand personne d'autre ne
travaille dessus. Optionnel mais conseillé pour un repo public.

---

## Ce qui reste côté code (moi, sur ta demande)
- `vapi.service` : payload extrait + tests, **gardes circuit-breaker verrouillées
  par un harnais d'intégration**. La découpe complète de l'orchestration de
  `callNextProspect` peut maintenant se faire en sécurité (le filet est là).
