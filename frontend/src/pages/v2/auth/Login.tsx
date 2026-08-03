import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { useSEO } from '../../../hooks/useSEO';
import AuthShell, {
  AuthDivider,
  GoogleAuthV2,
  AUTH_ALERT,
  AUTH_FIELD,
  AUTH_LABEL,
  AUTH_LINK,
  AUTH_SUBMIT,
} from './AuthShell';

/* Connexion V2, registre clair (DA/v2-direction.md).
   La logique (authStore.login, Google, redirections par rôle) est celle de
   pages/Login.tsx, portée sans modification. */

export default function Login() {
  useSEO({ title: 'Connexion · Qwillio', noindex: true });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      const { user } = useAuthStore.getState();
      navigate(user?.role === 'admin' ? '/admin' : (user?.onboardingCompleted ? '/dashboard' : '/onboard'));
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Le serveur met du temps à répondre. Veuillez réessayer dans quelques secondes.');
      } else {
        const errData = err?.response?.data?.error;
        setError(typeof errData === 'string' ? errData : (errData?.message || err?.message || 'Identifiants incorrects.'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Bienvenue"
      subtitle="Connectez-vous à votre espace Qwillio."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/register" className={AUTH_LINK}>
            Créer un compte
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {error && (
          <div className={AUTH_ALERT} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="login-email" className={AUTH_LABEL}>Adresse email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@agence.fr"
              required
              autoComplete="email"
              className={AUTH_FIELD}
            />
          </div>

          <div>
            <label htmlFor="login-password" className={AUTH_LABEL}>Mot de passe</label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className={`${AUTH_FIELD} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute inset-y-0 right-3 flex items-center text-q2-faint hover:text-q2-graphite transition-colors duration-150 focus:outline-none focus-visible:text-q2-ink"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 text-[13px]">
            <label className="flex items-center gap-2.5 cursor-pointer text-q2-body">
              <input
                type="checkbox"
                name="rememberMe"
                defaultChecked
                className="w-4 h-4 rounded border-q2-plate accent-[#1d1d1f]"
              />
              Rester connecté
            </label>
            <Link to="/forgot-password" className={AUTH_LINK}>
              Mot de passe oublié ?
            </Link>
          </div>

          <button type="submit" disabled={loading} className={AUTH_SUBMIT}>
            {loading ? 'Connexion…' : 'Se connecter'}
            {!loading && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </form>

        <AuthDivider label="ou" />

        <GoogleAuthV2 mode="login" onError={setError} disabled={loading} />
      </div>
    </AuthShell>
  );
}
