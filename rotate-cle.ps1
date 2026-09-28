# Remplace le secret partage entre qwillio-master et qwillio-voice-core.
#
#   .\rotate-cle.ps1
#
# La nouvelle cle va dans le PRESSE-PAPIERS, jamais a l'ecran : elle n'a a
# apparaitre ni dans ce terminal, ni dans un historique, ni dans une
# conversation. Le script n'affiche qu'une empreinte : assez pour verifier
# que les deux fichiers portent la meme valeur, pas assez pour la refaire.
#
# Il pose aussi VC_PLATFORM_URL sur la production.
#
# WINDOWS POWERSHELL 5.1. C'est ce qui tourne ici, et il porte .NET
# Framework, pas .NET Core : `RandomNumberGenerator::Fill` et
# `SHA256::HashData` n'y existent pas. Les formes utilisees ci-dessous
# marchent sur les deux.

$ErrorActionPreference = 'Stop'

$BRIDGE = 'C:\Users\matpo\Documents\qwillio-bridge\backend\.env'
$CORE   = 'C:\Users\matpo\Documents\qwillio-voice-core\.env.local'

foreach ($f in @($BRIDGE, $CORE)) {
  if (-not (Test-Path $f)) { Write-Host "Introuvable : $f" -ForegroundColor Red; exit 1 }
}

# 48 caracteres alphanumeriques, comme l'ancienne. Ni +, ni /, ni = : aucun
# parseur .env ni aucun shell n'a alors a l'echapper.
#
# TIRAGE PAR REJET. Prendre `octet % 62` biaiserait vers les premieres
# lettres (256 n'est pas un multiple de 62). Le biais serait faible et sans
# consequence pratique ici, mais un generateur de secret est le dernier
# endroit ou ecrire un raccourci qu'on devra rejuger plus tard.
$alpha = [char[]](([char]'0'..[char]'9') + ([char]'A'..[char]'Z') + ([char]'a'..[char]'z'))
$plafond = 256 - (256 % $alpha.Length)   # 248 : au-dela, on retire
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$sb = New-Object System.Text.StringBuilder
$un = [byte[]]::new(1)
while ($sb.Length -lt 48) {
  $rng.GetBytes($un)
  if ($un[0] -lt $plafond) { [void]$sb.Append($alpha[$un[0] % $alpha.Length]) }
}
$cle = $sb.ToString()
$rng.Dispose()

function Remplacer($chemin, $nom, $valeur) {
  # ReadAllText/WriteAllText, PAS Get-Content/Set-Content : ce dernier
  # reecrit toutes les fins de ligne et ajoute un saut final. Ces fichiers
  # sont en CRLF, et un .env qui change entierement a chaque edition rend
  # tout diff illisible.
  $texte = [System.IO.File]::ReadAllText($chemin)

  # Une INSTANCE de Regex, pas la methode statique : la surcharge statique a
  # quatre arguments prend des RegexOptions, pas un compte. `..., 1` y
  # signifierait IgnoreCase et remplacerait TOUTES les occurrences. Seule
  # l'instance sait compter.
  #
  # [^\r\n]* et non .* : sous .NET, `.` mange le \r, et la ligne modifiee
  # repasserait seule en LF au milieu d'un fichier CRLF.
  $re = New-Object System.Text.RegularExpressions.Regex(
    "^$nom=[^`r`n]*", [System.Text.RegularExpressions.RegexOptions]::Multiline)

  # DEUX causes, un seul symptome. `$neuf -eq $texte` est vrai quand la ligne
  # est absente ET quand elle porte deja cette valeur. Les confondre a produit
  # « VC_PLATFORM_URL introuvable » sur un fichier qui le contenait
  # parfaitement, au deuxieme passage du script : le diagnostic envoyait
  # chercher un probleme qui n'existait pas. On teste donc la presence
  # AVANT de remplacer.
  if (-not $re.IsMatch($texte)) {
    Write-Host "$nom absent de $chemin" -ForegroundColor Red; exit 1
  }
  $neuf = $re.Replace($texte, "$nom=$valeur", 1)
  if ($neuf -eq $texte) {
    Write-Host "$nom : deja a cette valeur, rien a faire" -ForegroundColor DarkGray
    return
  }
  [System.IO.File]::WriteAllText($chemin, $neuf, (New-Object System.Text.UTF8Encoding $false))
}

Remplacer $BRIDGE 'VOICE_CORE_API_KEY'  $cle
Remplacer $CORE   'VC_PLATFORM_API_KEY' $cle

# LE PRESSE-PAPIERS ICI, pas a la fin. Les deux fichiers portent desormais la
# nouvelle cle ; si une etape suivante s'arrete, l'utilisateur se retrouve
# avec une cle rotee qu'il n'a nulle part pour la poser sur Render. C'est
# arrive une fois. La cle est livree des qu'elle est ecrite.
Set-Clipboard -Value $cle

Remplacer $CORE   'VC_PLATFORM_URL'     'https://qwillio.onrender.com'

# Relecture : on ne croit pas sur parole ce qu'on vient d'ecrire.
function Lire($chemin, $nom) {
  $re = New-Object System.Text.RegularExpressions.Regex(
    "^$nom=([^`r`n]*)", [System.Text.RegularExpressions.RegexOptions]::Multiline)
  return $re.Match([System.IO.File]::ReadAllText($chemin)).Groups[1].Value
}
$a = Lire $BRIDGE 'VOICE_CORE_API_KEY'
$b = Lire $CORE   'VC_PLATFORM_API_KEY'

$sha = New-Object System.Security.Cryptography.SHA256Managed
$emp = ([System.BitConverter]::ToString(
          $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($a))
        ) -replace '-','').Substring(0, 8).ToLower()
$sha.Dispose()

Write-Host ''
Write-Host "longueur $($a.Length)  |  identiques des deux cotes : $($a -eq $b)  |  empreinte $emp"
Write-Host "URL      : $(Lire $CORE 'VC_PLATFORM_URL')"

Write-Host ''
Write-Host 'La nouvelle cle est dans ton presse-papiers.' -ForegroundColor Green
Write-Host 'Colle-la dans VOICE_CORE_API_KEY sur Render, puis redeploie.'
Write-Host 'Ne la colle nulle part ailleurs.' -ForegroundColor Yellow
