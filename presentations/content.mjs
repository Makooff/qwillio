/**
 * Le contenu des decks, séparé du gabarit qui le met en page.
 *
 * Même raison que `pages/v2/pricing-plans.ts` : ce sont des ARGUMENTS
 * commerciaux, et un argument qu'on ne peut pas relire sans monter un moteur
 * de rendu est un argument que personne ne relit. Ici, lire le fichier suffit
 * à valider ce qui sera dit à un client.
 *
 * Quelques champs portent du HTML en ligne, et un seul motif : le mot en
 * serif italique du titre (`<i>`), qui est une règle de la charte
 * (DA/typographie.md) et ne peut donc pas être deviné par le gabarit. Rien
 * d'autre n'est balisé ici.
 *
 * Les espaces insécables ne sont pas écrites à la main : `frenchSpacing()`
 * dans render.mjs les pose. Les écrire ici rendrait le texte illisible dans
 * un éditeur, et une seule oubliée se verrait à l'impression.
 */

export const BRAND = {
  name: 'Qwillio',
  site: 'qwillio.com',
  email: 'hello@qwillio.com',
  phone: '+32 483 62 09 80',
  /* Une année commerciale prudente. 45 et non 52 : les fermetures, les congés
     et les semaines creuses ne produisent pas d'appels manqués, et un calcul
     qui gonfle son hypothèse perd sa crédibilité à la première objection. */
  weeksPerYear: 45,
};

/* ── Ce qui est vrai de Qwillio quel que soit le métier ─────────────── */

