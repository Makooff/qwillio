# Base de références 21st.dev — source de vérité des blocs V2

Règle (phase 8, demande utilisateur) : chaque bloc du site se reconstruit à partir du
VRAI code/design de ces références, jamais de mémoire. Ce dossier est la base stockée
et réutilisée pour la cohérence de tout le site. Les `source.tsx` sont les codes bruts
récupérés via le MCP 21st : ne pas les modifier, adapter dans `frontend/src`.

État au 2026-08-04 (soir) :

| Référence | Auteur | Type | Id | Code |
|---|---|---|---|---|
| features-7 | @meschacirung | composant | 1905 | `features-7/source.tsx` RÉCUPÉRÉ |
| section-with-mockup | @aghasisahakyan1 | composant | 1913 | `section-with-mockup/source.tsx` RÉCUPÉRÉ |
| circular-carousel | @nexus-ui | composant | 21951 | EN ATTENTE — limite gratuite 21st (2 récupérations/jour), reset 00:00 UTC |
| gradient pixel-blush | communauté | gradient builder | — | page bloquée (403 réseau) ; repli : code d'un gradient du même builder (Sunset Blush id 19457, même structure CSS, palette recalée charte) à récupérer après reset |
| impact-section | @anish-1144 | composant | — | INTROUVABLE au catalogue (retiré ; le profil public n'a plus que « Folder ») — choisir un remplaçant avec l'utilisateur |
| Synth AI (« mon grand préféré ») | @serafimcloud | template payant | 396 | PAS de code via MCP — template à 199 $ ; preview : 21st.dev/community/templates/synth-ai |
| Folio | @ruixen.ui | template payant | 725 | PAS de code via MCP — 39 $ ; 21st.dev/community/templates/folio-open-source-data-intelligence-landing-template |
| Lumen | @shadcnblockscom | template payant | 440 | PAS de code via MCP — 79 $ ; 21st.dev/community/templates/lumen |
| Mosa AI | @nextjsshop | template payant | 720 | PAS de code via MCP — 119 $ ; 21st.dev/community/templates/mosa-ai |
| Agent-AI | @nextjsshop | template payant | 722 | PAS de code via MCP — 139 $ ; 21st.dev/community/templates/agent-ai |
| Agenforce | @serafimcloud | template payant | 402 | PAS de code via MCP — 49 $ ; 21st.dev/community/templates/agenforce-marketing-template |

Contraintes d'accès constatées :
- MCP 21st : `get_component` limité à 2/jour en gratuit ; les TEMPLATES n'exposent
  jamais leur code par l'API (achat sur le site uniquement).
- Réseau session : 21st.dev et cdn.21st.dev bloqués (403 proxy) — pas de scraping,
  pas de téléchargement des previews.
- Conséquence : pour les templates, la fidélité au code exige que l'utilisateur
  achète et uploade les zips (comme gsappublic.zip) ; sinon adaptation visuelle
  depuis les previews/captures, annoncée comme telle.
