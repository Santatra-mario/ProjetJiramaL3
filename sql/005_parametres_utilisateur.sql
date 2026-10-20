-- JIRAMA — Préférences utilisateur (Admin, Agent, Responsable)
-- Migration additive et réexécutable. À lancer sur la base configurée dans backend/.env.
-- Le journal d'audit partagé est géré par sql/006_audit_logs_parametres.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(16) NOT NULL DEFAULT 'systeme',
  notification_preferences JSONB NOT NULL DEFAULT
    '{"anomalies": true, "releves": true, "traitement": true}'::jsonb,
  display_preferences JSONB NOT NULL DEFAULT
    '{"mouvementReduit": false, "modeCompact": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_settings_theme_valide CHECK (theme IN ('systeme', 'clair', 'sombre'))
);

-- Complète une table préexistante sans écraser les préférences déjà enregistrées.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS theme VARCHAR(16) NOT NULL DEFAULT 'systeme';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT
  '{"anomalies": true, "releves": true, "traitement": true}'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS display_preferences JSONB NOT NULL DEFAULT
  '{"mouvementReduit": false, "modeCompact": false}'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE user_settings SET theme = 'systeme' WHERE theme IS NULL OR theme NOT IN ('systeme', 'clair', 'sombre');
UPDATE user_settings SET notification_preferences = '{"anomalies": true, "releves": true, "traitement": true}'::jsonb WHERE notification_preferences IS NULL;
UPDATE user_settings SET display_preferences = '{"mouvementReduit": false, "modeCompact": false}'::jsonb WHERE display_preferences IS NULL;

ALTER TABLE user_settings ALTER COLUMN theme SET DEFAULT 'systeme';
ALTER TABLE user_settings ALTER COLUMN notification_preferences SET DEFAULT '{"anomalies": true, "releves": true, "traitement": true}'::jsonb;
ALTER TABLE user_settings ALTER COLUMN display_preferences SET DEFAULT '{"mouvementReduit": false, "modeCompact": false}'::jsonb;

COMMIT;
