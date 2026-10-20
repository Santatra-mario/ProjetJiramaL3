-- JIRAMA — Paramètres par utilisateur et journal d'audit.
-- Exécuter une seule fois depuis la racine jirama-L3 après sauvegarde.
-- psql -U <utilisateur> -d <base> -v ON_ERROR_STOP=1 -f sql/004_settings_utilisateur.sql
BEGIN;
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(12) NOT NULL DEFAULT 'system' CHECK (theme IN ('clair','sombre','system')),
  compact_mode BOOLEAN NOT NULL DEFAULT FALSE,
  reduce_motion BOOLEAN NOT NULL DEFAULT FALSE,
  notif_anomalies BOOLEAN NOT NULL DEFAULT TRUE,
  notif_releves BOOLEAN NOT NULL DEFAULT TRUE,
  notif_decisions BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(32),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(80),
  resource_id VARCHAR(100),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_audit_logs_user_date ON user_audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_audit_logs_action_date ON user_audit_logs (action, created_at DESC);
COMMIT;
