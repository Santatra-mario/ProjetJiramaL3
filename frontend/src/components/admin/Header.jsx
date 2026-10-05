import {
  Menu,
  Bell,
  ChevronDown,
} from 'lucide-react';

function Header({
  onOpenSidebar,
  onProfile,
  onNotifications,
  notificationCount = 0,
  user,
}) {
  const nomComplet = user
    ? `${user.prenom || ''} ${user.nom || ''}`.trim()
    : 'Administrateur';

  const initiales = user
    ? `${user.prenom?.charAt(0) || ''}${user.nom?.charAt(0) || ''}`.toUpperCase()
    : 'AD';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Partie gauche */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu size={23} />
          </button>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Administration
            </p>

            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Tableau de bord administrateur
            </h1>
          </div>
        </div>

        {/* Partie droite */}
        <div className="flex items-center gap-3">

          {/* Notifications */}
          <button
            type="button"
            onClick={
              onNotifications ||
              (() => {})
            }
            className="relative rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100"
            aria-label="Notifications"
          >
            <Bell size={20} />

            {Number(notificationCount) > 0 && (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
                {Number(notificationCount) > 99
                  ? '99+'
                  : notificationCount}
              </span>
            )}
          </button>

          {/* Profil */}
          <button
            type="button"
            onClick={onProfile}
            className="hidden items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-slate-100 sm:flex"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {initiales}
            </div>

            <div className="text-left">
              <p className="max-w-32 truncate text-sm font-semibold text-slate-800">
                {nomComplet}
              </p>

              <p className="text-xs text-slate-400">
                Administrateur
              </p>
            </div>

            <ChevronDown
              size={16}
              className="text-slate-400"
            />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;