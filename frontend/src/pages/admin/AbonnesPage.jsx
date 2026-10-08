import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Plus,
  Search,
  Pencil,
  Power,
  X,
  Save,
  RefreshCw,
} from 'lucide-react';

import axiosClient from '../../api/axiosClient.js';
import Sidebar from '../../components/admin/Sidebar.jsx';
import Header from '../../components/admin/Header.jsx';
import AdminShell from '../../components/admin/AdminShell.jsx';

/* =========================================================
   OUTILS D'AFFICHAGE
========================================================= */
const FILTRES = [
  { valeur: '', libelle: 'Tous' },
  { valeur: 'actif', libelle: 'Actifs' },
  { valeur: 'inactif', libelle: 'Inactifs' },
];

const formatNombre = (n) => Number(n || 0).toLocaleString('fr-FR');

const pourcent = (partie, total) =>
  total ? Math.round((partie / total) * 100) : 0;

// « Rakoto Jean » -> « JR »
const initiales = (abonne) => {
  const a = String(abonne.prenom || '').trim().charAt(0);
  const b = String(abonne.nom || '').trim().charAt(0);
  return (a + b).toUpperCase() || '?';
};

// Teinte stable (eau ou électricité) déduite du numéro d'abonné
const teinteDe = (numero) => {
  const somme = String(numero || '')
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return somme % 2 === 0 ? 'eau' : 'elec';
};

const STYLE_TEINTE = {
  eau: {
    backgroundColor: 'var(--jr-eau-pale)',
    color: 'var(--jr-lien)',
  },
  elec: {
    backgroundColor: 'var(--jr-elec-pale)',
    color: 'var(--jr-attention)',
  },
};

