import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, Lead, H2, SerifWord } from '../../components/v2/Primitives';
import RevealV2 from '../../components/v2/RevealV2';
import CharacterCarousel from '../../components/v2/app/CharacterCarousel';
import type { Character } from '../../components/v2/app/CharacterPickerV2';
import VapiLiveCall from '../../components/client/VapiLiveCall';
import api from '../../services/api';

/* Page d'essai en direct.
 *
 * Elle remplace `public/demo.html`, une page autonome de 900 lignes qui vivait
 * HORS de l'application: son propre CSS, sa propre barre de langue, aucun
 * thème, et surtout sa propre idée du produit. Elle portait la clé Vapi en
 * clair dans son source, un identifiant de voix ElevenLabs écrit à la main et
 * un prompt construit dans le navigateur, si bien qu'elle démontrait un agent
 * moins bon que le vrai, à l'endroit exact où un prospect le juge.
 *
 * Ici tout vient du produit: le carrousel de personnages du tableau de bord
 * (avec son crayon pour renommer l'agent), les vrais aperçus ElevenLabs, et
 * une config d'appel bâtie par le serveur avec les mêmes fonctions de voix
 * qu'un appel réel. La page hérite du shell public, donc de la nav, du pied de
 * page, des tokens q2 et du thème clair comme sombre.
 */

/* Le choix du visiteur survit à un rechargement: il vient souvent tester deux
   fois, et lui refaire saisir son entreprise à chaque passage est un péage. */
const STORE = 'qw.demo';

interface DemoConfig {
  characterId: string;
  agentName: string;
  businessName: string;
  businessType: string;
  city: string;
}

const BUSINESS_TYPES: { value: string; fr: string; en: string }[] = [
  { value: '',              fr: 'Choisir un métier...', en: 'Pick a trade...' },
  { value: 'dental',        fr: 'Cabinet dentaire',     en: 'Dental practice' },
  { value: 'medical',       fr: 'Cabinet médical',      en: 'Medical practice' },
  { value: 'law',           fr: 'Cabinet d’avocats',    en: 'Law firm' },
  { value: 'salon',         fr: 'Salon de coiffure',    en: 'Hair salon' },
  { value: 'restaurant',    fr: 'Restaurant',           en: 'Restaurant' },
  { value: 'garage',        fr: 'Garage auto',          en: 'Auto garage' },
  { value: 'home_services', fr: 'Services à domicile',  en: 'Home services' },
  { value: 'veterinary',    fr: 'Cabinet vétérinaire',  en: 'Veterinary clinic' },
  { value: 'fitness',       fr: 'Salle de sport',       en: 'Gym' },
  { value: 'financial',     fr: 'Comptabilité',         en: 'Accounting' },
];

const inputCls =
  'w-full rounded-xl border border-q2-plate bg-q2-canvas px-4 py-2.5 text-[14px] text-q2-ink placeholder-q2-faint focus:outline-none focus:border-q2-indigo/50 transition-colors';

function readStored(): Partial<DemoConfig> {
  try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; }
}

