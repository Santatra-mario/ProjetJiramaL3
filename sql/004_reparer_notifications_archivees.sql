-- JIRAMA — Migration 004 : réparer les destinataires historiques des notifications
-- À exécuter UNE FOIS depuis la racine jirama-L3, après les migrations 001, 002 et 003.
-- Cette migration :
--   1) garantit l'existence des colonnes d'archivage et de masquage ;
--   2) convertit les anciennes notifications adressées à un rôle (ADMINISTRATEUR,
--      RESPONSABLE, AGENT) en notifications personnelles adressées par e-mail ;
--   3) conserve l'état d'archivage et de lecture ;
--   4) masque les anciennes lignes génériques afin qu'elles ne soient plus exposées.
-- Elle ne supprime ni les relevés ni les anomalies.

BEGIN;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS archive_le TIMESTAMP NULL;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS masquee_le TIMESTAMP NULL;

-- Si une copie personnelle existe déjà, conserver l'archivage de la ligne historique
-- lorsqu'elle était archivée. Les copies déjà lues ne sont pas remises à EN_ATTENTE.
WITH legacy AS (
  SELECT n.*
  FROM notifications n
  WHERE UPPER(TRIM(n.destinataire)) IN ('ADMINISTRATEUR', 'RESPONSABLE', 'AGENT')
    AND n.masquee_le IS NULL
), mapped AS (
  SELECT
    l.id AS legacy_id,
    l.anomalie_id,
    l.archive_le,
    LOWER(TRIM(u.email)) AS email_cible
  FROM legacy l
  JOIN users u
    ON UPPER(TRIM(u.role)) = UPPER(TRIM(l.destinataire))
   AND u.email IS NOT NULL
   AND TRIM(u.email) <> ''
  WHERE UPPER(TRIM(l.destinataire)) IN ('ADMINISTRATEUR', 'RESPONSABLE')
)
UPDATE notifications personal
SET archive_le = COALESCE(personal.archive_le, mapped.archive_le)
FROM mapped
WHERE mapped.archive_le IS NOT NULL
  AND personal.id <> mapped.legacy_id
  AND LOWER(TRIM(personal.destinataire)) = mapped.email_cible
  AND personal.masquee_le IS NULL
  AND (
    (mapped.anomalie_id IS NOT NULL AND personal.anomalie_id = mapped.anomalie_id)
    OR (mapped.anomalie_id IS NULL AND personal.anomalie_id IS NULL)
  );

-- Les anciennes notifications générales d'ADMINISTRATEUR/RESPONSABLE sont clonées
-- pour chaque compte du rôle correspondant. Les doublons personnalisés existants
-- sont conservés et ne sont pas recréés.
INSERT INTO notifications (
  type,
  destinataire,
  sujet,
  message,
  date_envoi,
  statut,
  anomalie_id,
  created_at,
  archive_le,
  masquee_le
)
SELECT
  n.type,
  LOWER(TRIM(u.email)),
  n.sujet,
  n.message,
  n.date_envoi,
  n.statut,
  n.anomalie_id,
  n.created_at,
  n.archive_le,
  NULL
FROM notifications n
JOIN users u
  ON UPPER(TRIM(u.role)) = UPPER(TRIM(n.destinataire))
 AND u.email IS NOT NULL
 AND TRIM(u.email) <> ''
WHERE UPPER(TRIM(n.destinataire)) IN ('ADMINISTRATEUR', 'RESPONSABLE')
  AND n.masquee_le IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM notifications existing
    WHERE LOWER(TRIM(existing.destinataire)) = LOWER(TRIM(u.email))
      AND (
        (n.anomalie_id IS NOT NULL AND existing.anomalie_id = n.anomalie_id)
        OR (
          n.anomalie_id IS NULL
          AND existing.anomalie_id IS NULL
          AND COALESCE(existing.type, '') = COALESCE(n.type, '')
          AND COALESCE(existing.sujet, '') = COALESCE(n.sujet, '')
          AND COALESCE(existing.message, '') = COALESCE(n.message, '')
          AND existing.created_at IS NOT DISTINCT FROM n.created_at
        )
      )
  )
ON CONFLICT DO NOTHING;

-- Les anciennes alertes génériques AGENT sont transférées uniquement à l'Agent
-- ayant créé le relevé source. Aucune alerte n'est diffusée à tous les Agents.
INSERT INTO notifications (
  type,
  destinataire,
  sujet,
  message,
  date_envoi,
  statut,
  anomalie_id,
  created_at,
  archive_le,
  masquee_le
)
SELECT
  n.type,
  LOWER(TRIM(u.email)),
  n.sujet,
  n.message,
  n.date_envoi,
  n.statut,
  n.anomalie_id,
  n.created_at,
  n.archive_le,
  NULL
FROM notifications n
JOIN anomalies a
  ON a.id = n.anomalie_id
JOIN releves r
  ON r.id = a.releve_id
JOIN users u
  ON u.id = r.created_by
 AND UPPER(TRIM(u.role)) = 'AGENT'
 AND u.email IS NOT NULL
 AND TRIM(u.email) <> ''
WHERE UPPER(TRIM(n.destinataire)) = 'AGENT'
  AND n.anomalie_id IS NOT NULL
  AND n.masquee_le IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM notifications existing
    WHERE existing.anomalie_id = n.anomalie_id
      AND LOWER(TRIM(existing.destinataire)) = LOWER(TRIM(u.email))
  )
ON CONFLICT DO NOTHING;

-- Les anciennes lignes adressées directement à un rôle ne doivent plus être
-- présentées comme des notifications personnelles. Les copies personnelles créées
-- plus haut conservent le contenu, le statut, la date et l'état d'archivage.
UPDATE notifications
SET masquee_le = COALESCE(masquee_le, CURRENT_TIMESTAMP)
WHERE UPPER(TRIM(destinataire)) IN ('ADMINISTRATEUR', 'RESPONSABLE', 'AGENT')
  AND masquee_le IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_archivees_destinataire
  ON notifications (LOWER(TRIM(destinataire)), archive_le)
  WHERE archive_le IS NOT NULL AND masquee_le IS NULL;

COMMIT;
