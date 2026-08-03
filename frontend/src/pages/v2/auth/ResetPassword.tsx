import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import api from '../../../services/api';
import { useSEO } from '../../../hooks/useSEO';
import AuthShell, {
  AUTH_FIELD,
  AUTH_ICON_PLATE,
  AUTH_LABEL,
  AUTH_LINK,
  AUTH_SUBMIT,
} from './AuthShell';

/* Réinitialisation V2 — registre clair. Logique portée de
   pages/ResetPassword.tsx: jeton lu dans l'URL, redirection après 2,2 s. */

export default function ResetPassword() {
  useSEO({ title: 'Réinitialiser le mot de passe · Qwillio', noindex: true });

  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2200);
    } catch (err: any) {
      const errData = err?.response?.data?.error;
      setError(typeof errData === 'string' ? errData : 'Lien invalide ou expiré. Veuillez en demander un nouveau.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Mot de passe mis à jour" subtitle="Vous allez être redirigé vers la connexion…">
        <span className={AUTH_ICON_PLATE}>
          <CheckCircle2 size={20} className="text-q2-indigo" aria-hidden="true" />
        </span>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell
        title="Lien invalide"
        subtitle="Ce lien de réinitialisation est incomplet ou expiré."
      >
        <Link to="/forgot-password" className={`${AUTH_LINK} inline-flex items-center gap-1.5 text-[14px] font-medium`}>
          Demander un nouveau lien <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle="Choisissez un nouveau mot de passe (8 caractères minimum)."
      footer={
        <Link to="/login" className={AUTH_LINK}>
          Retour à la connexion
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="password" className={AUTH_LABEL}>Nouveau mot de passe</label>
        <div className="relative">
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={`${AUTH_FIELD} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="absolute inset-y-0 right-3 flex items-center text-q2-faint hover:text-q2-graphite transition-colors duration-150 focus:outline-none focus-visible:text-q2-ink"
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <label htmlFor="confirm" className={`${AUTH_LABEL} mt-4`}>Confirmer le mot de passe</label>
        <input
          id="confirm"
          type={showPw ? 'text' : 'password'}
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className={AUTH_FIELD}
        />

        {error && (
          <p className="mt-3 text-[13px] leading-relaxed text-[#b42318]" role="alert">{error}</p>
        )}

        <button type="submit" disabled={loading || !password || !confirm} className={`${AUTH_SUBMIT} mt-5`}>
          {loading ? 'Mise à jour…' : 'Réinitialiser le mot de passe'}
          {!loading && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </form>
    </AuthShell>
  );
}
