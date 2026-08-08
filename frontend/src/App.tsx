import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuthStore } from './stores/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import SplashScreen, { isStandaloneApp } from './components/SplashScreen';
const Layout = lazy(() => import('./components/layout/Layout'));
// Portail client V2 « instrument » (DA/v2-direction.md, addendum produit)
const ClientLayout = lazy(() => import('./components/layout/ClientLayout'));
const CloserLayout = lazy(() => import('./components/layout/CloserLayout'));
import ComingSoon from './components/client/ComingSoon';
// Eager-loaded entry points (Login, Register, ConfirmEmail), accès clients V2
import Login from './pages/v2/auth/Login';
import Register from './pages/v2/auth/Register';
import ForgotPassword from './pages/v2/auth/ForgotPassword';
import ResetPassword from './pages/v2/auth/ResetPassword';
import ConfirmEmail from './pages/v2/auth/ConfirmEmail';
// Marketing V2 « Papier & Signal » (DA/v2-direction.md). Les pages V1
// restent dans pages/ pour rollback, seules les routes pointent vers v2/.
const Landing = lazy(() => import('./pages/v2/Receptionist'));
const Home = lazy(() => import('./pages/v2/Home'));
// Admin pages (lazy loaded)
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
const Subscribe = lazy(() => import('./pages/v2/auth/Subscribe'));
const VerifyEmail = lazy(() => import('./pages/v2/auth/VerifyEmail'));
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
// (no backend), their routes render a ComingSoon notice instead of the mock UI.
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
const CrmDeals = lazy(() => import('./pages/client/CrmDeals'));
const CrmActivities = lazy(() => import('./pages/client/CrmActivities'));
const CrmContactDetail = lazy(() => import('./pages/client/CrmContactDetail'));
const Integrations = lazy(() => import('./pages/client/Integrations'));
// Legal pages (lazy loaded)
const Privacy = lazy(() => import('./pages/v2/legal/Privacy'));
const Terms = lazy(() => import('./pages/v2/legal/Terms'));
const About = lazy(() => import('./pages/v2/About'));
const Contact = lazy(() => import('./pages/v2/Contact'));
const Gdpr = lazy(() => import('./pages/v2/legal/Gdpr'));
const Sla = lazy(() => import('./pages/v2/legal/Sla'));
// Public pages (lazy loaded)
const AgentPage = lazy(() => import('./pages/v2/Agent'));
const PricingPage = lazy(() => import('./pages/v2/Pricing'));
const BlogPage = lazy(() => import('./pages/v2/Blog'));
const BlogArticlePage = lazy(() => import('./pages/v2/BlogArticle'));
const ComparisonPage = lazy(() => import('./pages/v2/ComparisonPage'));
const AffiliatePage = lazy(() => import('./pages/v2/Affiliate'));
const AffiliateDashboardPage = lazy(() => import('./pages/v2/AffiliateDashboard'));
const Partenaires = lazy(() => import('./pages/v2/Partenaires'));
const Vertical = lazy(() => import('./pages/v2/Vertical'));
const Faq = lazy(() => import('./pages/v2/Faq'));
const City = lazy(() => import('./pages/v2/City'));

function VerticalWrap({ secteur }: { secteur: string }) {
  return <Vertical secteur={secteur} />;
}

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
// back / forward / route change, we manage scroll ourselves below.
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
  // No visible loader on arrival/refresh, just the dark surface, seamless into content.
  return <div style={{ minHeight: '100dvh', background: '#0a0a0a' }} aria-hidden="true" />;
}

function PublicSpinner() {
  // Marketing V2 loads on the cream canvas: a dark flash here would break the
  // register, so the fallback matches --q2-canvas.
  return <div style={{ minHeight: '100dvh', background: '#fdfcfc' }} aria-hidden="true" />;
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
  if (!user.onboardingCompleted) return <Navigate to={signupStep(user)} />;
  if (user.role !== 'admin') return <Navigate to={homeRoute(user)} />;
  return <>{children}</>;
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  // No `?payment=success` escape hatch: it used to wave anyone through on a
  // query string alone. Sign-up now returns to /onboard, and customers upgrading
  // a plan already carry `onboardingCompleted`, so nothing needs the bypass.
  if (!user.onboardingCompleted) return <Navigate to={signupStep(user)} />;
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

/**
 * Where an account that has not finished signing up belongs.
 *
 * Three gates, in order: a confirmed address, a card on file, then the
 * receptionist config. Existing customers carry `onboardingCompleted` already,
 * so they never enter this function and are never asked for a card they were
 * not asked for when they signed up.
 */
function signupStep(user: { emailConfirmed?: boolean; hasSubscription?: boolean }) {
  if (!user.emailConfirmed) return '/verify-email';
  if (!user.hasSubscription) return '/subscribe';
  return '/onboard';
}

function OnboardRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  if (user.onboardingCompleted) return <Navigate to={homeRoute(user)} />;
  const step = signupStep(user);
  if (step !== '/onboard') return <Navigate to={step} />;
  return <>{children}</>;
}

function SubscribeRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  if (user.onboardingCompleted) return <Navigate to={homeRoute(user)} />;
  const step = signupStep(user);
  if (step !== '/subscribe') return <Navigate to={step} />;
  return <>{children}</>;
}

function VerifyEmailRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  if (user.onboardingCompleted) return <Navigate to={homeRoute(user)} />;
  if (user.emailConfirmed) return <Navigate to={signupStep(user)} />;
  return <>{children}</>;
}

function PublicOrDashboard() {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <Spinner />;
  if (user) {
    if (!user.onboardingCompleted) return <Navigate to={signupStep(user)} />;
    return <Navigate to={homeRoute(user)} />;
  }
  // Launched from the home screen, someone has already chosen Qwillio: send
  // them to sign-in rather than to the marketing page they installed from.
  if (isStandaloneApp()) return <Navigate to="/login" replace />;
  return <Suspense fallback={<Spinner />}><Home /></Suspense>;
}

/**
 * sessionStorage throws outright when storage is disabled or the app runs in a
 * restricted webview. The read below happens during App's own render, before
 * the ErrorBoundary can mount, so an unguarded access takes the whole app down.
 */
function safeSessionGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function safeSessionSet(key: string, value: string): void {
  try { sessionStorage.setItem(key, value); } catch { /* splash replays next launch, harmless */ }
}

