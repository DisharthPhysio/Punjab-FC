import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { PlatformAuthProvider, usePlatformAuth } from "@/context/PlatformAuthContext";

// legacy (kept working at /legacy/* during the transition)
import CheckIn from "@/pages/CheckIn";
import CoachLogin from "@/pages/CoachLogin";
import CoachDashboard from "@/pages/CoachDashboard";

// new platform
import Landing from "@/pages/platform/Landing";
import ForgotPassword from "@/pages/platform/ForgotPassword";
import AccountRecovery from "@/pages/platform/AccountRecovery";
import { NavigationGuard } from "@/components/platform/NavigationGuard";
import { Button } from "@/components/ui/button";
import AthleteEntry from "@/pages/platform/athlete/AthleteEntry";
import AthleteAuth from "@/pages/platform/athlete/AthleteAuth";
import IndividualCheckIn from "@/pages/platform/athlete/IndividualCheckIn";
import JoinTeam from "@/pages/platform/athlete/JoinTeam";
import TeamHub from "@/pages/platform/athlete/TeamHub";
import TeamLanding from "@/pages/platform/team/TeamLanding";
import TeamRegister from "@/pages/platform/team/TeamRegister";
import RosterSetup from "@/pages/platform/team/RosterSetup";
import TeamHome from "@/pages/platform/team/TeamHome";
import AdminAuth from "@/pages/platform/team/AdminAuth";
import LinkTeamCode from "@/pages/platform/team/LinkTeamCode";
import PlayerDetail from "@/pages/platform/team/PlayerDetail";
import GpsData from "@/pages/platform/team/GpsData";
import TeamCalendar from "@/pages/platform/team/TeamCalendar";
import SuperAdminLogin from "@/pages/platform/superadmin/SuperAdminLogin";
import SuperAdminPanel from "@/pages/platform/superadmin/SuperAdminPanel";
import Privacy from "@/pages/Privacy";

function Spinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/** The server could not be reached (asleep, offline). The saved login is kept: just offer a retry. */
function ConnectionRetry() {
  const { t } = useTranslation();
  const { refresh } = usePlatformAuth();
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="max-w-xs space-y-4">
        <p className="text-lg font-bold">{t("connection.title")}</p>
        <p className="text-sm text-muted-foreground">{t("connection.desc")}</p>
        <Button onClick={refresh} data-testid="connection-retry">{t("connection.retry")}</Button>
      </div>
    </div>
  );
}

/** Accounts made before recovery questions existed are asked ONCE after login, then never again. */
function RecoveryGate({ children }) {
  const { hasRecovery } = usePlatformAuth();
  const { pathname } = useLocation();
  if (!hasRecovery && pathname !== "/account/recovery") return <Navigate to="/account/recovery" replace />;
  return children;
}

function LegacyProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) return <Spinner />;
  if (!user) return <Navigate to="/legacy/coach" replace />;
  return children;
}

function AthleteRoute({ children }) {
  const { role, user, loading, connectionError } = usePlatformAuth();
  if (loading || user === null) return <Spinner />;
  if (connectionError && localStorage.getItem("pfc_token")) return <ConnectionRetry />;
  if (!user || role !== "athlete") return <Navigate to="/athlete/individual" replace />;
  return <RecoveryGate>{children}</RecoveryGate>;
}

function TeamAthleteRoute({ children }) {
  const { role, user, loading, connectionError } = usePlatformAuth();
  if (loading || user === null) return <Spinner />;
  if (connectionError && localStorage.getItem("pfc_token")) return <ConnectionRetry />;
  if (!user || role !== "team_athlete") return <Navigate to="/athlete/join-team" replace />;
  return children;
}

function AdminRoute({ children, requireTeam = false }) {
  const { role, user, teams, loading, connectionError } = usePlatformAuth();
  if (loading || user === null) return <Spinner />;
  if (connectionError && localStorage.getItem("pfc_token")) return <ConnectionRetry />;
  if (!user || role !== "admin") return <Navigate to="/team/admin-auth" replace />;
  if (requireTeam && (!teams || teams.length === 0)) return <Navigate to="/team/link-code" replace />;
  return <RecoveryGate>{children}</RecoveryGate>;
}

/** The one-time recovery-question screen: any logged-in athlete or coach. */
function AccountRoute({ children }) {
  const { role, user, loading, connectionError } = usePlatformAuth();
  if (loading || user === null) return <Spinner />;
  if (connectionError && localStorage.getItem("pfc_token")) return <ConnectionRetry />;
  if (!user || !["athlete", "admin"].includes(role)) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <PlatformAuthProvider>
          <BrowserRouter>
            <NavigationGuard />
            <Routes>
              {/* ---- new platform (root) ---- */}
              <Route path="/" element={<Landing />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<Navigate to="/forgot-password" replace />} />
              <Route path="/account/recovery" element={<AccountRoute><AccountRecovery /></AccountRoute>} />

              <Route path="/athlete" element={<AthleteEntry />} />
              <Route path="/athlete/individual" element={<AthleteAuth />} />
              <Route path="/athlete/checkin" element={<AthleteRoute><IndividualCheckIn /></AthleteRoute>} />
              <Route path="/athlete/join-team" element={<JoinTeam />} />
              <Route path="/athlete/team" element={<TeamAthleteRoute><TeamHub /></TeamAthleteRoute>} />

              <Route path="/team" element={<TeamLanding />} />
              <Route path="/team/register" element={<TeamRegister />} />
              <Route path="/team/admin-auth" element={<AdminAuth />} />
              <Route path="/team/link-code" element={<AdminRoute><LinkTeamCode /></AdminRoute>} />
              <Route path="/team/roster-setup" element={<AdminRoute requireTeam><RosterSetup /></AdminRoute>} />
              <Route path="/team/home" element={<AdminRoute requireTeam><TeamHome /></AdminRoute>} />
              <Route path="/team/player/:playerId" element={<AdminRoute requireTeam><PlayerDetail /></AdminRoute>} />
              <Route path="/team/gps" element={<AdminRoute requireTeam><GpsData /></AdminRoute>} />
              <Route path="/team/calendar" element={<AdminRoute requireTeam><TeamCalendar /></AdminRoute>} />

              {/* ---- hidden site-admin panel: reached only via the long-press on Landing ---- */}
              <Route path="/superadmin/login" element={<SuperAdminLogin />} />
              <Route path="/superadmin/panel" element={<SuperAdminPanel />} />

              {/* ---- legacy single-team flow, kept alive during the transition ---- */}
              <Route path="/privacy" element={<Privacy />} />

              <Route path="/legacy" element={<CheckIn />} />
              <Route path="/legacy/coach" element={<CoachLogin />} />
              <Route
                path="/legacy/coach/dashboard"
                element={<LegacyProtectedRoute><CoachDashboard /></LegacyProtectedRoute>}
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-center" richColors />
        </PlatformAuthProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
