'use strict';

/* =========================================================
   NOTIFICATIONS OPÉRATIONNELLES DES MISSIONS DE CONTRÔLE
   ---------------------------------------------------------
   Ce service décrit ce que l'Agent a réellement fait pendant
   le cycle de contrôle :
     - contrôle réalisé et relevé transmis (périodique ou
       premier relevé initial) ;
     - intervention non réalisée avec motif ;
     - mission non réalisée à la date prévue (Jour 2/Jour 3) ;
     - intervention démarrée mais résultat non transmis.
   Il ne remplace pas les notifications métier de
   consommation (classification, historique insuffisant,
   anomalies), qui restent gérées séparément par
   consommationNotificationService.

   Chaque notification est enregistrée dans la table
   `notifications` avec un evenement_cle stable, ce qui rend
   la génération idempotente : une actualisation de page ne
   peut pas créer de doublon.
========================================================= */

const pool = require('../config/db');

const TYPE_NOTIFICATION = 'MISSION_CONTROLE';
const PREFIXE_EVENEMENT = 'mission:v2:';

const RESULTATS_VISITE = new Map([
  ['ABONNE_ABSENT', 'abonné absent'],
  ['COMPTEUR_INACCESSIBLE', 'compteur inaccessible'],
  ['INDEX_ILLISIBLE', 'index illisible'],
  ['COMPTEUR_A_INTERVENIR', 'compteur nécessitant une intervention technique'],
  ['AUTRE', 'situation signalée par l’Agent'],
]);

function dateSeule(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function dateValide(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateSeule(value));
}

