import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { CompaniesPage } from "./pages/CompaniesPage";
import { ContactsPage } from "./pages/ContactsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { LeadsPage } from "./pages/LeadsPage";
import { PipelinePage } from "./pages/PipelinePage";
import { ProductsPage } from "./pages/ProductsPage";
import { RecordDetailPage } from "./pages/RecordDetailPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TasksPage } from "./pages/TasksPage";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loader">Loading Northstar CRM...</div>;
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
