import type { ReactNode } from 'react';
import { ArrowRight, CalendarCheck, Check, ClipboardList, Headphones, MessageSquare, Mic2, PhoneForwarded, ShieldCheck, Users, Webhook } from '../icons';
import QwillioLogo from '../QwillioLogo';
import { Container, Section, H2 } from './Primitives';
import { PillLink } from './Button';
import RevealV2 from './RevealV2';
import TryVoiceButton from './TryVoiceButton';
import './marketing-sections.css';

type Props = { isFr: boolean };
type Scene = 'shield' | 'calendar' | 'languages' | 'sms' | 'transfer' | 'summary' | 'knowledge' | 'business' | 'setup' | 'crm' | 'workflow';

/** Original illustrative fragments, not screenshots or real customer activity. */
function ImageStage({ scene, label, children }: { scene?: Scene; label: string; children: ReactNode }) {
  const photo = scene === 'languages' ? 'scene-salon-blur.webp' : scene === 'setup' ? 'scene-business-blur.webp' : scene === 'sms' ? 'scene-service-blur.webp' : scene === 'transfer' ? 'scene-restaurant-blur.webp' : `unique-${scene ?? 'calendar'}-blur.webp`;
  return <div className={`qms-media qms-media--${scene ?? 'photo'}`} role="img" aria-label={label}>
    <img className="qms-media-bg" src={`/marketing/${photo}`} alt="" loading="lazy" decoding="async" width={1100} height={800} />
    <div className="qms-media-art" aria-hidden="true">{children}</div>
  </div>;
}
function Paper({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`qms-paper ${className}`}>{children}</div>;
}
function Visual({ scene, isFr }: { scene: Scene; isFr: boolean }) {
  const fr = isFr;
  if (scene === 'shield') return <ImageStage scene={scene} label={fr ? 'Illustration : filtrage des appels indésirables' : 'Illustration: filtering unwanted calls'}>
    <Paper><span className="qms-label"><ShieldCheck size={19} />{fr ? 'Filtre anti-spam' : 'Spam filter'}</span><strong className="qms-scene-title">{fr ? 'Les vrais appels passent.' : 'Real calls get through.'}</strong><p>{fr ? 'Les appels identifiés comme spam sont filtrés sans entamer votre quota.' : 'Calls identified as spam are filtered without using your allowance.'}</p><span className="qms-state"><Check size={15} />{fr ? 'Votre accueil reste disponible' : 'Your reception stays available'}</span></Paper>
  </ImageStage>;
  if (scene === 'calendar') return <ImageStage scene={scene} label={fr ? 'Illustration : un créneau choisi dans un agenda connecté' : 'Illustration: choosing a slot in a connected calendar'}>
    <Paper><span className="qms-label"><CalendarCheck size={19} />{fr ? 'Votre agenda' : 'Your calendar'}</span><strong className="qms-scene-title">{fr ? 'Ce soir' : 'Tonight'}</strong><div className="qms-slots">{['18:30', '19:00', '19:30', '20:00', '20:30', '21:00'].map((s, i) => <span className={i === 2 ? 'is-selected' : ''} key={s}>{s}</span>)}</div><small>{fr ? 'Google ou Outlook connecté' : 'Google or Outlook connected'}</small></Paper>
  </ImageStage>;
  if (scene === 'languages') return <ImageStage scene={scene} label={fr ? 'Illustration : une conversation en français ou en anglais' : 'Illustration: a conversation in French or English'}>
    <div className="qms-speech-stack"><Paper><span className="qms-label"><Mic2 size={19} />Français</span><p>« Bonjour, je vous écoute. »</p></Paper><Paper className="qms-speech-reply"><span className="qms-label">English</span><p>“Hello, how can I help you?”</p></Paper></div>
  </ImageStage>;
  if (scene === 'sms') return <ImageStage scene={scene} label={fr ? 'Illustration : confirmation de rendez-vous par SMS' : 'Illustration: appointment confirmation by text'}>
    <Paper className="qms-notification"><span className="qms-label"><MessageSquare size={19} />SMS</span><strong className="qms-scene-title">{fr ? 'Rendez-vous confirmé' : 'Appointment confirmed'}</strong><p>{fr ? 'Le jour, l’heure et l’adresse. Directement sur son téléphone.' : 'The date, time and address. Straight to their phone.'}</p><span className="qms-state"><Check size={15} />{fr ? 'Après réservation' : 'After booking'}</span></Paper>
  </ImageStage>;
  if (scene === 'transfer') return <ImageStage scene={scene} label={fr ? 'Illustration : transfert avec un brief à votre équipe' : 'Illustration: a call handed to your team with context'}>
    <div className="qms-handoff"><div className="qms-handoff-top"><span><Headphones size={21} />Qwillio</span><ArrowRight size={22} /><span><Users size={21} />{fr ? 'Votre équipe' : 'Your team'}</span></div><Paper><span className="qms-label"><PhoneForwarded size={19} />{fr ? 'Le contexte, avant l’appel' : 'Context before the call'}</span><strong className="qms-scene-title">{fr ? 'Un événement privé' : 'A private event'}</strong><p>{fr ? 'La demande, les coordonnées, la raison du transfert.' : 'The request, the contact details, the reason for the handoff.'}</p></Paper></div>
  </ImageStage>;
  if (scene === 'summary') return <ImageStage scene={scene} label={fr ? 'Illustration : résumé exploitable après un appel' : 'Illustration: an actionable note after a call'}>
    <Paper><span className="qms-label"><ClipboardList size={19} />{fr ? 'Après l’appel' : 'After the call'}</span><strong className="qms-scene-title">{fr ? 'L’essentiel, au même endroit.' : 'Everything you need, together.'}</strong><div className="qms-note-rows">{(fr ? ['Demande et coordonnées', 'Résumé et transcription', 'Prochaine action à suivre'] : ['Request and contact details', 'Summary and transcript', 'Next action to follow up']).map(s => <span key={s}><Check size={15} />{s}</span>)}</div></Paper>
  </ImageStage>;
  if (scene === 'business') return <ImageStage scene={scene} label={fr ? 'Illustration : les informations de votre établissement' : 'Illustration: your business information'}>
    <Paper><span className="qms-label">{fr ? 'Votre établissement' : 'Your business'}</span><div className="qms-form-row"><small>{fr ? 'Nom et adresse' : 'Name and address'}</small><span>{fr ? 'Vos informations' : 'Your details'}</span></div><div className="qms-form-row"><small>{fr ? 'Horaires et services' : 'Hours and services'}</small><span>{fr ? 'Vos règles d’accueil' : 'Your reception rules'}</span></div></Paper>
  </ImageStage>;
  if (scene === 'setup') return <ImageStage scene={scene} label={fr ? 'Illustration : voix et consignes de votre assistant' : 'Illustration: voice and instructions for your assistant'}>
    <Paper><span className="qms-label"><Mic2 size={19} />{fr ? 'Votre assistant' : 'Your assistant'}</span><strong className="qms-scene-title">{fr ? 'À votre façon.' : 'Your way.'}</strong><div className="qms-note-rows">{(fr ? ['La voix qui vous correspond', 'Vos réponses habituelles', 'Vos consignes de transfert'] : ['The right voice for you', 'Your usual answers', 'Your handoff instructions']).map(s => <span key={s}><Check size={15} />{s}</span>)}</div></Paper>
  </ImageStage>;
  if (scene === 'crm') return <ImageStage scene={scene} label={fr ? 'Illustration : votre CRM relié par webhook' : 'Illustration: your CRM connected over a webhook'}>
    <Paper><span className="qms-label"><Webhook size={19} />Webhook</span><strong className="qms-scene-title">{fr ? 'Du téléphone à vos outils.' : 'From the phone to your tools.'}</strong><p>{fr ? 'Zapier, Make, n8n via webhook' : 'Zapier, Make, n8n over webhook'}</p><span className="qms-state">{fr ? 'À configurer avec vos outils' : 'Configure with your tools'}</span></Paper>
  </ImageStage>;
  return <ImageStage scene="knowledge" label={fr ? 'Illustration : les réponses propres à votre entreprise' : 'Illustration: answers tailored to your business'}><Paper><span className="qms-label"><MessageSquare size={19} />{fr ? 'Vos réponses' : 'Your answers'}</span><strong className="qms-scene-title">{fr ? '« Êtes-vous ouverts samedi ? »' : '“Are you open on Saturday?”'}</strong><p>{fr ? 'Elle s’appuie sur les horaires et les consignes que vous lui donnez.' : 'She uses the opening hours and instructions you provide.'}</p></Paper></ImageStage>;
}

