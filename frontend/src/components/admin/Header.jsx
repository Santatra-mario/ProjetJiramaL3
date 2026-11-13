import { Menu, Bell, ChevronDown } from 'lucide-react';

import { useLocation } from 'react-router-dom';

import BoutonTheme from '../BoutonTheme.jsx';
import DisplayControls from '../DisplayControls.jsx';

/* =========================================================
   TITRES PAR ROUTE
   Le titre et le surtitre de l'en-tête dérivent de l'URL
   affichée : une route = un intitulé exact.
========================================================= */

const TITRES_PAR_ROUTE = {
  '/dashboard/admin': 'Tableau de bord administrateur',
  '/dashboard/admin/utilisateurs': 'Utilisateurs',
  '/dashboard/admin/abonnes': 'Abonnés',
  '/dashboard/admin/compteurs': 'Compteurs',
  '/dashboard/admin/releves': 'Relevés',
  '/dashboard/admin/anomalies': 'Anomalies',
  '/dashboard/admin/comparaison': 'Comparaison',
  '/dashboard/admin/notifications': 'Notifications',
  '/dashboard/admin/statistiques': 'Statistiques',
  '/dashboard/admin/graphiques': 'Graphiques',
  '/dashboard/admin/parametres': 'Paramètres',

  '/dashboard/agent': 'Tableau de bord agent',
  '/dashboard/agent/compteurs': 'Compteurs',
  '/dashboard/agent/abonnes': 'Abonnés',
  '/dashboard/agent/releves': 'Relevés',
  '/dashboard/agent/anomalies': 'Anomalies',
  '/dashboard/agent/notifications': 'Notifications',
  '/dashboard/agent/parametres': 'Paramètres',

  '/dashboard/responsable': 'Tableau de bord responsable',
  '/dashboard/responsable/anomalies': 'Anomalies',
  '/dashboard/responsable/notifications': 'Notifications',
  '/dashboard/responsable/parametres': 'Paramètres',
};

const SURTITRES_PAR_ESPACE = {
  '/dashboard/admin': 'Administration',
  '/dashboard/agent': 'Espace agent',
  '/dashboard/responsable': 'Espace responsable',
};

function espaceDePathname(pathname) {
  return Object.keys(SURTITRES_PAR_ESPACE)
    .filter((racine) => pathname === racine || pathname.startsWith(`${racine}/`))
    .sort((a, b) => b.length - a.length)[0];
}

function titreDePathname(pathname) {
  const connu = TITRES_PAR_ROUTE[pathname];
  if (connu) return connu;

  // Fallback : dernier segment de l'URL, lisible.
  const segments = pathname.split('/').filter(Boolean);
  const dernier = segments[segments.length - 1] || '';
  if (!dernier) return 'Tableau de bord';
  return dernier.charAt(0).toUpperCase() + dernier.slice(1);
}

/* =========================================================
   HEADER
========================================================= */

function Header({
  onOpenSidebar,
  onProfile,
  onNotifications,
  notificationCount = 0,
  user,
}) {
  const { pathname } = useLocation();

  const surtitre = SURTITRES_PAR_ESPACE[espaceDePathname(pathname)] || 'Administration';
  const titre = titreDePathname(pathname);

  const nomComplet = user
    ? `${user.prenom || ''} ${user.nom || ''}`.trim()
    : 'Administrateur';

  const initiales = user
    ? `${user.prenom?.charAt(0) || ''}${user.nom?.charAt(0) || ''}`.toUpperCase()
    : 'AD';

  const nombre = Number(notificationCount) || 0;

  return (
    <header className="jr-verre-fort sticky top-0 z-30 border-b border-jr-bordure backdrop-blur">
      <div className="flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Partie gauche */}
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="rounded-xl p-2 text-jr-doux transition hover:bg-jr-eau-pale hover:text-jr-lien focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu size={23} aria-hidden="true" />
          </button>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-jr-lien">
              {surtitre}
            </p>
            <h1 className="truncate text-xl font-bold text-jr-titre sm:text-2xl">
              {titre}
            </h1>
          </div>
        </div>

        {/* Partie droite */}
        <div className="flex items-center gap-3">
          {/* Réglages de lisibilité et plein écran */}
          <DisplayControls />

          {/* Mode clair / sombre */}
          <BoutonTheme integre />

          {/* Notifications */}
          <button
            type="button"
            onClick={onNotifications || (() => {})}
            className="relative rounded-xl p-2.5 text-jr-doux transition hover:bg-jr-eau-pale hover:text-jr-lien focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec"
            aria-label={
              nombre > 0
                ? `Notifications, ${nombre} non lue${nombre > 1 ? 's' : ''}`
                : 'Notifications'
            }
          >
            <Bell size={22} aria-hidden="true" />

            {nombre > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-jr-surface bg-jr-err px-1 text-center text-[10px] font-bold leading-4 text-white">
                {nombre > 99 ? '99+' : nombre}
              </span>
            )}
          </button>

          {/* Profil */}
          <button
            type="button"
            onClick={onProfile}
            className="hidden items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec sm:flex"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-jr-eau text-xs font-bold text-white">
              {initiales}
            </div>

            <div className="text-left">
              <p className="max-w-32 truncate text-sm font-semibold text-jr-texte">
                {nomComplet}
              </p>
              <p className="text-xs text-jr-faible">{surtitre}</p>
            </div>

            <ChevronDown size={16} aria-hidden="true" className="text-jr-faible" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
