-- JIRAMA — Migration 008 : notifications systématiques de suivi des relevés.
-- À exécuter une fois depuis la racine jirama-L3, après sauvegarde :
-- psql -h localhost -p 5432 -U postgres -d jirama_db -v ON_ERROR_STOP=1 -f "sql/008_notifications_suivi_releves.sql"
-- Migration additive : elle ne supprime aucune notification, anomalie, facture ou relevé.

BEGIN;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS releve_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS reference_consommation NUMERIC(14,3) NULL,
  ADD COLUMN IF NOT EXISTS variation_pourcentage NUMERIC(10,2) NULL,
  ADD COLUMN IF NOT EXISTS classification VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS niveau_gravite VARCHAR(20) NULL;

-- La colonne evenement_cle est normalement déjà créée par la migration 003.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS evenement_cle VARCHAR(180) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_notifications_releve_id'
      AND conrelid = 'notifications'::regclass
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT fk_notifications_releve_id
      FOREIGN KEY (releve_id)
      REFERENCES releves(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_releve_id
  ON notifications(releve_id)
  WHERE releve_id IS NOT NULL;

-- Une seule notification de suivi par relevé et destinataire. Cette unicité
-- inclut aussi les notifications archivées/masquées pour empêcher les doublons.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_releve_destinataire_evenement
  ON notifications (releve_id, (LOWER(TRIM(destinataire))), evenement_cle)
  WHERE releve_id IS NOT NULL AND evenement_cle IS NOT NULL;

COMMIT;

-- Vérification rapide après COMMIT :
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'notifications'
  AND column_name IN (
    'releve_id',
    'evenement_cle',
    'reference_consommation',
    'variation_pourcentage',
    'classification',
    'niveau_gravite'
  )
ORDER BY column_name;