export const COMMON = {
  intro: {
    eyebrow: 'Qwillio',
    title: 'Elle ne prend pas de messages.<br>Elle prend des <i>rendez-vous</i>.',
    lead:
      'Une réceptionniste vocale qui décroche sur votre numéro, tient une vraie conversation en français comme en anglais, et agit avant de raccrocher.',
    points: [
      {
        title: 'Elle décroche 24 h sur 24',
        body:
          'La nuit, le week-end, les jours fériés, et pendant que votre ligne est déjà occupée. Personne n’attend, personne ne tombe sur un répondeur.',
      },
      {
        title: 'Elle agit pendant l’appel',
        body:
          'Elle lit votre agenda, pose le rendez-vous, envoie la confirmation par SMS, transfère quand c’est urgent. La chose est faite avant de raccrocher.',
      },
      {
        title: 'Elle vous ressemble',
        body:
          'Sa voix, son ton, vos horaires, vos règles, vos tarifs. Vous la réglez en lui parlant dans le chat, pas en remplissant un formulaire de quarante champs.',
      },
    ],
  },

  natural: {
    eyebrow: 'Au naturel',
    title: 'Elle ne sonne pas comme un <i>serveur</i> vocal.',
    lead:
      'Un menu vocal, on le subit une fois. Ces quatre comportements font la différence entre une machine et quelqu’un qui répond.',
    items: [
      {
        title: 'Coupez-la, elle s’arrête net',
        body: 'En pleine phrase, elle se tait. Une toux ne la déstabilise pas.',
        tone: 'ink',
      },
      {
        title: 'Elle acquiesce sans vous engager',
        body:
          'Elle glisse des « mhm » pendant que vous parlez, jamais un « oui » qui vaudrait engagement.',
        tone: 'band',
      },
      {
        title: 'Un blanc ne la fait pas raccrocher',
        body: 'Après quelques secondes sans réponse, elle relance « vous êtes toujours là ? ».',
        tone: 'band',
      },
      {
        title: 'Un appelant agacé change son ton',
        body: 'Phrases courtes, zéro discours commercial, un humain proposé plus tôt.',
        tone: 'indigo',
      },
    ],
  },

  after: {
    eyebrow: 'Après l’appel',
    title: 'Rien ne se <i>perd</i>.',
    points: [
      {
        title: 'La transcription intégrale',
        body: 'Chaque appel est écrit, horodaté, cherchable. Vous relisez au lieu de vous souvenir.',
      },
      {
        title: 'Le résumé et l’humeur',
        body:
          'Ce que voulait l’appelant, ce qui a été décidé, et sur quel ton l’échange s’est terminé.',
      },
      {
        title: 'La fiche part où vous travaillez',
        body: 'Agenda, CRM, e-mail, SMS. Le rendez-vous n’attend pas une ressaisie du lendemain.',
      },
    ],
  },

  setup: {
    eyebrow: 'Mise en route',
    title: 'En ligne le <i>jour</i> même.',
    steps: [
      {
        title: 'Dites-lui votre maison',
        body: '« Ouvre le samedi de 9 h à 13 h. » Vous l’écrivez dans le chat, c’est réglé.',
      },
      {
        title: 'Photographiez ce qui existe déjà',
        body:
          'Votre carte, vos tarifs, votre liste de services. Elle en extrait le contenu, vous confirmez.',
      },
      {
        title: 'Appelez-la pour l’essayer',
        body:
          'Un vrai appel de test dans le navigateur, avec sa vraie voix et votre vraie configuration.',
      },
    ],
    note:
      'Aucun matériel, aucun changement de numéro : votre ligne est renvoyée vers elle, et le renvoi se coupe en une manipulation le jour où vous le décidez.',
  },

  truth: {
    eyebrow: 'Sans détour',
    title: 'Ce que nous ne <i>promettons</i> pas.',
    lead:
      'Trois choses qu’un commercial vous dirait autrement, et qu’il vaut mieux lire ici que découvrir dans trois mois.',
    items: [
      {
        title: 'Ce n’est pas un humain, et elle le dit',
        body:
          'Elle annonce qu’elle est une assistante et que l’appel est enregistré. Vos clients ne l’apprennent pas après coup.',
      },
      {
        title: 'Elle ne remplace pas votre équipe',
        body:
          'Elle prend les appels que personne ne peut prendre, et passe la main dès qu’un humain fait mieux qu’elle.',
      },
      {
        title: 'Nos serveurs ne sont pas encore en Europe',
        body:
          'Le traitement est conforme au RGPD, l’enregistrement est annoncé, rien n’est vendu ni utilisé pour entraîner un modèle externe sans votre accord, tout s’efface sur demande. Nous n’écrirons pas « hébergé en Europe » tant que ce ne sera pas vrai.',
      },
    ],
  },

  cta: {
    eyebrow: 'Prochaine étape',
    title: 'Entendez-la décrocher avant de <i>décider</i>.',
    lead:
      'La démonstration se fait sur votre métier, avec vos horaires et vos règles. Vous jugez sur ce que vous entendez, pas sur ce qui est écrit dans ces pages.',
    steps: [
      {
        title: 'Un appel de démonstration',
        body: 'Vous l’appelez, déjà configurée pour votre métier. Dix minutes suffisent pour juger.',
      },
      {
        title: 'Sept jours d’essai',
        body: 'Sur votre vrai numéro, avec vos vraies règles, sans frais d’installation.',
      },
      {
        title: 'Vous gardez la main',
        body: 'Vous coupez le renvoi, vous reprenez votre ligne. Il n’y a rien à désinstaller.',
      },
    ],
  },
};

/* ── Les quatre métiers ─────────────────────────────────────────────── */

