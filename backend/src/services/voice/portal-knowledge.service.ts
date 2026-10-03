import { knowledgePreset } from '../../config/knowledge-presets';

/**
 * Ce qu'un client a rempli dans son portail, rendu comme des entrees de connaissance.
 *
 * ## Le second magasin, et pourquoi ce fichier existe
 *
 * Il y a DEUX endroits ou un client range ce qu'il sait :
 *
 *  - la table `businessKnowledge` — une ligne par question, ecrite par le
 *    generateur d'onboarding ou par la boucle d'apprentissage ;
 *  - le blob `Client.vapiConfig` — ce que le gerant remplit LUI-MEME dans son
 *    portail : `items` (ce qu'il vend), `knowledge` (les champs nommes de son
 *    metier), `faq` / `faqEntries` (ses questions), `hours`.
 *
 * Trois chemins lisent cette connaissance, et ils ont diverge :
 *
 *  - l'assistant ENREGISTRE (`onboarding.service`) lisait les deux ;
 *  - le chemin temps reel (`business-memory.service`) lisait les deux ;
 *  - le pont voice-core (`voice-core.routes.ts`) ne lisait QUE la table.
 *
 * Un restaurateur a donc saisi trente-trois plats avec leurs prix, et sa
 * receptionniste lui a repondu « je n'ai pas l'info » — sur le chemin de l'appel
 * seulement, ce qui est le pire endroit. La donnee n'etait pas perdue, elle
 * etait dans un magasin que ce chemin-la ne lisait pas.
 *
 * Ce module est LA conversion, ecrite une fois. Le prochain lecteur de
 * connaissance l'appelle au lieu d'en ecrire une quatrieme version.
 *
 * ## Les libelles viennent du METIER
 *
 * `knowledgePreset(businessType)` porte, par metier, les libelles des champs ET
 * des categories d'items. Un dentiste a des « Consultations et controles », un
 * avocat des « Honoraires ». Ecrire « Carte » en dur servirait un restaurant et
 * mentirait aux onze autres — le defaut que `niches.ts` decrit lui-meme. Aucun
 * libelle n'est donc fabrique ici : on prend celui du preset, et on retombe sur
 * l'identifiant BRUT quand le metier ou le champ est inconnu. Une valeur saisie
 * par un client vaut mieux brute que perdue.
 */

/** Une entree telle que les consommateurs la lisent (cf. KnowledgeEntry). */
export interface EntreePortail {
  id: string;
  kind: 'faq';
  title: string;
  content: string;
  keywords: string[];
  priority: number;
}

