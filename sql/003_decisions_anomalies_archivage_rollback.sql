-- RETOUR ARRIÈRE DE LA MIGRATION 003
-- ATTENTION : les décisions, motifs, auteurs de décision, dates d'archivage et
-- clés d'événement seront perdus. Sauvegarder la base avant toute exécution.
BEGIN;
DROP INDEX IF EXISTS uq_notifications_evenement_destinataire;
DROP INDEX IF EXISTS idx_notifications_archivees;
DROP INDEX IF EXISTS idx_notifications_visibles;
ALTER TABLE anomalies DROP CONSTRAINT IF EXISTS ck_anomalies_decision_admin;
ALTER TABLE anomalies DROP COLUMN IF EXISTS decision_admin;
ALTER TABLE anomalies DROP COLUMN IF EXISTS motif_decision;
ALTER TABLE anomalies DROP COLUMN IF EXISTS decide_par;
ALTER TABLE anomalies DROP COLUMN IF EXISTS date_decision;
ALTER TABLE notifications DROP COLUMN IF EXISTS evenement_cle;
ALTER TABLE notifications DROP COLUMN IF EXISTS archive_le;
CREATE INDEX IF NOT EXISTS idx_notifications_visibles
  ON notifications (LOWER(TRIM(destinataire)))
  WHERE masquee_le IS NULL;
COMMIT;
