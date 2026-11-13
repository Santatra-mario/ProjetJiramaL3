const pool = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const {
  notifierMissionImpossible,
  notifierMissionsEnAttente,
} = require('../services/missionNotificationService');

const STATUTS_MISSION = new Set([
  'EN_ATTENTE',
  'PLANIFIEE',
  'EN_COURS',
  'TERMINEE',
  'A_REPROGRAMMER',
  'ANNULEE',
]);

/* Résultat réellement constaté pendant la visite.
   RELEVE_ENREGISTRE est posé par la création d'un relevé rattaché
   à la mission ; les autres valeurs décrivent une visite effectuée
   sans consommation vérifiable. */
const RESULTATS_VISITE = new Map([
  ['ABONNE_ABSENT', 'abonné absent'],
  ['COMPTEUR_INACCESSIBLE', 'compteur inaccessible'],
  ['INDEX_ILLISIBLE', 'index illisible'],
  ['COMPTEUR_A_INTERVENIR', 'compteur nécessitant une intervention technique'],
  ['AUTRE', 'situation signalée par l’Agent'],
]);

function idPositif(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function dateValide(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateMois(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return null;
  return `${value}-01`;
}

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

function ajouterJours(date, nombre) {
  const value = new Date(`${dateSeule(date)}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return '';
  value.setUTCDate(value.getUTCDate() + nombre);
  return value.toISOString().slice(0, 10);
}

function periodeCyclesValide(debutValue, finValue) {
  const debut = dateSeule(debutValue);
  const fin = dateSeule(finValue);
  if (!dateValide(debut) || !dateValide(fin) || fin < ajouterJours(debut, 2)) return false;
  const jours = Math.round(
    (Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000
  ) + 1;
  return jours % 3 === 0;
}

function dateLisible(value) {
  const date = dateSeule(value);
  if (!date) return 'non renseignée';
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? 'non renseignée'
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(parsed);
}

function dateHeureLisible(value) {
  if (!value) return 'non renseignée';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'non renseignée';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short', timeStyle: 'short',
    timeZone: process.env.APP_TIME_ZONE || 'Indian/Antananarivo',
  }).format(date);
}

function dateDuJourJirama() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIME_ZONE || 'Indian/Antananarivo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dansPeriode(date, debut, fin) {
  return dateValide(date) && date >= debut && date <= fin;
}

function bornesJoursControle(debutValue, finValue) {
  const debut = dateSeule(debutValue);
  const fin = dateSeule(finValue);
  const premierJourTerrain = ajouterJours(debut, 1);

  return {
    debut: premierJourTerrain,
    fin,
    valides: dateValide(premierJourTerrain) &&
      dateValide(ajouterJours(debut, 2)) &&
      dateValide(fin) &&
      fin >= ajouterJours(debut, 2) &&
      premierJourTerrain <= fin,
  };
}

/* Prochain cycle de trois jours réellement exploitable : le Jour 1 prépare,
   les Jour 2 et Jour 3 sont les deux descentes. Un cycle dont la première
   descente est déjà passée n'est jamais proposé. */
function prochainCycleTerrain(debutValue, finValue) {
  const debut = dateSeule(debutValue);
  const fin = dateSeule(finValue);
  if (!dateValide(debut) || !dateValide(fin)) return null;
  const aujourdhui = dateDuJourJirama();
  let base = debut;
  for (let i = 0; i < 40; i += 1) {
    const descente = ajouterJours(base, 1);
    const finalisation = ajouterJours(base, 2);
    if (!dateValide(descente) || !dateValide(finalisation) || finalisation > fin) return null;
    if (descente >= aujourdhui) return { preparation: base, descente, finalisation };
    base = ajouterJours(base, 3);
  }
  return null;
}

function estJourTerrain(dateValue, debutValue, finValue) {
  const date = dateSeule(dateValue);
  const debut = dateSeule(debutValue);
  const fin = dateSeule(finValue);
  if (!dateValide(date) || !dateValide(debut) || !dateValide(fin) || date < debut || date > fin) return false;

  const offset = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000
  );
  const jourDuCycle = offset % 3;
  if (jourDuCycle === 0) return false;

  const debutCycle = ajouterJours(debut, offset - jourDuCycle);
  return ajouterJours(debutCycle, 2) <= fin;
}

async function verifierUtilisateur(client, userId, role) {
  const result = await client.query(
    `SELECT id, nom, prenom, email, identifiant, role, statut
     FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const user = result.rows[0];
  if (
    !user ||
    String(user.role || '').toUpperCase() !== role ||
    String(user.statut || '').trim().toLowerCase() !== 'actif'
  ) return null;
  return user;
}

async function creerNotification(client, destinataire, sujet, message, evenementCle) {
  if (!destinataire) return false;
  const result = await client.query(
    `INSERT INTO notifications
       (type, destinataire, sujet, message, date_envoi, statut, evenement_cle)
     SELECT 'MISSION_CONTROLE', $1::varchar, $2, $3, CURRENT_TIMESTAMP, 'EN_ATTENTE', $4::varchar
     WHERE NOT EXISTS (
       SELECT 1 FROM notifications
       WHERE LOWER(TRIM(destinataire)) = LOWER(TRIM($1::varchar))
         AND evenement_cle = $4::varchar
     )
     ON CONFLICT DO NOTHING`,
    [destinataire, sujet, message, evenementCle]
  );
  return result.rowCount > 0;
}

async function notifierMissionAssignee(client, missionId, evenementCle) {
  const result = await client.query(     `SELECT mc.id, mc.created_at, mc.date_prevue, mc.date_limite, mc.statut, mc.suivi_periodique, mc.observations,
       cc.date_debut::text AS date_debut, cc.date_fin::text AS date_fin,
       (SELECT COUNT(*)::int FROM missions_controle mc_jour
         WHERE mc_jour.agent_id = mc.agent_id
           AND mc_jour.date_prevue = mc.date_prevue
           AND mc_jour.statut <> 'ANNULEE') AS nombre_missions_jour,
       a.numero_abonne, a.nom AS abonne_nom, a.prenom AS abonne_prenom,
       a.adresse, a.quartier, a.commune, a.latitude, a.longitude,
       c.id AS compteur_id, c.numero_compteur, c.type AS type_compteur,
       agent.id AS agent_id, agent.email AS agent_email,
       agent.nom AS agent_nom, agent.prenom AS agent_prenom,
       agent.identifiant AS agent_identifiant,
       responsable.nom AS responsable_nom, responsable.prenom AS responsable_prenom,
       precedent.date_releve AS dernier_releve, precedent.nouvel_index AS dernier_index
     FROM missions_controle mc
     INNER JOIN campagnes_controle cc ON cc.id = mc.campagne_id
     INNER JOIN abonnes a ON a.id = mc.abonne_id
     INNER JOIN compteurs c ON c.id = mc.compteur_id
     INNER JOIN users agent ON agent.id = mc.agent_id
     INNER JOIN users responsable ON responsable.id = cc.created_by
       AND UPPER(TRIM(responsable.role)) = 'RESPONSABLE'
       AND LOWER(TRIM(responsable.statut)) = 'actif'
     LEFT JOIN LATERAL (
       SELECT r.date_releve, r.nouvel_index
       FROM releves r
       WHERE r.compteur_id = c.id
       ORDER BY r.date_releve DESC, r.id DESC
       LIMIT 1
     ) precedent ON TRUE
     WHERE mc.id = $1 AND cc.statut = 'PUBLIEE'
       AND LOWER(TRIM(a.statut)) = 'actif'
       AND UPPER(TRIM(agent.role)) = 'AGENT'
       AND LOWER(TRIM(agent.statut)) = 'actif'`,
    [missionId]
  );
  const mission = result.rows[0];
  if (!mission?.agent_email) return false;

  const abonne = `${mission.abonne_prenom || ''} ${mission.abonne_nom || ''}`.trim() || 'abonné';
  const adresse = [mission.adresse, mission.quartier, mission.commune].filter(Boolean).join(', ') || 'adresse non renseignée';
  const service = String(mission.type_compteur || '').toUpperCase() === 'EAU' ? 'eau' : 'électricité';
  const responsable = `${mission.responsable_prenom || ''} ${mission.responsable_nom || ''}`.trim() || 'Responsable';
  const coordonnees = mission.latitude !== null && mission.longitude !== null
    ? `Coordonnées GPS : ${mission.latitude}, ${mission.longitude}.`
    : 'Coordonnées GPS : non renseignées.';
  const indexPrecedent = mission.dernier_index === null || mission.dernier_index === undefined
    ? 'non disponible'
    : String(mission.dernier_index);
  const jour = jourDuCycle(mission.date_prevue, mission.date_debut);
  const debutCycle = jour ? ajouterJours(mission.date_prevue, -(jour - 1)) : '';
  const jour2 = debutCycle ? ajouterJours(debutCycle, 1) : '';
  const jour3 = debutCycle ? ajouterJours(debutCycle, 2) : '';
  const nombreJour = Number(mission.nombre_missions_jour || 0);
  const message = [
    `Le Responsable ${responsable} vous a affecté une mission de vérification du relevé de l'abonné ${abonne}, référence ${mission.numero_abonne || 'non renseignée'}, quartier ${mission.quartier || 'non renseigné'}, situé à ${adresse}.`,
    `Compteur concerné : ${mission.numero_compteur || 'non renseigné'} (identifiant ${mission.compteur_id}), service : ${service}.`,
    `Date prévue du contrôle : ${dateLisible(mission.date_prevue)}${jour === 2 ? ' (Jour 2 · première descente)' : jour === 3 ? ' (Jour 3 · deuxième descente)' : ''}. Date limite d'exécution : ${dateLisible(mission.date_limite)}.`,
    jour2 && jour3 ? `Cycle de trois jours : Jour 1 préparation le ${dateLisible(debutCycle)}, Jour 2 le ${dateLisible(jour2)}, Jour 3 le ${dateLisible(jour3)}.` : '',
    `Mission #${mission.id}, créée le ${dateHeureLisible(mission.created_at)}, parmi ${nombreJour} mission${nombreJour > 1 ? 's' : ''} de votre planning à cette date. Index précédent connu : ${indexPrecedent}. Date du relevé précédent : ${dateLisible(mission.dernier_releve)}.`,
    `Agent affecté : ${mission.agent_prenom || ''} ${mission.agent_nom || ''}${mission.agent_identifiant ? ` (${mission.agent_identifiant})` : ''}. Responsable : ${responsable}.`,
    `${coordonnees} Statut : ${mission.statut}. Suivi périodique tous les trois jours : ${mission.suivi_periodique ? 'activé' : 'désactivé'}.`,
    "Veuillez vous rendre sur place pour vérifier l'identité de l'abonné, le compteur et l'index réel, puis enregistrer le résultat du contrôle.",
    'Retrouvez cette mission dans votre espace : /dashboard/agent/missions',
    mission.observations ? `Consignes du Responsable : ${mission.observations}.` : '',
  ].join(' ');
  await creerNotification(
    client,
    mission.agent_email,
    "Nouvelle mission de contrôle — Vérification d'un relevé",
    message,
    evenementCle
  );
  return true;
}

function erreur(res, status, message) {
  return res.status(status).json({ status: 'error', message });
}

async function trouverCampagneExistante(queryable, mois, userId, verrouiller = false) {
  const result = await queryable.query(
    `SELECT cc.id, cc.mois::text AS mois, cc.date_debut::text AS date_debut,
       cc.date_fin::text AS date_fin, cc.statut
     FROM campagnes_controle cc
     WHERE cc.mois = $1 AND cc.created_by = $2 AND cc.statut <> 'ANNULEE'
     ORDER BY cc.id DESC
     LIMIT 1${verrouiller ? ' FOR UPDATE OF cc' : ''}`,
    [mois, userId]
  );
  const campagne = result.rows[0];
  if (!campagne) return null;

  const missions = await queryable.query(
    `SELECT COUNT(*)::int AS nombre_missions,
       COUNT(*) FILTER (
         WHERE mc.statut <> 'TERMINEE' AND LOWER(TRIM(a.statut)) = 'supprime'
       )::int AS nombre_missions_masquees
     FROM missions_controle mc
     LEFT JOIN abonnes a ON a.id = mc.abonne_id
     WHERE mc.campagne_id = $1`,
    [campagne.id]
  );
  return {
    ...campagne,
    nombre_missions: Number(missions.rows[0]?.nombre_missions || 0),
    nombre_missions_masquees: Number(missions.rows[0]?.nombre_missions_masquees || 0),
  };
}

function conflitCampagne(res, campagne) {
  return res.status(409).json({
    status: 'error',
    message: 'Un planning existe déjà pour le mois sélectionné.',
    existingCampaign: campagne,
  });
}

async function getAgentsControle(req, res) {
  try {
    const user = await verifierUtilisateur(pool, idPositif(req.user?.id), 'RESPONSABLE');
    if (!user) return erreur(res, 403, 'Accès réservé à un responsable actif.');
    const result = await pool.query(
      `SELECT id, identifiant, nom, prenom, email
       FROM users
       WHERE UPPER(TRIM(role)) = 'AGENT' AND LOWER(TRIM(statut)) = 'actif'
       ORDER BY nom, prenom, id`
    );
    return res.json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error('Erreur chargement des agents contrôleurs :', error);
    return erreur(res, 500, 'Impossible de charger les Agents actifs.');
  }
}

async function getCiblesControle(req, res) {
  const mois = dateMois(req.query.mois);
  if (!mois) return erreur(res, 400, 'Le mois doit être au format AAAA-MM.');
  try {
    const user = await verifierUtilisateur(pool, idPositif(req.user?.id), 'RESPONSABLE');
    if (!user) return erreur(res, 403, 'Accès réservé à un responsable actif.');
    const moisSuivant = new Date(`${mois}T00:00:00Z`);
    moisSuivant.setUTCMonth(moisSuivant.getUTCMonth() + 1);
    const finMois = moisSuivant.toISOString().slice(0, 10);
    const result = await pool.query(
      `SELECT
         a.id AS abonne_id, a.numero_abonne, a.nom AS abonne_nom, a.prenom AS abonne_prenom,
         a.adresse,
         NULLIF(BTRIM(REGEXP_REPLACE(a.quartier, '\\s+', ' ', 'g')), '') AS quartier,
         a.commune, a.latitude, a.longitude,
         c.id AS compteur_id, c.numero_compteur, c.type AS type_compteur,
         l.date_releve::text AS dernier_releve, l.nouvel_index AS dernier_index,
         m.id AS mission_existante_id, m.statut AS mission_existante_statut
       FROM abonnes a
       INNER JOIN compteurs c ON c.abonne_id = a.id
       LEFT JOIN LATERAL (
         SELECT date_releve, nouvel_index
         FROM releves WHERE compteur_id = c.id
         ORDER BY date_releve DESC, id DESC LIMIT 1
       ) l ON TRUE
       LEFT JOIN LATERAL (
         SELECT mc.id, mc.statut
         FROM missions_controle mc
         INNER JOIN campagnes_controle cc ON cc.id = mc.campagne_id
         WHERE mc.compteur_id = c.id
           AND cc.mois = $1
           AND mc.statut <> 'ANNULEE'
         ORDER BY mc.id DESC LIMIT 1
       ) m ON TRUE
       WHERE LOWER(TRIM(a.statut)) = 'actif'
         AND UPPER(TRIM(c.statut)) = 'ACTIF'
       ORDER BY NULLIF(TRIM(a.quartier), ''), a.nom, a.prenom, c.numero_compteur`,
      [mois]
    );
    /* Abonnés actifs sans aucun compteur actif : ils ne peuvent pas produire
       de mission de relevé. Ils sont signalés séparément plutôt que d’être
       silencieusement absents de la liste des cibles. */
    const sansCompteur = await pool.query(
      `SELECT a.id AS abonne_id, a.numero_abonne, a.nom AS abonne_nom,
         a.prenom AS abonne_prenom,
         NULLIF(BTRIM(REGEXP_REPLACE(a.quartier, '\\s+', ' ', 'g')), '') AS quartier,
         a.adresse
       FROM abonnes a
       WHERE LOWER(TRIM(a.statut)) = 'actif'
         AND NOT EXISTS (
           SELECT 1 FROM compteurs c
           WHERE c.abonne_id = a.id AND UPPER(TRIM(c.statut)) = 'ACTIF'
         )
       ORDER BY NULLIF(TRIM(a.quartier), ''), a.nom, a.prenom`
    );
    return res.json({
      status: 'success',
      data: result.rows,
      abonnes_sans_compteur: sansCompteur.rows,
      mois,
      fin_mois_exclusive: finMois,
    });
  } catch (error) {
    console.error('Erreur chargement des abonnés à contrôler :', error);
    return erreur(res, 500, 'Impossible de charger les abonnés et compteurs actifs.');
  }
}

async function getCampagnesControle(req, res) {
  const mois = dateMois(req.query.mois);
  if (!mois) return erreur(res, 400, 'Le mois doit être au format AAAA-MM.');
  try {
    const user = await verifierUtilisateur(pool, idPositif(req.user?.id), 'RESPONSABLE');
    if (!user) return erreur(res, 403, 'Accès réservé à un responsable actif.');
    const result = await pool.query(
      `SELECT
         cc.id AS campagne_id, cc.mois::text AS mois,
         cc.date_debut::text AS date_debut, cc.date_fin::text AS date_fin,
         cc.statut AS statut_campagne,
         cc.created_by, cc.created_at, cc.updated_at,
         (SELECT COUNT(*)::int FROM missions_controle mc_total
          WHERE mc_total.campagne_id = cc.id) AS nombre_missions,
         (SELECT COUNT(*)::int
          FROM missions_controle mc_hidden
          INNER JOIN abonnes a_hidden ON a_hidden.id = mc_hidden.abonne_id
          WHERE mc_hidden.campagne_id = cc.id
            AND mc_hidden.statut <> 'TERMINEE'
            AND LOWER(TRIM(a_hidden.statut)) = 'supprime') AS nombre_missions_masquees,
         mc.id AS mission_id, mc.abonne_id, mc.compteur_id, mc.agent_id,
         mc.date_prevue::text AS date_prevue,
         mc.statut AS statut_mission, mc.statut AS statut,
         mc.priorite, mc.nouvelle_visite,
         mc.motif_reprogrammation, mc.observations, mc.releve_id,
         mc.date_limite::text AS date_limite,
         mc.date_visite_reelle::text AS date_visite_reelle,
         mc.suivi_periodique, mc.mission_parent_id,
         mc.version_affectation, mc.resultat_visite,
         a.numero_abonne, a.nom AS abonne_nom, a.prenom AS abonne_prenom,
         a.adresse, a.quartier, a.commune, a.latitude, a.longitude, a.statut AS statut_abonne,
         a.telephone, a.region, a.fokontany, a.rue, a.repere,
         (SELECT string_agg(DISTINCT c_tous.type, '|')
          FROM compteurs c_tous
          WHERE c_tous.abonne_id = a.id
            AND UPPER(TRIM(c_tous.statut)) = 'ACTIF') AS types_service,
         dernier_releve.date_releve AS dernier_releve_date,
         dernier_releve.nouvel_index AS dernier_releve_index,
         dernier_releve.consommation AS derniere_consommation,
         avant_dernier.consommation AS consommation_precedente,
         c.numero_compteur, c.type AS type_compteur,
         u.identifiant AS agent_identifiant, u.nom AS agent_nom, u.prenom AS agent_prenom,
         u.statut AS agent_statut, u.email AS agent_email,
         resp.nom AS responsable_nom, resp.prenom AS responsable_prenom,
         resp.identifiant AS responsable_identifiant,
         mc.created_at::text AS date_creation_mission,
         CASE WHEN mc.resultat_visite IS NOT NULL OR mc.date_visite_reelle IS NOT NULL
           THEN mc.updated_at::text END AS date_transmission_resultat,
         r.date_releve::text AS date_releve_realisee,
         r.created_at::text AS date_transmission_releve,
         r.type_releve AS type_releve,
         r.ancien_index AS ancien_index_releve,
         r.nouvel_index AS index_releve,
         r.consommation AS consommation_releve,
         COALESCE(
           c.id IS NOT NULL
             AND r.id IS NOT NULL
             AND r.nouvel_index IS NOT NULL
             AND r.nouvel_index >= 0
             AND r.consommation IS NOT NULL
             AND r.consommation >= 0,
           FALSE
         ) AS releve_exploitable
       FROM campagnes_controle cc
       LEFT JOIN missions_controle mc ON mc.campagne_id = cc.id
         AND (
           mc.statut = 'TERMINEE'
           OR EXISTS (
             SELECT 1 FROM abonnes abonne_visible
             WHERE abonne_visible.id = mc.abonne_id
               AND LOWER(TRIM(abonne_visible.statut)) <> 'supprime'
           )
         )
       LEFT JOIN abonnes a ON a.id = mc.abonne_id
       LEFT JOIN compteurs c ON c.id = mc.compteur_id AND c.abonne_id = mc.abonne_id
       LEFT JOIN users u ON u.id = mc.agent_id
       LEFT JOIN users resp ON resp.id = cc.created_by
       LEFT JOIN releves r ON r.id = mc.releve_id AND r.compteur_id = mc.compteur_id
       LEFT JOIN LATERAL (
         SELECT rp.date_releve::text AS date_releve, rp.nouvel_index, rp.consommation
         FROM releves rp
         WHERE rp.compteur_id = c.id
         ORDER BY rp.date_releve DESC, rp.id DESC
         LIMIT 1
       ) dernier_releve ON TRUE
       LEFT JOIN LATERAL (
         SELECT rp2.consommation
         FROM releves rp2
         WHERE rp2.compteur_id = c.id
         ORDER BY rp2.date_releve DESC, rp2.id DESC
         OFFSET 1 LIMIT 1
       ) avant_dernier ON TRUE
       WHERE cc.mois = $1 AND cc.created_by = $2
       ORDER BY cc.date_debut DESC, cc.id DESC, mc.date_prevue NULLS LAST, mc.id`,
      [mois, user.id]
    );
    const campagnes = new Map();
    for (const row of result.rows) {
      if (!campagnes.has(row.campagne_id)) {
        campagnes.set(row.campagne_id, {
          id: row.campagne_id,
          mois: row.mois,
          date_debut: row.date_debut,
          date_fin: row.date_fin,
          statut: row.statut_campagne,
          nombre_missions: row.nombre_missions,
          nombre_missions_masquees: row.nombre_missions_masquees,
          created_by: row.created_by,
          responsable_nom: row.responsable_nom,
          responsable_prenom: row.responsable_prenom,
          responsable_identifiant: row.responsable_identifiant,
          created_at: row.created_at,
          missions: [],
          affectations: [],
        });
      }
      if (row.mission_id) {
        const { campagne_id, statut_campagne, created_by, statut_abonne, ...mission } = row;
        campagnes.get(row.campagne_id).missions.push(mission);
      }
    }
    /* Préparation du Jour 1 : les Agents et quartiers choisis sont conservés
       séparément des missions individuelles, donc visibles même avant que les
       compteurs ne soient affectés. */
    const campagneIds = [...campagnes.keys()];
    if (campagneIds.length) {
      const affectationsResult = await pool.query(
        `SELECT ac.campagne_id, ac.agent_id, ac.quartier,
           u.nom AS agent_nom, u.prenom AS agent_prenom,
           u.identifiant AS agent_identifiant, u.statut AS agent_statut,
           u.email AS agent_email
         FROM affectations_controle ac
         INNER JOIN users u ON u.id = ac.agent_id
         WHERE ac.campagne_id = ANY($1::int[])
         ORDER BY u.nom, u.prenom, ac.quartier`,
        [campagneIds]
      );
      for (const ligne of affectationsResult.rows) {
        const campagne = campagnes.get(ligne.campagne_id);
        if (!campagne) continue;
        campagne.affectations.push({
          agent_id: ligne.agent_id,
          quartier: ligne.quartier,
          agent_nom: ligne.agent_nom,
          agent_prenom: ligne.agent_prenom,
          agent_identifiant: ligne.agent_identifiant,
          agent_statut: ligne.agent_statut,
          agent_email: ligne.agent_email,
        });
      }
    }
    return res.json({ status: 'success', data: Array.from(campagnes.values()) });
  } catch (error) {
    console.error('Erreur chargement des campagnes de contrôle :', error);
    return erreur(res, 500, 'Impossible de charger les plannings du mois.');
  }
}

async function creerCampagneControle(req, res) {
  const userId = idPositif(req.user?.id);
  const mois = dateMois(req.body?.mois);
  const debut = req.body?.date_debut;
  const fin = req.body?.date_fin;
  if (!userId) return erreur(res, 401, 'Utilisateur non authentifié.');
  if (!mois || !dateValide(debut) || !dateValide(fin)) {
    return erreur(res, 400, 'Renseignez le mois, la date de début et la date de fin.');
  }
  const debutMoisSuivant = new Date(`${mois}T00:00:00Z`);
  debutMoisSuivant.setUTCMonth(debutMoisSuivant.getUTCMonth() + 1);
  if (
    debut < mois ||
    !periodeCyclesValide(debut, fin) ||
    fin >= debutMoisSuivant.toISOString().slice(0, 10)
  ) {
    return erreur(
      res,
      400,
      'Les dates doivent rester dans le mois de la campagne et inclure le jour de préparation ainsi que les deux jours de terrain.'
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await verifierUtilisateur(client, userId, 'RESPONSABLE');
    if (!user) {
      await client.query('ROLLBACK');
      return erreur(res, 403, 'Accès réservé à un responsable actif.');
    }
    const existing = await trouverCampagneExistante(client, mois, userId, true);
    if (existing) {
      await client.query('ROLLBACK');
      return conflitCampagne(res, existing);
    }
    const result = await client.query(
      `INSERT INTO campagnes_controle (mois, date_debut, date_fin, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING id, mois::text AS mois, date_debut::text AS date_debut,
         date_fin::text AS date_fin, statut`,
      [mois, debut, fin, userId]
    );
    await client.query('COMMIT');
    await logAudit({ actorId: userId, actorRole: 'RESPONSABLE', action: 'CAMPAGNE_CONTROLE_CREEE', resourceType: 'campagne_controle', resourceId: result.rows[0].id, details: { mois, date_debut: debut, date_fin: fin } });
    return res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erreur création d’une campagne de contrôle :', error);
    if (error.code === '23505') {
      try {
        const existing = await trouverCampagneExistante(pool, mois, userId);
        if (existing) return conflitCampagne(res, existing);
      } catch (lookupError) {
        console.error('Erreur chargement du planning en conflit :', lookupError);
      }
    }
    return erreur(res, 500, 'Impossible de créer le planning.');
  } finally {
    client.release();
  }
}

async function modifierDatesCampagneControle(req, res) {
  const campagneId = idPositif(req.params.id);
  const userId = idPositif(req.user?.id);
  const debut = req.body?.date_debut;
  const fin = req.body?.date_fin;
  if (!campagneId || !userId) return erreur(res, 400, 'Identifiant de planning invalide.');
  if (!dateValide(debut) || !dateValide(fin)) {
    return erreur(res, 400, 'Renseignez des dates de début et de fin valides.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await verifierUtilisateur(client, userId, 'RESPONSABLE');
    if (!user) {
      await client.query('ROLLBACK');
      return erreur(res, 403, 'Accès réservé à un responsable actif.');
    }

    const result = await client.query(
      `SELECT id, mois::text AS mois, statut
       FROM campagnes_controle
       WHERE id = $1 AND created_by = $2
       FOR UPDATE`,
      [campagneId, userId]
    );
    const campagne = result.rows[0];
    if (!campagne) {
      await client.query('ROLLBACK');
      return erreur(res, 404, 'Planning introuvable.');
    }
    if (campagne.statut !== 'BROUILLON') {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Seul un brouillon peut avoir ses dates modifiées.');
    }

    const debutMoisSuivant = new Date(`${campagne.mois}T00:00:00Z`);
    debutMoisSuivant.setUTCMonth(debutMoisSuivant.getUTCMonth() + 1);
    if (
      debut < campagne.mois ||
      !periodeCyclesValide(debut, fin) ||
      fin >= debutMoisSuivant.toISOString().slice(0, 10)
    ) {
      await client.query('ROLLBACK');
      return erreur(
        res,
        400,
        'Les dates doivent rester dans le mois du planning et inclure le jour de préparation ainsi que les deux jours de terrain.'
      );
    }

    const updated = await client.query(
      `UPDATE campagnes_controle
       SET date_debut = $1, date_fin = $2, updated_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, mois::text AS mois, date_debut::text AS date_debut,
         date_fin::text AS date_fin, statut`,
      [debut, fin, userId, campagneId]
    );
    await client.query('COMMIT');
    await logAudit({
      actorId: userId,
      actorRole: 'RESPONSABLE',
      action: 'CAMPAGNE_CONTROLE_DATES_MODIFIEES',
      resourceType: 'campagne_controle',
      resourceId: campagneId,
      details: { date_debut: debut, date_fin: fin },
    });
    return res.json({ status: 'success', data: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erreur modification des dates du planning :', error);
    return erreur(res, 500, 'Impossible de modifier les dates du brouillon.');
  } finally {
    client.release();
  }
}

async function ajouterMissionsControle(req, res) {
  const campagneId = idPositif(req.params.id);
  const userId = idPositif(req.user?.id);
  const missions = Array.isArray(req.body?.missions) ? req.body.missions : [];
  if (!campagneId || !userId || missions.length === 0) {
    return erreur(res, 400, 'Sélectionnez au moins un compteur à contrôler.');
  }
  if (missions.length > 500) return erreur(res, 413, 'La sélection dépasse 500 missions.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const responsable = await verifierUtilisateur(client, userId, 'RESPONSABLE');
    if (!responsable) {
      await client.query('ROLLBACK');
      return erreur(res, 403, 'Accès réservé à un responsable actif.');
    }
    const campaignResult = await client.query(
      `SELECT * FROM campagnes_controle WHERE id = $1 AND created_by = $2 FOR UPDATE`,
      [campagneId, userId]
    );
    const campagne = campaignResult.rows[0];
    if (!campagne) {
      await client.query('ROLLBACK');
      return erreur(res, 404, 'Planning introuvable.');
    }
    if (!['BROUILLON', 'PUBLIEE'].includes(campagne.statut)) {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Le planning est clôturé ou annulé.');
    }
    const idsDansLaRequete = new Set();
    const created = [];
    for (const item of missions) {
      const compteurId = idPositif(item?.compteur_id);
      const agentFourni = item?.agent_id !== undefined && item?.agent_id !== null && item?.agent_id !== '';
      const agentId = agentFourni ? idPositif(item.agent_id) : null;
      const datePrevue = item?.date_prevue || null;
      const nouvelleVisite = item?.nouvelle_visite === true;
      const suiviPeriodique = item?.suivi_periodique === true;
      const observations = typeof item?.observations === 'string' ? item.observations.trim() : '';
      const priorite = item?.priorite ? String(item.priorite).toUpperCase() : null;
      if (observations.length > 1000) {
        await client.query('ROLLBACK');
        return erreur(res, 400, 'Les consignes sont limitees a 1 000 caracteres.');
      }
      if (!compteurId || (agentFourni && !agentId)) {
        await client.query('ROLLBACK');
        return erreur(res, 400, 'Un compteur ou un identifiant Agent est invalide.');
      }
      const joursControle = bornesJoursControle(campagne.date_debut, campagne.date_fin);
      if (datePrevue && (
        !joursControle.valides ||
        !estJourTerrain(datePrevue, campagne.date_debut, campagne.date_fin)
      )) {
        await client.query('ROLLBACK');
        return erreur(
          res,
          400,
          joursControle.valides
            ? `La date prévue doit correspondre à un jour de contrôle (du ${dateLisible(joursControle.debut)} au ${dateLisible(joursControle.fin)}). Le premier jour est réservé à la préparation.`
            : 'Aucune date de contrôle n’est disponible dans la période du planning : le premier jour est réservé à la préparation.'
        );
      }
      if (campagne.statut === 'PUBLIEE' && (!agentId || !datePrevue)) {
        await client.query('ROLLBACK');
        return erreur(res, 400, 'Une mission publiée doit avoir un Agent et une date.');
      }
      const dateLimite = campagne.statut === 'PUBLIEE' ? datePrevue : null;
      if (
        campagne.statut === 'PUBLIEE' &&
        (
          datePrevue < dateDuJourJirama() ||
          !joursControle.valides ||
          !estJourTerrain(datePrevue, campagne.date_debut, campagne.date_fin)
        )
      ) {
        await client.query('ROLLBACK');
        return erreur(
          res,
          400,
          `Date de publication : ${dateLisible(dateDuJourJirama())}. Choisissez une date terrain future comprise dans un cycle complet du planning (${dateLisible(joursControle.debut)} au ${dateLisible(joursControle.fin)}).`
        );
      }
      if (priorite && !['NORMALE', 'HAUTE', 'URGENTE'].includes(priorite)) {
        await client.query('ROLLBACK');
        return erreur(res, 400, 'La priorité de mission est invalide.');
      }
      if (idsDansLaRequete.has(compteurId) && !nouvelleVisite) {
        await client.query('ROLLBACK');
        return erreur(res, 409, 'Un compteur ne peut figurer deux fois dans cette sélection sans nouvelle visite explicite.');
      }
      idsDansLaRequete.add(compteurId);

      const meterResult = await client.query(
        `SELECT c.id, c.abonne_id, c.statut AS statut_compteur, a.statut AS statut_abonne
         FROM compteurs c INNER JOIN abonnes a ON a.id = c.abonne_id
         WHERE c.id = $1 FOR UPDATE OF c`,
        [compteurId]
      );
      const meter = meterResult.rows[0];
      if (!meter || String(meter.statut_compteur).toUpperCase() !== 'ACTIF' || String(meter.statut_abonne).toLowerCase() !== 'actif') {
        await client.query('ROLLBACK');
        return erreur(res, 400, 'Le compteur ou son abonné est introuvable ou inactif.');
      }

      if (agentId) {
        const agent = await verifierUtilisateur(client, agentId, 'AGENT');
        if (!agent) {
          await client.query('ROLLBACK');
          return erreur(res, 400, 'L’Agent choisi n’existe pas, est inactif ou ne possède pas le rôle AGENT.');
        }
      }

      const sameCampaign = await client.query(
        `SELECT id, statut FROM missions_controle
         WHERE campagne_id = $1 AND compteur_id = $2 AND statut <> 'ANNULEE'
         FOR UPDATE`,
        [campagneId, compteurId]
      );
      if (sameCampaign.rowCount && (!nouvelleVisite || !sameCampaign.rows.every((row) => ['TERMINEE', 'A_REPROGRAMMER'].includes(row.statut)))) {
        await client.query('ROLLBACK');
        return erreur(res, 409, 'Ce compteur est déjà prévu dans le planning. Choisissez « nouvelle visite » après un contrôle terminé ou à reprogrammer.');
      }

      if (datePrevue && !nouvelleVisite) {
        const conflict = await client.query(
          `SELECT mc.id
           FROM missions_controle mc
           INNER JOIN campagnes_controle cc ON cc.id = mc.campagne_id
           WHERE mc.compteur_id = $1 AND mc.statut <> 'ANNULEE'
             AND mc.campagne_id <> $2
             AND cc.created_by = $3
             AND cc.date_debut <= $5 AND cc.date_fin >= $4
           LIMIT 1`,
          [compteurId, campagneId, userId, campagne.date_debut, campagne.date_fin]
        );
        if (conflict.rowCount) {
          await client.query('ROLLBACK');
          return erreur(res, 409, 'Ce compteur est déjà prévu dans une autre campagne de cette période.');
        }
      }

      const result = await client.query(
        `INSERT INTO missions_controle
           (campagne_id, abonne_id, compteur_id, agent_id, date_prevue, statut, priorite,
            nouvelle_visite, suivi_periodique, observations, date_limite, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
         RETURNING id, agent_id, date_prevue, statut`,
        [campagneId, meter.abonne_id, compteurId, agentId, datePrevue, agentId && datePrevue && campagne.statut === 'PUBLIEE' ? 'PLANIFIEE' : 'EN_ATTENTE', priorite, nouvelleVisite, suiviPeriodique, observations || null, dateLimite, userId]
      );
      const mission = result.rows[0];
      if (mission.agent_id && campagne.statut === 'PUBLIEE') {
        await notifierMissionAssignee(
          client,
          mission.id,
          `mission:v2:${mission.id}:affectation:0:${mission.agent_id}`
        );
      }
      created.push(mission);
    }
    await client.query('COMMIT');
    await logAudit({ actorId: userId, actorRole: 'RESPONSABLE', action: 'MISSIONS_CONTROLE_AJOUTEES', resourceType: 'campagne_controle', resourceId: campagneId, details: { nombre: created.length } });
    return res.status(201).json({ status: 'success', data: created });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erreur création des missions de contrôle :', error);
    return erreur(res, 500, 'Impossible d’enregistrer les missions sélectionnées.');
  } finally {
    client.release();
  }
}

/* Préparation du Jour 1 : enregistre les Agents et les quartiers choisis par
   le Responsable, avant même la création des missions individuelles.
   La préparation est remplacée en bloc (transaction) pour rester idempotente
   et ne jamais dupliquer une affectation Agent → Quartier. */
async function enregistrerAffectationsControle(req, res) {
  const campagneId = idPositif(req.params.id);
  if (!campagneId) return erreur(res, 400, 'Planning invalide.');
  const agentsBruts = Array.isArray(req.body?.agents) ? req.body.agents : [];
  const quartiersBruts = Array.isArray(req.body?.quartiers) ? req.body.quartiers : [];
  /* Le Responsable peut préciser quel Agent prend quel quartier. Sans cette
     liste, l'ancien comportement (chaque Agent sur chaque quartier) est
     conservé pour ne pas casser les appels existants. */
  const pairesBrutes = Array.isArray(req.body?.affectations) ? req.body.affectations : [];
  const normaliserQuartier = (valeur) => {
    if (typeof valeur !== 'string') return null;
    return valeur === '__none__' ? '' : valeur.trim();
  };
  const paires = [];
  const clesPaires = new Set();
  for (const item of pairesBrutes) {
    const agentId = idPositif(item?.agent_id);
    const quartier = normaliserQuartier(item?.quartier);
    if (!agentId || quartier === null) {
      return erreur(res, 400, 'Une affectation Agent → Quartier est invalide.');
    }
    const cle = `${agentId}|${quartier}`;
    if (clesPaires.has(cle)) continue;
    clesPaires.add(cle);
    paires.push({ agent_id: agentId, quartier });
  }
  const userId = idPositif(req.user?.id);

  const client = await pool.connect();
  try {
    const user = await verifierUtilisateur(client, userId, 'RESPONSABLE');
    if (!user) return erreur(res, 403, 'Accès réservé à un responsable actif.');

    await client.query('BEGIN');
    const campagneResult = await client.query(
      `SELECT id, statut, mois::text AS mois,
         date_debut::text AS date_debut, date_fin::text AS date_fin
       FROM campagnes_controle
       WHERE id = $1 AND created_by = $2
       FOR UPDATE`,
      [campagneId, user.id]
    );
    const campagne = campagneResult.rows[0];
    if (!campagne) {
      await client.query('ROLLBACK');
      return erreur(res, 404, 'Planning introuvable ou non rattaché à votre compte.');
    }
    if (!['BROUILLON', 'PUBLIEE'].includes(campagne.statut)) {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Ce planning est clôturé ou annulé. Les affectations restent consultables mais ne peuvent plus être modifiées.');
    }

    const agentIds = paires.length
      ? [...new Set(paires.map((paire) => paire.agent_id))]
      : [...new Set(agentsBruts.map(idPositif).filter(Boolean))];
    if (!agentIds.length) {
      await client.query('ROLLBACK');
      return erreur(res, 400, 'Veuillez sélectionner au moins un Agent actif avant de poursuivre.');
    }
    const agentsResult = await client.query(
      `SELECT id FROM users
       WHERE id = ANY($1::int[])
         AND UPPER(TRIM(role)) = 'AGENT'
         AND LOWER(TRIM(statut)) = 'actif'`,
      [agentIds]
    );
    if (agentsResult.rowCount !== agentIds.length) {
      await client.query('ROLLBACK');
      return erreur(res, 400, 'Un Agent sélectionné est introuvable, inactif ou ne possède plus le rôle AGENT.');
    }

    /* Les quartiers doivent correspondre à des abonnés et compteurs actifs,
       c'est-à-dire aux quartiers réellement disponibles dans la préparation. */
    const quartiersResult = await client.query(
      `SELECT DISTINCT COALESCE(NULLIF(BTRIM(REGEXP_REPLACE(a.quartier, '\\s+', ' ', 'g')), ''), '') AS quartier
       FROM abonnes a
       INNER JOIN compteurs c ON c.abonne_id = a.id
       WHERE LOWER(TRIM(a.statut)) = 'actif'
         AND UPPER(TRIM(c.statut)) = 'ACTIF'`
    );
    const quartiersDisponibles = new Set(quartiersResult.rows.map((ligne) => ligne.quartier));
    const quartiers = paires.length
      ? [...new Set(paires.map((paire) => paire.quartier))]
      : [...new Set(quartiersBruts.map(normaliserQuartier).filter((quartier) => quartier !== null))];
    if (!quartiers.length) {
      await client.query('ROLLBACK');
      return erreur(res, 400, 'Veuillez sélectionner au moins un quartier à contrôler avant de poursuivre.');
    }
    const quartierInconnu = quartiers.find((quartier) => !quartiersDisponibles.has(quartier));
    if (quartierInconnu !== undefined) {
      await client.query('ROLLBACK');
      return erreur(res, 400, `Le quartier « ${quartierInconnu || 'non renseigné'} » ne correspond à aucun abonné actif de ce mois.`);
    }

    await client.query('DELETE FROM affectations_controle WHERE campagne_id = $1', [campagneId]);
    if (paires.length) {
      for (const paire of paires) {
        await client.query(
          `INSERT INTO affectations_controle (campagne_id, agent_id, quartier, created_by)
           VALUES ($1, $2, $3, $4)`,
          [campagneId, paire.agent_id, paire.quartier, user.id]
        );
      }
    } else {
      await client.query(
        `INSERT INTO affectations_controle (campagne_id, agent_id, quartier, created_by)
         SELECT $1, a.agent_id, q.quartier, $2
         FROM UNNEST($3::int[]) AS a(agent_id)
         CROSS JOIN UNNEST($4::text[]) AS q(quartier)`,
        [campagneId, user.id, agentIds, quartiers]
      );
    }

    /* ---------------------------------------------------------------
       Génération des missions du quartier
       Un quartier attribué à un seul Agent couvre TOUS ses abonnés
       actifs et TOUS leurs compteurs actifs : une mission est créée
       par compteur, sans limite de volume et sans doublon. Les
       missions sont réparties entre le Jour 2 et le Jour 3 du prochain
       cycle complet. Un quartier partagé par plusieurs Agents n'est
       jamais dupliqué automatiquement : le Responsable doit répartir
       explicitement les compteurs entre eux.
    --------------------------------------------------------------- */
    const cycleTerrain = prochainCycleTerrain(campagne.date_debut, campagne.date_fin);
    let missionsCreees = [];
    if (cycleTerrain) {
      const generation = await client.query(
        `WITH uniques AS (
           SELECT ac.quartier, MIN(ac.agent_id) AS agent_id
           FROM affectations_controle ac
           WHERE ac.campagne_id = $1
           GROUP BY ac.quartier
           HAVING COUNT(DISTINCT ac.agent_id) = 1
         ),
         cibles AS (
           SELECT u.agent_id, u.quartier, a.id AS abonne_id, c.id AS compteur_id
           FROM uniques u
           INNER JOIN abonnes a
             ON COALESCE(NULLIF(BTRIM(REGEXP_REPLACE(a.quartier, '\\s+', ' ', 'g')), ''), '') = u.quartier
            AND LOWER(TRIM(a.statut)) = 'actif'
           INNER JOIN compteurs c
             ON c.abonne_id = a.id AND UPPER(TRIM(c.statut)) = 'ACTIF'
           WHERE NOT EXISTS (
             SELECT 1 FROM missions_controle mc
             WHERE mc.campagne_id = $1 AND mc.compteur_id = c.id AND mc.statut <> 'ANNULEE'
           )
         ),
         numerotees AS (
           SELECT cibles.*,
             ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY quartier, abonne_id, compteur_id) AS rang,
             COUNT(*) OVER (PARTITION BY agent_id) AS total
           FROM cibles
         )
         INSERT INTO missions_controle
           (campagne_id, abonne_id, compteur_id, agent_id, date_prevue, statut, priorite,
            nouvelle_visite, suivi_periodique, date_limite, created_by, updated_by)
         SELECT $1, abonne_id, compteur_id, agent_id,
           CASE WHEN rang <= CEIL(total / 2.0) THEN $2::date ELSE $3::date END,
           CASE WHEN $5::text = 'PUBLIEE' THEN 'PLANIFIEE' ELSE 'EN_ATTENTE' END,
           'NORMALE', FALSE, FALSE,
           CASE WHEN $5::text = 'PUBLIEE'
             THEN CASE WHEN rang <= CEIL(total / 2.0) THEN $2::date ELSE $3::date END
             ELSE NULL END,
           $4, $4
         FROM numerotees
         RETURNING id, agent_id, abonne_id, compteur_id, date_prevue::text AS date_prevue`,
        [campagneId, cycleTerrain.descente, cycleTerrain.finalisation, user.id, campagne.statut]
      );
      missionsCreees = generation.rows;
    }

    /* Notification d'affectation : un seul message par Agent et par cycle,
       construit à partir des missions réellement enregistrées. */
    if (missionsCreees.length) {
      const recap = await client.query(
        `SELECT mc.agent_id, agent.email, agent.nom, agent.prenom, agent.identifiant,
           COUNT(*)::int AS missions,
           COUNT(DISTINCT mc.abonne_id)::int AS abonnes,
           COUNT(DISTINCT mc.compteur_id)::int AS compteurs,
           COUNT(*) FILTER (WHERE mc.date_prevue = $2::date)::int AS jour2,
           COUNT(*) FILTER (WHERE mc.date_prevue = $3::date)::int AS jour3,
           ARRAY_REMOVE(ARRAY_AGG(DISTINCT NULLIF(TRIM(a.quartier), '')), NULL) AS quartiers
         FROM missions_controle mc
         INNER JOIN users agent ON agent.id = mc.agent_id
         INNER JOIN abonnes a ON a.id = mc.abonne_id
         WHERE mc.campagne_id = $1 AND mc.id = ANY($4::int[])
         GROUP BY mc.agent_id, agent.email, agent.nom, agent.prenom, agent.identifiant`,
        [campagneId, cycleTerrain.descente, cycleTerrain.finalisation, missionsCreees.map((m) => m.id)]
      );
      for (const ligne of recap.rows) {
        const quartiersTexte = (ligne.quartiers || []).filter(Boolean).join(', ') || 'quartier non renseigné';
        const agentNom = `${ligne.prenom || ''} ${ligne.nom || ''}`.trim() || ligne.identifiant || `Agent #${ligne.agent_id}`;
        const responsable = `${user.prenom || ''} ${user.nom || ''}`.trim() || 'le Responsable';
        await creerNotification(
          client,
          ligne.email,
          'Nouvelle affectation — Contrôle de quartier',
          [
            `Le Responsable ${responsable} vous a affecté le contrôle du quartier ${quartiersTexte} (planning #${campagneId}).`,
            `${ligne.abonnes} abonné${ligne.abonnes > 1 ? 's' : ''} actif${ligne.abonnes > 1 ? 's' : ''} et ${ligne.compteurs} compteur${ligne.compteurs > 1 ? 's' : ''} à contrôler vous sont attribués : ${ligne.jour2} mission${ligne.jour2 > 1 ? 's' : ''} le Jour 2 (${dateLisible(cycleTerrain.descente)}) et ${ligne.jour3} le Jour 3 (${dateLisible(cycleTerrain.finalisation)}).`,
            `Agent destinataire : ${agentNom}.`,
            'Consultez la liste de vos abonnés et de vos compteurs dans votre espace Missions : /dashboard/agent/missions',
          ].join(' '),
          `affectation:v1:${campagneId}:${ligne.agent_id}:${cycleTerrain.descente}`
        );
      }
    }

    const result = await client.query(
      `SELECT ac.agent_id, ac.quartier,
         u.nom AS agent_nom, u.prenom AS agent_prenom,
         u.identifiant AS agent_identifiant, u.statut AS agent_statut,
         u.email AS agent_email
       FROM affectations_controle ac
       INNER JOIN users u ON u.id = ac.agent_id
       WHERE ac.campagne_id = $1
       ORDER BY u.nom, u.prenom, ac.quartier`,
      [campagneId]
    );
    await client.query('COMMIT');
    await logAudit({
      actorId: user.id,
      actorRole: 'RESPONSABLE',
      action: 'AFFECTATIONS_CONTROLE_PREPAREES',
      resourceType: 'campagne_controle',
      resourceId: campagneId,
      details: {
        agents: agentIds.length,
        quartiers: quartiers.length,
        missions_creees: missionsCreees.length,
      },
    });
    return res.json({
      status: 'success',
      data: result.rows,
      missions_creees: missionsCreees.length,
      cycle: cycleTerrain,
      avertissement: cycleTerrain
        ? null
        : 'Affectations enregistrées, mais aucun cycle de trois jours complet ne reste dans ce planning : les missions des compteurs n’ont pas été générées automatiquement.',
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erreur enregistrement des affectations de contrôle :', error);
    return erreur(res, 500, 'Impossible d’enregistrer la préparation des missions.');
  } finally {
    client.release();
  }
}

async function publierCampagneControle(req, res) {
  const campagneId = idPositif(req.params.id);
  const userId = idPositif(req.user?.id);
  if (!campagneId || !userId) return erreur(res, 400, 'Identifiant de planning invalide.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const responsable = await verifierUtilisateur(client, userId, 'RESPONSABLE');
    if (!responsable) {
      await client.query('ROLLBACK');
      return erreur(res, 403, 'Accès réservé à un responsable actif.');
    }
    const campaignResult = await client.query(
      `SELECT * FROM campagnes_controle WHERE id = $1 AND created_by = $2 FOR UPDATE`,
      [campagneId, userId]
    );
    const campagne = campaignResult.rows[0];
    if (!campagne) {
      await client.query('ROLLBACK');
      return erreur(res, 404, 'Planning introuvable.');
    }
    if (campagne.statut !== 'BROUILLON') {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Seul un brouillon peut être publié.');
    }
    const missions = await client.query(
      `SELECT mc.id, mc.abonne_id, mc.agent_id, mc.date_prevue, mc.statut,
         a.statut AS statut_abonne
       FROM missions_controle mc
       INNER JOIN abonnes a ON a.id = mc.abonne_id
       WHERE mc.campagne_id = $1 AND mc.statut <> 'ANNULEE'
       ORDER BY mc.id FOR UPDATE OF mc`,
      [campagneId]
    );
    if (missions.rowCount === 0) {
      await client.query('ROLLBACK');
      return erreur(res, 400, 'Ajoutez au moins une mission avant de publier le planning.');
    }
    const datePublication = dateDuJourJirama();
    const joursControle = bornesJoursControle(campagne.date_debut, campagne.date_fin);
    const missionsActives = missions.rows.filter(
      (mission) => String(mission.statut_abonne || '').trim().toLowerCase() === 'actif'
    );
    const missionsAbonneInactif = missions.rows.filter(
      (mission) => String(mission.statut_abonne || '').trim().toLowerCase() !== 'actif'
    );
    if (missionsActives.length === 0) {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Aucune mission ne peut être publiée : les abonnés associés ne sont plus actifs. Actualisez le planning et sélectionnez des abonnés actifs.');
    }
    if (!joursControle.valides) {
      await client.query('ROLLBACK');
      return erreur(
        res,
        400,
        `Aucune date de contrôle n’est disponible pour ${campagne.mois}. Le premier jour (${dateLisible(campagne.date_debut)}) est réservé à la préparation ; le planning doit inclure les deux jours de terrain suivants.`
      );
    }
    for (const mission of missionsActives) {
      const datePrevue = dateSeule(mission.date_prevue);
      if (!mission.agent_id || !datePrevue || !dateValide(datePrevue)) {
        await client.query('ROLLBACK');
        return erreur(res, 400, 'Chaque mission doit avoir un Agent actif et une date prévue avant publication.');
      }
      if (
        datePrevue < datePublication ||
        !estJourTerrain(datePrevue, campagne.date_debut, campagne.date_fin)
      ) {
        await client.query('ROLLBACK');
        return erreur(
          res,
          400,
          `La date de contrôle prévue (${dateLisible(datePrevue)}) est incompatible. Choisissez un jour de terrain futur dans un cycle complet du planning (${dateLisible(joursControle.debut)} au ${dateLisible(joursControle.fin)}).`
        );
      }
      const agent = await verifierUtilisateur(client, mission.agent_id, 'AGENT');
      if (!agent) {
        await client.query('ROLLBACK');
        return erreur(res, 400, 'Un Agent affecté est maintenant inactif ou ne possède plus le rôle AGENT.');
      }
    }
    for (const mission of missionsAbonneInactif) {
      await client.query(
        `UPDATE missions_controle
         SET statut = 'ANNULEE', updated_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND statut <> 'ANNULEE'`,
        [userId, mission.id]
      );
    }
    await client.query(
      `UPDATE campagnes_controle SET statut = 'PUBLIEE', updated_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [userId, campagneId]
    );
    for (const mission of missionsActives) {
      await client.query(
        `UPDATE missions_controle mc
         SET statut = 'PLANIFIEE', date_limite = mc.date_prevue,
             updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND statut = 'EN_ATTENTE'`,
        [mission.id, userId]
      );
      await notifierMissionAssignee(
        client,
        mission.id,
        `mission:v2:${mission.id}:publication:${campagneId}:${mission.agent_id}`
      );
    }
    await client.query('COMMIT');
    await logAudit({
      actorId: userId,
      actorRole: 'RESPONSABLE',
      action: 'CAMPAGNE_CONTROLE_PUBLIEE',
      resourceType: 'campagne_controle',
      resourceId: campagneId,
      details: {
        nombre_missions_publiees: missionsActives.length,
        nombre_missions_annulees_abonne_inactif: missionsAbonneInactif.length,
      },
    });
    const message = missionsAbonneInactif.length
      ? `Planning publié. ${missionsActives.length} mission${missionsActives.length > 1 ? 's ont été publiées et les Agents désignés notifiés' : ' a été publiée et l’Agent désigné notifié'} ; ${missionsAbonneInactif.length} mission${missionsAbonneInactif.length > 1 ? 's ont été annulées' : ' a été annulée'} car l’abonné n’est plus actif.`
      : 'Planning publié et Agents désignés notifiés.';
    return res.json({ status: 'success', message });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erreur publication d’une campagne :', error);
    return erreur(res, 500, 'Impossible de publier le planning.');
  } finally {
    client.release();
  }
}

/* =========================================================
   BILAN D'UNE CAMPAGNE
   Les indicateurs viennent uniquement des missions et des
   relevés réellement enregistrés : une mission prévue n'est
   pas une visite, une visite n'est pas une consommation
   vérifiée.
========================================================= */

const SQL_BILAN_CAMPAGNE = `
  SELECT
    COUNT(*) FILTER (WHERE mc.statut <> 'ANNULEE')::int AS missions_prevues,
    COUNT(DISTINCT mc.abonne_id) FILTER (WHERE mc.statut <> 'ANNULEE')::int AS abonnes_concernes,
    COUNT(DISTINCT mc.compteur_id) FILTER (WHERE mc.statut <> 'ANNULEE')::int AS compteurs_concernes,
    COUNT(*) FILTER (
      WHERE mc.statut IN ('TERMINEE', 'A_REPROGRAMMER')
        AND mc.date_visite_reelle IS NOT NULL
    )::int AS visites_realisees,
    COUNT(*) FILTER (
      WHERE mc.statut = 'TERMINEE'
        AND mc.date_visite_reelle IS NOT NULL
        AND c.id IS NOT NULL
        AND r.id IS NOT NULL
        AND r.nouvel_index IS NOT NULL
        AND r.nouvel_index >= 0
        AND r.consommation IS NOT NULL
        AND r.consommation >= 0
    )::int AS consommations_verifiees,
    COUNT(*) FILTER (WHERE mc.statut = 'A_REPROGRAMMER')::int AS suivis_a_completer,
    COUNT(*) FILTER (WHERE mc.statut IN ('EN_ATTENTE', 'PLANIFIEE', 'EN_COURS'))::int AS missions_restantes,
    COUNT(*) FILTER (WHERE mc.statut = 'TERMINEE')::int AS missions_terminees,
    COUNT(*) FILTER (WHERE mc.statut = 'ANNULEE')::int AS missions_annulees
  FROM missions_controle mc
  LEFT JOIN compteurs c ON c.id = mc.compteur_id AND c.abonne_id = mc.abonne_id
  LEFT JOIN releves r ON r.id = mc.releve_id AND r.compteur_id = mc.compteur_id
  WHERE mc.campagne_id = $1`;

async function cloturerCampagneControle(req, res) {
  const campagneId = idPositif(req.params.id);
  const userId = idPositif(req.user?.id);
  const confirmerSuivis = req.body?.confirmer_suivis === true;
  if (!campagneId || !userId) return erreur(res, 400, 'Identifiant de planning invalide.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const responsable = await verifierUtilisateur(client, userId, 'RESPONSABLE');
    if (!responsable) {
      await client.query('ROLLBACK');
      return erreur(res, 403, 'Accès réservé à un responsable actif.');
    }
    const campaignResult = await client.query(
      `SELECT id, mois::text AS mois, date_debut::text AS date_debut,
         date_fin::text AS date_fin, statut
       FROM campagnes_controle
       WHERE id = $1 AND created_by = $2
       FOR UPDATE`,
      [campagneId, userId]
    );
    const campagne = campaignResult.rows[0];
    if (!campagne) {
      await client.query('ROLLBACK');
      return erreur(res, 404, 'Planning introuvable.');
    }
    if (campagne.statut === 'CLOTUREE') {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Cette campagne est déjà clôturée.');
    }
    if (campagne.statut !== 'PUBLIEE') {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Seule une campagne publiée peut être clôturée.');
    }

    const bilanResult = await client.query(SQL_BILAN_CAMPAGNE, [campagneId]);
    const bilan = bilanResult.rows[0] || {};
    if (Number(bilan.missions_prevues || 0) === 0) {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Cette campagne ne contient aucune mission à clôturer.');
    }
    if (Number(bilan.missions_restantes || 0) > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'error',
        code: 'MISSIONS_RESTANTES',
        message: `${bilan.missions_restantes} mission${bilan.missions_restantes > 1 ? 's ne sont pas encore terminées' : ' n’est pas encore terminée'}. Une campagne ne peut pas être clôturée avant la fin des descentes prévues.`,
        bilan,
      });
    }
    if (Number(bilan.suivis_a_completer || 0) > 0 && !confirmerSuivis) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        status: 'error',
        code: 'SUIVIS_A_COMPLETER',
        message: `${bilan.suivis_a_completer} visite${bilan.suivis_a_completer > 1 ? 's ont été effectuées sans consommation vérifiable' : ' a été effectuée sans consommation vérifiable'}. Confirmez la clôture pour conserver ces dossiers en suivi, ou traitez-les avant de clôturer.`,
        bilan,
      });
    }

    await client.query(
      `UPDATE campagnes_controle
       SET statut = 'CLOTUREE', updated_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [userId, campagneId]
    );
    await client.query('COMMIT');
    await logAudit({
      actorId: userId,
      actorRole: 'RESPONSABLE',
      action: 'CAMPAGNE_CONTROLE_CLOTUREE',
      resourceType: 'campagne_controle',
      resourceId: campagneId,
      details: { ...bilan },
    });
    return res.json({
      status: 'success',
      message: `Campagne clôturée. ${bilan.visites_realisees} visite${Number(bilan.visites_realisees) > 1 ? 's' : ''} réalisée${Number(bilan.visites_realisees) > 1 ? 's' : ''}, ${bilan.consommations_verifiees} consommation${Number(bilan.consommations_verifiees) > 1 ? 's vérifiées' : ' vérifiée'}, ${bilan.suivis_a_completer} suivi${Number(bilan.suivis_a_completer) > 1 ? 's à compléter' : ' à compléter'}.`,
      bilan,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erreur clôture d’une campagne :', error);
    return erreur(res, 500, 'Impossible de clôturer cette campagne.');
  } finally {
    client.release();
  }
}

async function modifierMissionControle(req, res) {
  const missionId = idPositif(req.params.id);
  const userId = idPositif(req.user?.id);
  if (!missionId || !userId) return erreur(res, 400, 'Identifiant de mission invalide.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const responsable = await verifierUtilisateur(client, userId, 'RESPONSABLE');
    if (!responsable) {
      await client.query('ROLLBACK');
      return erreur(res, 403, 'Accès réservé à un responsable actif.');
    }
    const result = await client.query(
      `SELECT mc.*, cc.date_debut, cc.date_fin, cc.statut AS statut_campagne,
         a.statut AS statut_abonne
       FROM missions_controle mc
       INNER JOIN campagnes_controle cc ON cc.id = mc.campagne_id
       INNER JOIN abonnes a ON a.id = mc.abonne_id
       WHERE mc.id = $1 AND cc.created_by = $2 FOR UPDATE OF mc`,
      [missionId, userId]
    );
    const current = result.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return erreur(res, 404, 'Mission introuvable dans votre périmètre.');
    }
    if (!['BROUILLON', 'PUBLIEE'].includes(current.statut_campagne)) {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Le planning est clôturé ou annulé.');
    }
    if (['TERMINEE', 'ANNULEE'].includes(current.statut)) {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Une mission terminée ou annulée ne peut plus être modifiée.');
    }
    if (String(current.statut_abonne || '').trim().toLowerCase() !== 'actif') {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Cette mission ne peut pas être modifiée car l’abonné n’est plus actif.');
    }
    const agentId = req.body?.agent_id === undefined ? current.agent_id : (req.body.agent_id ? idPositif(req.body.agent_id) : null);
    const datePrevue = req.body?.date_prevue === undefined ? (current.date_prevue ? dateSeule(current.date_prevue) : null) : (req.body.date_prevue || null);
    const newStatus = req.body?.statut === undefined ? current.statut : String(req.body.statut).toUpperCase();
    const agentOuDateModifie = String(current.agent_id || '') !== String(agentId || '')
      || dateSeule(current.date_prevue) !== String(datePrevue || '')
      || (current.statut === 'A_REPROGRAMMER' && newStatus === 'PLANIFIEE');
    const suiviPeriodique = req.body?.suivi_periodique === undefined
      ? Boolean(current.suivi_periodique)
      : req.body.suivi_periodique === true;
    const observations = req.body?.observations === undefined
      ? (current.observations || '')
      : (typeof req.body.observations === 'string' ? req.body.observations.trim() : '');
    if (observations.length > 1000) {
      await client.query('ROLLBACK');
      return erreur(res, 400, 'Les consignes sont limitees a 1 000 caracteres.');
    }
    if (req.body?.agent_id && !agentId) {
      await client.query('ROLLBACK');
      return erreur(res, 400, 'Identifiant Agent invalide.');
    }
    const joursControle = bornesJoursControle(current.date_debut, current.date_fin);
    if (datePrevue && (
      !joursControle.valides ||
      !estJourTerrain(datePrevue, current.date_debut, current.date_fin)
    )) {
      await client.query('ROLLBACK');
      return erreur(
        res,
        400,
        joursControle.valides
          ? `La date prévue doit correspondre à un jour de contrôle (du ${dateLisible(joursControle.debut)} au ${dateLisible(joursControle.fin)}).`
          : 'Aucune date de contrôle n’est disponible dans la période du planning.'
      );
    }
    if (
      current.statut_campagne === 'PUBLIEE' &&
      agentOuDateModifie &&
      newStatus !== 'ANNULEE' &&
      (!datePrevue || datePrevue < dateDuJourJirama())
    ) {
      await client.query('ROLLBACK');
      return erreur(
        res,
        400,
        `La date prévue doit être aujourd’hui ou ultérieure et correspondre à un jour terrain d’un cycle complet du planning.`
      );
    }
    if (!STATUTS_MISSION.has(newStatus) || newStatus === 'TERMINEE') {
      await client.query('ROLLBACK');
      return erreur(res, 400, 'Statut de mission non autorisé pour cette opération.');
    }
    if (current.statut_campagne === 'PUBLIEE' && newStatus === 'EN_ATTENTE') {
      await client.query('ROLLBACK');
      return erreur(res, 400, 'Une mission publiée doit rester planifiée, en cours, à reprogrammer ou être annulée.');
    }
    if (newStatus === 'PLANIFIEE' && (!agentId || !datePrevue)) {
      await client.query('ROLLBACK');
      return erreur(res, 400, 'Une mission planifiée doit avoir un Agent et une date.');
    }
    if (current.statut_campagne === 'PUBLIEE' && ['EN_COURS', 'A_REPROGRAMMER'].includes(newStatus) && (!agentId || !datePrevue)) {
      await client.query('ROLLBACK');
      return erreur(res, 400, 'Cette mission publiée doit conserver un Agent et une date prévue.');
    }
    const affectationAAnnoncer = agentOuDateModifie
      || (!current.date_limite && current.statut_campagne === 'PUBLIEE');
    const dateLimite = current.statut_campagne === 'PUBLIEE'
      ? datePrevue
      : (current.date_limite ? dateSeule(current.date_limite) : null);
    if (current.statut_campagne === 'PUBLIEE' && newStatus !== 'ANNULEE') {
      const today = dateDuJourJirama();
      if (!datePrevue || !dateValide(datePrevue) || datePrevue < today) {
        await client.query('ROLLBACK');
        return erreur(res, 400, 'La date prévue doit être aujourd’hui ou ultérieure.');
      }
    }
    const changed = agentOuDateModifie
      || current.statut !== newStatus
      || Boolean(current.suivi_periodique) !== suiviPeriodique
      || String(current.observations || '') !== observations
      || (!current.date_limite && current.statut_campagne === 'PUBLIEE');
    if (!changed) {
      await client.query('COMMIT');
      return res.json({ status: 'success', message: 'Aucune modification à enregistrer.' });
    }
    if (agentId) {
      const agent = await verifierUtilisateur(client, agentId, 'AGENT');
      if (!agent) {
        await client.query('ROLLBACK');
        return erreur(res, 400, 'L’Agent choisi n’existe pas, est inactif ou ne possède pas le rôle AGENT.');
      }
    }
    if (datePrevue && newStatus !== 'ANNULEE') {
      const conflict = await client.query(
        `SELECT id FROM missions_controle WHERE compteur_id = $1 AND id <> $2
         AND date_prevue = $3 AND statut <> 'ANNULEE' AND NOT nouvelle_visite LIMIT 1`,
        [current.compteur_id, missionId, datePrevue]
      );
      if (conflict.rowCount && !current.nouvelle_visite) {
        await client.query('ROLLBACK');
        return erreur(res, 409, 'Un contrôle de ce compteur est déjà prévu à cette date.');
      }
    }
    const oldAgent = current.agent_id ? await verifierUtilisateur(client, current.agent_id, 'AGENT') : null;
    const versionAffectation = Number(current.version_affectation || 0) + (affectationAAnnoncer ? 1 : 0);
    await client.query(
      `UPDATE missions_controle
       SET agent_id = $1, date_prevue = $2, statut = $3, date_limite = $4,
           suivi_periodique = $5, observations = $6, version_affectation = $7,
           updated_by = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9`,
      [agentId, datePrevue, newStatus, dateLimite, suiviPeriodique, observations || null, versionAffectation, userId, missionId]
    );
    if (oldAgent?.email && String(current.agent_id) !== String(agentId)) {
      await creerNotification(
        client,
        oldAgent.email,
        'Affectation de contrôle modifiée',
        `La mission #${missionId} ne vous est plus attribuée.`,
        `mission:v2:${missionId}:retire:${versionAffectation}:${current.agent_id}`
      );
    }
    if (agentId && newStatus === 'ANNULEE') {
      const agent = await verifierUtilisateur(client, agentId, 'AGENT');
      await creerNotification(
        client,
        agent?.email,
        'Contrôle annulé',
        `La mission #${missionId} a été annulée par le Responsable.`,
        `mission:v2:${missionId}:annulation:${versionAffectation}`
      );
    } else if (agentId && affectationAAnnoncer) {
      await notifierMissionAssignee(
        client,
        missionId,
        `mission:v2:${missionId}:affectation:${versionAffectation}:${agentId}`
      );
    }
    await client.query('COMMIT');
    await logAudit({ actorId: userId, actorRole: 'RESPONSABLE', action: 'MISSION_CONTROLE_MODIFIEE', resourceType: 'mission_controle', resourceId: missionId, details: { ancien_agent_id: current.agent_id, nouvel_agent_id: agentId, ancienne_date: current.date_prevue, nouvelle_date: datePrevue, ancien_statut: current.statut, nouveau_statut: newStatus } });
    return res.json({ status: 'success', message: 'Mission mise à jour.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erreur modification de mission :', error);
    if (error.code === '42703' || error.code === '42P01') {
      return erreur(
        res,
        500,
        'Le schéma de la base de données est incomplet. Appliquez les migrations sql/009_planning_controles.sql et sql/011_missions_controle_echeances.sql.'
      );
    }
    return erreur(res, 500, 'Impossible de modifier cette mission.');
  } finally {
    client.release();
  }
}

async function getMissionsAgent(req, res) {
  try {
    const user = await verifierUtilisateur(pool, idPositif(req.user?.id), 'AGENT');
    if (!user) return erreur(res, 403, 'Accès réservé à un Agent actif.');
    const result = await pool.query(
      `SELECT mc.id, mc.campagne_id, mc.abonne_id, mc.compteur_id,
         mc.date_prevue::text AS date_prevue,
         mc.date_limite::text AS date_limite,
         mc.date_visite_reelle::text AS date_visite_reelle,
         mc.suivi_periodique, mc.observations,
         mc.statut, mc.priorite, mc.nouvelle_visite, mc.motif_reprogrammation,
         mc.releve_id, mc.resultat_visite,
         cc.date_debut::text AS date_debut, cc.date_fin::text AS date_fin, cc.statut AS statut_campagne,
         a.numero_abonne, a.nom AS abonne_nom, a.prenom AS abonne_prenom,
         a.statut AS statut_abonne,
         a.adresse, a.quartier, a.commune, a.latitude, a.longitude,
         c.numero_compteur, c.type AS type_compteur,
         r.date_releve::text AS date_releve_realisee,
         r.type_releve AS type_releve,
         r.nouvel_index AS index_releve,
         r.consommation AS consommation_releve,
         COALESCE(
           c.abonne_id = mc.abonne_id
             AND r.id IS NOT NULL
             AND r.nouvel_index IS NOT NULL
             AND r.nouvel_index >= 0
             AND r.consommation IS NOT NULL
             AND r.consommation >= 0,
           FALSE
         ) AS releve_exploitable,
         precedent.date_releve::text AS dernier_releve,
         precedent.nouvel_index AS dernier_index
       FROM missions_controle mc
       INNER JOIN campagnes_controle cc ON cc.id = mc.campagne_id
       INNER JOIN abonnes a ON a.id = mc.abonne_id
       INNER JOIN compteurs c ON c.id = mc.compteur_id
       LEFT JOIN releves r ON r.id = mc.releve_id AND r.compteur_id = mc.compteur_id
       LEFT JOIN LATERAL (
         /* Le premier relevé d’un compteur (INITIAL, sans consommation) sert
            de référence aux relevés suivants : il ne doit pas être ignoré
            sous prétexte qu’aucune consommation n’a été calculée. */
         SELECT r_precedent.date_releve, r_precedent.nouvel_index
         FROM releves r_precedent
         WHERE r_precedent.compteur_id = mc.compteur_id
           AND r_precedent.id IS DISTINCT FROM mc.releve_id
           AND r_precedent.nouvel_index IS NOT NULL
           AND r_precedent.nouvel_index >= 0
         ORDER BY r_precedent.date_releve DESC, r_precedent.id DESC
         LIMIT 1
       ) precedent ON TRUE
       WHERE mc.agent_id = $1 AND cc.statut IN ('PUBLIEE', 'CLOTUREE')
       AND mc.statut <> 'ANNULEE'
       ORDER BY mc.date_prevue NULLS LAST, mc.id`,
      [user.id]
    );
    return res.json({ status: 'success', data: result.rows });
  } catch (error) {
    console.error('Erreur chargement des missions Agent :', error);
    return erreur(res, 500, 'Impossible de charger vos missions attribuées.');
  }
}

async function getMissionAgent(req, res) {
  const missionId = idPositif(req.params.id);
  if (!missionId) return erreur(res, 400, 'Identifiant de mission invalide.');
  try {
    const user = await verifierUtilisateur(pool, idPositif(req.user?.id), 'AGENT');
    if (!user) return erreur(res, 403, 'Accès réservé à un Agent actif.');
    const result = await pool.query(
      `SELECT mc.id, mc.campagne_id, mc.abonne_id, mc.compteur_id, mc.agent_id,
         mc.date_prevue::text AS date_prevue,
         mc.date_limite::text AS date_limite,
         mc.date_visite_reelle::text AS date_visite_reelle,
         mc.suivi_periodique, mc.observations, mc.statut, mc.priorite, mc.motif_reprogrammation,
         mc.releve_id, mc.resultat_visite,
         cc.date_debut::text AS date_debut, cc.date_fin::text AS date_fin, cc.statut AS statut_campagne,
         a.numero_abonne, a.nom AS abonne_nom, a.prenom AS abonne_prenom,
         a.statut AS statut_abonne,
         a.adresse, a.quartier, a.commune, a.latitude, a.longitude,
         c.numero_compteur, c.type AS type_compteur,
         r.date_releve::text AS date_releve_realisee,
         r.type_releve AS type_releve,
         r.nouvel_index AS index_releve,
         r.consommation AS consommation_releve,
         COALESCE(
           c.abonne_id = mc.abonne_id
             AND r.id IS NOT NULL
             AND r.nouvel_index IS NOT NULL
             AND r.nouvel_index >= 0
             AND r.consommation IS NOT NULL
             AND r.consommation >= 0,
           FALSE
         ) AS releve_exploitable,
         precedent.date_releve::text AS dernier_releve,
         precedent.nouvel_index AS dernier_index
       FROM missions_controle mc
       INNER JOIN campagnes_controle cc ON cc.id = mc.campagne_id
       INNER JOIN abonnes a ON a.id = mc.abonne_id
       INNER JOIN compteurs c ON c.id = mc.compteur_id
       LEFT JOIN releves r ON r.id = mc.releve_id AND r.compteur_id = mc.compteur_id
       LEFT JOIN LATERAL (
         /* Le premier relevé d’un compteur (INITIAL, sans consommation) sert
            de référence aux relevés suivants : il ne doit pas être ignoré
            sous prétexte qu’aucune consommation n’a été calculée. */
         SELECT r_precedent.date_releve, r_precedent.nouvel_index
         FROM releves r_precedent
         WHERE r_precedent.compteur_id = mc.compteur_id
           AND r_precedent.id IS DISTINCT FROM mc.releve_id
           AND r_precedent.nouvel_index IS NOT NULL
           AND r_precedent.nouvel_index >= 0
         ORDER BY r_precedent.date_releve DESC, r_precedent.id DESC
         LIMIT 1
       ) precedent ON TRUE
       WHERE mc.id = $1 AND mc.agent_id = $2 AND cc.statut IN ('PUBLIEE', 'CLOTUREE')
         AND mc.statut <> 'ANNULEE'`,
      [missionId, user.id]
    );
    if (!result.rowCount) return erreur(res, 404, 'Mission introuvable dans vos contrôles attribués.');
    return res.json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur lecture de mission Agent :', error);
    return erreur(res, 500, 'Impossible de charger cette mission.');
  }
}

async function modifierStatutMissionAgent(req, res) {
  const missionId = idPositif(req.params.id);
  const userId = idPositif(req.user?.id);
  const statut = String(req.body?.statut || '').toUpperCase();
  const motif = String(req.body?.motif || '').trim();
  const dateVisiteDemandee = req.body?.date_visite_reelle;
  const resultatDemande = req.body?.resultat_visite === undefined || req.body?.resultat_visite === null
    ? null
    : String(req.body.resultat_visite).toUpperCase();
  const resultatVisite = RESULTATS_VISITE.has(resultatDemande) ? resultatDemande : 'AUTRE';
  if (!missionId || !userId || !['EN_COURS', 'A_REPROGRAMMER'].includes(statut)) {
    return erreur(res, 400, 'Statut de mission invalide.');
  }
  if (statut === 'A_REPROGRAMMER' && motif.length < 3) {
    return erreur(res, 400, 'Indiquez le motif de la nouvelle visite.');
  }
  if (
    statut === 'A_REPROGRAMMER' &&
    (!dateValide(dateVisiteDemandee) || dateVisiteDemandee > dateDuJourJirama())
  ) {
    return erreur(res, 400, 'Renseignez une date réelle de visite valide, qui ne peut pas être future.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const agent = await verifierUtilisateur(client, userId, 'AGENT');
    if (!agent) {
      await client.query('ROLLBACK');
      return erreur(res, 403, 'Accès réservé à un Agent actif.');
    }
    const result = await client.query(
      `SELECT mc.id, mc.statut, mc.campagne_id, mc.abonne_id,
         mc.date_prevue, mc.date_visite_reelle, mc.observations,
         cc.created_by, u.email AS responsable_email, a.statut AS statut_abonne,
         a.numero_abonne, a.nom AS abonne_nom, a.prenom AS abonne_prenom,
         a.quartier, a.commune, a.adresse,
         c.numero_compteur, c.type AS type_compteur
       FROM missions_controle mc
       INNER JOIN campagnes_controle cc ON cc.id = mc.campagne_id
       INNER JOIN abonnes a ON a.id = mc.abonne_id
       INNER JOIN compteurs c ON c.id = mc.compteur_id
       LEFT JOIN users u ON u.id = cc.created_by
       WHERE mc.id = $1 AND mc.agent_id = $2 AND cc.statut = 'PUBLIEE'
       FOR UPDATE OF mc`,
      [missionId, userId]
    );
    const mission = result.rows[0];
    if (!mission) {
      await client.query('ROLLBACK');
      return erreur(res, 404, 'Mission introuvable dans vos contrôles attribués.');
    }
    if (String(mission.statut_abonne || '').trim().toLowerCase() !== 'actif') {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Cette mission ne peut plus être modifiée car l’abonné n’est plus actif.');
    }
    if (!['PLANIFIEE', 'EN_COURS'].includes(mission.statut)) {
      await client.query('ROLLBACK');
      return erreur(res, 409, 'Cette mission ne peut plus changer de statut.');
    }
    const changedMission = await client.query(
      `UPDATE missions_controle SET statut = $1::varchar, motif_reprogrammation = $2,
       resultat_visite = CASE WHEN $1::text = 'A_REPROGRAMMER' THEN $5::varchar ELSE resultat_visite END,
       date_visite_reelle = CASE WHEN $1::text = 'A_REPROGRAMMER' THEN $6::date
                                 ELSE date_visite_reelle END,
       updated_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4
       RETURNING updated_at, date_visite_reelle::text AS date_visite_reelle`,
      [
        statut,
        statut === 'A_REPROGRAMMER' ? motif.slice(0, 1000) : null,
        userId,
        missionId,
        statut === 'A_REPROGRAMMER' ? resultatVisite : null,
        statut === 'A_REPROGRAMMER' ? dateVisiteDemandee : null,
      ]
    );
    const dateVisite = changedMission.rows[0]?.date_visite_reelle || null;
    if (statut === 'A_REPROGRAMMER') {
      /* Notification opérationnelle : motif réellement transmis par
         l’Agent, destinataires Responsable + Administrateur, dédupliquée
         par mission, date de visite et date prévue. */
      await notifierMissionImpossible(client, missionId, {
        motif,
        resultatVisite,
        dateVisite,
      });
    }
    await client.query('COMMIT');
    await logAudit({ actorId: userId, actorRole: 'AGENT', action: statut === 'EN_COURS' ? 'MISSION_CONTROLE_DEMARREE' : 'MISSION_CONTROLE_RESULTAT_VISITE', resourceType: 'mission_controle', resourceId: missionId,     details: { motif: statut === 'A_REPROGRAMMER' ? motif.slice(0, 500) : undefined, resultat_visite: statut === 'A_REPROGRAMMER' ? resultatVisite : undefined, date_visite_reelle: dateSeule(dateVisite) || null } });
    return res.json({
      status: 'success',
      message: statut === 'EN_COURS'
        ? 'Contrôle démarré.'
        : 'Votre intervention a été enregistrée et transmise au Responsable.',
      resultat_visite: statut === 'A_REPROGRAMMER' ? resultatVisite : null,
      date_visite_reelle: dateSeule(dateVisite),
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erreur modification de statut mission :', error);
    return erreur(res, 500, 'Impossible de mettre à jour la mission.');
  } finally {
    client.release();
  }
}

/* =========================================================
   RAPPELS SERVEUR DES CONTRÔLES
   ---------------------------------------------------------
   Deux mécanismes complémentaires, chacun dédoublonné par
   evenement_cle afin qu’une actualisation de page ne puisse
   pas créer de rappel supplémentaire :
   1. Un briefing groupé par Agent et par journée de terrain
      (Jour 2 ou Jour 3 du cycle) : un seul message par Agent
      et par date prévue, avec les quartiers, le nombre de
      missions réellement enregistrées et les dates du cycle.
   2. Une alerte au Responsable pour chaque mission dont la
      date prévue est dépassée sans visite réellement
      enregistrée.
========================================================= */

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

async function notifierBriefingsJourControles() {
  const today = dateDuJourJirama();
  const result = await pool.query(
    `SELECT agent.id AS agent_id, agent.email, agent.nom, agent.prenom,
       agent.identifiant, mc.date_prevue::text AS date_prevue,
       cc.date_debut::text AS date_debut,
       COUNT(*)::int AS nombre_missions,
       COUNT(*) FILTER (WHERE mc.statut = 'EN_COURS')::int AS missions_en_cours,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT NULLIF(TRIM(a.quartier), '')), NULL) AS quartiers
     FROM missions_controle mc
     INNER JOIN campagnes_controle cc ON cc.id = mc.campagne_id AND cc.statut = 'PUBLIEE'
     INNER JOIN abonnes a ON a.id = mc.abonne_id
     INNER JOIN users agent ON agent.id = mc.agent_id
     WHERE mc.date_prevue = $1::date
       AND mc.statut IN ('PLANIFIEE', 'EN_COURS')
       AND LOWER(TRIM(a.statut)) = 'actif'
       AND UPPER(TRIM(agent.role)) = 'AGENT'
       AND LOWER(TRIM(agent.statut)) = 'actif'
       AND COALESCE(TRIM(agent.email), '') <> ''
     GROUP BY agent.id, agent.email, agent.nom, agent.prenom, agent.identifiant,
       mc.date_prevue, cc.date_debut
     ORDER BY agent.id`,
    [today]
  );

  let crees = 0;
  for (const ligne of result.rows) {
    const jour = jourDuCycle(ligne.date_prevue, ligne.date_debut);
    if (jour !== 2 && jour !== 3) continue;
    const quartiers = (ligne.quartiers || []).filter(Boolean);
    const quartiersTexte = quartiers.length ? quartiers.join(', ') : 'quartier non renseigné';
    const debutCycle = ajouterJours(ligne.date_prevue, -(jour - 1));
    const jour2 = ajouterJours(debutCycle, 1);
    const jour3 = ajouterJours(debutCycle, 2);
    const nombre = Number(ligne.nombre_missions || 0);
    const enCours = Number(ligne.missions_en_cours || 0);
    const agentNom = `${ligne.prenom || ''} ${ligne.nom || ''}`.trim()
      || ligne.identifiant
      || `Agent #${ligne.agent_id}`;
    const sujet = jour === 2
      ? 'Rappel de contrôle — Jour 2, première descente'
      : 'Rappel de contrôle — Jour 3, deuxième descente';
    const message = [
      jour === 2
        ? `Rappel de contrôle du ${dateLisible(jour2)} : l’Agent ${agentNom} doit effectuer aujourd’hui les visites des abonnés qui lui ont été affectés dans le quartier ${quartiersTexte}.`
        : `Deuxième journée de contrôle du ${dateLisible(jour3)} : l’Agent ${agentNom} poursuit aujourd’hui les visites des abonnés restant à contrôler dans le quartier ${quartiersTexte}.`,
      `${nombre} mission${nombre > 1 ? 's sont prévues' : ' est prévue'} ce jour${enCours > 0 ? ` (${enCours} déjà démarrée${enCours > 1 ? 's' : ''})` : ''}.`,
      `Cycle du planning : préparation le ${dateLisible(debutCycle)}, première descente le ${dateLisible(jour2)}, deuxième descente et transmission le ${dateLisible(jour3)}.`,
      'Consultez la liste de vos abonnés et compteurs à contrôler dans votre espace Missions, puis saisissez les relevés réels des compteurs visités : /dashboard/agent/missions',
    ].join(' ');
    const envoye = await creerNotification(
      pool,
      ligne.email,
      sujet,
      message,
      `mission:v2:briefing:${ligne.date_prevue}:${ligne.agent_id}`
    );
    if (envoye) crees += 1;
  }
  return crees;
}

/* Missions non réalisées / résultats non transmis après l’échéance de
   la journée prévue : le service cible le Responsable de la campagne et
   les Administrateurs actifs, avec un evenement_cle par mission, journée
   et date prévue, donc sans doublon à chaque passage du planificateur. */
async function notifierMissionsControlesDuJour() {
  return notifierMissionsEnAttente(pool);
}

/* Enregistrement de la position GPS d'un abonné depuis le planning.
   L'Administrateur reste le gestionnaire de la fiche abonné ; le
   Responsable ne peut ici que poser les coordonnées d'un abonné qui
   figure réellement dans l'un de ses plannings. Aucune position n'est
   déduite de l'adresse : latitude et longitude doivent être fournies
   ensemble, après sélection (recherche ou clic sur la carte). */
async function enregistrerLocalisationAbonneControle(req, res) {
  const userId = idPositif(req.user?.id);
  const abonneId = idPositif(req.params.id);
  if (!userId) return erreur(res, 401, 'Utilisateur non authentifié.');
  if (!abonneId) return erreur(res, 400, 'Identifiant abonné invalide.');

  const corps = req.body || {};
  if (
    !Object.prototype.hasOwnProperty.call(corps, 'latitude') ||
    !Object.prototype.hasOwnProperty.call(corps, 'longitude')
  ) {
    return erreur(res, 400, 'Indiquez la latitude et la longitude de la position sélectionnée.');
  }
  const latBrute = corps.latitude;
  const lonBrute = corps.longitude;
  const latVide = latBrute === undefined || latBrute === null || String(latBrute).trim() === '';
  const lonVide = lonBrute === undefined || lonBrute === null || String(lonBrute).trim() === '';
  if (latVide !== lonVide) {
    return erreur(res, 400, 'Renseignez la latitude et la longitude ensemble.');
  }

  let latitude = null;
  let longitude = null;
  if (!latVide) {
    latitude = Number(latBrute);
    longitude = Number(lonBrute);
    if (
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    ) {
      return erreur(res, 400, 'Coordonnées GPS invalides (latitude −90 à 90, longitude −180 à 180).');
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await verifierUtilisateur(client, userId, 'RESPONSABLE');
    if (!user) {
      await client.query('ROLLBACK');
      return erreur(res, 403, 'Accès réservé à un responsable actif.');
    }

    /* Le Responsable peut localiser tout abonné non supprimé : la position
       sert à la préparation des missions avant même qu'elles existent. */
    const abonneResult = await client.query(
      `SELECT a.id, a.statut
       FROM abonnes a
       WHERE a.id = $1 AND LOWER(TRIM(a.statut)) <> 'supprime'
       FOR UPDATE OF a`,
      [abonneId]
    );
    if (!abonneResult.rows.length) {
      await client.query('ROLLBACK');
      return erreur(res, 404, 'Abonné introuvable ou supprimé.');
    }

    const ancienne = await client.query(
      'SELECT latitude, longitude FROM abonnes WHERE id = $1',
      [abonneId]
    );

    const result = await client.query(
      `UPDATE abonnes
       SET latitude = $2, longitude = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, latitude, longitude, updated_at`,
      [abonneId, latitude, longitude]
    );

    await client.query('COMMIT');

    await logAudit({
      actorId: userId,
      actorRole: 'RESPONSABLE',
      action: 'ABONNE_LOCALISATION_MODIFIEE',
      resourceType: 'abonne',
      resourceId: abonneId,
      details: {
        latitude_avant: ancienne.rows[0]?.latitude ?? null,
        longitude_avant: ancienne.rows[0]?.longitude ?? null,
        latitude_apres: latitude,
        longitude_apres: longitude,
      },
    });

    return res.json({
      status: 'success',
      message: latitude === null
        ? 'Position GPS effacée pour cet abonné.'
        : 'Position GPS enregistrée pour cet abonné.',
      data: result.rows[0],
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* transaction déjà fermée */ }
    console.error('Erreur enregistrement localisation abonné (planning) :', error);
    return erreur(res, 500, 'Impossible d’enregistrer la position GPS de l’abonné.');
  } finally {
    client.release();
  }
}

function programmerRappelsControles() {
  let enCours = false;
  const verifier = async () => {
    if (enCours) return;
    enCours = true;
    try {
      const briefings = await notifierBriefingsJourControles();
      if (briefings > 0) console.log(`${briefings} briefing(s) de journée de contrôle créé(s).`);
      const retards = await notifierMissionsControlesDuJour();
      if (retards > 0) console.log(`${retards} alerte(s) de mission non réalisée créée(s).`);
    } catch (error) {
      console.error('Rappels de contrôles indisponibles :', error.message || error);
    } finally {
      enCours = false;
    }
  };
  const timer = setInterval(verifier, 30 * 60 * 1000);
  timer.unref?.();
  verifier();
  return timer;
}

module.exports = {
  getAgentsControle,
  getCiblesControle,
  getCampagnesControle,
  creerCampagneControle,
  modifierDatesCampagneControle,
  enregistrerAffectationsControle,
  ajouterMissionsControle,
  publierCampagneControle,
  cloturerCampagneControle,
  modifierMissionControle,
  getMissionsAgent,
  getMissionAgent,
  modifierStatutMissionAgent,
  enregistrerLocalisationAbonneControle,
  notifierMissionsControlesDuJour,
  notifierBriefingsJourControles,
  jourDuCycle,
  programmerRappelsControles,
  creerNotification,
  notifierMissionAssignee,
};