function ajouterJours(value, nombre) {
  const date = new Date(`${dateSeule(value)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + nombre);
  return date.toISOString().slice(0, 10);
}

/* 1 = préparation, 2 = première descente, 3 = deuxième descente. */
function jourDuCycle(dateValue, debutValue) {
  const date = dateSeule(dateValue);
  const debut = dateSeule(debutValue);
  if (!dateValide(date) || !dateValide(debut)) return null;
  const offset = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000
  );
  if (offset < 0) return null;
  return (offset % 3) + 1;
}

function dateFr(value) {
  const date = dateSeule(value);
  if (!dateValide(date)) return 'date non renseignée';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function dateHeureFr(value) {
  if (!value) return 'date non renseignée';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return dateFr(value);
  return date.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: process.env.APP_TIME_ZONE || 'Indian/Antananarivo',
  });
}

function nombre(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function arrondir(value, decimals = 2) {
  const result = nombre(value);
  if (result === null) return null;
  const factor = 10 ** decimals;
  return Math.round((result + Number.EPSILON) * factor) / factor;
}

function unite(typeCompteur) {
  return String(typeCompteur || '').trim().toUpperCase() === 'EAU' ? 'm³' : 'kWh';
}

function serviceCompteur(typeCompteur) {
  return String(typeCompteur || '').trim().toUpperCase() === 'EAU'
    ? 'eau'
    : 'électricité';
}

function valeurIndex(value) {
  const nombreIndex = nombre(value);
  return nombreIndex === null ? 'non disponible' : String(arrondir(nombreIndex, 2));
}

function nomComplet(prenom, nom, secours) {
  return [prenom, nom].filter(Boolean).join(' ').trim() || secours || 'non renseigné';
}

function libelleJour(jour) {
  if (jour === 2) return 'Jour 2 — première descente';
  if (jour === 3) return 'Jour 3 — deuxième descente et finalisation';
  if (jour === 1) return 'Jour 1 — préparation';
  return 'journée non déterminée';
}

function libelleResultat(code) {
  return RESULTATS_VISITE.get(String(code || '').toUpperCase())
    || 'situation signalée par l’Agent';
}

function ecartJours(datePrevue, dateReelle) {
  if (!dateValide(datePrevue) || !dateValide(dateReelle)) return 0;
  return Math.round(
    (Date.parse(`${dateSeule(dateReelle)}T00:00:00Z`)
      - Date.parse(`${dateSeule(datePrevue)}T00:00:00Z`)) / 86400000
  );
}

/* ---------------------------------------------------------
   Chargement d'une mission avec toutes ses informations
   réelles (campagne, agent, abonné, compteur, relevé).
--------------------------------------------------------- */
async function chargerMission(db, missionId) {
  const result = await db.query(
    `SELECT mc.id, mc.campagne_id,
       mc.date_prevue::text AS date_prevue,
       mc.date_limite::text AS date_limite,
       mc.date_visite_reelle::text AS date_visite_reelle,
       mc.statut, mc.resultat_visite, mc.motif_reprogrammation,
       mc.observations, mc.releve_id, mc.updated_at, mc.created_at,
       cc.mois::text AS campagne_mois,
       cc.date_debut::text AS campagne_debut,
       cc.date_fin::text AS campagne_fin,
       cc.statut AS campagne_statut,
       a.numero_abonne, a.nom AS abonne_nom, a.prenom AS abonne_prenom,
       a.quartier, a.commune, a.adresse, a.statut AS statut_abonne,
       c.id AS compteur_id, c.numero_compteur, c.type AS type_compteur,
       agent.id AS agent_id, agent.nom AS agent_nom, agent.prenom AS agent_prenom,
       agent.identifiant AS agent_identifiant,
       responsable.email AS responsable_email,
       responsable.nom AS responsable_nom, responsable.prenom AS responsable_prenom,
       r.id AS releve_id_effectif,
       r.date_releve::text AS date_releve,
       r.date_ancien_releve::text AS date_ancien_releve,
       r.type_releve, r.ancien_index, r.nouvel_index, r.consommation,
       r.created_at AS releve_cree_le,
       precedent.date_releve::text AS date_precedent,
       precedent.nouvel_index AS index_precedent
     FROM missions_controle mc
     INNER JOIN campagnes_controle cc ON cc.id = mc.campagne_id
     INNER JOIN abonnes a ON a.id = mc.abonne_id
     INNER JOIN compteurs c ON c.id = mc.compteur_id
     LEFT JOIN users agent ON agent.id = mc.agent_id
     LEFT JOIN users responsable ON responsable.id = cc.created_by
     LEFT JOIN releves r ON r.id = mc.releve_id AND r.compteur_id = mc.compteur_id
     LEFT JOIN LATERAL (
       SELECT rp.date_releve, rp.nouvel_index
       FROM releves rp
       WHERE rp.compteur_id = mc.compteur_id
         AND rp.id IS DISTINCT FROM mc.releve_id
         AND rp.nouvel_index IS NOT NULL
         AND rp.nouvel_index >= 0
       ORDER BY rp.date_releve DESC, rp.id DESC
       LIMIT 1
     ) precedent ON TRUE
     WHERE mc.id = $1
     LIMIT 1`,
    [missionId]
  );
  return result.rows[0] || null;
}

/* Destinataires : le Responsable de la campagne et tous les
   Administrateurs actifs, dédoublonnés par email. */
async function destinatairesMission(db, mission) {
  const result = await db.query(
    `SELECT LOWER(TRIM(u.email)) AS email, UPPER(TRIM(u.role)) AS role
     FROM users u
     WHERE UPPER(TRIM(COALESCE(u.role, ''))) = 'ADMINISTRATEUR'
       AND LOWER(TRIM(COALESCE(u.statut, ''))) = 'actif'
       AND u.email IS NOT NULL
       AND TRIM(u.email) <> ''
     ORDER BY u.id`
  );
  const destinataires = [];
  const emailsVus = new Set();
  const ajouter = (email, role) => {
    const propre = String(email || '').trim().toLowerCase();
    if (!propre || emailsVus.has(propre)) return;
    emailsVus.add(propre);
    destinataires.push({ email: propre, role });
  };
  ajouter(mission.responsable_email, 'RESPONSABLE');
  for (const ligne of result.rows) ajouter(ligne.email, ligne.role);
  return destinataires;
}

/* Insertion idempotente : même destinataire + même événement
   de mission ne produit jamais deux notifications. */
async function creerNotificationMission(db, destinataire, sujet, message, evenementCle) {
  if (!destinataire) return false;
  const result = await db.query(
    `INSERT INTO notifications
       (type, destinataire, sujet, message, date_envoi, statut, evenement_cle)
     SELECT $1::varchar, $2::varchar, $3::varchar, $4::text,
       CURRENT_TIMESTAMP, 'EN_ATTENTE', $5::varchar
     WHERE NOT EXISTS (
       SELECT 1 FROM notifications
       WHERE LOWER(TRIM(destinataire)) = LOWER(TRIM($2::varchar))
         AND evenement_cle = $5::varchar
     )
     ON CONFLICT DO NOTHING`,
    [TYPE_NOTIFICATION, destinataire, sujet, message, evenementCle]
  );
  if (result.rowCount > 0) return true;

  /* L'événement existe déjà : on rafraîchit uniquement son libellé
     (l'ancien format « Suivi de consommation effectué » ne décrivait
     pas la mission). Le statut lu/traité, la date de création et
     l'archivage éventuel sont conservés. */
  await db.query(
    `UPDATE notifications
     SET sujet = $3::varchar,
         message = $4::text
     WHERE type = $1::varchar
       AND evenement_cle = $5::varchar
       AND LOWER(TRIM(destinataire)) = LOWER(TRIM($2::varchar))`,
    [TYPE_NOTIFICATION, destinataire, sujet, message, evenementCle]
  );
  return false;
}

async function diffuser(db, mission, sujet, message, evenementCle) {
  const destinataires = await destinatairesMission(db, mission);
  if (!destinataires.length) {
    console.warn(`Aucun destinataire actif pour la mission #${mission.id}.`);
    return 0;
  }
  let crees = 0;
  for (const destinataire of destinataires) {
    const cree = await creerNotificationMission(
      db,
      destinataire.email,
      sujet,
      message,
      evenementCle
    );
    if (cree) crees += 1;
  }
  return crees;
}

