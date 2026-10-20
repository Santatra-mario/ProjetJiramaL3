-- JIRAMA - Reparation additive du schema user_settings / user_audit_logs
-- Corrige les colonnes attendues par settingsController.js, responsableController.js
-- et agentController.js sans supprimer les donnees existantes.
-- Base cible : jirama_db (verifier backend/.env avant execution).

BEGIN;

-- 1. Creer la table si elle n'existe pas encore.
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    theme VARCHAR(12) NOT NULL DEFAULT 'system',
    compact_mode BOOLEAN NOT NULL DEFAULT FALSE,
    reduce_motion BOOLEAN NOT NULL DEFAULT FALSE,
    notif_anomalies BOOLEAN NOT NULL DEFAULT TRUE,
    notif_releves BOOLEAN NOT NULL DEFAULT TRUE,
    notif_decisions BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Ajouter les colonnes attendues si user_settings a deja ete creee
--    par l'ancienne migration 005_parametres_utilisateur.sql.
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS theme VARCHAR(12) DEFAULT 'system';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS compact_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS reduce_motion BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notif_anomalies BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notif_releves BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notif_decisions BOOLEAN DEFAULT TRUE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- 3. Supprimer uniquement les contraintes CHECK qui valident le theme,
--    car l'ancienne migration utilise 'systeme' alors que le backend utilise 'system'.
DO $migration$
DECLARE
    constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.user_settings'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%theme%'
    LOOP
        EXECUTE format('ALTER TABLE public.user_settings DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;
END
$migration$;

-- 4. Recuperer les anciennes preferences JSON si elles existent.
--    Cela evite de remplacer les preferences deja enregistrees par les valeurs par defaut.
DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_settings'
          AND column_name = 'notification_preferences'
    ) THEN
        EXECUTE $sql$
            UPDATE public.user_settings
            SET notif_anomalies = COALESCE((notification_preferences->>'anomalies')::BOOLEAN, notif_anomalies),
                notif_releves = COALESCE((notification_preferences->>'releves')::BOOLEAN, notif_releves),
                notif_decisions = COALESCE(
                    (notification_preferences->>'decisions')::BOOLEAN,
                    (notification_preferences->>'traitement')::BOOLEAN,
                    notif_decisions
                )
        $sql$;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_settings'
          AND column_name = 'display_preferences'
    ) THEN
        EXECUTE $sql$
            UPDATE public.user_settings
            SET compact_mode = COALESCE((display_preferences->>'modeCompact')::BOOLEAN, compact_mode),
                reduce_motion = COALESCE((display_preferences->>'mouvementReduit')::BOOLEAN, reduce_motion)
        $sql$;
    END IF;
END
$migration$;

-- 5. Completer les valeurs nulles et aligner les valeurs/defaults sur le backend.
UPDATE public.user_settings
SET theme = CASE
                WHEN LOWER(BTRIM(COALESCE(theme::TEXT, ''))) IN ('clair', 'sombre')
                    THEN LOWER(BTRIM(theme::TEXT))
                ELSE 'system'
            END,
    compact_mode = COALESCE(compact_mode, FALSE),
    reduce_motion = COALESCE(reduce_motion, FALSE),
    notif_anomalies = COALESCE(notif_anomalies, TRUE),
    notif_releves = COALESCE(notif_releves, TRUE),
    notif_decisions = COALESCE(notif_decisions, TRUE),
    created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);

ALTER TABLE public.user_settings ALTER COLUMN theme TYPE VARCHAR(12) USING BTRIM(theme::TEXT)::VARCHAR(12);
ALTER TABLE public.user_settings ALTER COLUMN theme SET DEFAULT 'system';
ALTER TABLE public.user_settings ALTER COLUMN theme SET NOT NULL;
ALTER TABLE public.user_settings ALTER COLUMN compact_mode SET DEFAULT FALSE;
ALTER TABLE public.user_settings ALTER COLUMN compact_mode SET NOT NULL;
ALTER TABLE public.user_settings ALTER COLUMN reduce_motion SET DEFAULT FALSE;
ALTER TABLE public.user_settings ALTER COLUMN reduce_motion SET NOT NULL;
ALTER TABLE public.user_settings ALTER COLUMN notif_anomalies SET DEFAULT TRUE;
ALTER TABLE public.user_settings ALTER COLUMN notif_anomalies SET NOT NULL;
ALTER TABLE public.user_settings ALTER COLUMN notif_releves SET DEFAULT TRUE;
ALTER TABLE public.user_settings ALTER COLUMN notif_releves SET NOT NULL;
ALTER TABLE public.user_settings ALTER COLUMN notif_decisions SET DEFAULT TRUE;
ALTER TABLE public.user_settings ALTER COLUMN notif_decisions SET NOT NULL;
ALTER TABLE public.user_settings ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.user_settings ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.user_settings ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.user_settings ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.user_settings
    ADD CONSTRAINT user_settings_theme_valid_check
    CHECK (theme IN ('clair', 'sombre', 'system'));

-- 6. Le controleur Parametres utilise aussi user_audit_logs.
CREATE TABLE IF NOT EXISTS public.user_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    actor_role VARCHAR(32),
    action VARCHAR(100) NOT NULL DEFAULT 'MIGRATION',
    resource_type VARCHAR(80),
    resource_id VARCHAR(100),
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Completer cette table si elle existait deja avec un schema incomplet.
ALTER TABLE public.user_audit_logs ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE public.user_audit_logs ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE public.user_audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(32);
ALTER TABLE public.user_audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100) DEFAULT 'MIGRATION';
ALTER TABLE public.user_audit_logs ADD COLUMN IF NOT EXISTS resource_type VARCHAR(80);
ALTER TABLE public.user_audit_logs ADD COLUMN IF NOT EXISTS resource_id VARCHAR(100);
ALTER TABLE public.user_audit_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::JSONB;
ALTER TABLE public.user_audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

UPDATE public.user_audit_logs
SET action = COALESCE(NULLIF(BTRIM(action), ''), 'MIGRATION'),
    details = COALESCE(details, '{}'::JSONB),
    created_at = COALESCE(created_at, CURRENT_TIMESTAMP);

ALTER TABLE public.user_audit_logs ALTER COLUMN action SET DEFAULT 'MIGRATION';
ALTER TABLE public.user_audit_logs ALTER COLUMN action SET NOT NULL;
ALTER TABLE public.user_audit_logs ALTER COLUMN details SET DEFAULT '{}'::JSONB;
ALTER TABLE public.user_audit_logs ALTER COLUMN details SET NOT NULL;
ALTER TABLE public.user_audit_logs ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.user_audit_logs ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_audit_logs_user_date
    ON public.user_audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_audit_logs_action_date
    ON public.user_audit_logs (action, created_at DESC);

COMMIT;

-- 7. Verification apres migration : les colonnes attendues doivent apparaitre.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
      (table_name = 'user_settings' AND column_name IN
        ('theme','compact_mode','reduce_motion','notif_anomalies','notif_releves','notif_decisions','created_at','updated_at'))
      OR
      (table_name = 'user_audit_logs' AND column_name IN
        ('id','user_id','actor_role','action','resource_type','resource_id','details','created_at'))
  )
ORDER BY table_name, ordinal_position;
