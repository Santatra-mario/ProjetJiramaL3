import { Bell, Droplets, Zap } from 'lucide-react';

/* =========================================================
   FORMATAGE
========================================================= */

export function formatDate(value, withTime = false) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(
    'fr-FR',
    withTime
      ? {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }
      : {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }
  );
}

export function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export function formatNumber(value) {
  return number(value).toLocaleString('fr-FR', {
    maximumFractionDigits: 2,
  });
}

/* =========================================================
   LIBELLÉS ET STYLES
========================================================= */

export function getStatusLabel(statut) {
  if (statut === 'EN_ATTENTE') return 'En attente';
  if (statut === 'ENVOYE') return 'Traitée';
  return statut || '—';
}

export function getStatusClasses(statut) {
  if (statut === 'EN_ATTENTE') {
    return 'jn-status--pending border-[var(--jr-elec-anneau)] bg-[var(--jr-elec-pale)] text-jr-attention';
  }

  return 'jn-status--done border-[var(--jr-ok-anneau)] bg-[var(--jr-ok-pale)] text-jr-ok';
}

export function getTypeLabel(type) {
  const labels = {
    ALERTE_ANOMALIE: 'Alerte anomalie',
    DECISION_ANOMALIE: 'Décision sur anomalie',
    INFO_CONSOMMATION_NORMALE: 'Consommation normale',
    ALERTE_SURCONSOMMATION: 'Surconsommation',
    ALERTE_SOUS_CONSOMMATION: 'Sous-consommation',
    ALERTE_CONSOMMATION_CRITIQUE: 'Consommation critique',
    INFO_HISTORIQUE_INSUFFISANT: 'Historique insuffisant',
    INFO_RELEVE_A_VERIFIER: 'Relevé à vérifier',
    MISSION_CONTROLE: 'Suivi de mission de contrôle',
  };
  return labels[String(type || '').trim().toUpperCase()] || type || 'Notification';
}

export function getDecisionLabel(decision) {
  const labels = {
    ACCEPTE: 'Relevé accepté après vérification',
    REFUSE: 'Relevé refusé',
    A_VERIFIER: 'Vérification complémentaire nécessaire',
  };
  const key = String(decision || '').trim().toUpperCase();
  return labels[key] || decision || 'Décision non renseignée';
}

export function getTypeClasses(type) {
  const key = String(type || '').trim().toUpperCase();
  if (key === 'INFO_CONSOMMATION_NORMALE') {
    return 'jn-type--normal border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (key === 'ALERTE_CONSOMMATION_CRITIQUE' || key === 'ALERTE_ANOMALIE') {
    return 'jn-type--critical border-[var(--jr-err-bordure)] bg-[var(--jr-err-pale)] text-jr-err';
  }
  if (key === 'ALERTE_SURCONSOMMATION' || key === 'ALERTE_SOUS_CONSOMMATION') {
    return 'jn-type--warning border-amber-200 bg-amber-50 text-amber-800';
  }
  if (key === 'INFO_HISTORIQUE_INSUFFISANT' || key === 'INFO_RELEVE_A_VERIFIER') {
    return 'jn-type--review border-orange-200 bg-orange-50 text-orange-800';
  }
  if (key === 'DECISION_ANOMALIE') {
    return 'jn-type--decision border-[var(--jr-eau-clair)] bg-[var(--jr-eau-pale)] text-jr-lien';
  }
  if (key === 'MISSION_CONTROLE') {
    return 'jn-type--mission border-indigo-200 bg-indigo-50 text-indigo-700';
  }
  return 'jn-type--info border-[var(--jr-eau-clair)] bg-[var(--jr-eau-pale)] text-jr-lien';
}

export function getTypeIcon(notification) {
  const type = String(notification?.type_compteur || '').toUpperCase();

  if (type === 'EAU') return Droplets;
  if (type === 'ELECTRICITE') return Zap;

  return Bell;
}

export function getMissionStatutLabel(statut) {
  const labels = {
    PLANIFIEE: 'Planifiée',
    EN_COURS: 'En cours',
    TERMINEE: 'Réalisée et transmise',
    A_REPROGRAMMER: 'Non réalisée',
    ANNULEE: 'Annulée',
  };
  const key = String(statut || '').trim().toUpperCase();
  return labels[key] || statut || '—';
}

export function getMissionJourLabel(jour) {
  if (Number(jour) === 1) return 'Jour 1 · préparation';
  if (Number(jour) === 2) return 'Jour 2 · 1re descente';
  if (Number(jour) === 3) return 'Jour 3 · 2e descente';
  return 'Journée non déterminée';
}

export function getSubscriberName(notification = {}) {
  // Le backend renvoie nom_abonne / prenom_abonne pour les relevés.
  // Les notifications de mission fournissent mission_nom_abonne /
  // mission_prenom_abonne. Les anciens alias restent compatibles.
  const prenom =
    notification.prenom_abonne ||
    notification.abonne_prenom ||
    notification.mission_prenom_abonne ||
    '';
  const nom =
    notification.nom_abonne ||
    notification.abonne_nom ||
    notification.mission_nom_abonne ||
    '';

  return (
    [prenom, nom]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Abonné non renseigné'
  );
}

/* =========================================================
   TYPES D'ANOMALIE
========================================================= */

export const TYPES_ALERTE = [
  'ALERTE_ANOMALIE',
  'ALERTE_SURCONSOMMATION',
  'ALERTE_SOUS_CONSOMMATION',
  'ALERTE_CONSOMMATION_CRITIQUE',
];
