# Branche le pont voice-core sur le depot : commit, push, pull request.
#
#   .\brancher.ps1
#
# NE FAIT AUCUN `git add -A`. Les quatre fichiers du pont sont nommes un par
# un : un `add -A` ici ramasserait tout ce qui traine dans l'arbre de travail,
# et c'est comme ca qu'un fichier local part en revue sans que personne le
# voie. Le script s'arrete si l'index contient autre chose.

# PAS de 'Stop'. git ecrit sa progression sur stderr, et sous 'Stop'
# PowerShell transforme ces lignes en NativeCommandError : le script mourrait
# sur un push qui a parfaitement reussi. On lit $LASTEXITCODE a la place.
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

function Verifier($etape) {
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Echec : $etape (code $LASTEXITCODE)" -ForegroundColor Red
    exit 1
  }
}

$fichiers = @(
  'backend/src/middleware/voice-core.middleware.ts',
  'backend/src/routes/voice-core.routes.ts',
  'backend/src/__tests__/voice-core-bridge.test.ts',
  'backend/src/server.ts',
  'backend/src/services/voice/tool-runtime.service.ts',
  '.env.example'
)

# --- 1. La branche ---------------------------------------------------------
$branche = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branche -ne 'voice-core-bridge') {
  Write-Host "Branche courante : $branche (attendu voice-core-bridge). Arret." -ForegroundColor Red
  exit 1
}

# --- 2. Le seed reste local ------------------------------------------------
# Il porte un numero de telephone et une adresse e-mail reels : il sert a
# essayer le pont sur cette machine, il n'a rien a faire dans le depot.
$exclude = '.git/info/exclude'
if (-not (Select-String -Path $exclude -Pattern 'seed-voice-core' -Quiet)) {
  Add-Content -Path $exclude -Value 'backend/prisma/seed-voice-core.mjs'
  Write-Host 'seed-voice-core.mjs : ignore localement' -ForegroundColor DarkGray
}

# --- 3. On ne pousse pas ce qui ne compile pas -----------------------------
Push-Location backend
Write-Host 'tsc --noEmit ...' -ForegroundColor DarkGray
npx --no-install tsc --noEmit
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host 'TypeScript refuse. Arret.' -ForegroundColor Red; exit 1 }
Write-Host 'vitest ...' -ForegroundColor DarkGray
npx --no-install vitest run src/__tests__/voice-core-bridge.test.ts
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host 'Tests en echec. Arret.' -ForegroundColor Red; exit 1 }
Pop-Location
Write-Host ''

# --- 4. L'index ------------------------------------------------------------
git reset --quiet
foreach ($f in $fichiers) {
  if (-not (Test-Path $f)) { Write-Host "Manquant : $f" -ForegroundColor Red; exit 1 }
  git add -- $f
  Verifier "git add $f"
}

$stagees = (git diff --cached --name-only) -split "`n" | Where-Object { $_ }
$attendu = $fichiers | Sort-Object
$obtenu  = $stagees  | Sort-Object
if (Compare-Object $attendu $obtenu) {
  Write-Host 'Index inattendu :' -ForegroundColor Red
  $obtenu | ForEach-Object { Write-Host "  $_" }
  exit 1
}

Write-Host ''
Write-Host 'A committer :' -ForegroundColor Cyan
git diff --cached --stat
Write-Host ''

# --- 5. Le commit ----------------------------------------------------------
$message = @'
feat(voice-core): le pont vers le nouveau coeur vocal

Deux routes, et c'est tout le contrat entre `qwillio-voice-core` (Python,
LiveKit) et cette plateforme :

  GET  /api/voice-core/context/by-number/:trunkNumber   au decroche
  POST /api/voice-core/calls                            en fin d'appel

Trois decisions portent le reste.

`voice-core` n'ECRIT JAMAIS dans cette base. Deux processus qui ecrivent le
meme agenda avec deux logiques de verrouillage produisent des doubles
reservations qu'aucun des deux ne voit. Tout passe par ces routes.

Le profil n'est PAS reconstruit ici : `realtimeContextService` est deja la
source de verite du portail et de l'agent Vapi. Une seconde lecture ecrite a
la main divergerait de la premiere au premier reglage ajoute, et l'ecart ne
se verrait qu'en appel.

Un numero s'ecrit `+32460258033` chez Twilio, `32460258033` dans un import et
`0460258033` quand le client le tape. Une egalite exacte ratait le client
sans rien dire : la requete reussissait et ne trouvait rien, et l'agent
decrochait au nom de « Qwillio » chez un client qui paie pour le sien.
`ecrituresDuNumero` couvre les six formes.

ADDITIF au sens strict : aucune route existante n'est modifiee, aucune
colonne n'est ajoutee, et rien de ceci ne s'execute tant qu'un numero ne
pointe pas vers `voice-core` dans la console Twilio. La bascule se fait
numero par numero ; revenir en arriere, c'est remettre l'ancienne URI
d'origination sur ce numero-la, sans redeploiement.

Le middleware echoue FERME : sans `VOICE_CORE_API_KEY`, il repond 503 et non
200. Une comparaison a temps constant sur les empreintes sha256 evite de
distinguer une cle fausse d'une cle absente au chronometre.

`voiceMode` est laisse a NULL deliberement : y ecrire 'realtime' facturerait
l'option Superagent.

