import {
  LayoutDashboard,
  Users,
  UserRound,
  Gauge,
  ClipboardList,
  BarChart3,
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

  activePath =
    '/dashboard/admin',

  onNavigate,

  onLogout,

  user,

}) {


  const menuItems = [

    {
      label:
        'Tableau de bord',

      icon:
        LayoutDashboard,

      path:
        '/dashboard/admin',

    },


    {
      label:
        'Utilisateurs',

      icon:
        Users,

      path:
        '/dashboard/admin/utilisateurs',

    },


    {
      label:
        'Abonnés',

      icon:
        UserRound,

      path:
        '/dashboard/admin/abonnes',

    },


    {
      label:
        'Compteurs',

      icon:
        Gauge,

      path:
        '/dashboard/admin/compteurs',

    },


    {
      label:
        'Relevés',

      icon:
        ClipboardList,

      path:
        '/dashboard/admin/releves',

    },


    {
      label:
        'Statistiques',

      icon:
        BarChart3,

      path:
        '/dashboard/admin/statistiques',

    },


    /* =====================================================
       NOUVEAU : GRAPHIQUES
    ===================================================== */

    {
      label:
        'Graphiques',

      icon:
        BarChart3,

      path:
        '/dashboard/admin/graphiques',

    },


    {
  label:
    'Anomalies',

  icon:
    TriangleAlert,

  path:
    '/dashboard/admin/anomalies',

},


{
  label:
    'Comparaison',

  icon:
    GitCompare,

  path:
    '/dashboard/admin/comparaison',

},


{
  label:
    'Notifications',

  icon:
    Bell,

  path:
    '/dashboard/admin/notifications',

},
  ];


  const nomComplet =
    user

      ? `${user.prenom || ''} ${
          user.nom || ''
        }`.trim()

      : 'Administrateur';


  const email =
    user?.email ||
    'admin@jirama.mg';


  const initiales =
    user

      ? `${user.prenom?.charAt(0) || ''}${
          user.nom?.charAt(0) || ''
        }`.toUpperCase()

      : 'AD';


  function handleNavigate(
    path
  ) {

    if (
      onNavigate
    ) {

      onNavigate(
        path
      );
    }


    if (
      onClose
    ) {

      onClose();
    }
  }


  return (

    <>

      {/* =================================================
          OVERLAY MOBILE
      ================================================= */}

      {isOpen && (

        <div

          className="
            fixed
            inset-0
            z-40
            bg-slate-900/50
            lg:hidden
          "

          onClick={
            onClose
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
            isOpen
              ? 'translate-x-0'
              : '-translate-x-full'
          }
        `}

      >

        {/* =================================================
            LOGO
        ================================================= */}

        <div
          className="
            flex
            h-20
            items-center
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
                h-12
                w-12
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-blue-50
                p-1.5
                shadow-sm
                ring-1
                ring-blue-100
                transition
                duration-300
                hover:scale-105
              "
            >

              <img

                src="/images/Jirama.png"

                alt="Logo JIRAMA"

                className="
                  h-full
                  w-full
                  object-contain
                "

              />

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
                  font-extrabold
                  tracking-wide
                  text-blue-700
                "
              >
                JIRAMA
              </p>


              <p
                className="
                  truncate
                  text-[11px]
                  font-medium
                  text-slate-500
                "
              >
                Suivi des consommations
              </p>

            </div>

          </div>


          <button

            type="button"

            onClick={
              onClose
            }

            className="
              ml-auto
              rounded-lg
              p-2
              text-slate-500
              hover:bg-slate-100
              lg:hidden
            "

            aria-label="
              Fermer le menu
            "

          >

            <X
              size={20}
            />

          </button>

        </div>


        {/* =================================================
            PROFIL
        ================================================= */}

        <div
          className="
            border-b
            border-slate-200
            p-5
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
              rounded-2xl
              bg-blue-50
              p-3
            "
          >

            <div
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-blue-600
                text-sm
                font-bold
                text-white
              "
            >
              {
                initiales
              }
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
                {
                  nomComplet
                }
              </p>


              <p
                className="
                  truncate
                  text-xs
                  text-slate-500
                "
              >
                {
                  email
                }
              </p>

            </div>

          </div>

        </div>


        {/* =================================================
            NAVIGATION
        ================================================= */}

        <nav
          className="
            flex-1
            overflow-y-auto
            p-4
          "
        >

          <p
            className="
              mb-3
              px-3
              text-xs
              font-bold
              uppercase
              tracking-wider
              text-slate-400
            "
          >
            Administration
          </p>


          <div
            className="
              space-y-1
            "
          >

            {
              menuItems.map(
                (
                  item
                ) => {

                  const Icon =
                    item.icon;


                  const active =
                    item.path ===
                    activePath;


                  return (

                    <button

                      key={
                        item.path
                      }

                      type="button"

                      onClick={() =>
                        handleNavigate(
                          item.path
                        )
                      }

                      className={`
                        flex
                        w-full
                        items-center
                        gap-3
                        rounded-xl
                        px-4
                        py-3
                        text-sm
                        font-medium
                        transition-all
                        duration-200

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
                              hover:text-blue-600
                            `
                        }
                      `}

                    >

                      <Icon
                        size={19}
                      />


                      <span>
                        {
                          item.label
                        }
                      </span>


                      {
                        active && (

                          <ChevronRight

                            size={16}

                            className="
                              ml-auto
                            "

                          />

                        )
                      }

                    </button>

                  );
                }
              )
            }

          </div>


          <div
            className="
              my-6
              border-t
              border-slate-200
            "
          />


          <button

            type="button"

            onClick={() =>
              handleNavigate(
                '/dashboard/admin/parametres'
              )
            }

            className="
              flex
              w-full
              items-center
              gap-3
              rounded-xl
              px-4
              py-3
              text-sm
              font-medium
              text-slate-600
              transition
              hover:bg-slate-100
              hover:text-blue-600
            "

          >

            <Settings
              size={19}
            />

            Paramètres

          </button>

        </nav>


        {/* =================================================
            DÉCONNEXION
        ================================================= */}

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
              onLogout
            }

            className="
              flex
              w-full
              items-center
              gap-3
              rounded-xl
              px-4
              py-3
              text-sm
              font-medium
              text-red-600
              transition
              hover:bg-red-50
            "

          >

            <LogOut
              size={19}
            />

            Déconnexion

          </button>

        </div>

      </aside>

    </>
  );
}


export default Sidebar;