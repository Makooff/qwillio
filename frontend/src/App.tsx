import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuthStore } from './stores/authStore';
import ErrorBoundary from './components/ErrorBoundary';
const Layout = lazy(() => import('./components/layout/Layout'));
const ClientLayout = lazy(() => import('./components/layout/ClientLayout'));
const CloserLayout = lazy(() => import('./components/layout/CloserLayout'));
import ComingSoon from './components/client/ComingSoon';
// Eager-loaded entry points (Login, Register, ConfirmEmail)
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ConfirmEmail from './pages/ConfirmEmail';
// Landing is large — lazy load it
const Landing = lazy(() => import('./pages/Landing'));
// Admin pages (lazy loaded)
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminClients = lazy(() => import('./pages/Clients'));
const AdminCalls = lazy(() => import('./pages/admin/Calls'));
const AdminLeads = lazy(() => import('./pages/admin/Leads'));
const AdminBilling = lazy(() => import('./pages/admin/Billing'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
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
const ClientSetupCustomize  = lazy(() => import('./pages/client/ClientSetupCustomize'));
const ClientSupport = lazy(() => import('./pages/client/ClientSupport'));
const ClientAnalytics = lazy(() => import('./pages/client/ClientAnalytics'));
const ClientBilling = lazy(() => import('./pages/client/ClientBilling'));
// Agent IA pages (lazy loaded)
const AgentDashboard = lazy(() => import('./pages/client/AgentDashboard'));
// Email / Payments / Accounting / Inventory agent pages are not functional yet
// (no backend) — their routes render a ComingSoon notice instead of the mock UI.
const AgentMarketing = lazy(() => import('./pages/client/AgentMarketing'));
const AgentReputation = lazy(() => import('./pages/client/AgentReputation'));
const AgentScheduling = lazy(() => import('./pages/client/AgentScheduling'));
const AgentSupport = lazy(() => import('./pages/client/AgentSupport'));
const AgentCrm = lazy(() => import('./pages/client/AgentCrm'));
const AgentDocument = lazy(() => import('./pages/client/AgentDocument'));
const AgentLocalSeo = lazy(() => import('./pages/client/AgentLocalSeo'));
const AgentLeadGen = lazy(() => import('./pages/client/AgentLeadGen'));
const AgentAnalytics = lazy(() => import('./pages/client/AgentAnalytics'));
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
const BlogArticlePage = lazy(() => import('./pages/BlogArticle'));
const ComparisonPage = lazy(() => import('./pages/ComparisonPage'));
const AffiliatePage = lazy(() => import('./pages/Affiliate'));

// AI Agents admin pages (lazy loaded)
const Agents = lazy(() => import('./pages/admin/Agents'));
const ListProductAgents = lazy(() => import('./pages/admin/agents/ListProductAgents'));
const AdminAgentEmail = lazy(() => import('./pages/admin/agents/AdminAgentEmail'));
const AdminAgentAccounting = lazy(() => import('./pages/admin/agents/AdminAgentAccounting'));
const AdminAgentInventory = lazy(() => import('./pages/admin/agents/AdminAgentInventory'));
const AdminAgentPayments = lazy(() => import('./pages/admin/agents/AdminAgentPayments'));
const AdminAgentMarketing = lazy(() => import('./pages/admin/agents/AdminAgentMarketing'));
const AdminAgentReputation = lazy(() => import('./pages/admin/agents/AdminAgentReputation'));
const AdminAgentScheduling = lazy(() => import('./pages/admin/agents/AdminAgentScheduling'));
const AdminAgentSupport = lazy(() => import('./pages/admin/agents/AdminAgentSupport'));
const AdminAgentCrm = lazy(() => import('./pages/admin/agents/AdminAgentCrm'));
const AdminAgentDocument = lazy(() => import('./pages/admin/agents/AdminAgentDocument'));
const AdminAgentLocalSeo = lazy(() => import('./pages/admin/agents/AdminAgentLocalSeo'));
const AdminAgentLeadGen = lazy(() => import('./pages/admin/agents/AdminAgentLeadGen'));
const AdminAgentAnalytics = lazy(() => import('./pages/admin/agents/AdminAgentAnalytics'));
const Agency = lazy(() => import('./pages/admin/Agency'));

// Closer (closeuse)
const CloserSession        = lazy(() => import('./pages/closer/CloserSession'));
const CloserProspects      = lazy(() => import('./pages/closer/CloserProspects'));
const CloserFollowUps      = lazy(() => import('./pages/closer/CloserFollowUps'));
const CloserAccount        = lazy(() => import('./pages/closer/CloserAccount'));

// Tell the browser to stop restoring previous scroll positions on
// back / forward / route change — we manage scroll ourselves below.
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  try { window.history.scrollRestoration = 'manual'; } catch { /* empty */ }
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Force every possible scrolling element back to the top.
    // iOS Safari / Chrome can scroll the document when the URL bar collapses,
    // so window.scrollTo alone isn't always enough.  We also re-scroll any
    // element that opted into being a scroll container (data-scroll-root).
    const jump = () => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      document.querySelectorAll<HTMLElement>('[data-scroll-root]').forEach(el => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });
    };
    jump();
    // Run again on the next frame so it wins the race against the freshly
    // mounted page's layout.
    const r1 = requestAnimationFrame(jump);
    // And once more after layout/paint settles (covers iOS URL-bar collapses).
    const r2 = window.setTimeout(jump, 60);
    return () => {
      cancelAnimationFrame(r1);
      window.clearTimeout(r2);
    };
  }, [pathname]);
  return null;
}

