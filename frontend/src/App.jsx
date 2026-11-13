import { Suspense, lazy } from 'react';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import JiramaLoading from './components/ui/JiramaLoading.jsx';
import RouteTransitionLoader from './components/ui/RouteTransitionLoader.jsx';

// =========================================================
// AUTHENTIFICATION
// =========================================================

const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));

// =========================================================
// ADMINISTRATEUR
// =========================================================

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage.jsx'));
const AbonnesPage = lazy(() => import('./pages/admin/AbonnesPage.jsx'));
const CompteursPage = lazy(() => import('./pages/admin/CompteursPage.jsx'));
const RelevesPage = lazy(() => import('./pages/admin/RelevesPage.jsx'));
const AnomaliesPage = lazy(() => import('./pages/admin/AnomaliesPage.jsx'));
const ComparaisonPage = lazy(() => import('./pages/admin/ComparaisonPage.jsx'));
const NotificationsPage = lazy(() => import('./pages/admin/NotificationsPage.jsx'));

// =========================================================
// AGENT
// =========================================================

const AgentDashboard = lazy(() => import('./pages/agent/AgentDashboard.jsx'));
const AgentCompteursPage = lazy(() => import('./pages/agent/AgentCompteursPage.jsx'));
const AgentAbonnesPage = lazy(() => import('./pages/agent/AgentAbonnesPage.jsx'));
const AgentRelevesPage = lazy(() => import('./pages/agent/AgentRelevesPage.jsx'));
const AgentMissionsPage = lazy(() => import('./pages/agent/AgentMissionsPage.jsx'));
const AgentAnomaliesPage = lazy(() => import('./pages/agent/AgentAnomaliesPage.jsx'));
const AgentNotificationsPage = lazy(
  () => import('./pages/agent/AgentNotificationsPage.jsx')
);

// =========================================================
// RESPONSABLE
// =========================================================

const ResponsableDashboard = lazy(
  () => import('./pages/responsable/ResponsableDashboard.jsx')
);
const ResponsableAnomaliesPage = lazy(
  () => import('./pages/responsable/ResponsableAnomaliesPage.jsx')
);
const ResponsableNotificationsPage = lazy(
  () => import('./pages/responsable/ResponsableNotificationsPage.jsx')
);
const ResponsableControlesPage = lazy(
  () => import('./pages/responsable/ResponsableControlesPage.jsx')
);
const SettingsPage = lazy(() => import('./pages/shared/SettingsPage.jsx'));

// =========================================================
// PROTECTION DES ROUTES
// =========================================================

function ProtectedRoute({ children, role }) {
  const token = localStorage.getItem('token');
  const userData = localStorage.getItem('user');

  // -------------------------------------------------------
  // Vérification connexion
  // -------------------------------------------------------

  if (!token || !userData) {
    return <Navigate to="/" replace />;
  }

  // -------------------------------------------------------
  // Lecture utilisateur
  // -------------------------------------------------------

  let user;

  try {
    user = JSON.parse(userData);
  } catch (error) {
    console.error('Erreur lecture utilisateur :', error);

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    return <Navigate to="/" replace />;
  }

  // -------------------------------------------------------
  // Rôle utilisateur
  // -------------------------------------------------------

  const userRole = String(user?.role || '')
    .trim()
    .toUpperCase();

  const requiredRole = role ? String(role).trim().toUpperCase() : null;

  // -------------------------------------------------------
  // Vérification du rôle
  // -------------------------------------------------------

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// =========================================================
// CHARGEMENT D'UNE PAGE
// Pendant le téléchargement du code d'une route, l'écran de
// chargement JIRAMA (logo) est affiché en plein écran.
// =========================================================

function ChargementPage() {
  return (
    <JiramaLoading
      variant="overlay"
      message="Chargement de la page"
      detail="Préparation de votre espace"
    />
  );
}

// =========================================================
// APPLICATION
// =========================================================

function App() {
  return (
    <BrowserRouter>
      {/* Transition visuelle sur chaque changement de route */}
      <RouteTransitionLoader />

      <Suspense fallback={<ChargementPage />}>
        <Routes>
          {/* =================================================
              AUTHENTIFICATION
          ================================================= */}

          <Route path="/" element={<Login />} />

          <Route path="/register" element={<Register />} />

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
                <Navigate to="/dashboard/admin" replace />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/admin/releves"
            element={
              <ProtectedRoute role="ADMINISTRATEUR">
                <Navigate to="/dashboard/admin" replace />
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
            element={<Navigate to="/dashboard/admin" replace />}
          />

          <Route
            path="/dashboard/admin/graphiques"
            element={<Navigate to="/dashboard/admin" replace />}
          />

          <Route
            path="/dashboard/admin/parametres"
            element={
              <ProtectedRoute role="ADMINISTRATEUR">
                <SettingsPage />
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
            path="/dashboard/agent/missions"
            element={
              <ProtectedRoute role="AGENT">
                <AgentMissionsPage />
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
                <SettingsPage />
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
            path="/dashboard/responsable/controles"
            element={
              <ProtectedRoute role="RESPONSABLE">
                <ResponsableControlesPage />
              </ProtectedRoute>
            }
          />

          {/* Le module Comparaison est partagé : la page adapte son cadre au
              rôle connecté et réutilise les mêmes API et calculs. */}
          <Route
            path="/dashboard/responsable/comparaison"
            element={
              <ProtectedRoute role="RESPONSABLE">
                <ComparaisonPage />
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
            path="/dashboard/responsable/releves"
            element={
              <ProtectedRoute role="RESPONSABLE">
                <RelevesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/responsable/parametres"
            element={
              <ProtectedRoute role="RESPONSABLE">
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          {/* =================================================
              ROUTE INCONNUE
          ================================================= */}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
