// Les plans filmés et les sons de la pub, téléchargés depuis Mixkit.
// Licences vérifiées sur chaque page le 07/11/2026 :
//  - vidéos : « Mixkit Stock Video Free License » (usage commercial, modification,
//    sans attribution). Les plans marqués « Restricted License » ont été écartés.
//  - sons : « Mixkit Sound Effects Free License ».
// Ce ne sont ni des clients ni des témoignages : des images d'illustration.
// Lancer avec : NODE_USE_ENV_PROXY=1 node scripts/fetch-media.mjs
import fs from 'fs';

export const VIDEOS = {
  grill: 4678, // chef-cooking-on-a-large-grill (comptoir de grill bondé)
  serve: 4672, // waiter-serving-meat-stew-in-a-restaurant
  julie: 39790, // worried-and-sad-woman-during-a-phone-call
  hangup: 39815, // young-woman-ending-a-call (vertical)
  room: 4385, // customers-in-a-minimalist-style-restaurant
  friends: 43248, // friends-sharing-time-together-in-the-cafeteria
  // La v3 : un seul tournage, la même cuisine de pizzeria plan après plan
  // (42464-42487, même plan de travail, même four, même tablier).
  dough: 42469, // chef-shaping-a-pizza
  sauce: 42474, // smearing-sauce-on-the-pizza
  oven: 42480, // chef-puts-the-pizza-in-the-oven
  ovenhot: 42481, // hot-oven-baking-pizzas
  sliced: 42487, // pizza-while-someone-takes-a-slice
  table: 44007, // man-and-woman-taking-a-slice-of-pizza
  knead: 42467, // hands-of-a-baker-kneading-a-dough
  cheese: 42475, // spreading-cheese-on-a-pizza
  pepperoni: 42477, // putting-pepperoni-on-a-pizza
};
// La musique de la v3 : « Driving Ambition », Mixkit, sous la « Mixkit Music Free License ».
export const MUSIC = { music: 32 };
export const SOUNDS = {
  ambience: 478, // Restaurant crowd talking ambience
  sizzle: 2826, // Frying fish on a hot pan
  ringtone: 1350, // Marimba ringtone
  ringback: 1357, // Waiting ringtone
  clink: 2933, // Glasses clinking
  pop: 2358, // Message pop alert
  confirm: 937, // Confirmation tone
};

fs.mkdirSync('public/media', { recursive: true });
const get = async (url, out) => {
  if (fs.existsSync(out)) return;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log('ok', out);
};
for (const [k, id] of Object.entries(VIDEOS)) await get(`https://assets.mixkit.co/videos/${id}/${id}-720.mp4`, `public/media/${k}.mp4`);
for (const [k, id] of Object.entries(MUSIC)) await get(`https://assets.mixkit.co/music/${id}/${id}.mp3`, `public/media/${k}.mp3`);
for (const [k, id] of Object.entries(SOUNDS)) await get(`https://assets.mixkit.co/active_storage/sfx/${id}/${id}-preview.mp3`, `public/media/${k}.mp3`);