/* =========================================================
   PAGE
========================================================= */
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
  const [touched, setTouched] = useState({});

  const [form, setForm] = useState({
    numero_abonne: '',
    nom: '',
    prenom: '',
    adresse: '',
    telephone: '',
  });

  const searchRef = useRef(null);
  const modalRef = useRef(null);
  const closeRef = useRef(null);

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
      console.error('Erreur chargement abonnés :', err);

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        navigate('/', { replace: true });
        return;
      }

      if (err.response?.status === 403) {
        setError('Vous n’avez pas les droits pour accéder à cette page.');
        return;
      }

      setError(
        err.response?.data?.message || 'Impossible de charger les abonnés.'
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
  const recherches = useMemo(() => {
    const query = search.trim().toLowerCase();

    return abonnes.filter(
      (abonne) =>
        !query ||
        [
          abonne.numero_abonne,
          abonne.nom,
          abonne.prenom,
          abonne.adresse,
          abonne.telephone,
        ].some((value) =>
          String(value || '').toLowerCase().includes(query)
        )
    );
  }, [abonnes, search]);

  const filteredAbonnes = useMemo(
    () =>
      recherches.filter(
        (abonne) => !statusFilter || abonne.statut === statusFilter
      ),
    [recherches, statusFilter]
  );

  // Compteurs globaux (bande d'indicateurs)
  const total = abonnes.length;
  const nbActifs = useMemo(
    () => abonnes.filter((a) => a.statut === 'actif').length,
    [abonnes]
  );
  const nbInactifs = total - nbActifs;

  // Compteurs des boutons de filtre (tiennent compte de la recherche)
  const compteursFiltre = useMemo(
    () => ({
      '': recherches.length,
      actif: recherches.filter((a) => a.statut === 'actif').length,
      inactif: recherches.filter((a) => a.statut === 'inactif').length,
    }),
    [recherches]
  );

  const resetFiltres = () => {
    setSearch('');
    setStatusFilter('');
  };

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

    setTouched({});
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
      numero_abonne: abonne.numero_abonne || '',
      nom: abonne.nom || '',
      prenom: abonne.prenom || '',
      adresse: abonne.adresse || '',
      telephone: abonne.telephone || '',
    });

    setTouched({});
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

  closeRef.current = closeModal;

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

  const handleBlur = (event) => {
    const { name } = event.target;
    setTouched((previous) => ({ ...previous, [name]: true }));
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
        numero_abonne: form.numero_abonne.trim(),
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
        response = await axiosClient.post('/abonnes', data);
      }

      setSuccess(response.data.message || 'Opération réalisée avec succès.');

      await loadAbonnes();

      setTimeout(() => {
        setModalOpen(false);
        setEditingAbonne(null);
      }, 500);
    } catch (err) {
      console.error('Erreur enregistrement abonné :', err);

      setError(err.response?.data?.message || 'Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  };

  /* ======================================================
     ACTIVER / DÉSACTIVER
  ====================================================== */
  const toggleStatus = async (abonne) => {
    const action = abonne.statut === 'actif' ? 'désactiver' : 'réactiver';

    const confirmed = window.confirm(
      `Voulez-vous vraiment ${action} l’abonné ${abonne.numero_abonne} ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError('');
      setSuccess('');

      const response = await axiosClient.patch(
        `/abonnes/${abonne.id}/statut`
      );

      setSuccess(response.data.message || 'Statut modifié avec succès.');

      await loadAbonnes();
    } catch (err) {
      console.error('Erreur statut abonné :', err);

      setError(
        err.response?.data?.message || 'Impossible de modifier le statut.'
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

  /* ======================================================
     INTERFACE : toast de succès qui disparaît seul
  ====================================================== */
  useEffect(() => {
    if (!success) return undefined;

    const minuteur = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(minuteur);
  }, [success]);

  /* ======================================================
     INTERFACE : raccourci « / » pour chercher
  ====================================================== */
  useEffect(() => {
    const surTouche = (e) => {
      if (e.key !== '/' || modalOpen || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const cible = e.target;
      const saisie =
        cible instanceof HTMLElement &&
        (cible.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName));

      if (saisie) return;

      e.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [modalOpen]);

  /* ======================================================
     INTERFACE : modale (focus piégé, Échap, scroll bloqué)
  ====================================================== */
  useEffect(() => {
    if (!modalOpen) return undefined;

    const precedent = document.activeElement;
    const overflowAvant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(
        modalRef.current?.querySelectorAll(
          'button:not([disabled]), input, textarea, select, [href], [tabindex]:not([tabindex="-1"])'
        ) || []
      );

    const focusInitial = setTimeout(() => {
      modalRef.current?.querySelector('input')?.focus();
    }, 30);

    const surTouche = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const items = focusables();
      if (!items.length) return;

      const premier = items[0];
      const dernier = items[items.length - 1];

      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };

    document.addEventListener('keydown', surTouche);

    return () => {
      clearTimeout(focusInitial);
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = overflowAvant;
      precedent?.focus?.();
    };
  }, [modalOpen]);

  /* ======================================================
     RENDU
  ====================================================== */
  if (!currentUser) {
    return (
      <AdminShell intensite="calme">
        <div className="flex min-h-screen items-center justify-center">
          <div className="jr-verre rounded-lg border border-jr-bordure px-6 py-5 text-sm text-jr-doux shadow-sm">
            Chargement...
          </div>
        </div>
      </AdminShell>
    );
  }

  const premierChargement = loading && abonnes.length === 0;
  const aucunResultat = !loading && filteredAbonnes.length === 0;
  const listeVide = abonnes.length === 0;

  const champEtat = (nom, requis) => {
    if (!touched[nom] || !requis) return '';
    return form[nom].trim() ? 'jr-field--ok' : 'jr-field--err';
  };

  return (
    <AdminShell
      intensite="calme"
      className="selection:bg-[var(--jr-elec)] selection:text-[var(--jr-sur-elec)]"
    >
      {/* SIDEBAR */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/admin/abonnes"
        onNavigate={navigate}
        onLogout={handleLogout}
        user={currentUser}
      />

      <div className="lg:pl-72">
        {/* HEADER */}
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
          onProfile={() => navigate('/dashboard/admin')}
          user={currentUser}
        />

        <main className="p-4 sm:p-6 lg:p-8">
          {/* TITRE */}
          <div className="jr-entree mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-jr-titre sm:text-4xl">
                Abonnés
              </h1>

              <p className="mt-1.5 max-w-xl text-sm text-jr-doux">
                Les abonnés rattachés aux compteurs. Un abonné désactivé reste
                dans l’historique mais n’apparaît plus dans les nouveaux
                relevés.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="jr-btn jr-btn-elec inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold shadow-sm"
            >
              <Plus size={18} aria-hidden="true" />
              Ajouter un abonné
            </button>
          </div>

          {/* INDICATEURS */}
          <section
            aria-label="Répartition des abonnés"
            className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1.35fr_1fr_1fr]"
          >
            <div className="jr-verre rounded-lg border border-jr-bordure p-5 shadow-sm">
              <p className="text-sm text-jr-doux">Abonnés enregistrés</p>

              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-jr-texte">
                {formatNombre(total)}
              </p>

              <div
                aria-hidden="true"
                className="mt-4 flex h-1.5 overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--jr-desactive-fond)' }}
              >
                <span
                  className="h-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${pourcent(nbActifs, total)}%`,
                    backgroundColor: 'var(--jr-eau-clair)',
                  }}
                />
                <span
                  className="h-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${pourcent(nbInactifs, total)}%`,
                    backgroundColor: 'var(--jr-elec)',
                  }}
                />
              </div>
            </div>

            <div className="jr-carte-eau rounded-lg p-5 shadow-sm">
              <p className="text-sm text-jr-doux">Actifs</p>

              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-jr-texte">
                {formatNombre(nbActifs)}
              </p>

              <p className="mt-2 text-xs text-jr-lien">
                {pourcent(nbActifs, total)} % du parc
              </p>
            </div>

            <div className="jr-carte-elec rounded-lg p-5 shadow-sm">
              <p className="text-sm text-jr-doux">Inactifs</p>

              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-jr-texte">
                {formatNombre(nbInactifs)}
              </p>

              <p
                className="mt-2 text-xs"
                style={{ color: 'var(--jr-attention)' }}
              >
                {nbInactifs > 0
                  ? 'À réactiver ou à archiver'
                  : 'Aucun abonné à traiter'}
              </p>
            </div>
          </section>

          {/* RECHERCHE ET FILTRES */}
          <section className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-jr-faible"
              />

              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher par numéro, nom, téléphone ou adresse"
                aria-label="Rechercher un abonné"
                className="jr-field w-full rounded-md border py-2.5 pl-10 pr-10 text-sm"
              />

              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-jr-bordure-forte px-1.5 text-xs text-jr-faible sm:block"
              >
                /
              </kbd>
            </div>

            <div
              role="group"
              aria-label="Filtrer par statut"
              className="jr-verre inline-flex self-start rounded-md border border-jr-bordure p-0.5"
            >
              {FILTRES.map((filtre) => {
                const actif = statusFilter === filtre.valeur;

                return (
                  <button
                    key={filtre.valeur || 'tous'}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => setStatusFilter(filtre.valeur)}
                    className="inline-flex items-center gap-2 rounded px-3.5 py-2 text-sm font-medium transition-colors motion-reduce:transition-none"
                    style={
                      actif
                        ? {
                            backgroundColor: 'var(--jr-eau)',
                            color: '#ffffff',
                          }
                        : { color: 'var(--jr-texte-doux)' }
                    }
                  >
                    {filtre.libelle}
                    <span
                      className="text-xs tabular-nums"
                      style={{ opacity: actif ? 0.85 : 0.7 }}
                    >
                      {formatNombre(compteursFiltre[filtre.valeur])}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* LISTE */}
          <section className="jr-verre overflow-hidden rounded-lg border border-jr-bordure shadow-sm">
            <div className="flex items-center justify-between border-b border-jr-bordure px-5 py-3.5 sm:px-6">
              <div>
                <h2 className="font-semibold text-jr-titre">
                  Liste des abonnés
                </h2>

                <p className="mt-0.5 text-xs text-jr-faible">
                  {formatNombre(filteredAbonnes.length)} affiché
                  {filteredAbonnes.length > 1 ? 's' : ''} sur{' '}
                  {formatNombre(total)}
                </p>
              </div>

              <button
                type="button"
                onClick={loadAbonnes}
                className="rounded-md p-2.5 text-jr-faible transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-lien motion-reduce:transition-none"
                title="Actualiser la liste"
                aria-label="Actualiser la liste"
              >
                <RefreshCw
                  size={18}
                  aria-hidden="true"
                  className={loading ? 'animate-spin motion-reduce:animate-none' : ''}
                />
              </button>
            </div>

            {/* Chargement : squelette */}
            {premierChargement && <Squelette />}

            {/* Vide ou aucun résultat */}
            {!premierChargement && aucunResultat && (
              <EtatVide
                listeVide={listeVide}
                onAjouter={openCreateModal}
                onReset={resetFiltres}
              />
            )}

            {/* TABLEAU (écrans moyens et grands) */}
            {!premierChargement && !aucunResultat && (
              <div className="hidden md:block">
                <table className="w-full text-left">
                  <caption className="sr-only">Liste des abonnés</caption>

                  <thead>
                    <tr className="border-b border-jr-bordure">
                      <th scope="col" className="px-5 py-3 text-xs font-medium text-jr-faible">
                        Numéro
                      </th>
                      <th scope="col" className="px-5 py-3 text-xs font-medium text-jr-faible">
                        Abonné
                      </th>
                      <th scope="col" className="px-5 py-3 text-xs font-medium text-jr-faible">
                        Contact
                      </th>
                      <th scope="col" className="px-5 py-3 text-xs font-medium text-jr-faible">
                        Statut
                      </th>
                      <th scope="col" className="px-5 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-jr-bordure">
                    {filteredAbonnes.map((abonne, index) => (
                      <tr
                        key={abonne.id}
                        className="jr-entree group transition-colors hover:bg-[var(--jr-eau-pale)] focus-within:bg-[var(--jr-eau-pale)] motion-reduce:transition-none"
                        style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
                      >
                        <td className="relative px-5 py-3.5">
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-0 left-0 w-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
                            style={{ backgroundColor: 'var(--jr-elec)' }}
                          />
                          <span className="font-mono text-sm tabular-nums text-jr-titre">
                            {abonne.numero_abonne}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar abonne={abonne} />
                            <p className="text-sm text-jr-texte">
                              <span className="font-semibold">{abonne.nom}</span>{' '}
                              {abonne.prenom}
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <p className="text-sm tabular-nums text-jr-texte">
                            {abonne.telephone || (
                              <span className="text-jr-faible">Pas de téléphone</span>
                            )}
                          </p>
                          <p
                            className="mt-0.5 max-w-[20rem] truncate text-xs text-jr-faible"
                            title={abonne.adresse || undefined}
                          >
                            {abonne.adresse || 'Pas d’adresse'}
                          </p>
                        </td>

                        <td className="px-5 py-3.5">
                          <StatutPoint status={abonne.statut} />
                        </td>

                        <td className="px-5 py-3.5">
                          <Actions
                            abonne={abonne}
                            onEdit={openEditModal}
                            onToggle={toggleStatus}
                            auSurvol
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* CARTES (mobile) */}
            {!premierChargement && !aucunResultat && (
              <ul className="divide-y divide-jr-bordure md:hidden">
                {filteredAbonnes.map((abonne, index) => (
                  <li
                    key={abonne.id}
                    className="jr-entree p-4"
                    style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar abonne={abonne} />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-jr-texte">
                            <span className="font-semibold">{abonne.nom}</span>{' '}
                            {abonne.prenom}
                          </p>
                          <p className="font-mono text-xs tabular-nums text-jr-faible">
                            {abonne.numero_abonne}
                          </p>
                        </div>
                      </div>

                      <StatutPoint status={abonne.statut} />
                    </div>

                    <div className="mt-3 text-sm">
                      <p className="tabular-nums text-jr-texte">
                        {abonne.telephone || (
                          <span className="text-jr-faible">Pas de téléphone</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-jr-faible">
                        {abonne.adresse || 'Pas d’adresse'}
                      </p>
                    </div>

                    <div className="mt-3">
                      <Actions
                        abonne={abonne}
                        onEdit={openEditModal}
                        onToggle={toggleStatus}
                        avecTexte
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>

      {/* ==================================================
          TOASTS
      ================================================== */}
      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {success && (
          <div
            role="status"
            className="jr-toast jr-verre-fort pointer-events-auto flex items-start gap-3 rounded-md border border-jr-bordure py-3 pl-3 pr-2 shadow-lg"
            style={{ borderLeft: '4px solid var(--jr-ok)' }}
          >
            <p className="flex-1 text-sm font-medium text-jr-texte">{success}</p>
            <button
              type="button"
              onClick={() => setSuccess('')}
              aria-label="Fermer le message"
              className="rounded p-1 text-jr-faible hover:text-jr-texte"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {error && !modalOpen && (
          <div
            role="alert"
            className="jr-toast jr-verre-fort pointer-events-auto flex items-start gap-3 rounded-md border border-jr-bordure py-3 pl-3 pr-2 shadow-lg"
            style={{ borderLeft: '4px solid var(--jr-err)' }}
          >
            <p className="flex-1 text-sm font-medium text-jr-texte">{error}</p>
            <button
              type="button"
              onClick={() => setError('')}
              aria-label="Fermer le message"
              className="rounded p-1 text-jr-faible hover:text-jr-texte"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* ==================================================
          MODAL AJOUT / MODIFICATION
      ================================================== */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--jr-fond) 70%, transparent)',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-modale-abonne"
            className="jr-verre-fort jr-pop max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-jr-bordure shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-jr-bordure px-6 py-5">
              <div>
                <h2
                  id="titre-modale-abonne"
                  className="text-xl font-semibold text-jr-titre"
                >
                  {editingAbonne ? 'Modifier l’abonné' : 'Ajouter un abonné'}
                </h2>

                <p className="mt-1 text-sm text-jr-doux">
                  Le numéro et le nom sont obligatoires.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Fermer"
                className="rounded-md p-2 text-jr-faible transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-texte motion-reduce:transition-none"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="champ-numero"
                    className="mb-1.5 block text-sm font-medium text-jr-doux"
                  >
                    Numéro d’abonné
                  </label>

                  <input
                    id="champ-numero"
                    type="text"
                    name="numero_abonne"
                    value={form.numero_abonne}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    placeholder="Ex. ABN-0001"
                    className={`jr-field w-full rounded-md border px-3 py-2.5 font-mono text-sm ${champEtat('numero_abonne', true)}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="champ-nom"
                    className="mb-1.5 block text-sm font-medium text-jr-doux"
                  >
                    Nom
                  </label>

                  <input
                    id="champ-nom"
                    type="text"
                    name="nom"
                    value={form.nom}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    required
                    className={`jr-field w-full rounded-md border px-3 py-2.5 text-sm ${champEtat('nom', true)}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="champ-prenom"
                    className="mb-1.5 block text-sm font-medium text-jr-doux"
                  >
                    Prénom
                  </label>

                  <input
                    id="champ-prenom"
                    type="text"
                    name="prenom"
                    value={form.prenom}
                    onChange={handleChange}
                    className="jr-field w-full rounded-md border px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="champ-telephone"
                    className="mb-1.5 block text-sm font-medium text-jr-doux"
                  >
                    Téléphone
                  </label>

                  <input
                    id="champ-telephone"
                    type="text"
                    name="telephone"
                    value={form.telephone}
                    onChange={handleChange}
                    placeholder="Ex. 034 XX XXX XX"
                    className="jr-field w-full rounded-md border px-3 py-2.5 text-sm tabular-nums"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="champ-adresse"
                    className="mb-1.5 block text-sm font-medium text-jr-doux"
                  >
                    Adresse
                  </label>

                  <textarea
                    id="champ-adresse"
                    name="adresse"
                    value={form.adresse}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Quartier, rue, repère"
                    className="jr-field w-full resize-none rounded-md border px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-jr-err-bordure bg-jr-err-pale px-4 py-3 text-sm font-medium text-jr-err"
                >
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-jr-bordure pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-md px-4 py-2.5 text-sm font-medium text-jr-doux transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-texte disabled:opacity-50 motion-reduce:transition-none"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="jr-btn jr-btn-elec inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw
                      size={17}
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                  ) : (
                    <Save size={17} aria-hidden="true" />
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
    </AdminShell>
  );
}

/* =========================================================
   PASTILLE D'INITIALES
========================================================= */
function Avatar({ abonne }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
      style={STYLE_TEINTE[teinteDe(abonne.numero_abonne)]}
    >
      {initiales(abonne)}
    </span>
  );
}

/* =========================================================
   STATUT : point coloré + libellé
========================================================= */
function StatutPoint({ status }) {
  const actif = status === 'actif';

  return (
    <span
      className={`inline-flex items-center gap-2 text-sm font-medium ${
        actif ? 'text-jr-ok' : 'text-jr-faible'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${actif ? 'bg-jr-ok' : 'bg-jr-faible'}`}
      />
      {actif ? 'Actif' : 'Inactif'}
    </span>
  );
}

/* =========================================================
   ACTIONS : au survol de la ligne sur ordinateur,
   toujours visibles sur mobile
========================================================= */
function Actions({ abonne, onEdit, onToggle, auSurvol = false, avecTexte = false }) {
  const actif = abonne.statut === 'actif';
  const libelleStatut = actif ? 'Désactiver' : 'Réactiver';

  const visibilite = auSurvol
    ? 'md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none'
    : '';

  const base =
    'inline-flex items-center gap-2 rounded-md p-2 text-sm font-medium transition-colors motion-reduce:transition-none';

  return (
    <div className={`flex gap-1 ${auSurvol ? 'justify-end' : ''}`}>
      <button
        type="button"
        onClick={() => onEdit(abonne)}
        title="Modifier l’abonné"
        aria-label={`Modifier l’abonné ${abonne.numero_abonne}`}
        className={`${base} ${visibilite} text-jr-doux hover:bg-[var(--jr-eau-pale)] hover:text-jr-lien`}
      >
        <Pencil size={17} aria-hidden="true" />
        {avecTexte && 'Modifier'}
      </button>

      <button
        type="button"
        onClick={() => onToggle(abonne)}
        title={`${libelleStatut} l’abonné`}
        aria-label={`${libelleStatut} l’abonné ${abonne.numero_abonne}`}
        className={`${base} ${visibilite} ${
          actif
            ? 'text-jr-doux hover:bg-jr-err-pale hover:text-jr-err'
            : 'text-jr-ok hover:bg-jr-ok-pale'
        }`}
      >
        <Power size={17} aria-hidden="true" />
        {avecTexte && libelleStatut}
      </button>
    </div>
  );
}

/* =========================================================
   SQUELETTE DE CHARGEMENT
========================================================= */
function Squelette() {
  return (
    <div aria-busy="true" aria-live="polite" className="divide-y divide-jr-bordure">
      <span className="sr-only">Chargement des abonnés</span>

      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
          <span className="jr-shimmer h-9 w-9 shrink-0 rounded-md" />
          <span className="jr-shimmer h-3 w-24 rounded" />
          <span className="jr-shimmer h-3 flex-1 rounded" style={{ maxWidth: `${50 + ((i * 13) % 30)}%` }} />
          <span className="jr-shimmer hidden h-3 w-20 rounded sm:block" />
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   ÉTAT VIDE / AUCUN RÉSULTAT
========================================================= */
function EtatVide({ listeVide, onAjouter, onReset }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M40 12c-12 16-22 28-22 42a22 22 0 0 0 44 0c0-14-10-26-22-42Z"
          fill="var(--jr-eau-pale)"
          stroke="var(--jr-eau-clair)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M64 30 50 56h12l-6 22 20-30H64l8-18Z"
          fill="var(--jr-elec)"
          stroke="var(--jr-elec-fonce)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>

      <h3 className="mt-4 text-base font-semibold text-jr-titre">
        {listeVide ? 'Aucun abonné pour le moment' : 'Aucun abonné ne correspond'}
      </h3>

      <p className="mt-1 max-w-sm text-sm text-jr-doux">
        {listeVide
          ? 'Ajoutez le premier abonné pour pouvoir lui rattacher un compteur.'
          : 'Essayez un autre numéro, un autre nom, ou retirez le filtre de statut.'}
      </p>

      {listeVide ? (
        <button
          type="button"
          onClick={onAjouter}
          className="jr-btn jr-btn-elec mt-5 inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
        >
          <Plus size={18} aria-hidden="true" />
          Ajouter un abonné
        </button>
      ) : (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 rounded-md border border-jr-bordure-forte px-4 py-2.5 text-sm font-medium text-jr-lien transition-colors hover:bg-[var(--jr-eau-pale)] motion-reduce:transition-none"
        >
          Réinitialiser la recherche
        </button>
      )}
    </div>
  );
}

export default AbonnesPage;
