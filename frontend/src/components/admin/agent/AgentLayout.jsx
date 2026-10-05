import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  Bell,
  ChevronRight,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  TriangleAlert,
  UserCircle,
  Users,
  X,
} from 'lucide-react';

import axiosClient
  from '../../../api/axiosClient';


const menuItems = [

  {
    label:
      'Tableau de bord',

    path:
      '/dashboard/agent',

    icon:
      LayoutDashboard,
  },

  {
    label:
      'Compteurs',

    path:
      '/dashboard/agent/compteurs',

    icon:
      Gauge,
  },

  {
    label:
      'Abonnés',

    path:
      '/dashboard/agent/abonnes',

    icon:
      Users,
  },

  {
    label:
      'Saisir un relevé',

    path:
      '/dashboard/agent/releves',

    icon:
      ClipboardList,
  },

  {
    label:
      'Anomalies',

    path:
      '/dashboard/agent/anomalies',

    icon:
      TriangleAlert,
  },

  {
    label:
      'Notifications',

    path:
      '/dashboard/agent/notifications',

    icon:
      Bell,
  },

];


function AgentLayout({

  children,

  title =
    'Tableau de bord',

}) {

  const navigate =
    useNavigate();

  const location =
    useLocation();


  const [
    sidebarOpen,
    setSidebarOpen,
  ] =
    useState(false);


  const [
    notificationCount,
    setNotificationCount,
  ] =
    useState(0);


  const [
    user,
    setUser,
  ] =
    useState(() => {

      try {

        return JSON.parse(
          localStorage.getItem(
            'user'
          ) || 'null'
        );

      } catch {

        return null;

      }

    });


  const nomComplet =
    useMemo(() => {

      const value =
        `${user?.prenom || ''} ${
          user?.nom || ''
        }`.trim();

      return value || 'Agent';

    }, [user]);


  const initiales =
    useMemo(() => {

      const value =
        `${
          user?.prenom?.charAt(0) ||
          ''
        }${
          user?.nom?.charAt(0) ||
          ''
        }`;

      return (
        value.toUpperCase() ||
        'AG'
      );

    }, [user]);


  async function loadNotificationCount() {

    try {

      const response =
        await axiosClient.get(
          '/agent/notifications/count'
        );


      setNotificationCount(
        Number(
          response.data?.total ||
          0
        )
      );

    } catch (error) {

      console.error(
        'Erreur compteur notifications Agent :',
        error
      );

    }

  }


  useEffect(() => {

    loadNotificationCount();

    const interval =
      setInterval(
        () => {
          loadNotificationCount();
        },
        30000
      );


    return () =>
      clearInterval(
        interval
      );

  }, []);


  useEffect(() => {

    setSidebarOpen(false);

  }, [
    location.pathname,
  ]);


  function isActive(path) {

    if (
      path ===
      '/dashboard/agent'
    ) {

      return (
        location.pathname ===
        path
      );

    }


    return (
      location.pathname ===
        path ||

      location.pathname.startsWith(
        `${path}/`
      )
    );

  }


  function handleLogout() {

    localStorage.removeItem(
      'token'
    );

    localStorage.removeItem(
      'user'
    );

    navigate(
      '/',
      {
        replace: true,
      }
    );

  }


  return (

    <div
      className="
        min-h-screen
        bg-slate-100
        text-slate-900
      "
    >

      {sidebarOpen && (

        <div
          className="
            fixed
            inset-0
            z-40
            bg-slate-950/50
            lg:hidden
          "
          onClick={() =>
            setSidebarOpen(false)
          }
        />

      )}


      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className={`
          fixed
          inset-y-0
          left-0
          z-50
          flex
          w-72
          flex-col
          border-r
          border-slate-200
          bg-white
          shadow-xl
          transition-transform
          duration-300
          lg:translate-x-0
          ${
            sidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full'
          }
        `}
      >

        <div
          className="
            flex
            h-20
            items-center
            justify-between
            border-b
            border-slate-200
            px-5
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-2xl
                bg-blue-600
                text-white
                shadow-sm
              "
            >
              <Gauge size={23} />
            </div>


            <div>

              <p
                className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-wider
                  text-blue-600
                "
              >
                JIRAMA
              </p>

              <p
                className="
                  text-sm
                  font-bold
                  text-slate-900
                "
              >
                Espace Agent
              </p>

            </div>

          </div>


          <button
            type="button"
            onClick={() =>
              setSidebarOpen(
                false
              )
            }
            className="
              rounded-xl
              p-2
              text-slate-500
              hover:bg-slate-100
              lg:hidden
            "
          >

            <X size={20} />

          </button>

        </div>


        {/* PROFIL */}

        <div
          className="
            border-b
            border-slate-200
            px-5
            py-4
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
              rounded-2xl
              bg-slate-50
              p-3
            "
          >

            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-full
                bg-blue-100
                text-sm
                font-bold
                text-blue-700
              "
            >
              {initiales}
            </div>


            <div
              className="
                min-w-0
              "
            >

              <p
                className="
                  truncate
                  text-sm
                  font-bold
                  text-slate-800
                "
              >
                {nomComplet}
              </p>

              <p
                className="
                  truncate
                  text-xs
                  text-slate-500
                "
              >
                Agent de relevé
              </p>

            </div>

          </div>

        </div>


        {/* MENU */}

        <nav
          className="
            flex-1
            overflow-y-auto
            px-4
            py-5
          "
        >

          <p
            className="
              px-3
              pb-3
              text-[11px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-slate-400
            "
          >
            Navigation
          </p>


          <div
            className="
              space-y-1.5
            "
          >

            {menuItems.map(
              (
                item
              ) => {

                const Icon =
                  item.icon;

                const active =
                  isActive(
                    item.path
                  );


                return (

                  <button
                    key={
                      item.path
                    }
                    type="button"
                    onClick={() =>
                      navigate(
                        item.path
                      )
                    }
                    className={`
                      group
                      flex
                      w-full
                      items-center
                      gap-3
                      rounded-2xl
                      px-3
                      py-3
                      text-left
                      text-sm
                      font-semibold
                      transition
                      ${
                        active
                          ? `
                            bg-blue-600
                            text-white
                            shadow-md
                            shadow-blue-600/20
                          `
                          : `
                            text-slate-600
                            hover:bg-slate-100
                            hover:text-slate-900
                          `
                      }
                    `}
                  >

                    <Icon size={19} />

                    <span
                      className="
                        flex-1
                      "
                    >
                      {item.label}
                    </span>


                    {item.path ===
                      '/dashboard/agent/notifications' &&
                      notificationCount >
                        0 && (

                        <span
                          className={`
                            rounded-full
                            px-2
                            py-0.5
                            text-[10px]
                            font-bold
                            ${
                              active
                                ? 'bg-white text-blue-700'
                                : 'bg-red-500 text-white'
                            }
                          `}
                        >
                          {
                            notificationCount >
                            99
                              ? '99+'
                              : notificationCount
                          }
                        </span>

                    )}


                    {active && (
                      <ChevronRight
                        size={16}
                      />
                    )}

                  </button>

                );

              }
            )}

          </div>

        </nav>


        {/* LOGOUT */}

        <div
          className="
            border-t
            border-slate-200
            p-4
          "
        >

          <button
            type="button"
            onClick={
              handleLogout
            }
            className="
              flex
              w-full
              items-center
              gap-3
              rounded-2xl
              px-3
              py-3
              text-sm
              font-semibold
              text-red-600
              hover:bg-red-50
            "
          >

            <LogOut size={18} />

            Déconnexion

          </button>

        </div>

      </aside>


      <div
        className="
          lg:pl-72
        "
      >

        {/* HEADER */}

        <header
          className="
            sticky
            top-0
            z-30
            border-b
            border-slate-200
            bg-white/95
            backdrop-blur
          "
        >

          <div
            className="
              flex
              min-h-20
              items-center
              justify-between
              gap-4
              px-4
              sm:px-6
              lg:px-8
            "
          >

            <div
              className="
                flex
                items-center
                gap-3
              "
            >

              <button
                type="button"
                onClick={() =>
                  setSidebarOpen(
                    true
                  )
                }
                className="
                  rounded-xl
                  p-2.5
                  text-slate-600
                  hover:bg-slate-100
                  lg:hidden
                "
              >
                <Menu size={22} />
              </button>


              <div>

                <p
                  className="
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-[0.18em]
                    text-blue-600
                  "
                >
                  Espace Agent
                </p>

                <h1
                  className="
                    text-xl
                    font-bold
                    text-slate-900
                    sm:text-2xl
                  "
                >
                  {title}
                </h1>

              </div>

            </div>


            <div
              className="
                flex
                items-center
                gap-3
              "
            >

              {/* NOTIFICATIONS */}

              <button
                type="button"
                onClick={() =>
                  navigate(
                    '/dashboard/agent/notifications'
                  )
                }
                className="
                  relative
                  rounded-xl
                  p-2.5
                  text-slate-600
                  hover:bg-slate-100
                "
              >

                <Bell size={20} />

                {notificationCount >
                  0 && (

                  <span
                    className="
                      absolute
                      -right-1
                      -top-1
                      min-w-5
                      rounded-full
                      border-2
                      border-white
                      bg-red-500
                      px-1
                      text-[10px]
                      font-bold
                      leading-4
                      text-white
                    "
                  >
                    {
                      notificationCount >
                      99
                        ? '99+'
                        : notificationCount
                    }
                  </span>

                )}

              </button>


              {/* PROFIL */}

              <button
                type="button"
                onClick={() =>
                  navigate(
                    '/dashboard/agent'
                  )
                }
                className="
                  hidden
                  items-center
                  gap-2
                  rounded-xl
                  px-2
                  py-1.5
                  hover:bg-slate-100
                  sm:flex
                "
              >

                <div
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-full
                    bg-blue-600
                    text-xs
                    font-bold
                    text-white
                  "
                >
                  {initiales}
                </div>


                <div
                  className="
                    text-left
                  "
                >

                  <p
                    className="
                      max-w-40
                      truncate
                      text-sm
                      font-semibold
                      text-slate-800
                    "
                  >
                    {nomComplet}
                  </p>

                  <p
                    className="
                      text-xs
                      text-slate-400
                    "
                  >
                    Agent
                  </p>

                </div>


                <UserCircle
                  size={18}
                  className="
                    text-slate-400
                  "
                />

              </button>

            </div>

          </div>

        </header>


        <main
          className="
            p-4
            sm:p-6
            lg:p-8
          "
        >
          {children}
        </main>

      </div>

    </div>

  );
}

export default AgentLayout;