import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import api from '../services/api';

export default function ConfirmEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Missing confirmation token.');
      return;
    }

    api.get(`/auth/confirm/${token}`)
      .then(async (res) => {
        const { token: jwtToken, user } = res.data;
        if (jwtToken) {
          localStorage.setItem('token', jwtToken);
        }
        await checkAuth();
        setStatus('success');

        // Redirect to onboarding after 2s
        setTimeout(() => {
          if (user?.onboardingCompleted) {
            navigate('/admin');
          } else {
            navigate('/onboard');
          }
        }, 2000);
      })
      .catch((err) => {
        setStatus('error');
        setError(err.response?.data?.error || 'Failed to confirm email.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">

        <Link to="/" className="flex items-center justify-center gap-2 text-xl font-semibold tracking-tight text-[#1d1d1f] mb-10">
          <QwillioLogo size={30} /> Qwillio
        </Link>

        {status === 'loading' && (
          <>
            <Loader2 size={48} className="mx-auto text-[#6366f1] animate-spin mb-6" />
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Confirming your email...</h1>
            <p className="text-[#86868b]">Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Email confirmed!</h1>
            <p className="text-[#86868b]">Redirecting you to setup your account...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
              <XCircle size={40} className="text-red-400" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Confirmation failed</h1>
            <p className="text-[#86868b] mb-6">{error}</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 bg-[#6366f1] text-white text-base font-medium px-6 py-3 rounded-full hover:bg-[#4f46e5] transition-colors"
            >
              Go to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
