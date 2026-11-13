import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Save,
  RefreshCw,
  Droplets,
  Zap,
  FileText,
} from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import axiosClient from '../../api/axiosClient.js';
import Sidebar from '../../components/admin/Sidebar.jsx';
import Header from '../../components/admin/Header.jsx';
import AdminShell from '../../components/admin/AdminShell.jsx';
import ResponsableLayout from '../../components/admin/responsable/ResponsableLayout.jsx';
import CreationTransition, { useCreationTransition } from '../../components/ui/CreationTransition.jsx';
import { estDebutGroupeReleves } from '../../components/admin/releves/relevesUtils.js';
import { ecouterChangementAbonnes } from '../../hooks/abonnesSync.js';

/* =========================================================
   UTILITAIRES
========================================================= */

function getToday() {
  const date = new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(
    `${String(value).slice(0, 10)}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('fr-FR');
}

function formatDateInstallation(value) {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).slice(0, 10));
  if (!match) return '—';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return '—';
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return `${day} ${months[month - 1]} ${year}`;
}

function toInputDate(value) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 10);
}

function calculateDays(startDate, endDate) {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(
    `${String(startDate).slice(0, 10)}T00:00:00`
  );

  const end = new Date(
    `${String(endDate).slice(0, 10)}T00:00:00`
  );

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return null;
  }

  const difference =
    end.getTime() -
    start.getTime();

  const days = Math.round(
    difference /
      (1000 * 60 * 60 * 24)
  );

  return days >= 0 ? days : null;
}

function sortRelevesDesc(data = []) {
  return [...data].sort((a, b) => {
    const dateA = new Date(
      `${toInputDate(a.date_releve)}T00:00:00`
    ).getTime();

    const dateB = new Date(
      `${toInputDate(b.date_releve)}T00:00:00`
    ).getTime();

    if (dateA !== dateB) {
      return dateB - dateA;
    }

    return (
      Number(b.id || 0) -
      Number(a.id || 0)
    );
  });
}

/*
 * Recherche le relevé immédiatement précédent
 * par rapport à une date donnée.
 *
 * Important :
 * On ne prend pas simplement le "dernier" relevé.
 * On prend le dernier relevé dont la date est
 * STRICTEMENT antérieure à la date actuelle.
 */
function findPreviousReleve(
  data = [],
  currentDate = ''
) {
  if (
    !currentDate ||
    !Array.isArray(data) ||
    data.length === 0
  ) {
    return null;
  }

  const normalizedCurrentDate =
    toInputDate(currentDate);

  const sortedAsc =
    [...data].sort((a, b) => {
      const dateA =
        toInputDate(
          a.date_releve
        );

      const dateB =
        toInputDate(
          b.date_releve
        );

      if (dateA !== dateB) {
        return dateA.localeCompare(
          dateB
        );
      }

      return (
        Number(a.id || 0) -
        Number(b.id || 0)
      );
    });

  let previous = null;

  for (const releve of sortedAsc) {
    const releveDate =
      toInputDate(
        releve.date_releve
      );

    if (
      releveDate <
      normalizedCurrentDate
    ) {
      previous = releve;
    } else {
      break;
    }
  }

  return previous;
}

/* =========================================================
   DONNÉES DE FACTURATION TEMPORAIRES
   À VALIDER / À REMPLACER PAR LES RÈGLES RÉELLES JIRAMA
========================================================= */

const FACTURATION_TEMPORAIRE = {
  ELECTRICITE: {
    tarif: '20 - Économique',
    prixUnitaire: 340,
    unitePrix: 'Ar/kWh',
  },

  EAU: {
    tarif: '50',
    prixUnitaire: 415,
    unitePrix: 'Ar/m³',
  },

  taxes: [
    {
      libelle: 'Taxe communale',
      montantElectricite: 1060.8,
      montantEau: 83.0,
    },
    {
      libelle: 'Surtaxe communale',
      montantElectricite: 194.48,
      montantEau: 0,
    },
    {
      libelle: 'Fonds national de l’énergie durable',
      montantElectricite: 442.0,
      montantEau: 22.83,
    },
    {
      libelle: 'Redevance assainissement eaux usées',
      montantElectricite: 0,
      montantEau: 0,
    },
  ],

  redevanceJiramaElectricite: 3018.0,
  redevanceJiramaEau: 0,

  taxeCommunaleElectricite: 1060.8,
  taxeCommunaleEau: 83.0,

  surtaxeCommunaleElectricite: 194.48,
  surtaxeCommunaleEau: 0,

  fondsEnergieElectricite: 442.0,
  fondsEnergieEau: 22.83,

  tvaElectricite: 3539.38,
  tvaEau: 0,

  sousTotalElectricite: 49999.6,
  sousTotalEau: 7920.0,

  totalElectricite: 55236.26,
  totalEau: 8025.83,

  montantAPayer: 63262.09,
  netAPayer: 63262.09,
};

/* =========================================================
   UTILITAIRES FACTURATION TEMPORAIRE
========================================================= */

function formatAmount(value) {
  return Number(value || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getFacturationTemporaire(type) {
  return type === 'EAU'
    ? FACTURATION_TEMPORAIRE.EAU
    : FACTURATION_TEMPORAIRE.ELECTRICITE;
}

/* =========================================================
   AFFICHAGE : identité des types de compteur et outils de rendu
   (ajouts de présentation uniquement, aucune logique métier)
   Eau = bleu, électricité = orange. Les textes utilisent
   --jr-lien / --jr-attention pour rester lisibles en sombre.
========================================================= */
const STYLE_TYPE = {
  EAU: {
    libelle: 'Eau',
    unite: 'm³',
    texte: 'var(--jr-lien)',
    fond: 'var(--jr-eau-pale)',
    trait: 'var(--jr-eau-clair)',
  },
  ELECTRICITE: {
    libelle: 'Électricité',
    unite: 'kWh',
    texte: 'var(--jr-attention)',
    fond: 'var(--jr-elec-pale)',
    trait: 'var(--jr-elec)',
  },
};

const styleType = (type) =>
  type === 'EAU' ? STYLE_TYPE.EAU : STYLE_TYPE.ELECTRICITE;

const FILTRES_TYPE = [
  { valeur: '', libelle: 'Tous' },
  { valeur: 'EAU', libelle: 'Eau' },
  { valeur: 'ELECTRICITE', libelle: 'Électricité' },
];

const pourcent = (partie, total) =>
  total ? Math.round((partie / total) * 100) : 0;

const formatNombre = (n) => Number(n || 0).toLocaleString('fr-FR');

const formatConso = (n) =>
  Number(n || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const nomAbonneDe = (releve) =>
  releve.abonne_prenom
    ? `${releve.abonne_prenom} ${releve.abonne_nom || ''}`.trim()
    : releve.abonne_nom || '—';

const initialesDe = (releve) => {
  const a = String(releve.abonne_prenom || '').trim().charAt(0);
  const b = String(releve.abonne_nom || '').trim().charAt(0);
  return (a + b).toUpperCase() || '?';
};

// Teinte stable (eau ou électricité) déduite du numéro d'abonné
const teinteAbonne = (numero) => {
  const somme = String(numero || '')
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return somme % 2 === 0 ? 'EAU' : 'ELECTRICITE';
};

/* =========================================================
   PAGE
========================================================= */

function RelevesPage() {
  const navigate = useNavigate();

  const { transitionActive, jouerTransition } = useCreationTransition();

  const [currentUser, setCurrentUser] =
    useState(() => {
      try {
        return JSON.parse(localStorage.getItem('user') || 'null');
      } catch {
        return null;
      }
    });

  const [releves, setReleves] =
    useState([]);

  const [compteurs, setCompteurs] =
    useState([]);

  const [historiqueCompteur, setHistoriqueCompteur] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingCompteurs, setLoadingCompteurs] =
    useState(true);

  const [loadingHistorique, setLoadingHistorique] =
    useState(false);

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

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingReleve, setEditingReleve] =
    useState(null);

  /* =========================================================
     FORMULAIRE
  ========================================================= */

  const [form, setForm] = useState({
    compteur_id: '',
    date_ancien_releve: '',
    date_releve: getToday(),
    ancien_index: '',
    nouvel_index: '',
  });

  /* =========================================================
     UTILISATEUR
  ========================================================= */

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

      const role = String(user?.role || '').trim().toUpperCase();

      if (!['AGENT', 'RESPONSABLE'].includes(role)) {
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

  /* =========================================================
     CHARGER RELEVÉS
  ========================================================= */

  const loadReleves = async () => {
    try {
      setLoading(true);
      setError('');

      const response =
        await axiosClient.get(
          '/releves'
        );

      setReleves(
        response.data?.releves || []
      );
    } catch (err) {
      console.error(
        'Erreur chargement relevés :',
        err
      );

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        navigate('/', {
          replace: true,
        });

        return;
      }

      setError(
        err.response?.data?.message ||
          'Impossible de charger les relevés.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     CHARGER COMPTEURS
  ========================================================= */

  const loadCompteurs = async () => {
    try {
      setLoadingCompteurs(true);

      const response =
        await axiosClient.get(
          '/compteurs'
        );

      setCompteurs(
        response.data?.compteurs || []
      );
    } catch (err) {
      console.error(
        'Erreur chargement compteurs :',
        err
      );

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');

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
      setLoadingCompteurs(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    loadReleves();
    loadCompteurs();
    return ecouterChangementAbonnes(() => {
      loadReleves();
      loadCompteurs();
    });
  }, [currentUser]);

  /* =========================================================
     HISTORIQUE COMPTEUR
  ========================================================= */

  const loadHistoriqueCompteur = async (
    compteurId,
    excludeId = null
  ) => {
    if (!compteurId) {
      setHistoriqueCompteur([]);
      return [];
    }

    try {
      setLoadingHistorique(true);
      setError('');

      const response =
        await axiosClient.get(
          `/releves/compteur/${compteurId}`
        );

      let data =
        response.data?.releves || [];

      if (excludeId) {
        data = data.filter(
          (releve) =>
            Number(releve.id) !==
            Number(excludeId)
        );
      }

      data =
        sortRelevesDesc(data);

      setHistoriqueCompteur(data);

      return data;
    } catch (err) {
      console.error(
        'Erreur historique compteur :',
        err
      );

      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        navigate('/', {
          replace: true,
        });

        return [];
      }

      setError(
        err.response?.data?.message ||
          'Impossible de charger l’historique du compteur.'
      );

      setHistoriqueCompteur([]);

      return [];
    } finally {
      setLoadingHistorique(false);
    }
  };

  /* =========================================================
     COMPTEUR SÉLECTIONNÉ
  ========================================================== */

  const selectedCompteur = useMemo(() => {
    if (!form.compteur_id) {
      return null;
    }

    return (
      compteurs.find(
        (compteur) =>
          String(compteur.id) ===
          String(form.compteur_id)
      ) || null
    );
  }, [
    compteurs,
    form.compteur_id,
  ]);

  /* =========================================================
     DATE INSTALLATION
  ========================================================== */

  const dateInstallation =
    selectedCompteur?.date_installation
      ? toInputDate(
          selectedCompteur.date_installation
        )
      : '';

  /* =========================================================
     RELEVÉ PRÉCÉDENT SELON LA DATE
  ========================================================== */

  const previousReleveForForm =
    useMemo(() => {
      return findPreviousReleve(
        historiqueCompteur,
        form.date_releve
      );
    }, [
      historiqueCompteur,
      form.date_releve,
    ]);

  /* =========================================================
     PREMIER RELEVÉ POUR LA DATE CHOISIE
  ========================================================== */

  const isFirstReleve =
    !previousReleveForForm;

  /* =========================================================
     DATE DE DÉBUT EFFECTIVE DE LA PÉRIODE
  ========================================================== */

  const effectiveDateAncienReleve =
    previousReleveForForm
      ? toInputDate(
          previousReleveForForm.date_releve
        )
      : form.date_ancien_releve || '';

  /* =========================================================
     ANCIEN INDEX EFFECTIF
  ========================================================== */

  const effectiveAncienIndex =
    previousReleveForForm
      ? Number(
          previousReleveForForm.nouvel_index
        )
      : form.ancien_index === ''
      ? ''
      : Number(
          form.ancien_index
        );

  /* =========================================================
     ORIGINE DE LA PÉRIODE
  ========================================================== */

  const originePeriode =
    previousReleveForForm
      ? 'RELEVE_PRECEDENT'
      : form.date_ancien_releve
      ? 'RELEVE_ANTERIEUR'
      : null;

  /* =========================================================
     NOMBRE DE JOURS
  ========================================================== */

  const nombreJours =
    useMemo(() => {
      return calculateDays(
        effectiveDateAncienReleve,
        form.date_releve
      );
    }, [
      effectiveDateAncienReleve,
      form.date_releve,
    ]);

  /* =========================================================
     CONSOMMATION
  ========================================================== */

  const consumptionPreview =
    useMemo(() => {
      if (
        effectiveAncienIndex === '' ||
        form.nouvel_index === ''
      ) {
        return null;
      }

      const ancien =
        Number(
          effectiveAncienIndex
        );

      const nouveau =
        Number(
          form.nouvel_index
        );

      if (
        !Number.isFinite(ancien) ||
        ancien < 0
      ) {
        return null;
      }

      if (
        !Number.isFinite(nouveau) ||
        nouveau < 0
      ) {
        return null;
      }

      if (
        nouveau < ancien
      ) {
        return null;
      }

      return Number(
        (
          nouveau - ancien
        ).toFixed(2)
      );
    }, [
      effectiveAncienIndex,
      form.nouvel_index,
    ]);

  /* =========================================================
     DERNIER RELEVÉ DE CHAQUE COMPTEUR
  ========================================================== */

  const dernierReleveParCompteur =
    useMemo(() => {
      const map = new Map();

      releves.forEach(
        (releve) => {
          const compteurId =
            String(
              releve.compteur_id ??
                ''
            );

          if (!compteurId) {
            return;
          }

          const dateCourante =
            new Date(
              `${toInputDate(
                releve.date_releve
              )}T00:00:00`
            ).getTime();

          const existant =
            map.get(
              compteurId
            );

          if (!existant) {
            map.set(
              compteurId,
              {
                id: Number(
                  releve.id
                ),
                date:
                  dateCourante,
              }
            );

            return;
          }

          const dateExistante =
            existant.date;

          if (
            dateCourante >
              dateExistante ||
            (
              dateCourante ===
                dateExistante &&
              Number(
                releve.id
              ) >
                Number(
                  existant.id
                )
            )
          ) {
            map.set(
              compteurId,
              {
                id: Number(
                  releve.id
                ),
                date:
                  dateCourante,
              }
            );
          }
        }
      );

      return map;
    }, [
      releves,
    ]);

  const isDernierReleve = (
    releve
  ) => {
    const compteurId =
      String(
        releve?.compteur_id ??
          ''
      );

    if (
      !compteurId ||
      !releve?.id
    ) {
      return false;
    }

    return (
      Number(
        dernierReleveParCompteur.get(
          compteurId
        )?.id
      ) ===
      Number(
        releve.id
      )
    );
  };

  /* =========================================================
     FILTRAGE TABLEAU
  ========================================================== */

  const filteredReleves =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return releves.filter(
        (releve) => {
          const nomAbonne =
            `${releve.abonne_prenom || ''} ${
              releve.abonne_nom || ''
            }`
              .trim()
              .toLowerCase();

          const matchesSearch =
            !query ||
            [
              releve.numero_compteur,
              releve.numero_abonne,
              releve.type_compteur,
              nomAbonne,
              releve.saisie_par,
            ].some(
              (value) =>
                String(
                  value || ''
                )
                  .toLowerCase()
                  .includes(
                    query
                  )
            );

          const matchesType =
            !typeFilter ||
            releve.type_compteur ===
              typeFilter;

          return (
            matchesSearch &&
            matchesType
          );
        }
      );
    }, [
      releves,
      search,
      typeFilter,
    ]);

  /* =========================================================
     NOUVEAU RELEVÉ
  ========================================================== */

  const openCreateModal =
    () => {
      setEditingReleve(null);

      setHistoriqueCompteur(
        []
      );

      setForm({
        compteur_id: '',
        date_ancien_releve: '',
        date_releve: getToday(),
        ancien_index: '',
        nouvel_index: '',
      });

      setError('');
      setSuccess('');

      setModalOpen(true);
    };

  /* =========================================================
     MODIFIER UN RELEVÉ
  ========================================================== */

  const openEditModal =
    async (
      releve
    ) => {
      setEditingReleve(
        releve
      );

      const dateReleve =
        toInputDate(
          releve.date_releve
        );

      setForm({
        compteur_id:
          String(
            releve.compteur_id
          ),

        date_ancien_releve:
          toInputDate(
            releve.date_ancien_releve
          ),

        date_releve:
          dateReleve,

        ancien_index:
          releve.ancien_index ??
          '',

        nouvel_index:
          releve.nouvel_index ??
          '',
      });

      setError('');
      setSuccess('');
      setHistoriqueCompteur(
        []
      );
      setModalOpen(true);

      const data =
        await loadHistoriqueCompteur(
          releve.compteur_id,
          releve.id
        );

      /*
       * Très important :
       * le précédent est déterminé selon
       * la DATE ACTUELLE DU FORMULAIRE.
       */
      const previous =
        findPreviousReleve(
          data,
          dateReleve
        );

      if (previous) {
        setForm(
          (
            previousForm
          ) => ({
            ...previousForm,

            date_ancien_releve:
              toInputDate(
                previous.date_releve
              ),

            ancien_index:
              previous.nouvel_index ??
              '',
          })
        );
      } else {
        /*
         * S'il n'y a aucun précédent pour la
         * date choisie, on conserve les valeurs
         * enregistrées du premier relevé.
         */
        setForm(
          (
            previousForm
          ) => ({
            ...previousForm,

            date_ancien_releve:
              previousForm.date_ancien_releve ||
              '',

            ancien_index:
              previousForm.ancien_index ??
              '',
          })
        );
      }
    };

  /* =========================================================
     CHANGEMENT COMPTEUR
  ========================================================== */

  const handleCompteurChange =
    async (
      event
    ) => {
      const compteurId =
        event.target.value;

      setError('');
      setSuccess('');

      setForm(
        (previous) => ({
          ...previous,

          compteur_id:
            compteurId,

          date_ancien_releve:
            '',

          ancien_index:
            '',

          nouvel_index:
            '',
        })
      );

      setHistoriqueCompteur(
        []
      );

      if (!compteurId) {
        return;
      }

      const currentDate =
        form.date_releve ||
        getToday();

      const data =
        await loadHistoriqueCompteur(
          compteurId
        );

      const previous =
        findPreviousReleve(
          data,
          currentDate
        );

      if (previous) {
        setForm(
          (
            previousForm
          ) => ({
            ...previousForm,

            compteur_id:
              compteurId,

            date_ancien_releve:
              toInputDate(
                previous.date_releve
              ),

            ancien_index:
              previous.nouvel_index ??
              '',
          })
        );
      }
    };

  /* =========================================================
     CHANGEMENT FORMULAIRE
  ========================================================== */

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    /*
     * Cas particulier :
     * quand la date du relevé actuel change,
     * on recalcule immédiatement le relevé
     * précédent.
     */
    if (
      name ===
      'date_releve'
    ) {
      const previous =
        findPreviousReleve(
          historiqueCompteur,
          value
        );

      if (previous) {
        setForm(
          (formulaire) => ({
            ...formulaire,

            date_releve:
              value,

            date_ancien_releve:
              toInputDate(
                previous.date_releve
              ),

            ancien_index:
              previous.nouvel_index ??
              '',
          })
        );
      } else {
        /*
         * Aucun relevé antérieur à cette date :
         * on passe en mode premier relevé.
         *
         * On vide les valeurs automatiques afin
         * d'éviter d'utiliser le précédent d'une
         * autre période.
         */
        setForm(
          (formulaire) => ({
            ...formulaire,

            date_releve:
              value,

            date_ancien_releve:
              '',

            ancien_index:
              '',
          })
        );
      }

      setError('');
      setSuccess('');

      return;
    }

    setForm(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );

    setError('');
    setSuccess('');
  };

  /* =========================================================
     FERMER MODAL
  ========================================================== */

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalOpen(false);

    setEditingReleve(
      null
    );

    setHistoriqueCompteur(
      []
    );

    setForm({
      compteur_id: '',
      date_ancien_releve: '',
      date_releve: getToday(),
      ancien_index: '',
      nouvel_index: '',
    });

    setError('');
    setSuccess('');
  };

  /* =========================================================
     VALIDATION FRONTEND
  ========================================================== */

  const validateForm = () => {
    if (!form.compteur_id) {
      return 'Veuillez sélectionner un compteur.';
    }

    if (!selectedCompteur) {
      return 'Le compteur sélectionné est introuvable.';
    }

    if (
      selectedCompteur.statut ===
      'INACTIF'
    ) {
      return 'Ce compteur est inactif.';
    }

    if (!form.date_releve) {
      return 'Veuillez saisir la date du relevé actuel.';
    }

    const dateActuelle =
      toInputDate(
        form.date_releve
      );

    const datePrecedente =
      toInputDate(
        effectiveDateAncienReleve
      );

    /*
     * Premier relevé :
     * date précédente obligatoire.
     */
    if (
      isFirstReleve &&
      !datePrecedente
    ) {
      return 'Veuillez saisir la date du relevé précédent.';
    }

    /*
     * Le relevé actuel doit être strictement
     * postérieur au relevé précédent.
     */
    if (
      datePrecedente &&
      dateActuelle <=
        datePrecedente
    ) {
      return 'La date du relevé actuel doit être postérieure à la date du relevé précédent.';
    }

    /*
     * La date du relevé actuel ne peut pas
     * être antérieure à l'installation.
     */
    if (
      dateInstallation &&
      dateActuelle <
        dateInstallation
    ) {
      return 'La date du relevé actuel ne peut pas être antérieure à la date d’installation.';
    }

    /*
     * La date du relevé précédent ne peut pas
     * être antérieure à l'installation.
     */
    if (
      dateInstallation &&
      datePrecedente &&
      datePrecedente <
        dateInstallation
    ) {
      return 'La date du relevé précédent ne peut pas être antérieure à la date d’installation.';
    }

    /*
     * Ancien index effectif.
     */
    if (
      effectiveAncienIndex ===
      ''
    ) {
      return 'Veuillez saisir l’ancien index.';
    }

    /*
     * Nouvel index.
     */
    if (
      form.nouvel_index ===
      ''
    ) {
      return 'Veuillez saisir le nouvel index.';
    }

    const ancien =
      Number(
        effectiveAncienIndex
      );

    const nouveau =
      Number(
        form.nouvel_index
      );

    if (
      !Number.isFinite(
        ancien
      ) ||
      ancien < 0
    ) {
      return 'L’ancien index est invalide.';
    }

    if (
      !Number.isFinite(
        nouveau
      ) ||
      nouveau < 0
    ) {
      return 'Le nouvel index est invalide.';
    }

    if (
      nouveau < ancien
    ) {
      return 'Le nouvel index doit être supérieur ou égal à l’ancien index.';
    }

    if (
      nombreJours ===
        null ||
      nombreJours <= 0
    ) {
      return 'La période entre les deux dates est invalide.';
    }

    return null;
  };

  /* =========================================================
     ENREGISTRER
  ========================================================== */

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      setError('');
      setSuccess('');

      const validationError =
        validateForm();

      if (validationError) {
        setError(
          validationError
        );

        return;
      }

      setSaving(true);

      try {
        /*
         * Le frontend envoie les valeurs affichées.
         *
         * Pour un relevé avec précédent, ces valeurs
         * viennent automatiquement de la base via
         * historiqueCompteur.
         *
         * Le backend doit néanmoins rester l'autorité
         * et refaire les vérifications.
         */
        const payload = {
          compteur_id:
            Number(
              form.compteur_id
            ),

          date_ancien_releve:
            effectiveDateAncienReleve ||
            null,

          date_releve:
            form.date_releve,

          ancien_index:
            Number(
              effectiveAncienIndex
            ),

          nouvel_index:
            Number(
              form.nouvel_index
            ),
        };

        let response;

        if (
          editingReleve
        ) {
          response =
            await axiosClient.put(
              `/releves/${editingReleve.id}`,
              payload
            );
        } else {
          response =
            await axiosClient.post(
              '/releves',
              payload
            );

            // Bref écran de chargement JIRAMA pendant le rechargement de la liste.
            jouerTransition();
        }

        setSuccess(
          response.data?.message ||
            (
              editingReleve
                ? 'Relevé modifié avec succès.'
                : 'Relevé enregistré avec succès.'
            )
        );

        await loadReleves();

        if (
          form.compteur_id
        ) {
          await loadHistoriqueCompteur(
            form.compteur_id
          );
        }

        setTimeout(
          () => {
            setModalOpen(
              false
            );

            setEditingReleve(
              null
            );

            setHistoriqueCompteur(
              []
            );

            setForm({
              compteur_id: '',
              date_ancien_releve: '',
              date_releve: getToday(),
              ancien_index: '',
              nouvel_index: '',
            });

            setSuccess(
              ''
            );
          },
          700
        );
      } catch (err) {
        console.error(
          'Erreur enregistrement relevé :',
          err
        );

        if (
          err.response
            ?.status === 401 ||
          err.response
            ?.status === 403
        ) {
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

          return;
        }

        setError(
          err.response?.data
            ?.message ||
            'Une erreur est survenue lors de l’enregistrement.'
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =========================================================
     GÉNÉRER PDF — FACTURE COMBINÉE EAU + ÉLECTRICITÉ

     Mise en page alignée sur la facture JIRAMA de référence.
     - La détection des services repose sur les compteurs et
       relevés réels de l'abonné (abonne_id), jamais sur le
       seul type de compteur depuis lequel on lance le PDF.
     - Les tarifs / taxes restent ceux de FACTURATION_TEMPORAIRE
       (aucun nouveau calcul).
     - Le « MONTANT DÉJÀ PAYÉ » vient de la table `paiements`
       via GET /api/paiements/facture (abonne_id + période).
  ========================================================== */

  const generateRelevePDF = async (releve) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;

      const BLUE = [0, 78, 145];
      const ORANGE = [205, 112, 45];
      const LIGHT_BLUE = [236, 243, 250];
      const LIGHT_ORANGE = [252, 244, 237];
      const DARK = [35, 35, 35];
      const GRAY = [95, 95, 95];
      const BORDER = [90, 130, 175];

      /* ----------------------------------------------------
         Formatage numérique pour jsPDF.
         toLocaleString('fr-FR') produit des espaces insécables
         (U+00A0 / U+202F) que jsPDF encode en caractère nul
         dans le flux du PDF : on les remplace par des espaces
         ASCII pour que montants et mois restent lisibles.
      ---------------------------------------------------- */
      const espacesVisibles = (texte) => String(texte).replace(/[\u00A0\u202F]/g, ' ');

      const formatAmount = (value) =>
        espacesVisibles(
          Number(value || 0).toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );

      const dateReleve = toInputDate(releve.date_releve);
      const periodeFacture = dateReleve.slice(0, 7); // YYYY-MM : période mensuelle de la facture.
      const normalizeTypeCompteur = (value) => String(value || '').trim().toUpperCase();
      const isSameAbonne = (item) => {
        // Préférer l'identifiant relationnel ; utiliser le numéro d'abonné uniquement
        // lorsque l'API ne fournit pas l'identifiant.
        if (releve.abonne_id != null && item.abonne_id != null) {
          return Number(item.abonne_id) === Number(releve.abonne_id);
        }
        return String(item.numero_abonne || '') === String(releve.numero_abonne || '');
      };

      const relevesMemePeriode = releves.filter((item) =>
        isSameAbonne(item) && toInputDate(item.date_releve).slice(0, 7) === periodeFacture
      );
      if (!relevesMemePeriode.some((item) => Number(item.id) === Number(releve.id))) {
        relevesMemePeriode.push(releve);
      }

      const latestByType = (type) => relevesMemePeriode
        .filter((item) => normalizeTypeCompteur(item.type_compteur || item.type) === type)
        .sort((a, b) => {
          const dateDiff = toInputDate(b.date_releve).localeCompare(toInputDate(a.date_releve));
          return dateDiff || Number(b.id || 0) - Number(a.id || 0);
        })[0] || null;

      const elec = latestByType('ELECTRICITE');
      const eau = latestByType('EAU');

      // Déterminer les services réellement associés à l'abonné à partir de /api/compteurs.
      const compteursAbonne = compteurs.filter((item) => {
        if (releve.abonne_id != null && item.abonne_id != null) {
          return Number(item.abonne_id) === Number(releve.abonne_id);
        }
        return String(item.numero_abonne || '') === String(releve.numero_abonne || '');
      });
      const typesCompteursAbonne = new Set(
        compteursAbonne.map((item) => normalizeTypeCompteur(item.type_compteur || item.type))
      );
      const possedeElectricite = typesCompteursAbonne.has('ELECTRICITE');
      const possedeEau = typesCompteursAbonne.has('EAU');

      // Ne pas émettre silencieusement une facture combinée incomplète si le compteur
      // du service existe, mais que son relevé de la période n'est pas disponible.
      const servicesManquants = [];
      if (possedeElectricite && !elec) servicesManquants.push('électricité');
      if (possedeEau && !eau) servicesManquants.push('eau');
      if (servicesManquants.length > 0) {
        setError(
          `Facture non générée : le relevé ${servicesManquants.join(' et ')} est absent pour ${periodeFacture}. Vérifiez la période avant de générer la facture combinée.`
        );
        return;
      }
      if (!elec && !eau) {
        setError('Facture non générée : aucun relevé valide trouvé pour cet abonné et cette période.');
        return;
      }

      /* =====================================================
         PAIEMENTS RÉELLEMENT ENREGISTRÉS (table `paiements`)
         Source du « MONTANT DÉJÀ PAYÉ » (6) et du NET À PAYER.
      ===================================================== */
      let montantDejaPaye = null;
      let nombrePaiements = 0;

      if (releve.abonne_id != null) {
        try {
          const reponse = await axiosClient.get('/paiements/facture', {
            params: {
              abonne_id: Number(releve.abonne_id),
              periode: periodeFacture,
            },
          });

          if (reponse.data && reponse.data.status === 'success') {
            montantDejaPaye = Math.max(0, Number(reponse.data.montant_paye || 0));
            nombrePaiements = Number(reponse.data.nombre_paiements || 0);
          }
        } catch (paiementError) {
          console.warn(
            'Paiements indisponibles pour la facture :',
            paiementError?.response?.data?.message || paiementError.message
          );
        }
      }

      // Repli sur un champ éventuellement transmis par l'API relevés, à défaut
      // d'identifiant d'abonné ou d'endpoint joignable. La base confirme alors
      // l'absence de paiement via montant_paye = 0.
      if (montantDejaPaye === null) {
        const paidAmountRaw = [
          releve.montant_deja_paye,
          releve.montant_paye,
          releve.total_paye,
          releve.montant_regle,
        ].find((value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)));

        if (paidAmountRaw !== undefined) {
          montantDejaPaye = Math.max(0, Number(paidAmountRaw));
        }
      }

      const paiementDisponible = montantDejaPaye !== null;

      /* =====================================================
         MONTANTS — CALCULS EXISTANTS, AUCUNE RÈGLE MODIFIÉE
      ===================================================== */
      const elecConso = Number(elec?.consommation || 0);
      const eauConso = Number(eau?.consommation || 0);
      const elecUnit = FACTURATION_TEMPORAIRE.ELECTRICITE.prixUnitaire;
      const eauUnit = FACTURATION_TEMPORAIRE.EAU.prixUnitaire;
      const elecMontantConso = elecConso * elecUnit;
      const eauMontantConso = eauConso * eauUnit;
      const fmtServiceAmount = (service, value) => (service ? formatAmount(value) : '—');

      const montantFacture =
        (elec ? Number(FACTURATION_TEMPORAIRE.totalElectricite) : 0) +
        (eau ? Number(FACTURATION_TEMPORAIRE.totalEau) : 0);

      // Arrondi au centime : la somme des deux totaux (55 236,26 + 8 025,83)
      // et le montant payé diffèrent parfois d'un reliquat flottant (1e-12),
      // qui ferait afficher « PAYÉE PARTIELLEMENT » sur une facture soldée.
      const netAPayer = paiementDisponible
        ? Math.max(0, Math.round((montantFacture - montantDejaPaye) * 100) / 100)
        : null;

      const statutPaiement = !paiementDisponible
        ? 'À VÉRIFIER'
        : netAPayer <= 0
          ? 'PAYÉE'
          : montantDejaPaye > 0
            ? 'PAYÉE PARTIELLEMENT'
            : 'NON RÉGLÉE';

      /* =====================================================
         MONTANT EN TOUTES LETTRES (comme la facture de réf.)
      ===================================================== */
      const CHIFFRES_LETTRES = [
        'ZÉRO', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF',
        'DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE',
        'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF',
      ];
      const DIZAINES_LETTRES = [
        '', '', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE',
        'SOIXANTE', 'SOIXANTE', 'QUATRE-VINGT', 'QUATRE-VINGT',
      ];

      const nombreEnLettres = (nombre) => {
        const n = Math.floor(Math.abs(nombre));

        if (n < 20) return CHIFFRES_LETTRES[n];

        if (n < 100) {
          const d = Math.floor(n / 10);
          const u = n % 10;

          if (n === 71) return 'SOIXANTE ET ONZE';
          if (d === 7 || d === 9) return `${DIZAINES_LETTRES[d]}-${CHIFFRES_LETTRES[10 + u]}`;
          if (u === 0) return d === 8 ? 'QUATRE-VINGTS' : DIZAINES_LETTRES[d];
          if (u === 1 && d !== 8) return `${DIZAINES_LETTRES[d]} ET UN`;
          return `${DIZAINES_LETTRES[d]}-${CHIFFRES_LETTRES[u]}`;
        }

        if (n < 1000) {
          const c = Math.floor(n / 100);
          const r = n % 100;
          const tete = c === 1 ? 'CENT' : `${CHIFFRES_LETTRES[c]} CENT`;
          if (r === 0) return c === 1 ? 'CENT' : `${tete}S`;
          return `${tete} ${nombreEnLettres(r)}`;
        }

        if (n < 1000000) {
          const m = Math.floor(n / 1000);
          const r = n % 1000;
          const tete = m === 1 ? 'MILLE' : `${nombreEnLettres(m)} MILLE`;
          return r === 0 ? tete : `${tete} ${nombreEnLettres(r)}`;
        }

        const mi = Math.floor(n / 1000000);
        const r = n % 1000000;
        const tete = mi === 1 ? 'UN MILLION' : `${nombreEnLettres(mi)} MILLIONS`;
        return r === 0 ? tete : `${tete} ${nombreEnLettres(r)}`;
      };

      const montantEnLettres = (valeur) => {
        const entier = Math.floor(valeur);
        const centimes = Math.round((valeur - entier) * 100);

        let texte = nombreEnLettres(entier);
        if (centimes > 0) {
          texte += ` ARIARY ${centimes < 10 ? `ZÉRO ${CHIFFRES_LETTRES[centimes]}` : nombreEnLettres(centimes)}`;
        } else {
          texte += ' ARIARY';
        }
        return `***${texte}***`;
      };

      /* =====================================================
         IDENTITÉ DE LA FACTURE
      ===================================================== */
      const abonnement = releve.numero_abonne || 'Non renseigné';
      const nomAbonne =
        [releve.abonne_prenom, releve.abonne_nom].filter(Boolean).join(' ') ||
        'Non renseigné';
      const adresse = releve.abonne_adresse || 'Non renseignée';

      const moisFacture = espacesVisibles(
        new Date(`${dateReleve || getToday()}T00:00:00`).toLocaleDateString('fr-FR', {
          month: 'long',
          year: 'numeric',
        })
      );

      // Un même abonné et un même mois produisent le même numéro de facture,
      // qu'on lance le PDF depuis le relevé EAU ou ÉLECTRICITÉ.
      const referenceAbonnePDF = String(releve.abonne_id || abonnement)
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(-12) || 'ABONNE';
      const factureNumero = `REL-${periodeFacture.replace('-', '')}-${referenceAbonnePDF}`;

      const safeText = (value, fallback = '—') =>
        value === null || value === undefined || value === '' ? fallback : String(value);

      const indexFr = (value) =>
        value === null || value === undefined || value === ''
          ? '—'
          : espacesVisibles(Number(value).toLocaleString('fr-FR'));

      const loadLogoDataUrl = async () => {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}images/Jirama.png`);
          if (!response.ok) return null;

          const blob = await response.blob();
          return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch (logoError) {
          console.warn('Logo JIRAMA indisponible pour la facture :', logoError);
          return null;
        }
      };

      /* =====================================================
         EN-TÊTE STYLE FACTURE JIRAMA
      ===================================================== */
      const logoDataUrl = await loadLogoDataUrl();
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', margin, 1.5, 28, 20.5);
      } else {
        doc.setTextColor(...BLUE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('JIRAMA', margin, 12);
      }

      doc.setTextColor(...ORANGE);
      doc.setFontSize(13.5);
      doc.text('JIRO SY RANO MALAGASY', pageWidth / 2 + 8, 11.5, { align: 'center' });

      doc.setTextColor(...GRAY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.7);
      doc.text('Facture détaillée d’eau et d’électricité', pageWidth / 2 + 8, 16, {
        align: 'center',
      });

      doc.setDrawColor(...BLUE);
      doc.setLineWidth(0.45);
      doc.line(margin, 24, pageWidth - margin, 24);

      /* =====================================================
         BLOC « VOTRE FACTURE MOIS DE » + NUMÉRO
      ===================================================== */
      doc.setFillColor(...LIGHT_ORANGE);
      doc.roundedRect(margin, 27, contentWidth, 9, 1.5, 1.5, 'F');

      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.3);
      doc.text(`Votre facture mois de : ${moisFacture}`, margin + 3, 32.8);

      doc.setFontSize(7.6);
      doc.text(`Numéro : ${factureNumero}`, pageWidth - margin - 3, 32.8, { align: 'right' });

      let y = 38.5;

      /* =====================================================
         INFORMATIONS ABONNÉ
      ===================================================== */
      const infoRows = [
        ['Titulaire du compte', nomAbonne, 'Adresse installation', adresse],
        ['Référence client', abonnement, 'Catégorie', safeText(releve.categorie || releve.categorie_abonne)],
        ['Référence encaissement', safeText(releve.reference_encaissement), 'Commune', safeText(releve.commune)],
        ['N° compteur électricité', elec?.numero_compteur || '—', 'Tarif électricité', elec ? FACTURATION_TEMPORAIRE.ELECTRICITE.tarif : '—'],
        ['N° compteur eau', eau?.numero_compteur || '—', 'Tarif eau', eau ? FACTURATION_TEMPORAIRE.EAU.tarif : '—'],
      ];

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        pageBreak: 'avoid',
        styles: {
          font: 'helvetica',
          fontSize: 5.8,
          textColor: DARK,
          cellPadding: 1.0,
          lineColor: BORDER,
          lineWidth: 0.2,
          valign: 'middle',
          overflow: 'linebreak',
          minCellHeight: 4.6,
        },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: LIGHT_BLUE, cellWidth: 33 },
          1: { cellWidth: 56 },
          2: { fontStyle: 'bold', fillColor: LIGHT_BLUE, cellWidth: 33 },
          3: { cellWidth: 68 },
        },
        body: infoRows,
      });

      y = doc.lastAutoTable.finalY + 2.5;

      /* =====================================================
         VOTRE FACTURE EN DÉTAIL (index eau + électricité)
      ===================================================== */
      const detailRows = [
        [
          `Date d'édition : ${formatDate(getToday())}`,
          'Nouvel index',
          elec ? formatDate(elec.date_releve) : '—',
          elec ? indexFr(elec.nouvel_index) : '—',
          'Nouvel index',
          eau ? formatDate(eau.date_releve) : '—',
          eau ? indexFr(eau.nouvel_index) : '—',
        ],
        [
          'Date de présentation : —',
          'Ancien index',
          elec?.date_ancien_releve ? formatDate(elec.date_ancien_releve) : '—',
          elec ? indexFr(elec.ancien_index) : '—',
          'Ancien index',
          eau?.date_ancien_releve ? formatDate(eau.date_ancien_releve) : '—',
          eau ? indexFr(eau.ancien_index) : '—',
        ],
        [
          `Date limite de paiement : ${releve.date_limite_paiement ? formatDate(releve.date_limite_paiement) : '—'}`,
          'Consommation totale',
          '',
          elec ? formatAmount(elec.consommation) : '—',
          'Consommation totale',
          '',
          eau ? formatAmount(eau.consommation) : '—',
        ],
        [
          `Agence : ${safeText(releve.agence || releve.nom_agence)}`,
          'Nombre de jours de consommation',
          '',
          elec?.nombre_jours ?? '—',
          'Nombre de jours de consommation',
          '',
          eau?.nombre_jours ?? '—',
        ],
      ];

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        pageBreak: 'avoid',
        styles: {
          font: 'helvetica',
          fontSize: 5.4,
          textColor: DARK,
          cellPadding: 0.85,
          lineColor: BORDER,
          lineWidth: 0.2,
          valign: 'middle',
          overflow: 'linebreak',
          minCellHeight: 4.2,
        },
        headStyles: {
          fillColor: BLUE,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 5.8,
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold', fillColor: LIGHT_BLUE },
          1: { cellWidth: 33 },
          2: { cellWidth: 17, halign: 'center' },
          3: { cellWidth: 15, halign: 'right' },
          4: { cellWidth: 33 },
          5: { cellWidth: 17, halign: 'center' },
          6: { cellWidth: 15, halign: 'right' },
        },
        head: [[
          'VOTRE FACTURE EN DETAIL',
          elec ? 'ELECTRICITE' : 'ELECTRICITE (non concerné)',
          'Date',
          'Index',
          eau ? 'EAU' : 'EAU (non concerné)',
          'Date',
          'Index',
        ]],
        body: detailRows,
      });

      y = doc.lastAutoTable.finalY + 2.5;

      /* =====================================================
         CONSOMMATION / REDÉVANCES / SOUS TOTAL JIRAMA (1)
      ===================================================== */
      const tranchesRows = [
        ['1ère tranche de consommation', elec ? formatAmount(elecConso) : '—', elec ? formatAmount(elecUnit) : '—', fmtServiceAmount(elec, elecMontantConso), eau ? formatAmount(eauConso) : '—', eau ? formatAmount(eauUnit) : '—', fmtServiceAmount(eau, eauMontantConso)],
        ['2ème tranche de consommation', '', elec ? '560.00' : '—', '', '', '', ''],
        ['3ème tranche de consommation', '', '', '', '', '', ''],
        ['4ème tranche de consommation', '', '', '', '', '', ''],
        ['Redevance JIRAMA', '', '', fmtServiceAmount(elec, 8000), '', '', '—'],
        ['P-line fixe JIRAMA', '', '', fmtServiceAmount(elec, FACTURATION_TEMPORAIRE.redevanceJiramaElectricite), '', '', fmtServiceAmount(eau, FACTURATION_TEMPORAIRE.redevanceJiramaEau)],
        ['AUTRES FRAIS', '', '', fmtServiceAmount(elec, 6639.60), '', '', '—'],
        ['SOUS TOTAL JIRAMA (1)', '', '', fmtServiceAmount(elec, FACTURATION_TEMPORAIRE.sousTotalElectricite), '', '', fmtServiceAmount(eau, FACTURATION_TEMPORAIRE.sousTotalEau)],
      ];

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        pageBreak: 'avoid',
        styles: {
          font: 'helvetica',
          fontSize: 5.2,
          textColor: DARK,
          cellPadding: 0.75,
          lineColor: BORDER,
          lineWidth: 0.18,
          valign: 'middle',
          overflow: 'linebreak',
          minCellHeight: 3.8,
        },
        headStyles: {
          fillColor: BLUE,
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 5.3,
        },
        columnStyles: {
          0: { cellWidth: 62, fontStyle: 'bold' },
          1: { cellWidth: 22, halign: 'right' },
          2: { cellWidth: 22, halign: 'right' },
          3: { cellWidth: 24, halign: 'right' },
          4: { cellWidth: 17, halign: 'right' },
          5: { cellWidth: 20, halign: 'right' },
          6: { cellWidth: 23, halign: 'right' },
        },
        head: [['DÉSIGNATION', 'Quantité (kWh)', 'Prix unitaire (Ar)', 'Montant (Ar)', 'Quantité (m³)', 'Prix unitaire (Ar)', 'Montant (Ar)']],
        body: tranchesRows,
        didParseCell: (data) => {
          if (data.row.index === 7 && data.column.index === 0) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = LIGHT_ORANGE;
          }
        },
      });

      y = doc.lastAutoTable.finalY + 2.5;

      /* =====================================================
         TAXES / TVA / TOTAL (2) (3) (4)
      ===================================================== */
      const taxesRows = [
        ['Taxe communale', '', '', fmtServiceAmount(elec, FACTURATION_TEMPORAIRE.taxeCommunaleElectricite), '', '', fmtServiceAmount(eau, FACTURATION_TEMPORAIRE.taxeCommunaleEau)],
        ['Surtaxe communale', '', '', fmtServiceAmount(elec, FACTURATION_TEMPORAIRE.surtaxeCommunaleElectricite), '', '', fmtServiceAmount(eau, FACTURATION_TEMPORAIRE.surtaxeCommunaleEau)],
        ['Fonds national de l’énergie durable', '', '', fmtServiceAmount(elec, FACTURATION_TEMPORAIRE.fondsEnergieElectricite), '', '', fmtServiceAmount(eau, FACTURATION_TEMPORAIRE.fondsEnergieEau)],
        ['Redevance assainissement eaux usées', '', '', fmtServiceAmount(elec, 0), '', '', fmtServiceAmount(eau, 0)],
        ['SOUS total Taxes et Redevances (2)', '', '', fmtServiceAmount(elec, 1697.28), '', '', fmtServiceAmount(eau, 105.83)],
        ['Montant TVA de la facture', '', '', fmtServiceAmount(elec, FACTURATION_TEMPORAIRE.tvaElectricite), '', '', fmtServiceAmount(eau, FACTURATION_TEMPORAIRE.tvaEau)],
        ['TOTAL (3) = (1) + (2) + TVA', '', '', fmtServiceAmount(elec, FACTURATION_TEMPORAIRE.totalElectricite), '', '', fmtServiceAmount(eau, FACTURATION_TEMPORAIRE.totalEau)],
        ['Déduction sur facture estimée antérieure (4)', '', '', fmtServiceAmount(elec, 0), '', '', fmtServiceAmount(eau, 0)],
        ['MONTANT ELEC/EAU : (3) - (4)', '', '', fmtServiceAmount(elec, FACTURATION_TEMPORAIRE.totalElectricite), '', '', fmtServiceAmount(eau, FACTURATION_TEMPORAIRE.totalEau)],
      ];

      autoTable(doc, {
        startY: y,
        theme: 'grid',
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        pageBreak: 'avoid',
        styles: {
          font: 'helvetica',
          fontSize: 5.2,
          textColor: DARK,
          cellPadding: 0.75,
          lineColor: BORDER,
          lineWidth: 0.18,
          valign: 'middle',
          overflow: 'linebreak',
          minCellHeight: 3.8,
        },
        headStyles: {
          fillColor: BLUE,
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 5.3,
        },
        columnStyles: {
          0: { cellWidth: 62, fontStyle: 'bold' },
          1: { cellWidth: 22, halign: 'right' },
          2: { cellWidth: 22, halign: 'right' },
          3: { cellWidth: 24, halign: 'right' },
          4: { cellWidth: 17, halign: 'right' },
          5: { cellWidth: 20, halign: 'right' },
          6: { cellWidth: 23, halign: 'right' },
        },
        head: [['DÉSIGNATION', 'Quantité (kWh)', 'Prix unitaire (Ar)', 'Montant (Ar)', 'Quantité (m³)', 'Prix unitaire (Ar)', 'Montant (Ar)']],
        body: taxesRows,
        didParseCell: (data) => {
          if ([4, 6, 8].includes(data.row.index)) {
            data.cell.styles.fontStyle = 'bold';
          }
          if ([6, 8].includes(data.row.index)) {
            data.cell.styles.fillColor = data.column.index === 0 ? LIGHT_ORANGE : [253, 250, 246];
          }
        },
      });

      y = doc.lastAutoTable.finalY + 2.5;

      /* =====================================================
         MONTANT FACTURE (5) / DÉJÀ PAYÉ (6) / NET À PAYER
      ===================================================== */
      autoTable(doc, {
        startY: y,
        theme: 'grid',
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        pageBreak: 'avoid',
        styles: {
          font: 'helvetica',
          fontSize: 6.3,
          textColor: DARK,
          cellPadding: 1.4,
          valign: 'middle',
        },
        body: [
          [
            'MONTANT FACTURE (5)',
            `${formatAmount(montantFacture)} Ar`,
            'MONTANT DEJA PAYE (6)',
            paiementDisponible
              ? `${formatAmount(montantDejaPaye)} Ar${nombrePaiements ? ` — ${nombrePaiements} versement(s)` : ''}`
              : 'Donnée indisponible',
          ],
          [
            'NET A PAYER (5) - (6)',
            paiementDisponible ? `${formatAmount(netAPayer)} Ar` : 'Calcul impossible sans donnée de paiement',
            'STATUT DE PAIEMENT',
            statutPaiement,
          ],
        ],
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: LIGHT_BLUE, cellWidth: 40 },
          1: { fontStyle: 'bold', halign: 'right', fillColor: LIGHT_BLUE, cellWidth: 53 },
          2: { fontStyle: 'bold', fillColor: LIGHT_ORANGE, cellWidth: 40 },
          3: { fontStyle: 'bold', halign: 'right', fillColor: LIGHT_ORANGE, cellWidth: 57 },
        },
      });

      y = doc.lastAutoTable.finalY + 1.5;

      if (paiementDisponible) {
        doc.setTextColor(...BLUE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.6);
        doc.text(montantEnLettres(netAPayer), pageWidth / 2, y + 1.5, {
          align: 'center',
          maxWidth: contentWidth,
        });
        y += 4;
      }

      /* =====================================================
         HISTORIQUE DES CONSOMMATIONS (3 DERNIÈRES PÉRIODES)
      ===================================================== */
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('Historique des consommations des 3 dernières factures', margin, y + 2);

      const periodesHistorique = new Map();
      releves
        .filter((item) => isSameAbonne(item))
        .forEach((item) => {
          const cle = toInputDate(item.date_releve).slice(0, 7);
          const ligne = periodesHistorique.get(cle) || { periode: cle };
          const type = normalizeTypeCompteur(item.type_compteur || item.type);

          if (type === 'ELECTRICITE') ligne.elec = item.consommation;
          if (type === 'EAU') ligne.eau = item.consommation;

          periodesHistorique.set(cle, ligne);
        });

      const historique = [...periodesHistorique.values()]
        .sort((a, b) => b.periode.localeCompare(a.periode))
        .slice(0, 3);

      autoTable(doc, {
        startY: y + 3.5,
        theme: 'grid',
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        pageBreak: 'avoid',
        styles: {
          font: 'helvetica',
          fontSize: 5.4,
          cellPadding: 0.8,
          halign: 'center',
          textColor: DARK,
          lineWidth: 0.18,
        },
        headStyles: {
          fillColor: BLUE,
          textColor: 255,
          fontStyle: 'bold',
        },
        head: [['Période', 'Cons. élec. (kWh)', 'Cons. eau (m³)']],
        body: historique.length
          ? historique.map((item) => [
              item.periode,
              item.elec !== undefined ? formatAmount(item.elec) : '—',
              item.eau !== undefined ? formatAmount(item.eau) : '—',
            ])
          : [['Aucun historique', '—', '—']],
      });

      y = doc.lastAutoTable.finalY + 2;

      /* =====================================================
         AVERTISSEMENT + MENTION PROJET
      ===================================================== */
      doc.setFillColor(255, 248, 230);
      doc.roundedRect(margin, y, contentWidth, 10.5, 1.2, 1.2, 'F');

      doc.setTextColor(170, 100, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.2);
      doc.text('Ry mpanjifa hajaina, / Cher client,', margin + 3, y + 3.4);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(105, 85, 55);
      doc.text(
        'Nous vous informons que les fournitures seront suspendues et les compteurs seront déposés pour tout client n’ayant pas réglé ses factures avant la date limite mentionnée.',
        margin + 3,
        y + 6.6,
        { maxWidth: contentWidth - 6 }
      );
      doc.setFontSize(4.6);
      doc.text(
        'Tarifs et taxes provisoires (aperçu projet) — ne constituent pas une facture officielle.',
        margin + 3,
        y + 9.6
      );

      y += 13;

      /* =====================================================
         BANDEAU RÉCAPITULATIF + CODE-BARRES
      ===================================================== */
      autoTable(doc, {
        startY: y,
        theme: 'grid',
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        pageBreak: 'avoid',
        styles: {
          font: 'helvetica',
          fontSize: 5.4,
          textColor: DARK,
          cellPadding: 0.9,
          lineColor: BORDER,
          lineWidth: 0.2,
          valign: 'middle',
        },
        columnStyles: {
          0: { cellWidth: 58, fontStyle: 'bold', fillColor: LIGHT_BLUE },
          1: { cellWidth: 64 },
          2: { cellWidth: 68 },
        },
        body: [
          [
            `FACTURE N° ${factureNumero}`,
            `NET A PAYER E et/ou W : ${paiementDisponible ? `${formatAmount(netAPayer)} Ar` : '—'}`,
            `Mois de : ${moisFacture}`,
          ],
          [
            `Référence client : ${abonnement}`,
            `Nom Client : ${nomAbonne}`,
            `Catégorie : ${safeText(releve.categorie || releve.categorie_abonne)}`,
          ],
        ],
      });

      y = doc.lastAutoTable.finalY + 1;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.2);
      const couponColumnWidth = pageWidth / 2 - margin - 6;
      const couponReferenceLines = doc.splitTextToSize(
        `Laharan'ny mpanjifa (Réf client) : ${abonnement}`,
        couponColumnWidth
      );
      const couponAddressLines = doc.splitTextToSize(
        `Adresy (Adresse) : ${adresse}`,
        couponColumnWidth
      );
      const couponFirstRowHeight =
        Math.max(couponReferenceLines.length, couponAddressLines.length) * 3.2;

      // Garder le code-barres et le coupon ensemble, avec une marge pour le pied de page.
      if (y + 35 + couponFirstRowHeight > pageHeight - margin - 11) {
        doc.addPage();
        y = margin;
        doc.setTextColor(...BLUE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(`Coupon de relevé — ${factureNumero}`, margin, y + 4);
        y += 7;
      }

      // Code-barres visuel (aucune librairie externe).
      let barcodeX = pageWidth - margin - 55;
      const barcodeY = y + 1;

      for (let i = 0; i < 36; i += 1) {
        const barWidth = i % 5 === 0 ? 1.15 : i % 2 === 0 ? 0.7 : 0.4;
        const barHeight = i % 3 === 0 ? 8 : 6;

        doc.setFillColor(30, 30, 30);
        doc.rect(barcodeX, barcodeY, barWidth, barHeight, 'F');
        barcodeX += barWidth + 0.75;
      }

      doc.setTextColor(...GRAY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.6);
      doc.text(factureNumero, pageWidth - margin, barcodeY + 11, { align: 'right' });

      y += 13;

      /* =====================================================
         COUPON AUTO-RELEVÉ
      ===================================================== */
      doc.setDrawColor(130, 130, 130);
      doc.setLineWidth(0.25);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.line(margin, y, pageWidth - margin, y);
      doc.setLineDashPattern([], 0);

      doc.setTextColor(...BLUE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      doc.text(`Coupon AUTO-RELEVÉ numéro : ${factureNumero}`, pageWidth / 2, y + 4.5, {
        align: 'center',
      });

      doc.setTextColor(...GRAY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.2);
      const couponFirstRowY = y + 9.5;
      doc.text(couponReferenceLines, margin + 3, couponFirstRowY);
      doc.text(couponAddressLines, pageWidth / 2 + 3, couponFirstRowY);

      const couponSecondRowY = couponFirstRowY + couponFirstRowHeight + 1;
      const couponThirdRowY = couponSecondRowY + 4.5;
      const couponFourthRowY = couponThirdRowY + 4.5;
      doc.text('Période d’auto-relevé et remise : ................................', margin + 3, couponSecondRowY);
      doc.text(`Date du relevé : ${formatDate(dateReleve)}`, pageWidth / 2 + 3, couponSecondRowY);
      doc.text('Marika JIRO (Index ELEC) : ................................', margin + 3, couponThirdRowY);
      doc.text('Marika RANO (Index EAU) : ................................', pageWidth / 2 + 3, couponThirdRowY);
      doc.text('Contact téléphonique : ................................', margin + 3, couponFourthRowY);
      doc.text('Adresse e-mail : ................................', pageWidth / 2 + 3, couponFourthRowY);

      /* =====================================================
         PIED DE PAGE — TOUTES LES PAGES
      ===================================================== */
      const totalPages = doc.internal.getNumberOfPages();

      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.25);
        doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.3);
        doc.setTextColor(120, 120, 120);
        doc.text('Document généré par l’application de suivi JIRAMA', margin, pageHeight - 5.5);
        doc.text(`Page ${page}/${totalPages}`, pageWidth - margin, pageHeight - 5.5, { align: 'right' });
      }

      /* =====================================================
         ENREGISTREMENT PDF
         Générer plusieurs fois le même PDF ne crée ni
         double facture ni double paiement : le numéro de
         facture reste déterministe et l'API ne stocke rien.
      ===================================================== */
      const safeName = (releve.numero_abonne || releve.numero_compteur || 'releve')
        .toString()
        .replace(/[^a-zA-Z0-9_-]/g, '_');

      const safeDate = toInputDate(releve.date_releve).replaceAll('-', '');

      doc.save(`facture-jirama-${safeName}-${safeDate}.pdf`);
    } catch (error) {
      console.error('Erreur génération PDF :', error);
      setError('Impossible de générer le PDF.');
    }
  };
  /* =========================================================
     LABEL TARIFICATION TEMPORAIRE
  ========================================================== */

  function facturationLabel(
    releve
  ) {
    const config =
      getFacturationTemporaire(
        releve.type_compteur
      );

    return `${config.tarif} / ${formatAmount(
      config.prixUnitaire
    )} ${config.unitePrix}`;
  }

  /* =========================================================
     SUPPRESSION
  ========================================================== */

  const handleDelete =
    async (
      releve
    ) => {
      if (
        currentUser?.role !==
        'ADMINISTRATEUR'
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Voulez-vous supprimer le relevé du ${formatDate(
            releve.date_releve
          )} pour le compteur ${releve.numero_compteur} ?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setError('');
        setSuccess('');

        const response =
          await axiosClient.delete(
            `/releves/${releve.id}`
          );

        setSuccess(
          response.data?.message ||
            'Relevé supprimé avec succès.'
        );

        await loadReleves();
      } catch (err) {
        console.error(
          'Erreur suppression :',
          err
        );

        if (
          err.response?.status ===
            401 ||
          err.response?.status ===
            403
        ) {
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

          return;
        }

        setError(
          err.response?.data
            ?.message ||
            'Impossible de supprimer le relevé.'
        );
      }
    };

  /* =========================================================
     DÉCONNEXION
  ========================================================== */

  const handleLogout =
    () => {
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
    };

  /* =========================================================
     INTERFACE (rendu uniquement) : références, compteurs,
     toast, raccourci « / », comportement de la modale.
     Tous ces hooks sont placés AVANT le « if (!currentUser) ».
  ========================================================== */
  const searchRef = useRef(null);
  const modalRef = useRef(null);
  const closeRef = useRef(null);

  closeRef.current = closeModal;

  // Résultats de la recherche seule (sert aux compteurs des boutons de type)
  const parRecherche = useMemo(() => {
    const query = search.trim().toLowerCase();

    return releves.filter((releve) => {
      const nomAbonne = `${releve.abonne_prenom || ''} ${
        releve.abonne_nom || ''
      }`
        .trim()
        .toLowerCase();

      return (
        !query ||
        [
          releve.numero_compteur,
          releve.numero_abonne,
          releve.type_compteur,
          nomAbonne,
          releve.saisie_par,
        ].some((value) =>
          String(value || '').toLowerCase().includes(query)
        )
      );
    });
  }, [releves, search]);

  const compteursType = useMemo(
    () => ({
      '': parRecherche.length,
      EAU: parRecherche.filter((r) => r.type_compteur === 'EAU').length,
      ELECTRICITE: parRecherche.filter((r) => r.type_compteur !== 'EAU')
        .length,
    }),
    [parRecherche]
  );

  // Indicateurs : l'eau et l'électricité ne sont jamais additionnées
  const indicateurs = useMemo(() => {
    const eau = { n: 0, conso: 0 };
    const elec = { n: 0, conso: 0 };

    releves.forEach((releve) => {
      const conso = Number(releve.consommation) || 0;

      if (releve.type_compteur === 'EAU') {
        eau.n += 1;
        eau.conso += conso;
      } else {
        elec.n += 1;
        elec.conso += conso;
      }
    });

    return { total: releves.length, eau, elec };
  }, [releves]);

  const reinitialiserFiltres = () => {
    setSearch('');
    setTypeFilter('');
  };

  // Le succès disparaît seul au bout de 4 s
  useEffect(() => {
    if (!success) return undefined;

    const minuteur = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(minuteur);
  }, [success]);

  // Raccourci « / » : focus sur la recherche
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

  // Modale : focus piégé, Échap, scroll de la page bloqué
  useEffect(() => {
    if (!modalOpen) return undefined;

    const precedent = document.activeElement;
    const overflowAvant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(
        modalRef.current?.querySelectorAll(
          'button:not([disabled]), input:not([readonly]), textarea, select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ) || []
      );

    const focusInitial = setTimeout(() => {
      modalRef.current
        ?.querySelector('select:not([disabled]), input:not([readonly])')
        ?.focus();
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

  /* =========================================================
     CHARGEMENT
  ========================================================== */
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

  /* =========================================================
     VALEURS DE RENDU
  ========================================================== */
  const roleUtilisateur = String(currentUser.role || '').trim().toUpperCase();
  const peutEcrire = ['AGENT', 'RESPONSABLE'].includes(roleUtilisateur);
  const premierChargement = loading && releves.length === 0;
  const aucunResultat = !loading && filteredReleves.length === 0;
  const listeVide = releves.length === 0;

  const stCompteur = selectedCompteur
    ? styleType(selectedCompteur.type)
    : null;

  const apercuConso =
    consumptionPreview === null ||
    consumptionPreview === undefined ||
    consumptionPreview === '' ||
    Number.isNaN(Number(consumptionPreview))
      ? null
      : Number(consumptionPreview);

  const nouvelIndexInvalide =
    form.nouvel_index !== '' &&
    effectiveAncienIndex !== '' &&
    Number(form.nouvel_index) < Number(effectiveAncienIndex);

  const etatNouvelIndex = nouvelIndexInvalide
    ? 'jr-field--err'
    : apercuConso !== null
    ? 'jr-field--ok'
    : '';

  const partEau = pourcent(indicateurs.eau.n, indicateurs.total);
  const partElec = indicateurs.total ? 100 - partEau : 0;

  const actionsDe = (releve, props = {}) => (
    <ActionsReleve
      releve={releve}
      peutModifier={peutEcrire}
      peutSupprimer={
        roleUtilisateur === 'ADMINISTRATEUR' && isDernierReleve(releve)
      }
      onPdf={generateRelevePDF}
      onEdit={openEditModal}
      onDelete={handleDelete}
      {...props}
    />
  );

  /* =========================================================
     RENDER
  ========================================================== */
  const contenuPage = (
    <>
      <div className="selection:bg-[var(--jr-elec)] selection:text-[var(--jr-sur-elec)]">
          {/* =================================================
              TITRE
          ================================================= */}
          <div className="jr-entree mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-jr-titre sm:text-4xl">
                Relevés
              </h1>

              <p className="mt-1.5 max-w-xl text-sm text-jr-doux">
                Les index relevés sur chaque compteur. La période et la
                consommation sont calculées à partir du relevé précédent.
              </p>
            </div>

            {peutEcrire && (
              <button
                type="button"
                onClick={openCreateModal}
                className="jr-btn jr-btn-elec inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold shadow-sm"
              >
                <Plus size={18} aria-hidden="true" />
                Nouveau relevé
              </button>
            )}
          </div>

          {/* =================================================
              INDICATEURS
          ================================================= */}
          <section
            aria-label="Synthèse des relevés"
            className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1.35fr_1fr_1fr]"
          >
            <div className="jr-verre rounded-lg border border-jr-bordure p-5 shadow-sm">
              <p className="text-sm text-jr-doux">Relevés enregistrés</p>

              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-jr-texte">
                {formatNombre(indicateurs.total)}
              </p>

              <div
                aria-hidden="true"
                className="mt-4 flex h-1.5 overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--jr-desactive-fond)' }}
              >
                <span
                  className="h-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${partEau}%`,
                    backgroundColor: 'var(--jr-eau-clair)',
                  }}
                />
                <span
                  className="h-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${partElec}%`,
                    backgroundColor: 'var(--jr-elec)',
                  }}
                />
              </div>
            </div>

            <div className="jr-carte-eau rounded-lg p-5 shadow-sm">
              <p className="text-sm text-jr-doux">Eau</p>

              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-jr-texte">
                {formatConso(indicateurs.eau.conso)}{' '}
                <span className="text-base font-medium text-jr-lien">m³</span>
              </p>

              <p className="mt-2 text-xs text-jr-lien">
                {formatNombre(indicateurs.eau.n)} relevé
                {indicateurs.eau.n > 1 ? 's' : ''}
              </p>
            </div>

            <div className="jr-carte-elec rounded-lg p-5 shadow-sm">
              <p className="text-sm text-jr-doux">Électricité</p>

              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-jr-texte">
                {formatConso(indicateurs.elec.conso)}{' '}
                <span
                  className="text-base font-medium"
                  style={{ color: 'var(--jr-attention)' }}
                >
                  kWh
                </span>
              </p>

              <p className="mt-2 text-xs" style={{ color: 'var(--jr-attention)' }}>
                {formatNombre(indicateurs.elec.n)} relevé
                {indicateurs.elec.n > 1 ? 's' : ''}
              </p>
            </div>
          </section>

          {/* =================================================
              FILTRES
          ================================================= */}
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
                placeholder="Rechercher par compteur, abonné ou numéro"
                aria-label="Rechercher un relevé"
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
              aria-label="Filtrer par type de compteur"
              className="jr-verre inline-flex self-start rounded-md border border-jr-bordure p-0.5"
            >
              {FILTRES_TYPE.map((filtre) => {
                const actif = typeFilter === filtre.valeur;

                const styleActif =
                  filtre.valeur === 'ELECTRICITE'
                    ? {
                        backgroundColor: 'var(--jr-elec)',
                        color: 'var(--jr-sur-elec)',
                      }
                    : {
                        backgroundColor: 'var(--jr-eau)',
                        color: '#ffffff',
                      };

                return (
                  <button
                    key={filtre.valeur || 'tous'}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => setTypeFilter(filtre.valeur)}
                    className="inline-flex items-center gap-2 rounded px-3.5 py-2 text-sm font-medium transition-colors motion-reduce:transition-none"
                    style={
                      actif
                        ? styleActif
                        : { color: 'var(--jr-texte-doux)' }
                    }
                  >
                    {filtre.libelle}
                    <span
                      className="text-xs tabular-nums"
                      style={{ opacity: actif ? 0.85 : 0.7 }}
                    >
                      {formatNombre(compteursType[filtre.valeur])}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* =================================================
              TABLEAU
          ================================================= */}
          <section className="jr-verre overflow-hidden rounded-lg border border-jr-bordure shadow-sm">
            <div className="flex items-center justify-between border-b border-jr-bordure px-5 py-3.5 sm:px-6">
              <div>
                <h2 className="font-semibold text-jr-titre">
                  Historique des relevés
                </h2>

                <p className="mt-0.5 text-xs text-jr-faible">
                  {formatNombre(filteredReleves.length)} affiché
                  {filteredReleves.length > 1 ? 's' : ''} sur{' '}
                  {formatNombre(releves.length)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  loadReleves();
                  loadCompteurs();
                }}
                className="rounded-md p-2.5 text-jr-faible transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-lien motion-reduce:transition-none"
                title="Actualiser la liste"
                aria-label="Actualiser la liste"
              >
                <RefreshCw
                  size={18}
                  aria-hidden="true"
                  className={
                    loading ? 'animate-spin motion-reduce:animate-none' : ''
                  }
                />
              </button>
            </div>

            {premierChargement && <Squelette />}

            {!premierChargement && aucunResultat && (
              <EtatVide
                listeVide={listeVide}
                peutAjouter={peutEcrire}
                onAjouter={openCreateModal}
                onReset={reinitialiserFiltres}
              />
            )}

            {/* Écrans moyens et grands : tableau à 6 colonnes */}
            {!premierChargement && !aucunResultat && (
              <div className="hidden md:block">
                <table className="w-full text-left">
                  <caption className="sr-only">Historique des relevés</caption>

                  <thead>
                    <tr className="border-b border-jr-bordure">
                      <th scope="col" className="px-5 py-3 text-xs font-medium text-jr-faible">
                        Compteur
                      </th>
                      <th scope="col" className="px-5 py-3 text-xs font-medium text-jr-faible">
                        Abonné
                      </th>
                      <th scope="col" className="px-5 py-3 text-xs font-medium text-jr-faible">
                        Période
                      </th>
                      <th scope="col" className="px-5 py-3 text-xs font-medium text-jr-faible">
                        Index
                      </th>
                      <th scope="col" className="px-5 py-3 text-xs font-medium text-jr-faible">
                        Consommation
                      </th>
                      <th scope="col" className="px-5 py-3 text-xs font-medium text-jr-faible">
                        Saisi par
                        <span className="sr-only"> et actions</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-jr-bordure">
                    {filteredReleves.map((releve, index) => {
                      const st = styleType(releve.type_compteur);
                      const unite = releve.unite || st.unite;
                      const afficherNomAbonne = estDebutGroupeReleves(
                        filteredReleves,
                        index
                      );

                      return (
                        <tr
                          key={releve.id}
                          className="jr-entree group transition-colors hover:bg-[var(--jr-eau-pale)] focus-within:bg-[var(--jr-eau-pale)] motion-reduce:transition-none"
                          style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
                        >
                          {/* COMPTEUR */}
                          <td className="relative px-5 py-3.5">
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-0 left-0 w-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
                              style={{ backgroundColor: 'var(--jr-elec)' }}
                            />

                            <div className="flex items-center gap-3">
                              <PastilleType type={releve.type_compteur} />

                              <div>
                                <p className="font-mono text-sm tabular-nums text-jr-titre">
                                  {releve.numero_compteur}
                                </p>
                                <p className="text-xs text-jr-faible">
                                  {st.libelle},{' '}
                                  {releve.date_installation
                                    ? `installé le ${formatDateInstallation(releve.date_installation)}`
                                    : 'installation non renseignée'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* ABONNÉ */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              {afficherNomAbonne && <Initiales releve={releve} />}

                              <div>
                                <p className="text-sm font-medium text-jr-texte">
                                  {afficherNomAbonne ? nomAbonneDe(releve) : ''}
                                </p>
                                <p className="font-mono text-xs tabular-nums text-jr-faible">
                                  {releve.numero_abonne}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* PÉRIODE */}
                          <td className="px-5 py-3.5">
                            <p className="text-sm tabular-nums text-jr-texte">
                              {releve.date_ancien_releve
                                ? `${formatDate(releve.date_ancien_releve)} → ${formatDate(releve.date_releve)}`
                                : formatDate(releve.date_releve)}
                            </p>

                            <p className="mt-0.5 flex gap-2 text-xs text-jr-faible">
                              {!releve.date_ancien_releve && (
                                <span>Premier relevé</span>
                              )}
                              {releve.nombre_jours !== null &&
                              releve.nombre_jours !== undefined ? (
                                <span className="tabular-nums">
                                  {releve.nombre_jours}{' '}
                                  {Number(releve.nombre_jours) === 1
                                    ? 'jour'
                                    : 'jours'}
                                </span>
                              ) : (
                                <span>Durée non disponible</span>
                              )}
                            </p>
                          </td>

                          {/* INDEX */}
                          <td className="px-5 py-3.5 text-sm tabular-nums">
                            <span className="text-jr-doux">
                              {Number(releve.ancien_index).toLocaleString('fr-FR')}
                            </span>{' '}
                            <span aria-hidden="true" className="text-jr-faible">
                              →
                            </span>
                            <span className="sr-only"> vers </span>{' '}
                            <span className="font-medium" style={{ color: st.texte }}>
                              {Number(releve.nouvel_index).toLocaleString('fr-FR')}
                            </span>
                          </td>

                          {/* CONSOMMATION */}
                          <td className="px-5 py-3.5">
                            <span
                              className="text-lg font-semibold tabular-nums"
                              style={{ color: st.texte }}
                            >
                              {formatConso(releve.consommation)}
                            </span>{' '}
                            <span className="text-xs text-jr-faible">{unite}</span>
                          </td>

                          {/* SAISI PAR + ACTIONS */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className="max-w-[7rem] truncate text-xs text-jr-faible"
                                title={releve.saisie_par || undefined}
                              >
                                {releve.saisie_par || '—'}
                              </span>

                              {actionsDe(releve, { auSurvol: true })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile : une carte par relevé */}
            {!premierChargement && !aucunResultat && (
              <ul className="divide-y divide-jr-bordure md:hidden">
                {filteredReleves.map((releve, index) => {
                  const st = styleType(releve.type_compteur);
                  const unite = releve.unite || st.unite;
                  const afficherNomAbonne = estDebutGroupeReleves(
                    filteredReleves,
                    index
                  );

                  return (
                    <li
                      key={releve.id}
                      className="jr-entree p-4"
                      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <PastilleType type={releve.type_compteur} />

                          <div className="min-w-0">
                            <p className="font-mono text-sm tabular-nums text-jr-titre">
                              {releve.numero_compteur}
                            </p>
                            <p className="truncate text-xs text-jr-faible">
                              {afficherNomAbonne ? nomAbonneDe(releve) : ''}
                            </p>
                          </div>
                        </div>

                        <p className="text-right">
                          <span
                            className="text-lg font-semibold tabular-nums"
                            style={{ color: st.texte }}
                          >
                            {formatConso(releve.consommation)}
                          </span>{' '}
                          <span className="text-xs text-jr-faible">{unite}</span>
                        </p>
                      </div>

                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        <div>
                          <dt className="text-jr-faible">Période</dt>
                          <dd className="mt-0.5 tabular-nums text-jr-texte">
                            {releve.date_ancien_releve
                              ? `${formatDate(releve.date_ancien_releve)} → ${formatDate(releve.date_releve)}`
                              : `Premier relevé, ${formatDate(releve.date_releve)}`}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-jr-faible">Index</dt>
                          <dd className="mt-0.5 tabular-nums text-jr-texte">
                            {Number(releve.ancien_index).toLocaleString('fr-FR')} →{' '}
                            {Number(releve.nouvel_index).toLocaleString('fr-FR')}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-jr-faible">Saisi par</dt>
                          <dd className="mt-0.5 text-jr-texte">
                            {releve.saisie_par || '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-jr-faible">Installation</dt>
                          <dd className="mt-0.5 text-jr-texte">
                            {releve.date_installation
                              ? formatDateInstallation(releve.date_installation)
                              : 'Non renseignée'}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-3">
                        {actionsDe(releve, { avecTexte: true })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
      </div>

      {/* =================================================
          TOASTS
      ================================================= */}
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

      {/* =================================================
          MODAL
      ================================================= */}
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
            aria-labelledby="titre-modale-releve"
            className="jr-verre-fort jr-pop max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-jr-bordure shadow-2xl"
          >
            {/* HEADER */}
            <div className="flex items-start justify-between gap-4 border-b border-jr-bordure px-6 py-5">
              <div>
                <h2
                  id="titre-modale-releve"
                  className="text-xl font-semibold text-jr-titre"
                >
                  {editingReleve
                    ? 'Modifier un relevé'
                    : 'Enregistrer un relevé'}
                </h2>

                <p className="mt-1 text-sm text-jr-doux">
                  La période et la consommation sont calculées automatiquement.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                title="Fermer"
                aria-label="Fermer"
                className="rounded-md p-2 text-jr-faible transition-colors hover:bg-[var(--jr-eau-pale)] hover:text-jr-texte motion-reduce:transition-none"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              {/* ---------- Compteur ---------- */}
              <fieldset className="space-y-4">
                <legend className="mb-3 text-sm font-semibold text-jr-titre">
                  Compteur
                </legend>

                <div>
                  <label
                    htmlFor="champ-compteur"
                    className="mb-1.5 block text-sm font-medium text-jr-doux"
                  >
                    Compteur concerné
                  </label>

                  <select
                    id="champ-compteur"
                    value={form.compteur_id}
                    onChange={handleCompteurChange}
                    disabled={loadingCompteurs || Boolean(editingReleve)}
                    required
                    className="jr-field w-full rounded-md border px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="">
                      {loadingCompteurs
                        ? 'Chargement...'
                        : 'Sélectionner un compteur'}
                    </option>

                    {compteurs
                      .filter((compteur) => compteur.statut !== 'INACTIF')
                      .map((compteur) => (
                        <option key={compteur.id} value={compteur.id}>
                          {compteur.numero_compteur}
                          {' — '}
                          {compteur.type === 'EAU' ? 'Eau' : 'Électricité'}
                          {' — '}
                          {compteur.numero_abonne}
                        </option>
                      ))}
                  </select>
                </div>

                {selectedCompteur && (
                  <div
                    className="grid grid-cols-1 gap-4 rounded-md border border-jr-bordure p-4 sm:grid-cols-3"
                    style={{ backgroundColor: stCompteur.fond }}
                  >
                    <div>
                      <p className="text-xs text-jr-faible">Abonné</p>
                      <p className="mt-1 text-sm font-medium text-jr-texte">
                        {selectedCompteur.abonne_prenom
                          ? `${selectedCompteur.abonne_prenom} ${
                              selectedCompteur.abonne_nom || ''
                            }`
                          : selectedCompteur.abonne_nom ||
                            selectedCompteur.numero_abonne ||
                            '—'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-jr-faible">Type</p>
                      <p
                        className="mt-1 text-sm font-medium"
                        style={{ color: stCompteur.texte }}
                      >
                        {selectedCompteur.type === 'EAU'
                          ? 'Eau (m³)'
                          : 'Électricité (kWh)'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-jr-faible">N° compteur</p>
                      <p className="mt-1 font-mono text-sm tabular-nums text-jr-texte">
                        {selectedCompteur.numero_compteur}
                      </p>
                    </div>
                  </div>
                )}
              </fieldset>

              {/* ---------- Période ---------- */}
              <fieldset className="border-t border-jr-bordure pt-5">
                <legend className="mb-3 px-0 text-sm font-semibold text-jr-titre">
                  Période
                </legend>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label
                      htmlFor="champ-installation"
                      className="mb-1.5 block text-sm font-medium text-jr-doux"
                    >
                      Date d'installation
                    </label>

                    <input
                      id="champ-installation"
                      type="date"
                      value={dateInstallation}
                      readOnly
                      tabIndex={-1}
                      className="jr-field w-full cursor-default rounded-md border px-3 py-2.5 text-sm text-jr-doux"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="champ-date-precedente"
                      className="mb-1.5 block text-sm font-medium text-jr-doux"
                    >
                      Date du relevé précédent
                    </label>

                    <input
                      id="champ-date-precedente"
                      type="date"
                      name="date_ancien_releve"
                      value={effectiveDateAncienReleve}
                      onChange={handleChange}
                      readOnly={!isFirstReleve}
                      min={dateInstallation || undefined}
                      max={form.date_releve || undefined}
                      className={`jr-field w-full rounded-md border px-3 py-2.5 text-sm ${
                        isFirstReleve ? '' : 'cursor-default text-jr-doux'
                      }`}
                    />

                    {isFirstReleve ? (
                      <p className="mt-1 text-xs font-medium text-jr-lien">
                        Premier relevé : saisissez la date du relevé
                        d’installation vérifié. Cette initialisation est
                        réservée au Responsable.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-jr-faible">
                        Récupérée depuis le relevé précédent.
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="champ-date-actuelle"
                      className="mb-1.5 block text-sm font-medium text-jr-doux"
                    >
                      Date du relevé actuel
                    </label>

                    <input
                      id="champ-date-actuelle"
                      type="date"
                      name="date_releve"
                      value={form.date_releve}
                      onChange={handleChange}
                      min={dateInstallation || undefined}
                      required
                      className="jr-field w-full rounded-md border px-3 py-2.5 text-sm font-medium"
                    />

                    <p className="mt-1 text-xs text-jr-faible">
                      Le relevé précédent est recherché selon cette date.
                    </p>
                  </div>
                </div>

                {selectedCompteur && (
                  <p className="mt-3 text-xs text-jr-faible">
                    {originePeriode === 'RELEVE_PRECEDENT'
                      ? 'Source de la période : relevé précédent enregistré dans le système.'
                      : originePeriode === 'RELEVE_ANTERIEUR'
                      ? 'Source de la période : relevé antérieur saisi manuellement.'
                      : 'Source de la période : à définir.'}{' '}
                    {isFirstReleve
                      ? 'Premier relevé : la date précédente et l’ancien index sont saisis manuellement.'
                      : 'La date précédente et l’ancien index sont récupérés automatiquement depuis le relevé précédent correspondant à la date choisie.'}
                  </p>
                )}
              </fieldset>

              {/* ---------- Index ---------- */}
              <fieldset className="border-t border-jr-bordure pt-5">
                <legend className="mb-3 px-0 text-sm font-semibold text-jr-titre">
                  Index
                </legend>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="champ-ancien-index"
                      className="mb-1.5 block text-sm font-medium text-jr-doux"
                    >
                      Ancien index
                    </label>

                    <input
                      id="champ-ancien-index"
                      type="number"
                      step="0.01"
                      min="0"
                      name="ancien_index"
                      value={
                        effectiveAncienIndex === '' ? '' : effectiveAncienIndex
                      }
                      onChange={handleChange}
                      readOnly={!isFirstReleve}
                      required
                      className={`jr-field w-full rounded-md border px-3 py-2.5 text-sm tabular-nums ${
                        isFirstReleve ? '' : 'cursor-default text-jr-doux'
                      }`}
                    />

                    {isFirstReleve ? (
                      <p className="mt-1 text-xs text-jr-lien">
                        Premier relevé : saisissez l’ancien index indiqué sur
                        le relevé d’installation vérifié.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-jr-faible">
                        Repris du nouvel index du relevé précédent.
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="champ-nouvel-index"
                      className="mb-1.5 block text-sm font-medium text-jr-doux"
                    >
                      Nouvel index
                    </label>

                    <input
                      id="champ-nouvel-index"
                      type="number"
                      step="0.01"
                      min="0"
                      name="nouvel_index"
                      value={form.nouvel_index}
                      onChange={handleChange}
                      required
                      aria-invalid={nouvelIndexInvalide || undefined}
                      className={`jr-field w-full rounded-md border px-3 py-2.5 text-sm tabular-nums ${etatNouvelIndex}`}
                    />

                    {nouvelIndexInvalide && (
                      <p className="mt-1 text-xs font-medium text-jr-err">
                        Le nouvel index ne peut pas être inférieur à l’ancien.
                      </p>
                    )}
                  </div>
                </div>
              </fieldset>

              {/* ---------- Résultat ---------- */}
              {selectedCompteur && (
                <section
                  aria-label="Résultat du calcul"
                  aria-live="polite"
                  className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 rounded-lg border p-5"
                  style={{
                    backgroundColor: stCompteur.fond,
                    borderColor: stCompteur.trait,
                  }}
                >
                  <div>
                    <p className="text-sm text-jr-doux">Consommation calculée</p>

                    <p
                      className="mt-1 text-4xl font-semibold tabular-nums tracking-tight"
                      style={{ color: stCompteur.texte }}
                    >
                      {apercuConso === null ? '—' : formatConso(apercuConso)}{' '}
                      <span className="text-lg font-medium">
                        {selectedCompteur.type === 'EAU' ? 'm³' : 'kWh'}
                      </span>
                    </p>

                    <p className="mt-1 text-xs text-jr-faible">
                      Nouvel index moins ancien index
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-jr-doux">Durée de la période</p>

                    <p className="mt-1 text-2xl font-semibold tabular-nums text-jr-texte">
                      {nombreJours !== null && nombreJours !== undefined
                        ? `${nombreJours} ${nombreJours === 1 ? 'jour' : 'jours'}`
                        : '—'}
                    </p>

                    <p className="mt-1 text-xs text-jr-faible">
                      Du {effectiveDateAncienReleve ? formatDate(effectiveDateAncienReleve) : 'à saisir'} au{' '}
                      {form.date_releve ? formatDate(form.date_releve) : '—'}
                    </p>
                  </div>
                </section>
              )}

              {/* ---------- Facturation temporaire ---------- */}
              {selectedCompteur && (
                <div className="jr-carte-elec rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-jr-titre">
                        Paramètres tarifaires (temporaire)
                      </h3>

                      <p className="mt-1 text-xs text-jr-doux">
                        Ces valeurs servent uniquement à l'affichage et doivent
                        être validées.
                      </p>
                    </div>

                    <span
                      className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{
                        color: 'var(--jr-attention)',
                        borderColor: 'var(--jr-attention)',
                      }}
                    >
                      Provisoire
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="jr-verre rounded-md border border-jr-bordure p-3">
                      <p className="text-xs text-jr-faible">Tarif</p>
                      <p className="mt-1 text-sm font-medium text-jr-texte">
                        {getFacturationTemporaire(selectedCompteur.type).tarif}
                      </p>
                    </div>

                    <div className="jr-verre rounded-md border border-jr-bordure p-3">
                      <p className="text-xs text-jr-faible">Prix unitaire</p>
                      <p className="mt-1 text-sm font-medium tabular-nums text-jr-texte">
                        {formatAmount(
                          getFacturationTemporaire(selectedCompteur.type)
                            .prixUnitaire
                        )}{' '}
                        {getFacturationTemporaire(selectedCompteur.type).unitePrix}
                      </p>
                    </div>

                    <div className="jr-verre rounded-md border border-jr-bordure p-3">
                      <p className="text-xs text-jr-faible">Montant consommation</p>
                      <p className="mt-1 text-sm font-medium tabular-nums text-jr-texte">
                        {formatAmount(
                          (consumptionPreview || 0) *
                            getFacturationTemporaire(selectedCompteur.type)
                              .prixUnitaire
                        )}{' '}
                        Ar
                      </p>
                    </div>

                    <div className="jr-verre rounded-md border border-jr-bordure p-3">
                      <p className="text-xs text-jr-faible">Taxes</p>
                      <p className="mt-1 text-sm font-medium text-jr-texte">
                        À calculer
                      </p>
                    </div>

                    <div className="jr-verre rounded-md border border-jr-bordure p-3">
                      <p className="text-xs text-jr-faible">Surtaxe</p>
                      <p className="mt-1 text-sm font-medium text-jr-texte">
                        À calculer
                      </p>
                    </div>

                    <div className="jr-verre rounded-md border border-jr-bordure p-3">
                      <p className="text-xs text-jr-faible">Montant à payer</p>
                      <p className="mt-1 text-sm font-medium text-jr-texte">
                        Temporaire
                      </p>
                    </div>
                  </div>

                  <div className="jr-verre mt-3 rounded-md border border-jr-bordure p-3">
                    <p className="text-xs" style={{ color: 'var(--jr-attention)' }}>
                      Net à payer
                    </p>
                    <p className="mt-1 text-lg font-semibold text-jr-titre">
                      Temporaire — à calculer
                    </p>
                  </div>

                  <p
                    className="mt-3 text-xs font-medium"
                    style={{ color: 'var(--jr-attention)' }}
                  >
                    Les informations tarifaires et fiscales affichées ci-dessus
                    sont temporaires et ne constituent pas une facturation
                    officielle.
                  </p>
                </div>
              )}

              {/* ERREUR MODAL */}
              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-jr-err-bordure bg-jr-err-pale px-4 py-3 text-sm font-medium text-jr-err"
                >
                  {error}
                </div>
              )}

              {/* BOUTONS */}
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
                  disabled={saving || loadingHistorique}
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
                    : editingReleve
                    ? 'Enregistrer la correction'
                    : 'Enregistrer le relevé'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <CreationTransition active={transitionActive} />
    </>
  );

  if (roleUtilisateur === 'RESPONSABLE') {
    return (
      <ResponsableLayout title="Relevés">
        {contenuPage}
      </ResponsableLayout>
    );
  }

  return (
    <AdminShell intensite="calme">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/agent/releves"
        onNavigate={navigate}
        onLogout={handleLogout}
        user={currentUser}
      />

      <div className="lg:pl-72">
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
          onProfile={() => navigate('/dashboard/agent')}
          user={currentUser}
        />
        {contenuPage}
      </div>
    </AdminShell>
  );
}

/* =========================================================
   PASTILLE DE TYPE (eau = bleu, électricité = orange)
========================================================= */
function PastilleType({ type }) {
  const st = styleType(type);
  const Icone = type === 'EAU' ? Droplets : Zap;

  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: st.fond, color: st.texte }}
      title={st.libelle}
    >
      <Icone size={18} aria-hidden="true" />
      <span className="sr-only">{st.libelle}</span>
    </span>
  );
}

/* =========================================================
   INITIALES DE L'ABONNÉ (teinte selon le numéro d'abonné)
========================================================= */
function Initiales({ releve }) {
  const st = styleType(teinteAbonne(releve.numero_abonne));

  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={{ backgroundColor: st.fond, color: st.texte }}
    >
      {initialesDe(releve)}
    </span>
  );
}

/* =========================================================
   ACTIONS : visibles au survol sur ordinateur,
   toujours visibles sur mobile
========================================================= */
function ActionsReleve({
  releve,
  peutModifier,
  peutSupprimer,
  onPdf,
  onEdit,
  onDelete,
  auSurvol = false,
  avecTexte = false,
}) {
  const visibilite = auSurvol
    ? 'md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none'
    : '';

  const base =
    'inline-flex items-center gap-2 rounded-md p-2 text-sm font-medium transition-colors motion-reduce:transition-none';

  const numero = releve.numero_compteur || '';

  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onPdf(releve)}
        title="Générer le PDF"
        aria-label={`Générer le PDF du relevé du compteur ${numero}`}
        className={`${base} ${visibilite} text-jr-doux hover:bg-[var(--jr-eau-pale)] hover:text-jr-lien`}
      >
        <FileText size={17} aria-hidden="true" />
        {avecTexte && 'PDF'}
      </button>

      {peutModifier && (
        <button
          type="button"
          onClick={() => onEdit(releve)}
          title="Modifier le relevé"
          aria-label={`Modifier le relevé du compteur ${numero}`}
          className={`${base} ${visibilite} text-jr-doux hover:bg-[var(--jr-eau-pale)] hover:text-jr-lien`}
        >
          <Pencil size={17} aria-hidden="true" />
          {avecTexte && 'Modifier'}
        </button>
      )}

      {peutSupprimer && (
        <button
          type="button"
          onClick={() => onDelete(releve)}
          title="Supprimer le dernier relevé du compteur"
          aria-label={`Supprimer le dernier relevé du compteur ${numero}`}
          className={`${base} ${visibilite} text-jr-doux hover:bg-jr-err-pale hover:text-jr-err`}
        >
          <Trash2 size={17} aria-hidden="true" />
          {avecTexte && 'Supprimer'}
        </button>
      )}
    </div>
  );
}

/* =========================================================
   SQUELETTE DE CHARGEMENT
========================================================= */
function Squelette() {
  return (
    <div aria-busy="true" aria-live="polite" className="divide-y divide-jr-bordure">
      <span className="sr-only">Chargement des relevés</span>

      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
          <span className="jr-shimmer h-9 w-9 shrink-0 rounded-md" />
          <span className="jr-shimmer h-3 w-28 rounded" />
          <span
            className="jr-shimmer h-3 flex-1 rounded"
            style={{ maxWidth: `${45 + ((i * 13) % 30)}%` }}
          />
          <span className="jr-shimmer hidden h-3 w-20 rounded sm:block" />
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   ÉTAT VIDE / AUCUN RÉSULTAT
========================================================= */
function EtatVide({ listeVide, peutAjouter, onAjouter, onReset }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
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
        {listeVide ? 'Aucun relevé pour le moment' : 'Aucun relevé ne correspond'}
      </h3>

      <p className="mt-1 max-w-sm text-sm text-jr-doux">
        {listeVide
          ? 'Les relevés saisis sur les compteurs apparaîtront ici avec leur consommation.'
          : 'Essayez un autre numéro de compteur ou d’abonné, ou retirez le filtre de type.'}
      </p>

      {listeVide ? (
        peutAjouter && (
          <button
            type="button"
            onClick={onAjouter}
            className="jr-btn jr-btn-elec mt-5 inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
          >
            <Plus size={18} aria-hidden="true" />
            Nouveau relevé
          </button>
        )
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

export default RelevesPage;