export function BenefitsGrid({ isFr }: Props) {
  const items: { scene: Scene; title: string; body: string }[] = isFr ? [
    { scene: 'shield', title: 'Votre quota est réservé aux vrais appels', body: 'Les appels indésirables sont filtrés. Vous ne dépensez pas vos minutes à écouter du spam.' },
    { scene: 'languages', title: 'Une conversation, pas un menu vocal', body: 'Elle écoute, répond et laisse la place à votre interlocuteur. Français ou anglais, selon votre offre.' },
    { scene: 'sms', title: 'La confirmation part toute seule', body: 'SMS activés et numéro de mobile renseigné : la confirmation part après la réservation. Vous n’avez pas à la rédiger.' },
    { scene: 'transfer', title: 'La bonne personne, au bon moment', body: 'Quand il faut passer la main, votre équipe reçoit le contexte avant de reprendre la conversation.' },
    { scene: 'summary', title: 'Chaque appel laisse une trace utile', body: 'Résumé, transcription, coordonnées et suite à donner : retrouvez ce qui compte, même sur mobile.' },
    { scene: 'knowledge', title: 'Elle connaît votre façon de travailler', body: 'Horaires, services, questions fréquentes et règles d’accueil : elle répond avec vos informations, pas des généralités.' },
  ] : [
    { scene: 'shield', title: 'Your allowance is for real calls', body: 'Unwanted calls are filtered. Your minutes are not spent listening to spam.' },
    { scene: 'languages', title: 'A conversation, not a phone menu', body: 'She listens, responds and makes room for the caller. French or English, depending on your plan.' },
    { scene: 'sms', title: 'The confirmation sends itself', body: 'With text messaging enabled and a mobile number provided, the confirmation sends after booking. No message to write yourself.' },
    { scene: 'transfer', title: 'The right person at the right moment', body: 'When a person needs to take over, your team gets the context before joining the conversation.' },
    { scene: 'summary', title: 'Every call leaves a useful record', body: 'Summary, transcript, contact details and next steps: find what matters, even on your phone.' },
    { scene: 'knowledge', title: 'She knows how your business works', body: 'Hours, services, FAQs and reception rules: answers based on your information, not generalities.' },
  ];
  const feature = (index: number) => <div data-benefit key={items[index].scene}><h3>{items[index].title}</h3><p>{items[index].body}</p></div>;
  return <Section aria-labelledby="benefits-heading" className="qms qms-benefits">
    <Container>
      <div className="qms-benefits-intro"><div><H2 id="benefits-heading">{isFr ? 'Puissante là où ça compte.' : 'Powerful where it matters.'}</H2><p>{isFr ? 'Les appels sont pris. Le travail avance aussi. Voilà ce que Qwillio prend réellement en charge.' : 'Calls get answered. Work moves forward too. Here is what Qwillio actually takes care of.'}</p></div><PillLink to="/register" variant="primary">{isFr ? 'Essayer Qwillio' : 'Try Qwillio'}<ArrowRight size={16} /></PillLink></div>
      <div className="qms-benefit-stories">
        <article className="qms-benefit-mobile" data-benefit-story>
          <div className="qms-phone-stage" role="img" aria-label={isFr ? 'Mockup de téléphone : fiche d’appel Qwillio, données de démonstration' : 'Phone mockup: Qwillio call record, demonstration data'}>
            <div className="qms-device-phone" aria-hidden="true"><div className="qms-phone-screen"><img src="/screens/fiche-appel-phone.webp" alt="" loading="lazy" decoding="async" width={780} height={1691} /><span className="qms-phone-island" /></div><span className="qms-phone-button" /></div>
            <span className="qms-device-caption">{isFr ? 'Votre suivi, dans votre poche.' : 'Your follow-up, in your pocket.'}</span>
          </div>
          <div className="qms-story-copy">{feature(4)}{feature(2)}</div>
        </article>
        <article className="qms-benefit-life" data-benefit-story>
          <figure><img src="/marketing/owner-phone.webp" alt={isFr ? 'Une personne consulte son téléphone, mise en situation illustrative' : 'A person checking their phone, an illustrative use scene'} loading="lazy" decoding="async" width={1200} height={1800} /></figure>
          <div className="qms-story-copy">{feature(1)}{feature(3)}</div>
        </article>
        <article className="qms-benefit-desktop" data-benefit-story>
          <div className="qms-story-copy">{feature(5)}{feature(0)}</div>
          <figure className="qms-mac-stage">
            <div className="qms-device-mac" data-figma-node="1:2"><img src="/marketing/macbook-figma-safari.webp" alt={isFr ? 'MacBook Pro : le portail Qwillio et sa base de connaissances dans Safari maximisé, données de démonstration' : 'MacBook Pro: Qwillio and its knowledge base in maximized Safari, demonstration data'} loading="lazy" decoding="async" width={2400} height={1600} /></div>
            <figcaption className="qms-mockup-credit">{isFr ? 'Mockup adapté de ' : 'Mockup adapted from '}<a href="https://www.figma.com/community/file/1176558805861554548/macbook-pro-mockups" target="_blank" rel="noopener noreferrer">Mr.Mockup</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></figcaption>
          </figure>
        </article>
      </div>
      <p className="qms-illustrative-note">{isFr ? 'Écrans du portail Qwillio avec données de démonstration. La photographie illustre un usage, pas un client Qwillio.' : 'Qwillio portal screens with demonstration data. The photograph illustrates a use case, not a Qwillio customer.'}</p>
    </Container>
  </Section>;
}

