import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useSearchParams,
  useNavigate,
} from 'react-router-dom';

import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Droplets,
  History,
  Info,
  Save,
  RefreshCw,
  UserRound,
  X,
  Zap,
} from 'lucide-react';

import axiosClient
  from '../../api/axiosClient';

import AgentLayout
  from '../../components/admin/agent/AgentLayout';


function getToday() {

  const date =
    new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(
    2,
    '0'
  )}-${String(
    date.getDate()
  ).padStart(
    2,
    '0'
  )}`;

}


function toInputDate(
  value
) {

  return value
    ? String(
        value
      ).slice(
        0,
        10
      )
    : '';

}


function formatDate(
  value
) {

  if (!value) {
    return '—';
  }

  const date =
    new Date(
      `${String(value).slice(
        0,
        10
      )}T00:00:00`
    );

  return Number.isNaN(
    date.getTime()
  )
    ? '—'
    : date.toLocaleDateString(
        'fr-FR'
      );

}


function sortDescending(
  data = []
) {

  return [
    ...data,
  ].sort(
    (
      a,
      b
    ) => {

      const dateA =
        new Date(
          `${toInputDate(
            a.date_releve
          )}T00:00:00`
        ).getTime();


      const dateB =
        new Date(
          `${toInputDate(
            b.date_releve
          )}T00:00:00`
        ).getTime();


      if (
        dateA !==
        dateB
      ) {

        return (
          dateB -
          dateA
        );

      }


      return (
        Number(
          b.id || 0
        ) -
        Number(
          a.id || 0
        )
      );

    }
  );

}


function formatNumber(
  value
) {

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number.toLocaleString(
        'fr-FR',
        {
          minimumFractionDigits:
            2,
          maximumFractionDigits:
            2,
        }
      )
    : '—';

}


function AgentRelevesPage() {

  const navigate =
    useNavigate();


  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams();


  const compteurQuery =
    searchParams.get(
      'compteur'
    ) || '';


  const [
    compteurs,
    setCompteurs,
  ] =
    useState([]);


  const [
    historique,
    setHistorique,
  ] =
    useState([]);


  const [
    releves,
    setReleves,
  ] =
    useState([]);


  const [
    selectedCompteur,
    setSelectedCompteur,
  ] =
    useState(
      compteurQuery
    );


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(false);


  const [
    saving,
    setSaving,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState('');


  const [
    success,
    setSuccess,
  ] =
    useState('');


  const [
    form,
    setForm,
  ] =
    useState({

      compteur_id:
        compteurQuery,

      date_ancien_releve:
        '',

      date_releve:
        getToday(),

      ancien_index:
        '',

      nouvel_index:
        '',

    });


  const currentCompteur =
    useMemo(
      () =>
        compteurs.find(
          (
            item
          ) =>
            String(
              item.id
            ) ===
            String(
              selectedCompteur
            )
        ) ||
        null,

      [
        compteurs,
        selectedCompteur,
      ]
    );


  const isFirstReleve =
    historique.length ===
    0;


  async function loadCompteurs() {

    try {

      setLoading(
        true
      );

      setError('');


      const response =
        await axiosClient.get(
          '/agent/compteurs'
        );


      if (
        response.data?.status !==
        'success'
      ) {

        throw new Error(
          response.data?.message ||
          'Impossible de charger les compteurs.'
        );

      }


      const data =
        response.data?.data ||
        [];


      setCompteurs(
        data
      );


      if (
        selectedCompteur &&
        data.some(
          (
            item
          ) =>
            String(
              item.id
            ) ===
            String(
              selectedCompteur
            )
        )
      ) {

        return;

      }


      if (
        data.length > 0
      ) {

        const first =
          data.find(
            (
              item
            ) =>
              String(
                item.id
              ) ===
              String(
                compteurQuery
              )
          ) ||
          data[0];


        setSelectedCompteur(
          String(
            first.id
          )
        );


        setForm(
          (
            previous
          ) => ({

            ...previous,

            compteur_id:
              String(
                first.id
              ),

          })
        );


        setSearchParams({

          compteur:
            String(
              first.id
            ),

        });

      }

    } catch (
      requestError
    ) {

      console.error(
        'Erreur chargement compteurs Agent :',
        requestError
      );


      if (
        requestError.response?.status ===
          401 ||
        requestError.response?.status ===
          403
      ) {

        navigate(
          '/',
          {
            replace: true,
          }
        );

        return;
      }


      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        'Erreur lors du chargement des compteurs.'
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  async function loadAllReleves() {

    try {

      const response =
        await axiosClient.get(
          '/agent/releves'
        );


      if (
        response.data?.status !==
        'success'
      ) {

        throw new Error(
          response.data?.message ||
          'Impossible de charger les relevés.'
        );

      }


      setReleves(
        response.data?.data ||
        []
      );

    } catch (
      requestError
    ) {

      console.error(
        'Erreur tous les relevés Agent :',
        requestError
      );

    }

  }


  async function loadHistory(
    compteurId
  ) {

    if (!compteurId) {

      setHistorique(
        []
      );

      return;

    }


    try {

      setHistoryLoading(
        true
      );

      setError('');


      const response =
        await axiosClient.get(
          `/agent/releves/compteur/${compteurId}`
        );


      if (
        response.data?.status !==
        'success'
      ) {

        throw new Error(
          response.data?.message ||
          'Impossible de charger l’historique.'
        );

      }


      const data =
        sortDescending(
          response.data?.data ||
          []
        );


      setHistorique(
        data
      );


      const latest =
        data[0];


      if (latest) {

        setForm(
          (
            previous
          ) => ({

            ...previous,

            compteur_id:
              String(
                compteurId
              ),

            date_ancien_releve:
              toInputDate(
                latest.date_releve
              ),

            ancien_index:
              latest.nouvel_index ??
              '',

            nouvel_index:
              '',

            date_releve:
              getToday(),

          })
        );

      } else {

        setForm(
          (
            previous
          ) => ({

            ...previous,

            compteur_id:
              String(
                compteurId
              ),

            date_ancien_releve:
              '',

            ancien_index:
              '',

            nouvel_index:
              '',

            date_releve:
              getToday(),

          })
        );

      }

    } catch (
      requestError
    ) {

      console.error(
        'Erreur historique Agent :',
        requestError
      );


      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        'Erreur lors du chargement de l’historique.'
      );

    } finally {

      setHistoryLoading(
        false
      );

    }

  }


  useEffect(
    () => {

      loadCompteurs();

      loadAllReleves();

    },
    []
  );


  useEffect(
    () => {

      if (
        selectedCompteur
      ) {

        loadHistory(
          selectedCompteur
        );

      }

    },
    [
      selectedCompteur,
    ]
  );


  function handleCompteurChange(
    event
  ) {

    const value =
      event.target.value;


    setSelectedCompteur(
      value
    );


    setForm(
      (
        previous
      ) => ({

        ...previous,

        compteur_id:
          value,

      })
    );


    setSearchParams(
      value
        ? {
            compteur:
              value,
          }
        : {}
    );


    setError('');

    setSuccess('');

  }


  function handleChange(
    event
  ) {

    const {
      name,
      value,
    } =
      event.target;


    setForm(
      (
        previous
      ) => ({

        ...previous,

        [name]:
          value,

      })
    );


    setError('');

    setSuccess('');

  }


  function validateForm() {

    if (
      !form.compteur_id
    ) {

      return (
        'Veuillez sélectionner un compteur.'
      );

    }


    if (
      !form.date_releve
    ) {

      return (
        'Veuillez saisir la date du relevé actuel.'
      );

    }


    if (
      isFirstReleve &&
      !form.date_ancien_releve
    ) {

      return (
        'Pour le premier relevé, la date du relevé précédent est obligatoire.'
      );

    }


    if (
      isFirstReleve &&
      form.ancien_index ===
        ''
    ) {

      return (
        'Pour le premier relevé, l’ancien index est obligatoire.'
      );

    }


    if (
      isFirstReleve &&
      Number(
        form.ancien_index
      ) < 0
    ) {

      return (
        'L’ancien index doit être supérieur ou égal à zéro.'
      );

    }


    if (
      form.nouvel_index ===
      ''
    ) {

      return (
        'Veuillez saisir le nouvel index.'
      );

    }


    if (
      Number(
        form.nouvel_index
      ) < 0
    ) {

      return (
        'Le nouvel index doit être supérieur ou égal à zéro.'
      );

    }


    if (
      form.date_ancien_releve &&
      form.date_releve &&
      form.date_ancien_releve >=
        form.date_releve
    ) {

      return (
        'La date du relevé précédent doit être antérieure à la date du relevé actuel.'
      );

    }


    if (
      form.ancien_index !==
        '' &&
      Number(
        form.nouvel_index
      ) <
        Number(
          form.ancien_index
        )
    ) {

      return (
        'Le nouvel index doit être supérieur ou égal à l’ancien index.'
      );

    }


    return '';

  }


  async function handleSubmit(
    event
  ) {

    event.preventDefault();


    const validationError =
      validateForm();


    if (
      validationError
    ) {

      setError(
        validationError
      );

      return;
    }


    try {

      setSaving(
        true
      );

      setError('');

      setSuccess('');


      const payload = {

        compteur_id:
          Number(
            form.compteur_id
          ),

        date_ancien_releve:
          form.date_ancien_releve ||
          null,

        date_releve:
          form.date_releve,

        ancien_index:
          form.ancien_index ===
          ''
            ? null
            : Number(
                form.ancien_index
              ),

        nouvel_index:
          Number(
            form.nouvel_index
          ),

      };


      const response =
        await axiosClient.post(
          '/agent/releves',
          payload
        );


      if (
        response.data?.status !==
        'success'
      ) {

        throw new Error(
          response.data?.message ||
          'Impossible d’enregistrer le relevé.'
        );

      }


      setSuccess(
        'Relevé enregistré avec succès. La consommation a été calculée automatiquement.'
      );


      setForm(
        (
          previous
        ) => ({

          ...previous,

          nouvel_index:
            '',

        })
      );


      await Promise.all([

        loadHistory(
          form.compteur_id
        ),

        loadAllReleves(),

      ]);

    } catch (
      requestError
    ) {

      console.error(
        'Erreur création relevé Agent :',
        requestError
      );


      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        'Impossible d’enregistrer le relevé.'
      );

    } finally {

      setSaving(
        false
      );

    }

  }


  const filteredReleves =
    useMemo(
      () => {

        if (
          !selectedCompteur
        ) {

          return releves;

        }


        return releves.filter(
          (
            item
          ) =>
            String(
              item.compteur_id
            ) ===
            String(
              selectedCompteur
            )
        );

      },
      [
        releves,
        selectedCompteur,
      ]
    );


  return (

    <AgentLayout
      title="
        Saisie des relevés
      "
    >

      <div
        className="
          space-y-6
        "
      >

        <section
          className="
            rounded-3xl
            border
            border-slate-200
            bg-white
            p-5
            shadow-sm
            sm:p-6
          "
        >

          <div
            className="
              flex
              flex-col
              justify-between
              gap-5
              lg:flex-row
              lg:items-center
            "
          >

            <div>

              <p
                className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.16em]
                  text-blue-600
                "
              >
                Opération principale
              </p>

              <h2
                className="
                  mt-1
                  text-2xl
                  font-black
                  text-slate-900
                "
              >
                Saisir un relevé
              </h2>

              <p
                className="
                  mt-2
                  text-sm
                  text-slate-500
                "
              >
                L’ancien index et
                la consommation sont
                gérés à partir de
                l’historique réel du compteur.
              </p>

            </div>


            <button
              type="button"
              onClick={() =>
                selectedCompteur &&
                loadHistory(
                  selectedCompteur
                )
              }
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-2xl
                border
                border-slate-200
                px-4
                py-3
                text-sm
                font-bold
                text-slate-700
                hover:bg-slate-50
              "
            >

              <RefreshCw
                size={17}
                className={
                  historyLoading
                    ? 'animate-spin'
                    : ''
                }
              />

              Actualiser l’historique

            </button>

          </div>

        </section>


        {error && (

          <div
            className="
              flex
              items-start
              gap-3
              rounded-2xl
              border
              border-red-200
              bg-red-50
              px-4
              py-3
              text-sm
              font-medium
              text-red-700
            "
          >

            <X
              size={18}
              className="
                mt-0.5
                shrink-0
              "
            />

            <span>
              {error}
            </span>

          </div>

        )}


        {success && (

          <div
            className="
              flex
              items-start
              gap-3
              rounded-2xl
              border
              border-emerald-200
              bg-emerald-50
              px-4
              py-3
              text-sm
              font-medium
              text-emerald-700
            "
          >

            <CheckCircle2
              size={18}
              className="
                mt-0.5
                shrink-0
              "
            />

            <span>
              {success}
            </span>

          </div>

        )}


        <section
          className="
            grid
            gap-6
            xl:grid-cols-[1.05fr_0.95fr]
          "
        >

          {/* FORMULAIRE */}

          <div
            className="
              rounded-3xl
              border
              border-slate-200
              bg-white
              p-5
              shadow-sm
              sm:p-6
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
                  rounded-2xl
                  bg-blue-50
                  p-3
                  text-blue-600
                "
              >
                <ClipboardList
                  size={21}
                />
              </div>


              <div>

                <h3
                  className="
                    font-bold
                    text-slate-900
                  "
                >
                  Nouveau relevé
                </h3>

                <p
                  className="
                    text-sm
                    text-slate-500
                  "
                >
                  Saisie sécurisée
                  par le serveur.
                </p>

              </div>

            </div>


            <form
              onSubmit={
                handleSubmit
              }
              className="
                mt-6
                space-y-5
              "
            >

              <div>

                <label
                  className="
                    mb-2
                    block
                    text-sm
                    font-semibold
                    text-slate-700
                  "
                >
                  Compteur
                </label>


                <select
                  value={
                    selectedCompteur
                  }
                  onChange={
                    handleCompteurChange
                  }
                  disabled={
                    loading ||
                    saving
                  }
                  className="
                    w-full
                    rounded-2xl
                    border
                    border-slate-300
                    bg-slate-50
                    px-4
                    py-3
                    text-sm
                    outline-none
                    focus:border-blue-500
                    focus:bg-white
                    disabled:opacity-60
                  "
                >

                  <option value="">
                    Sélectionner un compteur
                  </option>


                  {compteurs.map(
                    (
                      item
                    ) => (

                      <option
                        key={
                          item.id
                        }
                        value={
                          item.id
                        }
                      >
                        {
                          item.numero_compteur
                        }
                        {' — '}
                        {
                          String(
                            item.type ||
                            ''
                          ).toUpperCase() ===
                          'EAU'
                            ? 'Eau'
                            : 'Électricité'
                        }
                      </option>

                    )
                  )}

                </select>

              </div>


              {currentCompteur && (

                <div
                  className="
                    rounded-2xl
                    border
                    border-blue-100
                    bg-blue-50/60
                    p-4
                  "
                >

                  <div
                    className="
                      flex
                      items-start
                      gap-3
                    "
                  >

                    <div
                      className="
                        rounded-xl
                        bg-white
                        p-2
                        text-blue-600
                        shadow-sm
                      "
                    >

                      {
                        String(
                          currentCompteur.type ||
                          ''
                        ).toUpperCase() ===
                        'EAU'
                          ? (
                            <Droplets
                              size={18}
                            />
                          )
                          : (
                            <Zap
                              size={18}
                            />
                          )
                      }

                    </div>


                    <div>

                      <p
                        className="
                          font-bold
                          text-slate-800
                        "
                      >
                        {
                          currentCompteur.numero_compteur
                        }
                      </p>


                      <p
                        className="
                          mt-1
                          text-xs
                          text-slate-500
                        "
                      >
                        {
                          `${
                            currentCompteur.abonne_prenom ||
                            ''
                          } ${
                            currentCompteur.abonne_nom ||
                            ''
                          }`.trim()
                          ||
                          'Abonné non renseigné'
                        }
                        {' · '}
                        {
                          currentCompteur.numero_abonne ||
                          '—'
                        }
                      </p>

                    </div>

                  </div>

                </div>

              )}


              <div
                className="
                  grid
                  gap-4
                  sm:grid-cols-2
                "
              >

                <div>

                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-semibold
                      text-slate-700
                    "
                  >
                    Date du relevé précédent
                  </label>


                  <div
                    className="
                      relative
                    "
                  >

                    <CalendarDays
                      size={17}
                      className="
                        pointer-events-none
                        absolute
                        left-3
                        top-1/2
                        -translate-y-1/2
                        text-slate-400
                      "
                    />


                    <input
                      type="date"
                      name="date_ancien_releve"
                      value={
                        form.date_ancien_releve
                      }
                      onChange={
                        handleChange
                      }
                      readOnly={
                        !isFirstReleve
                      }
                      disabled={
                        saving
                      }
                      className={`
                        w-full
                        rounded-2xl
                        border
                        px-4
                        py-3
                        pl-10
                        text-sm
                        outline-none
                        ${
                          isFirstReleve
                            ? `
                              border-slate-300
                              bg-slate-50
                              focus:border-blue-500
                              focus:bg-white
                            `
                            : `
                              cursor-not-allowed
                              border-slate-200
                              bg-slate-100
                              text-slate-500
                            `
                        }
                      `}
                    />

                  </div>


                  {!isFirstReleve && (

                    <p
                      className="
                        mt-1
                        text-xs
                        text-slate-400
                      "
                    >
                      Automatique
                      depuis le dernier relevé.
                    </p>

                  )}

                </div>


                <div>

                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-semibold
                      text-slate-700
                    "
                  >
                    Date du relevé actuel
                  </label>


                  <div
                    className="
                      relative
                    "
                  >

                    <CalendarDays
                      size={17}
                      className="
                        pointer-events-none
                        absolute
                        left-3
                        top-1/2
                        -translate-y-1/2
                        text-slate-400
                      "
                    />


                    <input
                      type="date"
                      name="date_releve"
                      value={
                        form.date_releve
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        saving
                      }
                      className="
                        w-full
                        rounded-2xl
                        border
                        border-slate-300
                        bg-slate-50
                        px-4
                        py-3
                        pl-10
                        text-sm
                        outline-none
                        focus:border-blue-500
                        focus:bg-white
                      "
                    />

                  </div>

                </div>

              </div>


              <div
                className="
                  grid
                  gap-4
                  sm:grid-cols-2
                "
              >

                <div>

                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-semibold
                      text-slate-700
                    "
                  >
                    Ancien index
                  </label>


                  <input
                    type="number"
                    min="0"
                    step="any"
                    name="ancien_index"
                    value={
                      form.ancien_index
                    }
                    onChange={
                      handleChange
                    }
                    readOnly={
                      !isFirstReleve
                    }
                    disabled={
                      saving
                    }
                    className={`
                      w-full
                      rounded-2xl
                      border
                      px-4
                      py-3
                      text-sm
                      outline-none
                      ${
                        isFirstReleve
                          ? `
                            border-slate-300
                            bg-slate-50
                            focus:border-blue-500
                            focus:bg-white
                          `
                          : `
                            cursor-not-allowed
                            border-slate-200
                            bg-slate-100
                            font-bold
                            text-slate-600
                          `
                      }
                    `}
                  />

                </div>


                <div>

                  <label
                    className="
                      mb-2
                      block
                      text-sm
                      font-semibold
                      text-slate-700
                    "
                  >
                    Nouvel index
                  </label>


                  <input
                    type="number"
                    min="0"
                    step="any"
                    name="nouvel_index"
                    value={
                      form.nouvel_index
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      saving ||
                      !selectedCompteur
                    }
                    placeholder="
                      Ex. 1253
                    "
                    className="
                      w-full
                      rounded-2xl
                      border
                      border-blue-300
                      bg-blue-50/30
                      px-4
                      py-3
                      text-sm
                      font-bold
                      text-slate-800
                      outline-none
                      focus:border-blue-500
                      focus:bg-white
                    "
                  />

                </div>

              </div>


              <div
                className="
                  rounded-2xl
                  border
                  border-slate-200
                  bg-slate-50
                  p-4
                "
              >

                <div
                  className="
                    flex
                    items-start
                    gap-3
                  "
                >

                  <Info
                    size={18}
                    className="
                      mt-0.5
                      shrink-0
                      text-blue-600
                    "
                  />


                  <div
                    className="
                      text-xs
                      leading-5
                      text-slate-500
                    "
                  >

                    <p
                      className="
                        font-semibold
                        text-slate-700
                      "
                    >
                      Règle de saisie
                    </p>

                    <p
                      className="
                        mt-1
                      "
                    >
                      Le nouvel index doit être
                      supérieur ou égal à
                      l’ancien index.
                      Pour un compteur déjà
                      relevé, l’ancien index
                      et la date précédente
                      sont récupérés automatiquement.
                    </p>

                  </div>

                </div>

              </div>


              <button
                type="submit"
                disabled={
                  saving ||
                  loading ||
                  !selectedCompteur
                }
                className="
                  inline-flex
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  bg-blue-600
                  px-5
                  py-3.5
                  text-sm
                  font-bold
                  text-white
                  hover:bg-blue-700
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >

                <Save size={18} />

                {
                  saving
                    ? 'Enregistrement…'
                    : 'Enregistrer le relevé'
                }

              </button>

            </form>

          </div>


          {/* HISTORIQUE */}

          <div
            className="
              rounded-3xl
              border
              border-slate-200
              bg-white
              p-5
              shadow-sm
              sm:p-6
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
                  rounded-2xl
                  bg-slate-100
                  p-3
                  text-slate-700
                "
              >
                <History size={21} />
              </div>


              <div>

                <h3
                  className="
                    font-bold
                    text-slate-900
                  "
                >
                  Historique du compteur
                </h3>

                <p
                  className="
                    text-sm
                    text-slate-500
                  "
                >
                  {
                    historyLoading
                      ? 'Chargement…'
                      : `${historique.length} relevé(s)`
                  }
                </p>

              </div>

            </div>


            <div
              className="
                mt-5
                overflow-hidden
                rounded-2xl
                border
                border-slate-200
              "
            >

              <div
                className="
                  max-h-[620px]
                  overflow-auto
                "
              >

                {historyLoading ? (

                  <div
                    className="
                      px-4
                      py-12
                      text-center
                      text-sm
                      text-slate-500
                    "
                  >
                    Chargement…
                  </div>

                ) : historique.length ===
                  0 ? (

                  <div
                    className="
                      px-4
                      py-12
                      text-center
                      text-sm
                      text-slate-500
                    "
                  >
                    Aucun relevé pour
                    ce compteur.
                    Il s’agit du premier relevé.
                  </div>

                ) : (

                  <div
                    className="
                      divide-y
                      divide-slate-100
                    "
                  >

                    {historique.map(
                      (
                        item
                      ) => (

                        <div
                          key={
                            item.id
                          }
                          className="
                            p-4
                          "
                        >

                          <div
                            className="
                              flex
                              items-start
                              justify-between
                              gap-4
                            "
                          >

                            <div>

                              <p
                                className="
                                  text-sm
                                  font-bold
                                  text-slate-800
                                "
                              >
                                {
                                  formatDate(
                                    item.date_releve
                                  )
                                }
                              </p>

                              <p
                                className="
                                  mt-1
                                  text-xs
                                  text-slate-400
                                "
                              >
                                Relevé #
                                {
                                  item.id
                                }
                              </p>

                            </div>


                            <span
                              className="
                                rounded-full
                                bg-blue-50
                                px-2.5
                                py-1
                                text-[11px]
                                font-bold
                                text-blue-700
                              "
                            >
                              {
                                formatNumber(
                                  item.consommation
                                )
                              }{' '}
                              {
                                item.unite || ''
                              }
                            </span>

                          </div>


                          <div
                            className="
                              mt-3
                              grid
                              grid-cols-2
                              gap-3
                              text-xs
                            "
                          >

                            <div
                              className="
                                rounded-xl
                                bg-slate-50
                                p-3
                              "
                            >

                              <p
                                className="
                                  text-slate-400
                                "
                              >
                                Ancien index
                              </p>

                              <p
                                className="
                                  mt-1
                                  font-bold
                                  text-slate-700
                                "
                              >
                                {
                                  formatNumber(
                                    item.ancien_index
                                  )
                                }
                              </p>

                            </div>


                            <div
                              className="
                                rounded-xl
                                bg-blue-50
                                p-3
                              "
                            >

                              <p
                                className="
                                  text-blue-500
                                "
                              >
                                Nouvel index
                              </p>

                              <p
                                className="
                                  mt-1
                                  font-bold
                                  text-blue-700
                                "
                              >
                                {
                                  formatNumber(
                                    item.nouvel_index
                                  )
                                }
                              </p>

                            </div>

                          </div>

                        </div>

                      )
                    )}

                  </div>

                )}

              </div>

            </div>

          </div>

        </section>

      </div>

    </AgentLayout>

  );
}

export default AgentRelevesPage;