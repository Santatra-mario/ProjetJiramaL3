import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

// =========================================================
// AUTHENTIFICATION
// =========================================================

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

// =========================================================
// ADMINISTRATEUR
// =========================================================

import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import UsersPage from './pages/admin/UsersPage.jsx';
import AbonnesPage from './pages/admin/AbonnesPage.jsx';
import CompteursPage from './pages/admin/CompteursPage.jsx';
import RelevesPage from './pages/admin/RelevesPage.jsx';
import AnomaliesPage from './pages/admin/AnomaliesPage.jsx';
import ComparaisonPage from './pages/admin/ComparaisonPage.jsx';
import NotificationsPage from './pages/admin/NotificationsPage.jsx';
import NotificationsArchivesPage from './pages/shared/NotificationsArchivesPage.jsx';

// =========================================================
// AGENT
// =========================================================

import AgentDashboard from './pages/agent/AgentDashboard.jsx';
import AgentCompteursPage from './pages/agent/AgentCompteursPage.jsx';
import AgentAbonnesPage from './pages/agent/AgentAbonnesPage.jsx';
import AgentRelevesPage from './pages/agent/AgentRelevesPage.jsx';
import AgentAnomaliesPage from './pages/agent/AgentAnomaliesPage.jsx';
import AgentNotificationsPage from './pages/agent/AgentNotificationsPage.jsx';

// =========================================================
// RESPONSABLE
// =========================================================

import ResponsableDashboard from './pages/responsable/ResponsableDashboard.jsx';
import ResponsableAnomaliesPage from './pages/responsable/ResponsableAnomaliesPage.jsx';
import ResponsableNotificationsPage from './pages/responsable/ResponsableNotificationsPage.jsx';

// =========================================================
// PROTECTION DES ROUTES
// =========================================================

function ProtectedRoute({
  children,
  role,
}) {
  const token = localStorage.getItem('token');
  const userData = localStorage.getItem('user');

  // -------------------------------------------------------
  // Vérification connexion
  // -------------------------------------------------------

  if (!token || !userData) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  // -------------------------------------------------------
  // Lecture utilisateur
  // -------------------------------------------------------

  let user;

  try {
    user = JSON.parse(userData);
  } catch (error) {
    console.error(
      'Erreur lecture utilisateur :',
      error
    );

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  // -------------------------------------------------------
  // Rôle utilisateur
  // -------------------------------------------------------

  const userRole = String(
    user?.role || ''
  )
    .trim()
    .toUpperCase();

  const requiredRole = role
    ? String(role)
        .trim()
        .toUpperCase()
    : null;

  // -------------------------------------------------------
  // Vérification du rôle
  // -------------------------------------------------------

  if (
    requiredRole &&
    userRole !== requiredRole
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}

// =========================================================
// MODULE ADMIN TEMPORAIRE
// =========================================================

function AdminSection({
  title,
}) {
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          {title}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Cette fonctionnalité sera développée dans le prochain module.
        </p>

        <button
          type="button"
          onClick={() => {
            window.location.href =
              '/dashboard/admin';
          }}
          className="
            mt-6
            rounded-xl
            bg-blue-600
            px-5
            py-3
            text-sm
            font-semibold
            text-white
            hover:bg-blue-700
          "
        >
          Retour au dashboard
        </button>
      </div>
    </div>
  );
}

// =========================================================
// APPLICATION
// =========================================================

function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* =================================================
            AUTHENTIFICATION
        ================================================= */}

        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        {/* =================================================
            ADMINISTRATEUR
        ================================================= */}

        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute role="ADMINISTRATEUR">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/utilisateurs"
          element={
            <ProtectedRoute role="ADMINISTRATEUR">
              <UsersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/abonnes"
          element={
            <ProtectedRoute role="ADMINISTRATEUR">
              <AbonnesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/compteurs"
          element={
            <ProtectedRoute role="ADMINISTRATEUR">
              <CompteursPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/releves"
          element={
            <ProtectedRoute role="ADMINISTRATEUR">
              <RelevesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/anomalies"
          element={
            <ProtectedRoute role="ADMINISTRATEUR">
              <AnomaliesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/comparaison"
          element={
            <ProtectedRoute role="ADMINISTRATEUR">
              <ComparaisonPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/notifications"
          element={
            <ProtectedRoute role="ADMINISTRATEUR">
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/statistiques"
          element={
            <Navigate
              to="/dashboard/admin"
              replace
            />
          }
        />

        <Route
          path="/dashboard/admin/graphiques"
          element={
            <Navigate
              to="/dashboard/admin"
              replace
            />
          }
        />

        <Route
          path="/dashboard/admin/parametres"
          element={
            <ProtectedRoute role="ADMINISTRATEUR">
              <NotificationsArchivesPage role="ADMINISTRATEUR" />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            AGENT
        ================================================= */}

        <Route
          path="/dashboard/agent"
          element={
            <ProtectedRoute role="AGENT">
              <AgentDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/agent/compteurs"
          element={
            <ProtectedRoute role="AGENT">
              <AgentCompteursPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/agent/abonnes"
          element={
            <ProtectedRoute role="AGENT">
              <AgentAbonnesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/agent/releves"
          element={
            <ProtectedRoute role="AGENT">
              <AgentRelevesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/agent/anomalies"
          element={
            <ProtectedRoute role="AGENT">
              <AgentAnomaliesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/agent/notifications"
          element={
            <ProtectedRoute role="AGENT">
              <AgentNotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/agent/parametres"
          element={
            <ProtectedRoute role="AGENT">
              <NotificationsArchivesPage role="AGENT" />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            RESPONSABLE
        ================================================= */}

        <Route
          path="/dashboard/responsable"
          element={
            <ProtectedRoute role="RESPONSABLE">
              <ResponsableDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/responsable/anomalies"
          element={
            <ProtectedRoute role="RESPONSABLE">
              <ResponsableAnomaliesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/responsable/notifications"
          element={
            <ProtectedRoute role="RESPONSABLE">
              <ResponsableNotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/responsable/parametres"
          element={
            <ProtectedRoute role="RESPONSABLE">
              <NotificationsArchivesPage role="RESPONSABLE" />
            </ProtectedRoute>
          }
        />

        {/* =================================================
            ROUTE INCONNUE
        ================================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;