export const SECTORS = [
  {
    slug: 'concession-automobile',
    label: 'Concession automobile',
    cover: {
      title: 'Vente, atelier, pièces.<br>Une seule <i>ligne</i>.',
      lead:
        'Vos appels arrivent tous sur le même numéro, aux heures où votre équipe est en showroom ou sous un capot. Voici ce qu’une réceptionniste qui décroche vraiment change à votre semaine.',
    },
    pain: {
      eyebrow: 'Le problème',
      title: 'Le samedi à 11 h, personne n’est libre pour <i>répondre</i>.',
      lead:
        'Ce n’est pas un défaut d’organisation. C’est le moment où vos clients sont disponibles, donc celui où ils appellent, donc celui où vous êtes tous en clientèle.',
      steps: [
        {
          mark: '0 s',
          text: 'Le téléphone sonne à l’accueil. Deux clients attendent au comptoir, un troisième part en essai.',
        },
        {
          mark: '25 s',
          text: 'L’appelant tombe sur la messagerie. Il ne laisse pas de message : il a trois autres annonces ouvertes.',
        },
        {
          mark: '2 min',
          text: 'Le même modèle est en vente à trente kilomètres. Là-bas, quelqu’un décroche.',
        },
        {
          mark: 'Lundi',
          text: 'Vous rappelez. L’essai est déjà réservé ailleurs, et rien dans votre semaine ne dira que cet appel valait une vente.',
        },
      ],
    },
    cost: {
      missed: 5,
      oneIn: 10,
      value: 900,
      valueLabel: 'de marge sur une vente',
      outcome: 'aurait acheté',
    },
    call: {
      eyebrow: 'Un appel, samedi 11 h 04',
      title: 'Elle ne note pas la demande.<br>Elle la <i>traite</i>.',
      lines: [
        {
          who: 'caller',
          text: 'Bonjour, la Golf grise annoncée à 18 900 €, elle est toujours disponible ?',
          note: 'Vos annonces et votre stock sont dans sa fiche. Ce qui part le matin, elle le sait à l’appel suivant.',
        },
        {
          who: 'agent',
          text: 'Oui, elle est encore là. Vous voulez l’essayer ? J’ai samedi 11 h ou lundi 17 h.',
        },
        { who: 'caller', text: 'Samedi. Et j’ai une Clio à reprendre.' },
        {
          who: 'agent',
          text: 'Je note la reprise. Année, kilométrage, état général ? Le vendeur aura tout avant votre venue.',
          note: 'Reprise, budget, financement : la qualification est faite avant que le vendeur ouvre le dossier.',
        },
        { who: 'caller', text: '2016, 94 000 km, rien à signaler.' },
        {
          who: 'agent',
          text: 'C’est réservé samedi à 11 h. Vous recevez la confirmation par SMS.',
          note: 'Le rendez-vous existe dans l’agenda avant qu’elle raccroche, et le vendeur reçoit le brief.',
        },
      ],
    },
    during: {
      eyebrow: 'Pendant l’appel',
      title: 'Quatre choses qu’un répondeur ne fait <i>pas</i>.',
      items: [
        {
          title: 'Elle sait qui doit répondre',
          body:
            'Vente, atelier, pièces. Deux questions, puis elle route vers le bon poste ou prend le rendez-vous elle-même.',
        },
        {
          title: 'Elle lit vos disponibilités',
          body:
            'Agenda connecté, elle propose un créneau d’essai ou de passage atelier pendant que le client est encore en ligne.',
        },
        {
          title: 'Elle vous briefe avant de transférer',
          body:
            'Quand l’appel doit vous parvenir, elle dit d’abord qui appelle et pourquoi, à l’oral et par SMS.',
        },
        {
          title: 'Elle reconnaît vos clients',
          body:
            'Un client déjà passé est salué par son prénom, et elle ne redemande pas le modèle qu’elle a noté le mois dernier.',
        },
      ],
    },
    record: {
      duration: '2 min 41',
      intent: 'Essai VO, Golf grise',
      outcome: 'Rendez-vous samedi 11 h',
      lines: ['Reprise Clio 2016, 94 000 km', 'Financement à évoquer', 'Humeur : intéressée, pressée'],
    },
    gains: {
      eyebrow: 'Ce que ça change',
      title: 'Pour une <i>concession</i>, précisément.',
      items: [
        {
          title: 'Le samedi cesse d’être une fuite',
          body:
            'Le jour où votre équipe est la moins disponible est celui où l’on vous appelle le plus. Ces appels-là sont pris sans que personne quitte le showroom.',
        },
        {
          title: 'Un dossier prêt avant le rendez-vous',
          body: 'Reprise, budget, délai. Votre vendeur ouvre la porte en sachant à qui il parle.',
        },
        {
          title: 'L’atelier garde ses créneaux',
          body: 'Révision, pneus, carrosserie : la demande se pose dans le planning, même à 21 h.',
        },
        {
          title: 'Le soir et le dimanche comptent',
          body: 'C’est là que l’on regarde les annonces, et là que vos concurrents ne répondent pas non plus.',
        },
      ],
    },
    closeLine:
      'Vous n’avez pas besoin d’un standard de plus. Vous avez besoin que le samedi arrête de coûter.',
  },

  {
    slug: 'patisserie-trompe-loeil',
    label: 'Pâtisserie en trompe-l’œil',
    cover: {
      title: 'Vos mains sont dans la <i>ganache</i>.<br>Le téléphone, lui, n’attend pas.',
      lead:
        'Chaque pièce sur mesure commence par un appel de dix minutes : la date, les parts, le thème, les allergies. Voici qui peut le prendre à votre place, sans rien perdre du brief.',
    },
    pain: {
      eyebrow: 'Le problème',
      title: 'Une commande sur mesure ne se rattrape pas le <i>lendemain</i>.',
      lead:
        'Un appel manqué en boutique se rattrape. Un appel manqué pour une pièce d’anniversaire, non : la date est dans dix jours, et la personne cherche déjà ailleurs.',
      steps: [
        {
          mark: '0 s',
          text: 'Le téléphone sonne. Vous êtes en train de couvrir une pièce, vos mains ne peuvent pas s’arrêter.',
        },
        {
          mark: '40 s',
          text: 'La personne raccroche sans laisser de message, ouvre Instagram et écrit à trois autres pâtissiers.',
        },
        {
          mark: 'Le soir',
          text: 'Vous rappelez, personne ne décroche. Vous laissez un message à votre tour.',
        },
        {
          mark: '+3 jours',
          text: 'Elle a commandé ailleurs. Vous ne saurez jamais qu’il s’agissait d’une pièce à 240 €.',
        },
      ],
    },
    cost: {
      missed: 8,
      oneIn: 4,
      value: 140,
      valueLabel: 'de panier moyen sur une pièce',
      outcome: 'aurait commandé',
    },
    call: {
      eyebrow: 'Un appel, mardi 15 h 20',
      title: 'Le brief complet,<br>pas une <i>demi</i>-note.',
      lines: [
        {
          who: 'caller',
          text: 'Bonjour, je voudrais un gâteau qui ressemble à un sac à main, pour le 24.',
        },
        {
          who: 'agent',
          text: 'Le trompe-l’œil demande dix jours de préparation, et nous sommes le 2 : c’est jouable. Pour combien de parts ?',
          note: 'Vos délais et vos minimums sont annoncés pendant l’appel, pas découverts au moment du devis.',
        },
        { who: 'caller', text: 'Une douzaine. Et ma nièce est allergique aux fruits à coque.' },
        {
          who: 'agent',
          text: 'Noté, sans fruits à coque. Je vous envoie par SMS le lien pour déposer votre photo d’inspiration.',
          note: 'La photo de référence arrive dans le dossier, avec le reste du brief.',
        },
        { who: 'caller', text: 'Et pour le prix, on est dans quel ordre d’idée ?' },
        {
          who: 'agent',
          text: 'Je vous donne la fourchette pour cette taille, et la pâtissière confirme le devis avant ce soir.',
          note: 'Elle cadre les attentes, elle n’engage jamais un prix ferme à votre place.',
        },
      ],
    },
    during: {
      eyebrow: 'Pendant l’appel',
      title: 'Quatre choses qu’un répondeur ne fait <i>pas</i>.',
      items: [
        {
          title: 'Elle prend le brief entier',
          body:
            'Date, nombre de parts, thème, couleurs, allergies, retrait ou livraison. Rien ne manque quand vous ouvrez la fiche.',
        },
        {
          title: 'Elle tient vos délais',
          body:
            'Un trompe-l’œil pour après-demain, elle sait le refuser, proposer une autre date, et garder la cliente.',
        },
        {
          title: 'Elle répond aux questions qui reviennent',
          body:
            'Les parts, les parfums, la conservation, le transport. Ce sont toujours les mêmes, et elles ne vous coûtent plus une pause.',
        },
        {
          title: 'Elle vous laisse le devis',
          body: 'Une fourchette, jamais un prix ferme. Le chiffrage reste votre décision, et votre signature.',
        },
      ],
    },
    record: {
      duration: '3 min 12',
      intent: 'Pièce trompe-l’œil, sac à main',
      outcome: 'Devis à envoyer avant ce soir',
      lines: ['12 parts, pour le 24', 'Sans fruits à coque', 'Photo d’inspiration reçue par SMS'],
    },
    gains: {
      eyebrow: 'Ce que ça change',
      title: 'Pour une <i>pâtisserie</i>, précisément.',
      items: [
        {
          title: 'L’atelier n’est plus interrompu',
          body:
            'Vous ne choisissez plus entre finir une pièce et prendre une commande. Les deux se font, et aucune ne se fait à moitié.',
        },
        {
          title: 'Un brief complet à chaque fois',
          body: 'Pas de note sur un ticket de caisse, pas de rappel pour redemander la date.',
        },
        {
          title: 'Les allergènes sont écrits',
          body: 'Demandés pendant l’appel, notés dans la fiche, remontés avec la commande.',
        },
        {
          title: 'Le week-end existe',
          body: 'Les anniversaires se décident le dimanche. La ligne répond quand la boutique est fermée.',
        },
      ],
    },
    closeLine:
      'Vous pouvez continuer à choisir entre l’atelier et le téléphone. Ou arrêter d’avoir à choisir.',
  },

  {
    slug: 'bar',
    label: 'Bar',
    cover: {
      title: 'À 21 h, tout le monde est au <i>bar</i>.<br>Personne n’est au téléphone.',
      lead:
        'Réservations, privatisations, horaires du match : ces appels arrivent en plein service, exactement quand plus personne ne peut décrocher.',
    },
    pain: {
      eyebrow: 'Le problème',
      title: 'Vos meilleures heures sont vos pires heures de <i>standard</i>.',
      lead:
        'Le volume d’appels et le volume de service montent ensemble. C’est la même courbe, et elle joue contre vous deux fois.',
      steps: [
        {
          mark: '20 h 50',
          text: 'Le téléphone sonne derrière le comptoir. Trois commandes attendent, la musique couvre la sonnerie.',
        },
        {
          mark: '21 h 02',
          text: 'Personne n’a décroché. C’était une demande pour quinze personnes vendredi.',
        },
        {
          mark: '21 h 05',
          text: 'Le groupe appelle le bar suivant sur la carte. Là-bas, quelqu’un a le temps.',
        },
        {
          mark: 'Vendredi',
          text: 'Votre salle du fond reste vide, et rien dans votre semaine ne dit pourquoi.',
        },
      ],
    },
    cost: {
      missed: 12,
      oneIn: 5,
      value: 220,
      valueLabel: 'd’addition sur une table de groupe',
      outcome: 'aurait réservé',
    },
    call: {
      eyebrow: 'Un appel, jeudi 20 h 58',
      title: 'Personne ne quitte le comptoir,<br>et le groupe est <i>pris</i>.',
      lines: [
        { who: 'caller', text: 'Vous avez de la place vendredi pour quinze personnes ?' },
        {
          who: 'agent',
          text: 'Quinze, vendredi. À partir de 19 h j’ai la salle du fond. Ça vous convient ?',
          note: 'Vos règles de salle sont les siennes : capacité, horaires, ce qui se réserve et ce qui ne se réserve pas.',
        },
        { who: 'caller', text: 'Parfait. Vous diffusez le match ?' },
        {
          who: 'agent',
          text: 'Sur les deux écrans, coup d’envoi à 20 h 45. Je vous mets des planches à l’arrivée ?',
          note: 'Les questions qui reviennent trente fois par semaine ne mobilisent plus personne.',
        },
        { who: 'caller', text: 'Oui, deux planches.' },
        {
          who: 'agent',
          text: 'C’est noté : quinze personnes à 19 h 30, deux planches. Vous recevez la confirmation par SMS.',
          note: 'Le responsable reçoit le récap, le client son rappel. Moins de tables qui ne viennent pas.',
        },
      ],
    },
    during: {
      eyebrow: 'Pendant l’appel',
      title: 'Quatre choses qu’un répondeur ne fait <i>pas</i>.',
      items: [
        {
          title: 'Elle décroche dans le bruit',
          body:
            'Personne ne sort en terrasse pour s’entendre. Elle prend l’appel pendant que le service continue.',
        },
        {
          title: 'Elle qualifie les groupes',
          body:
            'Nombre, heure, occasion, formule. Une demande de privatisation vous arrive décrite, pas en trois mots.',
        },
        {
          title: 'Elle connaît votre semaine',
          body: 'Horaires, jours de fermeture, concerts, diffusions. Elle répond une fois pour toutes.',
        },
        {
          title: 'Elle réduit les tables fantômes',
          body: 'Confirmation par SMS au moment de la réservation, et le client sait qu’il est attendu.',
        },
      ],
    },
    record: {
      duration: '1 min 48',
      intent: 'Réservation de groupe',
      outcome: '15 couverts vendredi 19 h 30',
      lines: ['Deux planches à l’arrivée', 'Match diffusé, question posée', 'Salle du fond'],
    },
    gains: {
      eyebrow: 'Ce que ça change',
      title: 'Pour un <i>bar</i>, précisément.',
      items: [
        {
          title: 'Le service ne s’arrête plus pour un appel',
          body:
            'Personne ne quitte le comptoir, personne ne crie dans le combiné, et la file d’attente n’allonge pas.',
        },
        {
          title: 'Les privatisations arrivent complètes',
          body: 'Ce sont vos plus grosses additions, et elles se décident presque toujours au téléphone.',
        },
        {
          title: 'Les horaires ne se répètent plus',
          body: 'La question la plus fréquente de votre semaine cesse de coûter du temps à quelqu’un.',
        },
        {
          title: 'Après la fermeture aussi',
          body: 'Une demande à 1 h du matin trouve quelqu’un. Vous la lisez au réveil, déjà qualifiée.',
        },
      ],
    },
    closeLine:
      'Le téléphone sonne exactement quand vous ne pouvez pas répondre. Ce n’est pas un hasard, c’est structurel.',
  },

  {
    slug: 'parfumerie',
    label: 'Parfumerie',
    cover: {
      title: 'Votre conseillère vaut mieux<br>qu’un <i>standard</i>.',
      lead:
        'Disponibilité d’un flacon, gravure, coffret, horaires : ces appels mobilisent la personne qui devrait être en train de conseiller en boutique.',
    },
    pain: {
      eyebrow: 'Le problème',
      title: 'Chaque appel vous coûte une cliente en <i>cabine</i>.',
      lead:
        'En boutique, répondre au téléphone veut dire tourner le dos à quelqu’un. Ne pas répondre veut dire l’envoyer vers un site marchand.',
      steps: [
        {
          mark: 'En cabine',
          text: 'Vous êtes sur un diagnostic. Le téléphone sonne, votre collègue est en caisse.',
        },
        {
          mark: '10ᵉ sonnerie',
          text: 'L’appel s’arrête. C’était une question de disponibilité, une question à trente secondes.',
        },
        {
          mark: '2 min',
          text: 'La cliente commande le même flacon en ligne, avec livraison le lendemain.',
        },
        {
          mark: 'Décembre',
          text: 'Le même scénario, dix fois par jour, sur le mois qui fait votre année.',
        },
      ],
    },
    cost: {
      missed: 12,
      oneIn: 6,
      value: 95,
      valueLabel: 'de panier moyen en boutique',
      outcome: 'serait venue acheter',
    },
    call: {
      eyebrow: 'Un appel, samedi 15 h 40',
      title: 'Un appel qui finissait en ligne,<br>et qui finit en <i>visite</i>.',
      lines: [
        {
          who: 'caller',
          text: 'Bonjour, vous avez encore le coffret en 100 ml ? Et vous faites la gravure ?',
        },
        {
          who: 'agent',
          text: 'Le coffret, oui. La gravure se fait en boutique, comptez vingt minutes sur place.',
          note: 'Votre catalogue et vos services sont dans sa fiche. Elle ne devine rien, elle sait.',
        },
        { who: 'caller', text: 'Je passe samedi, alors.' },
        {
          who: 'agent',
          text: 'Je le mets de côté à votre nom jusqu’à samedi 18 h. Souhaitez-vous un diagnostic olfactif ? Il me reste 15 h 30.',
          note: 'Une réservation nominative et un créneau valent mieux qu’une simple réponse.',
        },
        { who: 'caller', text: 'Oui, 15 h 30 c’est parfait.' },
        {
          who: 'agent',
          text: 'C’est réservé. Vous recevez le détail par SMS, avec l’adresse.',
          note: 'La conseillère retrouve la fiche à l’arrivée de la cliente, sans avoir quitté le comptoir.',
        },
      ],
    },
    during: {
      eyebrow: 'Pendant l’appel',
      title: 'Quatre choses qu’un répondeur ne fait <i>pas</i>.',
      items: [
        {
          title: 'Elle libère le comptoir',
          body:
            'Disponibilités, horaires, services : ces questions ne coûtent plus une cliente en cours de conseil.',
        },
        {
          title: 'Elle met de côté',
          body: 'Un produit réservé à un nom et une heure, donc une raison de venir plutôt que de commander.',
        },
        {
          title: 'Elle pose les rendez-vous conseil',
          body: 'Diagnostic olfactif, gravure, coffret cadeau. Ce sont des créneaux, et elle les remplit.',
        },
        {
          title: 'Elle absorbe décembre',
          body: 'Le mois où le volume triple est celui où votre équipe est déjà au maximum.',
        },
      ],
    },
    record: {
      duration: '2 min 05',
      intent: 'Disponibilité coffret et gravure',
      outcome: 'Diagnostic samedi 15 h 30',
      lines: ['Coffret 100 ml mis de côté', 'Gravure demandée', 'Première visite, jamais venue'],
    },
    gains: {
      eyebrow: 'Ce que ça change',
      title: 'Pour une <i>parfumerie</i>, précisément.',
      items: [
        {
          title: 'La conseillère reste conseillère',
          body:
            'Son temps va au conseil, qui est exactement ce qu’un site marchand ne sait pas faire. C’est votre seul vrai avantage, et il se joue en boutique.',
        },
        {
          title: 'Les appels deviennent des visites',
          body: 'Une mise de côté nominative et un créneau transforment une question en déplacement.',
        },
        {
          title: 'Les fêtes tiennent',
          body: 'Décembre et la fête des mères passent sans renfort intérimaire ni ligne saturée.',
        },
        {
          title: 'Chaque demande laisse une trace',
          body: 'Même celles qui n’aboutissent pas ce jour-là : vous savez ce qu’on vous demande.',
        },
      ],
    },
    closeLine:
      'Votre différence, c’est le conseil en boutique. Le téléphone ne devrait pas travailler contre lui.',
  },
];
