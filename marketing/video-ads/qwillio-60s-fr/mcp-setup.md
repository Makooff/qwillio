# Setup MCPs HeyGen / Higgsfield (optionnel)

Ce guide explique comment automatiser HeyGen et Higgsfield depuis Claude Code via MCP ou REST API direct. **Non requis** pour produire la vidéo — le pack manuel (00-08) suffit.

## État actuel de l'environnement

Vérifié dans cette session :
- Aucun MCP HeyGen exposé (pas de `mcp__heygen__*` dans les outils déférés)
- Aucun MCP Higgsfield exposé (pas de `mcp__higgsfield__*`)
- `.mcp.json` projet : absent
- `~/.claude/.mcp.json` global : pas configuré pour ces services
- `ffmpeg`, `ImageMagick`, `yt-dlp` : non installés

## Option 1 — Ajouter HeyGen MCP officiel

HeyGen a un **MCP officiel** (https://github.com/heygen-com/mcp-server, ou via npm `heygen-mcp` selon disponibilité).

### Création du `.mcp.json`

À la racine du repo `qwillio/`, créer le fichier :

```json
{
  "mcpServers": {
    "heygen": {
      "command": "npx",
      "args": ["-y", "@heygen/mcp-server@latest"],
      "env": {
        "HEYGEN_API_KEY": "VOTRE_CLE_API_ICI"
      }
    }
  }
}
```

### Obtenir la clé API HeyGen

1. Connexion sur https://app.heygen.com
2. Settings → Subscriptions & API → Generate API key
3. Plan minimum requis : **Creator** ($30/mois) pour avoir accès API
4. Coller la clé dans `HEYGEN_API_KEY` du `.mcp.json` (ne JAMAIS commiter cette clé)

### Activation

1. Ajouter `.mcp.json` au `.gitignore` du repo (sécurité)
2. Redémarrer Claude Code dans le projet : la prochaine session chargera le MCP
3. Vérifier dans Claude que `mcp__heygen__*` tools sont visibles

### Une fois activé, je peux faire

- `mcp__heygen__create_avatar_video` : génération avatar depuis un script
- `mcp__heygen__list_avatars` : choisir Anthony, Edward, etc.
- `mcp__heygen__list_voices` : choisir Edouard FR
- `mcp__heygen__get_video_status` : polling jusqu'à fin du rendu
- `mcp__heygen__download_video` : récup MP4 dans `assets/heygen/`

Workflow auto : je lance les 4 takes en série, attends les renders (~2 min chacun), télécharge automatiquement.

## Option 2 — Higgsfield via REST API direct

Higgsfield **n'a pas de MCP officiel** au moment de l'écriture (vérifié, pas de package npm officiel `@higgsfield/mcp`).

### Alternative : appel curl direct

Higgsfield expose une REST API sur https://api.higgsfield.ai (vérifier endpoint exact dans leur docs https://higgsfield.ai/docs).

Workflow possible que je peux scripter :
1. Tu me donnes ta `HIGGSFIELD_API_KEY`
2. Je l'écris dans un `.env.local` (gitignored)
3. Je tape une boucle Bash :
```bash
for prompt in higgs-01 higgs-02 higgs-03 higgs-04 higgs-05 higgs-06; do
  curl -X POST https://api.higgsfield.ai/v1/generations \
    -H "Authorization: Bearer $HIGGSFIELD_API_KEY" \
    -H "Content-Type: application/json" \
    -d @prompts/$prompt.json
done
```
4. Polling sur `GET /v1/generations/{id}` jusqu'à `status=completed`
5. Download des 6 MP4 dans `assets/higgsfield/`

Temps total auto : ~30 min de wall clock, ~5 min de mon temps actif.

## Option 3 — Alternative complète sans Higgsfield

Si Higgsfield ne te convient pas, voici les MCPs / APIs vidéo IA qui ont des MCPs officiels ou des APIs stables :

| Service | MCP officiel | API direct | Coût/mois | Qualité 3D |
|---|---|---|---|---|
| **Runway Gen-3** | ❌ pas encore | ✅ stable | $15 | Excellent |
| **Luma Dream Machine** | ❌ | ✅ stable | $30 | Très bon |
| **Kling AI** | ❌ | ✅ stable | $10 | Bon sur action |
| **Pika Labs** | ❌ | ✅ stable | $10 | Moyen |
| **Veo 3 (Google)** | ❌ | ⚠️ waitlist | TBD | Excellent (top tier) |

Si tu veux explorer une de ces alternatives, dis-moi laquelle, je rédige les prompts adaptés à leur syntaxe.

## Option 4 — ElevenLabs MCP (voix off)

Pour automatiser la voix off (sans avatar HeyGen), il existe un MCP communautaire ElevenLabs :

```json
{
  "mcpServers": {
    "elevenlabs": {
      "command": "npx",
      "args": ["-y", "elevenlabs-mcp"],
      "env": {
        "ELEVENLABS_API_KEY": "VOTRE_CLE"
      }
    }
  }
}
```

Permet de générer les 2 segments VO (problème + preuve) automatiquement, durée ~30 secondes de génération.

## Option 5 — Installation ffmpeg pour assemblage final

Pour que je puisse **assembler la vidéo finale** depuis le terminal (sans DaVinci), il faut `ffmpeg` installé.

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y ffmpeg

# macOS (Homebrew)
brew install ffmpeg

# Windows (winget)
winget install --id=Gyan.FFmpeg
```

Vérification : `ffmpeg -version` doit afficher 4.x ou supérieur.

Avec ffmpeg + tous les assets téléchargés via APIs (HeyGen + Higgsfield + ElevenLabs), je peux scripter le montage final en une seule commande :
```bash
ffmpeg -i bloc1.mp4 -i bloc2.mp4 ... -filter_complex "..." qwillio-60s-fr-v1.mp4
```

Pas de DaVinci nécessaire si on accepte un montage purement programmatique (moins fin sur la color grade et les lower-thirds, mais 80% du chemin couvert).

## Recommandation

**Pour le 1er essai** : reste sur le pack manuel (00-08). Tu valides le résultat créatif, tu fais le tour des outils HeyGen et Higgsfield à la main, tu sens si tu veux re-itérer.

**Si tu veux 2-3 vidéos par mois** : ajoute HeyGen MCP officiel (le plus gros gain auto, l'avatar est répétitif) et garde Higgsfield/edit en manuel.

**Si tu veux 1 vidéo par jour** (campagne intensive) : full auto avec HeyGen MCP + Higgsfield API + ElevenLabs MCP + ffmpeg + un script Node qui chaîne tout. Je peux te coder ce pipeline en ~300 lignes Node.js le moment venu.

## Quand tu seras prêt

Dis-moi :
1. "Configure HeyGen MCP" + colle ta clé API → je crée le `.mcp.json` + `.gitignore` propre
2. "Configure Higgsfield via curl" + colle ta clé → je code le script Bash
3. "Installe ffmpeg" → je te donne la commande exacte pour ton OS
4. "Code pipeline full auto" → je te livre un `generate-video.mjs` qui produit la vidéo de A à Z en une commande

Pour l'instant, le pack manuel suffit pour produire la première vidéo.
