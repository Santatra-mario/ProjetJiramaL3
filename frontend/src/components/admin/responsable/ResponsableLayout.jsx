import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  Bell,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';

import axiosClient from '../../../api/axiosClient';
import AdminShell from '../AdminShell.jsx';
import BoutonTheme from '../../BoutonTheme.jsx';
import {
  ToastProvider,
  useToast,
} from '../../ui/ToastProvider.jsx';
import { traiterErreurSession } from './sessionResponsable.js';

const INTERVALLE_COMPTEUR = 30000;

const menuItems = [
  {
    label: 'Tableau de bord',
    path: '/dashboard/responsable',
    icon: LayoutDashboard,
    description: 'Vue générale',
  },
  {
    label: 'Anomalies',
    path: '/dashboard/responsable/anomalies',
    icon: TriangleAlert,
    description: 'Supervision des alertes',
  },
  {
    label: 'Notifications',
    path: '/dashboard/responsable/notifications',
    icon: Bell,
    description: 'Alertes et messages',
  },
];

function getInitials(user) {
  const first = String(user?.prenom || '').trim();
  const last = String(user?.nom || '').trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  return initials || 'R';
}

/* =========================================================
   CONTENU DU LAYOUT
   (doit être à l'intérieur du ToastProvider pour utiliser useToast)
========================================================= */