export function LaunchSteps({ isFr }: Props) {
  const steps = isFr ? [
    ['Présentez votre établissement', 'Vos horaires, vos services, les questions que l’on vous pose. Le point de départ, c’est votre quotidien.'],
    ['Donnez-lui votre façon d’accueillir', 'Choisissez une voix et précisez vos réponses, votre agenda et les situations à transférer à votre équipe.'],
    ['Essayez avant de lui confier la ligne', 'Passez un appel test, vérifiez ses réponses et ajustez vos consignes. Vous décidez quand activer le renvoi.'],
  ] : [
    ['Introduce your business', 'Your hours, services and common questions. Your everyday work is the starting point.'],
    ['Make the welcome your own', 'Choose a voice and set the answers, calendar and situations that need your team.'],
    ['Try it before handing over the line', 'Make a test call, check the answers and adjust your instructions. You decide when to forward calls.'],
  ];
  return <Section aria-labelledby="launch-heading" className="qms qms-launch" hairline>
    <Container><div className="qms-section-intro"><H2 id="launch-heading">{isFr ? 'De vos consignes au premier appel.' : 'From your instructions to the first call.'}</H2><p>{isFr ? 'Trois étapes concrètes. Et la possibilité d’essayer avant de changer vos habitudes.' : 'Three practical steps. And a chance to try before changing your routine.'}</p></div>
      <ol className="qms-launch-grid">{steps.map(([title, body], i) => <li key={title} data-launch-step><RevealV2 index={i}>
        {i < 2 ? <Visual scene={i === 0 ? 'business' : 'setup'} isFr={isFr} /> : <div className="qms-media qms-media--test" role="group" aria-label={isFr ? 'Essayer la démo vocale' : 'Try the voice demo'}>
          <img className="qms-media-bg" src="/marketing/unique-test-blur.webp" alt="" loading="lazy" decoding="async" width={1100} height={800} />
          <div className="qms-media-art"><Paper className="qms-call-preview"><div className="qms-call-header"><span className="qms-call-avatar"><Headphones size={23} aria-hidden="true" /></span><div><span className="qms-label">Qwillio</span><strong>{isFr ? 'Parlez-lui pour de vrai.' : 'Have a real conversation.'}</strong></div></div><div className="qms-call-wave" aria-hidden="true">{[8, 15, 24, 13, 30, 20, 34, 16, 26, 12, 21, 8].map((height, j) => <i key={j} style={{ height }} />)}</div><TryVoiceButton variant="primary">{isFr ? 'Tester un appel' : 'Try a call'}</TryVoiceButton><small>{isFr ? 'Démo dans votre navigateur · Micro requis' : 'Browser demo · Microphone required'}</small></Paper></div>
        </div>}
        <div className="qms-step-heading"><span>{i + 1}</span><h3>{title}</h3></div><p>{body}</p>
      </RevealV2></li>)}</ol>
    </Container>
  </Section>;
}

