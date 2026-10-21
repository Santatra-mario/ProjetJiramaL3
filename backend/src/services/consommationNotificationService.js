'use strict';

const pool = require('../config/db');

const NOMBRE_RELEVES_REFERENCE = 3;
const SEUIL_ANOMALIE = 50;
const SEUIL_SUSPECTE = 75;
const SEUIL_CRITIQUE = 100;
const EVENEMENT_SUIVI = 'SUIVI_RELEVE';

function nombre(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function arrondir(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function unite(typeCompteur) {
  return String(typeCompteur || '').trim().toUpperCase() === 'EAU'
    ? 'm³'
    : 'kWh';
}

function gravite(variation) {
  const absolue = Math.abs(variation);
  if (absolue >= SEUIL_CRITIQUE) return 'CRITIQUE';
  if (absolue >= SEUIL_SUSPECTE) return 'SUSPECTE';
  return 'ATTENTION';
}

function nomAbonne(row) {
  return [row.abonne_prenom, row.abonne_nom].filter(Boolean).join(' ').trim()
    || row.numero_abonne
    || 'Abonné non renseigné';
}

function classificationPourReleve(releve, historique) {
  const consommation = nombre(releve.consommation);
  const ancienIndex = nombre(releve.ancien_index);
  const nouvelIndex = nombre(releve.nouvel_index);
  const dureeJours = Number(releve.duree_jours);
  const ecartIndex = ancienIndex !== null && nouvelIndex !== null
    ? nouvelIndex - ancienIndex
    : null;

  // Ne pas attribuer une classification si l'index ou la période sont incohérents.
  if (
    consommation === null || consommation < 0 ||
    ancienIndex === null || nouvelIndex === null ||
    nouvelIndex < ancienIndex ||
    !Number.isFinite(dureeJours) || dureeJours <= 0 ||
    ecartIndex === null || Math.abs(ecartIndex - consommation) > 0.02
  ) {
    return {
      type: 'INFO_RELEVE_A_VERIFIER',
      classification: 'A_VERIFIER',
      niveau: null,
      consommation,
      reference: null,
      variation: null,
      message: `Le relevé du compteur ${releve.numero_compteur || 'non renseigné'} de l'abonné ${nomAbonne(releve)} a été enregistré, mais ses index ou sa période nécessitent une vérification. Aucune anomalie n'est confirmée à ce stade.`,
    };
  }

  if (historique.length < NOMBRE_RELEVES_REFERENCE) {
    return {
      type: 'INFO_HISTORIQUE_INSUFFISANT',
      classification: 'HISTORIQUE_INSUFFISANT',
      niveau: null,
      consommation,
      reference: null,
      variation: null,
      message: `Le relevé du compteur ${releve.numero_compteur || 'non renseigné'} de l'abonné ${nomAbonne(releve)} a été enregistré. Seuls ${historique.length} relevé(s) historique(s) valide(s) sont disponibles ; ${NOMBRE_RELEVES_REFERENCE} sont nécessaires pour classer la consommation de façon fiable. Consommation actuelle : ${arrondir(consommation).toFixed(2)} ${unite(releve.type_compteur)}.`,
    };
  }

  // Les périodes peuvent être de durées différentes : compare les moyennes journalières
  // historiques, projetées sur la durée du relevé courant, afin de comparer des périodes homogènes.
  const moyennesJournalieres = historique.map((row) => {
    const conso = nombre(row.consommation);
    const jours = Number(row.duree_jours);
    return conso !== null && conso >= 0 && Number.isFinite(jours) && jours > 0
      ? conso / jours
      : null;
  }).filter((value) => value !== null);

  if (moyennesJournalieres.length < NOMBRE_RELEVES_REFERENCE) {
    return {
      type: 'INFO_HISTORIQUE_INSUFFISANT',
      classification: 'HISTORIQUE_INSUFFISANT',
      niveau: null,
      consommation,
      reference: null,
      variation: null,
      message: `Le relevé du compteur ${releve.numero_compteur || 'non renseigné'} de l'abonné ${nomAbonne(releve)} a été enregistré, mais les trois consommations historiques ne peuvent pas être comparées sur des périodes valides.`,
    };
  }

  const moyenneParJour = moyennesJournalieres.reduce((sum, item) => sum + item, 0)
    / NOMBRE_RELEVES_REFERENCE;
  const referenceBrute = moyenneParJour * dureeJours;

  if (!Number.isFinite(referenceBrute) || referenceBrute <= 0) {
    return {
      type: 'INFO_RELEVE_A_VERIFIER',
      classification: 'A_VERIFIER',
      niveau: null,
      consommation,
      reference: arrondir(referenceBrute),
      variation: null,
      message: `Le relevé du compteur ${releve.numero_compteur || 'non renseigné'} de l'abonné ${nomAbonne(releve)} a été enregistré, mais la référence historique est nulle ou invalide. Une vérification est nécessaire avant de conclure.`,
    };
  }

  const reference = arrondir(referenceBrute);
  const variationBrute = ((consommation - referenceBrute) / referenceBrute) * 100;
  const variation = arrondir(variationBrute);
  const nom = nomAbonne(releve);
  const numero = releve.numero_compteur || 'non renseigné';
  const mesure = unite(releve.type_compteur);

  if (Math.abs(variationBrute) < SEUIL_ANOMALIE) {
    return {
      type: 'INFO_CONSOMMATION_NORMALE',
      classification: 'NORMALE',
      niveau: null,
      consommation,
      reference,
      variation,
      message: `Le relevé du compteur ${numero} de l'abonné ${nom} a été enregistré. La consommation actuelle est de ${arrondir(consommation).toFixed(2)} ${mesure}, contre une référence historique comparable de ${reference.toFixed(2)} ${mesure}. Variation : ${variation > 0 ? '+' : ''}${variation.toFixed(2)} %. Statut : NORMALE selon les seuils de suivi configurés.`,
    };
  }

  const niveau = gravite(variationBrute);
  const classification = variationBrute > 0 ? 'SURCONSOMMATION' : 'SOUS_CONSOMMATION';
  const type = niveau === 'CRITIQUE'
    ? 'ALERTE_CONSOMMATION_CRITIQUE'
    : variationBrute > 0
      ? 'ALERTE_SURCONSOMMATION'
      : 'ALERTE_SOUS_CONSOMMATION';
  const sens = variationBrute > 0 ? 'supérieure' : 'inférieure';
  const priorité = niveau === 'CRITIQUE'
    ? ' Une vérification prioritaire est nécessaire.'
    : ' Une vérification adaptée est recommandée.';

  return {
    type,
    classification,
    niveau,
    consommation,
    reference,
    variation,
    message: `${classification.replace('_', ' ').toLowerCase()} ${niveau.toLowerCase()} détectée pour le compteur ${numero} de l'abonné ${nom}. Consommation actuelle : ${arrondir(consommation).toFixed(2)} ${mesure}. Référence historique comparable : ${reference.toFixed(2)} ${mesure}. La consommation est ${sens} de ${Math.abs(variation).toFixed(2)} % par rapport à la référence.${priorité}`,
  };
}

async function obtenirUtilisateursDestinataires(createdBy) {
  const rolesPrincipaux = await pool.query(`
    SELECT DISTINCT ON (LOWER(TRIM(u.email)))
      u.id,
      LOWER(TRIM(u.email)) AS email,
      UPPER(TRIM(u.role)) AS role
    FROM users u
    WHERE LOWER(TRIM(COALESCE(u.statut, ''))) = 'actif'
      AND UPPER(TRIM(COALESCE(u.role, ''))) IN ('ADMINISTRATEUR', 'RESPONSABLE')
      AND u.email IS NOT NULL
      AND TRIM(u.email) <> ''
    ORDER BY LOWER(TRIM(u.email)), u.id
  `);

  const destinataires = [...rolesPrincipaux.rows];

  // Les alertes Agent restent ciblées vers l'Agent actif qui a enregistré le relevé,
  // conformément à la politique de ciblage déjà présente dans le projet.
  if (createdBy !== null && createdBy !== undefined) {
    const agent = await pool.query(`
      SELECT
        u.id,
        LOWER(TRIM(u.email)) AS email,
        UPPER(TRIM(u.role)) AS role
      FROM users u
      WHERE u.id = $1
        AND UPPER(TRIM(COALESCE(u.role, ''))) = 'AGENT'
        AND LOWER(TRIM(COALESCE(u.statut, ''))) = 'actif'
        AND u.email IS NOT NULL
        AND TRIM(u.email) <> ''
      LIMIT 1
    `, [createdBy]);

    destinataires.push(...agent.rows);
  }

  const emailsVus = new Set();
  return destinataires.filter((destinataire) => {
    const email = String(destinataire.email || '').trim().toLowerCase();
    if (!email || emailsVus.has(email)) return false;
    emailsVus.add(email);
    destinataire.email = email;
    return true;
  });
}

/**
 * Crée ou actualise une notification de suivi pour un relevé.
 * À appeler uniquement après la validation et le COMMIT d'une création/modification.
 * L'index unique de la migration 008 rend cette opération idempotente.
 */
async function synchroniserNotificationSuiviReleve(releveId) {
  const id = Number(releveId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Identifiant de relevé invalide pour la notification de suivi.');
  }

  const currentResult = await pool.query(`
    SELECT
      r.id,
      r.compteur_id,
      r.date_ancien_releve::date AS date_ancien_releve,
      r.date_releve::date AS date_releve,
      (r.date_releve::date - r.date_ancien_releve::date)::int AS duree_jours,
      r.ancien_index,
      r.nouvel_index,
      r.consommation,
      r.created_by,
      c.numero_compteur,
      c.type AS type_compteur,
      ab.numero_abonne,
      ab.nom AS abonne_nom,
      ab.prenom AS abonne_prenom
    FROM releves r
    INNER JOIN compteurs c ON c.id = r.compteur_id
    INNER JOIN abonnes ab ON ab.id = c.abonne_id
    WHERE r.id = $1
    LIMIT 1
  `, [id]);

  if (currentResult.rowCount === 0) {
    return { created: 0, updated: 0, message: 'Relevé introuvable.' };
  }

  const releve = currentResult.rows[0];
  const currentDate = releve.date_releve;
  const historiqueResult = await pool.query(`
    SELECT
      r.id,
      r.consommation,
      r.ancien_index,
      r.nouvel_index,
      (r.date_releve::date - r.date_ancien_releve::date)::int AS duree_jours
    FROM releves r
    WHERE r.compteur_id = $1
      AND (r.date_releve::date, r.id) < ($2::date, $3::integer)
      AND r.consommation IS NOT NULL
      AND r.consommation >= 0
      AND r.ancien_index IS NOT NULL
      AND r.nouvel_index IS NOT NULL
      AND r.nouvel_index >= r.ancien_index
      AND ABS((r.nouvel_index - r.ancien_index) - r.consommation) <= 0.02
      AND r.date_ancien_releve IS NOT NULL
      AND r.date_releve::date > r.date_ancien_releve::date
    ORDER BY r.date_releve DESC, r.id DESC
    LIMIT $4
  `, [releve.compteur_id, currentDate, id, NOMBRE_RELEVES_REFERENCE]);

  const resultat = classificationPourReleve(releve, historiqueResult.rows);

  // Pour une vraie sur/sous-consommation, rattacher la notification à l'anomalie existante
  // afin de préserver les actions d'examen/décision déjà présentes dans les interfaces.
  let anomalieId = null;
  if (['SURCONSOMMATION', 'SOUS_CONSOMMATION'].includes(resultat.classification)) {
    const anomalieResult = await pool.query(`
      SELECT id
      FROM anomalies
      WHERE releve_id = $1
      ORDER BY
        CASE WHEN UPPER(TRIM(COALESCE(statut, ''))) IN ('NOUVELLE', 'EN_COURS') THEN 0 ELSE 1 END,
        date_detection DESC NULLS LAST,
        id DESC
      LIMIT 1
    `, [id]);
    anomalieId = anomalieResult.rows[0]?.id ?? null;
  }

  const users = await obtenirUtilisateursDestinataires(releve.created_by);
  if (users.length === 0) {
    console.warn(`Aucun destinataire actif pour le suivi du relevé #${id}.`);
    return { created: 0, updated: 0, releveId: id, classification: resultat.classification };
  }

  let created = 0;
  let updated = 0;
  for (const user of users) {
    const result = await pool.query(`
      INSERT INTO notifications (
        type,
        destinataire,
        sujet,
        message,
        date_envoi,
        statut,
        anomalie_id,
        releve_id,
        evenement_cle,
        reference_consommation,
        variation_pourcentage,
        classification,
        niveau_gravite,
        masquee_le,
        archive_le,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, NULL, 'EN_ATTENTE', $5, $6, $7, $8, $9, $10, $11,
        NULL, NULL, CURRENT_TIMESTAMP
      )
      ON CONFLICT (releve_id, (LOWER(TRIM(destinataire))), evenement_cle)
      WHERE releve_id IS NOT NULL AND evenement_cle IS NOT NULL
      DO UPDATE SET
        type = EXCLUDED.type,
        sujet = EXCLUDED.sujet,
        message = EXCLUDED.message,
        date_envoi = NULL,
        statut = 'EN_ATTENTE',
        anomalie_id = EXCLUDED.anomalie_id,
        reference_consommation = EXCLUDED.reference_consommation,
        variation_pourcentage = EXCLUDED.variation_pourcentage,
        classification = EXCLUDED.classification,
        niveau_gravite = EXCLUDED.niveau_gravite,
        masquee_le = NULL,
        archive_le = NULL,
        created_at = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS inserted
    `, [
      resultat.type,
      user.email,
      resultat.classification === 'NORMALE'
        ? `Suivi de consommation — NORMALE — ${releve.numero_compteur || 'Compteur'}`
        : resultat.classification === 'HISTORIQUE_INSUFFISANT'
          ? `Suivi de consommation — Historique insuffisant — ${releve.numero_compteur || 'Compteur'}`
          : resultat.classification === 'A_VERIFIER'
            ? `Suivi de consommation — Vérification nécessaire — ${releve.numero_compteur || 'Compteur'}`
            : `${resultat.niveau || 'ATTENTION'} — ${resultat.classification.replace('_', ' ')} — ${releve.numero_compteur || 'Compteur'}`,
      resultat.message,
      anomalieId,
      id,
      EVENEMENT_SUIVI,
      resultat.reference,
      resultat.variation,
      resultat.classification,
      resultat.niveau,
    ]);

    if (result.rows[0]?.inserted) created += 1;
    else updated += 1;
  }

  return {
    created,
    updated,
    releveId: id,
    classification: resultat.classification,
    niveau: resultat.niveau,
    destinataires: users.length,
  };
}

module.exports = {
  synchroniserNotificationSuiviReleve,
};
