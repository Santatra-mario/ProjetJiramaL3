-- Retour arrière de la migration 004.
-- ATTENTION : cette opération efface les préférences et le journal d'audit stockés dans ces tables.
-- Sauvegardez la base avant utilisation.
BEGIN;
DROP INDEX IF EXISTS idx_user_audit_logs_action_date;
DROP INDEX IF EXISTS idx_user_audit_logs_user_date;
DROP TABLE IF EXISTS user_audit_logs;
DROP TABLE IF EXISTS user_settings;
COMMIT;