export default function App() {
  const { checkAuth } = useAuthStore();
  // The launch animation belongs to the installed app, and to one launch only:
  // it must not replay on client-side navigation within the session.
  const [splashDone, setSplashDone] = useState(
    () => !isStandaloneApp() || safeSessionGet('qw.splashShown') === '1',
  );

  useEffect(() => {
    checkAuth();
  }, []);

  /**
   * The dashboard loads under the animation rather than after it, so the fade
   * ends on a populated screen whose chart has numbers to animate. Started once
   * and only for a signed-in client — the launch screen is the only moment in
   * the app where a second of loading is already budgeted for.
   */
  const boot = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    try { if (!localStorage.getItem('token')) return undefined; } catch { return undefined; }
    return import('./services/appBoot').then(m => m.bootClientApp()).catch(() => undefined);
  }, []);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <ErrorBoundary>
      {!splashDone && (
        <SplashScreen
          waitFor={boot}
          onDone={() => {
            safeSessionSet('qw.splashShown', '1');
            setSplashDone(true);
          }}
        />
      )}
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
        <Route path="/privacy" element={<Suspense fallback={<PublicSpinner />}><Privacy /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<PublicSpinner />}><Terms /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={<PublicSpinner />}><About /></Suspense>} />
        <Route path="/contact" element={<Suspense fallback={<PublicSpinner />}><Contact /></Suspense>} />
        <Route path="/gdpr" element={<Suspense fallback={<PublicSpinner />}><Gdpr /></Suspense>} />
        <Route path="/sla" element={<Suspense fallback={<PublicSpinner />}><Sla /></Suspense>} />
        {/* French route aliases for legal pages */}
        <Route path="/fr/privacy" element={<Suspense fallback={<PublicSpinner />}><Privacy /></Suspense>} />
        <Route path="/fr/terms" element={<Suspense fallback={<PublicSpinner />}><Terms /></Suspense>} />
        <Route path="/fr/gdpr" element={<Suspense fallback={<PublicSpinner />}><Gdpr /></Suspense>} />
        <Route path="/fr/sla" element={<Suspense fallback={<PublicSpinner />}><Sla /></Suspense>} />
        <Route path="/fr/about" element={<Suspense fallback={<PublicSpinner />}><About /></Suspense>} />
        <Route path="/fr/contact" element={<Suspense fallback={<PublicSpinner />}><Contact /></Suspense>} />
        <Route path="/receptionist" element={<Suspense fallback={<PublicSpinner />}><Landing /></Suspense>} />
        {/* Qwillio Agent, page marketing V2 réactivée */}
        {/* Qwillio Agent n'est pas ouvert au public (décision utilisateur): la
            page existe dans le dépôt mais n'est plus routée, et le menu se
            contente d'annoncer « bientôt ». Une URL devinée retombe sur
            l'accueil plutôt que sur une page qui promettrait un produit
            achetable. */}
        <Route path="/agent" element={<Navigate to="/" replace />} />
        <Route path="/pricing" element={<Suspense fallback={<PublicSpinner />}><PricingPage /></Suspense>} />
        <Route path="/blog" element={<Suspense fallback={<PublicSpinner />}><BlogPage /></Suspense>} />
        <Route path="/blog/:slug" element={<Suspense fallback={<PublicSpinner />}><BlogArticlePage /></Suspense>} />
        <Route path="/vs/:slug" element={<Suspense fallback={<PublicSpinner />}><ComparisonPage /></Suspense>} />
        <Route path="/affiliate" element={<Suspense fallback={<PublicSpinner />}><AffiliatePage /></Suspense>} />
        <Route path="/affiliate/dashboard" element={<Suspense fallback={<PublicSpinner />}><AffiliateDashboardPage /></Suspense>} />
        <Route path="/faq" element={<Suspense fallback={<PublicSpinner />}><Faq /></Suspense>} />
        <Route path="/fr/faq" element={<Suspense fallback={<PublicSpinner />}><Faq /></Suspense>} />
        <Route path="/ville/:ville" element={<Suspense fallback={<PublicSpinner />}><City /></Suspense>} />
        <Route path="/fr/ville/:ville" element={<Suspense fallback={<PublicSpinner />}><City /></Suspense>} />
        <Route path="/partenaires-fiduciaires" element={<Suspense fallback={<PublicSpinner />}><Partenaires /></Suspense>} />
        <Route path="/fr/partenaires-fiduciaires" element={<Suspense fallback={<PublicSpinner />}><Partenaires /></Suspense>} />
        <Route path="/partenaires" element={<Navigate to="/partenaires-fiduciaires" replace />} />
        <Route path="/plombier" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="plombier" /></Suspense>} />
        <Route path="/dentiste" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="dentiste" /></Suspense>} />
        <Route path="/notaire" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="notaire" /></Suspense>} />
        <Route path="/garagiste" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="garagiste" /></Suspense>} />
        <Route path="/kine" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="kine" /></Suspense>} />
        <Route path="/avocat" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="avocat" /></Suspense>} />
        <Route path="/restaurant" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="restaurant" /></Suspense>} />
        <Route path="/immobilier" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="immobilier" /></Suspense>} />
        <Route path="/coiffeur" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="coiffeur" /></Suspense>} />
        <Route path="/fiduciaire" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="fiduciaire" /></Suspense>} />
        <Route path="/fr/plombier" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="plombier" /></Suspense>} />
        <Route path="/fr/dentiste" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="dentiste" /></Suspense>} />
        <Route path="/fr/notaire" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="notaire" /></Suspense>} />
        <Route path="/fr/garagiste" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="garagiste" /></Suspense>} />
        <Route path="/fr/kine" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="kine" /></Suspense>} />
        <Route path="/fr/avocat" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="avocat" /></Suspense>} />
        <Route path="/fr/restaurant" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="restaurant" /></Suspense>} />
        <Route path="/fr/immobilier" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="immobilier" /></Suspense>} />
        <Route path="/fr/coiffeur" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="coiffeur" /></Suspense>} />
        <Route path="/fr/fiduciaire" element={<Suspense fallback={<PublicSpinner />}><VerticalWrap secteur="fiduciaire" /></Suspense>} />

        {/* Sign-up funnel, in order: confirm the address, register a card, then
            configure the receptionist. Each guard sends the account to whichever
            of the three it still owes. */}
        <Route
          path="/verify-email"
          element={
            <VerifyEmailRoute>
              <Suspense fallback={<Spinner />}><VerifyEmail /></Suspense>
            </VerifyEmailRoute>
          }
        />
        <Route
          path="/subscribe"
          element={
            <SubscribeRoute>
              <Suspense fallback={<Spinner />}><Subscribe /></Suspense>
            </SubscribeRoute>
          }
        />
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
          {/* Agent IA — fermé. Les modules ne sont pas accessibles, y compris
              par URL directe: tant qu'ils ne sont pas ouverts, y accéder
              donnerait des écrans à moitié branchés. */}
          <Route path="agent/*" element={<Navigate to="/dashboard" replace />} />

          {/* CRM */}
          {/* Contacts et Leads ont fusionné: la liste unique vit sur Leads,
              qui rapatrie les fiches CRM. L'ancienne adresse redirige plutôt
              que de disparaître, elle est dans des favoris et des liens. */}
          <Route path="crm" element={<Navigate to="/dashboard/leads" replace />} />
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