function ContenuLayout({ children, title }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useToast();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [user, setUser] = useState(null);

  const dernierCompteur = useRef(null);
  const cheminActuel = useRef(location.pathname);
  const enCours = useRef(false);
  const idRequete = useRef(0);
  const controleur = useRef(null);

  useEffect(() => {
    cheminActuel.current = location.pathname;
  }, [location.pathname]);

  /* ---------- Utilisateur connecté ---------- */

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');

      if (!storedUser) {
        navigate('/', { replace: true });
        return;
      }

      const parsedUser = JSON.parse(storedUser);
      const role = String(parsedUser?.role || '').trim().toUpperCase();

      if (role !== 'RESPONSABLE') {
        console.error('Accès refusé : utilisateur non responsable.');
        navigate('/', { replace: true });
        return;
      }

      setUser(parsedUser);
    } catch (error) {
      console.error('Erreur lecture utilisateur :', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/', { replace: true });
    }
  }, [navigate]);

  /* ---------- Compteur de notifications ---------- */

  const chargerCompteur = useCallback(async () => {
    // aucune requête concurrente
    if (enCours.current) {
      return;
    }

    enCours.current = true;
    idRequete.current += 1;

    const id = idRequete.current;
    const controle = new AbortController();

    controleur.current = controle;

    try {
      const response = await axiosClient.get(
        '/responsable/notifications/count',
        { signal: controle.signal }
      );

      const data = response?.data || {};

      const brut = Number(
        data.count ??
          data.unreadCount ??
          data.non_lues ??
          data.notificationsCount ??
          0
      );

      const compteur = Number.isFinite(brut) ? Math.max(0, brut) : 0;

      setUnread(compteur);

      const precedent = dernierCompteur.current;

      dernierCompteur.current = compteur;

      // toast seulement si le nombre augmente (jamais au premier chargement)
      // et si on n'est pas déjà sur la page des notifications
      const surPageNotifications = cheminActuel.current.startsWith(
        '/dashboard/responsable/notifications'
      );

      if (
        precedent !== null &&
        compteur > precedent &&
        !surPageNotifications
      ) {
        const nouvelles = compteur - precedent;

        notify({
          cle: 'nouvelles-notifications',
          genre: 'info',
          titre:
            nouvelles > 1
              ? `${nouvelles} nouvelles notifications`
              : 'Nouvelle notification',
          message: 'Une alerte vient d’arriver dans votre espace.',
          action: {
            label: 'Voir',
            onClick: () =>
              navigate('/dashboard/responsable/notifications'),
          },
        });
      }
    } catch (error) {
      if (
        error?.code === 'ERR_CANCELED' ||
        error?.name === 'CanceledError'
      ) {
        return;
      }

      console.error(
        'Erreur compteur notifications Responsable :',
        error?.message || error
      );

      traiterErreurSession(error, notify, navigate);
    } finally {
      if (idRequete.current === id) {
        enCours.current = false;
      }
    }
  }, [navigate, notify]);

  useEffect(() => {
    chargerCompteur();

    const minuteur = window.setInterval(() => {
      if (!document.hidden) {
        chargerCompteur();
      }
    }, INTERVALLE_COMPTEUR);

    // retour sur l'onglet : mise à jour immédiate
    function auRetour() {
      if (!document.hidden) {
        chargerCompteur();
      }
    }

    document.addEventListener('visibilitychange', auRetour);

    return () => {
      window.clearInterval(minuteur);
      document.removeEventListener('visibilitychange', auRetour);

      controleur.current?.abort();
      enCours.current = false;
    };
  }, [chargerCompteur]);

  useEffect(() => {
    chargerCompteur();
    setMobileOpen(false);
  }, [location.pathname, chargerCompteur]);

  /* ---------- Menu mobile : fermeture avec Échap ---------- */

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    function surTouche(event) {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    }

    document.addEventListener('keydown', surTouche);

    return () => document.removeEventListener('keydown', surTouche);
  }, [mobileOpen]);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/', { replace: true });
  }

  function isActive(path) {
    if (path === '/dashboard/responsable') {
      return location.pathname === path;
    }

    return location.pathname.startsWith(path);
  }

  const fullName = useMemo(
    () =>
      [user?.prenom, user?.nom].filter(Boolean).join(' ') || 'Responsable',
    [user]
  );

  const initials = getInitials(user);

  const libelleNotifications =
    unread > 0
      ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}`
      : 'Notifications';

  return (
    <>
      {/* Liseré tricolore : eau, électricité, alerte */}
      <div
        aria-hidden="true"
        className="fixed left-0 right-0 top-0 z-[60] h-1 bg-gradient-to-r from-jr-eau via-jr-elec to-jr-err"
      />

      {/* ---------- Fond du menu mobile ---------- */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 lg:hidden"
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--jr-eau-fonce) 55%, transparent)',
          }}
        />
      )}

      {/* ---------- Sidebar ---------- */}
      <aside
        className={`jr-verre-fort fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-jr-bordure shadow-xl backdrop-blur transition-transform duration-300 motion-reduce:transition-none lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-20 items-center border-b border-jr-bordure px-5">
          <button
            type="button"
            onClick={() => navigate('/dashboard/responsable')}
            title="Retour au tableau de bord"
            className="flex items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec"
          >
            {/* Tuile claire : le logo reste lisible en mode sombre */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ffffff] p-1.5 shadow-sm ring-1 ring-jr-bordure">
              <img
                src="/images/Jirama.png"
                alt="Logo JIRAMA"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-wide text-jr-titre">
                JIRAMA
              </p>
              <p className="truncate text-[11px] font-medium text-jr-faible">
                Espace Responsable
              </p>
            </div>
          </button>

          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-lg p-2 text-jr-doux hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec lg:hidden"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Profil */}
        <div className="border-b border-jr-bordure p-5">
          <div className="flex items-center gap-3 rounded-2xl bg-jr-eau-pale p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-jr-eau text-sm font-bold text-white">
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-jr-texte">
                {fullName}
              </p>
              <p className="truncate text-xs text-jr-faible">
                {user?.email || 'Compte responsable'}
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-jr-bordure bg-jr-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-jr-lien">
                <ShieldCheck size={11} aria-hidden="true" />
                Responsable
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto p-4"
          aria-label="Navigation responsable"
        >
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-jr-faible">
            Supervision
          </p>

          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const estNotification = item.path.includes('/notifications');

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none ${
                    active
                      ? 'bg-jr-eau text-white shadow-md shadow-black/20'
                      : 'text-jr-doux hover:bg-jr-eau-pale hover:text-jr-lien'
                  }`}
                >
                  {/* Repère orange (électricité) sur la page active */}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-jr-elec"
                    />
                  )}

                  <Icon size={20} aria-hidden="true" />

                  <span className="min-w-0 flex-1">
                    <span className="block">{item.label}</span>
                    <span
                      className={`block text-[11px] font-normal ${
                        active ? 'text-white/80' : 'text-jr-faible'
                      }`}
                    >
                      {item.description}
                    </span>
                  </span>

                  {estNotification && unread > 0 && (
                    <span className="min-w-6 rounded-full bg-jr-err px-2 py-0.5 text-center text-[10px] font-bold text-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}

                  {active && (
                    <ChevronRight size={16} aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Déconnexion */}
        <div className="border-t border-jr-bordure p-4">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-jr-err transition hover:bg-jr-err-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none"
          >
            <LogOut size={20} aria-hidden="true" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ---------- Contenu ---------- */}
      <div className="min-h-screen lg:pl-72">
        <header className="jr-verre-fort sticky top-1 z-30 border-b border-jr-bordure backdrop-blur">
          <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            {/* Gauche */}
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                aria-label="Ouvrir le menu"
                onClick={() => setMobileOpen(true)}
                className="rounded-xl p-2 text-jr-doux transition hover:bg-jr-eau-pale hover:text-jr-lien focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none lg:hidden"
              >
                <Menu size={23} aria-hidden="true" />
              </button>

              <div className="min-w-0">
                <p className="hidden text-xs font-semibold uppercase tracking-wider text-jr-lien sm:block">
                  Supervision
                </p>
                <h1 className="truncate text-xl font-bold text-jr-titre sm:text-2xl">
                  {title}
                </h1>
              </div>
            </div>

            {/* Droite */}
            <div className="flex items-center gap-3">
              {/* Mode clair / sombre */}
              <BoutonTheme integre />

              {/* Notifications */}
              <button
                type="button"
                aria-label={libelleNotifications}
                title="Notifications"
                onClick={() =>
                  navigate('/dashboard/responsable/notifications')
                }
                className="relative rounded-xl p-2.5 text-jr-doux transition hover:bg-jr-eau-pale hover:text-jr-lien focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none"
              >
                <Bell size={22} aria-hidden="true" />

                {unread > 0 && (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 h-5 w-5 animate-ping rounded-full bg-jr-err opacity-60 motion-reduce:animate-none"
                    />
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-jr-surface bg-jr-err px-1 text-center text-[10px] font-bold leading-4 text-white">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  </>
                )}
              </button>

              {/* Profil */}
              <div className="hidden items-center gap-3 rounded-xl px-2 py-1.5 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-jr-eau text-xs font-bold text-white">
                  {initials}
                </div>

                <div className="text-left">
                  <p className="max-w-32 truncate text-sm font-semibold text-jr-texte">
                    {fullName}
                  </p>
                  <p className="text-xs text-jr-faible">Responsable</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </>
  );
}

/* =========================================================
   LAYOUT RESPONSABLE
   AdminShell (fond Jirama + thème clair/sombre) + toasts partagés
   par les 3 pages : tableau de bord, anomalies, notifications.
========================================================= */

export default function ResponsableLayout({
  children,
  title = 'Tableau de bord',
}) {
  return (
    <AdminShell intensite="calme">
      <ToastProvider>
        <ContenuLayout title={title}>{children}</ContenuLayout>
      </ToastProvider>
    </AdminShell>
  );
}