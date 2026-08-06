import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { ArrowLeft } from '../../../components/icons';
import { useAuthStore } from '../../../stores/authStore';
import { useLang } from '../../../stores/langStore';
import NavV2 from '../../../components/v2/NavV2';
import RevealV2 from '../../../components/v2/RevealV2';

/* Accès clients V2 « Papier & Signal », registre CLAIR (DA/v2-direction.md).
   L'auth est la porte entre le site crème et l'app sombre: canvas plein cadre,
   carte définie par sa hairline, CTA pilule encre, jamais de mauve sur un bouton. */

export const AUTH_LABEL = 'block text-[13px] font-medium text-q2-graphite mb-1.5';

export const AUTH_FIELD =
  'w-full rounded-xl bg-q2-plate/50 border border-q2-plate px-4 py-3 text-[15px] text-q2-ink placeholder:text-q2-faint outline-none transition-colors duration-150 focus:border-q2-indigo focus:bg-q2-canvas';

export const AUTH_SUBMIT =
  'w-full inline-flex items-center justify-center gap-2 rounded-full bg-q2-ink text-white text-[15px] font-medium px-6 py-3.5 min-h-[44px] hover:bg-black transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

export const AUTH_OUTLINE =
  'inline-flex items-center justify-center gap-2 rounded-full border border-q2-plate bg-q2-canvas text-q2-ink text-[15px] font-medium px-6 py-3.5 min-h-[44px] hover:border-q2-faint transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

/* Liens en ligne: encre soulignée (LegalShell), pas de mauve sur canvas clair. */
export const AUTH_LINK =
  'text-q2-ink underline decoration-1 decoration-q2-faint underline-offset-4 hover:decoration-q2-ink transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-sm';

/* États système: signal seulement, une teinte par état. */
export const AUTH_ALERT =
  'rounded-xl border border-[color:var(--q2-bad-brd)] bg-[color:var(--q2-bad-bg)] px-4 py-3 text-[13px] leading-relaxed text-[color:var(--q2-bad-ink)]';

export const AUTH_NOTICE =
  'rounded-xl border border-[color:var(--q2-ok-brd)] bg-[color:var(--q2-ok-bg)] px-4 py-3 text-[13px] leading-relaxed text-[color:var(--q2-ok-ink)]';

export const AUTH_ICON_PLATE =
  'w-11 h-11 rounded-full bg-q2-plate flex items-center justify-center';

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-q2-plate" />
      <span className="q2-eyebrow text-q2-faint">{label}</span>
      <span className="h-px flex-1 bg-q2-plate" />
    </div>
  );
}

const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0" aria-hidden="true">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

interface GoogleProps {
  mode: 'login' | 'register';
  disabled?: boolean;
  onError: (msg: string) => void;
}

function GoogleButton({ mode, disabled, onError }: GoogleProps) {
  const { googleLogin } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const googleSignIn = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      onError('');
      setLoading(true);
      try {
        await googleLogin(tokenResponse.access_token, 'token');
        const { user } = useAuthStore.getState();
        navigate(user?.role === 'admin' ? '/admin' : (user?.onboardingCompleted ? '/dashboard' : '/onboard'));
      } catch (err: any) {
        if (!err?.response) {
          // No response at all: backend waking up (Render/Neon cold start) or offline
          onError('Le serveur met du temps à répondre, il redémarre. Réessaie dans quelques secondes.');
        } else {
          onError(err?.response?.data?.error || `Google Sign-${mode === 'login' ? 'In' : 'Up'} failed`);
        }
      } finally {
        setLoading(false);
      }
    },
    onError: (err?: any) => {
      const code = err?.error || '';
      if (code === 'idpiframe_initialization_failed' || code === 'popup_blocked_by_browser') {
        onError('Le popup Google a été bloqué. Autorise les popups pour ce site.');
      } else {
        onError('Google Sign-In non configuré pour ce domaine. Utilise email/mot de passe.');
      }
    },
    flow: 'implicit',
  });

  const label = mode === 'login' ? 'Se connecter avec Google' : "S'inscrire avec Google";

  return (
    <button
      type="button"
      onClick={() => !loading && googleSignIn()}
      disabled={disabled || loading}
      className={`${AUTH_OUTLINE} w-full`}
    >
      <GoogleSVG />
      {loading ? '...' : label}
    </button>
  );
}

// Only renders if VITE_GOOGLE_CLIENT_ID is configured, prevents broken OAuth errors
export function GoogleAuthV2(props: GoogleProps) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  return <GoogleButton {...props} />;
}

interface AuthShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /* Pied de carte: lien alternatif (créer un compte, retour connexion) */
  footer?: ReactNode;
  /* Coin haut droit: sélecteur de langue, étape, déconnexion */
  headerRight?: ReactNode;
  /* 560px pour les écrans de choix (forfait), 400px par défaut */
  wide?: boolean;
  children: ReactNode;
}

export default function AuthShell({ title, subtitle, footer, headerRight, wide = false, children }: AuthShellProps) {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  return (
    /* L'entête du site en entier, pas un logo isolé (demande utilisateur):
       arriver sur l'essai depuis la page d'accueil ne doit pas donner
       l'impression d'avoir quitté le site. La nav est `fixed`, d'où le
       padding-haut, exactement comme dans `PublicShell`.

       Pas de pied de page en revanche: une page d'inscription qui déroule
       cinq colonnes de liens invite à partir ailleurs. */
    <div className="min-h-dvh bg-q2-canvas font-outfit text-q2-ink flex flex-col">
      <NavV2 />

      <main className="flex-1 flex flex-col items-center justify-start sm:justify-center px-6 pb-16 pt-20 sm:pt-24">
        <div className={`w-full ${wide ? 'max-w-[560px]' : 'max-w-[400px]'}`}>
          <div className="flex items-center justify-between gap-4 mb-4">
            {/* Retour à l'accueil: un lien, jamais `history.back()`. Sur une
                page ouverte dans un onglet neuf, revenir en arrière ne mène
                nulle part, alors que l'accueil existe toujours. */}
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-[13px] text-q2-body hover:text-q2-ink transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-full"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              {isFr ? 'Retour' : 'Back'}
            </Link>
            {headerRight ? <div className="flex items-center gap-3">{headerRight}</div> : null}
          </div>

          <RevealV2 y={12}>
            <div className="rounded-[20px] border border-q2-plate bg-q2-canvas p-7 sm:p-8">
              <h1 className="text-[clamp(1.6rem,3vw,2rem)] font-light tracking-[-0.02em] leading-[1.12] text-q2-ink">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-2.5 text-[15px] leading-relaxed text-q2-body q2-body-text">{subtitle}</p>
              ) : null}

              <div className="mt-7">{children}</div>

              {footer ? (
                <div className="mt-8 pt-6 border-t border-q2-plate text-center text-[13px] leading-relaxed text-q2-body q2-body-text">
                  {footer}
                </div>
              ) : null}
            </div>
          </RevealV2>
        </div>
      </main>
    </div>
  );
}
