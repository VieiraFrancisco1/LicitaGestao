import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { BidDetailsPage } from './pages/BidDetailsPage';
import { BidFormPage } from './pages/BidFormPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyDetailsPage } from './pages/CompanyDetailsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PlatformsPage } from './pages/PlatformsPage';
import { UsersPage } from './pages/UsersPage';
import { TendersPage } from './pages/TendersPage';
import { TenderDetailsPage } from './pages/TenderDetailsPage';
import { ParticipationFormPage } from './pages/ParticipationFormPage';
import { DeadlinesPage } from './pages/DeadlinesPage';
import { AuditPage } from './pages/AuditPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ConvocationsPage } from './pages/ConvocationsPage';
import { BackupsPage } from './pages/BackupsPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { SettingsPage } from './pages/SettingsPage';
import { ReportsPage } from './pages/ReportsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="licitacoes" element={<TendersPage />} />
              <Route path="licitacoes/nova" element={<BidFormPage />} />
              <Route path="licitacoes/:id" element={<TenderDetailsPage />} />
              <Route path="licitacoes/:id/editar" element={<BidFormPage />} />
              <Route path="participacoes/:id" element={<BidDetailsPage />} />
              <Route path="participacoes/:id/editar" element={<ParticipationFormPage />} />
              <Route path="empresas" element={<ProtectedRoute roles={['ADMIN', 'FUNCIONARIO']} />}>
                <Route index element={<CompaniesPage />} />
              </Route>
              <Route path="empresas/:id" element={<CompanyDetailsPage />} />
              <Route path="convocacoes" element={<ConvocationsPage />} />
              <Route path="prazos" element={<DeadlinesPage />} />
              <Route path="documentos" element={<DocumentsPage />} />
              <Route path="plataformas" element={<PlatformsPage />} />
              <Route path="usuarios" element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route index element={<UsersPage />} />
              </Route>
              <Route path="auditoria" element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route index element={<AuditPage />} />
              </Route>
              <Route path="backups" element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route index element={<BackupsPage />} />
              </Route>
              <Route path="saude-sistema" element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route index element={<SystemHealthPage />} />
              </Route>
              <Route path="relatorios" element={<ReportsPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
