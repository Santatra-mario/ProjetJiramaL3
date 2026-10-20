-- JIRAMA — Compléter le journal d'audit partagé déjà utilisé par les contrôleurs.
-- Migration additive : ne supprime aucun événement et ne crée pas un journal parallèle.
BEGIN;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  acteur_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acteur_role VARCHAR(30),
  action_code VARCHAR(100) NOT NULL DEFAULT 'ACTION_EXISTANTE',
  ressource_type VARCHAR(80),
  ressource_id VARCHAR(120),
  resultat VARCHAR(20) NOT NULL DEFAULT 'SUCCES',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- S'assure que les colonnes attendues par le journal existant sont disponibles,
-- même si audit_logs avait été créé auparavant avec un schéma partiel.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS acteur_id INTEGER;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS acteur_role VARCHAR(30);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_code VARCHAR(100) NOT NULL DEFAULT 'ACTION_EXISTANTE';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ressource_type VARCHAR(80);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ressource_id VARCHAR(120);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resultat VARCHAR(20) NOT NULL DEFAULT 'SUCCES';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE audit_logs SET action_code = 'ACTION_EXISTANTE' WHERE action_code IS NULL OR BTRIM(action_code) = '';
UPDATE audit_logs SET resultat = 'SUCCES' WHERE resultat IS NULL OR BTRIM(resultat) = '';
UPDATE audit_logs SET details = '{}'::jsonb WHERE details IS NULL;
UPDATE audit_logs SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;

ALTER TABLE audit_logs ALTER COLUMN action_code SET DEFAULT 'ACTION_EXISTANTE';
ALTER TABLE audit_logs ALTER COLUMN action_code SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN resultat SET DEFAULT 'SUCCES';
ALTER TABLE audit_logs ALTER COLUMN resultat SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN details SET DEFAULT '{}'::jsonb;
ALTER TABLE audit_logs ALTER COLUMN details SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE audit_logs ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_acteur_created_at ON audit_logs (acteur_id, created_at DESC, id DESC);

-- Récupère de façon idempotente les anciennes entrées du journal de paramètres,
-- si la migration 005 d'une ancienne version avait créé user_activity_log.
DO $$
BEGIN
  IF to_regclass('public.user_activity_log') IS NOT NULL THEN
    INSERT INTO audit_logs
      (acteur_id, acteur_role, action_code, ressource_type, ressource_id, resultat, details, created_at)
    SELECT
      l.actor_id,
      l.actor_role,
      LEFT(COALESCE(NULLIF(l.action, ''), 'ACTION_PARAMETRES'), 100),
      LEFT(l.entity_type, 80),
      LEFT(l.entity_id, 120),
      'SUCCES',
      jsonb_build_object('description', l.description, 'metadata', COALESCE(l.metadata, '{}'::jsonb)),
      l.created_at
    FROM user_activity_log l
    WHERE NOT EXISTS (
      SELECT 1
      FROM audit_logs a
      WHERE a.acteur_id IS NOT DISTINCT FROM l.actor_id
        AND a.action_code = LEFT(COALESCE(NULLIF(l.action, ''), 'ACTION_PARAMETRES'), 100)
        AND a.ressource_type IS NOT DISTINCT FROM LEFT(l.entity_type, 80)
        AND a.ressource_id IS NOT DISTINCT FROM LEFT(l.entity_id, 120)
        AND a.created_at = l.created_at
        AND a.details->>'description' = l.description
    );
  END IF;
END $$;

COMMIT;
