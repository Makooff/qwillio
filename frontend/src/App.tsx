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
import ClientLayout from './components/layout/ClientLayout';
import ClientOverview from './pages/client/ClientOverview';
import ClientCalls from './pages/client/ClientCalls';
import ClientLeads from './pages/client/ClientLeads';
import ClientReceptionist from './pages/client/ClientReceptionist';
import ClientAccount from './pages/client/ClientAccount';
import ClientSupport from './pages/client/ClientSupport';
import ClientAnalytics from './pages/client/ClientAnalytics';
import ClientBilling from './pages/client/ClientBilling';
import Costs from './pages/Costs';
import Retention from './pages/Retention';
import FollowUps from './pages/FollowUps';
import PhoneValidation from './pages/PhoneValidation';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
    </div>
  );
}

function homeRoute(user: { role: string }) {
  return user.role === 'admin' ? '/admin' : '/dashboard';
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  if (!user.onboardingCompleted) return <Navigate to="/onboard" />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  if (!user.onboardingCompleted) return <Navigate to="/onboard" />;
  if (user.role !== 'client') return <Navigate to="/admin" />;
  return <>{children}</>;
}

function OnboardRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  if (user.onboardingCompleted) return <Navigate to={homeRoute(user)} />;
  return <>{children}</>;
}

function PublicOrDashboard() {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (user) {
    if (!user.onboardingCompleted) return <Navigate to="/onboard" />;
    return <Navigate to={homeRoute(user)} />;
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

        {/* Client dashboard (JWT-protected, client role, nested layout) */}
        <Route
          path="/dashboard"
          element={
            <ClientRoute>
              <ClientLayout />
            </ClientRoute>
          }
        >
          <Route index element={<ClientOverview />} />
          <Route path="calls" element={<ClientCalls />} />
          <Route path="leads" element={<ClientLeads />} />
          <Route path="receptionist" element={<ClientReceptionist />} />
          <Route path="analytics" element={<ClientAnalytics />} />
          <Route path="billing" element={<ClientBilling />} />
          <Route path="account" element={<ClientAccount />} />
          <Route path="support" element={<ClientSupport />} />
        </Route>

        {/* Client-facing routes (token-protected, no JWT needed) */}
        <Route path="/portal" element={<ClientPortal />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Admin routes (JWT-protected, admin role) */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Layout />
            </AdminRoute>
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