/** Les mots d'un texte, en minuscules, sans les plus courts que 4 lettres. */
function motsUtiles(texte: string): string[] {
  return texte
    .toLowerCase()
    .split(/[^a-z0-9à-ÿ']+/)
    .filter((m) => m.length > 3);
}

/** Les jours, du lundi au dimanche : l'ordre dans lequel on les annonce. */
const JOURS: [string, string][] = [
  ['monday', 'Lundi'], ['tuesday', 'Mardi'], ['wednesday', 'Mercredi'],
  ['thursday', 'Jeudi'], ['friday', 'Vendredi'], ['saturday', 'Samedi'],
  ['sunday', 'Dimanche'],
];

/**
 * UNE ENTREE PAR ITEM, pour l'indexation seulement.
 *
 * ## Pourquoi deux vues du meme magasin
 *
 * Une entree agregee (trente-trois plats en une ligne) est ce qu'il faut au
 * PROMPT : `MAX_ENTREES_PROMPT` vaut 8, et trente-trois lignes evinceraient la
 * FAQ, les regles et l'equipe.
 *
 * Mais elle est ce qu'il ne faut PAS a la RECHERCHE SEMANTIQUE : un vecteur
 * resume un texte, et un vecteur pour trente-trois plats ne ressemble a aucun
 * d'eux. L'embedding de « fruit de mer » ne s'approche ni de « Scampis » ni de
 * « saumon fume » quand les deux sont noyes parmi trente et une autres lignes.
 * Et le seuil d'activation (`VOICE_EMBEDDING_MIN_ENTRIES`, 25) compte des
 * entrees : un client dont toute la base tient en deux entrees agregees compte
 * 2, reste sous le seuil, et n'a jamais de recherche semantique — exactement le
 * cas d'un restaurant avec sa carte complete.
 *
 * D'ou ces deux fonctions. `entreesDepuisVapiConfig` rend ce qui va au prompt,
 * `entreesPourIndexation` rend une entree par item pour que chaque plat porte
 * son propre vecteur. La recherche presente les deux : la semantique retrouve
 * le plat, l'agregee sert de repli lexical et de contexte a lire.
 */
export function entreesPourIndexation(
  cfg: Record<string, unknown> | null | undefined,
  businessType: string | null | undefined,
): EntreePortail[] {
  if (!cfg || typeof cfg !== 'object') return [];

  const preset = knowledgePreset(businessType);
  const libellesCategories = new Map(preset.itemCategories.map((c) => [c.v, c.l]));

  const items = Array.isArray(cfg.items) ? cfg.items : [];
  const sortie: EntreePortail[] = [];

  items.forEach((it, i) => {
    if (!it || typeof it !== 'object') return;
    const { name, price, category } = it as { name?: unknown; price?: unknown; category?: unknown };
    const nom = String(name ?? '').trim();
    if (!nom) return;

    const cat = String(category ?? '').trim();
    const label = cat ? (libellesCategories.get(cat) || cat) : '';
    const prix = String(price ?? '').trim();

    sortie.push({
      id: `portail:item:${i}`,
      kind: 'faq',
      title: nom,
      // « 18€ » seul se lit mal ; « Scampis a l'ail — 18€ » se lit comme une
      // reponse. La categorie vient en contexte, pas en tete : c'est le nom que
      // l'appelant prononce.
      content: [
        prix ? `${nom} — ${prix}` : nom,
        label ? `(${label})` : '',
      ].filter(Boolean).join(' '),
      // Le nom entier suffit : c'est deja ce que l'appelant dit. Les mots
      // detaches sont utiles a la recherche lexicale, pas au vecteur.
      keywords: [nom.toLowerCase()],
      // VOLONTAIREMENT BASSE. Ces entrees servent la RECHERCHE : elles portent
      // chacune leur vecteur pour que « fruit de mer » retrouve les scampis.
      // Elles ne doivent pas monter dans le prompt, ou trente-trois lignes de
      // carte evinceraient la FAQ, les regles et l'equipe — c'est l'entree
      // agregee (`entreesDepuisVapiConfig`) qui represente la carte la-haut.
      priority: 0,
    });
  });

  return sortie;
}

/**
 * Les entrees de connaissance portees par un `vapiConfig`.
 *
 * Ne lit QUE le blob : la table est lue par l'appelant, et les deux listes se
 * concatent la ou elles servent. Rendre une liste vide est le cas normal d'un
 * client qui n'a rien rempli, pas une erreur.
 */
export function entreesDepuisVapiConfig(
  cfg: Record<string, unknown> | null | undefined,
  businessType: string | null | undefined,
): EntreePortail[] {
  if (!cfg || typeof cfg !== 'object') return [];

  const preset = knowledgePreset(businessType);
  const libellesCategories = new Map(preset.itemCategories.map((c) => [c.v, c.l]));
  const libellesChamps = new Map(preset.fields.map((f) => [f.id, f.label]));

  const sortie: EntreePortail[] = [];

  // ── Les items vendables : carte, prestations, forfaits ─────────────────────
  const items = Array.isArray(cfg.items) ? cfg.items : [];
  const propres = items.filter(
    (it): it is { name?: unknown; price?: unknown; category?: unknown } =>
      !!it && typeof it === 'object',
  );

  if (propres.length) {
    // Les mots-cles sont les NOMS des items : c'est ce que l'appelant prononce.
    // « scampis », « detartrage », « vidange » — pas leur categorie.
    const motsCles = new Set<string>();
    const parCategorie = new Map<string, string[]>();

    for (const it of propres) {
      const nom = String(it.name ?? '').trim();
      if (!nom) continue;
      motsCles.add(nom.toLowerCase());
      for (const mot of motsUtiles(nom)) motsCles.add(mot);

      const prix = String(it.price ?? '').trim();
      const cat = String(it.category ?? '').trim();
      const ligne = prix ? `${nom} — ${prix}` : nom;
      if (!parCategorie.has(cat)) parCategorie.set(cat, []);
      parCategorie.get(cat)!.push(ligne);
    }

    const corps = [...parCategorie.entries()]
      // Le libelle du metier quand le preset le connait, l'identifiant brut
      // sinon. Une categorie absente ne prend aucun prefixe plutot que d'en
      // fabriquer un.
      .map(([cat, lignes]) => {
        const label = cat ? (libellesCategories.get(cat) || cat) : '';
        return label ? `${label} : ${lignes.join(' • ')}` : lignes.join(' • ');
      })
      .join('\n');

    // Une liste dont tous les items sont sans nom ne fabrique rien : une entree
    // au contenu vide serait offerte au modele comme une reponse a lire, et il
    // repondrait « voici la liste : (rien) » au lieu d'avouer qu'il ne sait pas.
    if (corps) {
      sortie.push({
        id: 'portail:items',
        kind: 'faq',
        title: 'Prestations et tarifs',
        content: corps,
        keywords: [...motsCles].slice(0, 200),
        // Au-dessus de la FAQ generale : c'est ce qu'un appelant demande au
        // telephone, quel que soit le metier.
        priority: 5,
      });
    }
  }

  // ── Les champs nommes du metier ────────────────────────────────────────────
  // « Mutuelles et conventionnement », « Politique d'annulation », « Acces et
  // stationnement ». Le client les remplit, l'ecran dit enregistre.
  const knowledge = cfg.knowledge;
  if (knowledge && typeof knowledge === 'object' && !Array.isArray(knowledge)) {
    const lignes: string[] = [];
    const motsCles = new Set<string>();
    for (const [id, v] of Object.entries(knowledge as Record<string, unknown>)) {
      if (typeof v !== 'string' || !v.trim()) continue;
      const label = libellesChamps.get(id) || id;
      lignes.push(`- ${label} : ${v.trim()}`);
      for (const mot of motsUtiles(`${label} ${v}`)) motsCles.add(mot);
    }
    if (lignes.length) {
      sortie.push({
        id: 'portail:knowledge',
        kind: 'faq',
        title: 'Informations pratiques',
        content: lignes.join('\n'),
        keywords: [...motsCles].slice(0, 200),
        priority: 3,
      });
    }
  }

  // ── La FAQ du gerant ───────────────────────────────────────────────────────
  // Le gerant ecrit les questions qu'on lui pose le plus, et sa receptionniste
  // ne les avait jamais vues.
  const faqLignes: string[] = [];
  if (Array.isArray(cfg.faqEntries)) {
    for (const e of cfg.faqEntries) {
      if (!e || typeof e !== 'object') continue;
      const { q, a } = e as { q?: unknown; a?: unknown };
      const qq = typeof q === 'string' ? q.trim() : '';
      const aa = typeof a === 'string' ? a.trim() : '';
      if (qq && aa) faqLignes.push(`${qq} → ${aa}`);
    }
  }
  if (typeof cfg.faq === 'string' && cfg.faq.trim()) faqLignes.push(cfg.faq.trim());

  if (faqLignes.length) {
    sortie.push({
      id: 'portail:faq',
      kind: 'faq',
      title: 'Questions fréquentes du commerce',
      content: faqLignes.join('\n'),
      // La formulation du gerant est souvent celle de ses appelants.
      keywords: [...new Set(motsUtiles(faqLignes.join(' ')))].slice(0, 200),
      priority: 3,
    });
  }

  // ── Les horaires ───────────────────────────────────────────────────────────
  // Le blob les porte avec des cles ANGLAISES quel que soit le pays. L'agent les
  // annonce, donc on les rend en clair plutot que de le laisser deviner.
  const hours = cfg.hours && typeof cfg.hours === 'object'
    ? (cfg.hours as Record<string, unknown>)
    : null;
  if (hours && Object.keys(hours).length) {
    const lignes: string[] = [];
    for (const [cle, label] of JOURS) {
      const j = hours[cle];
      if (!j || typeof j !== 'object') continue;
      const { open, from, to } = j as { open?: unknown; from?: unknown; to?: unknown };
      lignes.push(open === false || !from || !to
        ? `${label} : fermé`
        : `${label} : ${String(from)} – ${String(to)}`);
    }
    if (lignes.length) {
      sortie.push({
        id: 'portail:hours',
        kind: 'faq',
        title: 'Horaires d’ouverture',
        content: lignes.join('\n'),
        keywords: ['horaire', 'horaires', 'ouvert', 'ferme', 'ouverture', 'fermeture', 'heure'],
        priority: 4,
      });
    }
  }

  return sortie;
}
