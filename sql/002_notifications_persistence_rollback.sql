-- Retour arrière partiel de sql/002_notifications_persistence.sql
-- Les transformations des destinataires et les dates de masquage ne sont pas annulées,
-- car les annuler pourrait faire réapparaître des notifications supprimées par l’utilisateur.
-- Ce script rétablit seulement l’index de déduplication historique lorsqu’il est possible.

BEGIN;
DROP INDEX IF EXISTS uq_notifications_anomalie_destinataire;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM notifications
    WHERE anomalie_id IS NOT NULL
    GROUP BY anomalie_id, LOWER(TRIM(destinataire))
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX uq_notifications_anomalie_destinataire
      ON notifications (anomalie_id, (LOWER(TRIM(destinataire))))
      WHERE anomalie_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'Index historique non recréé : des doublons persistent, y compris dans les lignes masquées.';
  END IF;
END $$;

-- Cet index est déjà prévu par la migration 001 et reste nécessaire à l’application.
CREATE INDEX IF NOT EXISTS idx_notifications_visibles
  ON notifications (LOWER(TRIM(destinataire)))
  WHERE masquee_le IS NULL;

COMMIT;
