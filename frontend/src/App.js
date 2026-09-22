import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { PlatformAuthProvider, usePlatformAuth } from "@/context/PlatformAuthContext";

// legacy (kept working at /legacy/* during the Phase 1->4 transition)
import CheckIn from "@/pages/CheckIn";
import CoachLogin from "@/pages/CoachLogin";
import CoachDashboard from "@/pages/CoachDashboard";

// new platform
import Landing from "@/pages/platform/Landing";
import VerifyCode from "@/pages/platform/VerifyCode";
import ForgotPassword from "@/pages/platform/ForgotPassword";
import ResetPassword from "@/pages/platform/ResetPassword";
import AthleteAuth from "@/pages/platform/athlete/AthleteAuth";
import ModeChoice from "@/pages/platform/athlete/ModeChoice";
import IndividualCheckIn from "@/pages/platform/athlete/IndividualCheckIn";
import JoinTeam from "@/pages/platform/athlete/JoinTeam";
import TeamHub from "@/pages/platform/athlete/TeamHub";
import TeamLanding from "@/pages/platform/team/TeamLanding";
import TeamRegister from "@/pages/platform/team/TeamRegister";
import RosterSetup from "@/pages/platform/team/RosterSetup";
import TeamHome from "@/pages/platform/team/TeamHome";
import AdminAuth from "@/pages/platform/team/AdminAuth";
import LinkTeamCode from "@/pages/platform/team/LinkTeamCode";

function Spinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function LegacyProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) return <Spinner />;
  if (!user) return <Navigate to="/legacy/coach" replace />;
  return children;
}

function AthleteRoute({ children }) {
  const { role, user, loading } = usePlatformAuth();
  if (loading || user === null) return <Spinner />;
  if (!user || role !== "athlete") return <Navigate to="/athlete/auth" replace />;
  return children;
}

function AdminRoute({ children, requireTeam = false }) {
  const { role, user, teams, loading } = usePlatformAuth();
  if (loading || user === null) return <Spinner />;
  if (!user || role !== "admin") return <Navigate to="/team/admin-auth" replace />;
  if (requireTeam && (!teams || teams.length === 0)) return <Navigate to="/team/link-code" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <PlatformAuthProvider>
          <BrowserRouter>
            <Routes>
              {/* ---- new platform (root) ---- */}
              <Route path="/" element={<Landing />} />
              <Route path="/verify" element={<VerifyCode />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route path="/athlete/auth" element={<AthleteAuth />} />
              <Route path="/athlete/mode" element={<AthleteRoute><ModeChoice /></AthleteRoute>} />
              <Route path="/athlete/checkin" element={<AthleteRoute><IndividualCheckIn /></AthleteRoute>} />
              <Route path="/athlete/join-team" element={<AthleteRoute><JoinTeam /></AthleteRoute>} />
              <Route path="/athlete/team/:teamId" element={<AthleteRoute><TeamHub /></AthleteRoute>} />

              <Route path="/team" element={<TeamLanding />} />
              <Route path="/team/register" element={<TeamRegister />} />
              <Route path="/team/admin-auth" element={<AdminAuth />} />
              <Route path="/team/link-code" element={<AdminRoute><LinkTeamCode /></AdminRoute>} />
              <Route path="/team/roster-setup" element={<AdminRoute requireTeam><RosterSetup /></AdminRoute>} />
              <Route path="/team/home" element={<AdminRoute requireTeam><TeamHome /></AdminRoute>} />

              {/* ---- legacy single-team flow, kept alive during the transition ---- */}
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
