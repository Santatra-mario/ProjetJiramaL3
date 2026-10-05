import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Plus,
  Search,
  Pencil,
  Power,
  X,
  Save,
  RefreshCw,
  Gauge,
  Droplets,
  Zap,
  CalendarDays,
  UserRound,
} from 'lucide-react';

import axiosClient from '../../api/axiosClient.js';

import Sidebar from '../../components/admin/Sidebar.jsx';
import Header from '../../components/admin/Header.jsx';

function CompteursPage() {
  const navigate = useNavigate();

  const [compteurs, setCompteurs] = useState([]);
  const [abonnes, setAbonnes] = useState([]);

  const [currentUser, setCurrentUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [loadingAbonnes, setLoadingAbonnes] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [search, setSearch] =
    useState('');

  const [typeFilter, setTypeFilter] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState('');

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingCompteur, setEditingCompteur] =
    useState(null);

  const [form, setForm] = useState({
    numero_compteur: '',
    type: 'ELECTRICITE',
    date_installation: '',
    statut: 'ACTIF',
    abonne_id: '',
  });

  // =====================================================
  // UTILISATEUR CONNECTÉ
  // =====================================================

  useEffect(() => {
    const storedUser =
      localStorage.getItem('user');

    if (!storedUser) {
      navigate('/', {
        replace: true,
      });

      return;
    }

    try {
      const user =
        JSON.parse(storedUser);

      if (
        user.role !==
        'ADMINISTRATEUR'
      ) {
        navigate('/', {
          replace: true,
        });

        return;
      }

      setCurrentUser(user);
    } catch (error) {
      console.error(
        'Erreur utilisateur :',
        error
      );

      localStorage.removeItem('token');
      localStorage.removeItem('user');

      navigate('/', {
        replace: true,
      });
    }
  }, [navigate]);

  // =====================================================
  // CHARGER LES COMPTEURS
  // =====================================================

  const loadCompteurs = async () => {
    try {
      setLoading(true);
      setError('');

      const response =
        await axiosClient.get(
          '/compteurs'
        );

      setCompteurs(
        response.data.compteurs || []
      );
    } catch (err) {
      console.error(
        'Erreur chargement compteurs :',
        err
      );

      if (
        err.response?.status === 401
      ) {
        localStorage.removeItem(
          'token'
        );

        localStorage.removeItem(
          'user'
        );

        navigate('/', {
          replace: true,
        });

        return;
      }

      setError(
        err.response?.data?.message ||
          'Impossible de charger les compteurs.'
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // CHARGER LES ABONNÉS
  // =====================================================

  const loadAbonnes = async () => {
    try {
      setLoadingAbonnes(true);

      const response =
        await axiosClient.get(
          '/abonnes'
        );

      setAbonnes(
        response.data.abonnes || []
      );
    } catch (err) {
      console.error(
        'Erreur chargement abonnés :',
        err
      );

      setError(
        err.response?.data?.message ||
          'Impossible de charger la liste des abonnés.'
      );
    } finally {
      setLoadingAbonnes(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadCompteurs();
      loadAbonnes();
    }
  }, [currentUser]);

  // =====================================================
  // FILTRAGE
  // =====================================================

  const filteredCompteurs = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return compteurs.filter(
      (compteur) => {
        const nomAbonne =
          `${compteur.abonne_prenom || ''} ${
            compteur.abonne_nom || ''
          }`
            .trim()
            .toLowerCase();

        const matchesSearch =
          !query ||
          [
            compteur.numero_compteur,
            compteur.type,
            compteur.numero_abonne,
            nomAbonne,
          ].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(query)
          );

        const matchesType =
          !typeFilter ||
          compteur.type ===
            typeFilter;

        const matchesStatus =
          !statusFilter ||
          compteur.statut ===
            statusFilter;

        return (
          matchesSearch &&
          matchesType &&
          matchesStatus
        );
      }
    );
  }, [
    compteurs,
    search,
    typeFilter,
    statusFilter,
  ]);

  // =====================================================
  // OUVRIR AJOUT
  // =====================================================

  const openCreateModal = () => {
    setEditingCompteur(null);

    setForm({
      numero_compteur: '',
      type: 'ELECTRICITE',
      date_installation: '',
      statut: 'ACTIF',
      abonne_id: '',
    });

    setError('');
    setSuccess('');

    setModalOpen(true);
  };

  // =====================================================
  // OUVRIR MODIFICATION
  // =====================================================

  const openEditModal = (
    compteur
  ) => {
    setEditingCompteur(
      compteur
    );

    setForm({
      numero_compteur:
        compteur.numero_compteur ||
        '',
      type:
        compteur.type ||
        'ELECTRICITE',
      date_installation:
        compteur.date_installation
          ? String(
              compteur.date_installation
            ).slice(0, 10)
          : '',
      statut:
        compteur.statut ||
        'ACTIF',
      abonne_id:
        String(
          compteur.abonne_id ||
            ''
        ),
    });

    setError('');
    setSuccess('');

    setModalOpen(true);
  };

  // =====================================================
  // FERMER MODAL
  // =====================================================

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setEditingCompteur(null);
  };

  // =====================================================
  // FORMULAIRE
  // =====================================================

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setForm(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );
  };

  // =====================================================
  // ENREGISTRER
  // =====================================================

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      if (!form.abonne_id) {
        setError(
          'Veuillez sélectionner un abonné.'
        );

        setSaving(false);

        return;
      }

      const data = {
        numero_compteur:
          form.numero_compteur.trim(),

        type: form.type,

        date_installation:
          form.date_installation ||
          null,

        statut: form.statut,

        abonne_id: Number(
          form.abonne_id
        ),
      };

      let response;

      if (editingCompteur) {
        response =
          await axiosClient.put(
            `/compteurs/${editingCompteur.id}`,
            data
          );
      } else {
        response =
          await axiosClient.post(
            '/compteurs',
            data
          );
      }

      setSuccess(
        response.data.message ||
          'Compteur enregistré avec succès.'
      );

      await loadCompteurs();

      setTimeout(() => {
        setModalOpen(false);
        setEditingCompteur(
          null
        );
      }, 500);
    } catch (err) {
      console.error(
        'Erreur enregistrement compteur :',
        err
      );

      setError(
        err.response?.data?.message ||
          'Une erreur est survenue.'
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // MODIFIER LE STATUT
  // =====================================================

  const changeStatus = async (
    compteur,
    nouveauStatut
  ) => {
    const labels = {
      ACTIF: 'ACTIF',
      INACTIF: 'INACTIF',
      A_VERIFIER: 'À VÉRIFIER',
    };

    const confirmed =
      window.confirm(
        `Voulez-vous mettre le compteur ${compteur.numero_compteur} au statut "${labels[nouveauStatut]}" ?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError('');
      setSuccess('');

      const response =
        await axiosClient.patch(
          `/compteurs/${compteur.id}/statut`,
          {
            statut: nouveauStatut,
          }
        );

      setSuccess(
        response.data.message ||
          'Statut modifié avec succès.'
      );

      await loadCompteurs();
    } catch (err) {
      console.error(
        'Erreur changement statut :',
        err
      );

      setError(
        err.response?.data?.message ||
          'Impossible de modifier le statut.'
      );
    }
  };

  // =====================================================
  // DÉCONNEXION
  // =====================================================

  const handleLogout = () => {
    localStorage.removeItem(
      'token'
    );

    localStorage.removeItem(
      'user'
    );

    navigate('/', {
      replace: true,
    });
  };

  // =====================================================
  // CHARGEMENT INITIAL
  // =====================================================

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-xl bg-white px-6 py-5 text-sm text-slate-500 shadow-sm">
          Chargement...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
        activePath="/dashboard/admin/compteurs"
        onNavigate={navigate}
        onLogout={handleLogout}
        user={currentUser}
      />

      <div className="lg:pl-72">

        {/* =================================================
            HEADER
        ================================================= */}

        <Header
          onOpenSidebar={() =>
            setSidebarOpen(true)
          }
          onProfile={() =>
            navigate(
              '/dashboard/admin'
            )
          }
          user={currentUser}
        />

        <main className="p-4 sm:p-6 lg:p-8">

          {/* =================================================
              TITRE
          ================================================= */}

          <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Administration
              </p>

              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Gestion des compteurs
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Gestion des compteurs d'eau et
                d'électricité associés aux abonnés.
              </p>
            </div>

            <button
              type="button"
              onClick={
                openCreateModal
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={18} />
              Ajouter un compteur
            </button>

          </div>

          {/* =================================================
              MESSAGES
          ================================================= */}

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {success}
            </div>
          )}

          {/* =================================================
              FILTRES
          ================================================= */}

          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

              {/* Recherche */}
              <div className="relative">

                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Rechercher un compteur..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />

              </div>

              {/* Type */}
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="">
                  Tous les types
                </option>

                <option value="ELECTRICITE">
                  Électricité
                </option>

                <option value="EAU">
                  Eau
                </option>
              </select>

              {/* Statut */}
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="">
                  Tous les statuts
                </option>

                <option value="ACTIF">
                  Actif
                </option>

                <option value="INACTIF">
                  Inactif
                </option>

                <option value="A_VERIFIER">
                  À vérifier
                </option>
              </select>

            </div>
          </section>

          {/* =================================================
              TABLEAU
          ================================================= */}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">

              <div>
                <h2 className="font-bold text-slate-900">
                  Liste des compteurs
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {filteredCompteurs.length}{' '}
                  compteur(s)
                </p>
              </div>

              <button
                type="button"
                onClick={
                  loadCompteurs
                }
                className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                title="Actualiser"
              >
                <RefreshCw
                  size={18}
                  className={
                    loading
                      ? 'animate-spin'
                      : ''
                  }
                />
              </button>

            </div>

            <div className="overflow-x-auto">

              <table className="min-w-[1100px] w-full">

                <thead className="bg-slate-50">
                  <tr>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Compteur
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Type
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Abonné
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Installation
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Statut
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {loading ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        Chargement des compteurs...
                      </td>
                    </tr>
                  ) : filteredCompteurs.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        Aucun compteur trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredCompteurs.map(
                      (compteur) => (
                        <tr
                          key={compteur.id}
                          className="transition hover:bg-slate-50"
                        >

                          {/* Compteur */}
                          <td className="px-5 py-4">

                            <div className="flex items-center gap-3">

                              <div
                                className={`rounded-xl p-2.5 ${
                                  compteur.type ===
                                  'EAU'
                                    ? 'bg-cyan-50'
                                    : 'bg-amber-50'
                                }`}
                              >
                                {compteur.type ===
                                'EAU' ? (
                                  <Droplets
                                    size={19}
                                    className="text-cyan-600"
                                  />
                                ) : (
                                  <Zap
                                    size={19}
                                    className="text-amber-600"
                                  />
                                )}
                              </div>

                              <div>
                                <p className="font-bold text-slate-800">
                                  {
                                    compteur.numero_compteur
                                  }
                                </p>

                                <p className="text-xs text-slate-400">
                                  ID #
                                  {
                                    compteur.id
                                  }
                                </p>
                              </div>

                            </div>

                          </td>

                          {/* Type */}
                          <td className="px-5 py-4">

                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                              {compteur.type ===
                              'EAU'
                                ? '💧 Eau'
                                : '⚡ Électricité'}
                            </span>

                          </td>

                          {/* Abonné */}
                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2">

                              <UserRound
                                size={16}
                                className="text-slate-400"
                              />

                              <div>
                                <p className="text-sm font-semibold text-slate-700">
                                  {compteur.abonne_prenom
                                    ? `${compteur.abonne_prenom} ${compteur.abonne_nom}`
                                    : compteur.abonne_nom}
                                </p>

                                <p className="text-xs text-slate-400">
                                  {
                                    compteur.numero_abonne
                                  }
                                </p>
                              </div>

                            </div>

                          </td>

                          {/* Date */}
                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2 text-sm text-slate-600">

                              <CalendarDays
                                size={15}
                                className="text-slate-400"
                              />

                              <span>
                                {compteur.date_installation
                                  ? new Date(
                                      compteur.date_installation
                                    ).toLocaleDateString(
                                      'fr-FR'
                                    )
                                  : 'Non renseignée'}
                              </span>

                            </div>

                          </td>

                          {/* Statut */}
                          <td className="px-5 py-4">

                            <StatusBadge
                              status={
                                compteur.statut
                              }
                            />

                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4">

                            <div className="flex justify-end gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  openEditModal(
                                    compteur
                                  )
                                }
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600"
                                title="Modifier"
                              >
                                <Pencil
                                  size={17}
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  changeStatus(
                                    compteur,
                                    compteur.statut ===
                                      'ACTIF'
                                      ? 'INACTIF'
                                      : 'ACTIF'
                                  )
                                }
                                className={`rounded-lg p-2 transition ${
                                  compteur.statut ===
                                  'ACTIF'
                                    ? 'text-slate-500 hover:bg-red-50 hover:text-red-600'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={
                                  compteur.statut ===
                                  'ACTIF'
                                    ? 'Désactiver'
                                    : 'Activer'
                                }
                              >
                                <Power
                                  size={17}
                                />
                              </button>

                            </div>

                          </td>

                        </tr>
                      )
                    )
                  )}

                </tbody>
              </table>

            </div>
          </section>

        </main>
      </div>

      {/* =================================================
          MODAL
      ================================================= */}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">

          <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            {/* Header modal */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingCompteur
                    ? 'Modifier un compteur'
                    : 'Ajouter un compteur'}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Associer un compteur à un abonné.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={20} />
              </button>

            </div>

            {/* Formulaire */}
            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-5 p-6"
            >

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                {/* Numéro */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Numéro du compteur
                  </label>

                  <input
                    type="text"
                    name="numero_compteur"
                    value={
                      form.numero_compteur
                    }
                    onChange={
                      handleChange
                    }
                    required
                    placeholder="Ex. ELEC-0001"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Type
                  </label>

                  <select
                    name="type"
                    value={
                      form.type
                    }
                    onChange={
                      handleChange
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="ELECTRICITE">
                      Électricité
                    </option>

                    <option value="EAU">
                      Eau
                    </option>
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Date d'installation
                  </label>

                  <input
                    type="date"
                    name="date_installation"
                    value={
                      form.date_installation
                    }
                    onChange={
                      handleChange
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {/* Statut */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Statut
                  </label>

                  <select
                    name="statut"
                    value={
                      form.statut
                    }
                    onChange={
                      handleChange
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="ACTIF">
                      Actif
                    </option>

                    <option value="INACTIF">
                      Inactif
                    </option>

                    <option value="A_VERIFIER">
                      À vérifier
                    </option>
                  </select>
                </div>

                {/* Abonné */}
                <div className="sm:col-span-2">

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Abonné
                  </label>

                  <select
                    name="abonne_id"
                    value={
                      form.abonne_id
                    }
                    onChange={
                      handleChange
                    }
                    required
                    disabled={
                      loadingAbonnes
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                  >

                    <option value="">
                      {loadingAbonnes
                        ? 'Chargement des abonnés...'
                        : 'Sélectionner un abonné'}
                    </option>

                    {abonnes
                      .filter(
                        (abonne) =>
                          abonne.statut ===
                          'actif'
                      )
                      .map(
                        (abonne) => (
                          <option
                            key={
                              abonne.id
                            }
                            value={
                              abonne.id
                            }
                          >
                            {abonne.numero_abonne}
                            {' - '}
                            {abonne.prenom
                              ? `${abonne.prenom} ${abonne.nom}`
                              : abonne.nom}
                          </option>
                        )
                      )}

                  </select>

                  <p className="mt-1 text-xs text-slate-400">
                    Seuls les abonnés actifs peuvent recevoir un compteur.
                  </p>

                </div>

              </div>

              {/* Erreur */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Boutons */}
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">

                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving
                  }
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    loadingAbonnes
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Save
                      size={17}
                    />
                  )}

                  {saving
                    ? 'Enregistrement...'
                    : editingCompteur
                    ? 'Enregistrer'
                    : 'Créer le compteur'}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}
    </div>
  );
}

// ======================================================
// BADGE STATUT
// ======================================================

function StatusBadge({
  status,
}) {
  const config = {
    ACTIF: {
      label: 'Actif',
      className:
        'bg-emerald-50 text-emerald-700',
    },

    INACTIF: {
      label: 'Inactif',
      className:
        'bg-slate-100 text-slate-500',
    },

    A_VERIFIER: {
      label: 'À vérifier',
      className:
        'bg-amber-50 text-amber-700',
    },
  };

  const current =
    config[status] ||
    config.ACTIF;

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${current.className}`}
    >
      {current.label}
    </span>
  );
}

export default CompteursPage;