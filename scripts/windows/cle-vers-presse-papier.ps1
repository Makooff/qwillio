# Met la cle partagee ACTUELLE dans le presse-papiers, pour la coller sur Render.
#
#   & C:\Users\matpo\Documents\qwillio-bridge\cle-vers-presse-papier.ps1
#
# Ne genere rien, ne modifie rien : il lit et il copie. A utiliser quand la
# rotation a eu lieu mais que la cle n'est pas arrivee dans le presse-papiers.
# Rien n'est affiche a l'ecran sauf une empreinte.

$ErrorActionPreference = 'Stop'

$BRIDGE = 'C:\Users\matpo\Documents\qwillio-bridge\backend\.env'
$CORE   = 'C:\Users\matpo\Documents\qwillio-voice-core\.env.local'

function Lire($chemin, $nom) {
  if (-not (Test-Path $chemin)) { Write-Host "Introuvable : $chemin" -ForegroundColor Red; exit 1 }
  $re = New-Object System.Text.RegularExpressions.Regex(
    "^$nom=([^`r`n]*)", [System.Text.RegularExpressions.RegexOptions]::Multiline)
  $m = $re.Match([System.IO.File]::ReadAllText($chemin))
  if (-not $m.Success) { Write-Host "$nom absent de $chemin" -ForegroundColor Red; exit 1 }
  return $m.Groups[1].Value
}

$a = Lire $BRIDGE 'VOICE_CORE_API_KEY'
$b = Lire $CORE   'VC_PLATFORM_API_KEY'

if ($a -ne $b) {
  Write-Host ''
  Write-Host 'Les deux fichiers portent des cles DIFFERENTES.' -ForegroundColor Red
  Write-Host 'Lance rotate-cle.ps1 pour les remettre d accord avant de toucher a Render.'
  exit 1
}
if ([string]::IsNullOrWhiteSpace($a)) {
  Write-Host 'La cle est vide. Lance rotate-cle.ps1.' -ForegroundColor Red; exit 1
}

$sha = New-Object System.Security.Cryptography.SHA256Managed
$emp = ([System.BitConverter]::ToString(
          $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($a))
        ) -replace '-','').Substring(0, 8).ToLower()
$sha.Dispose()

Set-Clipboard -Value $a
Write-Host ''
Write-Host "longueur $($a.Length)  |  identiques des deux cotes : True  |  empreinte $emp"
Write-Host "URL      : $(Lire $CORE 'VC_PLATFORM_URL')"
Write-Host ''
Write-Host 'La cle est dans ton presse-papiers.' -ForegroundColor Green
Write-Host 'Colle-la dans VOICE_CORE_API_KEY sur Render, puis redeploie.'
Write-Host 'Ne la colle nulle part ailleurs.' -ForegroundColor Yellow
