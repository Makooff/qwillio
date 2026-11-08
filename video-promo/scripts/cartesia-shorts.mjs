// La série de vidéos courtes pour Instagram, TikTok et LinkedIn (src/shorts).
// Une vidéo = une idée, 15 à 25 secondes, dans le langage des deux pubs :
// Sarah raconte, la réceptionniste répond, l'appelant passe par un filtre
// téléphone. C'est le SEUL endroit qui dit ce que chaque vidéo raconte ; il
// écrit src/shorts/data.ts (textes + minutage réel de chaque mot).
//
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node scripts/cartesia-shorts.mjs
//   ONLY=s03,s07 ne refait que ces vidéos ; ONLY=none n'appelle pas l'API.
//
// Chaque phrase de réceptionniste décrit ce que le produit fait vraiment
// (voir CLAUDE.md) : reconnaître au numéro, prendre / déplacer / annuler,
// fr / en / nl, transférer une urgence, noter un message (pour qui, quand
// rappeler), ne pas inventer et apprendre la réponse, SMS de confirmation.
import fs from 'fs';
import { execFileSync } from 'child_process';
import { speak } from './cartesia-lib.mjs';

const SARAH = '90358bc7-3328-4b93-a942-d0447d7d4b5c'; // narration ET réceptionniste
const GEMMA = '62ae83ad-4f6a-430b-af41-a9bede9286ca'; // anglais britannique
const ISA = '60e94cf5-8069-459f-a91e-3ff852a51107'; // néerlandais
// Les appelants : des voix françaises plus « de tous les jours », filtrées téléphone.
const MARC = 'ce74c4da-4aee-435d-bc6d-81d1a9367e12';
const LEONIE = '63fdecc2-4e1d-4aa3-a442-27204e3cd3b5';

const NB = ' '; // espace insécable : « ? » et « : » restent collés à leur mot
const agent = (say, emotion = 'content', extra = {}) => ({ who: 'agent', say, emotion, ...extra });
const caller = (voice, say, emotion = 'content') => ({ who: 'caller', voice, say, emotion });

