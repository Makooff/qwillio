# Skill: security
# Security review — auth, secrets, vulnérabilités

## Trigger
Auth, token, password, mot de passe, API key, paiement, stripe, JWT, session, cookie, login, register, CORS, SQL, XSS, injection

## Comportement

Quand invoqué sur du code lié à la sécurité, vérifier systématiquement :

### Authentification & Sessions

**Tokens JWT**
- Vérifier l'algo (RS256 > HS256 en prod, jamais `none`)
- Expiration courte (access token: 15min, refresh: 7j)
- Pas de données sensibles dans le payload (c'est lisible en base64)
- Stocker refresh token en httpOnly cookie, pas localStorage

**Mots de passe**
- Hashing: bcrypt (cost 12+), argon2id, ou scrypt — jamais MD5/SHA1/SHA256 seuls
- Pas de comparaison directe (timing attack) — utiliser `crypto.timingSafeEqual`
- Politique: min 12 chars, pas de règles stupides qui affaiblissent

**Sessions**
- ID de session aléatoire (min 128 bits d'entropie)
- Renouveler l'ID après login (session fixation)
- Invalider côté serveur à la déconnexion

### API Keys & Secrets

**Ne jamais faire**
```js
// ❌ Secret en dur
const apiKey = "sk-prod-xxxxx"

// ❌ Secret dans les logs
console.log("Request with key:", apiKey)

// ❌ Secret dans les URLs
fetch(`/api?key=${apiKey}`)
```

**Toujours**
```js
// ✅ Variable d'environnement
const apiKey = process.env.API_KEY
if (!apiKey) throw new Error("API_KEY manquante")
```

**Rotation**: documenter comment changer les clés sans downtime

### Injection

**SQL Injection**
```js
// ❌
db.query(`SELECT * FROM users WHERE id = ${userId}`)

// ✅ Paramètres préparés
db.query("SELECT * FROM users WHERE id = $1", [userId])
```

**XSS**
- Échapper tout contenu utilisateur affiché en HTML
- Content-Security-Policy header
- `dangerouslySetInnerHTML` en React = audit obligatoire

**Command Injection**
```js
// ❌
exec(`ls ${userInput}`)

// ✅
execFile('ls', [userInput])
```

### OWASP Top 10 — checklist rapide

- [ ] Injection (SQL, NoSQL, cmd, LDAP)
- [ ] Auth cassée (brute force, enumération)
- [ ] Exposition données sensibles (logs, errors, API responses)
- [ ] XXE (parsers XML)
- [ ] Contrôle d'accès défaillant (IDOR, privilege escalation)
- [ ] Mauvaise config sécurité (headers, CORS trop ouvert)
- [ ] XSS
- [ ] Désérialisation non sécurisée
- [ ] Composants vulnérables (`npm audit`)
- [ ] Logs insuffisants (pas de traces pour les incidents)

### Headers HTTP essentiels

```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
```