function contexteMission(mission) {
  const jour = jourDuCycle(mission.date_prevue, mission.campagne_debut);
  const quartier = String(mission.quartier || '').trim() || 'quartier non renseigné';
  const compteur = String(mission.numero_compteur || '').trim() || 'compteur non renseigné';
  const abonne = nomComplet(mission.abonne_prenom, mission.abonne_nom, 'abonné non renseigné');
  const agent = nomComplet(mission.agent_prenom, mission.agent_nom, `Agent #${mission.agent_id || 'inconnu'}`);
  const identifiantAgent = String(mission.agent_identifiant || '').trim();
  const responsable = nomComplet(
    mission.responsable_prenom,
    mission.responsable_nom,
    'Responsable'
  );
  const lieu = [mission.quartier, mission.commune].filter(Boolean).join(', ')
    || 'lieu non renseigné';
  const debutCycle = jour && jour >= 1 ? ajouterJours(mission.date_prevue, -(jour - 1)) : '';
  const jour2 = debutCycle ? ajouterJours(debutCycle, 1) : '';
  const jour3 = debutCycle ? ajouterJours(debutCycle, 2) : '';
  return {
    jour,
    quartier,
    compteur,
    abonne,
    agent,
    identifiantAgent,
    responsable,
    lieu,
    debutCycle,
    jour2,
    jour3,
    service: serviceCompteur(mission.type_compteur),
    mesure: unite(mission.type_compteur),
    reference: String(mission.numero_abonne || '').trim() || 'non renseignée',
  };
}

function enteteMission(ctx, mission, options = {}) {
  const dateReelle = options.dateReelle
    || mission.date_visite_reelle
    || mission.date_releve;
  const libelleDateReelle = options.dateReelleTexte
    || (dateReelle
      ? `date réelle de visite ${dateFr(dateReelle)}`
        + (!mission.date_visite_reelle && mission.date_releve ? ' (date du relevé transmis)' : '')
      : 'date réelle de visite non enregistrée');
  const lignes = [
    `Agent : ${ctx.agent}${ctx.identifiantAgent ? ` (identifiant ${ctx.identifiantAgent})` : ''}.`,
    `Campagne : ${mission.campagne_mois ? `mois ${dateFr(mission.campagne_mois).slice(3)}` : 'campagne non datée'}`
      + `${mission.campagne_debut && mission.campagne_fin
        ? `, du ${dateFr(mission.campagne_debut)} au ${dateFr(mission.campagne_fin)}`
        : ''} (statut ${mission.campagne_statut || 'non renseigné'}).`,
    ctx.debutCycle
      ? `Cycle de trois jours : préparation le ${dateFr(ctx.debutCycle)}, première descente le ${dateFr(ctx.jour2)}, deuxième descente et finalisation le ${dateFr(ctx.jour3)}.`
      : '',
    `Journée concernée : ${libelleJour(ctx.jour)}.`,
    `Abonné : ${ctx.abonne}, référence ${ctx.reference}, quartier ${ctx.quartier}${mission.commune ? ` (${mission.commune})` : ''}.`,
    `Compteur : ${ctx.compteur}, service ${ctx.service}.`,
    `Dates : prévue le ${dateFr(mission.date_prevue)} ; ${libelleDateReelle}.`,
  ];
  return lignes.filter(Boolean).join('\n');
}

