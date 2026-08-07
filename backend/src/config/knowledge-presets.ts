// Les présets de la base de connaissances: ce qu'un métier doit savoir répondre
// au téléphone, préparé à l'avance pour que le client n'ait pas à l'inventer.
//
// Aujourd'hui la base de connaissances est une zone de texte libre et une liste
// à plat: tout le travail de structuration retombe sur le client, qui oublie
// justement ce que ses appelants demandent le plus (les mutuelles, l'acompte,
// le parking, la conduite à tenir en urgence). Ces présets remplissent le
// formulaire d'avance: des sous-catégories pour ranger les services et tarifs,
// des champs nommés, et une FAQ déjà rédigée que le client corrige au lieu
// d'écrire.
//
// Ils sont indexés sur `NicheId` (voir `niches.ts`) et NON sur une nouvelle
// liste de métiers. Une liste de plus aurait divergé de celles qui existent
// déjà (scripts de prospection, templates Vapi, générateur de script), et un
// client marqué « garage » aurait pu recevoir ses questions d'onboarding sans
// ses présets, sans que rien ne le signale. Ici, un métier reconnu par
// `resolveNiche` a forcément son entrée: le `Record<NicheId, ...>` le rend
// impossible à oublier au compilateur.

import { NicheId, resolveNiche } from './niches';

export interface KnowledgeField {
  id: string;          // camelCase, stable, e.g. 'insuranceAccepted'
  label: string;       // French, short, sentence case, e.g. "Mutuelles acceptées"
  placeholder: string; // French, a concrete filled-in example, not an instruction
  multiline?: boolean; // true for anything longer than a phone number
}

export interface KnowledgePreset {
  /** Sous-catégories proposées pour la liste des services et tarifs. */
  itemCategories: { v: string; l: string }[];
  /** Champs nommés: ce que ce métier doit dire et que le client oublie. */
  fields: KnowledgeField[];
  /** Questions que ce métier reçoit vraiment, à ajouter en un geste. */
  faq: { q: string; a: string }[];
}

// Les `id` de champs sont volontairement partagés entre métiers quand ils
// désignent la même chose (`cancellationPolicy`, `emergencyProtocol`,
// `insuranceAccepted`, `parkingAccess`, `paymentMethods`, `serviceArea`,
// `depositPolicy`). Un dentiste et un vétérinaire qui remplissent « politique
// d'annulation » écrivent dans la même clé: les réponses restent comparables
// d'un client à l'autre, et un futur écran transversal n'aura pas à réconcilier
// quinze variantes du même champ.