export default function Demo() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadError, setLoadError] = useState(false);
  const stored = useMemo(readStored, []);

  const [characterId, setCharacterId] = useState(stored.characterId || 'marie');
  const [agentName, setAgentName] = useState(stored.agentName || '');
  const [businessName, setBusinessName] = useState(stored.businessName || '');
  const [businessType, setBusinessType] = useState(stored.businessType || '');
  const [city, setCity] = useState(stored.city || '');

  useEffect(() => {
    api.get('/public/characters')
      .then(({ data }) => setCharacters(Array.isArray(data) ? data : []))
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ characterId, agentName, businessName, businessType, city }));
    } catch { /* navigation privée: le formulaire marche quand même */ }
  }, [characterId, agentName, businessName, businessType, city]);

  const current = characters.find(c => c.id === characterId);
  /* Sans saisie, l'agent porte le prénom de son personnage: la page doit
     pouvoir être appelée sans rien remplir. */
  const spokenName = agentName.trim() || current?.name || '';

  /* La config est redemandée à chaque changement, donc elle est prête avant
     que le visiteur ne presse: c'est ce qui laisse `vapi.start()` partir dans
     le clic, et le micro n'être demandé qu'une fois. */
  const body = useMemo(
    () => ({ characterId, agentName: spokenName, businessName, businessType, city, lang: isFr ? 'fr' : 'en' }),
    [characterId, spokenName, businessName, businessType, city, isFr],
  );

  return (
    <PublicShell>
      <Section aria-labelledby="demo-heading" className="relative">
        <Container className="relative">
          <RevealV2>
            <div className="max-w-[720px]">
              <Eyebrow tone="indigo" className="mb-4 sm:mb-6">
                {isFr ? 'Essai en direct' : 'Live trial'}
              </Eyebrow>
              <Display className="mb-5 sm:mb-7" id="demo-heading">
                {isFr ? (
                  <>Appelez-la, <SerifWord>maintenant.</SerifWord></>
                ) : (
                  <>Call her, <SerifWord>right now.</SerifWord></>
                )}
              </Display>
              <Lead>
                {isFr
                  ? 'Choisissez une voix, donnez-lui un prénom et le nom de votre entreprise. Elle décroche dans votre navigateur, avec sa vraie voix. Aucun appel téléphonique, aucune inscription.'
                  : 'Pick a voice, give her a first name and your business name. She answers in your browser, with her real voice. No phone call, no signup.'}
              </Lead>
            </div>
          </RevealV2>
        </Container>
      </Section>

      <Section variant="band" hairline aria-labelledby="pick-heading">
        <Container>
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-start [&>*]:min-w-0">
            {/* ── Le personnage, et son prénom ── */}
            <RevealV2>
              <H2 id="pick-heading" className="mb-3">
                {isFr ? (
                  <>Qui <SerifWord>décroche ?</SerifWord></>
                ) : (
                  <>Who <SerifWord>answers?</SerifWord></>
                )}
              </H2>
              <p className="text-q2-body text-sm leading-relaxed mb-6 max-w-[420px] q2-body-text">
                {isFr
                  ? 'Dix personnages, chacun parle français et anglais. Écoutez-les, puis renommez celui que vous gardez avec le crayon.'
                  : 'Ten characters, each speaks French and English. Listen, then rename the one you keep with the pencil.'}
              </p>

              {characters.length > 0 ? (
                /* Le carrousel est un composant du registre PRODUIT: ses
                   pastilles et ses libellés sont bâtis sur les tokens
                   « drenched », qui restent sombres dans les deux thèmes. Posé
                   nu sur la bande crème, il donnait des ronds noirs au milieu
                   du clair. On lui rend donc sa surface, qui est un dispositif
                   assumé de la V2 et se comporte pareil en clair et en sombre. */
                <div className="rounded-2xl bg-q2-void p-4 sm:p-6">
                  <CharacterCarousel
                    characters={characters}
                    value={characterId}
                    onChange={setCharacterId}
                    isFr={isFr}
                    agentName={spokenName}
                    onAgentName={setAgentName}
                    /* Les clips publics, pas ceux du tableau de bord: la route
                       protégée répondait 401 et aucune voix ne sortait. */
                    previewUrlFor={id => `/public/characters/${id}/preview?lang=${isFr ? 'fr' : 'en'}`}
                    warmEndpoint={null}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-q2-plate bg-q2-canvas p-8 text-center">
                  <p className="text-[13px] text-q2-body">
                    {loadError
                      ? (isFr ? 'Les voix n’ont pas pu être chargées. Rechargez la page.' : 'The voices could not be loaded. Reload the page.')
                      : (isFr ? 'Chargement des voix…' : 'Loading voices…')}
                  </p>
                </div>
              )}
            </RevealV2>

            {/* ── Le contexte, puis l'appel ── */}
            <RevealV2 index={1}>
              <div className="rounded-2xl border border-q2-plate bg-q2-canvas p-6 sm:p-7">
                <p className="q2-eyebrow text-q2-faint mb-4">
                  {isFr ? 'Votre entreprise' : 'Your business'}
                </p>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="demo-biz" className="text-xs text-q2-body mb-1.5 block">
                      {isFr ? 'Nom de l’entreprise' : 'Business name'}
                    </label>
                    <input
                      id="demo-biz"
                      type="text"
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                      placeholder={isFr ? 'Plomberie Dupont' : 'Dupont Plumbing'}
                      className={inputCls}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="demo-type" className="text-xs text-q2-body mb-1.5 block">
                        {isFr ? 'Métier' : 'Trade'}
                      </label>
                      <select
                        id="demo-type"
                        value={businessType}
                        onChange={e => setBusinessType(e.target.value)}
                        className={inputCls}
                      >
                        {BUSINESS_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{isFr ? t.fr : t.en}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="demo-city" className="text-xs text-q2-body mb-1.5 block">
                        {isFr ? 'Ville' : 'City'}
                      </label>
                      <input
                        id="demo-city"
                        type="text"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder={isFr ? 'Bruxelles' : 'Brussels'}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-q2-plate">
                  <p className="q2-eyebrow text-q2-faint mb-3">
                    {isFr ? 'L’appel' : 'The call'}
                  </p>
                  {/* Le même composant que le tableau de bord. La config vient
                      du serveur en POST, redemandée à chaque changement
                      ci-dessus, donc prête avant la pression. */}
                  <VapiLiveCall
                    isFr={isFr}
                    endpoint="/public/demo/live-config"
                    body={body}
                    tone="site"
                  />
                  <p className="mt-3 text-[11.5px] text-q2-faint leading-relaxed">
                    {isFr
                      ? 'Elle utilise le micro de cet appareil. Rien n’est enregistré, l’essai s’arrête au bout de cinq minutes.'
                      : 'She uses this device’s microphone. Nothing is recorded, the trial stops after five minutes.'}
                  </p>
                </div>
              </div>
            </RevealV2>
          </div>
        </Container>
      </Section>
    </PublicShell>
  );
}
