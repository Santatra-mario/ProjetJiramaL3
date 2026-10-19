-- JIRAMA — Migration 003 : archivage distinct de la suppression des notifications
-- À exécuter une fois sur la même base PostgreSQL que le backend.
-- psql -U <utilisateur> -d <base> -v ON_ERROR_STOP=1 -f sql/003_notifications_archivage.sql

BEGIN;

-- NULL = notification active ; une date = notification archivée.
-- La colonne masquee_le reste réservée à la suppression logique/au masquage.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS archive_le TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_archivees_destinataire
  ON notifications (LOWER(TRIM(destinataire)), archive_le)
  WHERE archive_le IS NOT NULL;

COMMIT;
