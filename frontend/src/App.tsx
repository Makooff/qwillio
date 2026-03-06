import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Prospects from './pages/Prospects';
import Clients from './pages/Clients';
import Quotes from './pages/Quotes';
import Campaigns from './pages/Campaigns';
import Settings from './pages/Settings';
import ClientPortal from './pages/ClientPortal';
import OnboardingPage from './pages/Onboarding';
import Register from './pages/Register';
import ConfirmEmail from './pages/ConfirmEmail';
import SelfOnboard from './pages/SelfOnboard';
import Costs from './pages/Costs';
import Retention from './pages/Retention';
import FollowUps from './pages/FollowUps';
import PhoneValidation from './pages/PhoneValidation';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  // If user hasn't completed onboarding, redirect to /onboard
  if (!user.onboardingCompleted) {
    return <Navigate to="/onboard" />;
  }

  return <>{children}</>;
}

function OnboardRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  // If already onboarded, go to admin
  if (user.onboardingCompleted) {
    return <Navigate to="/admin" />;
  }

  return <>{children}</>;
}

function PublicOrDashboard() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (user) {
    if (!user.onboardingCompleted) {
      return <Navigate to="/onboard" />;
    }
    return <Navigate to="/admin" />;
  }
  return <Landing />;
}

export default function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<PublicOrDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/confirm" element={<ConfirmEmail />} />

        {/* Self-service onboarding (requires auth, not yet onboarded) */}
        <Route
          path="/onboard"
          element={
            <OnboardRoute>
              <SelfOnboard />
            </OnboardRoute>
          }
        />

        {/* Client-facing routes (token-protected, no JWT needed) */}
        <Route path="/portal" element={<ClientPortal />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Admin routes (JWT-protected + onboarding completed) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="prospects" element={<Prospects />} />
          <Route path="clients" element={<Clients />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="costs" element={<Costs />} />
          <Route path="retention" element={<Retention />} />
          <Route path="followups" element={<FollowUps />} />
          <Route path="phone-validation" element={<PhoneValidation />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
