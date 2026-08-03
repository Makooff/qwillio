import { Player } from '@remotion/player';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { CalendarCheck, CalendarPlus, MessageSquare } from 'lucide-react';

/* Transcript vivant: un appel reel du runtime qui se rejoue en boucle
   (dialogue, creneau verifie, RDV inscrit, SMS). Composition Remotion
   lue par le Player, muette, sans controles, en boucle. Charge en lazy
   depuis Home pour garder le chunk marketing leger. Registre drenched:
   carbon, hairlines, un seul indigo. Les donnees dialoguees sont celles
   du mock produit (LiveAnswerMock), aucune metrique inventee. */

const FPS = 30;
const DURATION = 14 * FPS;

interface Line {
  who: string;
  text: string;
  at: number;
}

function rise(frame: number, at: number) {
  const opacity = interpolate(frame, [at, at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(frame, [at, at + 14], [10, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { opacity, transform: `translateY(${y}px)` };
}

function Composition({ isFr }: { isFr: boolean }) {
  const frame = useCurrentFrame();

  const lines: Line[] = isFr
    ? [
        { who: 'Mme Lefèvre', text: '« Bonjour, vous auriez quelque chose mardi ? »', at: 15 },
        { who: 'Marie', text: '« Bonjour Mme Lefèvre. Mardi, il me reste 14 h 30 ou 17 h. »', at: 85 },
        { who: 'Mme Lefèvre', text: '« 14 h 30, parfait. »', at: 165 },
      ]
    : [
        { who: 'Ms Lefèvre', text: '“Hello, would you have anything on Tuesday?”', at: 15 },
        { who: 'Marie', text: '“Hello Ms Lefèvre. On Tuesday I have 2:30 or 5 pm left.”', at: 85 },
        { who: 'Ms Lefèvre', text: '“2:30 works perfectly.”', at: 165 },
      ];

  const actions = isFr
    ? [
        { icon: CalendarCheck, text: 'Créneau vérifié', detail: 'mar. 14:30', at: 225 },
        { icon: CalendarPlus, text: 'RDV inscrit à l’agenda', detail: '', at: 265 },
        { icon: MessageSquare, text: 'SMS de confirmation envoyé', detail: '', at: 305 },
      ]
    : [
        { icon: CalendarCheck, text: 'Slot checked', detail: 'Tue 2:30 pm', at: 225 },
        { icon: CalendarPlus, text: 'Booked to the calendar', detail: '', at: 265 },
        { icon: MessageSquare, text: 'Confirmation text sent', detail: '', at: 305 },
      ];

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent', fontFamily: 'Outfit, sans-serif', padding: 28 }}>
      <div
        style={{
          background: 'var(--q2-carbon)',
          border: '1px solid var(--q2-border-d)',
          borderRadius: 12,
          padding: '22px 24px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingBottom: 14,
            borderBottom: '1px solid var(--q2-border-d)',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--q2-indigo)' }} />
          <span style={{ fontSize: 13, color: 'var(--q2-mist)', fontWeight: 500 }}>
            {isFr ? 'Appel entrant · Mme Lefèvre' : 'Incoming call · Ms Lefèvre'}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: 'var(--q2-fog)',
              border: '1px solid var(--q2-border-d)',
              borderRadius: 99,
              padding: '3px 10px',
            }}
          >
            {isFr ? 'Habituée' : 'Regular'}
          </span>
        </div>

        <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {lines.map((l) => (
            <div key={l.at} style={rise(frame, l.at)}>
              <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--q2-fog)', margin: 0 }}>
                {l.who}
              </p>
              <p style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--q2-mist)', margin: '4px 0 0' }}>{l.text}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--q2-border-d)', paddingTop: 6 }}>
          {actions.map((a) => (
            <div
              key={a.at}
              style={{
                ...rise(frame, a.at),
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 0',
                borderBottom: '1px solid var(--q2-border-d)',
              }}
            >
              <a.icon size={14} color="var(--q2-lift)" />
              <span style={{ fontSize: 13, color: 'var(--q2-mist)' }}>{a.text}</span>
              {a.detail && (
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--q2-fog)', fontVariantNumeric: 'tabular-nums' }}>
                  {a.detail}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export default function LiveTranscriptPlayer({ isFr, className = '' }: { isFr: boolean; className?: string }) {
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div className={className} aria-hidden="true">
      <Player
        component={Composition}
        inputProps={{ isFr }}
        durationInFrames={DURATION}
        compositionWidth={520}
        compositionHeight={460}
        fps={FPS}
        autoPlay={!reduced}
        loop
        controls={false}
        initialFrame={reduced ? DURATION - 1 : 0}
        style={{ width: '100%', height: 'auto', aspectRatio: '520 / 460' }}
      />
    </div>
  );
}
