import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import GlobePage from './pages/GlobePage';
import GISMapPage from './pages/GISMapPage';
import AiQuickTestPage from './pages/AiQuickTestPage';
import SurveysPage from './pages/SurveysPage';
import SurveyDetailPage from './pages/SurveyDetailPage';
import SonarFramePage from './pages/SonarFramePage';
import AnomalyReviewPage from './pages/AnomalyReviewPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ReportsPage from './pages/ReportsPage';
import NotificationsPage from './pages/NotificationsPage';
import AIModelsPage from './pages/AIModelsPage';
import DatasetsPage from './pages/DatasetsPage';
import DatasetDetailPage from './pages/DatasetDetailPage';
import TrainingPage from './pages/TrainingPage';
import TrainingJobDetailPage from './pages/TrainingJobDetailPage';
import UsersPage from './pages/UsersPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SystemHealthPage from './pages/SystemHealthPage';
import MailAutomationPage from './pages/MailAutomationPage';
import FridayPage from './pages/FridayPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/globe" element={<GlobePage />} />
          <Route path="/map" element={<GISMapPage />} />
          <Route path="/surveys" element={<SurveysPage />} />
          <Route path="/surveys/:id" element={<SurveyDetailPage />} />
          <Route path="/sonar/:id" element={<SonarFramePage />} />
          <Route path="/ai-test" element={<AiQuickTestPage />} />

          <Route path="/anomaly-review" element={<AnomalyReviewPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/friday" element={<FridayPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Admin-only pages. Backend enforces role permissions on every
              underlying endpoint regardless of frontend routing. */}
          <Route path="/models" element={<AIModelsPage />} />
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/datasets/:id" element={<DatasetDetailPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/training/:id" element={<TrainingJobDetailPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="/system-health" element={<SystemHealthPage />} />
          <Route path="/mail-automation" element={<MailAutomationPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