LE BRANCHEMENT SUR L'EXISTANT. La remontee de fin d'appel n'ecrit pas
`ClientCall` elle-meme : elle passe par `clientCallService.handleClient-
CallCompleted`, le chemin que prend deja un appel Vapi. `voice-core` herite
donc du bouclier anti-spam, de l'analyse du transcript, du nom confirme de
l'appelant, du score de lead, de la fiche CRM, de la reservation de
rattrapage, des alertes, du quota du forfait et de l'echeance de
conservation (LEG-4). La premiere version ecrivait en direct et remplissait
le tableau de bord de lignes vides : une duree, rien d'autre.

Le POST repond 202 AVANT de travailler : l'analyse appelle GPT-4, et
`voice-core` coupe sa remontee a 10 s depuis son `shutdown_callback`. Deux
verrous contre la double fiche, l'un en memoire pour la fenetre de
traitement, l'autre en base sur `vapiCallId`.

Cote `voice-core`, `agent.py` accumule enfin le transcript des deux roles et
l'envoie. Sans lui, toute l'analyse ci-dessus s'execute sur une chaine vide.

`tsc --noEmit` silencieux.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TSzi7GyoeTgeoCcnXnfzGN
'@

$tmp = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmp, $message, (New-Object System.Text.UTF8Encoding $false))
git commit --file $tmp
Remove-Item $tmp
Verifier 'commit'

# --- 6. Le push ------------------------------------------------------------
git push -u origin voice-core-bridge
Verifier 'push'

# --- 7. La pull request ----------------------------------------------------
$corps = @'
## Ce que c'est

Le pont entre cette plateforme et `qwillio-voice-core`, le nouveau coeur
vocal (Python / LiveKit) qui remplacera Vapi. Deux routes :

| Route | Quand | Role |
|---|---|---|
| `GET /api/voice-core/context/by-number/:trunkNumber` | au decroche | le profil du client appele |
| `POST /api/voice-core/calls` | en fin d'appel | l'appel journalise |

## Pourquoi c'est sans risque

**Rien ne s'execute** tant qu'un numero ne pointe pas vers `voice-core` dans
la console Twilio. Aucune route existante n'est modifiee, aucune colonne
n'est ajoutee, aucune migration. La bascule se fait **numero par numero**, et
revenir en arriere consiste a remettre l'ancienne URI d'origination sur ce
numero-la : pas de redeploiement.

## Les trois decisions qui portent le reste

**`voice-core` n'ecrit jamais dans cette base.** Deux processus qui ecrivent
le meme agenda avec deux logiques de verrouillage produisent des doubles
reservations qu'aucun des deux ne voit. Tout passe par ces routes.

**Le profil n'est pas reconstruit ici.** `realtimeContextService` est deja la
source de verite du portail et de l'agent Vapi. Une seconde lecture ecrite a
la main divergerait de la premiere au premier reglage ajoute, et l'ecart ne
se verrait qu'en appel.

**Un numero a six ecritures.** `+32460258033` chez Twilio, `32460258033` dans
un import, `0460258033` quand le client le tape. Une egalite exacte ratait le
client *sans rien dire* : la requete reussissait et ne trouvait rien, et
l'agent decrochait au nom de « Qwillio » chez un client qui paie pour le
sien. `ecrituresDuNumero` couvre les six, et c'est teste.

## Details qui meritent un oeil en revue

- Le middleware **echoue ferme** : sans `VOICE_CORE_API_KEY`, 503, pas 200.
  Comparaison a temps constant sur empreintes sha256, pour qu'une cle fausse
  et une cle absente ne se distinguent pas au chronometre.
- Il lit `process.env` directement plutot que `src/config/env.ts`. C'est un
  ecart assume a la convention du depot, pour que la garde ne dependre pas du
  chargement d'un module de config ; a normaliser si vous preferez.
- Les consignes par ligne **s'ajoutent** a celles du client, elles ne les
  remplacent pas — c'est ce que dit le schema.
- `voiceMode` reste NULL **deliberement** : y ecrire `'realtime'` facturerait
  l'option Superagent.
- `POST /calls` fait un upsert sur `vapiCallId = room`, donc un renvoi en
  double ne cree pas deux appels.

## Verifications

- `npx tsc --noEmit` — silencieux
- `npx vitest run src/__tests__/voice-core-bridge.test.ts` — 9 tests

## Ce qui n'est PAS dans cette PR

L'hebergement du worker (encore sur un portable), la bascule d'un numero de
production, et le seed de test local.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01TSzi7GyoeTgeoCcnXnfzGN
'@

$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($gh) {
  $tmp2 = [System.IO.Path]::GetTempFileName()
  [System.IO.File]::WriteAllText($tmp2, $corps, (New-Object System.Text.UTF8Encoding $false))
  gh pr create --base master --head voice-core-bridge `
    --title 'feat(voice-core): le pont vers le nouveau coeur vocal' `
    --body-file $tmp2
  Remove-Item $tmp2
} else {
  Write-Host ''
  Write-Host 'gh introuvable. Ouvre la PR ici :' -ForegroundColor Yellow
  Write-Host '  https://github.com/Makooff/qwillio/compare/master...voice-core-bridge?expand=1'
  Write-Host ''
  Write-Host 'Le texte de la PR est dans PR-voice-core.md, a la racine du depot.'
  [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'PR-voice-core.md'), $corps, (New-Object System.Text.UTF8Encoding $false))
}
