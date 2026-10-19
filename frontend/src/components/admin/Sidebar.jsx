import {
  LayoutDashboard,
  Users,
  UserRound,
  Gauge,
  ClipboardList,
  TriangleAlert,
  Bell,
  Settings,
  LogOut,
  X,
  ChevronRight,
  GitCompare,
} from 'lucide-react';

function Sidebar({
  isOpen = false,
  onClose,
  activePath = '/dashboard/admin',
  onNavigate,
  onLogout,
  user,
}) {
  const menuItems = [
    { label: 'Tableau de bord', icon: LayoutDashboard, path: '/dashboard/admin' },
    { label: 'Utilisateurs', icon: Users, path: '/dashboard/admin/utilisateurs' },
    { label: 'Abonnés', icon: UserRound, path: '/dashboard/admin/abonnes' },
    { label: 'Compteurs', icon: Gauge, path: '/dashboard/admin/compteurs' },
    { label: 'Relevés', icon: ClipboardList, path: '/dashboard/admin/releves' },
    { label: 'Anomalies', icon: TriangleAlert, path: '/dashboard/admin/anomalies' },
    { label: 'Comparaison', icon: GitCompare, path: '/dashboard/admin/comparaison' },
    { label: 'Notifications', icon: Bell, path: '/dashboard/admin/notifications' },
  ];

  const nomComplet = user
    ? `${user.prenom || ''} ${user.nom || ''}`.trim()
    : 'Administrateur';

  const email = user?.email || 'admin@jirama.mg';

  const initiales = user
    ? `${user.prenom?.charAt(0) || ''}${user.nom?.charAt(0) || ''}`.toUpperCase()
    : 'AD';

  function handleNavigate(path) {
    if (onNavigate) {
      onNavigate(path);
    }

    if (onClose) {
      onClose();
    }
  }

  return (
    <>
      {/* ---------- Overlay mobile ---------- */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ---------- Sidebar ---------- */}
      <aside
        className={`jr-verre-fort fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-jr-bordure shadow-xl backdrop-blur transition-transform duration-300 motion-reduce:transition-none lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-20 items-center border-b border-jr-bordure px-5">
          <div className="flex items-center gap-3">
            {/* Tuile claire : le logo reste lisible en mode sombre */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ffffff] p-1.5 shadow-sm ring-1 ring-jr-bordure transition duration-300 hover:scale-105 motion-reduce:transition-none">
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
                Suivi des consommations
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-2 text-jr-doux hover:bg-jr-eau-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec lg:hidden"
            aria-label="Fermer le menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Profil */}
        <div className="border-b border-jr-bordure p-5">
          <div className="flex items-center gap-3 rounded-2xl bg-jr-eau-pale p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-jr-eau text-sm font-bold text-white">
              {initiales}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-jr-texte">
                {nomComplet}
              </p>
              <p className="truncate text-xs text-jr-faible">{email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4" aria-label="Navigation administrateur">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-jr-faible">
            Administration
          </p>

          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = item.path === activePath;

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNavigate(item.path)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec motion-reduce:transition-none ${
                    active
                      ? 'bg-jr-eau text-white shadow-md shadow-black/20'
                      : 'text-jr-doux hover:bg-jr-eau-pale hover:text-jr-lien'
                  }`}
                >
                  {/* Repère orange (électricité) sur la page active */}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-jr-elec"
                    />
                  )}

                  <Icon size={20} aria-hidden="true" />
                  <span>{item.label}</span>

                  {active && (
                    <ChevronRight size={16} aria-hidden="true" className="ml-auto" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="my-6 border-t border-jr-bordure" />

          <button
            type="button"
            onClick={() => handleNavigate('/dashboard/admin/parametres')}
            aria-current={activePath === '/dashboard/admin/parametres' ? 'page' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec ${
              activePath === '/dashboard/admin/parametres'
                ? 'bg-jr-eau text-white'
                : 'text-jr-doux hover:bg-jr-eau-pale hover:text-jr-lien'
            }`}
          >
            <Settings size={20} aria-hidden="true" />
            Paramètres
          </button>
        </nav>

        {/* Déconnexion */}
        <div className="border-t border-jr-bordure p-4">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-jr-err transition hover:bg-jr-err-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec"
          >
            <LogOut size={20} aria-hidden="true" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;