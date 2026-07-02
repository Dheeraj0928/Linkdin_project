import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import ConnectionsPage from './pages/ConnectionsPage';
import ActivityPage from './pages/ActivityPage';
import RunsPage from './pages/RunsPage';
import DraftsPage from './pages/DraftsPage';
import LogsPage from './pages/LogsPage';
import TemplatesPage from './pages/TemplatesPage';
import ConfigurationPage from './pages/ConfigurationPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ConnectRequestsPage from './pages/ConnectRequestsPage';
import AccountsPage from './pages/AccountsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/drafts" element={<DraftsPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/configuration" element={<ConfigurationPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/connect" element={<ConnectRequestsPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
