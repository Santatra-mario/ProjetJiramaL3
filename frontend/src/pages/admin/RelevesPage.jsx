import {
  useEffect,
  useMemo,
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
  ClipboardList,
  Droplets,
  Zap,
  UserRound,
  CalendarDays,
  FileText,
} from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import axiosClient from '../../api/axiosClient.js';
import Sidebar from '../../components/admin/Sidebar.jsx';
import Header from '../../components/admin/Header.jsx';

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
   PAGE
========================================================= */

function RelevesPage() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] =
    useState(null);

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

      if (
        ![
          'ADMINISTRATEUR',
          'AGENT',
        ].includes(user.role)
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
     GÉNÉRER PDF
     
     IMPORTANT :
     Ceci reste un aperçu de projet / simulation.
     Ce n'est pas une facture JIRAMA officielle.
  ========================================================== */

  const generateRelevePDF =
    async (
      releve
    ) => {
      try {
        const doc =
          new jsPDF({
            orientation:
              'portrait',
            unit: 'mm',
            format: 'a4',
          });

        const pageWidth =
          doc.internal.pageSize.getWidth();

        const pageHeight =
          doc.internal.pageSize.getHeight();

        const BLUE =
          [0, 78, 145];

        const ORANGE =
          [205, 112, 45];

        const LIGHT_BLUE =
          [239, 245, 251];

        const LIGHT_ORANGE =
          [252, 244, 237];

        const LIGHT_GRAY =
          [247, 247, 247];

        const DARK =
          [35, 35, 35];

        const GRAY =
          [95, 95, 95];

        /* =====================================================
           DONNÉES ÉLECTRICITÉ / EAU
        ===================================================== */

        const dateReleve =
          toInputDate(
            releve.date_releve
          );

        const relevesMemeDocument =
          releves.filter(
            (item) =>
              String(
                item.numero_abonne ||
                  ''
              ) ===
                String(
                  releve.numero_abonne ||
                    ''
                ) &&
              toInputDate(
                item.date_releve
              ) ===
                dateReleve
          );

        const relevesPDF =
          relevesMemeDocument.length >
          0
            ? relevesMemeDocument
            : [releve];

        const elec =
          relevesPDF.find(
            (item) =>
              item.type_compteur ===
              'ELECTRICITE'
          ) || null;

        const eau =
          relevesPDF.find(
            (item) =>
              item.type_compteur ===
              'EAU'
          ) || null;

        const abonnement =
          releve.numero_abonne ||
          'Non renseigné';

        const nomAbonne =
          [
            releve.abonne_prenom,
            releve.abonne_nom,
          ]
            .filter(Boolean)
            .join(' ') ||
          'Non renseigné';

        const adresse =
          releve.abonne_adresse ||
          'Non renseignée';

        const moisFacture =
          new Date(
            `${dateReleve || getToday()}T00:00:00`
          ).toLocaleDateString(
            'fr-FR',
            {
              month:
                'long',
              year:
                'numeric',
            }
          );

        const factureNumero =
          `REL-${String(
            dateReleve ||
              getToday()
          ).replaceAll(
            '-',
            ''
          )}-${String(
            releve.id || 0
          ).padStart(
            5,
            '0'
          )}`;

        /* =====================================================
           LOGO
        ===================================================== */

        const drawLogo =
          (
            x,
            y
          ) => {
            doc.setFillColor(
              ...ORANGE
            );

            doc.circle(
              x + 7,
              y + 7,
              6.5,
              'F'
            );

            doc.setTextColor(
              255,
              255,
              255
            );

            doc.setFont(
              'helvetica',
              'bold'
            );

            doc.setFontSize(
              10
            );

            doc.text(
              'J',
              x + 7,
              y + 10,
              {
                align:
                  'center',
              }
            );
          };

        /* =====================================================
           EN-TÊTE
        ===================================================== */

        doc.setDrawColor(
          ...BLUE
        );

        doc.setLineWidth(
          0.7
        );

        doc.line(
          15,
          34,
          pageWidth - 15,
          34
        );

        drawLogo(
          15,
          9
        );

        doc.setTextColor(
          ...BLUE
        );

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.setFontSize(
          22
        );

        doc.text(
          'JIRAMA',
          29,
          16
        );

        doc.setTextColor(
          ...ORANGE
        );

        doc.setFontSize(
          17
        );

        doc.text(
          'JIRO SY RANO MALAGASY',
          pageWidth /
            2,
          17,
          {
            align:
              'center',
          }
        );

        doc.setTextColor(
          ...GRAY
        );

        doc.setFont(
          'helvetica',
          'normal'
        );

        doc.setFontSize(
          7
        );

        doc.text(
          'Document de suivi des consommations',
          pageWidth /
            2,
          22,
          {
            align:
              'center',
          }
        );

        doc.setFontSize(
          6.5
        );

        doc.text(
          'APERÇU — DONNÉES TARIFAIRES TEMPORAIRES',
          pageWidth /
            2,
          27,
          {
            align:
              'center',
          }
        );

        /* =====================================================
           TITRE
        ===================================================== */

        doc.setFillColor(
          ...LIGHT_ORANGE
        );

        doc.roundedRect(
          15,
          38,
          pageWidth - 30,
          13,
          2,
          2,
          'F'
        );

        doc.setTextColor(
          ...DARK
        );

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.setFontSize(
          11
        );

        doc.text(
          `Votre relevé / aperçu de facture — ${moisFacture}`,
          19,
          46
        );

        doc.setFont(
          'helvetica',
          'normal'
        );

        doc.setFontSize(
          7.5
        );

        doc.text(
          `N° document : ${factureNumero}`,
          pageWidth - 19,
          46,
          {
            align:
              'right',
          }
        );

        /* =====================================================
           INFORMATIONS CLIENT
        ===================================================== */

        let y =
          56;

        doc.setTextColor(
          ...DARK
        );

        doc.setFontSize(
          7.5
        );

        const infoRows =
          [
            [
              'Titulaire du compte',
              nomAbonne,
              'Adresse installation',
              adresse,
            ],
            [
              'Référence client',
              abonnement,
              'Catégorie',
              'Particulier',
            ],
            [
              'N° compteur électricité',
              elec?.numero_compteur ||
                '—',
              'N° compteur eau',
              eau?.numero_compteur ||
                '—',
            ],
            [
              'Commune',
              '—',
              'Agence',
              'Antsirabe',
            ],
          ];

        autoTable(
          doc,
          {
            startY: y,
            theme:
              'grid',
            margin: {
              left: 15,
              right: 15,
            },
            tableWidth:
              pageWidth -
              30,
            styles: {
              font:
                'helvetica',
              fontSize:
                7,
              textColor:
                DARK,
              cellPadding:
                2,
              lineColor:
                [
                  205,
                  205,
                  205,
                ],
              lineWidth:
                0.25,
            },
            columnStyles: {
              0: {
                fontStyle:
                  'bold',
                fillColor:
                  LIGHT_GRAY,
                cellWidth:
                  35,
              },
              1: {
                cellWidth:
                  52,
              },
              2: {
                fontStyle:
                  'bold',
                fillColor:
                  LIGHT_GRAY,
                cellWidth:
                  35,
              },
              3: {
                cellWidth:
                  53,
              },
            },
            body:
              infoRows,
          }
        );

        y =
          doc.lastAutoTable
            .finalY +
          5;

        /* =====================================================
           DÉTAIL RELEVÉS
        ===================================================== */

        const indexRows =
          [
            [
              'Nouvel index',
              elec
                ? Number(
                    elec.nouvel_index
                  ).toLocaleString(
                    'fr-FR'
                  )
                : '—',
              elec
                ? formatDate(
                    elec.date_releve
                  )
                : '—',

              'Nouvel index',
              eau
                ? Number(
                    eau.nouvel_index
                  ).toLocaleString(
                    'fr-FR'
                  )
                : '—',
              eau
                ? formatDate(
                    eau.date_releve
                  )
                : '—',
            ],

            [
              'Ancien index',
              elec
                ? Number(
                    elec.ancien_index
                  ).toLocaleString(
                    'fr-FR'
                  )
                : '—',
              elec?.date_ancien_releve
                ? formatDate(
                    elec.date_ancien_releve
                  )
                : '—',

              'Ancien index',
              eau
                ? Number(
                    eau.ancien_index
                  ).toLocaleString(
                    'fr-FR'
                  )
                : '—',
              eau?.date_ancien_releve
                ? formatDate(
                    eau.date_ancien_releve
                  )
                : '—',
            ],

            [
              'Consommation totale',
              elec
                ? `${formatAmount(
                    elec.consommation
                  )} kWh`
                : '—',
              '',
              'Consommation totale',
              eau
                ? `${formatAmount(
                    eau.consommation
                  )} m³`
                : '—',
              '',
            ],

            [
              'Nombre de jours',
              elec?.nombre_jours ??
                '—',
              '',
              'Nombre de jours',
              eau?.nombre_jours ??
                '—',
              '',
            ],

            [
              'Tarif',
              '20 - Économique',
              '',
              'Tarif',
              '50',
              '',
            ],
          ];

        autoTable(
          doc,
          {
            startY: y,
            theme:
              'grid',
            margin: {
              left: 15,
              right: 15,
            },
            styles: {
              font:
                'helvetica',
              fontSize:
                7,
              textColor:
                DARK,
              cellPadding:
                2.1,
              lineColor:
                [
                  195,
                  195,
                  195,
                ],
              lineWidth:
                0.25,
              valign:
                'middle',
            },
            headStyles: {
              fillColor:
                BLUE,
              textColor:
                255,
              fontStyle:
                'bold',
              halign:
                'center',
            },
            columnStyles: {
              0: {
                fontStyle:
                  'bold',
                cellWidth:
                  31,
              },
              1: {
                cellWidth:
                  29,
                halign:
                  'center',
              },
              2: {
                cellWidth:
                  24,
                halign:
                  'center',
              },
              3: {
                fontStyle:
                  'bold',
                cellWidth:
                  31,
              },
              4: {
                cellWidth:
                  29,
                halign:
                  'center',
              },
              5: {
                cellWidth:
                  24,
                halign:
                  'center',
              },
            },
            head:
              [
                [
                  'ELECTRICITÉ',
                  'Index',
                  'Date',
                  'EAU',
                  'Index',
                  'Date',
                ],
              ],
            body:
              indexRows,
          }
        );

        y =
          doc.lastAutoTable
            .finalY +
          4;

        /* =====================================================
           TABLEAU FACTURATION
        ===================================================== */

        const elecConso =
          Number(
            elec?.consommation ||
              0
          );

        const eauConso =
          Number(
            eau?.consommation ||
              0
          );

        const elecUnit =
          340;

        const eauUnit =
          415;

        const elecMontantConso =
          elecConso *
          elecUnit;

        const eauMontantConso =
          eauConso *
          eauUnit;

        const billingRows =
          [
            [
              '1ère tranche de consommation',
              elec
                ? `${formatAmount(
                    elecConso
                  )}`
                : '—',
              '340.00',
              elec
                ? formatAmount(
                    elecMontantConso
                  )
                : '—',

              eau
                ? `${formatAmount(
                    eauConso
                  )}`
                : '—',
              '415.00',
              eau
                ? formatAmount(
                    eauMontantConso
                  )
                : '—',
            ],

            [
              '2ème tranche de consommation',
              '',
              '560.00',
              '',
              '',
              '',
              '',
            ],

            [
              '3ème tranche de consommation',
              '',
              '',
              '',
              '',
              '',
              '',
            ],

            [
              '4ème tranche de consommation',
              '',
              '',
              '',
              '',
              '',
              '',
            ],

            [
              'Redevance JIRAMA',
              '',
              '',
              '8 000.00',
              '',
              '',
              '',
            ],

            [
              'Prime fixe JIRAMA',
              '',
              '3 018.00',
              '3 018.00',
              '',
              '',
              '3 770.00',
            ],

            [
              'Autres frais',
              '',
              '',
              '6 639.60',
              '',
              '',
              '',
            ],

            [
              'SOUS TOTAL JIRAMA (1)',
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .sousTotalElectricite
              ),
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .sousTotalEau
              ),
            ],

            [
              'Taxe communale',
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .taxeCommunaleElectricite
              ),
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .taxeCommunaleEau
              ),
            ],

            [
              'Surtaxe communale',
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .surtaxeCommunaleElectricite
              ),
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .surtaxeCommunaleEau
              ),
            ],

            [
              'Fonds national de l’énergie durable',
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .fondsEnergieElectricite
              ),
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .fondsEnergieEau
              ),
            ],

            [
              'Redevance assainissement eaux usées',
              '',
              '',
              '0.00',
              '',
              '',
              '0.00',
            ],

            [
              'Sous total Taxes et Redevances (2)',
              '',
              '',
              '1 697.28',
              '',
              '',
              '105.83',
            ],

            [
              'Montant TVA de la facture',
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .tvaElectricite
              ),
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .tvaEau
              ),
            ],

            [
              'TOTAL (3) = (1) + (2) + TVA',
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .totalElectricite
              ),
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .totalEau
              ),
            ],

            [
              'Déduction sur facture estimée antérieure (4)',
              '',
              '',
              '0.00',
              '',
              '',
              '0.00',
            ],

            [
              'MONTANT ELEC/EAU : (3) - (4)',
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .totalElectricite
              ),
              '',
              '',
              formatAmount(
                FACTURATION_TEMPORAIRE
                  .totalEau
              ),
            ],
          ];

        autoTable(
          doc,
          {
            startY: y,
            theme:
              'grid',
            margin: {
              left: 15,
              right: 15,
            },
            styles: {
              font:
                'helvetica',
              fontSize:
                6.4,
              textColor:
                DARK,
              cellPadding:
                1.5,
              lineColor:
                [
                  185,
                  185,
                  185,
                ],
              lineWidth:
                0.22,
              valign:
                'middle',
            },
            headStyles: {
              fillColor:
                BLUE,
              textColor:
                255,
              fontStyle:
                'bold',
              halign:
                'center',
              fontSize:
                6.5,
            },
            columnStyles: {
              0: {
                cellWidth:
                  62,
                fontStyle:
                  'bold',
              },
              1: {
                cellWidth:
                  23,
                halign:
                  'right',
              },
              2: {
                cellWidth:
                  23,
                halign:
                  'right',
              },
              3: {
                cellWidth:
                  23,
                halign:
                  'right',
              },
              4: {
                cellWidth:
                  18,
                halign:
                  'right',
              },
              5: {
                cellWidth:
                  23,
                halign:
                  'right',
              },
              6: {
                cellWidth:
                  23,
                halign:
                  'right',
              },
            },
            head:
              [
                [
                  'Désignation',
                  'Quantité Elec',
                  'Prix unitaire',
                  'Montant Elec',
                  'Quantité Eau',
                  'Prix unitaire',
                  'Montant Eau',
                ],
              ],
            body:
              billingRows,
            didParseCell:
              (
                data
              ) => {
                if (
                  data.row.index ===
                    7 ||
                  data.row.index ===
                    12 ||
                  data.row.index ===
                    14 ||
                  data.row.index ===
                    16
                ) {
                  data.cell.styles.fontStyle =
                    'bold';
                }
              },
          }
        );

        y =
          doc.lastAutoTable
            .finalY +
          4;

        /* =====================================================
           MONTANTS
        ===================================================== */

        autoTable(
          doc,
          {
            startY: y,
            theme:
              'grid',
            margin: {
              left: 15,
              right: 15,
            },
            styles: {
              font:
                'helvetica',
              fontSize:
                8,
              textColor:
                DARK,
              cellPadding:
                2.5,
            },
            body:
              [
                [
                  'MONTANT FACTURE (5)',
                  `${formatAmount(
                    FACTURATION_TEMPORAIRE
                      .montantAPayer
                  )} Ar`,
                  'NET À PAYER (5) - (6)',
                  `${formatAmount(
                    FACTURATION_TEMPORAIRE
                      .netAPayer
                  )} Ar`,
                ],
              ],
            columnStyles: {
              0: {
                fontStyle:
                  'bold',
                fillColor:
                  LIGHT_BLUE,
                cellWidth:
                  48,
              },
              1: {
                fontStyle:
                  'bold',
                halign:
                  'right',
                fillColor:
                  LIGHT_BLUE,
                cellWidth:
                  42,
              },
              2: {
                fontStyle:
                  'bold',
                fillColor:
                  LIGHT_ORANGE,
                cellWidth:
                  48,
              },
              3: {
                fontStyle:
                  'bold',
                halign:
                  'right',
                fillColor:
                  LIGHT_ORANGE,
                cellWidth:
                  42,
              },
            },
          }
        );

        y =
          doc.lastAutoTable
            .finalY +
          5;

        /* =====================================================
           HISTORIQUE
        ===================================================== */

        const historique =
          releves
            .filter(
              (item) =>
                String(
                  item.numero_abonne ||
                    ''
                ) ===
                String(
                  releve.numero_abonne ||
                    ''
                )
            )
            .sort(
              (a, b) =>
                new Date(
                  b.date_releve
                ) -
                new Date(
                  a.date_releve
                )
            )
            .slice(
              0,
              3
            );

        doc.setTextColor(
          ...DARK
        );

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.setFontSize(
          8
        );

        doc.text(
          'Historique des consommations des 3 derniers relevés',
          15,
          y
        );

        y += 2;

        autoTable(
          doc,
          {
            startY:
              y + 2,
            theme:
              'grid',
            margin: {
              left: 15,
              right: 15,
            },
            styles: {
              font:
                'helvetica',
              fontSize:
                7,
              cellPadding:
                2,
              halign:
                'center',
            },
            headStyles: {
              fillColor:
                BLUE,
              textColor:
                255,
              fontStyle:
                'bold',
            },
            head:
              [
                [
                  'Période',
                  'Cons. élec. (kWh)',
                  'Cons. eau (m³)',
                ],
              ],
            body:
              historique.length
                ? historique.map(
                    (item) => [
                      formatDate(
                        item.date_releve
                      ),
                      item.type_compteur ===
                        'ELECTRICITE'
                        ? formatAmount(
                            item.consommation
                          )
                        : '—',
                      item.type_compteur ===
                        'EAU'
                        ? formatAmount(
                            item.consommation
                          )
                        : '—',
                    ]
                  )
                : [
                    [
                      'Aucun historique',
                      '—',
                      '—',
                    ],
                  ],
          }
        );

        y =
          doc.lastAutoTable
            .finalY +
          4;

        /* =====================================================
           NOTE
        ===================================================== */

        doc.setFillColor(
          255,
          248,
          230
        );

        doc.roundedRect(
          15,
          y,
          pageWidth - 30,
          18,
          2,
          2,
          'F'
        );

        doc.setTextColor(
          170,
          100,
          0
        );

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.setFontSize(
          6.8
        );

        doc.text(
          'APERÇU DE PROJET — NE CONSTITUE PAS UNE FACTURE OFFICIELLE',
          19,
          y + 5
        );

        doc.setFont(
          'helvetica',
          'normal'
        );

        doc.setTextColor(
          105,
          85,
          55
        );

        doc.text(
          'Tarifs, prix unitaires, taxes, surtaxes, TVA et montants sont temporaires',
          19,
          y + 10
        );

        doc.text(
          'et doivent être validés selon les règles réelles avant utilisation officielle.',
          19,
          y + 14.5
        );

        /* =====================================================
           COUPON AUTO-RELEVÉ
        ===================================================== */

        y += 23;

        if (
          y + 46 >
          pageHeight - 17
        ) {
          doc.addPage();

          y = 20;
        }

        doc.setDrawColor(
          130,
          130,
          130
        );

        doc.setLineDashPattern(
          [2, 2],
          0
        );

        doc.line(
          15,
          y,
          pageWidth - 15,
          y
        );

        doc.setLineDashPattern(
          [],
          0
        );

        doc.setTextColor(
          ...BLUE
        );

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.setFontSize(
          8
        );

        doc.text(
          'COUPON AUTO-RELEVÉ',
          pageWidth /
            2,
          y + 7,
          {
            align:
              'center',
          }
        );

        doc.setFont(
          'helvetica',
          'normal'
        );

        doc.setTextColor(
          ...GRAY
        );

        doc.setFontSize(
          6.8
        );

        doc.text(
          `Référence client : ${abonnement}`,
          18,
          y + 15
        );

        doc.text(
          `Adresse : ${adresse}`,
          18,
          y + 20
        );

        doc.text(
          'Date du prochain relevé : ................................',
          18,
          y + 26
        );

        doc.text(
          'Index électricité : ................................',
          18,
          y + 32
        );

        doc.text(
          'Index eau : ................................',
          18,
          y + 38
        );

        doc.text(
          'Contact téléphonique : ................................',
          pageWidth /
            2,
          y + 26
        );

        doc.text(
          'Adresse e-mail : ................................',
          pageWidth /
            2,
          y + 32
        );

        /* =====================================================
           CODE-BARRES VISUEL
        ===================================================== */

        let barcodeX =
          pageWidth -
          63;

        const barcodeY =
          y + 8;

        for (
          let i = 0;
          i < 36;
          i++
        ) {
          const barWidth =
            i % 5 ===
            0
              ? 1.3
              : i % 2 ===
                0
              ? 0.8
              : 0.45;

          const barHeight =
            i % 3 ===
            0
              ? 13
              : 10;

          doc.setFillColor(
            30,
            30,
            30
          );

          doc.rect(
            barcodeX,
            barcodeY,
            barWidth,
            barHeight,
            'F'
          );

          barcodeX +=
            barWidth +
            0.9;
        }

        /* =====================================================
           PIED DE PAGE
        ===================================================== */

        const totalPages =
          doc.internal.getNumberOfPages();

        for (
          let page = 1;
          page <=
          totalPages;
          page++
        ) {
          doc.setPage(
            page
          );

          doc.setDrawColor(
            200,
            200,
            200
          );

          doc.line(
            15,
            pageHeight -
              12,
            pageWidth -
              15,
            pageHeight -
              12
          );

          doc.setFont(
            'helvetica',
            'normal'
          );

          doc.setFontSize(
            6.5
          );

          doc.setTextColor(
            120,
            120,
            120
          );

          doc.text(
            `Document généré le ${new Date().toLocaleDateString(
              'fr-FR'
            )} — Projet L3 JIRAMA`,
            15,
            pageHeight -
              6
          );

          doc.text(
            `Page ${page} / ${totalPages}`,
            pageWidth -
              15,
            pageHeight -
              6,
            {
              align:
                'right',
            }
          );
        }

        /* =====================================================
           ENREGISTREMENT PDF
        ===================================================== */

        const safeName =
          (
            releve.numero_abonne ||
            releve.numero_compteur ||
            'releve'
          )
            .toString()
            .replace(
              /[^a-zA-Z0-9_-]/g,
              '_'
            );

        const safeDate =
          toInputDate(
            releve.date_releve
          ).replaceAll(
            '-',
            ''
          );

        doc.save(
          `facture_apercu_${safeName}_${safeDate}.pdf`
        );
      } catch (error) {
        console.error(
          'Erreur génération PDF :',
          error
        );

        setError(
          'Impossible de générer le PDF.'
        );
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
     CHARGEMENT
  ========================================================== */

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-xl bg-white px-6 py-5 text-sm text-slate-500 shadow-sm">
          Chargement...
        </div>
      </div>
    );
  }

  /* =========================================================
     RENDER
  ========================================================== */

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        isOpen={
          sidebarOpen
        }
        onClose={() =>
          setSidebarOpen(
            false
          )
        }
        activePath="/dashboard/admin/releves"
        onNavigate={
          navigate
        }
        onLogout={
          handleLogout
        }
        user={
          currentUser
        }
      />

      <div className="lg:pl-72">
        <Header
          onOpenSidebar={() =>
            setSidebarOpen(
              true
            )
          }
          onProfile={() =>
            navigate(
              '/dashboard/admin'
            )
          }
          user={
            currentUser
          }
        />

        <main className="p-4 sm:p-6 lg:p-8">
          {/* =================================================
              TITRE
          ================================================= */}

          <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Suivi des consommations
              </p>

              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Gestion des relevés
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Enregistrer, contrôler et consulter les relevés.
              </p>
            </div>

            {[
              'ADMINISTRATEUR',
              'AGENT',
            ].includes(
              currentUser.role
            ) && (
              <button
                type="button"
                onClick={
                  openCreateModal
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <Plus size={18} />

                Nouveau relevé
              </button>
            )}
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

          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={
                    search
                  }
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event.target
                        .value
                    )
                  }
                  placeholder="Rechercher compteur, abonné..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <select
                value={
                  typeFilter
                }
                onChange={(
                  event
                ) =>
                  setTypeFilter(
                    event.target
                      .value
                  )
                }
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
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
            </div>
          </section>

          {/* =================================================
              TABLEAU
          ================================================= */}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 font-bold text-slate-900">
                  <ClipboardList
                    size={19}
                    className="text-blue-600"
                  />

                  Historique des relevés
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {
                    filteredReleves.length
                  }{' '}
                  relevé(s)
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  loadReleves();
                  loadCompteurs();
                }}
                className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
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
              <table className="min-w-[1450px] w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Compteur
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Abonné
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Installation
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Relevé précédent
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Relevé actuel
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Ancien index
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Nouvel index
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Consommation
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Période
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Saisi par
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
                        colSpan="11"
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        Chargement...
                      </td>
                    </tr>
                  ) : filteredReleves.length ===
                    0 ? (
                    <tr>
                      <td
                        colSpan="11"
                        className="px-5 py-14 text-center text-sm text-slate-500"
                      >
                        Aucun relevé trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredReleves.map(
                      (
                        releve
                      ) => (
                        <tr
                          key={
                            releve.id
                          }
                          className="hover:bg-slate-50"
                        >
                          {/* COMPTEUR */}

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`rounded-xl p-2.5 ${
                                  releve.type_compteur ===
                                  'EAU'
                                    ? 'bg-cyan-50'
                                    : 'bg-amber-50'
                                }`}
                              >
                                {releve.type_compteur ===
                                'EAU' ? (
                                  <Droplets
                                    size={
                                      18
                                    }
                                    className="text-cyan-600"
                                  />
                                ) : (
                                  <Zap
                                    size={
                                      18
                                    }
                                    className="text-amber-600"
                                  />
                                )}
                              </div>

                              <div>
                                <p className="font-bold text-slate-800">
                                  {
                                    releve.numero_compteur
                                  }
                                </p>

                                <p className="text-xs text-slate-400">
                                  {releve.type_compteur ===
                                  'EAU'
                                    ? 'Eau'
                                    : 'Électricité'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* ABONNÉ */}

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <UserRound
                                size={
                                  15
                                }
                                className="text-slate-400"
                              />

                              <div>
                                <p className="text-sm font-semibold text-slate-700">
                                  {releve.abonne_prenom
                                    ? `${releve.abonne_prenom} ${
                                        releve.abonne_nom ||
                                        ''
                                      }`
                                    : releve.abonne_nom ||
                                      '—'}
                                </p>

                                <p className="text-xs text-slate-400">
                                  {
                                    releve.numero_abonne
                                  }
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* INSTALLATION */}

                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-slate-700">
                              {releve.date_installation
                                ? formatDate(
                                    releve.date_installation
                                  )
                                : 'Non renseignée'}
                            </p>
                          </td>

                          {/* PRÉCÉDENT */}

                          <td className="px-5 py-4">
                            {releve.date_ancien_releve ? (
                              <div>
                                <p className="text-sm font-semibold text-slate-700">
                                  {formatDate(
                                    releve.date_ancien_releve
                                  )}
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  Date précédente
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm font-medium text-slate-400">
                                  Aucun
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  Date non renseignée
                                </p>
                              </div>
                            )}
                          </td>

                          {/* ACTUEL */}

                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-blue-700">
                              {formatDate(
                                releve.date_releve
                              )}
                            </p>
                          </td>

                          {/* ANCIEN INDEX */}

                          <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                            {Number(
                              releve.ancien_index
                            ).toLocaleString(
                              'fr-FR'
                            )}
                          </td>

                          {/* NOUVEL INDEX */}

                          <td className="px-5 py-4 text-sm font-semibold text-blue-700">
                            {Number(
                              releve.nouvel_index
                            ).toLocaleString(
                              'fr-FR'
                            )}
                          </td>

                          {/* CONSOMMATION */}

                          <td className="px-5 py-4">
                            <span className="font-bold text-slate-800">
                              {Number(
                                releve.consommation
                              ).toLocaleString(
                                'fr-FR',
                                {
                                  minimumFractionDigits:
                                    2,
                                  maximumFractionDigits:
                                    2,
                                }
                              )}{' '}
                              {releve.unite ||
                                (releve.type_compteur ===
                                'EAU'
                                  ? 'm³'
                                  : 'kWh')}
                            </span>
                          </td>

                          {/* PÉRIODE */}

                          <td className="px-5 py-4">
                            {releve.nombre_jours !==
                              null &&
                            releve.nombre_jours !==
                              undefined ? (
                              <>
                                <p className="text-sm font-bold text-blue-700">
                                  {
                                    releve.nombre_jours
                                  }{' '}
                                  {Number(
                                    releve.nombre_jours
                                  ) ===
                                  1
                                    ? 'jour'
                                    : 'jours'}
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  {releve.date_ancien_releve
                                    ? 'Depuis la date précédente'
                                    : 'Période non renseignée'}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm text-slate-400">
                                Non disponible
                              </p>
                            )}
                          </td>

                          {/* AUTEUR */}

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {releve.saisie_par ||
                              '—'}
                          </td>

                          {/* ACTIONS */}

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              {/* PDF */}

                              <button
                                type="button"
                                onClick={() =>
                                  generateRelevePDF(
                                    releve
                                  )
                                }
                                className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                                title="Générer le PDF"
                              >
                                <FileText
                                  size={
                                    17
                                  }
                                />
                              </button>

                              {/* MODIFIER */}

                              {[
                                'ADMINISTRATEUR',
                                'AGENT',
                              ].includes(
                                currentUser.role
                              ) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditModal(
                                      releve
                                    )
                                  }
                                  className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                                  title="Modifier"
                                >
                                  <Pencil
                                    size={
                                      17
                                    }
                                  />
                                </button>
                              )}

                              {/* SUPPRIMER */}

                              {currentUser.role ===
                                'ADMINISTRATEUR' &&
                                isDernierReleve(
                                  releve
                                ) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDelete(
                                        releve
                                      )
                                    }
                                    className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                    title="Supprimer le dernier relevé du compteur"
                                    aria-label={`Supprimer le dernier relevé du compteur ${
                                      releve.numero_compteur ||
                                      ''
                                    }`}
                                  >
                                    <Trash2
                                      size={
                                        17
                                      }
                                    />
                                  </button>
                                )}
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
          <div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingReleve
                    ? 'Modifier un relevé'
                    : 'Enregistrer un relevé'}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  La période et la consommation sont calculées automatiquement.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                title="Fermer"
              >
                <X
                  size={
                    20
                  }
                />
              </button>
            </div>

            {/* FORM */}

            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-5 p-6"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* COMPTEUR */}

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Compteur
                  </label>

                  <select
                    value={
                      form.compteur_id
                    }
                    onChange={
                      handleCompteurChange
                    }
                    disabled={
                      loadingCompteurs ||
                      Boolean(
                        editingReleve
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                  >
                    <option value="">
                      {loadingCompteurs
                        ? 'Chargement...'
                        : 'Sélectionner un compteur'}
                    </option>

                    {compteurs
                      .filter(
                        (
                          compteur
                        ) =>
                          compteur.statut !==
                          'INACTIF'
                      )
                      .map(
                        (
                          compteur
                        ) => (
                          <option
                            key={
                              compteur.id
                            }
                            value={
                              compteur.id
                            }
                          >
                            {
                              compteur.numero_compteur
                            }
                            {' — '}
                            {compteur.type ===
                            'EAU'
                              ? 'Eau'
                              : 'Électricité'}
                            {' — '}
                            {
                              compteur.numero_abonne
                            }
                          </option>
                        )
                      )}
                  </select>
                </div>

                {/* INFO COMPTEUR */}

                {selectedCompteur && (
                  <div className="md:col-span-2 rounded-xl bg-slate-50 p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-slate-400">
                          Abonné
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {selectedCompteur.abonne_prenom
                            ? `${selectedCompteur.abonne_prenom} ${
                                selectedCompteur.abonne_nom ||
                                ''
                              }`
                            : selectedCompteur.abonne_nom ||
                              selectedCompteur.numero_abonne ||
                              '—'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Type
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {selectedCompteur.type ===
                          'EAU'
                            ? 'Eau (m³)'
                            : 'Électricité (kWh)'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          N° compteur
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {
                            selectedCompteur.numero_compteur
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* DATE INSTALLATION */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Date d'installation
                  </label>

                  <div className="relative">
                    <CalendarDays
                      size={
                        17
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="date"
                      value={
                        dateInstallation
                      }
                      readOnly
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 pl-10 text-sm text-slate-600 outline-none"
                    />
                  </div>
                </div>

                {/* DATE PRÉCÉDENTE */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Date du relevé précédent
                  </label>

                  <div className="relative">
                    <CalendarDays
                      size={
                        17
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="date"
                      name="date_ancien_releve"
                      value={
                        effectiveDateAncienReleve
                      }
                      onChange={
                        handleChange
                      }
                      readOnly={
                        !isFirstReleve
                      }
                      min={
                        dateInstallation ||
                        undefined
                      }
                      max={
                        form.date_releve ||
                        undefined
                      }
                      className={`w-full rounded-xl border px-4 py-3 pl-10 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 ${
                        isFirstReleve
                          ? 'border-blue-300 bg-white text-slate-800'
                          : 'border-slate-300 bg-slate-50 text-slate-600'
                      }`}
                    />
                  </div>

                  {isFirstReleve ? (
                    <p className="mt-1 text-xs font-medium text-blue-600">
                      Premier relevé : saisissez la date indiquée sur le relevé/document précédent.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">
                      Date récupérée automatiquement depuis le relevé précédent.
                    </p>
                  )}
                </div>

                {/* DATE ACTUELLE */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Date du relevé actuel
                  </label>

                  <div className="relative">
                    <CalendarDays
                      size={
                        17
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
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
                      min={
                        dateInstallation ||
                        undefined
                      }
                      required
                      className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 pl-10 text-sm font-semibold text-blue-700 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <p className="mt-1 text-xs text-slate-400">
                    Le relevé précédent sera recherché automatiquement selon cette date.
                  </p>
                </div>

                {/* NOMBRE JOURS */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Nombre de jours
                  </label>

                  <div className="relative">
                    <input
                      type="number"
                      value={
                        nombreJours ??
                        ''
                      }
                      readOnly
                      placeholder="Calcul automatique"
                      className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 pr-16 text-sm font-bold text-blue-700 outline-none"
                    />

                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-blue-600">
                      {nombreJours ===
                      1
                        ? 'jour'
                        : 'jours'}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-400">
                    Calculé automatiquement entre la date précédente et la date actuelle.
                  </p>
                </div>

                {/* ANCIEN INDEX */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Ancien index
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="ancien_index"
                    value={
                      effectiveAncienIndex ===
                      ''
                        ? ''
                        : effectiveAncienIndex
                    }
                    onChange={
                      handleChange
                    }
                    readOnly={
                      !isFirstReleve
                    }
                    required
                    className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 ${
                      isFirstReleve
                        ? 'border-slate-300 bg-white'
                        : 'border-slate-300 bg-slate-50 text-slate-600'
                    }`}
                  />

                  {isFirstReleve ? (
                    <p className="mt-1 text-xs text-blue-600">
                      Premier relevé : saisissez l’ancien index.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">
                      Repris automatiquement du nouvel index du relevé précédent.
                    </p>
                  )}
                </div>

                {/* NOUVEL INDEX */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Nouvel index
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="nouvel_index"
                    value={
                      form.nouvel_index
                    }
                    onChange={
                      handleChange
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {/* CONSOMMATION */}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Consommation calculée
                  </label>

                  <div className="relative">
                    <input
                      type="number"
                      value={
                        consumptionPreview ??
                        ''
                      }
                      readOnly
                      className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 pr-20 text-sm font-bold text-emerald-700 outline-none"
                    />

                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-emerald-600">
                      {selectedCompteur?.type ===
                      'EAU'
                        ? 'm³'
                        : 'kWh'}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-400">
                    Nouvel index − Ancien index
                  </p>
                </div>

                {/* FACTURATION TEMPORAIRE */}

                {selectedCompteur && (
                  <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-amber-900">
                          Paramètres tarifaires — temporaire
                        </h3>

                        <p className="mt-1 text-xs text-amber-700">
                          Ces valeurs servent uniquement à l'affichage et doivent être validées.
                        </p>
                      </div>

                      <span className="rounded-full bg-amber-200 px-3 py-1 text-[11px] font-bold text-amber-900">
                        TEMPORAIRE
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs text-slate-400">
                          Tarif
                        </p>

                        <p className="mt-1 font-semibold text-slate-800">
                          {
                            getFacturationTemporaire(
                              selectedCompteur.type
                            ).tarif
                          }
                        </p>
                      </div>

                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs text-slate-400">
                          Prix unitaire
                        </p>

                        <p className="mt-1 font-semibold text-slate-800">
                          {formatAmount(
                            getFacturationTemporaire(
                              selectedCompteur.type
                            ).prixUnitaire
                          )}{' '}
                          {
                            getFacturationTemporaire(
                              selectedCompteur.type
                            ).unitePrix
                          }
                        </p>
                      </div>

                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs text-slate-400">
                          Montant consommation
                        </p>

                        <p className="mt-1 font-semibold text-slate-800">
                          {formatAmount(
                            (
                              consumptionPreview ||
                              0
                            ) *
                              getFacturationTemporaire(
                                selectedCompteur.type
                              ).prixUnitaire
                          )}{' '}
                          Ar
                        </p>
                      </div>

                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs text-slate-400">
                          Taxes
                        </p>

                        <p className="mt-1 font-semibold text-slate-800">
                          À calculer
                        </p>
                      </div>

                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs text-slate-400">
                          Surtaxe
                        </p>

                        <p className="mt-1 font-semibold text-slate-800">
                          À calculer
                        </p>
                      </div>

                      <div className="rounded-lg bg-white p-3">
                        <p className="text-xs text-slate-400">
                          Montant à payer
                        </p>

                        <p className="mt-1 font-semibold text-slate-800">
                          Temporaire
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3">
                      <p className="text-xs text-amber-700">
                        Net à payer
                      </p>

                      <p className="mt-1 text-lg font-bold text-amber-900">
                        Temporaire — à calculer
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* =================================================
                  RÉSUMÉ PÉRIODE
              ================================================= */}

              {selectedCompteur && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-800">
                    Période de consommation
                  </h3>

                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-400">
                        Installation
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {dateInstallation
                          ? formatDate(
                              dateInstallation
                            )
                          : '—'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Relevé précédent
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {effectiveDateAncienReleve
                          ? formatDate(
                              effectiveDateAncienReleve
                            )
                          : 'À saisir'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Relevé actuel
                      </p>

                      <p className="mt-1 text-sm font-semibold text-blue-700">
                        {form.date_releve
                          ? formatDate(
                              form.date_releve
                            )
                          : '—'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Nombre de jours
                      </p>

                      <p className="mt-1 text-sm font-bold text-blue-700">
                        {nombreJours !==
                        null
                          ? `${nombreJours} ${
                              nombreJours ===
                              1
                                ? 'jour'
                                : 'jours'
                            }`
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
                    <p className="text-xs text-slate-500">
                      Source de la période
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {originePeriode ===
                      'RELEVE_PRECEDENT'
                        ? 'Relevé précédent enregistré dans le système'
                        : originePeriode ===
                          'RELEVE_ANTERIEUR'
                        ? 'Relevé antérieur saisi manuellement'
                        : 'À définir'}
                    </p>
                  </div>

                  <p className="mt-3 text-xs text-slate-400">
                    {isFirstReleve
                      ? 'Premier relevé : la date précédente et l’ancien index sont saisis manuellement.'
                      : 'La date précédente et l’ancien index sont récupérés automatiquement depuis le relevé précédent correspondant à la date choisie.'}
                  </p>

                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Les informations tarifaires et fiscales affichées ci-dessus sont temporaires et ne constituent pas une facturation officielle.
                  </p>
                </div>
              )}

              {/* ERREUR MODAL */}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* BOUTONS */}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving
                  }
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    loadingHistorique
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? (
                    <RefreshCw
                      size={
                        17
                      }
                      className="animate-spin"
                    />
                  ) : (
                    <Save
                      size={
                        17
                      }
                    />
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
    </div>
  );
}

export default RelevesPage;