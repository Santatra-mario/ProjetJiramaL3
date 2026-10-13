import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  CircleAlert,
  CircleCheck,
  Download,
  FileText,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';

import axiosClient from '../../api/axiosClient.js';

import Sidebar from '../../components/admin/Sidebar.jsx';
import Header from '../../components/admin/Header.jsx';
import AdminShell from '../../components/admin/AdminShell.jsx';

import CompteursStats from '../../components/admin/compteurs/CompteursStats.jsx';
import CompteursFiltres from '../../components/admin/compteurs/CompteursFiltres.jsx';
import CompteursTable from '../../components/admin/compteurs/CompteursTable.jsx';
import CompteurModal from '../../components/admin/compteurs/CompteurModal.jsx';
import ConfirmStatutDialog from '../../components/admin/compteurs/ConfirmStatutDialog.jsx';

import {
  COLONNES_TRI,
  STATUTS,
  TYPES,
  exporterCsv as genererCsv,
  exporterPdf as genererPdf,
  filtrer,
  formatNombre,
  nomAbonne,
  trier,
} from '../../components/admin/compteurs/compteursUtils.js';

const INTERVALLE_ACTUALISATION = 60000;

function CompteursPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ======================================================
     ÉTAT
  ====================================================== */
  const [compteurs, setCompteurs] = useState([]);
  const [abonnes, setAbonnes] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreurChargement, setErreurChargement] = useState('');
  const [derniereMaj, setDerniereMaj] = useState(null);

  const [loadingAbonnes, setLoadingAbonnes] = useState(true);
  const [erreurAbonnes, setErreurAbonnes] = useState('');

  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [modalOuvert, setModalOuvert] = useState(false);
  const [compteurEnEdition, setCompteurEnEdition] = useState(null);
  const [erreurModal, setErreurModal] = useState('');
  const [cleErreur, setCleErreur] = useState(0);

  const [confirmation, setConfirmation] = useState(null);
  const [surligneId, setSurligneId] = useState(null);
  const [toasts, setToasts] = useState([]);

  const [page, setPage] = useState(1);
  const [taillePage, setTaillePage] = useState(10);
  const [saisie, setSaisie] = useState(() => searchParams.get('q') || '');

  const idToast = useRef(0);
  const minuteursToast = useRef(new Set());
  const minuteurSurligne = useRef(null);
  const requetesStatut = useRef(0);
  const derniereMajRef = useRef(0);
  const occupeRef = useRef(false);

  occupeRef.current =
    modalOuvert || saving || Boolean(confirmation) || requetesStatut.current > 0;

  /* ======================================================
     FILTRES, TRI : stockés dans l'URL (vue partageable)
  ====================================================== */
  const q = searchParams.get('q') || '';

  const typeUrl = searchParams.get('type');
  const type = TYPES.some((t) => t.valeur === typeUrl) ? typeUrl : '';

  const statutUrl = searchParams.get('statut');
  const statut = STATUTS.some((s) => s.valeur === statutUrl) ? statutUrl : '';

  const abonne = searchParams.get('abonne') || '';

  const triUrl = searchParams.get('tri');
  const tri = COLONNES_TRI.includes(triUrl) ? triUrl : '';
  const dir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';

  const majParams = useCallback(
    (changements) => {
      setSearchParams(
        (precedent) => {
          const suivant = new URLSearchParams(precedent);

          Object.entries(changements).forEach(([cle, valeur]) => {
            if (valeur) suivant.set(cle, valeur);
            else suivant.delete(cle);
          });

          return suivant;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Recherche : anti-rebond de 250 ms avant d'écrire dans l'URL
  const qRef = useRef(q);
  qRef.current = q;

  useEffect(() => {
    const valeur = saisie.trim();
    if (valeur === qRef.current) return undefined;

    const minuteur = setTimeout(() => majParams({ q: valeur }), 250);
    return () => clearTimeout(minuteur);
  }, [saisie, majParams]);

  /* ======================================================
     TOASTS (disparaissent seuls)
  ====================================================== */
  const ajouterToast = useCallback((genre, message) => {
    idToast.current += 1;
    const id = idToast.current;

    setToasts((precedent) => [...precedent.slice(-3), { id, genre, message }]);

    const minuteur = setTimeout(() => {
      minuteursToast.current.delete(minuteur);
      setToasts((precedent) => precedent.filter((t) => t.id !== id));
    }, genre === 'erreur' ? 6000 : 4000);

    minuteursToast.current.add(minuteur);
  }, []);

  const fermerToast = (id) =>
    setToasts((precedent) => precedent.filter((t) => t.id !== id));

  useEffect(() => {
    const minuteurs = minuteursToast.current;
    return () => minuteurs.forEach(clearTimeout);
  }, []);

  const surligner = useCallback((id) => {
    clearTimeout(minuteurSurligne.current);
    setSurligneId(id);
    minuteurSurligne.current = setTimeout(() => setSurligneId(null), 2500);
  }, []);

  useEffect(() => () => clearTimeout(minuteurSurligne.current), []);

  /* ======================================================
     DÉCONNEXION
  ====================================================== */
  const deconnecter = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    navigate('/', { replace: true });
  }, [navigate]);

  /* ======================================================
     UTILISATEUR CONNECTÉ (inchangé)
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
      console.error('Erreur utilisateur :', error);

      localStorage.removeItem('token');
      localStorage.removeItem('user');

      navigate('/', { replace: true });
    }
  }, [navigate]);

  /* ======================================================
     CHARGER LES COMPTEURS
     silencieux : pas de toast d'erreur, pas de clignotement
  ====================================================== */
  const chargerCompteurs = useCallback(
    async ({ silencieux = false } = {}) => {
      setActualisation(true);

      try {
        const response = await axiosClient.get('/compteurs');

        setCompteurs(response.data.compteurs || []);
        setErreurChargement('');
        setDerniereMaj(new Date());
        derniereMajRef.current = Date.now();
      } catch (err) {
        console.error('Erreur chargement compteurs :', err);

        if (err.response?.status === 401) {
          deconnecter();
          return;
        }

        const message =
          err.response?.data?.message || 'Impossible de charger les compteurs.';

        setErreurChargement(message);
        if (!silencieux) ajouterToast('erreur', message);
      } finally {
        setActualisation(false);
        setLoading(false);
      }
    },
    [ajouterToast, deconnecter]
  );

  /* ======================================================
     CHARGER LES ABONNÉS (erreur séparée de celle des compteurs)
  ====================================================== */
  const chargerAbonnes = useCallback(async () => {
    try {
      setLoadingAbonnes(true);
      setErreurAbonnes('');

      const response = await axiosClient.get('/abonnes');

      setAbonnes(response.data.abonnes || []);
    } catch (err) {
      console.error('Erreur chargement abonnés :', err);

      setErreurAbonnes(
        err.response?.data?.message ||
          'Impossible de charger la liste des abonnés.'
      );
    } finally {
      setLoadingAbonnes(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      chargerCompteurs();
      chargerAbonnes();
    }
  }, [currentUser, chargerCompteurs, chargerAbonnes]);

  /* ======================================================
     ACTUALISATION AUTOMATIQUE (toutes les 60 s, onglet visible)
  ====================================================== */
  useEffect(() => {
    if (!currentUser) return undefined;

    const minuteur = setInterval(() => {
      if (document.visibilityState !== 'visible' || occupeRef.current) return;
      chargerCompteurs({ silencieux: true });
    }, INTERVALLE_ACTUALISATION);

    const auRetour = () => {
      if (
        document.visibilityState === 'visible' &&
        !occupeRef.current &&
        Date.now() - derniereMajRef.current > INTERVALLE_ACTUALISATION
      ) {
        chargerCompteurs({ silencieux: true });
      }
    };

    document.addEventListener('visibilitychange', auRetour);

    return () => {
      clearInterval(minuteur);
      document.removeEventListener('visibilitychange', auRetour);
    };
  }, [currentUser, chargerCompteurs]);

  /* ======================================================
     DONNÉES DÉRIVÉES : filtre, tri, compteurs de pastilles
  ====================================================== */
  const filtres = useMemo(
    () => filtrer(compteurs, { q, type, statut, abonne }),
    [compteurs, q, type, statut, abonne]
  );

  const tries = useMemo(() => trier(filtres, tri, dir), [filtres, tri, dir]);

  const comptesType = useMemo(() => {
    const base = filtrer(compteurs, { q, statut, abonne });

    return {
      '': base.length,
      EAU: base.filter((c) => c.type === 'EAU').length,
      ELECTRICITE: base.filter((c) => c.type === 'ELECTRICITE').length,
    };
  }, [compteurs, q, statut, abonne]);

  const comptesStatut = useMemo(() => {
    const base = filtrer(compteurs, { q, type, abonne });

    return {
      '': base.length,
      ACTIF: base.filter((c) => c.statut === 'ACTIF').length,
      INACTIF: base.filter((c) => c.statut === 'INACTIF').length,
      A_VERIFIER: base.filter((c) => c.statut === 'A_VERIFIER').length,
    };
  }, [compteurs, q, type, abonne]);

  // Abonnés qui ont au moins un compteur (pour le filtre)
  const abonnesOptions = useMemo(() => {
    const parId = new Map();

    compteurs.forEach((c) => {
      if (!parId.has(c.abonne_id)) {
        parId.set(c.abonne_id, {
          id: String(c.abonne_id),
          label: `${c.numero_abonne} - ${nomAbonne(c) || '—'}`,
        });
      }
    });

    return [...parId.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [compteurs]);

  /* ---------- Pagination ---------- */
  useEffect(() => {
    setPage(1);
  }, [q, type, statut, abonne, tri, dir, taillePage]);

  const nbPages = Math.max(1, Math.ceil(tries.length / taillePage));
  const pageCourante = Math.min(page, nbPages);
  const debut = (pageCourante - 1) * taillePage;
  const elements = tries.slice(debut, debut + taillePage);

  const filtreActif = Boolean(q || saisie.trim() || type || statut || abonne);

  /* ======================================================
     ACTIONS : filtres et tri
  ====================================================== */
  const resetFiltres = () => {
    setSaisie('');
    majParams({ q: '', type: '', statut: '', abonne: '' });
  };

  const basculerType = (valeur) => majParams({ type: type === valeur ? '' : valeur });
  const basculerStatut = (valeur) =>
    majParams({ statut: statut === valeur ? '' : valeur });

  // Clic sur un en-tête : croissant → décroissant → ordre d'origine
  const changerTri = (colonne) => {
    if (tri !== colonne) majParams({ tri: colonne, dir: 'asc' });
    else if (dir === 'asc') majParams({ tri: colonne, dir: 'desc' });
    else majParams({ tri: '', dir: '' });
  };

  const changerTriMobile = (valeur) => {
    if (!valeur) {
      majParams({ tri: '', dir: '' });
      return;
    }

    const [colonne, sens] = valeur.split(':');
    majParams({ tri: colonne, dir: sens });
  };

  /* ======================================================
     ACTIONS : modal d'ajout / modification
  ====================================================== */
  const ouvrirCreation = () => {
    setCompteurEnEdition(null);
    setErreurModal('');
    setModalOuvert(true);
  };

  const ouvrirEdition = (compteur) => {
    setCompteurEnEdition(compteur);
    setErreurModal('');
    setModalOuvert(true);
  };

  const fermerModal = () => {
    if (saving) return;

    setModalOuvert(false);
    setCompteurEnEdition(null);
    setErreurModal('');
  };

  const enregistrer = async (data) => {
    setErreurModal('');
    setSaving(true);

    try {
      const response = compteurEnEdition
        ? await axiosClient.put(`/compteurs/${compteurEnEdition.id}`, data)
        : await axiosClient.post('/compteurs', data);

      const idCible = compteurEnEdition?.id ?? response.data.compteur?.id ?? null;

      ajouterToast(
        'succes',
        response.data.message || 'Compteur enregistré avec succès.'
      );

      setModalOuvert(false);
      setCompteurEnEdition(null);

      if (idCible) surligner(idCible);

      await chargerCompteurs({ silencieux: true });
    } catch (err) {
      console.error('Erreur enregistrement compteur :', err);

      if (err.response?.status === 401) {
        deconnecter();
        return;
      }

      setErreurModal(err.response?.data?.message || 'Une erreur est survenue.');
      setCleErreur((precedent) => precedent + 1);
    } finally {
      setSaving(false);
    }
  };

  /* ======================================================
     ACTIONS : changement de statut
     confirmation intégrée + mise à jour optimiste
  ====================================================== */
  const demanderStatut = useCallback((compteur, nouveauStatut) => {
    if (compteur.statut === nouveauStatut) return;
    setConfirmation({ compteur, statut: nouveauStatut });
  }, []);

  const confirmerStatut = async () => {
    if (!confirmation) return;

    const { compteur, statut: nouveauStatut } = confirmation;
    const ancienStatut = compteur.statut;

    setConfirmation(null);

    requetesStatut.current += 1;

    const appliquer = (valeur) =>
      setCompteurs((precedent) =>
        precedent.map((c) => (c.id === compteur.id ? { ...c, statut: valeur } : c))
      );

    // La ligne change tout de suite…
    appliquer(nouveauStatut);
    surligner(compteur.id);

    try {
      const response = await axiosClient.patch(`/compteurs/${compteur.id}/statut`, {
        statut: nouveauStatut,
      });

      ajouterToast('succes', response.data.message || 'Statut modifié avec succès.');
    } catch (err) {
      console.error('Erreur changement statut :', err);

      // … puis retour arrière si le serveur refuse
      appliquer(ancienStatut);

      if (err.response?.status === 401) {
        deconnecter();
        return;
      }

      ajouterToast(
        'erreur',
        err.response?.data?.message || 'Impossible de modifier le statut.'
      );
    } finally {
      requetesStatut.current -= 1;

      if (requetesStatut.current === 0) {
        chargerCompteurs({ silencieux: true });
      }
    }
  };

  /* ======================================================
     ACTIONS : exports de la liste filtrée
  ====================================================== */
  const exporterCsv = () => {
    genererCsv(tries);
    ajouterToast('succes', `${formatNombre(tries.length)} compteur(s) exporté(s) en CSV.`);
  };

  const exporterPdf = async () => {
    try {
      await genererPdf(tries);
      ajouterToast('succes', `${formatNombre(tries.length)} compteur(s) exporté(s) en PDF.`);
    } catch (err) {
      console.error('Erreur export PDF :', err);
      ajouterToast('erreur', 'Impossible de générer le PDF.');
    }
  };

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

  const premierChargement = (loading || actualisation) && compteurs.length === 0;

  const heureMaj = derniereMaj
    ? derniereMaj.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <AdminShell
      intensite="calme"
      className="selection:bg-[var(--jr-elec)] selection:text-[var(--jr-sur-elec)]"
    >
      {/* SIDEBAR */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/admin/compteurs"
        onNavigate={navigate}
        onLogout={deconnecter}
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
                Compteurs
              </h1>

              <p className="mt-1.5 max-w-xl text-sm text-jr-doux">
                Les compteurs d’eau et d’électricité rattachés aux abonnés.
                Un compteur inactif n’accepte plus de nouveaux relevés.
              </p>
            </div>

            <button
              type="button"
              onClick={ouvrirCreation}
              className="jr-btn jr-btn-elec inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold shadow-sm"
            >
              <Plus size={18} aria-hidden="true" />
              Ajouter un compteur
            </button>
          </div>

          {/* STATISTIQUES */}
          <CompteursStats
            compteurs={compteurs}
            chargement={premierChargement}
            type={type}
            statut={statut}
            onFiltreType={basculerType}
            onFiltreStatut={basculerStatut}
          />

          {/* RECHERCHE ET FILTRES */}
          <CompteursFiltres
            saisie={saisie}
            onSaisie={setSaisie}
            type={type}
            onType={(valeur) => majParams({ type: valeur })}
            statut={statut}
            onStatut={(valeur) => majParams({ statut: valeur })}
            abonne={abonne}
            onAbonne={(valeur) => majParams({ abonne: valeur })}
            abonnesOptions={abonnesOptions}
            comptesType={comptesType}
            comptesStatut={comptesStatut}
            filtreActif={filtreActif}
            onReset={resetFiltres}
            raccourciActif={!modalOuvert && !confirmation}
          />

          {/* LISTE */}
          <section className="jr-verre overflow-hidden rounded-lg border border-jr-bordure shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-jr-bordure px-5 py-3.5 sm:px-6">
              <div>
                <h2 className="font-semibold text-jr-titre">Liste des compteurs</h2>

                <p className="mt-0.5 text-xs text-jr-faible">
                  {formatNombre(tries.length)} affiché
                  {tries.length > 1 ? 's' : ''} sur {formatNombre(compteurs.length)}
                  {heureMaj && ` · Mis à jour à ${heureMaj}`}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={exporterCsv}
                  disabled={tries.length === 0}
                  title="Exporter la liste affichée en CSV"
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-jr-doux transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-lien disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                >
                  <Download size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">CSV</span>
                  <span className="sr-only sm:hidden">Exporter en CSV</span>
                </button>

                <button
                  type="button"
                  onClick={exporterPdf}
                  disabled={tries.length === 0}
                  title="Exporter la liste affichée en PDF"
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-jr-doux transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-lien disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                >
                  <FileText size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">PDF</span>
                  <span className="sr-only sm:hidden">Exporter en PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => chargerCompteurs()}
                  className="rounded-md p-2.5 text-jr-faible transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-lien motion-reduce:transition-none"
                  title="Actualiser la liste"
                  aria-label="Actualiser la liste"
                >
                  <RefreshCw
                    size={18}
                    aria-hidden="true"
                    className={actualisation ? 'animate-spin motion-reduce:animate-none' : ''}
                  />
                </button>
              </div>
            </div>

            {/* Annonce vocale du nombre de résultats */}
            <p className="sr-only" role="status" aria-live="polite">
              {formatNombre(tries.length)} compteur{tries.length > 1 ? 's' : ''} affiché
              {tries.length > 1 ? 's' : ''}
            </p>

            <CompteursTable
              elements={elements}
              totalFiltre={tries.length}
              totalTous={compteurs.length}
              premierChargement={premierChargement}
              erreurChargement={erreurChargement}
              onRecharger={() => chargerCompteurs()}
              tri={tri}
              dir={dir}
              onTrier={changerTri}
              onTriMobile={changerTriMobile}
              onModifier={ouvrirEdition}
              onChangerStatut={demanderStatut}
              surligneId={surligneId}
              page={pageCourante}
              nbPages={nbPages}
              taillePage={taillePage}
              debut={debut}
              onPage={(numero) => setPage(Math.min(Math.max(numero, 1), nbPages))}
              onTaillePage={setTaillePage}
              onAjouter={ouvrirCreation}
              onReset={resetFiltres}
            />
          </section>
        </main>
      </div>

      {/* ==================================================
          TOASTS (en bas à droite)
      ================================================== */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => {
          const erreur = toast.genre === 'erreur';
          const Icone = erreur ? CircleAlert : CircleCheck;

          return (
            <div
              key={toast.id}
              role={erreur ? 'alert' : 'status'}
              className="jr-toast jr-verre-fort pointer-events-auto flex items-start gap-3 rounded-md border border-jr-bordure py-3 pl-3 pr-2 shadow-lg"
              style={{
                borderLeft: `4px solid ${erreur ? 'var(--jr-err)' : 'var(--jr-ok)'}`,
              }}
            >
              <Icone
                size={18}
                aria-hidden="true"
                className={`mt-0.5 shrink-0 ${erreur ? 'text-jr-err' : 'text-jr-ok'}`}
              />

              <p className="flex-1 text-sm font-medium text-jr-texte">
                {toast.message}
              </p>

              <button
                type="button"
                onClick={() => fermerToast(toast.id)}
                aria-label="Fermer le message"
                className="rounded p-1 text-jr-faible hover:text-jr-texte"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {/* ==================================================
          MODAL AJOUT / MODIFICATION
      ================================================== */}
      {modalOuvert && (
        <CompteurModal
          key={compteurEnEdition?.id ?? 'nouveau'}
          compteur={compteurEnEdition}
          compteurs={compteurs}
          abonnes={abonnes}
          chargementAbonnes={loadingAbonnes}
          erreurAbonnes={erreurAbonnes}
          onRelancerAbonnes={chargerAbonnes}
          enregistrement={saving}
          erreurServeur={erreurModal}
          cleErreur={cleErreur}
          onFermer={fermerModal}
          onEnregistrer={enregistrer}
        />
      )}

      {/* ==================================================
          CONFIRMATION DE CHANGEMENT DE STATUT
      ================================================== */}
      {confirmation && (
        <ConfirmStatutDialog
          compteur={confirmation.compteur}
          statut={confirmation.statut}
          onConfirmer={confirmerStatut}
          onAnnuler={() => setConfirmation(null)}
        />
      )}
    </AdminShell>
  );
}

export default CompteursPage;