export const KNOWLEDGE_PRESETS: Record<NicheId, KnowledgePreset> = {
  restaurant: {
    itemCategories: [
      { v: 'menus', l: 'Menus et formules' },
      { v: 'carte', l: 'Plats à la carte' },
      { v: 'boissons', l: 'Boissons et vins' },
      { v: 'groupes', l: 'Groupes et privatisation' },
      { v: 'traiteur', l: 'Traiteur et emporter' },
    ],
    fields: [
      { id: 'seatingCapacity', label: 'Capacité et grandes tablées', placeholder: '48 couverts en salle, 20 en terrasse, groupes jusqu\'à 25 personnes sur réservation' },
      { id: 'dietaryOptions', label: 'Régimes et allergènes', placeholder: 'Plats végétariens et sans gluten à la carte, allergènes sur demande en cuisine', multiline: true },
      { id: 'depositPolicy', label: 'Acompte pour les groupes', placeholder: '10 € par personne à partir de 10 couverts, déduits de l\'addition' },
      { id: 'cancellationPolicy', label: 'Annulation d\'une réservation', placeholder: 'Annulation gratuite jusqu\'à 4 h avant, l\'acompte reste acquis au-delà' },
      { id: 'parkingAccess', label: 'Accès et stationnement', placeholder: 'Parking public à 50 m (2 €/h), arrêt de tram Flagey à 3 minutes' },
      { id: 'petPolicy', label: 'Animaux et enfants', placeholder: 'Chiens acceptés en terrasse, chaises hautes et menu enfant à 12 €' },
    ],
    faq: [
      { q: 'Avez-vous une table pour ce soir ?', a: 'Je regarde tout de suite. Pour combien de personnes et vers quelle heure souhaitez-vous venir ?' },
      { q: 'Proposez-vous des plats végétariens ou sans gluten ?', a: 'Oui, plusieurs plats de la carte sont végétariens et nous avons des options sans gluten. Prévenez-nous à la réservation pour les allergies.' },
      { q: 'Peut-on privatiser la salle ?', a: 'Oui, à partir de 20 personnes, du lundi au jeudi. Je peux prendre vos coordonnées et le responsable vous rappelle avec un devis.' },
      { q: 'Y a-t-il un parking ?', a: 'Il y a un parking public à 50 m et du stationnement en voirie payant jusqu\'à 18 h.' },
      { q: 'Faites-vous des plats à emporter ?', a: 'Oui, la carte est disponible à emporter du mardi au samedi, avec un délai de 20 minutes environ.' },
      { q: 'Les chiens sont-ils acceptés ?', a: 'Les chiens sont les bienvenus en terrasse, mais pas en salle.' },
      { q: 'Acceptez-vous les chèques repas ?', a: 'Oui, nous acceptons les chèques repas électroniques, les cartes bancaires et les espèces.' },
    ],
  },

  dental: {
    itemCategories: [
      { v: 'consultations', l: 'Consultations et contrôles' },
      { v: 'soins', l: 'Soins conservateurs' },
      { v: 'protheses', l: 'Prothèses et implants' },
      { v: 'orthodontie', l: 'Orthodontie' },
      { v: 'esthetique', l: 'Esthétique dentaire' },
      { v: 'urgences', l: 'Urgences' },
    ],
    fields: [
      { id: 'insuranceAccepted', label: 'Mutuelles et conventionnement', placeholder: 'Cabinet conventionné, tiers payant avec les principales mutuelles (Partenamut, Solidaris, Helan)', multiline: true },
      { id: 'emergencyProtocol', label: 'Conduite à tenir en urgence', placeholder: 'Douleur aiguë ou dent cassée: créneau d\'urgence réservé chaque matin à 8 h 30. La nuit et le week-end, appeler le 1733.', multiline: true },
      { id: 'cancellationPolicy', label: 'Annulation d\'un rendez-vous', placeholder: 'Annulation gratuite jusqu\'à 24 h avant, 40 € facturés pour un rendez-vous non honoré' },
      { id: 'firstVisitInfo', label: 'Première consultation', placeholder: 'Prévoir 30 minutes, carte d\'identité et vignette de mutuelle, radios antérieures si vous en avez', multiline: true },
      { id: 'paymentMethods', label: 'Paiement et facilités', placeholder: 'Bancontact, virement, paiement en trois fois sans frais au-delà de 1 000 €' },
      { id: 'parkingAccess', label: 'Accès et stationnement', placeholder: 'Cabinet au rez-de-chaussée, accessible en fauteuil, zone bleue devant l\'entrée' },
    ],
    faq: [
      { q: 'Prenez-vous de nouveaux patients ?', a: 'Oui, nous acceptons de nouveaux patients. Le premier rendez-vous est un bilan complet d\'environ 30 minutes.' },
      { q: 'Quel est le délai pour un rendez-vous ?', a: 'Comptez deux à trois semaines pour un contrôle, et le jour même pour une urgence douloureuse.' },
      { q: 'J\'ai très mal, que faire ?', a: 'Nous gardons des créneaux d\'urgence chaque matin. Décrivez-moi votre douleur et je vous place au plus tôt.' },
      { q: 'Êtes-vous conventionné ?', a: 'Oui, le cabinet est conventionné et nous pratiquons le tiers payant avec la plupart des mutuelles.' },
      { q: 'Combien coûte un détartrage ?', a: 'Un détartrage revient à environ 60 €, largement remboursé par la mutuelle une fois par an.' },
      { q: 'Faites-vous du blanchiment ?', a: 'Oui, après un contrôle préalable. Le traitement se fait en deux séances et n\'est pas remboursé.' },
      { q: 'Que se passe-t-il si j\'annule ?', a: 'Prévenez-nous au moins 24 h à l\'avance et l\'annulation est gratuite. Un rendez-vous manqué sans nouvelle est facturé 40 €.' },
    ],
  },

  medical: {
    itemCategories: [
      { v: 'consultations', l: 'Consultations' },
      { v: 'visites', l: 'Visites à domicile' },
      { v: 'preventif', l: 'Bilans et prévention' },
      { v: 'certificats', l: 'Certificats et administratif' },
      { v: 'vaccinations', l: 'Vaccinations' },
    ],
    fields: [
      { id: 'insuranceAccepted', label: 'Conventionnement et mutuelles', placeholder: 'Médecin conventionné, tiers payant appliqué sur présentation de la carte d\'identité', multiline: true },
      { id: 'emergencyProtocol', label: 'Urgences et garde', placeholder: 'Urgence vitale: 112. Le soir, le week-end et les jours fériés, poste de garde au 1733.', multiline: true },
      { id: 'homeVisitPolicy', label: 'Visites à domicile', placeholder: 'Visites réservées aux patients qui ne peuvent pas se déplacer, demandées avant 10 h, dans un rayon de 5 km', multiline: true },
      { id: 'prescriptionRenewal', label: 'Renouvellement d\'ordonnance', placeholder: 'Renouvellement sans consultation possible pour un traitement chronique déjà suivi, à retirer sous 48 h', multiline: true },
      { id: 'cancellationPolicy', label: 'Annulation d\'un rendez-vous', placeholder: 'Prévenir au moins 12 h à l\'avance, la consultation manquée est facturée 25 €' },
      { id: 'parkingAccess', label: 'Accès et stationnement', placeholder: 'Cabinet au 1er étage avec ascenseur, parking gratuit derrière le bâtiment' },
    ],
    faq: [
      { q: 'Acceptez-vous de nouveaux patients ?', a: 'Oui, nous acceptons de nouveaux patients et pouvons ouvrir un dossier médical global.' },
      { q: 'Puis-je avoir un rendez-vous aujourd\'hui ?', a: 'Nous gardons des créneaux le matin pour les demandes du jour. Dites-moi ce qui vous amène et je regarde ce qui reste.' },
      { q: 'Faites-vous des visites à domicile ?', a: 'Oui, pour les patients qui ne peuvent pas se déplacer, si la demande arrive avant 10 h.' },
      { q: 'Comment renouveler mon ordonnance ?', a: 'Pour un traitement chronique déjà suivi ici, laissez-nous votre demande et l\'ordonnance sera prête sous 48 h.' },
      { q: 'Que faire en dehors des heures d\'ouverture ?', a: 'Pour une urgence vitale, appelez le 112. Sinon, le poste de garde est joignable au 1733.' },
      { q: 'Combien coûte une consultation ?', a: 'La consultation est à 30 €, avec tiers payant pour la plupart des patients.' },
      { q: 'Pouvez-vous me faire un certificat médical ?', a: 'Un certificat demande une consultation, nous ne pouvons pas le délivrer par téléphone.' },
    ],
  },

  salon: {
    itemCategories: [
      { v: 'coupe', l: 'Coupe et brushing' },
      { v: 'couleur', l: 'Couleur et mèches' },
      { v: 'soins', l: 'Soins et rituels' },
      { v: 'ongles', l: 'Ongles' },
      { v: 'epilation', l: 'Épilation' },
      { v: 'evenements', l: 'Mariage et événements' },
    ],
    fields: [
      { id: 'cancellationPolicy', label: 'Annulation d\'un rendez-vous', placeholder: 'Annulation gratuite jusqu\'à 24 h avant, 50 % de la prestation facturés en cas d\'absence' },
      { id: 'appointmentDuration', label: 'Durée des prestations', placeholder: 'Coupe 45 min, couleur 2 h, balayage 3 h, à prévoir dans l\'agenda', multiline: true },
      { id: 'brandsUsed', label: 'Marques et produits', placeholder: 'Kérastase, Olaplex, colorations sans ammoniaque' },
      { id: 'depositPolicy', label: 'Acompte', placeholder: 'Acompte de 30 € pour les prestations de plus de 2 h et les forfaits mariée' },
      { id: 'paymentMethods', label: 'Paiement', placeholder: 'Bancontact, espèces, chèques cadeaux du salon, pas d\'American Express' },
      { id: 'parkingAccess', label: 'Accès et stationnement', placeholder: 'Zone bleue devant le salon, parking Louise à 200 m' },
    ],
    faq: [
      { q: 'Avez-vous de la place aujourd\'hui ?', a: 'Je regarde l\'agenda. Quelle prestation souhaitez-vous et à quel moment de la journée ?' },
      { q: 'Combien coûte une couleur ?', a: 'Une couleur avec brushing commence à 65 €, selon la longueur des cheveux.' },
      { q: 'Combien de temps faut-il prévoir ?', a: 'Comptez 45 minutes pour une coupe et environ 2 heures pour une couleur.' },
      { q: 'Puis-je venir sans rendez-vous ?', a: 'Nous prenons sans rendez-vous quand l\'agenda le permet, mais je vous conseille de réserver pour être sûr.' },
      { q: 'Faites-vous les coiffures de mariée ?', a: 'Oui, avec un essai préalable. Le forfait mariée comprend l\'essai, le jour J et la pose d\'accessoires.' },
      { q: 'Puis-je choisir mon coiffeur ?', a: 'Bien sûr, dites-moi avec qui vous avez l\'habitude et je regarde ses disponibilités.' },
      { q: 'Vendez-vous des chèques cadeaux ?', a: 'Oui, du montant de votre choix, valables un an au salon.' },
    ],
  },

  law: {
    itemCategories: [
      { v: 'consultation', l: 'Consultation initiale' },
      { v: 'famille', l: 'Droit de la famille' },
      { v: 'travail', l: 'Droit du travail' },
      { v: 'affaires', l: 'Droit des affaires' },
      { v: 'immobilier', l: 'Droit immobilier' },
      { v: 'penal', l: 'Droit pénal' },
    ],
    fields: [
      { id: 'practiceAreas', label: 'Matières traitées et exclusions', placeholder: 'Famille, travail, baux et sociétés. Nous ne traitons pas le droit pénal ni les étrangers.', multiline: true },
      { id: 'consultationFee', label: 'Prix de la première consultation', placeholder: 'Première consultation de 45 minutes à 120 € HTVA, déduite du dossier si nous le prenons' },
      { id: 'billingModel', label: 'Honoraires', placeholder: 'Taux horaire de 175 € HTVA, forfait possible pour les dossiers simples, provision demandée à l\'ouverture', multiline: true },
      { id: 'documentsNeeded', label: 'Documents à apporter', placeholder: 'Carte d\'identité, contrat ou courrier concerné, échanges avec la partie adverse, dernier courrier reçu', multiline: true },
      { id: 'legalAidPolicy', label: 'Aide juridique et protection juridique', placeholder: 'Nous acceptons les dossiers pro deo sous conditions de revenus et travaillons avec les assurances protection juridique (DAS, ARAG)', multiline: true },
      { id: 'responseTime', label: 'Délai de réponse', placeholder: 'Rappel sous 24 h ouvrées, urgences (audience, saisie) traitées le jour même' },
    ],
    faq: [
      { q: 'La première consultation est-elle gratuite ?', a: 'Elle est facturée 120 € HTVA pour 45 minutes, et déduite de vos honoraires si nous prenons le dossier.' },
      { q: 'Comment sont calculés vos honoraires ?', a: 'Au taux horaire de 175 € HTVA, ou au forfait pour les dossiers simples. Une provision est demandée à l\'ouverture.' },
      { q: 'Traitez-vous ce type d\'affaire ?', a: 'Le cabinet travaille en droit de la famille, du travail, immobilier et des sociétés. Décrivez-moi votre situation et je vérifie.' },
      { q: 'Puis-je bénéficier de l\'aide juridique ?', a: 'C\'est possible selon vos revenus. Apportez vos justificatifs et nous vérifions vos droits en consultation.' },
      { q: 'Mon assurance protection juridique intervient-elle ?', a: 'Souvent oui. Communiquez-nous votre numéro de police et nous prenons contact avec votre assureur.' },
      { q: 'Quels documents dois-je apporter ?', a: 'Votre carte d\'identité, le contrat ou le courrier en cause et tous les échanges avec la partie adverse.' },
      { q: 'Sous quel délai serai-je rappelé ?', a: 'Nous rappelons sous 24 heures ouvrées, et le jour même en cas d\'audience ou de délai qui expire.' },
    ],
  },

  real_estate: {
    itemCategories: [
      { v: 'vente', l: 'Vente' },
      { v: 'location', l: 'Location' },
      { v: 'estimation', l: 'Estimation' },
      { v: 'gestion', l: 'Gestion locative' },
      { v: 'neuf', l: 'Projets neufs' },
    ],
    fields: [
      { id: 'serviceArea', label: 'Zone couverte', placeholder: 'Bruxelles sud, Uccle, Ixelles, Waterloo et La Hulpe' },
      { id: 'commissionRate', label: 'Commission et frais', placeholder: '3 % HTVA du prix de vente, estimation et photos comprises, rien à payer si le bien ne se vend pas' },
      { id: 'viewingPolicy', label: 'Organisation des visites', placeholder: 'Visites en semaine de 10 h à 19 h et le samedi matin, groupées le jeudi pour les biens très demandés', multiline: true },
      { id: 'documentsNeeded', label: 'Documents à préparer', placeholder: 'Vendeur: titre de propriété, PEB, contrôle électrique. Locataire: 3 dernières fiches de paie et composition de ménage.', multiline: true },
      { id: 'depositPolicy', label: 'Garantie locative', placeholder: 'Garantie de 2 mois sur compte bloqué, à constituer avant la remise des clés' },
      { id: 'valuationProcess', label: 'Estimation', placeholder: 'Estimation gratuite et sans engagement, visite d\'environ 45 minutes, rapport écrit sous 3 jours', multiline: true },
    ],
    faq: [
      { q: 'Faites-vous des estimations gratuites ?', a: 'Oui, l\'estimation est gratuite et sans engagement. Comptez 45 minutes sur place et un rapport écrit sous trois jours.' },
      { q: 'Quelle est votre commission ?', a: 'Notre commission est de 3 % HTVA du prix de vente, et vous ne payez rien si le bien ne se vend pas.' },
      { q: 'Ce bien est-il toujours disponible ?', a: 'Je vérifie tout de suite. Donnez-moi la référence ou l\'adresse de l\'annonce.' },
      { q: 'Quand puis-je visiter ?', a: 'Nous organisons les visites en semaine jusqu\'à 19 h et le samedi matin. Quel moment vous conviendrait ?' },
      { q: 'Quels documents faut-il pour louer ?', a: 'Vos trois dernières fiches de paie, une pièce d\'identité et une composition de ménage.' },
      { q: 'Le PEB est-il disponible ?', a: 'Oui, le certificat PEB est fourni avec l\'annonce, je peux vous l\'envoyer par e-mail.' },
      { q: 'Gérez-vous aussi la location de mon bien ?', a: 'Oui, nous proposons la gestion locative complète, loyers et états des lieux compris.' },
    ],
  },

  auto: {
    itemCategories: [
      { v: 'entretien', l: 'Entretien et vidange' },
      { v: 'reparation', l: 'Réparation mécanique' },
      { v: 'pneus', l: 'Pneus et géométrie' },
      { v: 'carrosserie', l: 'Carrosserie' },
      { v: 'controle', l: 'Contrôle technique et diagnostic' },
    ],
    fields: [
      { id: 'brandsServiced', label: 'Marques prises en charge', placeholder: 'Toutes marques, spécialistes VW, Audi, Skoda et Seat. Électriques: diagnostic uniquement.', multiline: true },
      { id: 'quotePolicy', label: 'Devis', placeholder: 'Devis gratuit avant toute intervention, aucun travail supplémentaire sans votre accord' },
      { id: 'courtesyVehicle', label: 'Véhicule de remplacement', placeholder: 'Voiture de courtoisie gratuite sur réservation, 3 véhicules disponibles' },
      { id: 'turnaroundTime', label: 'Délais habituels', placeholder: 'Vidange en 1 h, entretien complet dans la journée, carrosserie 3 à 5 jours' },
      { id: 'emergencyProtocol', label: 'Panne et dépannage', placeholder: 'Remorquage possible dans un rayon de 20 km, 85 € forfait. En panne sur autoroute, appeler d\'abord Touring ou VAB.', multiline: true },
      { id: 'paymentMethods', label: 'Paiement', placeholder: 'Bancontact et virement, facture TVA 21 % pour les professionnels, pas de paiement échelonné' },
    ],
    faq: [
      { q: 'Combien coûte une vidange ?', a: 'Une vidange complète avec filtre commence à 120 € TVAC, selon le modèle et l\'huile.' },
      { q: 'Pouvez-vous me faire un devis ?', a: 'Oui, le devis est gratuit. Donnez-moi la marque, le modèle et l\'année, ou passez pour un diagnostic.' },
      { q: 'Avez-vous une voiture de remplacement ?', a: 'Oui, nous avons des véhicules de courtoisie gratuits, à réserver en même temps que l\'intervention.' },
      { q: 'Quand pouvez-vous me prendre ?', a: 'Pour un entretien, généralement sous quelques jours. Dites-moi ce dont il s\'agit et je regarde l\'atelier.' },
      { q: 'Faites-vous le contrôle technique ?', a: 'Nous préparons le véhicule au contrôle et corrigeons les points refusés, mais le contrôle lui-même se passe au centre agréé.' },
      { q: 'Ma voiture ne démarre pas, que faire ?', a: 'Nous pouvons organiser un remorquage dans un rayon de 20 km. Où se trouve le véhicule ?' },
      { q: 'Travaillez-vous avec les assurances ?', a: 'Oui, pour la carrosserie nous traitons directement avec votre assureur et son expert.' },
    ],
  },

  home_services: {
    itemCategories: [
      { v: 'depannage', l: 'Dépannage urgent' },
      { v: 'installation', l: 'Installation' },
      { v: 'entretien', l: 'Entretien et contrats' },
      { v: 'renovation', l: 'Rénovation et travaux' },
      { v: 'diagnostic', l: 'Diagnostic et devis' },
    ],
    fields: [
      { id: 'serviceArea', label: 'Zone d\'intervention', placeholder: 'Bruxelles et Brabant wallon, jusqu\'à 30 km, déplacement au-delà facturé 0,50 €/km' },
      { id: 'emergencyProtocol', label: 'Urgences', placeholder: 'Fuite, panne de chauffage ou porte bloquée: intervention sous 2 h en journée. Le soir et le week-end, supplément de 60 €.', multiline: true },
      { id: 'calloutFee', label: 'Frais de déplacement', placeholder: 'Déplacement 45 € TVAC, déduits si les travaux sont confiés' },
      { id: 'quotePolicy', label: 'Devis', placeholder: 'Devis gratuit sur place, valable 30 jours, aucun supplément sans accord écrit' },
      { id: 'warrantyTerms', label: 'Garantie', placeholder: 'Main d\'œuvre garantie 2 ans, pièces selon la garantie du fabricant' },
      { id: 'paymentMethods', label: 'Paiement et TVA', placeholder: 'Virement ou Bancontact, TVA 6 % pour les logements de plus de 10 ans, acompte de 30 % sur les chantiers' },
    ],
    faq: [
      { q: 'Pouvez-vous venir aujourd\'hui ?', a: 'Pour une urgence, nous essayons d\'intervenir sous deux heures. Décrivez-moi le problème et votre adresse.' },
      { q: 'Le devis est-il gratuit ?', a: 'Oui, le devis est gratuit et sans engagement, valable 30 jours.' },
      { q: 'Combien coûte le déplacement ?', a: 'Le déplacement est de 45 € TVAC, déduits si vous nous confiez les travaux.' },
      { q: 'Intervenez-vous dans ma commune ?', a: 'Nous couvrons Bruxelles et le Brabant wallon jusqu\'à 30 km. Dites-moi votre code postal et je vérifie.' },
      { q: 'Travaillez-vous le week-end ?', a: 'Oui pour les urgences, avec un supplément de 60 € en soirée et le week-end.' },
      { q: 'Vos travaux sont-ils garantis ?', a: 'La main d\'œuvre est garantie deux ans et les pièces selon la garantie du fabricant.' },
      { q: 'Puis-je bénéficier de la TVA à 6 % ?', a: 'Oui, si votre logement a plus de dix ans et vous sert d\'habitation privée.' },
    ],
  },

  veterinary: {
    itemCategories: [
      { v: 'consultations', l: 'Consultations' },
      { v: 'vaccination', l: 'Vaccination et identification' },
      { v: 'chirurgie', l: 'Chirurgie et stérilisation' },
      { v: 'imagerie', l: 'Imagerie et analyses' },
      { v: 'dentaire', l: 'Soins dentaires' },
      { v: 'urgences', l: 'Urgences' },
    ],
    fields: [
      { id: 'speciesTreated', label: 'Animaux pris en charge', placeholder: 'Chiens, chats et NAC (lapins, rongeurs, furets). Pas de reptiles ni d\'oiseaux.', multiline: true },
      { id: 'emergencyProtocol', label: 'Urgences et garde', placeholder: 'Urgence en journée: venez directement, nous intercalons. La nuit, clinique de garde Animal Trust au +32 2 500 00 00.', multiline: true },
      { id: 'insuranceAccepted', label: 'Assurances santé animale', placeholder: 'Nous remplissons les formulaires Santévet et Agria, remboursement directement par l\'assureur' },
      { id: 'cancellationPolicy', label: 'Annulation d\'un rendez-vous', placeholder: 'Prévenir 24 h à l\'avance, une consultation manquée est facturée 25 €' },
      { id: 'preOpInstructions', label: 'Consignes avant une opération', placeholder: 'À jeun 12 h avant (eau autorisée), arrivée à 8 h, sortie en fin de journée', multiline: true },
      { id: 'paymentMethods', label: 'Paiement', placeholder: 'Bancontact et espèces, paiement à la consultation, devis écrit avant toute chirurgie' },
    ],
    faq: [
      { q: 'Mon animal est mal, pouvez-vous le voir aujourd\'hui ?', a: 'Oui, nous gardons de la place pour les urgences. Dites-moi ce qu\'il a et venez, nous vous intercalons.' },
      { q: 'Combien coûte une consultation ?', a: 'La consultation est à 45 € pour un chien ou un chat, hors traitement.' },
      { q: 'Quel est le prix d\'une stérilisation ?', a: 'Environ 130 € pour une chatte et 320 € pour une chienne, selon le poids. Nous établissons un devis avant.' },
      { q: 'Faites-vous les puces d\'identification et les passeports ?', a: 'Oui, nous puçons, enregistrons l\'animal et délivrons le passeport européen.' },
      { q: 'Que faire la nuit en cas d\'urgence ?', a: 'La clinique de garde prend le relais en dehors de nos heures, son numéro est sur notre répondeur.' },
      { q: 'Mon animal doit-il être à jeun ?', a: 'Pour une anesthésie, oui: pas de nourriture 12 heures avant, l\'eau reste autorisée.' },
      { q: 'Acceptez-vous les NAC ?', a: 'Oui, nous soignons lapins, rongeurs et furets, mais pas les reptiles ni les oiseaux.' },
    ],
  },

  fitness: {
    itemCategories: [
      { v: 'abonnements', l: 'Abonnements' },
      { v: 'cours', l: 'Cours collectifs' },
      { v: 'coaching', l: 'Coaching individuel' },
      { v: 'seances', l: 'Séances à l\'unité' },
      { v: 'entreprises', l: 'Formules entreprises' },
    ],
    fields: [
      { id: 'membershipTerms', label: 'Abonnements et engagement', placeholder: 'Mensuel sans engagement à 49 €, annuel à 39 €/mois, suspension possible 1 mois par an', multiline: true },
      { id: 'trialOffer', label: 'Séance d\'essai', placeholder: 'Première séance offerte, sur réservation, tenue de sport et serviette à prévoir' },
      { id: 'classSchedule', label: 'Horaires forts', placeholder: 'Cours collectifs du lundi au vendredi à 7 h, 12 h 30 et 18 h 30, samedi à 10 h', multiline: true },
      { id: 'cancellationPolicy', label: 'Annulation d\'un cours ou d\'un abonnement', placeholder: 'Cours annulable jusqu\'à 4 h avant, abonnement résiliable pour la fin du mois par e-mail' },
      { id: 'facilities', label: 'Équipements et vestiaires', placeholder: 'Vestiaires avec douches et casiers, cadenas non fourni, pas de piscine' },
      { id: 'parkingAccess', label: 'Accès et stationnement', placeholder: 'Parking gratuit de 20 places, entrée par la cour arrière' },
    ],
    faq: [
      { q: 'Puis-je faire une séance d\'essai ?', a: 'Oui, la première séance est offerte. Réservez votre créneau et prévoyez une tenue de sport.' },
      { q: 'Combien coûte l\'abonnement ?', a: 'Le mensuel sans engagement est à 49 €, et l\'annuel revient à 39 € par mois.' },
      { q: 'Y a-t-il un engagement ?', a: 'Non, la formule mensuelle est sans engagement et se résilie pour la fin du mois.' },
      { q: 'Faut-il réserver les cours collectifs ?', a: 'Oui, les places sont limitées. La réservation se fait jusqu\'à une heure avant le cours.' },
      { q: 'Quels sont vos horaires ?', a: 'Nous sommes ouverts de 6 h 30 à 22 h en semaine et de 9 h à 18 h le week-end.' },
      { q: 'Proposez-vous du coaching individuel ?', a: 'Oui, une séance de coaching est à 55 €, avec des forfaits de 5 ou 10 séances.' },
      { q: 'Puis-je suspendre mon abonnement ?', a: 'Oui, une suspension d\'un mois par an est possible, sur simple demande écrite.' },
    ],
  },

  financial: {
    itemCategories: [
      { v: 'comptabilite', l: 'Comptabilité' },
      { v: 'fiscalite', l: 'Déclarations fiscales' },
      { v: 'creation', l: 'Création de société' },
      { v: 'paie', l: 'Paie et social' },
      { v: 'conseil', l: 'Conseil et planification' },
      { v: 'assurance', l: 'Assurances et courtage' },
    ],
    fields: [
      { id: 'clientTypes', label: 'Clients pris en charge', placeholder: 'Indépendants, professions libérales et PME jusqu\'à 20 salariés. Pas d\'ASBL.', multiline: true },
      { id: 'billingModel', label: 'Honoraires', placeholder: 'Forfait mensuel dès 150 € HTVA pour un indépendant, sur devis pour une société', multiline: true },
      { id: 'documentsNeeded', label: 'Documents à fournir', placeholder: 'Factures d\'achat et de vente, extraits de compte, contrats de leasing, transmis avant le 10 du mois', multiline: true },
      { id: 'keyDeadlines', label: 'Échéances à rappeler', placeholder: 'TVA trimestrielle: 20 avril, 20 juillet, 20 octobre, 20 janvier. Impôt des personnes physiques: fin juin.', multiline: true },
      { id: 'softwareUsed', label: 'Outils utilisés', placeholder: 'Nous travaillons avec Yuki et Billit, envoi des pièces par application ou par e-mail' },
      { id: 'responseTime', label: 'Délai de réponse', placeholder: 'Réponse sous 48 h ouvrées, priorité aux échéances fiscales de la semaine' },
    ],
    faq: [
      { q: 'Prenez-vous de nouveaux clients ?', a: 'Oui. Un premier entretien gratuit nous permet de cadrer votre situation et de vous faire une offre.' },
      { q: 'Combien coûte votre accompagnement ?', a: 'Pour un indépendant, le forfait mensuel commence à 150 € HTVA, tout compris.' },
      { q: 'Pouvez-vous m\'aider à créer ma société ?', a: 'Oui, nous préparons le plan financier, coordonnons le notaire et faisons l\'inscription à la BCE.' },
      { q: 'Quand dois-je rentrer ma TVA ?', a: 'Les déclarations trimestrielles sont dues les 20 avril, juillet, octobre et janvier.' },
      { q: 'Comment vous transmettre mes documents ?', a: 'Par l\'application ou par e-mail, idéalement avant le 10 du mois qui suit.' },
      { q: 'Puis-je changer de comptable en cours d\'année ?', a: 'Oui, c\'est possible à tout moment. Nous récupérons votre dossier auprès de votre ancien comptable.' },
      { q: 'Faites-vous aussi la déclaration d\'impôts des particuliers ?', a: 'Oui, à partir de 90 € HTVA selon la complexité de votre situation.' },
    ],
  },

  // `default` n'est pas un repli dégradé: la plupart des clients ne rentrent
  // dans aucune case et méritent un formulaire complet, simplement écrit dans
  // un vocabulaire qui vaut pour tout métier de service.
  default: {
    itemCategories: [
      { v: 'prestations', l: 'Prestations principales' },
      { v: 'forfaits', l: 'Forfaits et abonnements' },
      { v: 'options', l: 'Options et suppléments' },
      { v: 'devis', l: 'Sur devis' },
      { v: 'urgences', l: 'Interventions urgentes' },
    ],
    fields: [
      { id: 'serviceArea', label: 'Zone couverte', placeholder: 'Bruxelles et périphérie, jusqu\'à 25 km' },
      { id: 'quotePolicy', label: 'Devis et tarifs', placeholder: 'Devis gratuit sous 48 h, tarifs communiqués par téléphone pour les prestations courantes' },
      { id: 'cancellationPolicy', label: 'Annulation d\'un rendez-vous', placeholder: 'Annulation gratuite jusqu\'à 24 h avant, la prestation est due au-delà' },
      { id: 'paymentMethods', label: 'Paiement', placeholder: 'Bancontact, virement et espèces, facture avec TVA 21 %' },
      { id: 'openingExceptions', label: 'Fermetures et exceptions', placeholder: 'Fermé les jours fériés et deux semaines fin juillet' },
      { id: 'parkingAccess', label: 'Accès et stationnement', placeholder: 'Zone bleue devant l\'entrée, arrêt de bus à 100 m' },
    ],
    faq: [
      { q: 'Quels sont vos horaires ?', a: 'Nous sommes ouverts du lundi au vendredi de 9 h à 18 h, et le samedi matin sur rendez-vous.' },
      { q: 'Où êtes-vous situés ?', a: 'Je vous donne l\'adresse et peux vous l\'envoyer par SMS si vous le souhaitez.' },
      { q: 'Combien cela coûte-t-il ?', a: 'Cela dépend de la prestation. Dites-moi ce dont vous avez besoin et je vous donne un ordre de prix.' },
      { q: 'Faites-vous des devis ?', a: 'Oui, le devis est gratuit et vous parvient sous 48 heures.' },
      { q: 'Quel est le délai pour un rendez-vous ?', a: 'En général quelques jours. Je regarde l\'agenda et vous propose les prochains créneaux.' },
      { q: 'Comment puis-je payer ?', a: 'Par Bancontact, virement ou en espèces, avec une facture à la clé.' },
      { q: 'Intervenez-vous dans ma région ?', a: 'Nous couvrons Bruxelles et sa périphérie. Donnez-moi votre code postal et je vérifie.' },
    ],
  },
};

/**
 * Le préset d'un `businessType` libre.
 *
 * On passe par `resolveNiche` plutôt que de lire la clé directement: le
 * `businessType` vient d'un champ libre du client (« Garage Dupont »,
 * « cabinet dentaire »), il ne vaut jamais un `NicheId`. Le retour n'est jamais
 * `undefined`, `default` étant une entrée de plein droit.
 */
export function knowledgePreset(businessType: string | null | undefined): KnowledgePreset {
  return KNOWLEDGE_PRESETS[resolveNiche(businessType)];
}
