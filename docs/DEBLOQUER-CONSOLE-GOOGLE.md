# Débloquer la console Google — rôle manquant

> Constaté le 3 octobre 2026 en lisant la console du projet `pulse-483522`.
> À régler **avant** d'ouvrir le Centre de validation, sinon le bouton de
> soumission refusera la demande.

---

## Ce qui se passe

En ouvrant `Google Auth Platform`, la console affiche :

> **« Vous avez besoin d'une autorisation d'accès supplémentaire »**

avec la liste précise de ce qui manque :

| Permission manquante | À quoi elle sert |
|---|---|
| `oauthconfig.verification.get` | **Lire et soumettre le dossier de vérification** |
| `oauthconfig.testusers.get` | Lire la liste des utilisateurs de test |
| `resourcemanager.projects.get` | Lire les informations du projet |

Google indique lui-même quel rôle les contient : **« Lecteur de configuration
OAuth »** (`roles/oauthconfig.viewer`).

**Ce n'est pas une panne, et ce n'est pas grave.** C'est la conséquence normale
d'un compte qui a créé le projet sans l'administrer. Le projet `pulse-483522`
existe pourtant, le client OAuth existe, l'écran de consentement existe et il
est **en production** : rien de tout cela n'est perdu.

---

## Pourquoi ça peut bloquer la soumission

Le bouton **« Accéder au centre de validation »** mène à une page qui lit
`oauthconfig.verification.get`. Si la permission manque, la page s'ouvre sur le
même message d'accès refusé, et la soumission est impossible.

Cas favorable : le rôle est peut-être accordé ailleurs (au niveau du dossier ou
de l'organisation), et seule cette page-ci est restreinte. **À vérifier en
essayant d'ouvrir le Centre de validation**, pas en lisant ce document.

---

## Comment accorder le rôle

### Si tu es propriétaire du projet

1. Va sur **https://console.cloud.google.com/iam-admin/iam?project=pulse-483522**
2. Cherche ton adresse dans la liste des principaux
3. Clique le **crayon** en face de ton compte
4. **Ajouter un autre rôle** → cherche `Lecteur de configuration OAuth`
   (ou colle `roles/oauthconfig.viewer`)
5. **Enregistrer**

L'effet prend quelques secondes. Recharge la console.

### Si tu n'es pas propriétaire

Le projet appartient peut-être à un compte Google dont tu t'es servi il y a
longtemps, ou à une organisation. Dans ce cas, c'est le propriétaire qui doit
accorder le rôle.

**Le plus simple si personne ne peut le faire :** recréer le client OAuth sur un
projet dont tu es propriétaire. C'est 15 minutes, et ça t'évite une dépendance :

1. Créer un projet neuf
2. Activer l'API **Google Calendar**
3. Configurer l'écran de consentement (nom, domaine `qwillio.com`, politique de
   confidentialité `https://qwillio.com/privacy`)
4. Créer un **ID client OAuth** de type *Application web*
5. Origines : `https://qwillio.com`, `https://www.qwillio.com`, `http://localhost:4188`
6. Redirection : `https://qwillio.com/dashboard/receptionist`
7. Remplacer `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans Render
8. Coller le nouvel ID dans `.env.production` du frontend, puis redéployer

⚠️ Changer de client OAuth **révoque les autorisations existantes** : chaque
client déjà connecté devra reconnecter son agenda. À faire maintenant, tant
qu'il n'y a qu'un compte de test, ou attendre.

---

## Ce qui reste vrai quoi qu'il arrive

- Le client OAuth actuel fonctionne : la vidéo du 3 octobre montre l'écran de
  consentement avec les **deux bonnes permissions**.
- Le domaine est bon (`qwillio.com`, deux `l`), le site répond, les pages
  légales sont en ligne.
- Le dossier de vérification est prêt : `docs/VERIFICATION-GOOGLE.md`
- Le scénario vidéo est prêt : `docs/VIDEO-A-REFILMER.md`

Le rôle manquant est le **dernier obstacle administratif**, pas un problème
technique.
