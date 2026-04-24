import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuthStore } from './stores/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/layout/Layout';
import ClientLayout from './components/layout/ClientLayout';
import CloserLayout from './components/layout/CloserLayout';
import QwillioLoader from './components/QwillioLoader';
import AppBootOverlay from './components/AppBootOverlay';
// Eager-loaded entry points (Landing, Login, Register, ConfirmEmail)
import Login from './pages/Login';
import Landing from './pages/Landing';
import Register from './pages/Register';
import ConfirmEmail from './pages/ConfirmEmail';
// Admin pages (lazy loaded)
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Prospects = lazy(() => import('./pages/Prospects'));
const AdminClients = lazy(() => import('./pages/Clients'));
const AdminCampaigns = lazy(() => import('./pages/Campaigns'));
const AdminCosts = lazy(() => import('./pages/Costs'));
const AdminRetention = lazy(() => import('./pages/Retention'));
const AdminFollowUps = lazy(() => import('./pages/FollowUps'));
const AdminPhoneValidation = lazy(() => import('./pages/PhoneValidation'));
const AiLearning = lazy(() => import('./pages/admin/AiLearning'));
const AiDecisions = lazy(() => import('./pages/admin/AiDecisions'));
const Prospecting = lazy(() => import('./pages/admin/Prospecting'));
const AdminCalls = lazy(() => import('./pages/admin/Calls'));
const AdminLeads = lazy(() => import('./pages/admin/Leads'));
const AdminBilling = lazy(() => import('./pages/admin/Billing'));
const AdminSystem = lazy(() => import('./pages/admin/System'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const LiveMonitor = lazy(() => import('./pages/admin/LiveMonitor'));
const AdminLogs = lazy(() => import('./pages/admin/Logs'));
const AdminNotFound = lazy(() => import('./pages/admin/NotFound'));
// Client portal pages (lazy loaded)
const ClientPortal = lazy(() => import('./pages/ClientPortal'));
const OnboardingPage = lazy(() => import('./pages/Onboarding'));
const SelfOnboard = lazy(() => import('./pages/SelfOnboard'));
const ClientOverview = lazy(() => import('./pages/client/ClientOverview'));
const ClientCalls = lazy(() => import('./pages/client/ClientCalls'));
const ClientLeads = lazy(() => import('./pages/client/ClientLeads'));
const ClientReceptionist = lazy(() => import('./pages/client/ClientReceptionist'));
const ClientAccount = lazy(() => import('./pages/client/ClientAccount'));
const ClientSetupForwarding = lazy(() => import('./pages/client/ClientSetupForwarding'));
const ClientSupport = lazy(() => import('./pages/client/ClientSupport'));
const ClientAnalytics = lazy(() => import('./pages/client/ClientAnalytics'));
const ClientBilling = lazy(() => import('./pages/client/ClientBilling'));
// Agent IA pages (lazy loaded)
const AgentDashboard = lazy(() => import('./pages/client/AgentDashboard'));
const AgentEmail = lazy(() => import('./pages/client/AgentEmail'));
const AgentPayments = lazy(() => import('./pages/client/AgentPayments'));
const AgentAccounting = lazy(() => import('./pages/client/AgentAccounting'));
const AgentInventory = lazy(() => import('./pages/client/AgentInventory'));
// CRM pages (lazy loaded)
const CrmContacts = lazy(() => import('./pages/client/CrmContacts'));
const CrmDeals = lazy(() => import('./pages/client/CrmDeals'));
const CrmActivities = lazy(() => import('./pages/client/CrmActivities'));
const CrmContactDetail = lazy(() => import('./pages/client/CrmContactDetail'));
const Integrations = lazy(() => import('./pages/client/Integrations'));
// Legal pages (lazy loaded)
const Privacy = lazy(() => import('./pages/legal/Privacy'));
const Terms = lazy(() => import('./pages/legal/Terms'));
const About = lazy(() => import('./pages/legal/About'));
const Contact = lazy(() => import('./pages/legal/Contact'));
const Gdpr = lazy(() => import('./pages/legal/Gdpr'));
// Public pages (lazy loaded)
const AgentPage = lazy(() => import('./pages/Agent'));
const PricingPage = lazy(() => import('./pages/Pricing'));
const BlogPage = lazy(() => import('./pages/Blog'));
const AffiliatePage = lazy(() => import('./pages/Affiliate'));

// Closer (closeuse)
const CloserSession        = lazy(() => import('./pages/closer/CloserSession'));
const CloserProspects      = lazy(() => import('./pages/closer/CloserProspects'));
const CloserFollowUps      = lazy(() => import('./pages/closer/CloserFollowUps'));
const CloserAccount        = lazy(() => import('./pages/closer/CloserAccount'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Spinner() {
  return <QwillioLoader size={128} />;
}

function homeRoute(user: { role: string }) {
  if (user.role === 'admin')  return '/admin';
  if (user.role === 'closer') return '/closer';
  return '/dashboard';
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  if (!user.onboardingCompleted) return <Navigate to="/onboard" />;
  if (user.role !== 'admin') return <Navigate to={homeRoute(user)} />;
  return <>{children}</>;
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  const location = useLocation();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  // Allow through if returning from Stripe payment (webhook will create Client)
  const isPaymentReturn = new URLSearchParams(location.search).get('payment') === 'success';
  if (!user.onboardingCompleted && !isPaymentReturn) return <Navigate to="/onboard" />;
  if (user.role !== 'client') return <Navigate to={homeRoute(user)} />;
  return <>{children}</>;
}

function CloserRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'closer' && user.role !== 'admin') return <Navigate to={homeRoute(user)} />;
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
  return <Suspense fallback={<Spinner />}><Home /></Suspense>;
}

export default function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <ErrorBoundary>
      <AppBootOverlay />
      <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<PublicOrDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/confirm" element={<ConfirmEmail />} />
        <Route path="/privacy" element={<Suspense fallback={<Spinner />}><Privacy /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<Spinner />}><Terms /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={<Spinner />}><About /></Suspense>} />
        <Route path="/contact" element={<Suspense fallback={<Spinner />}><Contact /></Suspense>} />
        <Route path="/gdpr" element={<Suspense fallback={<Spinner />}><Gdpr /></Suspense>} />
        {/* French route aliases for legal pages */}
        <Route path="/fr/privacy" element={<Suspense fallback={<Spinner />}><Privacy /></Suspense>} />
        <Route path="/fr/terms" element={<Suspense fallback={<Spinner />}><Terms /></Suspense>} />
        <Route path="/fr/gdpr" element={<Suspense fallback={<Spinner />}><Gdpr /></Suspense>} />
        <Route path="/fr/about" element={<Suspense fallback={<Spinner />}><About /></Suspense>} />
        <Route path="/fr/contact" element={<Suspense fallback={<Spinner />}><Contact /></Suspense>} />
        <Route path="/receptionist" element={<Landing />} />
        <Route path="/agent" element={<Suspense fallback={<Spinner />}><AgentPage /></Suspense>} />
        <Route path="/pricing" element={<Suspense fallback={<Spinner />}><PricingPage /></Suspense>} />
        <Route path="/blog" element={<Suspense fallback={<Spinner />}><BlogPage /></Suspense>} />
        <Route path="/affiliate" element={<Suspense fallback={<Spinner />}><AffiliatePage /></Suspense>} />

        {/* Self-service onboarding (requires auth, not yet onboarded) */}
        <Route
          path="/onboard"
          element={
            <OnboardRoute>
              <Suspense fallback={<Spinner />}><SelfOnboard /></Suspense>
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
          <Route index element={<Suspense fallback={<Spinner />}><ClientOverview /></Suspense>} />
          <Route path="calls" element={<Suspense fallback={<Spinner />}><ClientCalls /></Suspense>} />
          <Route path="leads" element={<Suspense fallback={<Spinner />}><ClientLeads /></Suspense>} />
          <Route path="receptionist" element={<Suspense fallback={<Spinner />}><ClientReceptionist /></Suspense>} />
          <Route path="analytics" element={<Suspense fallback={<Spinner />}><ClientAnalytics /></Suspense>} />
          <Route path="billing" element={<Suspense fallback={<Spinner />}><ClientBilling /></Suspense>} />
          <Route path="account" element={<Suspense fallback={<Spinner />}><ClientAccount /></Suspense>} />
          <Route path="setup/call-forwarding" element={<Suspense fallback={<Spinner />}><ClientSetupForwarding /></Suspense>} />
          <Route path="support" element={<Suspense fallback={<Spinner />}><ClientSupport /></Suspense>} />
          {/* Agent IA */}
          <Route path="agent" element={<Suspense fallback={<Spinner />}><AgentDashboard /></Suspense>} />
          <Route path="agent/email" element={<Suspense fallback={<Spinner />}><AgentEmail /></Suspense>} />
          <Route path="agent/payments" element={<Suspense fallback={<Spinner />}><AgentPayments /></Suspense>} />
          <Route path="agent/accounting" element={<Suspense fallback={<Spinner />}><AgentAccounting /></Suspense>} />
          <Route path="agent/inventory" element={<Suspense fallback={<Spinner />}><AgentInventory /></Suspense>} />
          {/* CRM */}
          <Route path="crm" element={<Suspense fallback={<Spinner />}><CrmContacts /></Suspense>} />
          <Route path="crm/deals" element={<Suspense fallback={<Spinner />}><CrmDeals /></Suspense>} />
          <Route path="crm/activities" element={<Suspense fallback={<Spinner />}><CrmActivities /></Suspense>} />
          <Route path="crm/:id" element={<Suspense fallback={<Spinner />}><CrmContactDetail /></Suspense>} />
          {/* Integrations */}
          <Route path="account/integrations" element={<Suspense fallback={<Spinner />}><Integrations /></Suspense>} />
        </Route>

        {/* Client-facing routes (token-protected, no JWT needed) */}
        <Route path="/portal" element={<Suspense fallback={<Spinner />}><ClientPortal /></Suspense>} />
        <Route path="/onboarding" element={<Suspense fallback={<Spinner />}><OnboardingPage /></Suspense>} />

        {/* Admin routes (JWT-protected, admin role) */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Layout />
            </AdminRoute>
          }
        >
          <Route index element={<Suspense fallback={<Spinner />}><Dashboard /></Suspense>} />
          <Route path="prospects" element={<Suspense fallback={<Spinner />}><Prospects /></Suspense>} />
          <Route path="clients" element={<Suspense fallback={<Spinner />}><AdminClients /></Suspense>} />
          <Route path="campaigns" element={<Suspense fallback={<Spinner />}><AdminCampaigns /></Suspense>} />
          <Route path="costs" element={<Suspense fallback={<Spinner />}><AdminCosts /></Suspense>} />
          <Route path="retention" element={<Suspense fallback={<Spinner />}><AdminRetention /></Suspense>} />
          <Route path="followups" element={<Suspense fallback={<Spinner />}><AdminFollowUps /></Suspense>} />
          <Route path="phone-validation" element={<Suspense fallback={<Spinner />}><AdminPhoneValidation /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<Spinner />}><AdminSettings /></Suspense>} />
          <Route path="ai-learning" element={<Suspense fallback={<Spinner />}><AiLearning /></Suspense>} />
          <Route path="ai-decisions" element={<Suspense fallback={<Spinner />}><AiDecisions /></Suspense>} />
          <Route path="prospecting" element={<Suspense fallback={<Spinner />}><Prospecting /></Suspense>} />
          <Route path="calls" element={<Suspense fallback={<Spinner />}><AdminCalls /></Suspense>} />
          <Route path="leads" element={<Suspense fallback={<Spinner />}><AdminLeads /></Suspense>} />
          <Route path="billing" element={<Suspense fallback={<Spinner />}><AdminBilling /></Suspense>} />
          <Route path="system" element={<Suspense fallback={<Spinner />}><AdminSystem /></Suspense>} />
          <Route path="monitor" element={<Suspense fallback={<Spinner />}><LiveMonitor /></Suspense>} />
          <Route path="logs" element={<Suspense fallback={<Spinner />}><AdminLogs /></Suspense>} />
          <Route path="*" element={<Suspense fallback={<Spinner />}><AdminNotFound /></Suspense>} />
        </Route>

        {/* Closer routes (JWT-protected, closer role) */}
        <Route
          path="/closer"
          element={
            <CloserRoute>
              <CloserLayout />
            </CloserRoute>
          }
        >
          <Route index            element={<Suspense fallback={<Spinner />}><CloserSession /></Suspense>} />
          <Route path="prospects" element={<Suspense fallback={<Spinner />}><CloserProspects /></Suspense>} />
          <Route path="followups" element={<Suspense fallback={<Spinner />}><CloserFollowUps /></Suspense>} />
          <Route path="account"   element={<Suspense fallback={<Spinner />}><CloserAccount /></Suspense>} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </BrowserRouter>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}
