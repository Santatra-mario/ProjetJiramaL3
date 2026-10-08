import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function getInitials(user) {
  const first = String(user?.prenom || '').trim();
  const last = String(user?.nom || '').trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return initials || 'R';
}

export default function ResponsableLayout({ children, title = 'Tableau de bord' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [user, setUser] = useState(null);

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

  const loadNotificationCount = useCallback(async () => {
    try {
      const response = await axiosClient.get('/responsable/notifications/count');
      const data = response?.data || {};
      const count = Number(
        data.count ??
          data.unreadCount ??
          data.non_lues ??
          data.notificationsCount ??
          0
      );

      setUnread(Number.isFinite(count) ? Math.max(0, count) : 0);
    } catch (error) {
      console.error('Erreur compteur notifications Responsable :', error);

      if ([401, 403].includes(error?.response?.status)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/', { replace: true });
      }
    }
  }, [navigate]);

  useEffect(() => {
    loadNotificationCount();
    const timer = window.setInterval(loadNotificationCount, 30000);
    return () => window.clearInterval(timer);
  }, [loadNotificationCount]);

  useEffect(() => {
    loadNotificationCount();
    setMobileOpen(false);
  }, [location.pathname, loadNotificationCount]);

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
    () => [user?.prenom, user?.nom].filter(Boolean).join(' ') || 'Responsable',
    [user]
  );

  const initials = getInitials(user);

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-900">
      <div className="fixed left-0 right-0 top-0 z-[60] h-1 bg-gradient-to-r from-[#0054A6] via-[#0054A6] via-55% to-[#E30613]">
        <div className="h-full w-1/3 bg-[#F7C600]" />
      </div>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-[#003B73]/45 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[286px] flex-col border-r border-blue-950/20 bg-[#003B73] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-[#F7C600]" />
        <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-5">
          <button
            type="button"
            onClick={() => navigate('/dashboard/responsable')}
            className="flex items-center gap-3 text-left"
            title="Retour au tableau de bord"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/10">
              <div className="text-center leading-none">
                <span className="block text-[15px] font-black tracking-tight text-[#0054A6]">JI</span>
                <span className="block text-[10px] font-black tracking-tight text-[#E30613]">RAMA</span>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-100">JIRAMA</p>
              <p className="mt-0.5 text-sm font-bold text-white">Espace Responsable</p>
            </div>
          </button>

          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
            className="rounded-xl p-2 text-blue-100 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative mx-4 mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
          <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-[#F7C600]/20 blur-xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F7C600] text-sm font-black text-[#003B73] shadow-lg">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">{fullName}</p>
              <p className="mt-0.5 truncate text-xs text-blue-100">{user?.email || 'Compte responsable'}</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#F7C600]">
                <ShieldCheck size={11} /> Responsable
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-blue-200/70">Supervision</p>
          <div className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const isNotification = item.path.includes('/notifications');

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-3 py-3.5 text-left transition-all duration-200',
                    active
                      ? 'bg-white text-[#003B73] shadow-xl shadow-black/10'
                      : 'text-blue-100 hover:translate-x-1 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#E30613]" />}
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition', active ? 'bg-[#0054A6] text-white' : 'bg-white/10 text-blue-100 group-hover:bg-white/15')}>
                    <Icon size={19} strokeWidth={active ? 2.5 : 2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">{item.label}</span>
                    <span className={cn('mt-0.5 block text-[10px]', active ? 'text-slate-500' : 'text-blue-200/70')}>
                      {item.description}
                    </span>
                  </span>
                  {isNotification && unread > 0 && (
                    <span className={cn('flex min-w-6 items-center justify-center rounded-full px-2 py-1 text-[10px] font-black', active ? 'bg-[#E30613] text-white' : 'bg-[#E30613] text-white')}>
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                  <ChevronRight size={15} className={cn('transition-transform', active ? 'text-[#0054A6]' : 'text-blue-200/40 group-hover:translate-x-0.5')} />
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={logout}
            className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-blue-100 transition hover:border-red-300/30 hover:bg-[#E30613]/15 hover:text-white"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 transition group-hover:bg-[#E30613]">
              <LogOut size={17} />
            </span>
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[286px]">
        <header className="sticky top-1 z-20 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-xl">
          <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Ouvrir le menu"
                onClick={() => setMobileOpen(true)}
                className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-[#0054A6] lg:hidden"
              >
                <Menu size={21} />
              </button>
              <div className="min-w-0">
                <div className="hidden items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 sm:flex">
                  <span>JIRAMA</span>
                  <ChevronRight size={12} />
                  <span>Supervision</span>
                </div>
                <h1 className="truncate text-lg font-black text-[#003B73] sm:text-xl">{title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0054A6] text-xs font-black text-white">{initials}</div>
                <div className="max-w-[150px]">
                  <p className="truncate text-xs font-black text-slate-800">{fullName}</p>
                  <p className="text-[10px] font-semibold text-slate-400">Responsable</p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Ouvrir les notifications"
                title="Notifications"
                onClick={() => navigate('/dashboard/responsable/notifications')}
                className="relative rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-[#0054A6] hover:shadow-md"
              >
                <Bell size={20} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E30613] px-1 text-[9px] font-black text-white ring-2 ring-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
