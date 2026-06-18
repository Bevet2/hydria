import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { CompaniesPage } from "./pages/CompaniesPage";
import { ContactsPage } from "./pages/ContactsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AcceptInvitationPage } from "./pages/AcceptInvitationPage";
import { LoginPage } from "./pages/LoginPage";
import { LeadsPage } from "./pages/LeadsPage";
import { PipelinePage } from "./pages/PipelinePage";
import { ProductsPage } from "./pages/ProductsPage";
import { RecordDetailPage } from "./pages/RecordDetailPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TasksPage } from "./pages/TasksPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { PlatformPage } from "./pages/PlatformPage";
import { SignQuotePage } from "./pages/SignQuotePage";
import { OAuthCallbackPage } from "./pages/OAuthCallbackPage";
import { SalesOpsPage } from "./pages/SalesOpsPage";
import { TicketsPage } from "./pages/TicketsPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { CustomerPortalPage } from "./pages/CustomerPortalPage";
import { CustomObjectsPage } from "./pages/CustomObjectsPage";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loader">Loading Hydria CRM...</div>;
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/sign-quote" element={<SignQuotePage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="/support/:portalToken" element={<CustomerPortalPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:id" element={<RecordDetailPage kind="lead" />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/contacts/:id" element={<RecordDetailPage kind="contact" />} />
        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/companies/:id" element={<RecordDetailPage kind="company" />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/deals/:id" element={<RecordDetailPage kind="deal" />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
        <Route path="/custom-objects" element={<CustomObjectsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/sales-ops" element={<SalesOpsPage />} />
        <Route path="/communications" element={<CommunicationsPage />} />
        <Route path="/platform" element={<PlatformPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
