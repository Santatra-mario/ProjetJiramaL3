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
  UserRound,
  MapPin,
  Phone,
} from 'lucide-react';

import axiosClient from '../../api/axiosClient.js';
import Sidebar from '../../components/admin/Sidebar.jsx';
import Header from '../../components/admin/Header.jsx';

function AbonnesPage() {
  const navigate = useNavigate();

  const [abonnes, setAbonnes] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAbonne, setEditingAbonne] = useState(null);

  const [form, setForm] = useState({
    numero_abonne: '',
    nom: '',
    prenom: '',
    adresse: '',
    telephone: '',
  });

  /* ======================================================
     UTILISATEUR CONNECTÉ
  ====================================================== */
  useEffect(() => {
    const storedUser = localStorage.getItem('user');

    if (!storedUser) {
      navigate('/', { replace: true });
      return;
    }

    try {
      const user = JSON.parse(storedUser);

      if (user.role !== 'ADMINISTRATEUR') {
        navigate('/', { replace: true });
        return;
      }

      setCurrentUser(user);
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      navigate('/', { replace: true });
    }
  }, [navigate]);

  /* ======================================================
     CHARGER LES ABONNÉS
  ====================================================== */
  const loadAbonnes = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axiosClient.get('/abonnes');

      setAbonnes(response.data.abonnes || []);
    } catch (err) {
      console.error(
        'Erreur chargement abonnés :',
        err
      );

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        navigate('/', { replace: true });
        return;
      }

      if (err.response?.status === 403) {
        setError(
          'Vous n’avez pas les droits pour accéder à cette page.'
        );
        return;
      }

      setError(
        err.response?.data?.message ||
          'Impossible de charger les abonnés.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadAbonnes();
    }
  }, [currentUser]);

  /* ======================================================
     FILTRAGE
  ====================================================== */
  const filteredAbonnes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return abonnes.filter((abonne) => {
      const matchesSearch =
        !query ||
        [
          abonne.numero_abonne,
          abonne.nom,
          abonne.prenom,
          abonne.adresse,
          abonne.telephone,
        ].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(query)
        );

      const matchesStatus =
        !statusFilter ||
        abonne.statut === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    abonnes,
    search,
    statusFilter,
  ]);

  /* ======================================================
     AJOUT
  ====================================================== */
  const openCreateModal = () => {
    setEditingAbonne(null);

    setForm({
      numero_abonne: '',
      nom: '',
      prenom: '',
      adresse: '',
      telephone: '',
    });

    setError('');
    setSuccess('');

    setModalOpen(true);
  };

  /* ======================================================
     MODIFICATION
  ====================================================== */
  const openEditModal = (abonne) => {
    setEditingAbonne(abonne);

    setForm({
      numero_abonne:
        abonne.numero_abonne || '',
      nom: abonne.nom || '',
      prenom: abonne.prenom || '',
      adresse: abonne.adresse || '',
      telephone: abonne.telephone || '',
    });

    setError('');
    setSuccess('');

    setModalOpen(true);
  };

  /* ======================================================
     FERMER MODAL
  ====================================================== */
  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingAbonne(null);
  };

  /* ======================================================
     CHANGEMENT FORMULAIRE
  ====================================================== */
  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* ======================================================
     ENREGISTRER
  ====================================================== */
  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const data = {
        numero_abonne:
          form.numero_abonne.trim(),
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        adresse: form.adresse.trim(),
        telephone: form.telephone.trim(),
      };

      let response;

      if (editingAbonne) {
        response = await axiosClient.put(
          `/abonnes/${editingAbonne.id}`,
          data
        );
      } else {
        response = await axiosClient.post(
          '/abonnes',
          data
        );
      }

      setSuccess(
        response.data.message ||
          'Opération réalisée avec succès.'
      );

      await loadAbonnes();

      setTimeout(() => {
        setModalOpen(false);
        setEditingAbonne(null);
      }, 500);
    } catch (err) {
      console.error(
        'Erreur enregistrement abonné :',
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

  /* ======================================================
     ACTIVER / DÉSACTIVER
  ====================================================== */
  const toggleStatus = async (abonne) => {
    const action =
      abonne.statut === 'actif'
        ? 'désactiver'
        : 'réactiver';

    const confirmed = window.confirm(
      `Voulez-vous vraiment ${action} l’abonné ${abonne.numero_abonne} ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError('');
      setSuccess('');

      const response =
        await axiosClient.patch(
          `/abonnes/${abonne.id}/statut`
        );

      setSuccess(
        response.data.message ||
          'Statut modifié avec succès.'
      );

      await loadAbonnes();
    } catch (err) {
      console.error(
        'Erreur statut abonné :',
        err
      );

      setError(
        err.response?.data?.message ||
          'Impossible de modifier le statut.'
      );
    }
  };

  /* ======================================================
     DÉCONNEXION
  ====================================================== */
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    navigate('/', {
      replace: true,
    });
  };

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

      {/* SIDEBAR */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
        activePath="/dashboard/admin/abonnes"
        onNavigate={navigate}
        onLogout={handleLogout}
        user={currentUser}
      />

      <div className="lg:pl-72">

        {/* HEADER */}
        <Header
          onOpenSidebar={() =>
            setSidebarOpen(true)
          }
          onProfile={() =>
            navigate('/dashboard/admin')
          }
          user={currentUser}
        />

        <main className="p-4 sm:p-6 lg:p-8">

          {/* TITRE */}
          <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Administration
              </p>

              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Gestion des abonnés
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Gérer les abonnés utilisés pour le suivi
                des consommations.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={18} />
              Ajouter un abonné
            </button>
          </div>

          {/* MESSAGES */}
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

          {/* FILTRES */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Rechercher un abonné..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

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

                <option value="actif">
                  Actif
                </option>

                <option value="inactif">
                  Inactif
                </option>
              </select>

            </div>
          </section>

          {/* TABLE */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-bold text-slate-900">
                  Liste des abonnés
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {filteredAbonnes.length} abonné(s)
                </p>
              </div>

              <button
                type="button"
                onClick={loadAbonnes}
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

              <table className="min-w-[1000px] w-full">

                <thead className="bg-slate-50">
                  <tr>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Numéro
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Abonné
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Adresse
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Téléphone
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
                        Chargement des abonnés...
                      </td>
                    </tr>
                  ) : filteredAbonnes.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        Aucun abonné trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredAbonnes.map(
                      (abonne) => (
                        <tr
                          key={abonne.id}
                          className="transition hover:bg-slate-50"
                        >

                          <td className="px-5 py-4">
                            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
                              {abonne.numero_abonne}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
                                <UserRound
                                  size={18}
                                  className="text-slate-500"
                                />
                              </div>

                              <div>
                                <p className="font-semibold text-slate-800">
                                  {abonne.prenom
                                    ? `${abonne.prenom} ${abonne.nom}`
                                    : abonne.nom}
                                </p>

                                <p className="text-xs text-slate-400">
                                  ID #{abonne.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <MapPin
                                size={15}
                                className="text-slate-400"
                              />

                              <span>
                                {abonne.adresse ||
                                  'Non renseignée'}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone
                                size={15}
                                className="text-slate-400"
                              />

                              <span>
                                {abonne.telephone ||
                                  'Non renseigné'}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              status={abonne.statut}
                            />
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  openEditModal(
                                    abonne
                                  )
                                }
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600"
                                title="Modifier"
                              >
                                <Pencil size={17} />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleStatus(
                                    abonne
                                  )
                                }
                                className={`rounded-lg p-2 transition ${
                                  abonne.statut ===
                                  'actif'
                                    ? 'text-slate-500 hover:bg-red-50 hover:text-red-600'
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={
                                  abonne.statut ===
                                  'actif'
                                    ? 'Désactiver'
                                    : 'Réactiver'
                                }
                              >
                                <Power size={17} />
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

      {/* ==================================================
          MODAL AJOUT / MODIFICATION
      ================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">

          <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingAbonne
                    ? 'Modifier un abonné'
                    : 'Ajouter un abonné'}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Renseignez les informations de l’abonné.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Numéro d’abonné
                  </label>

                  <input
                    type="text"
                    name="numero_abonne"
                    value={form.numero_abonne}
                    onChange={handleChange}
                    required
                    placeholder="Ex. ABN-0001"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Nom
                  </label>

                  <input
                    type="text"
                    name="nom"
                    value={form.nom}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Prénom
                  </label>

                  <input
                    type="text"
                    name="prenom"
                    value={form.prenom}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Téléphone
                  </label>

                  <input
                    type="text"
                    name="telephone"
                    value={form.telephone}
                    onChange={handleChange}
                    placeholder="Ex. 034 XX XXX XX"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Adresse
                  </label>

                  <textarea
                    name="adresse"
                    value={form.adresse}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Adresse de l’abonné..."
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={17} />
                  )}

                  {saving
                    ? 'Enregistrement...'
                    : editingAbonne
                    ? 'Enregistrer'
                    : 'Créer l’abonné'}
                </button>

              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   BADGE STATUT
========================================================= */
function StatusBadge({ status }) {
  const actif = status === 'actif';

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
        actif
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-500'
      }`}
    >
      {actif ? 'Actif' : 'Inactif'}
    </span>
  );
}

export default AbonnesPage;