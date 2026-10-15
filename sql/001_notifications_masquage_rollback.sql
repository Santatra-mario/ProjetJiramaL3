-- JIRAMA — Retour arrière de la migration 001
-- ATTENTION : supprimer la colonne perd l'information « notification masquée » ;
-- les notifications supprimées redeviendront visibles.
BEGIN;
DROP INDEX IF EXISTS idx_notifications_visibles;
DROP INDEX IF EXISTS uq_notifications_anomalie_destinataire;
ALTER TABLE notifications DROP COLUMN IF EXISTS masquee_le;
COMMIT;