export const SHORTS = [
  {
    id: 's01', slug: 'appel-manque', music: 20,
    scenes: [
      { visual: { kind: 'ring', name: 'Julie Martin', initials: 'JM', time: '20:12', footage: 'dough', missed: true },
        say: { text: 'Un appel manqué, c’est un client qui réserve ailleurs.', emotion: 'serious', serif: [8] } },
      { visual: { kind: 'orb' }, say: { text: 'Avec Qwillio, quelqu’un décroche. Toujours.', emotion: 'confident', serif: [4] },
        lines: [caller(LEONIE, `Bonsoir, vous auriez une table pour quatre ce soir${NB}?`), agent(`Bonsoir${NB}! Oui, à vingt heures trente. C’est à quel nom${NB}?`, 'happy')] },
      { visual: { kind: 'notif', title: 'Nouvelle réservation', desc: 'Julie Martin · 4 personnes · ce soir 20:30' },
        say: { text: 'Et la réservation arrive toute seule.', emotion: 'happy', serif: [5] } },
    ],
  },
  {
    id: 's02', slug: 'trois-heures', music: 45,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Il est trois heures du matin.', emotion: 'calm', serif: [5] } },
      { visual: { kind: 'ring', name: 'Numéro inconnu', initials: '?', time: '03:12' },
        say: { text: 'Votre cabinet est fermé. Le téléphone sonne.', emotion: 'calm', serif: [6] } },
      { visual: { kind: 'orb' },
        lines: [caller(MARC, 'Bonjour, je voudrais un rendez-vous pour un détartrage.'), agent(`Bien sûr. Je vous propose mardi à neuf heures, ça vous va${NB}?`, 'happy'), caller(MARC, 'Parfait, merci.')] },
      { visual: { kind: 'notif', title: 'Nouveau rendez-vous', desc: 'Détartrage · mardi 09:00' },
        say: { text: 'Vous dormez. Elle, non.', emotion: 'affectionate', serif: [3] } },
    ],
  },
  {
    id: 's03', slug: 'trois-langues', music: 70,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'À Bruxelles, vos clients ne parlent pas tous la même langue.', emotion: 'curious', serif: [10] } },
      { visual: { kind: 'langs' },
        lines: [agent('Bonjour, cabinet Delvaux, je vous écoute.', 'content', { tag: 'FR' }),
          agent('Hello, Delvaux practice, how can I help?', 'content', { voice: GEMMA, lang: 'en', tag: 'EN' }),
          agent('Goedendag, praktijk Delvaux, waarmee kan ik helpen?', 'content', { voice: ISA, lang: 'nl', tag: 'NL' })] },
      { visual: { kind: 'langs' }, say: { text: 'Elle répond dans la leur. Avec le bon accent.', emotion: 'happy', serif: [8] } },
    ],
  },
  {
    id: 's04', slug: 'reconnait', music: 95,
    scenes: [
      { visual: { kind: 'ring', name: 'Thomas Leroy', initials: 'TL', time: '10:24', footage: 'knead' },
        say: { text: `Et si votre téléphone savait qui appelle${NB}?`, emotion: 'curious', serif: [4] } },
      { visual: { kind: 'orb', chip: { name: 'Thomas Leroy', initials: 'TL', sub: 'Client connu · rendez-vous jeudi 10:00', badge: 'reconnu' } },
        lines: [agent(`Bonjour Monsieur Leroy${NB}! C’est pour votre rendez-vous de jeudi${NB}?`, 'happy'),
          caller(MARC, `Oui, je peux le décaler à vendredi${NB}?`),
          agent('C’est fait, vendredi même heure. Je vous envoie un SMS de confirmation.', 'content')] },
      { visual: { kind: 'notif', title: 'Rendez-vous déplacé', desc: 'Thomas Leroy · vendredi 10:00' },
        say: { text: 'Elle se souvient de vos clients. Comme vous.', emotion: 'affectionate', serif: [7] } },
    ],
  },
  {
    id: 's05', slug: 'urgence', music: 120,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Certains appels ne peuvent pas attendre.', emotion: 'serious', serif: [5] } },
      { visual: { kind: 'orb' },
        lines: [caller(LEONIE, `Bonjour, j’ai une fuite d’eau, c’est vraiment urgent${NB}!`, 'anxious'),
          agent('Je vous passe le responsable tout de suite, ne quittez pas.', 'serious')] },
      { visual: { kind: 'ring', name: 'Qwillio · urgence', initials: 'Q', sub: 'Mme Dubois · fuite d’eau', time: '21:05' },
        say: { text: 'Les urgences, elle vous les passe. Le reste, elle le gère.', emotion: 'confident', serif: [10] } },
    ],
  },
  {
    id: 's06', slug: 'invente-rien', music: 150,
    scenes: [
      { visual: { kind: 'type' }, say: { text: `La pire réceptionniste${NB}? Celle qui invente.`, emotion: 'serious', serif: [5] } },
      { visual: { kind: 'orb' },
        lines: [caller(MARC, `Vous acceptez les chèques-repas${NB}?`),
          agent('Je préfère ne pas vous dire de bêtise. Je pose la question, et on vous rappelle.', 'calm')] },
      { visual: { kind: 'learn', question: `Vous acceptez les chèques-repas${NB}?`, answer: 'Oui, tous les chèques-repas.' },
        say: { text: 'Vous répondez une fois. Elle le saura toujours.', emotion: 'confident', serif: [7] } },
    ],
  },
  {
    id: 's07', slug: 'message', music: 175,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Vous êtes avec un client. Le téléphone sonne.', emotion: 'calm', serif: [7] } },
      { visual: { kind: 'orb' },
        lines: [caller(LEONIE, `C’est pour Marc. Il peut me rappeler après dix-sept heures${NB}?`),
          agent('C’est noté pour Marc, après dix-sept heures. Je lui transmets.', 'content')] },
      { visual: { kind: 'message' }, say: { text: 'Le message arrive. Pour qui, et quand rappeler.', emotion: 'content', serif: [7] } },
    ],
  },
  {
    id: 's08', slug: 'annuler', music: 200,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Un rendez-vous annulé ne devrait pas vous coûter un appel.', emotion: 'confident', serif: [9] } },
      { visual: { kind: 'orb' },
        lines: [caller(MARC, 'Bonjour, je dois annuler mon rendez-vous de jeudi.'),
          agent(`C’est fait, votre rendez-vous de jeudi est annulé. Bonne journée${NB}!`, 'content')] },
      { visual: { kind: 'mac' }, say: { text: 'Elle prend, déplace et annule. Votre agenda suit.', emotion: 'happy', serif: [7] } },
    ],
  },
  {
    id: 's09', slug: 'coiffeur', music: 225,
    scenes: [
      { visual: { kind: 'ring', name: 'Sophie Lambert', initials: 'SL', time: '11:05' },
        say: { text: 'Les mains dans les cheveux, impossible de décrocher.', emotion: 'curious', serif: [7] } },
      { visual: { kind: 'orb' },
        lines: [caller(LEONIE, `Bonjour, une coupe samedi matin, c’est possible${NB}?`),
          agent(`Samedi à dix heures, c’est libre. C’est à quel nom${NB}?`, 'happy'),
          caller(LEONIE, 'Sophie Lambert.'),
          agent(`C’est réservé, Sophie. À samedi${NB}!`, 'happy')] },
      { visual: { kind: 'notif', title: 'Nouveau rendez-vous', desc: 'Sophie Lambert · coupe · samedi 10:00' },
        say: { text: 'Elle réserve pendant que vous coupez.', emotion: 'happy', serif: [5] } },
    ],
  },
  {
    id: 's10', slug: 'avant-apres', music: 250,
    scenes: [
      { visual: { kind: 'type', tag: 'AVANT' }, say: { text: 'Une messagerie pleine.', emotion: 'serious', serif: [2] } },
      { visual: { kind: 'ring', name: 'Numéro inconnu', initials: '?', time: '12:40', missed: true },
        say: { text: 'Des clients qui ne rappellent jamais.', emotion: 'serious', serif: [5] } },
      { visual: { kind: 'type', tag: 'APRÈS' }, say: { text: 'Chaque appel décroché.', emotion: 'confident', serif: [2] } },
      { visual: { kind: 'mac' }, say: { text: 'Et chaque rendez-vous dans l’agenda.', emotion: 'happy', serif: [4] } },
    ],
  },
  {
    id: 's11', slug: 'essayez', music: 275,
    scenes: [
      { visual: { kind: 'type' }, say: { text: 'Ne nous croyez pas sur parole.', emotion: 'confident', serif: [5] } },
      { visual: { kind: 'orb' },
        lines: [agent(`Bonjour${NB}! Je suis la réceptionniste de Qwillio. Posez-moi une question, je vous écoute.`, 'happy')] },
      { visual: { kind: 'orb' }, say: { text: 'Appelez-la vous-même. Elle vous attend.', emotion: 'affectionate', serif: [4] } },
    ],
  },
];

