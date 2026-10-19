-- JIRAMA — Migration 002 : notifications persistantes et destinataires ciblés
-- À exécuter UNE FOIS depuis la racine jirama-L3 :
--   psql -U <utilisateur> -d <base> -v ON_ERROR_STOP=1 -f sql/002_notifications_persistence.sql
--
-- Cette migration conserve les notifications supprimées en base via masquee_le.
-- Elle ne supprime pas les relevés ni les anomalies.
-- Elle retargete les anciennes lignes destinataire='AGENT' vers l’auteur du relevé
-- lorsque cette correspondance existe ; les lignes sans auteur identifiable sont masquées.

BEGIN;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS masquee_le TIMESTAMP NULL;

-- Harmoniser les anciennes alertes d’anomalie pour le frontend.
UPDATE notifications
SET type = 'ALERTE_ANOMALIE'
WHERE anomalie_id IS NOT NULL
  AND UPPER(TRIM(type)) = 'ANOMALIE';

-- Les anciennes notifications destinées globalement à 'AGENT' sont ciblées vers
-- l’Agent auteur du relevé source, quand le lien est disponible et non ambigu.
WITH candidates AS (
  SELECT
    n.id AS notification_id,
    n.anomalie_id,
    LOWER(TRIM(u.email)) AS email_cible,
    ROW_NUMBER() OVER (
      PARTITION BY n.anomalie_id, LOWER(TRIM(u.email))
      ORDER BY n.id
    ) AS rang
  FROM notifications n
  INNER JOIN anomalies a ON a.id = n.anomalie_id
  INNER JOIN releves r ON r.id = a.releve_id
  INNER JOIN users u ON u.id = r.created_by
  WHERE UPPER(TRIM(n.destinataire)) = 'AGENT'
    AND n.anomalie_id IS NOT NULL
    AND UPPER(TRIM(u.role)) = 'AGENT'
    AND u.email IS NOT NULL
    AND TRIM(u.email) <> ''
), retarget AS (
  SELECT c.notification_id, c.anomalie_id, c.email_cible
  FROM candidates c
  WHERE c.rang = 1
    AND NOT EXISTS (
      SELECT 1
      FROM notifications existing
      WHERE existing.anomalie_id = c.anomalie_id
        AND LOWER(TRIM(existing.destinataire)) = c.email_cible
        AND existing.id <> c.notification_id
    )
)
UPDATE notifications n
SET destinataire = r.email_cible,
    masquee_le = NULL
FROM retarget r
WHERE n.id = r.notification_id;

-- Aucune notification globale non attribuable ne doit rester visible aux Agents.
UPDATE notifications
SET masquee_le = COALESCE(masquee_le, CURRENT_TIMESTAMP)
WHERE UPPER(TRIM(destinataire)) = 'AGENT'
  AND masquee_le IS NULL;

-- Conserver les doublons à titre d’historique, mais masquer les copies excédentaires.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY anomalie_id, LOWER(TRIM(destinataire))
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rang
  FROM notifications
  WHERE anomalie_id IS NOT NULL
    AND masquee_le IS NULL
)
UPDATE notifications n
SET masquee_le = CURRENT_TIMESTAMP
FROM ranked r
WHERE n.id = r.id
  AND r.rang > 1;

-- Index rapide pour ne lister que les notifications visibles.
CREATE INDEX IF NOT EXISTS idx_notifications_visibles
  ON notifications (LOWER(TRIM(destinataire)))
  WHERE masquee_le IS NULL;

-- Recréer l’index idempotent en excluant les lignes masquées.
-- Les doublons historiques restent conservés mais masqués au-dessus.
DROP INDEX IF EXISTS uq_notifications_anomalie_destinataire;
CREATE UNIQUE INDEX uq_notifications_anomalie_destinataire
  ON notifications (anomalie_id, (LOWER(TRIM(destinataire))))
  WHERE anomalie_id IS NOT NULL AND masquee_le IS NULL;

COMMIT;