function Spinner() {
  // No visible loader on arrival/refresh — just the dark surface, seamless into content.
  return <div style={{ minHeight: '100dvh', background: '#0a0a0a' }} aria-hidden="true" />;
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
      <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<PublicOrDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
        <Route path="/receptionist" element={<Suspense fallback={<Spinner />}><Landing /></Suspense>} />
        <Route path="/agent" element={<Suspense fallback={<Spinner />}><AgentPage /></Suspense>} />
        <Route path="/pricing" element={<Suspense fallback={<Spinner />}><PricingPage /></Suspense>} />
        <Route path="/blog" element={<Suspense fallback={<Spinner />}><BlogPage /></Suspense>} />
        <Route path="/blog/:slug" element={<Suspense fallback={<Spinner />}><BlogArticlePage /></Suspense>} />
        <Route path="/vs/:slug" element={<Suspense fallback={<Spinner />}><ComparisonPage /></Suspense>} />
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
              <Suspense fallback={<Spinner />}><ClientLayout /></Suspense>
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
          <Route path="setup/customize"       element={<Suspense fallback={<Spinner />}><ClientSetupCustomize /></Suspense>} />
          <Route path="support" element={<Suspense fallback={<Spinner />}><ClientSupport /></Suspense>} />
          {/* Agent IA */}
          <Route path="agent" element={<Suspense fallback={<Spinner />}><AgentDashboard /></Suspense>} />
          <Route path="agent/email" element={<ComingSoon module="Email AI" />} />
          <Route path="agent/payments" element={<ComingSoon module="Payments AI" />} />
          <Route path="agent/accounting" element={<ComingSoon module="Accounting AI" />} />
          <Route path="agent/inventory" element={<ComingSoon module="Inventory AI" />} />
          <Route path="agent/marketing" element={<Suspense fallback={<Spinner />}><AgentMarketing /></Suspense>} />
          <Route path="agent/reputation" element={<Suspense fallback={<Spinner />}><AgentReputation /></Suspense>} />
          <Route path="agent/scheduling" element={<Suspense fallback={<Spinner />}><AgentScheduling /></Suspense>} />
          <Route path="agent/support" element={<Suspense fallback={<Spinner />}><AgentSupport /></Suspense>} />
          <Route path="agent/crm" element={<Suspense fallback={<Spinner />}><AgentCrm /></Suspense>} />
          <Route path="agent/document" element={<Suspense fallback={<Spinner />}><AgentDocument /></Suspense>} />
          <Route path="agent/local-seo" element={<Suspense fallback={<Spinner />}><AgentLocalSeo /></Suspense>} />
          <Route path="agent/lead-gen" element={<Suspense fallback={<Spinner />}><AgentLeadGen /></Suspense>} />
          <Route path="agent/analytics" element={<Suspense fallback={<Spinner />}><AgentAnalytics /></Suspense>} />
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
              <Suspense fallback={<Spinner />}><Layout /></Suspense>
            </AdminRoute>
          }
        >
          <Route index element={<Suspense fallback={<Spinner />}><Dashboard /></Suspense>} />
          <Route path="clients" element={<Suspense fallback={<Spinner />}><AdminClients /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<Spinner />}><AdminSettings /></Suspense>} />
          <Route path="calls" element={<Suspense fallback={<Spinner />}><AdminCalls /></Suspense>} />
          <Route path="leads" element={<Suspense fallback={<Spinner />}><AdminLeads /></Suspense>} />
          <Route path="billing" element={<Suspense fallback={<Spinner />}><AdminBilling /></Suspense>} />
          <Route path="agents" element={<Suspense fallback={<Spinner />}><ListProductAgents /></Suspense>} />
          <Route path="agents/email-ai" element={<Suspense fallback={<Spinner />}><AdminAgentEmail /></Suspense>} />
          <Route path="agents/accounting-ai" element={<Suspense fallback={<Spinner />}><AdminAgentAccounting /></Suspense>} />
          <Route path="agents/inventory-ai" element={<Suspense fallback={<Spinner />}><AdminAgentInventory /></Suspense>} />
          <Route path="agents/payments-ai" element={<Suspense fallback={<Spinner />}><AdminAgentPayments /></Suspense>} />
          <Route path="agents/marketing-ai" element={<Suspense fallback={<Spinner />}><AdminAgentMarketing /></Suspense>} />
          <Route path="agents/reputation-ai" element={<Suspense fallback={<Spinner />}><AdminAgentReputation /></Suspense>} />
          <Route path="agents/scheduling-ai" element={<Suspense fallback={<Spinner />}><AdminAgentScheduling /></Suspense>} />
          <Route path="agents/support-ai" element={<Suspense fallback={<Spinner />}><AdminAgentSupport /></Suspense>} />
          <Route path="agents/crm-ai" element={<Suspense fallback={<Spinner />}><AdminAgentCrm /></Suspense>} />
          <Route path="agents/document-ai" element={<Suspense fallback={<Spinner />}><AdminAgentDocument /></Suspense>} />
          <Route path="agents/local-seo-ai" element={<Suspense fallback={<Spinner />}><AdminAgentLocalSeo /></Suspense>} />
          <Route path="agents/lead-gen-ai" element={<Suspense fallback={<Spinner />}><AdminAgentLeadGen /></Suspense>} />
          <Route path="agents/analytics-ai" element={<Suspense fallback={<Spinner />}><AdminAgentAnalytics /></Suspense>} />
          <Route path="learning-agents" element={<Suspense fallback={<Spinner />}><Agents /></Suspense>} />
          <Route path="agency" element={<Suspense fallback={<Spinner />}><Agency /></Suspense>} />
          {/* Old routes → redirect to new locations */}
          <Route path="prospects" element={<Navigate to="/admin/leads" replace />} />
          <Route path="prospecting" element={<Navigate to="/admin/agents" replace />} />
          <Route path="ai-learning" element={<Navigate to="/admin/agents" replace />} />
          <Route path="ai-decisions" element={<Navigate to="/admin/agents" replace />} />
          <Route path="analytics" element={<Navigate to="/admin" replace />} />
          <Route path="notifications" element={<Navigate to="/admin" replace />} />
          <Route path="monitor" element={<Navigate to="/admin/agents" replace />} />
          <Route path="system" element={<Navigate to="/admin/settings" replace />} />
          <Route path="logs" element={<Navigate to="/admin/settings" replace />} />
          <Route path="campaigns" element={<Navigate to="/admin/settings" replace />} />
          <Route path="followups" element={<Navigate to="/admin/settings" replace />} />
          <Route path="costs" element={<Navigate to="/admin/settings" replace />} />
          <Route path="retention" element={<Navigate to="/admin/settings" replace />} />
          <Route path="phone-validation" element={<Navigate to="/admin/settings" replace />} />
          <Route path="agents/work-planner" element={<Navigate to="/admin/agents" replace />} />
          <Route path="agents/business-plan" element={<Navigate to="/admin/agents" replace />} />
          <Route path="agents/branding" element={<Navigate to="/admin/agents" replace />} />
          <Route path="agents/evolution" element={<Navigate to="/admin/agents" replace />} />
          <Route path="*" element={<Suspense fallback={<Spinner />}><AdminNotFound /></Suspense>} />
        </Route>

        {/* Closer routes (JWT-protected, closer role) */}
        <Route
          path="/closer"
          element={
            <CloserRoute>
              <Suspense fallback={<Spinner />}><CloserLayout /></Suspense>
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