const END = { text: 'Qwillio. Elle décroche quand vous ne pouvez pas.', show: 'Elle décroche quand vous ne pouvez pas.', emotion: 'affectionate', serif: [4, 5, 6] };

/* ------------------------------------------------------------------ la fabrication */

const DIR = 'public/voices/shorts';
fs.mkdirSync(DIR, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const PREV = 'src/shorts/data.ts';
const prev = fs.existsSync(PREV) ? JSON.parse(fs.readFileSync(PREV, 'utf8').replace(/^[\s\S]*?const data = /, '').replace(/;\nexport default[\s\S]*$/, '')) : null;

/** La ligne téléphonique : bande étroite, compressée, rééchantillonnée à 8 kHz. */
function phoneLine(file) {
  const tel = file.replace(/\.mp3$/, '-tel.mp3');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-af', 'highpass=f=320,lowpass=f=3300,acompressor=threshold=-18dB:ratio=4:attack=5:release=60,aresample=8000,aresample=44100,volume=1.5', tel]);
  return tel;
}

/** Les mots affichés, calés sur les mots dits (`show` peut en omettre au début). */
function shown(text, words) {
  const ws = text.split(' ');
  const lead = words.slice(Math.max(0, words.length - ws.length));
  return ws.map((w, i) => ({ w, start: +(lead.length === ws.length ? lead[i] : lead[Math.min(lead.length - 1, Math.floor((i / ws.length) * lead.length))]).start.toFixed(3) }));
}

async function narr(name, l) {
  const s = await speak(SARAH, l.text, l.emotion, `${DIR}/${name}`);
  return { file: `voices/shorts/${name}.mp3`, duration: +s.duration.toFixed(3), serif: l.serif ?? [], words: shown(l.show ?? l.text, s.words) };
}

const out = { end: prev?.end ?? null, shorts: {} };
if (!out.end || (ONLY && ONLY.includes('end'))) out.end = await narr('end', END);
for (const sh of SHORTS) {
  if ((ONLY && !ONLY.includes(sh.id)) && prev?.shorts?.[sh.id]) { out.shorts[sh.id] = prev.shorts[sh.id]; continue; }
  if (ONLY && ONLY.includes('none')) continue;
  const scenes = [];
  for (const [i, sc] of sh.scenes.entries()) {
    const s = { visual: sc.visual };
    if (sc.say) s.say = await narr(`${sh.id}-n${i}`, sc.say);
    if (sc.lines) {
      s.lines = [];
      for (const [j, l] of sc.lines.entries()) {
        const base = `${DIR}/${sh.id}-${i}-${j}`;
        const r = await speak(l.voice ?? SARAH, l.say, l.emotion, base, l.lang ?? 'fr');
        const file = l.who === 'caller' ? phoneLine(`${base}.mp3`) : `${base}.mp3`;
        s.lines.push({ who: l.who, tag: l.tag, file: file.replace(/^public\//, ''), duration: +r.duration.toFixed(3), words: r.words.map((w) => ({ w: w.w, start: +w.start.toFixed(3) })) });
      }
    }
    scenes.push(s);
  }
  out.shorts[sh.id] = { slug: sh.slug, music: sh.music, scenes };
  console.log(sh.id, sh.slug, 'ok');
}
fs.mkdirSync('src/shorts', { recursive: true });
fs.writeFileSync(PREV, `// Généré par scripts/cartesia-shorts.mjs, ne pas éditer.\nconst data = ${JSON.stringify(out, null, 1)};\nexport default data as unknown as import('./types').ShortsData;\n`);
