export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] };

export interface Localized {
  en: string;
  fr: string;
}

export interface BlogArticle {
  slug: string;
  title: Localized;
  excerpt: Localized;
  date: string;
  readTime: number;
  tag: Localized;
  content: { en: Block[]; fr: Block[] };
}

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: 'cout-secretaire-belgique-2026',
    title: {
      en: 'How much does a receptionist really cost in Belgium in 2026?',
      fr: 'Combien coûte réellement une secrétaire en Belgique en 2026 ?',
    },
    excerpt: {
      en: 'The loaded cost of a part-time Belgian receptionist can reach 27 000 EUR a year or more — often well above what business owners first estimate. Here is an honest breakdown of the standard Belgian employer-cost structure.',
      fr: "Le coût chargé d'une secrétaire à mi-temps en Belgique peut atteindre 27 000 € par an et plus, souvent bien au-delà de ce que les patrons estiment au départ. Voici le détail honnête de la structure de coûts patronale belge.",
    },
    date: '2026-07-11',
    readTime: 8,
    tag: { en: 'Cost Analysis', fr: 'Analyse des coûts' },
    content: {
      en: [
        { type: 'p', text: "Every SMB owner in Belgium at some point asks the same question: how much does a receptionist really cost? Most estimate the gross salary and stop there. The real number, once social charges, meal vouchers, transport, holidays, sick leave and turnover are counted, can come close to tripling that first estimate. This post walks through the honest math for 2026, based on the standard Belgian employer-cost structure (CP200 scales, ONSS employer contributions, typical benefits packages)." },
        { type: 'p', text: "The point is not to convince you not to hire — some businesses genuinely need a human on site. The point is to compare like with like when the alternatives (AI receptionist, virtual assistant, part-time hire) come into the conversation. Without the honest numbers, the comparison is skewed and you overpay by tens of thousands over three years." },
        { type: 'h2', text: 'Gross salary — the tip of the iceberg' },
        { type: 'p', text: "The Commission Paritaire 200 (CP200), which covers most Belgian receptionist and administrative roles, sets minimum monthly gross salaries between 2 100 EUR and 2 600 EUR depending on experience and function classification. Market rates in Brussels for a well-qualified full-time receptionist sit between 2 500 EUR and 3 200 EUR gross per month. For a part-time role at 20 hours per week, the pro-rata is roughly 1 400 EUR to 1 700 EUR gross." },
        { type: 'p', text: "That is what appears on the employment contract. It is not what the receptionist costs the business." },
        { type: 'h2', text: 'Employer social contributions in Belgium 2026' },
        { type: 'p', text: "Belgium levies employer social security contributions at approximately 25 to 27 percent of the gross salary. On a 1 500 EUR gross part-time salary, that adds roughly 385 EUR per month. Employer contributions include:" },
        { type: 'ul', items: [
          'ONSS employer contribution (retirement, health, unemployment) — 25 %',
          'Vacation pay contribution for blue-collar equivalents — variable',
          'Occupational accident insurance — 0.3 % to 1 %',
          'Company doctor / external prevention service — flat annual fee',
        ]},
        { type: 'p', text: "Since 2023, the employer contribution has been progressively reduced for low-salary hires under the Structural Reduction reform, but for typical receptionist gross salaries, the effective loaded rate stays around 27 percent." },
        { type: 'h2', text: 'Meal vouchers, transport, extra benefits' },
        { type: 'p', text: "Belgian labour practice essentially requires meal vouchers and transport reimbursement. The typical package for a part-time receptionist looks like this per month:" },
        { type: 'ul', items: [
          'Meal vouchers (8 EUR/day × ≈ 10 days) — 80 EUR employer share',
          'Public transport reimbursement (Brussels STIB pass) — 40 to 60 EUR',
          'Group insurance (pension complement) — 1 to 3 % of gross',
          'Hospital insurance (small businesses often skip this) — 20 to 40 EUR',
          '13th month gross salary spread monthly — 8.3 % of gross',
        ]},
        { type: 'p', text: "For a 1 500 EUR gross part-timer, extra benefits add roughly 240 to 280 EUR per month on top of the gross plus social charges." },
        { type: 'h2', text: 'Holidays, sick leave, absences' },
        { type: 'p', text: "Belgian law grants 20 legal vacation days per year, plus 10 public holidays, plus the reality of sick leave. For a part-time receptionist, paid absence adds up to weeks per year — during which the phone still needs to be answered by someone else." },
        { type: 'p', text: "This creates a hidden cost most business owners never explicitly account for: either they hire a second person as backup (doubling the cost), or they lose the calls during the receptionist's absences, or they stress the remaining team. The AI alternative does not take vacation, does not get sick, and does not need a backup." },
        { type: 'h2', text: 'Turnover and replacement cost' },
        { type: 'p', text: "A receptionist post typically turns over every few years. Replacing means running a recruitment process, paying an agency fee (commonly a share of annual gross for headhunted profiles, or the equivalent time cost of self-recruiting), and covering a training period of several weeks during which productivity is reduced. Annualised over the expected tenure, this adds roughly 100 to 150 EUR per month to the loaded cost." },
        { type: 'h2', text: 'The all-in monthly and annual number' },
        { type: 'p', text: "Combining everything for a 20-hour-per-week receptionist in Belgium 2026:" },
        { type: 'ul', items: [
          'Gross salary — 1 500 to 1 700 EUR / month',
          'Employer social charges (~27 %) — 405 to 460 EUR / month',
          'Meal vouchers, transport, insurances — 240 to 280 EUR / month',
          '13th month spread — 125 to 140 EUR / month',
          'Absences backup pro-rata — 80 to 120 EUR / month',
          'Turnover replacement annualised — 100 to 150 EUR / month',
          'Physical desk, PC, phone, software seat — 60 to 100 EUR / month',
          'TOTAL LOADED — approximately 2 500 to 3 000 EUR per month, or 30 000 to 36 000 EUR per year',
        ]},
        { type: 'p', text: "For a full-time receptionist, multiply by roughly 1.8 to 2 — the loaded annual cost lands well above 50 000 EUR in Belgium 2026. In France the structure is similar, with somewhat lower contribution rates." },
        { type: 'h2', text: 'What the AI alternative actually costs' },
        { type: 'p', text: "A bilingual AI receptionist in 2026 running 24/7 for a Belgian SMB costs 99 EUR/month (Solo, 250 included minutes) to 249 EUR/month (Starter, 750 minutes, bilingual EN+FR), billed by the minute beyond that. On the annual discount, that drops another 20 percent. Even the Starter tier is under 3,000 EUR per year — ten times cheaper than the loaded human cost." },
        { type: 'p', text: "The AI does not eat, does not sleep, does not take vacation, does not go on sick leave, does not need a backup, does not turn over. It covers 24 hours a day 365 days a year instead of 20 hours a week 44 weeks a year." },
        { type: 'h2', text: 'When to still hire a human' },
        { type: 'p', text: "None of this argues that businesses should stop hiring receptionists. Some contexts genuinely need a human: high-touch client service, physical walk-in reception, complex judgement calls on every inbound. But most SMB inbound calls are informational, transactional, or routing — perfectly handled by an AI at a fraction of the cost." },
        { type: 'p', text: "The honest recommendation for 2026 for most Belgian SMBs: run the AI as the always-on layer, and if you still need a human for the physical desk or for high-value warm outbound, hire deliberately for that role knowing what it actually costs." },
      ],
      fr: [
        { type: 'p', text: "À un moment ou à un autre, chaque patron de PME belge pose la même question : combien coûte réellement une secrétaire ? La plupart estiment le salaire brut et s'arrêtent là. Le chiffre réel, une fois pris en compte les cotisations sociales, les chèques repas, le transport, les congés, les arrêts maladie et le turnover, peut approcher le triple de cette première estimation. Cet article pose les vrais calculs pour 2026 à partir de la structure de coûts patronale belge standard (échelles CP200, cotisations ONSS, packages d'avantages usuels)." },
        { type: 'p', text: "L'objectif n'est pas de vous convaincre de ne pas embaucher — certaines entreprises ont réellement besoin d'un humain sur place. L'objectif est de comparer à armes égales quand les alternatives (réceptionniste IA, assistant virtuel, temps partiel) entrent dans la conversation. Sans les vrais chiffres, la comparaison est faussée et vous surpayez des dizaines de milliers d'euros sur trois ans." },
        { type: 'h2', text: 'Salaire brut — la pointe de l\'iceberg' },
        { type: 'p', text: "La Commission Paritaire 200 (CP200), qui couvre la plupart des fonctions de secrétariat et d'administration en Belgique, fixe les salaires bruts mensuels minimums entre 2 100 € et 2 600 € selon l'expérience et la classification. Les prix de marché à Bruxelles pour une secrétaire temps plein qualifiée se situent entre 2 500 € et 3 200 € brut par mois. Pour un mi-temps à 20 heures/semaine, le prorata tourne autour de 1 400 € à 1 700 € brut." },
        { type: 'p', text: "C'est ce qui figure sur le contrat de travail. Ce n'est pas ce que la secrétaire coûte à l'entreprise." },
        { type: 'h2', text: 'Cotisations patronales en Belgique 2026' },
        { type: 'p', text: "La Belgique prélève des cotisations sociales patronales d'environ 25 à 27 % du brut. Sur un mi-temps à 1 500 € brut, cela ajoute environ 385 € par mois. Les cotisations patronales couvrent :" },
        { type: 'ul', items: [
          "Cotisation ONSS employeur (pension, santé, chômage) — 25 %",
          "Cotisation congés payés pour équivalents ouvriers — variable",
          "Assurance accidents du travail — 0,3 % à 1 %",
          "Médecin du travail / service externe de prévention — forfait annuel",
        ]},
        { type: 'p', text: "Depuis 2023, la cotisation patronale a été progressivement réduite pour les bas salaires via la Réduction Structurelle, mais pour les niveaux de brut classiques d'une secrétaire, le taux chargé effectif reste autour de 27 %." },
        { type: 'h2', text: 'Chèques repas, transport, avantages annexes' },
        { type: 'p', text: "La pratique du travail en Belgique impose quasiment les chèques repas et le remboursement transport. Le package type d'un mi-temps ressemble à cela par mois :" },
        { type: 'ul', items: [
          "Chèques repas (8 €/jour × ≈ 10 jours) — 80 € part patronale",
          "Remboursement transport (abonnement STIB Bruxelles) — 40 à 60 €",
          "Assurance groupe (complément pension) — 1 à 3 % du brut",
          "Assurance hospitalisation (souvent zappée par les PME) — 20 à 40 €",
          "13ᵉ mois brut lissé mensuellement — 8,3 % du brut",
        ]},
        { type: 'p', text: "Pour un mi-temps à 1 500 € brut, les avantages annexes ajoutent environ 240 à 280 € par mois, en plus du brut et des charges." },
        { type: 'h2', text: 'Congés, arrêts maladie, absences' },
        { type: 'p', text: "La loi belge accorde 20 jours de congés légaux par an, plus 10 jours fériés, plus la réalité des arrêts maladie. Pour un mi-temps, les absences payées s'additionnent en semaines par an — pendant lesquelles le téléphone doit tout de même être décroché par quelqu'un." },
        { type: 'p', text: "Cela crée un coût caché que les patrons ne comptabilisent quasi jamais explicitement : soit ils embauchent un backup (doubler le coût), soit ils perdent les appels pendant les absences, soit ils stressent l'équipe restante. L'alternative IA ne prend pas de vacances, ne tombe pas malade, ne demande pas de backup." },
        { type: 'h2', text: 'Turnover et coût de remplacement' },
        { type: 'p', text: "Un poste de secrétaire change de titulaire typiquement tous les quelques ans. Remplacer signifie lancer un process de recrutement, payer une commission cabinet (couramment une part du brut annuel pour un profil chassé, ou l'équivalent en temps si auto-recrutement), et couvrir une période de formation de plusieurs semaines pendant laquelle la productivité est réduite. Annualisé sur la tenure attendue, cela ajoute environ 100 à 150 € par mois au coût chargé." },
        { type: 'h2', text: 'Le coût réel mensuel et annuel' },
        { type: 'p', text: "En additionnant tout pour une secrétaire mi-temps 20 h/semaine en Belgique 2026 :" },
        { type: 'ul', items: [
          "Salaire brut — 1 500 à 1 700 € / mois",
          "Charges patronales (~27 %) — 405 à 460 € / mois",
          "Chèques repas, transport, assurances — 240 à 280 € / mois",
          "13ᵉ mois lissé — 125 à 140 € / mois",
          "Backup absences prorata — 80 à 120 € / mois",
          "Turnover remplacement annualisé — 100 à 150 € / mois",
          "Bureau physique, PC, téléphone, licence logicielle — 60 à 100 € / mois",
          "TOTAL CHARGÉ — environ 2 500 à 3 000 € par mois, soit 30 000 à 36 000 € par an",
        ]},
        { type: 'p', text: "Pour une secrétaire temps plein, multipliez par environ 1,8 à 2 — le coût chargé annuel dépasse largement 50 000 € en Belgique en 2026. En France, la structure est similaire avec des taux de cotisation un peu plus bas." },
        { type: 'h2', text: "Ce que coûte réellement l'alternative IA" },
        { type: 'p', text: "Une réceptionniste IA bilingue en 2026 qui tourne 24/7 pour une PME belge coûte 99 €/mois (Solo, 250 minutes incluses) à 249 €/mois (Starter, 750 minutes, bilingue EN+FR), facturée à la minute au-delà. Avec la remise annuelle, retirez encore 20 %. Même le tier Starter est sous 3 000 € par an — dix fois moins que le coût chargé humain." },
        { type: 'p', text: "L'IA ne mange pas, ne dort pas, ne prend pas de vacances, ne se met pas en arrêt, n'a pas besoin de backup, ne turnove pas. Elle couvre 24 heures sur 24, 365 jours par an, au lieu de 20 heures par semaine 44 semaines par an." },
        { type: 'h2', text: "Quand il reste pertinent d'embaucher un humain" },
        { type: 'p', text: "Rien de tout cela n'argumente pour que les entreprises arrêtent d'embaucher des secrétaires. Certains contextes ont vraiment besoin d'un humain : service client haut de gamme, accueil physique en boutique, jugement complexe sur chaque appel entrant. Mais la majorité des appels PME entrants sont informationnels, transactionnels ou de routage — parfaitement gérés par une IA à une fraction du coût." },
        { type: 'p', text: "La recommandation honnête pour 2026 pour la plupart des PME belges : faire tourner l'IA en couche always-on, et si vous avez encore besoin d'un humain pour l'accueil physique ou pour l'outbound à forte valeur, embauchez délibérément pour ce rôle en connaissant son vrai coût." },
      ],
    },
  },
  {
    slug: 'ai-receptionist-plumber-2026',
    title: {
      en: 'Why Every Plumber Needs an AI Receptionist in 2026',
      fr: "Pourquoi chaque plombier a besoin d'une réceptionniste IA en 2026",
    },
    excerpt: {
      en: 'Plumbing businesses miss a large share of inbound calls during service hours. An AI receptionist can capture requests outside service hours and book with a connected calendar. Test your own setup before assessing its return.',
      fr: "Les entreprises de plomberie manquent une grande partie de leurs appels entrants pendant les heures de service. Une réceptionniste IA peut recueillir les demandes hors horaires et réserver dans un agenda connecté. Testez votre configuration avant d’en mesurer le résultat.",
    },
    date: '2026-04-10',
    readTime: 6,
    tag: { en: 'Home Services', fr: 'Services à domicile' },
    content: {
      en: [
        { type: 'p', text: "Every day, plumbing businesses across Europe and North America lose real revenue because the phone rings out. On a thirty-minute gap between two service calls, a solo plumber can rack up several missed calls, and most of those callers dial the next competitor before the truck even reaches the driveway." },
        { type: 'p', text: "If you run a plumbing business, you have felt it. The client whose water heater flooded the basement at 11 p.m. Sunday who booked with someone else because your voicemail said we are closed. The commercial account that called Tuesday morning while you were under a sink and picked the next number on Google when the third ring went unanswered. The referred lead who called at 6 p.m. and heard a busy signal." },
        { type: 'p', text: "In 2026, an AI receptionist is not a gadget. It is the way to close the answer gap. Three shifts have made it inevitable: voice AI in French and English now passes for human on most calls, the monthly cost sits at a fraction of a full-time receptionist, and the plumbing shops that adopt it early are visibly outgrowing the ones that do not." },
        { type: 'h2', text: 'The three call moments plumbers still lose' },
        { type: 'p', text: "Plumbing calls tend to concentrate in three windows: 6–9 a.m. before the truck rolls, 12–2 p.m. around lunch and dispatch, and 5–10 p.m. after hours. A shop staffed only 9 to 5 catches the middle window at best; the morning and evening calls go straight to voicemail." },
        { type: 'p', text: "An AI receptionist runs on the same phone number twenty-four hours a day, in the caller's language. It never breaks for lunch. It never puts a client on hold to grab another line. With forwarding and routing configured, it identifies the request, captures the address and callback window, then books in a connected calendar or requests a transfer to your configured on-call number. A requested transfer does not prove anyone answered." },
        { type: 'h2', text: 'What a single missed call actually costs' },
        { type: 'p', text: "The math is worth doing on paper. Run illustrative numbers for Belgium: assume an average job around 280 € and a lifetime value around 1 100 € for a residential client who books two follow-up jobs plus one referral. At a 45 % close rate on inbound calls, each missed call carries about 126 € of expected revenue, and roughly every fifth missed call carries a full 1 100 € of expected lifetime value." },
        { type: 'p', text: "At ten missed calls a week — plausible for a busy solo plumber — that arithmetic reaches roughly 65 000 € a year. An illustration of the stakes, not a measured average: rerun it with your own ticket size and close rate." },
        { type: 'h2', text: 'What the AI actually says on the call' },
        { type: 'p', text: "The best AI receptionists in 2026 do not sound robotic. They open with a natural greeting, ask three or four qualifying questions, then either book a slot or route the call. A typical script for a plumber looks like this:" },
        { type: 'ul', items: [
          'Greeting: name, business, offer to help',
          'Type triage: emergency, quote, existing job',
          'Address and city, with automatic postal-code capture',
          'Nature of the issue (leak, no hot water, blocked drain, etc.)',
          'Preferred window: today, tomorrow morning, this week',
          'Confirmation text with the booked slot, when SMS is enabled for your account',
        ]},
        { type: 'p', text: "The whole flow takes 90 to 150 seconds. The client hangs up with an appointment. You get a structured lead in your CRM with the transcript, the sentiment, and the address ready for routing." },
        { type: 'h2', text: 'Objections — and what is actually true' },
        { type: 'p', text: "My clients want a real human. Voice quality has moved fast enough that this objection is worth testing rather than assuming: call the demo line yourself, then decide. What we hear most from the callers who do notice is that they mind less than expected, because they are not put on hold and they get an answer at once." },
        { type: 'p', text: "It will book garbage jobs. A well-configured AI qualifies harder than most human receptionists. Set service-area rules and review what it captures. It does not verify payment reliability or require a photo before confirming a quote." },
        { type: 'p', text: "It is expensive. In 2026 a bilingual AI receptionist covering a plumbing shop typically runs between 130 € and 400 € a month depending on volume, versus roughly 2 000 to 3 000 € a month all-in for a part-time human." },
        { type: 'h2', text: 'Getting started — a realistic first month' },
        { type: 'p', text: "Day one: forward your business number to the AI, configure service zones, business hours, on-call number, service types and typical price ranges. Days two to seven: monitor every call and refine the qualifying script based on what you hear. Days eight to thirty: let the AI handle 100 % of inbound while you focus on the truck. Measure completed jobs and costs in your own business; no payback period is guaranteed." },
        { type: 'p', text: "In 2026, missing a plumbing call is a choice. An AI receptionist is not a nice-to-have — it is the difference between growing and standing still." },
      ],
      fr: [
        { type: 'p', text: "Chaque jour, les entreprises de plomberie en Europe et en Amérique du Nord perdent du chiffre réel parce que le téléphone sonne dans le vide. Sur trente minutes de battement entre deux interventions, un plombier solo peut cumuler plusieurs appels manqués — et la plupart de ces appelants ont composé le concurrent suivant avant même que le camion n'atteigne l'allée." },
        { type: 'p', text: "Si vous gérez une entreprise de plomberie, vous connaissez la scène. Le client dont le chauffe-eau a inondé la cave dimanche à 23 h et qui a réservé ailleurs parce que votre répondeur disait « nous sommes fermés ». Le compte commercial qui a appelé mardi matin pendant que vous étiez sous un lavabo, et qui a cliqué sur le numéro suivant de Google quand la troisième sonnerie est restée sans réponse. Le prospect recommandé qui a téléphoné à 18 h et n'a eu que le signal occupé." },
        { type: 'p', text: "En 2026, une réceptionniste IA n'est pas un gadget. C'est la façon concrète de refermer le trou de couverture. Trois basculements l'ont rendue incontournable : la voix IA en français et en anglais passe désormais pour humaine sur la plupart des appels, le coût mensuel représente une fraction d'une réceptionniste à temps plein, et les plombiers qui adoptent tôt dépassent visiblement ceux qui restent immobiles." },
        { type: 'h2', text: 'Les trois moments où les plombiers perdent encore leurs appels' },
        { type: 'p', text: "Les appels de plomberie ont tendance à se concentrer sur trois fenêtres : 6–9 h avant le départ du camion, 12–14 h autour de la pause et du dispatch, et 17–22 h en fin de journée. Un atelier ouvert 9–17 n'attrape au mieux que la fenêtre du milieu ; les appels du matin et du soir partent directement en messagerie." },
        { type: 'p', text: "Une réceptionniste IA vit sur le même numéro professionnel vingt-quatre heures sur vingt-quatre, dans la langue du client. Elle ne prend pas de pause. Elle ne met jamais un client en attente pour prendre une autre ligne. Avec le renvoi et les règles configurés, elle identifie la demande, recueille l’adresse et le créneau souhaité, puis réserve dans l’agenda connecté ou demande le transfert vers votre numéro d’astreinte configuré. Ce transfert ne prouve pas qu’une personne a décroché." },
        { type: 'h2', text: "Le vrai coût d'un appel manqué" },
        { type: 'p', text: "Le calcul mérite d'être posé noir sur blanc. Prenons des chiffres illustratifs pour la Belgique : un ticket moyen autour de 280 € et une valeur à vie autour de 1 100 € pour un client résidentiel qui repasse deux fois et recommande une fois. À un taux de closing de 45 % sur les appels entrants, chaque appel manqué porte environ 126 € d'espérance de revenu, et à peu près un appel raté sur cinq porte 1 100 € de valeur à vie." },
        { type: 'p', text: "À dix appels manqués par semaine — plausible pour un plombier solo chargé — cette arithmétique atteint environ 65 000 € par an. Une illustration de l'enjeu, pas une moyenne mesurée : refaites le calcul avec votre propre ticket et votre propre taux de closing." },
        { type: 'h2', text: "Ce que l'IA dit vraiment au téléphone" },
        { type: 'p', text: "Les meilleures réceptionnistes IA de 2026 ne sonnent pas mécaniques. Elles ouvrent avec un accueil naturel, posent trois ou quatre questions de qualification, puis soit posent le créneau, soit routent l'appel. Un script type pour un plombier ressemble à ceci :" },
        { type: 'ul', items: [
          'Accueil : nom, entreprise, proposition d\'aide',
          'Triage du type : urgence, devis, intervention en cours',
          'Adresse et ville, avec capture automatique du code postal',
          'Nature du problème (fuite, pas d\'eau chaude, canalisation bouchée, etc.)',
          'Créneau préféré : aujourd\'hui, demain matin, cette semaine',
          'SMS de confirmation avec le créneau réservé, si les SMS sont activés sur votre compte',
        ]},
        { type: 'p', text: "L'ensemble prend 90 à 150 secondes. Le client raccroche avec un rendez-vous. Vous recevez un lead structuré dans votre CRM, avec la transcription, le score de sentiment et l'adresse prête pour le routage." },
        { type: 'h2', text: "Objections — et ce qui est réellement vrai" },
        { type: 'p', text: "Mes clients veulent parler à un vrai humain. La qualité vocale a assez progressé pour que cette objection se teste au lieu de se supposer : appelez la ligne de démo vous-même, puis jugez. Ce qu'on entend le plus souvent chez ceux qui remarquent l'IA, c'est que ça les dérange moins que prévu, parce qu'ils ne sont pas mis en attente et qu'ils ont une réponse tout de suite." },
        { type: 'p', text: "Elle va réserver n'importe quoi. Une IA bien configurée qualifie plus dur que la plupart des réceptionnistes humaines. Définissez vos zones et contrôlez les informations recueillies. Elle ne vérifie pas la solvabilité et n’exige pas de photo avant de confirmer un devis." },
        { type: 'p', text: "C'est cher. En 2026, une réceptionniste IA bilingue pour un atelier de plomberie coûte typiquement entre 130 € et 400 € par mois selon le volume, contre environ 2 000 à 3 000 € par mois tout compris pour un temps partiel humain." },
        { type: 'h2', text: "Comment démarrer — un premier mois réaliste" },
        { type: 'p', text: "Jour 1 : renvoyez votre numéro professionnel vers l'IA, configurez les zones de service, les horaires, le numéro d'astreinte, les types d'intervention et vos fourchettes de prix. Jours 2 à 7 : écoutez chaque appel et ajustez le script de qualification en fonction de ce que vous entendez. Jours 8 à 30 : laissez l'IA prendre 100 % des appels entrants pendant que vous vous concentrez sur le terrain. Mesurez les interventions réalisées et les coûts dans votre activité ; aucun délai de rentabilité n’est garanti." },
        { type: 'p', text: "En 2026, rater un appel de plomberie est un choix. Une réceptionniste IA n'est plus un confort — c'est la différence entre grandir et stagner." },
      ],
    },
  },

  {
    "slug": "dental-offices-ai-no-shows",
    "title": {
      "en": "Dental no-shows: improve booking and measure what changes",
      "fr": "Absences au cabinet dentaire : améliorer la prise de rendez-vous et mesurer le résultat"
    },
    "excerpt": {
      "en": "A practical workflow for answering, rescheduling and appointment follow-up, without promising a percentage reduction or a native dental-software integration.",
      "fr": "Un parcours concret pour répondre, reprogrammer et suivre les rendez-vous, sans promettre un pourcentage de baisse ni une intégration native à votre logiciel dentaire."
    },
    "date": "2026-11-01",
    "readTime": 5,
    "tag": {
      "en": "Dental",
      "fr": "Dentaire"
    },
    "content": {
      "fr": [
        {
          "type": "p",
          "text": "Un patient qui ne peut pas venir doit pouvoir prévenir le cabinet. Commencez par vérifier le parcours : peut-il appeler hors horaires, retrouver son rendez-vous puis demander un changement ? Un rappel ne corrige pas une ligne impossible à joindre."
        },
        {
          "type": "h2",
          "text": "Séparer accueil et logiciel médical"
        },
        {
          "type": "p",
          "text": "Qwillio peut recueillir la demande et créer un nouveau rendez-vous dans un agenda Google ou Outlook connecté. La recherche, la modification et l’annulation d’un rendez-vous existant passent à votre équipe après vérification d’identité. Un flux via un webhook reste à configurer et à faire valider. Cela ne constitue pas une intégration native à Julie, Doctolib ou à un dossier patient. Faites valider le flux exact avant de modifier votre organisation."
        },
        {
          "type": "p",
          "text": "L’accueil doit se limiter aux informations nécessaires : nom, coordonnées et créneau. Les symptômes, décisions de soin et urgences médicales relèvent du cabinet et de ses consignes. Ne configurez pas une IA comme un professionnel qui pose un diagnostic."
        },
        {
          "type": "h2",
          "text": "Prévoir les cas qui échouent"
        },
        {
          "type": "ul",
          "items": [
            "Un créneau déjà pris ne doit pas être proposé comme libre.",
            "Une annulation doit rester visible si sa suppression dans l’agenda externe est encore en attente.",
            "Un agenda déconnecté doit provoquer une information claire, pas une réservation annoncée sans preuve.",
            "Un patient demandant un humain doit recevoir le parcours prévu par le cabinet."
          ]
        },
        {
          "type": "p",
          "text": "Le transfert vers votre équipe exige un numéro configuré et une personne disponible. L’acceptation technique du transfert ne prouve pas qu’un membre du cabinet a décroché. Prévoyez donc aussi une demande de rappel."
        },
        {
          "type": "h2",
          "text": "Rappels et liste d’attente : ne pas confondre"
        },
        {
          "type": "p",
          "text": "Les SMS et séquences de suivi dépendent des options activées et de la configuration du compte. Un SMS de confirmation n’est pas une campagne d’appels de rappel. Qwillio ne promet pas ici de rappels vocaux à J-2 ni de lien patient de reprogrammation en un clic."
        },
        {
          "type": "p",
          "text": "Après une annulation, votre équipe peut contacter les patients qui ont accepté d’être rappelés. Ce guide ne présente pas un remplissage automatique de liste d’attente par appels et SMS comme une fonction disponible. Gardez la validation humaine du créneau proposé."
        },
        {
          "type": "h2",
          "text": "Mesurer sur votre cabinet"
        },
        {
          "type": "p",
          "text": "Consignez sur des périodes comparables les rendez-vous prévus, les absences et les annulations reçues à temps. Notez aussi les changements d’horaires et de patientèle. Aucun pourcentage de réduction n’est garanti ; une différence observée ne prouve pas à elle seule son origine."
        },
        {
          "type": "ul",
          "items": [
            "Avant activation : noter les absences et les demandes de reprogrammation.",
            "Pendant l’essai : tester une nouvelle réservation et le passage à votre équipe des demandes de modification ou d’annulation.",
            "Après activation : relire les appels et les erreurs de synchronisation avec l’équipe."
          ]
        },
        {
          "type": "p",
          "text": "L’essai Qwillio dure 7 jours, avec carte à l’inscription. La démo navigateur reste en lecture seule : elle permet d’écouter, pas de confirmer que votre cabinet et son agenda sont prêts. Validez ensuite la ligne réelle avant d’y envoyer les patients."
        }
      ],
      "en": [
        {
          "type": "p",
          "text": "A patient who cannot attend needs a way to tell the practice. Start with the workflow: can they call after hours, identify the appointment and request a change? Reminders do not fix an unreachable phone line."
        },
        {
          "type": "h2",
          "text": "Separate answering from clinical software"
        },
        {
          "type": "p",
          "text": "Qwillio can capture the request and create a new booking in a connected Google or Outlook calendar. Looking up, changing or cancelling an existing booking goes to your team for identity verification. A workflow via webhook still needs configuration and validation. This is not a native integration with Julie, Doctolib or a patient record system. Validate the exact workflow before changing operations."
        },
        {
          "type": "p",
          "text": "Collect only what is necessary for reception: name, contact details and time slot. Symptoms, treatment decisions and medical emergencies remain subject to the practice’s instructions and clinical staff. Do not configure AI as a clinician making diagnoses."
        },
        {
          "type": "h2",
          "text": "Plan for failure cases"
        },
        {
          "type": "ul",
          "items": [
            "An occupied slot must not be offered as available.",
            "A cancellation must remain visible if external-calendar deletion is pending.",
            "A disconnected calendar needs a clear message, not an unverified booking confirmation.",
            "A patient asking for a person needs the practice’s defined escalation path."
          ]
        },
        {
          "type": "p",
          "text": "Transfer to your team requires a configured number and an available person. Technical acceptance of the transfer does not prove a staff member answered. Include a callback option."
        },
        {
          "type": "h2",
          "text": "Reminders are not a waitlist"
        },
        {
          "type": "p",
          "text": "Texts and follow-up sequences depend on enabled options and account configuration. A confirmation text is not an outbound reminder-call campaign. This guide does not promise voice reminders two days ahead or a one-click patient rescheduling link."
        },
        {
          "type": "p",
          "text": "After a cancellation, your team can contact patients who agreed to be called. This guide does not present automatic waitlist filling through calls and texts as an available feature. Keep human approval of the proposed appointment."
        },
        {
          "type": "h2",
          "text": "Measure your own practice"
        },
        {
          "type": "p",
          "text": "Across comparable periods, record scheduled visits, missed visits and timely cancellations. Note changes in hours and patient mix. No percentage reduction is guaranteed; a measured difference alone does not establish what caused it."
        },
        {
          "type": "ul",
          "items": [
            "Before activation: record no-shows and rescheduling requests.",
            "During the trial: test a new booking and referral of rescheduling or cancellation requests to your team.",
            "After activation: review calls and synchronization errors with the team."
          ]
        },
        {
          "type": "p",
          "text": "The Qwillio trial lasts 7 days and requires a card at signup. The browser demo is read-only: listening does not establish that your practice and calendar are ready. Validate the actual phone line before directing patients to it."
        }
      ]
    }
  },

  {
    slug: 'hidden-cost-missed-calls',
    title: {
      en: 'The Hidden Cost of Missed Calls for Home Service Businesses',
      fr: "Le coût caché des appels manqués pour les entreprises de services",
    },
    excerpt: {
      en: "Each missed call costs a home service business an average of 1 200 € in lost lifetime value. We break down the real numbers and show how to stop the leak.",
      fr: "Chaque appel manqué coûte en moyenne 1 200 € de valeur à vie à une entreprise de services à domicile. Voici les vrais chiffres et comment stopper la fuite.",
    },
    date: '2026-03-28',
    readTime: 7,
    tag: { en: 'Business Growth', fr: 'Croissance' },
    content: {
      en: [
        { type: 'p', text: "In the home-service economy — plumbers, electricians, HVAC, roofers, cleaners, movers, painters — the phone is not a channel. It is the channel. Depending on the trade, 60 to 85 % of new-client acquisitions still originate from an inbound call. Which means every unanswered call is not just a missed prospect. It is a hole in the top of the funnel." },
        { type: 'p', text: "The industry has under-quantified this hole for years. Owners see the calendar filling with jobs and assume they are doing well. What they do not see is the volume of calls that never made it to the calendar because nobody picked up. This article breaks down the actual numbers, then explains how the fix looks in 2026." },
        { type: 'h2', text: 'What a missed call really is' },
        { type: 'p', text: "A missed call is not just the call that rings out. Field data across home-service software platforms shows the true missed-call category has three shapes:" },
        { type: 'ul', items: [
          "The unanswered ring that goes to voicemail (roughly 55 % of misses)",
          "The hold-then-drop, where a caller is put on hold and hangs up before anyone comes back (roughly 25 %)",
          "The busy signal from a second inbound call while the first is still on the line (roughly 20 %)",
        ]},
        { type: 'p', text: "Combined, home-service businesses miss 27 % to 38 % of their inbound call volume across a full week when they rely on a human-only setup — even when that human is genuinely trying." },
        { type: 'h2', text: 'The 60-second window' },
        { type: 'p', text: "Independent studies of home-service caller behaviour agree on one hard number: when a call goes to voicemail, 60 to 75 % of callers dial the next result in Google or their list within 60 seconds. They do not leave a message. They do not call back later. They do not send an email. They pick up the phone and dial the next number." },
        { type: 'p', text: "Which means the voicemail you check at the end of the day, the callback you make an hour later, or the polite promise from your automated menu are all arriving to a client who has already booked with your competitor. Speed of pick-up is not a nice-to-have. It is the entire game." },
        { type: 'h2', text: 'The real cost per missed call' },
        { type: 'p', text: "The lifetime value of a home-service client is dominated by two things: repeat business and referrals. For a plumbing or HVAC client, average lifetime value in Belgium and France sits around 950 to 1 500 €, blending the initial job (280–400 €), follow-up jobs (roughly 1.4 per year for two years), and one referred client on average." },
        { type: 'p', text: "If your close rate on inbound calls is 45 % — a typical mid-market number — and the average lifetime value of a converted call is 1 200 €, then every missed call carries an expected value of 540 € (0.45 × 1 200). Miss ten calls a week, and you leak 5 400 € a week in expected lifetime revenue. That is 280 000 € a year." },
        { type: 'p', text: "Owners hearing this for the first time push back. Not every caller was going to convert. Not every conversion was going to reach full lifetime value. Fair. Even if you cut those numbers in half — 20 % close rate, 600 € LTV — the leak is still around 12 000 € a month, and it comes off the top. Missed-call cost is not a variable expense you decide to accept; it is a variable revenue you decide not to earn." },
        { type: 'h2', text: 'Why layering more staff does not solve it' },
        { type: 'p', text: "The instinctive response is to add front-desk headcount. It does not work. First, call volume is spiky — the mornings, lunches and after-hours peaks I described in other posts do not justify a full-time human. Second, humans miss 20 % of calls even when fully staffed: they are on another line, on lunch, in the bathroom, or triaging a client at the counter. Third, adding staff adds fixed cost that outruns the marginal revenue improvement." },
        { type: 'p', text: "This is why AI receptionists have become the default answer in 2026 for any home-service business doing more than 40 inbound calls a week. The AI answers on the first ring 24/7, in the caller's language, and captures every call at a cost that is a fraction of a single front-desk salary." },
        { type: 'h2', text: 'Stopping the leak' },
        { type: 'p', text: "The practical fix is a two-layer setup. Layer one: the AI receptionist becomes the primary pick-up on your business line — always. Layer two: when the AI detects an emergency, a high-value keyword, or an existing high-priority client, it transfers the call to your on-call human number with a briefed hand-off (name, reason, sentiment, address). This preserves the human touch where it matters and closes the leak everywhere else." },
        { type: 'p', text: "Owners who implement this correctly report inbound-call revenue capture rising 25 to 45 % in the first ninety days, without changing anything upstream in marketing or SEO. The clients were already coming. They just could not get through." },
      ],
      fr: [
        { type: 'p', text: "Dans l'économie du service à domicile — plombiers, électriciens, chauffagistes, couvreurs, nettoyeurs, déménageurs, peintres — le téléphone n'est pas un canal. C'est le canal. Selon le métier, 60 à 85 % des acquisitions de nouveaux clients passent encore par un appel entrant. Ce qui veut dire que chaque appel manqué n'est pas juste un prospect perdu. C'est un trou en haut de l'entonnoir." },
        { type: 'p', text: "Le secteur sous-quantifie ce trou depuis des années. Le patron voit son planning se remplir de jobs et suppose que tout va bien. Ce qu'il ne voit pas, c'est le volume d'appels qui n'a jamais atteint le planning parce que personne n'a décroché. Cet article pose les vrais chiffres, puis montre à quoi ressemble la solution en 2026." },
        { type: 'h2', text: "Ce qu'est réellement un appel manqué" },
        { type: 'p', text: "Un appel manqué n'est pas seulement l'appel qui sonne dans le vide. Les données terrain des plateformes de gestion de service à domicile montrent que la catégorie « appel manqué » a trois formes :" },
        { type: 'ul', items: [
          "La sonnerie sans réponse qui bascule en messagerie (environ 55 % des ratés)",
          "L'attente prolongée où l'appelant est mis en attente puis raccroche avant qu'on revienne (environ 25 %)",
          "Le signal occupé d'un second appel entrant pendant qu'un premier est en cours (environ 20 %)",
        ]},
        { type: 'p', text: "Combinés, les artisans du service à domicile manquent 27 à 38 % de leur volume d'appels entrants sur une semaine complète quand ils s'appuient sur un dispositif uniquement humain — même quand cet humain fait de son mieux." },
        { type: 'h2', text: "La fenêtre de 60 secondes" },
        { type: 'p', text: "Les études indépendantes sur le comportement des appelants convergent sur un chiffre dur : quand un appel bascule en messagerie, 60 à 75 % des appelants composent le résultat suivant de Google ou de leur liste en moins de 60 secondes. Ils ne laissent pas de message. Ils ne rappellent pas plus tard. Ils n'envoient pas de mail. Ils prennent le téléphone et appellent le numéro suivant." },
        { type: 'p', text: "Autrement dit, la messagerie que vous consultez en fin de journée, le rappel que vous passez une heure plus tard, ou la promesse polie de votre menu automatique atterrissent chez un client qui a déjà réservé chez votre concurrent. La vitesse de décroché n'est pas un confort. C'est tout le jeu." },
        { type: 'h2', text: "Le vrai coût d'un appel manqué" },
        { type: 'p', text: "La valeur à vie d'un client de service à domicile est dominée par deux choses : la récurrence et la recommandation. Pour un client plomberie ou chauffage, la valeur à vie moyenne en Belgique et en France tourne autour de 950 à 1 500 €, en mélangeant le premier job (280–400 €), les jobs suivants (environ 1,4 par an sur deux ans) et un client recommandé en moyenne." },
        { type: 'p', text: "Si votre taux de closing sur les appels entrants est de 45 % — un chiffre courant en milieu de marché — et que la valeur à vie moyenne d'un appel converti est de 1 200 €, alors chaque appel manqué porte une espérance de valeur de 540 € (0,45 × 1 200). Manquez dix appels par semaine et vous perdez 5 400 € par semaine en espérance de revenu à vie. Cela fait 280 000 € par an." },
        { type: 'p', text: "Les patrons qui entendent ça pour la première fois protestent. Tous les appelants n'auraient pas converti. Toutes les conversions n'auraient pas atteint leur pleine valeur à vie. Bien vu. Même en divisant par deux — 20 % de closing, 600 € de valeur à vie — la fuite reste autour de 12 000 € par mois, et elle part du chiffre brut. Le coût des appels manqués n'est pas une dépense variable que vous choisissez d'accepter ; c'est un revenu variable que vous choisissez de ne pas gagner." },
        { type: 'h2', text: "Pourquoi empiler du personnel ne suffit pas" },
        { type: 'p', text: "La réponse instinctive est d'ajouter de la réception. Ça ne fonctionne pas. D'abord, le volume d'appels est en pics — les pointes matin, midi et hors heures ne justifient pas un temps plein. Ensuite, les humains manquent 20 % des appels même quand ils sont pleinement mobilisés : ils sont sur une autre ligne, en pause, aux toilettes, ou en train de gérer un client au comptoir. Enfin, ajouter du personnel ajoute un coût fixe qui dépasse le gain marginal." },
        { type: 'p', text: "C'est pour cela que les réceptionnistes IA sont devenues la réponse par défaut en 2026 pour toute entreprise de service à domicile qui traite plus de 40 appels entrants par semaine. L'IA décroche à la première sonnerie 24/7, dans la langue de l'appelant, et capture chaque appel à un coût qui est une fraction d'un seul salaire de réception." },
        { type: 'h2', text: "Comment stopper la fuite" },
        { type: 'p', text: "La solution pratique se fait en deux couches. Couche 1 : la réceptionniste IA devient le décroché principal sur votre ligne pro, en permanence. Couche 2 : quand l'IA détecte une urgence, un mot-clé à forte valeur ou un client existant prioritaire, elle transfère l'appel vers votre numéro d'astreinte humain avec un passage de relais briefé (nom, motif, sentiment, adresse). Vous préservez le contact humain là où il compte et vous refermez la fuite partout ailleurs." },
        { type: 'p', text: "Les patrons qui déploient cela correctement voient la capture de revenu sur les appels entrants monter de 25 à 45 % en quatre-vingt-dix jours, sans rien changer en amont en marketing ou en SEO. Les clients venaient déjà. Ils n'arrivaient simplement pas à joindre quelqu'un." },
      ],
    },
  },

  {
    "slug": "ai-vs-human-receptionist-cost",
    "title": {
      "en": "AI vs human receptionist: compare your actual costs",
      "fr": "IA ou réceptionniste humaine : comparer vos coûts réels"
    },
    "excerpt": {
      "en": "Compare included minutes, overage and human coverage with the same call volume. A subscription price is not an unlimited-call budget.",
      "fr": "Comparez minutes incluses, dépassements et couverture humaine à volume identique. Un prix d’abonnement n’est pas un budget d’appels illimités."
    },
    "date": "2026-11-01",
    "readTime": 5,
    "tag": {
      "en": "Cost Analysis",
      "fr": "Analyse des coûts"
    },
    "content": {
      "fr": [
        {
          "type": "p",
          "text": "Comparer un salaire mensuel à un abonnement IA ne suffit pas. L’un rémunère une personne qui peut aussi accueillir des visiteurs et gérer des situations complexes. L’autre couvre un périmètre téléphonique défini, avec des limites de consommation et des dépendances techniques."
        },
        {
          "type": "h2",
          "text": "Partir du même volume"
        },
        {
          "type": "p",
          "text": "Relevez vos minutes d’appel, leur répartition et le nombre de demandes qui exigent une personne. Ne convertissez pas automatiquement un nombre d’appels en minutes : un appel long peut peser bien plus que plusieurs demandes brèves."
        },
        {
          "type": "h2",
          "text": "Lire le forfait Qwillio"
        },
        {
          "type": "ul",
          "items": [
            "Solo : 99 €/mois, 250 minutes incluses.",
            "Starter : 249 €/mois, 750 minutes incluses.",
            "Pro : 599 €/mois, 2 000 minutes incluses.",
            "Enterprise : 1 290 €/mois, 5 000 minutes incluses."
          ]
        },
        {
          "type": "p",
          "text": "Ces tarifs mensuels sont hors remise annuelle. Les minutes au-delà du forfait sont facturées à la minute au tarif de la formule. Consultez la page Tarifs pour les dépassements et les options avant de calculer votre budget ; ne remplacez pas cette unité par un prix par appel."
        },
        {
          "type": "h2",
          "text": "Ajouter ce que le prix ne remplace pas"
        },
        {
          "type": "p",
          "text": "Pour l’humain, utilisez le devis de votre secrétariat social ou vos coûts internes, pas un salaire moyen trouvé dans un article. Pour l’IA, ajoutez le temps de paramétrage, de revue des appels et les coûts applicables à votre configuration. Gardez les hypothèses visibles."
        },
        {
          "type": "p",
          "text": "Un transfert Qwillio sollicite votre propre équipe, si le numéro est configuré. Il ne fournit pas une permanence humaine externalisée. Si vous avez besoin d’un humain disponible à chaque escalade, chiffrez cette couverture séparément."
        },
        {
          "type": "h2",
          "text": "Tester les tâches, pas seulement la voix"
        },
        {
          "type": "p",
          "text": "La prise de rendez-vous nécessite un agenda connecté. Les messages et automatisations dépendent des options activées. La démo navigateur est en lecture seule ; elle ne prouve pas que les actions sont configurées sur votre compte."
        },
        {
          "type": "ul",
          "items": [
            "Un appel d’information et une demande hors consigne.",
            "Une réservation, puis une demande de modification ou d’annulation transmise à votre équipe.",
            "Un agenda déconnecté et un transfert sans réponse."
          ]
        },
        {
          "type": "h2",
          "text": "Décider sans résultat inventé"
        },
        {
          "type": "p",
          "text": "Comparez ensuite le coût pour les demandes réellement traitées, le travail restant et les erreurs à reprendre. Nous ne présentons pas ici de taux d’autonomie mesuré chez des clients ni de délai garanti de retour sur investissement."
        },
        {
          "type": "p",
          "text": "L’essai Qwillio dure 7 jours, avec carte à l’inscription. Il permet de tester votre configuration. Pour mesurer un effet commercial, utilisez ensuite une période et des données adaptées à votre activité, sans confondre quelques appels de démonstration avec une étude."
        }
      ],
      "en": [
        {
          "type": "p",
          "text": "A monthly salary and an AI subscription are not equivalent services. A person may also greet visitors and handle complex situations. AI covers a defined phone workflow with usage limits and technical dependencies."
        },
        {
          "type": "h2",
          "text": "Start with the same volume"
        },
        {
          "type": "p",
          "text": "Record your call minutes, their distribution and requests requiring a person. Do not automatically convert call counts into minutes: one long call can cost more than several brief enquiries."
        },
        {
          "type": "h2",
          "text": "Read the Qwillio allowance"
        },
        {
          "type": "ul",
          "items": [
            "Solo: €99/month, 250 included minutes.",
            "Starter: €249/month, 750 included minutes.",
            "Pro: €599/month, 2,000 included minutes.",
            "Enterprise: €1,290/month, 5,000 included minutes."
          ]
        },
        {
          "type": "p",
          "text": "These monthly prices are before annual discounts. Overage is charged per minute at the selected plan’s rate. Check Pricing for current overage and options before budgeting; do not substitute a per-call price for that unit."
        },
        {
          "type": "h2",
          "text": "Add what the subscription does not replace"
        },
        {
          "type": "p",
          "text": "For a person, use your payroll provider’s estimate or internal costs, not an article’s assumed average salary. For AI, include setup time, call review and charges applicable to your configuration. Keep assumptions visible."
        },
        {
          "type": "p",
          "text": "A Qwillio transfer goes to your own team when a destination is configured. It does not supply an outsourced human answering team. Budget that coverage separately if a person must be available for every escalation."
        },
        {
          "type": "h2",
          "text": "Test the tasks, not only the voice"
        },
        {
          "type": "p",
          "text": "Booking requires a connected calendar. Messages and automation depend on enabled options. The browser demo is read-only; it does not prove actions are configured on your account."
        },
        {
          "type": "ul",
          "items": [
            "An information request and an out-of-scope question.",
            "A booking, then a reschedule or cancellation request referred to your team.",
            "A disconnected calendar and an unanswered transfer."
          ]
        },
        {
          "type": "h2",
          "text": "Decide without invented results"
        },
        {
          "type": "p",
          "text": "Compare costs against requests actually handled, work left for your team and errors requiring attention. This guide does not present measured customer automation rates or guarantee a payback period."
        },
        {
          "type": "p",
          "text": "The Qwillio trial lasts 7 days and requires a card at signup. Use it to test your setup. To assess business impact, then use a period and data suited to your business; a few demo calls are not a study."
        }
      ]
    }
  },

  {
    slug: 'receptionniste-ia-vs-repondeur',
    title: {
      en: 'AI receptionist vs voicemail: why the answering machine costs you customers',
      fr: 'Réceptionniste IA vs répondeur : pourquoi la messagerie vocale vous coûte des clients',
    },
    excerpt: {
      en: 'Voicemail feels free. In practice it is the most expensive line on your P&L, because most callers never leave a message. Here is the real cost, and the fix.',
      fr: "Le répondeur semble gratuit. En réalité c'est la ligne la plus chère de votre compte de résultat, car la plupart des appelants ne laissent aucun message. Voici le vrai coût, et la solution.",
    },
    date: '2026-07-18',
    readTime: 6,
    tag: { en: 'Guide', fr: 'Guide' },
    content: {
      en: [
        { type: 'p', text: 'Voicemail is the default fallback for millions of small businesses. It is bundled with the phone line, it costs nothing extra, and it feels like a safety net. It is not. It is a leak, and it is the most expensive one on the P&L precisely because it is invisible.' },
        { type: 'h2', text: 'Most callers never leave a message' },
        { type: 'p', text: 'Across service industries, the share of callers who hang up rather than leave a voicemail sits between 70 and 80 percent. A prospect who needs a plumber, a dentist, or a lawyer does not want to record a monologue into a machine and wait. They hang up and dial the next result on Google. Your voicemail did not capture a lead; it announced that you were unavailable.' },
        { type: 'h2', text: 'The messages you do get are the wrong ones' },
        { type: 'p', text: 'The minority who do leave a message skew toward the least urgent and least valuable calls. High-intent buyers, the ones ready to book now, are exactly the ones who will not wait. So voicemail systematically filters out your best opportunities and keeps the low-value ones.' },
        { type: 'h2', text: 'What an AI receptionist does differently' },
        { type: 'ul', items: [
          'It answers on the first ring, 24/7, so no caller reaches a machine.',
          'It has a real conversation: it takes the reason for the call, qualifies it, and books the appointment on the spot.',
          'It transfers genuine emergencies to a human immediately, instead of leaving them in a mailbox.',
          'It texts a confirmation to the caller and emails a summary to the owner, so nothing is lost.',
        ] },
        { type: 'p', text: 'The difference is not incremental. A voicemail converts a fraction of callers into callbacks you then have to chase. An AI receptionist converts the same callers into booked appointments while the intent is still hot. For most SMBs, replacing voicemail with an AI receptionist pays for itself with the first two or three calls a month that would otherwise have hung up.' },
        { type: 'p', text: 'If you still route after-hours and busy-line calls to voicemail in 2026, you are not saving money. You are handing your best leads to whoever answers their phone.' },
      ],
      fr: [
        { type: 'p', text: "Le répondeur est le repli par défaut de millions de petites entreprises. Il est inclus avec la ligne, ne coûte rien de plus, et donne l'impression d'un filet de sécurité. Il n'en est pas un. C'est une fuite, et la plus chère du compte de résultat, précisément parce qu'elle est invisible." },
        { type: 'h2', text: 'La plupart des appelants ne laissent jamais de message' },
        { type: 'p', text: "Dans les métiers de service, la part des appelants qui raccrochent plutôt que de laisser un message vocal se situe entre 70 et 80 %. Un prospect qui cherche un plombier, un dentiste ou un avocat ne veut pas enregistrer un monologue dans une machine et attendre. Il raccroche et compose le résultat Google suivant. Votre répondeur n'a pas capté un lead : il a annoncé que vous étiez indisponible." },
        { type: 'h2', text: 'Les messages que vous recevez sont les mauvais' },
        { type: 'p', text: "La minorité qui laisse un message penche vers les appels les moins urgents et les moins rentables. Les acheteurs à forte intention, prêts à réserver tout de suite, sont justement ceux qui n'attendront pas. Le répondeur filtre donc systématiquement vos meilleures opportunités et ne garde que celles à faible valeur." },
        { type: 'h2', text: 'Ce qu\'une réceptionniste IA fait différemment' },
        { type: 'ul', items: [
          'Elle décroche à la première sonnerie, 24/7, aucun appelant ne tombe sur une machine.',
          "Elle tient une vraie conversation : elle prend le motif de l'appel, le qualifie et pose le rendez-vous sur-le-champ.",
          'Elle transfère les vraies urgences vers un humain immédiatement, au lieu de les laisser dans une boîte vocale.',
          "Elle envoie une confirmation par SMS à l'appelant et un résumé par email au patron, rien ne se perd.",
        ] },
        { type: 'p', text: "La différence n'est pas marginale. Un répondeur transforme une fraction des appelants en rappels que vous devez ensuite courir après. Une réceptionniste IA transforme les mêmes appelants en rendez-vous posés pendant que l'intention est encore chaude. Pour la plupart des PME, remplacer le répondeur par une réceptionniste IA s'autofinance avec les deux ou trois premiers appels par mois qui auraient sinon raccroché." },
        { type: 'p', text: "Si en 2026 vous routez encore vos appels hors horaires et ligne occupée vers un répondeur, vous n'économisez pas d'argent. Vous offrez vos meilleurs leads à celui qui décroche son téléphone." },
      ],
    },
  },
  {
    slug: 'rgpd-enregistrement-appels-belgique',
    title: {
      en: 'GDPR and call recording in Belgium: what the law actually requires',
      fr: "RGPD et enregistrement des appels en Belgique : ce que la loi exige vraiment",
    },
    excerpt: {
      en: 'Recording and transcribing business calls is legal in Belgium, but only under conditions. Consent, purpose, retention, and hosting all matter. A practical rundown.',
      fr: "Enregistrer et transcrire les appels professionnels est légal en Belgique, mais sous conditions. Consentement, finalité, conservation et hébergement comptent tous. Le point pratique.",
    },
    date: '2026-07-18',
    readTime: 7,
    tag: { en: 'Compliance', fr: 'Conformité' },
    content: {
      en: [
        { type: 'p', text: 'Any business that records or transcribes phone calls in Belgium falls under the GDPR (EU Regulation 2016/679), because a voice and its content are personal data. This does not make call recording illegal. It makes it conditional. Here is what those conditions are, in plain terms, and how an AI receptionist should be configured to meet them.' },
        { type: 'h2', text: 'You need a lawful basis, usually consent or legitimate interest' },
        { type: 'p', text: 'The two bases that fit call recording are consent and legitimate interest. In practice, the clean approach is to inform the caller at pickup that the call may be recorded and processed, and to give them a way to object. For an inbound AI receptionist, this is a short spoken notice at the start of the call. The notice is not optional decoration; it is what makes the processing lawful.' },
        { type: 'h2', text: 'Purpose limitation and data minimisation' },
        { type: 'p', text: 'You can only use the recording for the purpose you stated: handling the call, booking, follow-up. You cannot repurpose it for unrelated marketing without a fresh basis. And you should collect only what you need. A transcript kept to book an appointment is proportionate; keeping raw audio indefinitely for no reason is not.' },
        { type: 'h2', text: 'Retention: keep it only as long as needed' },
        { type: 'p', text: 'GDPR requires a defined retention period. Call recordings and transcripts should be deleted once their purpose is served, typically within weeks to a few months, unless a legal obligation requires longer. A system that keeps everything forever is a liability, not an asset.' },
        { type: 'h2', text: 'Hosting and transfers outside the EEA' },
        { type: 'p', text: 'Where the data lives matters. Transferring personal data outside the European Economic Area triggers additional obligations. It does not make the transfer unlawful: it makes it conditional on a transfer mechanism, in practice the European Commission\'s Standard Contractual Clauses, plus technical measures such as encryption in transit and at rest. What matters for a business owner is that these are documented, that the list of processors is public, and that the retention window is short.' },
        { type: 'h2', text: 'How Qwillio is set up' },
        { type: 'ul', items: [
          'A spoken consent notice at pickup, in the caller\'s language.',
          'A public list of processors, with Standard Contractual Clauses covering transfers outside the EEA.',
          'A defined retention window with automatic deletion.',
          'Access to a caller\'s data on request, and deletion on request.',
        ] },
        { type: 'p', text: 'None of this should scare a business owner off recording calls. It should push them toward doing it correctly. The transcript of a call is one of the most useful records a service business can have, provided it is collected on a lawful basis, transferred under a documented mechanism, and deleted when its purpose is served. This article is general information, not legal advice; for a specific situation, consult a qualified professional.' },
      ],
      fr: [
        { type: 'p', text: "Toute entreprise qui enregistre ou transcrit des appels téléphoniques en Belgique relève du RGPD (règlement UE 2016/679), car une voix et son contenu sont des données personnelles. Cela ne rend pas l'enregistrement illégal. Cela le rend conditionnel. Voici ces conditions, en termes clairs, et comment une réceptionniste IA doit être configurée pour les respecter." },
        { type: 'h2', text: 'Il faut une base légale, généralement le consentement ou l\'intérêt légitime' },
        { type: 'p', text: "Les deux bases adaptées à l'enregistrement d'appels sont le consentement et l'intérêt légitime. En pratique, l'approche propre consiste à informer l'appelant au décrochage que l'appel peut être enregistré et traité, et à lui donner un moyen de s'y opposer. Pour une réceptionniste IA en inbound, c'est une courte annonce vocale au début de l'appel. Cette annonce n'est pas une décoration optionnelle : c'est ce qui rend le traitement licite." },
        { type: 'h2', text: 'Limitation de la finalité et minimisation des données' },
        { type: 'p', text: "Vous ne pouvez utiliser l'enregistrement que pour la finalité annoncée : traiter l'appel, réserver, faire le suivi. Vous ne pouvez pas le réutiliser pour du marketing sans lien sans une nouvelle base. Et vous ne devez collecter que le nécessaire. Un transcript conservé pour poser un rendez-vous est proportionné ; garder l'audio brut indéfiniment sans raison ne l'est pas." },
        { type: 'h2', text: 'Conservation : seulement le temps nécessaire' },
        { type: 'p', text: "Le RGPD impose une durée de conservation définie. Les enregistrements et transcripts doivent être supprimés une fois leur finalité atteinte, généralement en quelques semaines à quelques mois, sauf obligation légale de conserver plus longtemps. Un système qui garde tout pour toujours est un risque, pas un atout." },
        { type: 'h2', text: 'Hébergement et transferts hors EEE' },
        { type: 'p', text: "L'endroit où vivent les données compte. Transférer des données personnelles hors de l'Espace économique européen déclenche des obligations supplémentaires. Cela ne rend pas le transfert illicite : cela le conditionne à un mécanisme de transfert, en pratique les Clauses Contractuelles Types de la Commission européenne, doublées de mesures techniques comme le chiffrement en transit et au repos. Ce qui compte pour un dirigeant, c'est que ces mécanismes soient documentés, que la liste des sous-traitants soit publique, et que la durée de conservation soit courte." },
        { type: 'h2', text: 'Comment Qwillio est configuré' },
        { type: 'ul', items: [
          "Une annonce de consentement au décrochage, dans la langue de l'appelant.",
          'Une liste publique des sous-traitants, et des Clauses Contractuelles Types pour les transferts hors EEE.',
          'Une durée de conservation définie avec suppression automatique.',
          "Accès aux données d'un appelant sur demande, et suppression sur demande.",
        ] },
        { type: 'p', text: "Rien de tout cela ne doit dissuader un patron d'enregistrer ses appels. Cela doit le pousser à le faire correctement. Le transcript d'un appel est l'un des enregistrements les plus utiles pour une entreprise de service, à condition d'être collecté sur une base légale, transféré sous un mécanisme documenté et supprimé quand sa finalité est atteinte. Cet article est une information générale, pas un conseil juridique ; pour une situation précise, consultez un professionnel qualifié." },
      ],
    },
  },
];

export function getArticleBySlug(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((a) => a.slug === slug);
}
