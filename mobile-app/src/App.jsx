import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AccountProvider } from './context/AccountContext.jsx';
import { initializeApi } from './services/api.js';
import AppShell from './components/AppShell.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import HomePage from './pages/HomePage.jsx';
import CriteriaPage from './pages/CriteriaPage.jsx';
import JournalPage from './pages/JournalPage.jsx';
import CreateEntryPage from './pages/CreateEntryPage.jsx';
import EntryDetailPage from './pages/EntryDetailPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import AccountGrowthPage from './pages/AccountGrowthPage.jsx';
import AccountJournalPage from './pages/AccountJournalPage.jsx';
import ExecutionReviewPage from './pages/ExecutionReviewPage.jsx';

const PublicOnlyRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Checking your session..." />;
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
};

const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Loading your workspace..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/criteria" element={<CriteriaPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/journal/new" element={<CreateEntryPage />} />
          <Route path="/journal/:entryId" element={<EntryDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/account-growth" element={<AccountGrowthPage />} />
          <Route path="/accounts/:accountId/journal" element={<AccountJournalPage />} />
          <Route path="/execution-review" element={<ExecutionReviewPage />} />
        </Route>
      </Route>

      <Route
        path="*"
        element={<Navigate to={user ? '/home' : '/login'} replace />}
      />
    </Routes>
  );
};

export default function App() {
  const [isApiReady, setIsApiReady] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        await initializeApi();
      } finally {
        setIsApiReady(true);
      }
    };

    run();
  }, []);

  if (!isApiReady) {
    return <LoadingScreen message="Initializing app..." />;
  }

  return (
    <AuthProvider>
      <AccountProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AppRoutes />
        </BrowserRouter>
      </AccountProvider>
    </AuthProvider>
  );
}
