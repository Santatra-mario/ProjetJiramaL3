BEGIN;

-- Un relevé initial ne possède ni ancienne date ni ancien index.
-- Les relevés périodiques existants restent inchangés.
ALTER TABLE public.releves
  ALTER COLUMN date_ancien_releve DROP NOT NULL,
  ALTER COLUMN ancien_index DROP NOT NULL,
  ALTER COLUMN consommation DROP NOT NULL;

ALTER TABLE public.releves
  ADD COLUMN IF NOT EXISTS type_releve VARCHAR(20),
  ADD COLUMN IF NOT EXISTS observation TEXT;

UPDATE public.releves
SET type_releve = 'PERIODIQUE'
WHERE type_releve IS NULL;

ALTER TABLE public.releves
  ALTER COLUMN type_releve SET DEFAULT 'PERIODIQUE',
  ALTER COLUMN type_releve SET NOT NULL;

-- Vérifie les nouvelles écritures sans bloquer une migration à cause
-- d'éventuelles anciennes lignes historiques à examiner séparément.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_releves_type_releve'
      AND conrelid = 'public.releves'::regclass
  ) THEN
    ALTER TABLE public.releves
      ADD CONSTRAINT chk_releves_type_releve
      CHECK (
        (
          type_releve = 'INITIAL'
          AND date_ancien_releve IS NULL
          AND ancien_index IS NULL
          AND consommation IS NULL
        )
        OR
        (
          type_releve = 'PERIODIQUE'
          AND ancien_index IS NOT NULL
          AND consommation IS NOT NULL
        )
      ) NOT VALID;
  END IF;
END $$;

-- Empêche deux index initiaux officiels pour le même compteur.
CREATE UNIQUE INDEX IF NOT EXISTS uq_releves_initial_par_compteur
  ON public.releves (compteur_id)
  WHERE type_releve = 'INITIAL';

COMMIT;