/* ---------------------------------------------------------
   1. Contrôle réellement réalisé + relevé transmis
--------------------------------------------------------- */
async function notifierMissionRealisee(db, missionId, options = {}) {
  const id = Number(missionId);
  if (!Number.isInteger(id) || id <= 0) return 0;
  const mission = await chargerMission(db, id);
  if (!mission) return 0;

  const ctx = contexteMission(mission);
  const initial = String(mission.type_releve || '').trim().toUpperCase() === 'INITIAL';
  const retard = ecartJours(mission.date_prevue, mission.date_visite_reelle || mission.date_releve);
  const sujet = `Contrôle réalisé — Jour ${ctx.jour ?? '?'} — ${ctx.quartier} — ${ctx.compteur}`;

  const lignes = [
    initial
      ? `Premier relevé initial enregistré : l’Agent ${ctx.agent}${ctx.identifiantAgent ? ` (${ctx.identifiantAgent})` : ''} a effectué le contrôle du compteur ${ctx.compteur} (${ctx.service}) de l’abonné ${ctx.abonne}, référence ${ctx.reference}, dans le quartier ${ctx.quartier}.`
      : `L’Agent ${ctx.agent}${ctx.identifiantAgent ? ` (${ctx.identifiantAgent})` : ''} a effectué le contrôle du compteur ${ctx.compteur} (${ctx.service}) de l’abonné ${ctx.abonne}, référence ${ctx.reference}, dans le quartier ${ctx.quartier}.`,
    enteteMission(ctx, mission),
    retard > 0
      ? `Statut de la visite : réalisée en retard de ${retard} jour${retard > 1 ? 's' : ''} par rapport à la date prévue.`
      : retard < 0
        ? `Statut de la visite : réalisée ${-retard} jour${retard < -1 ? 's' : ''} avant la date prévue.`
        : 'Statut de la visite : réalisée à la date prévue.',
    initial
      ? `Index initial réellement constaté : ${valeurIndex(mission.nouvel_index)}. Aucune consommation n’est calculée pour ce premier relevé : cet index devient la référence des prochains relevés.`
      : `Index précédent : ${valeurIndex(mission.ancien_index !== null && mission.ancien_index !== undefined ? mission.ancien_index : mission.index_precedent)}`
        + `${mission.date_ancien_releve ? ` (relevé du ${dateFr(mission.date_ancien_releve)})` : ''}. `
        + `Nouvel index relevé : ${valeurIndex(mission.nouvel_index)}. `
        + `Consommation enregistrée : ${valeurIndex(mission.consommation)} ${ctx.mesure}.`,
    `Type de relevé : ${initial ? 'premier relevé initial' : 'relevé périodique'}`
      + `${mission.releve_id_effectif ? ` (relevé #${mission.releve_id_effectif})` : ''}.`,
    `Résultat : relevé du compteur enregistré et transmis au Responsable et à l’Administrateur. Mission #${mission.id} — statut ${mission.statut}.`,
    `Transmission : ${dateHeureFr(mission.releve_cree_le || mission.updated_at || new Date())}.`,
    'La classification de la consommation (normale, historique insuffisant, anomalie) est notifiée séparément : elle ne conditionne pas la réalisation de la mission.',
    'Consultez le détail de la mission dans le planning des contrôles.',
  ];

  return diffuser(
    db,
    mission,
    sujet,
    lignes.join('\n'),
    `${PREFIXE_EVENEMENT}${mission.id}:terminee:${mission.releve_id_effectif || options.releveId || 'sans-releve'}`
  );
}

/* ---------------------------------------------------------
   2. Intervention non réalisée, motif transmis par l'Agent
--------------------------------------------------------- */
async function notifierMissionImpossible(db, missionId, options = {}) {
  const id = Number(missionId);
  if (!Number.isInteger(id) || id <= 0) return 0;
  const mission = await chargerMission(db, id);
  if (!mission) return 0;

  const ctx = contexteMission(mission);
  const motif = String(options.motif || mission.motif_reprogrammation || '').trim()
    || 'motif non renseigné';
  const dateVisite = options.dateVisite || mission.date_visite_reelle;
  const resultat = libelleResultat(options.resultatVisite || mission.resultat_visite);
  const sujet = `Mission non réalisée — Jour ${ctx.jour ?? '?'} — ${ctx.quartier} — ${ctx.compteur}`;

  const lignes = [
    `Intervention non réalisée : l’Agent ${ctx.agent}${ctx.identifiantAgent ? ` (${ctx.identifiantAgent})` : ''} n’a pas pu effectuer le contrôle de l’abonné ${ctx.abonne}, référence ${ctx.reference}, dans le quartier ${ctx.quartier}.`,
    enteteMission(ctx, mission, {
      dateReelle: dateVisite,
      dateReelleTexte: `visite tentée le ${dateFr(dateVisite)}`,
    }),
    `Motif déclaré par l’Agent : ${motif.slice(0, 700)}.`,
    `Résultat constaté : ${resultat}.`,
    'Aucune consommation n’a été vérifiée pour ce compteur : la mission n’est pas considérée comme réalisée.',
    `Mission #${mission.id} — statut ${mission.statut}. Elle reste visible dans le suivi du Responsable et nécessite une décision (nouvelle visite ou clôture motivée).`,
    `Transmission : ${dateHeureFr(mission.updated_at || new Date())}.`,
  ];

  return diffuser(
    db,
    mission,
    sujet,
    lignes.join('\n'),
    `${PREFIXE_EVENEMENT}${mission.id}:impossible:${dateSeule(dateVisite) || 'sans-date'}:${dateSeule(mission.date_prevue)}`
  );
}

/* ---------------------------------------------------------
   3. Résultat non transmis après démarrage du contrôle
--------------------------------------------------------- */
async function notifierMissionSansResultat(db, mission) {
  const ctx = contexteMission(mission);
  const sujet = `Résultat non transmis — Jour ${ctx.jour ?? '?'} — ${ctx.quartier} — ${ctx.compteur}`;
  const lignes = [
    `Intervention signalée comme démarrée, mais résultat non transmis : l’Agent ${ctx.agent}${ctx.identifiantAgent ? ` (${ctx.identifiantAgent})` : ''} a ouvert la mission du compteur ${ctx.compteur} (${ctx.service}) de l’abonné ${ctx.abonne}, référence ${ctx.reference}, dans le quartier ${ctx.quartier}, sans enregistrer de relevé ni de motif de non-réalisation.`,
    enteteMission(ctx, mission),
    `Mission #${mission.id} — statut ${mission.statut}. Le contrôle reste en attente de réalisation ou de justification et n’est pas compté comme réalisé.`,
    `Alerte générée le ${dateHeureFr(new Date())}, après l’échéance de la journée prévue.`,
  ];
  return diffuser(
    db,
    mission,
    sujet,
    lignes.join('\n'),
    `${PREFIXE_EVENEMENT}${mission.id}:en-cours-sans-resultat:j${ctx.jour ?? 0}:${dateSeule(mission.date_prevue)}`
  );
}

/* ---------------------------------------------------------
   4. Missions non réalisées à la date prévue (Jour 2 / Jour 3)
   Appelé par le planificateur serveur après l'échéance de la
   journée. Aucun envoi avant la fin de la journée prévue.
--------------------------------------------------------- */
async function notifierMissionsEnAttente(db = pool) {
  const aujourdhui = dateSeule(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.APP_TIME_ZONE || 'Indian/Antananarivo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  );

  const result = await db.query(
    `SELECT mc.id, mc.campagne_id,
       mc.date_prevue::text AS date_prevue,
       mc.date_visite_reelle::text AS date_visite_reelle,
       mc.statut, mc.resultat_visite, mc.motif_reprogrammation,
       cc.mois::text AS campagne_mois,
       cc.date_debut::text AS campagne_debut,
       cc.date_fin::text AS campagne_fin,
       cc.statut AS campagne_statut,
       a.numero_abonne, a.nom AS abonne_nom, a.prenom AS abonne_prenom,
       a.quartier, a.commune,
       c.numero_compteur, c.type AS type_compteur,
       agent.id AS agent_id, agent.nom AS agent_nom, agent.prenom AS agent_prenom,
       agent.identifiant AS agent_identifiant,
       responsable.email AS responsable_email,
       responsable.nom AS responsable_nom, responsable.prenom AS responsable_prenom
     FROM missions_controle mc
     INNER JOIN campagnes_controle cc ON cc.id = mc.campagne_id AND cc.statut = 'PUBLIEE'
     INNER JOIN abonnes a ON a.id = mc.abonne_id AND LOWER(TRIM(a.statut)) = 'actif'
     INNER JOIN compteurs c ON c.id = mc.compteur_id
     INNER JOIN users agent ON agent.id = mc.agent_id
       AND UPPER(TRIM(agent.role)) = 'AGENT'
       AND LOWER(TRIM(agent.statut)) = 'actif'
     LEFT JOIN users responsable ON responsable.id = cc.created_by
     WHERE mc.statut IN ('PLANIFIEE', 'EN_COURS')
       AND mc.date_prevue < $1::date
       AND mc.date_visite_reelle IS NULL
       AND mc.releve_id IS NULL
     ORDER BY mc.date_prevue, mc.id`,
    [aujourdhui]
  );

  let crees = 0;
  for (const mission of result.rows) {
    const ctx = contexteMission(mission);
    if (ctx.jour !== 2 && ctx.jour !== 3) continue;

    if (String(mission.statut || '').toUpperCase() === 'EN_COURS') {
      crees += await notifierMissionSansResultat(db, mission);
      continue;
    }

    const sujet = `Mission non réalisée — Jour ${ctx.jour} — ${ctx.quartier} — ${ctx.compteur}`;
    const lignes = [
      `Mission non réalisée à la date prévue : la mission attribuée à l’Agent ${ctx.agent}${ctx.identifiantAgent ? ` (${ctx.identifiantAgent})` : ''} concernant le contrôle du compteur ${ctx.compteur} (${ctx.service}) de l’abonné ${ctx.abonne}, référence ${ctx.reference}, dans le quartier ${ctx.quartier}, était prévue le ${dateFr(mission.date_prevue)} (${libelleJour(ctx.jour)}).`,
      `Campagne : ${mission.campagne_mois ? `mois ${dateFr(mission.campagne_mois).slice(3)}` : 'non datée'}`
        + `${mission.campagne_debut && mission.campagne_fin ? `, du ${dateFr(mission.campagne_debut)} au ${dateFr(mission.campagne_fin)}` : ''}. `
        + `Cycle : préparation le ${dateFr(ctx.debutCycle)}, première descente le ${dateFr(ctx.jour2)}, deuxième descente et finalisation le ${dateFr(ctx.jour3)}.`,
      'À la fin de la journée prévue, aucune intervention terminée et aucun résultat transmis n’ont été enregistrés pour cette mission.',
      `Mission #${mission.id} — statut ${mission.statut}. Le contrôle reste en attente de réalisation ou de justification et reste visible dans le suivi du Responsable.`,
      `Alerte générée le ${dateHeureFr(new Date())}, après l’échéance de la journée prévue.`,
    ];
    crees += await diffuser(
      db,
      mission,
      sujet,
      lignes.join('\n'),
      `${PREFIXE_EVENEMENT}${mission.id}:non-realisee:j${ctx.jour}:${dateSeule(mission.date_prevue)}`
    );
  }

  return crees;
}

module.exports = {
  notifierMissionRealisee,
  notifierMissionImpossible,
  notifierMissionsEnAttente,
  chargerMission,
  jourDuCycle,
  dateFr,
};