export function EcosystemMosaic({ isFr }: Props) {
  return <Section aria-labelledby="ecosystem-heading" className="qms qms-ecosystem" hairline>
    <Container><div className="qms-ecosystem-intro"><H2 id="ecosystem-heading">{isFr ? 'Vos outils. Le même accueil.' : 'Your tools. One connected welcome.'}</H2><p>{isFr ? 'Connectez les outils que vous utilisez déjà. L’agenda sert de référence ; les autres échanges passent par vos intégrations et vos webhooks.' : 'Connect the tools you already use. Your calendar is the source of truth; other exchanges use your integrations and webhooks.'}</p></div>
      <div className="qms-ecosystem-grid">
        <div className="qms-ecosystem-photo"><img src="/marketing/restaurant.webp" alt={isFr ? 'Intérieur de restaurant, illustration métier' : 'Restaurant interior, an illustrative business context'} loading="lazy" width={1100} height={800} /><div><QwillioLogo size={46} /><h3>{isFr ? 'Vous accueillez sur place. Elle garde la ligne.' : 'You welcome people in. She keeps the line covered.'}</h3><span>{isFr ? 'Illustration métier' : 'Illustrative business context'}</span></div></div>
        <div className="qms-ecosystem-calendar">
          <ImageStage scene="calendar" label={isFr ? 'Schéma : Qwillio relié à votre agenda et vos automatisations' : 'Diagram: Qwillio connected to your calendar and automations'}>
            <Paper className="qms-connections"><QwillioLogo size={48} /><div className="qms-connection-nodes"><span><CalendarCheck size={24} />Google Calendar</span><span><MessageSquare size={24} />SMS</span><span><Webhook size={24} />Webhook</span></div></Paper>
          </ImageStage>
          <div className="qms-connection-caption"><CalendarCheck size={20} /><div><h3>{isFr ? 'Un agenda de référence' : 'One source of availability'}</h3><p>{isFr ? 'Les disponibilités viennent de votre agenda Google ou Outlook, après connexion de votre compte.' : 'Availability comes from your Google or Outlook calendar once your account is connected.'}</p></div></div>
        </div>
        <div className="qms-ecosystem-crm"><Visual scene="crm" isFr={isFr} /><h3>{isFr ? 'Vos automatisations' : 'Your automations'}</h3></div>
        <div className="qms-ecosystem-sms"><ImageStage scene="workflow" label={isFr ? 'Illustration : vous choisissez les données transmises à vos outils' : 'Illustration: choose what data reaches your tools'}><Paper><span className="qms-label"><Users size={19} />{isFr ? 'Votre organisation' : 'Your workflow'}</span><strong className="qms-scene-title">{isFr ? 'Vos données, au bon endroit.' : 'Your data, where it belongs.'}</strong><div className="qms-note-rows"><span><Check size={15} />{isFr ? 'Règles définies par vous' : 'Rules defined by you'}</span><span><Check size={15} />{isFr ? 'Champs choisis pour vos outils' : 'Fields chosen for your tools'}</span></div></Paper></ImageStage><h3>{isFr ? 'Votre circuit de suivi' : 'Your follow-up workflow'}</h3></div>
      </div>
    </Container>
  </Section>;
}
