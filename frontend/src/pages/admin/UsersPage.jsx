import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Plus,
  Search,
  Pencil,
  Power,
  UserRound,
  ShieldCheck,
  ShieldAlert,
  X,
  Save,
  RefreshCw,
} from 'lucide-react';

import axiosClient from '../../api/axiosClient.js';
import Sidebar from '../../components/admin/Sidebar.jsx';
import Header from '../../components/admin/Header.jsx';
import AdminShell from '../../components/admin/AdminShell.jsx';
import {
  EtatErreur,
  EtatVide,
  SqueletteLignes,
} from '../../components/admin/utilisateurs/EtatsAnnuaire.jsx';

function UsersPage() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    identifiant: '',
    email: '',
    mot_de_passe: '',
    role: 'AGENT',
  });

  /*
  =========================================================
  UTILISATEUR CONNECTÉ
  =========================================================
  */
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
    } catch (err) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      navigate('/', { replace: true });
    }
  }, [navigate]);

  /*
  =========================================================
  CHARGER LES UTILISATEURS
  =========================================================
  */
  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axiosClient.get('/users');

      setUsers(response.data.users || []);
    } catch (err) {
      console.error(
        'Erreur chargement utilisateurs :',
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
          'Impossible de charger les utilisateurs.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadUsers();
    }
  }, [currentUser]);

  /*
  =========================================================
  FILTRAGE
  =========================================================
  */
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        [
          user.nom,
          user.prenom,
          user.identifiant,
          user.email,
          user.role,
        ].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(query)
        );

      const matchesRole =
        !roleFilter ||
        user.role === roleFilter;

      const matchesStatus =
        !statusFilter ||
        user.statut === statusFilter;

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });
  }, [
    users,
    search,
    roleFilter,
    statusFilter,
  ]);

  /*
  =========================================================
  OUVRIR MODAL AJOUT
  =========================================================
  */
  const openCreateModal = () => {
    setEditingUser(null);

    setForm({
      nom: '',
      prenom: '',
      identifiant: '',
      email: '',
      mot_de_passe: '',
      role: 'AGENT',
    });

    setError('');
    setSuccess('');

    setModalOpen(true);
  };

  /*
  =========================================================
  OUVRIR MODAL MODIFICATION
  =========================================================
  */
  const openEditModal = (user) => {
    setEditingUser(user);

    setForm({
      nom: user.nom || '',
      prenom: user.prenom || '',
      identifiant: user.identifiant || '',
      email: user.email || '',
      mot_de_passe: '',
      role: user.role || 'AGENT',
    });

    setError('');
    setSuccess('');

    setModalOpen(true);
  };

  /*
  =========================================================
  FERMER MODAL
  =========================================================
  */
  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingUser(null);
  };

  /*
  =========================================================
  CHANGEMENT FORMULAIRE
  =========================================================
  */
  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /*
  =========================================================
  ENREGISTRER
  =========================================================
  */
  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');
    setSaving(true);

    try {
      if (editingUser) {
        /*
        -----------------------------------------------
        MODIFICATION
        -----------------------------------------------
        */
        const response =
          await axiosClient.put(
            `/users/${editingUser.id}`,
            {
              nom: form.nom,
              prenom: form.prenom,
              identifiant: form.identifiant,
              email: form.email,
            }
          );

        /*
        Modification du rôle séparément
        */
        if (
          form.role !== editingUser.role
        ) {
          await axiosClient.patch(
            `/users/${editingUser.id}/role`,
            {
              role: form.role,
            }
          );
        }

        setSuccess(
          response.data.message ||
            'Utilisateur modifié avec succès.'
        );
      } else {
        /*
        -----------------------------------------------
        CRÉATION
        -----------------------------------------------
        */
        const response =
          await axiosClient.post(
            '/users/register',
            {
              nom: form.nom,
              prenom: form.prenom,
              identifiant: form.identifiant,
              email: form.email,
              mot_de_passe:
                form.mot_de_passe,
              role: form.role,
            }
          );

        setSuccess(
          response.data.message ||
            'Utilisateur créé avec succès.'
        );
      }

      await loadUsers();

      setTimeout(() => {
        setModalOpen(false);
        setEditingUser(null);
      }, 500);
    } catch (err) {
      console.error(
        'Erreur enregistrement utilisateur :',
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

  /*
  =========================================================
  ACTIVER / DÉSACTIVER
  =========================================================
  */
  const toggleStatus = async (user) => {
    if (user.id === currentUser?.id) {
      setError(
        'Vous ne pouvez pas désactiver votre propre compte.'
      );
      return;
    }

    const action =
      user.statut === 'actif'
        ? 'désactiver'
        : 'réactiver';

    const confirmed = window.confirm(
      `Voulez-vous vraiment ${action} le compte de ${user.prenom} ${user.nom} ?`
    );

    if (!confirmed) return;

    try {
      setError('');
      setSuccess('');

      const response =
        await axiosClient.patch(
          `/users/${user.id}/statut`
        );

      setSuccess(
        response.data.message ||
          'Statut modifié avec succès.'
      );

      await loadUsers();
    } catch (err) {
      console.error(
        'Erreur modification statut :',
        err
      );

      setError(
        err.response?.data?.message ||
          'Impossible de modifier le statut.'
      );
    }
  };

  /*
  =========================================================
  DÉCONNEXION
  =========================================================
  */
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    navigate('/', {
      replace: true,
    });
  };

  /*
  =========================================================
  NAVIGATION
  =========================================================
  */
  const handleNavigate = (path) => {
    navigate(path);
  };

  // Échec du chargement initial : l'erreur s'affiche dans l'annuaire
  const erreurChargement =
    Boolean(error) && !loading && users.length === 0 && !modalOpen;

  if (!currentUser) {
    return (
      <AdminShell>
        <div className="flex min-h-screen items-center justify-center">
          <div className="jr-verre rounded-xl border border-jr-bordure px-6 py-5 text-sm text-jr-doux shadow-sm">
            Chargement...
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>

      {/* SIDEBAR */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
        activePath="/dashboard/admin/utilisateurs"
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={currentUser}
      />

      {/* CONTENU */}
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
                Gestion des utilisateurs
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Créer, consulter, modifier et gérer
                les comptes utilisateurs.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-jr-eau px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-jr-eau-fonce focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-jr-elec"
            >
              <Plus size={18} />
              Ajouter un utilisateur
            </button>
          </div>

          {/* MESSAGES */}
          {error && !erreurChargement && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </div>
          )}

          {success && (
            <div role="status" className="mb-5 rounded-xl border border-jr-ok bg-jr-ok-pale px-4 py-3 text-sm font-medium text-jr-ok">
              {success}
            </div>
          )}

          {/* FILTRES */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

              {/* Recherche */}
              <div className="relative md:col-span-1">
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
                  placeholder="Rechercher..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-jr-eau focus:bg-jr-surface focus:ring-4 focus:ring-jr-focus-anneau"
                />
              </div>

              {/* Rôle */}
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value)
                }
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-jr-eau focus:bg-jr-surface focus:ring-4 focus:ring-jr-focus-anneau"
              >
                <option value="">
                  Tous les rôles
                </option>

                <option value="ADMINISTRATEUR">
                  Administrateur
                </option>

                <option value="AGENT">
                  Agent
                </option>

                <option value="RESPONSABLE">
                  Responsable
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
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-jr-eau focus:bg-jr-surface focus:ring-4 focus:ring-jr-focus-anneau"
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

          {/* TABLEAU */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h2 className="font-bold text-slate-900">
                  Utilisateurs
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {filteredUsers.length} utilisateur(s)
                </p>
              </div>

              <button
                type="button"
                onClick={loadUsers}
                className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-jr-lien focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec"
                title="Actualiser"
                aria-label="Actualiser la liste"
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
                      Utilisateur
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Identifiant
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      E-mail
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Rôle
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Statut
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100" aria-busy={loading}>

                  {loading ? (
                    <SqueletteLignes />
                  ) : erreurChargement ? (
                    <EtatErreur message={error} onReessayer={loadUsers} />
                  ) : filteredUsers.length === 0 ? (
                    <EtatVide
                      filtre={users.length > 0}
                      onAjouter={openCreateModal}
                      onReinitialiser={() => {
                        setSearch('');
                        setRoleFilter('');
                        setStatusFilter('');
                      }}
                    />
                  ) : (
                    filteredUsers.map(
                      (user) => (
                        <tr
                          key={user.id}
                          className="transition hover:bg-slate-50"
                        >

                          {/* Utilisateur */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">
                                {user.prenom?.charAt(0)}
                                {user.nom?.charAt(0)}
                              </div>

                              <div>
                                <p className="font-semibold text-slate-800">
                                  {user.prenom}{' '}
                                  {user.nom}
                                </p>

                                <p className="text-xs text-slate-400">
                                  ID #{user.id}
                                </p>
                              </div>

                            </div>
                          </td>

                          {/* Identifiant */}
                          <td className="px-5 py-4 text-sm text-slate-600">
                            {user.identifiant}
                          </td>

                          {/* Email */}
                          <td className="px-5 py-4 text-sm text-slate-600">
                            {user.email}
                          </td>

                          {/* Rôle */}
                          <td className="px-5 py-4">
                            <RoleBadge
                              role={user.role}
                            />
                          </td>

                          {/* Statut */}
                          <td className="px-5 py-4">
                            <StatusBadge
                              status={user.statut}
                            />
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  openEditModal(
                                    user
                                  )
                                }
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-jr-eau-pale hover:text-jr-lien focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jr-elec"
                                title="Modifier"
                                aria-label={`Modifier ${user.prenom} ${user.nom}`}
                              >
                                <Pencil size={17} />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleStatus(
                                    user
                                  )
                                }
                                disabled={
                                  user.id ===
                                  currentUser.id
                                }
                                className={`rounded-lg p-2 transition ${
                                  user.id ===
                                  currentUser.id
                                    ? 'cursor-not-allowed text-jr-faible opacity-50'
                                    : user.statut ===
                                      'actif'
                                    ? 'text-slate-500 hover:bg-jr-err-pale hover:text-jr-err'
                                    : 'text-jr-ok hover:bg-jr-ok-pale'
                                }`}
                                title={
                                  user.id ===
                                  currentUser.id
                                    ? 'Votre compte'
                                    : user.statut ===
                                      'actif'
                                    ? 'Désactiver'
                                    : 'Réactiver'
                                }
                                aria-label={
                                  user.id ===
                                  currentUser.id
                                    ? 'Votre compte'
                                    : user.statut ===
                                      'actif'
                                    ? `Désactiver ${user.prenom} ${user.nom}`
                                    : `Réactiver ${user.prenom} ${user.nom}`
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

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">

          <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-jr-bordure bg-jr-surface shadow-2xl">

            {/* Header modal */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingUser
                    ? 'Modifier utilisateur'
                    : 'Ajouter un utilisateur'}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {editingUser
                    ? 'Modifier les informations du compte.'
                    : 'Créer un nouveau compte utilisateur.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Formulaire */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                {/* Nom */}
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
                    className="w-full rounded-xl border border-slate-300 bg-jr-champ px-4 py-3 text-sm text-jr-texte outline-none focus:border-jr-eau focus:ring-4 focus:ring-jr-focus-anneau"
                  />
                </div>

                {/* Prénom */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Prénom
                  </label>

                  <input
                    type="text"
                    name="prenom"
                    value={form.prenom}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-jr-champ px-4 py-3 text-sm text-jr-texte outline-none focus:border-jr-eau focus:ring-4 focus:ring-jr-focus-anneau"
                  />
                </div>

                {/* Identifiant */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Identifiant
                  </label>

                  <input
                    type="text"
                    name="identifiant"
                    value={form.identifiant}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-jr-champ px-4 py-3 text-sm text-jr-texte outline-none focus:border-jr-eau focus:ring-4 focus:ring-jr-focus-anneau"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    E-mail
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-jr-champ px-4 py-3 text-sm text-jr-texte outline-none focus:border-jr-eau focus:ring-4 focus:ring-jr-focus-anneau"
                  />
                </div>

                {/* Mot de passe */}
                {!editingUser && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Mot de passe
                    </label>

                    <input
                      type="password"
                      name="mot_de_passe"
                      value={form.mot_de_passe}
                      onChange={handleChange}
                      minLength={8}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-jr-champ px-4 py-3 text-sm text-jr-texte outline-none focus:border-jr-eau focus:ring-4 focus:ring-jr-focus-anneau"
                    />

                    <p className="mt-1 text-xs text-slate-400">
                      Minimum 8 caractères.
                    </p>
                  </div>
                )}

                {/* Rôle */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Rôle
                  </label>

                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-jr-champ px-4 py-3 text-sm text-jr-texte outline-none focus:border-jr-eau focus:ring-4 focus:ring-jr-focus-anneau"
                  >
                    <option value="AGENT">
                      Agent
                    </option>

                    <option value="RESPONSABLE">
                      Responsable
                    </option>

                    {editingUser?.role ===
                      'ADMINISTRATEUR' && (
                      <option value="ADMINISTRATEUR">
                        Administrateur
                      </option>
                    )}
                  </select>

                  <p className="mt-1 text-xs text-slate-400">
                    Les nouveaux comptes sont
                    créés comme Agent ou Responsable.
                  </p>
                </div>

              </div>

              {/* Erreur */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Actions */}
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
                  className="inline-flex items-center gap-2 rounded-xl bg-jr-eau px-5 py-3 text-sm font-semibold text-white transition hover:bg-jr-eau-fonce focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-jr-elec disabled:cursor-not-allowed disabled:opacity-60"
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
                    : editingUser
                    ? 'Enregistrer'
                    : 'Créer l’utilisateur'}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

/* =========================================================
   ROLE BADGE
   Rôle = icône + libellé (jamais la couleur seule), palette Jirama.
========================================================= */
function RoleBadge({ role }) {
  const config = {
    ADMINISTRATEUR: {
      label: 'Administrateur',
      className: 'border-jr-eau bg-jr-eau text-white',
      iconClassName: 'text-white',
      icon: ShieldCheck,
    },

    AGENT: {
      label: 'Agent',
      className: 'border-jr-bordure-forte bg-jr-eau-pale text-jr-texte',
      iconClassName: 'text-jr-lien',
      icon: UserRound,
    },

    RESPONSABLE: {
      label: 'Responsable',
      className: 'border-jr-elec bg-jr-elec-pale text-jr-texte',
      iconClassName: 'text-jr-attention',
      icon: ShieldAlert,
    },
  };

  const current = config[role] || config.AGENT;

  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${current.className}`}
    >
      <Icon size={14} aria-hidden="true" className={current.iconClassName} />
      {current.label}
    </span>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */
function StatusBadge({ status }) {
  const actif = status === 'actif';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${
        actif
          ? 'border-jr-ok bg-jr-ok-pale text-jr-ok'
          : 'border-jr-bordure bg-jr-champ text-jr-faible'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          actif ? 'bg-jr-ok' : 'bg-jr-faible'
        }`}
      />
      {actif ? 'Actif' : 'Inactif'}
    </span>
  );
}

export default UsersPage;

