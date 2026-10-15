-- =========================================================
-- JIRAMA — Migration 001 : suppression persistante des notifications
-- À exécuter UNE FOIS sur la base PostgreSQL, avant de redémarrer le backend.
--   psql -U <utilisateur> -d <base> -f sql/001_notifications_masquage.sql
--
-- Non destructive : aucune ligne n'est supprimée.
-- Retour arrière : sql/001_notifications_masquage_rollback.sql
-- =========================================================

BEGIN;

-- 1) Colonne de masquage : NULL = visible, date = notification supprimée.
--    La ligne reste en base : la synchronisation des anomalies ne la recrée plus.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS masquee_le TIMESTAMP NULL;

-- 2) Aperçu des doublons éventuels (une même anomalie notifiée plusieurs fois
--    au même destinataire). Lecture seule.
SELECT
  anomalie_id,
  LOWER(TRIM(destinataire)) AS destinataire,
  COUNT(*)                  AS occurrences
FROM notifications
WHERE anomalie_id IS NOT NULL
GROUP BY anomalie_id, LOWER(TRIM(destinataire))
HAVING COUNT(*) > 1;

-- 3) Index unique : empêche les doublons même si deux requêtes arrivent
--    en même temps. Créé seulement s'il n'y a aucun doublon.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM notifications
    WHERE anomalie_id IS NOT NULL
    GROUP BY anomalie_id, LOWER(TRIM(destinataire))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Doublons détectés : index unique NON créé. Nettoyez-les (voir backend/sql_fix_notifications.sql, étape 1) puis relancez ce script.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_anomalie_destinataire
      ON notifications (anomalie_id, LOWER(TRIM(destinataire)))
      WHERE anomalie_id IS NOT NULL;
  END IF;
END $$;

-- 4) Index pour les listes (notifications visibles d'un destinataire)
CREATE INDEX IF NOT EXISTS idx_notifications_visibles
  ON notifications (LOWER(TRIM(destinataire)))
  WHERE masquee_le IS NULL;

COMMIT;
